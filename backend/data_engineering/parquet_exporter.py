"""
EduPredict - MongoDB to Partitioned Parquet Lakehouse Export Bridge
Reads academic records from MongoDB 6.x, validates data types and domain constraints,
and exports partitioned Snappy-compressed Parquet files for the EduPredict Analytical Lakehouse.
"""

import os
import shutil
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from uuid import uuid4

import pyarrow as pa
import pyarrow.parquet as pq
from pymongo.database import Database
from pymongo.errors import PyMongoError

from backend.config import get_config

logger = logging.getLogger(__name__)

# ==============================================================================
# Lakehouse Parquet Schema (Matches analytics/impala/01_create_academic_lakehouse_tables.sql)
# ==============================================================================

ACADEMIC_LAKEHOUSE_SCHEMA = pa.schema([
    ("student_code", pa.string()),
    ("term", pa.string()),
    ("school", pa.string()),
    ("sex", pa.string()),
    ("age", pa.int32()),
    ("address", pa.string()),
    ("famsize", pa.string()),
    ("p_status", pa.string()),
    ("mother_education", pa.int32()),
    ("father_education", pa.int32()),
    ("study_hours_per_week", pa.float64()),
    ("failures", pa.int32()),
    ("school_support", pa.string()),
    ("family_support", pa.string()),
    ("extra_paid_classes", pa.string()),
    ("activities", pa.string()),
    ("higher_education", pa.string()),
    ("internet", pa.string()),
    ("romantic", pa.string()),
    ("family_relationship", pa.int32()),
    ("free_time", pa.int32()),
    ("go_out", pa.int32()),
    ("health", pa.int32()),
    ("absences", pa.int32()),
    ("attendance_percentage", pa.float64()),
    ("assignment_completion_rate", pa.float64()),
    ("previous_exam_marks", pa.float64()),
    ("quiz_scores", pa.float64()),
    ("final_exam_marks", pa.float64()),
    ("academic_status", pa.string()),
    ("subject", pa.string()),
    ("academic_year", pa.string()),
])

PARTITION_COLS = ["subject", "academic_year"]

REQUIRED_FIELDS = {
    "student_code",
    "subject",
    "academic_year",
    "term",
    "attendance_percentage",
    "study_hours_per_week",
    "previous_exam_marks",
    "quiz_scores",
    "final_exam_marks",
    "academic_status",
}

VALID_RISK_STATUSES = {"High Risk", "Moderate Risk", "Low Risk / On Track"}


class LakehouseExportError(Exception):
    """Raised when an error occurs during the Lakehouse Parquet export process."""
    pass


def validate_record_for_export(doc: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validate a single MongoDB document for lakehouse export.
    Verifies presence of required fields, data types, and value boundaries.
    Returns (is_valid, rejection_reason, normalized_record).
    """
    if not isinstance(doc, dict):
        return False, "Record is not a dictionary.", None

    # 1. Required fields presence check
    for field in REQUIRED_FIELDS:
        if field not in doc:
            return False, f"Missing required field: '{field}'", None
        val = doc[field]
        if val is None:
            return False, f"Field '{field}' cannot be None.", None
        if isinstance(val, str) and not val.strip():
            return False, f"String field '{field}' cannot be empty.", None

    # 2. String field extractions & normalization
    student_code = str(doc["student_code"]).strip()
    subject = str(doc["subject"]).strip()
    academic_year = str(doc["academic_year"]).strip()
    term = str(doc["term"]).strip()
    academic_status = str(doc["academic_status"]).strip()

    if academic_status not in VALID_RISK_STATUSES:
        return (
            False,
            f"Invalid academic_status '{academic_status}'. Expected one of {VALID_RISK_STATUSES}.",
            None,
        )

    # 3. Numeric range validations
    try:
        attendance_percentage = float(doc["attendance_percentage"])
        if not (0.0 <= attendance_percentage <= 100.0):
            return False, f"attendance_percentage {attendance_percentage} out of bounds [0.0, 100.0].", None

        previous_exam_marks = float(doc["previous_exam_marks"])
        if not (0.0 <= previous_exam_marks <= 100.0):
            return False, f"previous_exam_marks {previous_exam_marks} out of bounds [0.0, 100.0].", None

        quiz_scores = float(doc["quiz_scores"])
        if not (0.0 <= quiz_scores <= 100.0):
            return False, f"quiz_scores {quiz_scores} out of bounds [0.0, 100.0].", None

        final_exam_marks = float(doc["final_exam_marks"])
        if not (0.0 <= final_exam_marks <= 100.0):
            return False, f"final_exam_marks {final_exam_marks} out of bounds [0.0, 100.0].", None

        study_hours_per_week = float(doc["study_hours_per_week"])
        if study_hours_per_week < 0.0:
            return False, f"study_hours_per_week {study_hours_per_week} cannot be negative.", None

        age = int(doc.get("age", 0))
        if age < 0:
            return False, f"age {age} cannot be negative.", None

        failures = int(doc.get("failures", 0))
        if failures < 0:
            return False, f"failures {failures} cannot be negative.", None

        absences = int(doc.get("absences", 0))
        if absences < 0:
            return False, f"absences {absences} cannot be negative.", None

        assignment_completion_rate = float(doc.get("assignment_completion_rate", 75.0))
        if not (0.0 <= assignment_completion_rate <= 100.0):
            return False, f"assignment_completion_rate {assignment_completion_rate} out of bounds [0.0, 100.0].", None

    except (ValueError, TypeError) as e:
        return False, f"Numeric conversion error: {str(e)}", None

    # 4. Construct normalized record strictly adhering to ACADEMIC_LAKEHOUSE_SCHEMA
    normalized = {
        "student_code": student_code,
        "term": term,
        "school": str(doc.get("school", "")).strip(),
        "sex": str(doc.get("sex", "")).strip(),
        "age": age,
        "address": str(doc.get("address", "")).strip(),
        "famsize": str(doc.get("famsize", "")).strip(),
        "p_status": str(doc.get("p_status", doc.get("Pstatus", ""))).strip(),
        "mother_education": int(doc.get("mother_education", doc.get("Medu", 0))),
        "father_education": int(doc.get("father_education", doc.get("Fedu", 0))),
        "study_hours_per_week": study_hours_per_week,
        "failures": failures,
        "school_support": str(doc.get("school_support", doc.get("schoolsup", "no"))).strip(),
        "family_support": str(doc.get("family_support", doc.get("famsup", "no"))).strip(),
        "extra_paid_classes": str(doc.get("extra_paid_classes", doc.get("paid", "no"))).strip(),
        "activities": str(doc.get("activities", "no")).strip(),
        "higher_education": str(doc.get("higher_education", doc.get("higher", "yes"))).strip(),
        "internet": str(doc.get("internet", "yes")).strip(),
        "romantic": str(doc.get("romantic", "no")).strip(),
        "family_relationship": int(doc.get("family_relationship", doc.get("famrel", 3))),
        "free_time": int(doc.get("free_time", doc.get("freetime", 3))),
        "go_out": int(doc.get("go_out", doc.get("goout", 3))),
        "health": int(doc.get("health", 3)),
        "absences": absences,
        "attendance_percentage": attendance_percentage,
        "assignment_completion_rate": assignment_completion_rate,
        "previous_exam_marks": previous_exam_marks,
        "quiz_scores": quiz_scores,
        "final_exam_marks": final_exam_marks,
        "academic_status": academic_status,
        "subject": subject,
        "academic_year": academic_year,
    }

    return True, None, normalized


class ParquetLakehouseExporter:
    """
    Exports academic records from MongoDB to partitioned Apache Parquet lakehouse files.
    Enforces Snappy compression, partition pruning layout, and deterministic execution.
    """

    def __init__(
        self,
        db: Optional[Database] = None,
        export_dir: Optional[str] = None,
        batch_size: Optional[int] = None,
    ):
        self.db = db
        cfg = get_config()
        self.export_dir = Path(export_dir or getattr(cfg, "LAKEHOUSE_PARQUET_DIR", "data/lakehouse/student_academic_records")).resolve()
        self.batch_size = int(batch_size or getattr(cfg, "LAKEHOUSE_EXPORT_BATCH_SIZE", 500))

    def export_academic_records(
        self,
        collection_name: str = "analytical_academic_records",
        overwrite: bool = False,
        query: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute export from MongoDB to partitioned Parquet lakehouse.
        
        Args:
            collection_name: Name of MongoDB collection to extract from.
            overwrite: If False, raises FileExistsError when output directory already contains Parquet files.
                       If True, safely replaces existing Parquet files using staging directory.
            query: Optional MongoDB query filter.

        Returns:
            Dictionary containing export summary metrics and metadata.
        """
        if self.db is None:
            raise ValueError("MongoDB database instance cannot be None.")

        # 1. Guard against accidental duplicates / silent overwrites
        export_path = self.export_dir
        if export_path.exists():
            existing_parquet_files = list(export_path.glob("**/*.parquet"))
            if existing_parquet_files and not overwrite:
                raise FileExistsError(
                    f"Target export path '{export_path}' already contains {len(existing_parquet_files)} "
                    "Parquet file(s). Set overwrite=True to replace existing lakehouse export."
                )

        # 2. Extract records from MongoDB
        coll = self.db[collection_name]
        try:
            cursor = coll.find(query or {}, batch_size=self.batch_size)
        except PyMongoError as pe:
            logger.error("Failed to query MongoDB collection '%s': %s", collection_name, str(pe))
            raise LakehouseExportError(f"MongoDB read failure in collection '{collection_name}': {str(pe)}") from pe

        total_read = 0
        valid_records: List[Dict[str, Any]] = []
        rejected_records: List[Dict[str, Any]] = []

        try:
            for doc in cursor:
                total_read += 1
                is_valid, reason, normalized = validate_record_for_export(doc)
                if is_valid and normalized:
                    valid_records.append(normalized)
                else:
                    rejected_records.append({
                        "row_index": total_read,
                        "student_code": doc.get("student_code") if isinstance(doc, dict) else None,
                        "reason": reason,
                    })
                    logger.debug("Rejected record #%d: %s", total_read, reason)
        except PyMongoError as pe:
            logger.error("MongoDB iteration error while reading records: %s", str(pe))
            raise LakehouseExportError(f"MongoDB iteration failure: {str(pe)}") from pe

        timestamp_iso = datetime.now(timezone.utc).isoformat()

        # 3. Handle empty collection or no valid records
        if total_read == 0:
            logger.warning("No records found in collection '%s'. Export skipped.", collection_name)
            return {
                "source_collection": collection_name,
                "total_records_read": 0,
                "valid_records_exported": 0,
                "rejected_records": 0,
                "partition_count": 0,
                "partitions": [],
                "output_location": str(export_path),
                "export_timestamp": timestamp_iso,
                "compression": "SNAPPY",
                "file_format": "PARQUET",
                "status": "EMPTY_DATASET",
            }

        if len(valid_records) == 0:
            logger.warning("All %d records from collection '%s' failed validation.", total_read, collection_name)
            return {
                "source_collection": collection_name,
                "total_records_read": total_read,
                "valid_records_exported": 0,
                "rejected_records": len(rejected_records),
                "partition_count": 0,
                "partitions": [],
                "output_location": str(export_path),
                "export_timestamp": timestamp_iso,
                "compression": "SNAPPY",
                "file_format": "PARQUET",
                "status": "NO_VALID_RECORDS",
            }

        # 4. Deterministic record ordering before writing
        valid_records.sort(key=lambda r: (r["student_code"], r["subject"], r["academic_year"]))

        # 5. Build PyArrow Table strictly typed against ACADEMIC_LAKEHOUSE_SCHEMA
        table = pa.Table.from_pylist(valid_records, schema=ACADEMIC_LAKEHOUSE_SCHEMA)

        # 6. Safe atomic export using temporary staging directory
        staging_dir = export_path.parent / f".tmp_lakehouse_{uuid4().hex}"
        try:
            staging_dir.mkdir(parents=True, exist_ok=True)

            pq.write_to_dataset(
                table,
                root_path=str(staging_dir),
                partition_cols=PARTITION_COLS,
                compression="snappy",
            )

            # Analyze partition counts from generated subdirectories
            partition_meta = []
            for sub_path in staging_dir.glob("subject=*"):
                subject_name = sub_path.name.split("subject=", 1)[1]
                for yr_path in sub_path.glob("academic_year=*"):
                    year_name = yr_path.name.split("academic_year=", 1)[1]
                    part_files = list(yr_path.glob("*.parquet"))
                    # Count records in this partition
                    part_count = 0
                    for pf in part_files:
                        with pq.ParquetFile(pf) as pfile:
                            part_count += pfile.metadata.num_rows
                    partition_meta.append({
                        "subject": subject_name,
                        "academic_year": year_name,
                        "record_count": part_count,
                        "files": len(part_files),
                    })

            # Atomic swap / replace into final export_path
            if export_path.exists():
                shutil.rmtree(export_path)
            staging_dir.rename(export_path)

        except Exception as exc:
            if staging_dir.exists():
                shutil.rmtree(staging_dir, ignore_errors=True)
            logger.error("Failed to write partitioned Parquet dataset: %s", str(exc))
            raise LakehouseExportError(f"Parquet serialization failure: {str(exc)}") from exc

        # 7. Generate export summary and metadata manifest
        summary = {
            "source_collection": collection_name,
            "total_records_read": total_read,
            "valid_records_exported": len(valid_records),
            "rejected_records": len(rejected_records),
            "partition_count": len(partition_meta),
            "partitions": sorted(partition_meta, key=lambda p: (p["subject"], p["academic_year"])),
            "output_location": str(export_path),
            "export_timestamp": timestamp_iso,
            "compression": "SNAPPY",
            "file_format": "PARQUET",
            "status": "COMPLETED_SUCCESSFULLY",
        }

        # Write metadata manifest into lakehouse directory using Hive metadata prefix (_)
        manifest_path = export_path / "_export_summary.json"
        success_marker = export_path / "_SUCCESS"
        try:
            with open(manifest_path, "w", encoding="utf-8") as mf:
                json.dump(summary, mf, indent=2)
            with open(success_marker, "w", encoding="utf-8") as sf:
                sf.write(f"EXPORT COMPLETED AT {timestamp_iso}\n")
        except OSError as oe:
            logger.warning("Could not write _export_summary.json to '%s': %s", manifest_path, str(oe))

        logger.info(
            "Export completed: %d valid records exported across %d partitions to '%s'.",
            len(valid_records),
            len(partition_meta),
            export_path,
        )

        return summary


def export_mongodb_to_parquet(
    db: Database,
    export_dir: Optional[str] = None,
    collection_name: str = "analytical_academic_records",
    batch_size: int = 500,
    overwrite: bool = False,
) -> Dict[str, Any]:
    """Convenience functional interface for Parquet Lakehouse export."""
    exporter = ParquetLakehouseExporter(db=db, export_dir=export_dir, batch_size=batch_size)
    return exporter.export_academic_records(collection_name=collection_name, overwrite=overwrite)


def main():
    """Command-line execution entrypoint for Lakehouse export."""
    import argparse
    from backend.app import create_app
    from backend.extensions import mongo

    parser = argparse.ArgumentParser(description="EduPredict MongoDB-to-Parquet Lakehouse Export Bridge")
    parser.add_argument("--output-dir", default=None, help="Target lakehouse output directory")
    parser.add_argument("--collection", default="analytical_academic_records", help="Source MongoDB collection")
    parser.add_argument("--batch-size", type=int, default=500, help="MongoDB cursor batch size")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing Parquet files")

    args = parser.parse_args()

    app = create_app(os.getenv("FLASK_ENV", "development"))
    with app.app_context():
        print("=== EDUPREDICT LAKEHOUSE PARQUET EXPORT ===")
        print(f"Source Collection : {args.collection}")
        print(f"Batch Size        : {args.batch_size}")
        print(f"Overwrite Mode    : {args.overwrite}")
        try:
            summary = export_mongodb_to_parquet(
                db=mongo.db,
                export_dir=args.output_dir,
                collection_name=args.collection,
                batch_size=args.batch_size,
                overwrite=args.overwrite,
            )
            print("\nExport Summary:")
            print(json.dumps(summary, indent=2))
        except Exception as e:
            print(f"\nERROR: Export failed: {str(e)}")
            raise


if __name__ == "__main__":
    main()
