"""
EduPredict - MongoDB Academic Data Ingestion Pipeline
Validates cleaned dataset records, normalizes data types, performs batch upsert
into MongoDB 6.x, and logs comprehensive audit summaries.
"""

import os
import sys
import logging
from typing import Dict, Any, List
import pandas as pd
from pymongo import UpdateOne
from pymongo.database import Database
from pymongo.errors import PyMongoError

from backend.app import create_app
from backend.extensions import mongo
from backend.database.schema import init_db_indexes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROCESSED_DATA_PATH = os.path.join("data", "processed", "cleaned_academic_records.csv")
BATCH_SIZE = 250


def validate_record(row: Dict[str, Any]) -> bool:
    """Validate that required fields exist and values conform to range constraints."""
    required_keys = [
        "student_code", "subject", "academic_year", "term",
        "attendance_percentage", "study_hours_per_week",
        "previous_exam_marks", "quiz_scores", "final_exam_marks",
        "academic_status"
    ]
    for key in required_keys:
        if key not in row or row[key] is None or pd.isna(row[key]):
            return False

    # Value range checks
    if not (0.0 <= float(row["attendance_percentage"]) <= 100.0):
        return False
    if not (0.0 <= float(row["previous_exam_marks"]) <= 100.0):
        return False
    if not (0.0 <= float(row["quiz_scores"]) <= 100.0):
        return False
    if not (0.0 <= float(row["final_exam_marks"]) <= 100.0):
        return False
    if row["academic_status"] not in ["High Risk", "Moderate Risk", "Low Risk / On Track"]:
        return False

    return True


def ingest_academic_data(
    db: Database,
    csv_path: str = PROCESSED_DATA_PATH,
    collection_name: str = "analytical_academic_records",
    batch_size: int = BATCH_SIZE
) -> Dict[str, Any]:
    """
    Ingest verified academic dataset records into MongoDB with batch upserts.
    Guarantees duplicate-safe idempotency.
    """
    if db is None:
        raise ValueError("MongoDB database instance cannot be None.")

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Processed dataset not found at '{csv_path}'. Run clean_dataset first.")

    # Initialize / verify indexes
    init_db_indexes(db)
    coll = db[collection_name]

    # Pre-ingestion telemetry
    count_before = coll.count_documents({})
    logger.info(f"Target collection '{collection_name}' has {count_before} documents prior to ingestion.")

    df = pd.read_csv(csv_path)
    total_rows = len(df)
    logger.info(f"Loaded {total_rows} records from '{csv_path}'. Beginning validation and batching...")

    valid_records: List[Dict[str, Any]] = []
    invalid_records = 0

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        if not validate_record(row_dict):
            invalid_records += 1
            logger.warning(f"Record at row {idx} failed validation constraints. Skipping.")
            continue

        # Type normalization
        doc = {
            "student_code": str(row_dict["student_code"]).strip(),
            "subject": str(row_dict["subject"]).strip(),
            "academic_year": str(row_dict.get("academic_year", "2025-2026")).strip(),
            "term": str(row_dict.get("term", "Final Term")).strip(),
            "school": str(row_dict.get("school", "")).strip(),
            "sex": str(row_dict.get("sex", "")).strip(),
            "age": int(row_dict.get("age", 0)),
            "address": str(row_dict.get("address", "")).strip(),
            "famsize": str(row_dict.get("famsize", "")).strip(),
            "p_status": str(row_dict.get("Pstatus", "")).strip(),
            "mother_education": int(row_dict.get("Medu", 0)),
            "father_education": int(row_dict.get("Fedu", 0)),
            "study_hours_per_week": float(row_dict.get("study_hours_per_week", 0.0)),
            "failures": int(row_dict.get("failures", 0)),
            "school_support": str(row_dict.get("schoolsup", "no")).strip(),
            "family_support": str(row_dict.get("famsup", "no")).strip(),
            "extra_paid_classes": str(row_dict.get("paid", "no")).strip(),
            "activities": str(row_dict.get("activities", "no")).strip(),
            "higher_education": str(row_dict.get("higher", "yes")).strip(),
            "internet": str(row_dict.get("internet", "yes")).strip(),
            "romantic": str(row_dict.get("romantic", "no")).strip(),
            "family_relationship": int(row_dict.get("famrel", 3)),
            "free_time": int(row_dict.get("freetime", 3)),
            "go_out": int(row_dict.get("goout", 3)),
            "health": int(row_dict.get("health", 3)),
            "absences": int(row_dict.get("absences", 0)),
            "attendance_percentage": float(row_dict["attendance_percentage"]),
            "assignment_completion_rate": float(row_dict.get("assignment_completion_rate", 75.0)),
            "previous_exam_marks": float(row_dict["previous_exam_marks"]),
            "quiz_scores": float(row_dict["quiz_scores"]),
            "final_exam_marks": float(row_dict["final_exam_marks"]),
            "academic_status": str(row_dict["academic_status"]).strip(),
        }
        valid_records.append(doc)

    # Batch Upsert using bulk_write
    upserted_count = 0
    matched_count = 0
    modified_count = 0

    for i in range(0, len(valid_records), batch_size):
        chunk = valid_records[i : i + batch_size]
        operations = [
            UpdateOne(
                {
                    "student_code": doc["student_code"],
                    "subject": doc["subject"],
                    "academic_year": doc["academic_year"],
                },
                {"$set": doc},
                upsert=True,
            )
            for doc in chunk
        ]

        try:
            res = coll.bulk_write(operations, ordered=False)
            upserted_count += len(res.upserted_ids) if res.upserted_ids else 0
            matched_count += res.matched_count
            modified_count += res.modified_count
            logger.info(
                f"Batch [{i+1}-{i+len(chunk)}] committed: "
                f"{len(res.upserted_ids) if res.upserted_ids else 0} new, "
                f"{res.modified_count} updated, {res.matched_count} matched."
            )
        except PyMongoError as pe:
            logger.error(f"Bulk write error in batch starting at index {i}: {str(pe)}")
            raise

    # Post-ingestion telemetry
    count_after = coll.count_documents({})
    net_added = count_after - count_before

    summary = {
        "collection": collection_name,
        "source_file": csv_path,
        "total_source_rows": total_rows,
        "valid_records_processed": len(valid_records),
        "invalid_records_rejected": invalid_records,
        "newly_upserted_count": upserted_count,
        "matched_existing_count": matched_count,
        "modified_count": modified_count,
        "count_before_ingestion": count_before,
        "count_after_ingestion": count_after,
        "net_documents_added": net_added,
        "status": "COMPLETED_SUCCESSFULLY",
    }

    logger.info("=== INGESTION SUMMARY ===")
    logger.info(
        f"Collection: '{collection_name}' | Before: {count_before} | After: {count_after} | Net Added: {net_added}"
    )

    return summary


def main():
    app = create_app(os.getenv("FLASK_ENV", "development"))
    with app.app_context():
        summary = ingest_academic_data(mongo.db)
        print("\n--- Ingestion Result ---")
        for k, v in summary.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
