"""
EduPredict - MongoDB to Partitioned Parquet Lakehouse Export Bridge
Reads academic records from MongoDB 6.x, validates data types and domain constraints,
and exports partitioned Snappy-compressed Parquet files for the EduPredict Analytical Lakehouse.

Features:
- Bounded-memory streaming batch processing (no full-collection loading into RAM).
- Safe dataset replacement transaction with rollback on failure (preserves previous valid data).
- Strict numeric validation (rejects NaN, +/- Infinity, and fractional integer values).
- Preserves 32-column schema, Snappy compression, and Hive subject/academic_year partitioning.
"""

import os
import math
import shutil
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Iterator
from uuid import uuid4

import pyarrow as pa
import pyarrow.dataset as ds
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
MAX_REJECTED_SAMPLES = 20


class LakehouseExportError(Exception):
    """Raised when an unrecoverable error occurs during the Lakehouse Parquet export process."""
    pass


# ==============================================================================
# Strict Numeric Validation Helpers
# ==============================================================================

def validate_strict_float(
    val: Any,
    field_name: str,
    min_val: Optional[float] = None,
    max_val: Optional[float] = None,
) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Validate a floating-point numeric field strictly.
    Rejects None, booleans, non-numeric types, NaN, and positive/negative infinity.
    Enforces minimum and maximum boundary constraints.
    """
    if val is None or isinstance(val, bool):
        return False, f"Field '{field_name}' must be numeric, got {type(val).__name__}.", None

    try:
        f = float(val)
    except (ValueError, TypeError):
        return False, f"Field '{field_name}' is not a valid number: '{val}'.", None

    if math.isnan(f) or math.isinf(f):
        return False, f"Field '{field_name}' cannot be NaN or Infinity.", None

    if min_val is not None and f < min_val:
        return False, f"Field '{field_name}' ({f}) out of bounds, minimum is {min_val}.", None
    if max_val is not None and f > max_val:
        return False, f"Field '{field_name}' ({f}) out of bounds, maximum is {max_val}.", None

    return True, None, f


def validate_strict_int(
    val: Any,
    field_name: str,
    min_val: Optional[int] = None,
    max_val: Optional[int] = None,
) -> Tuple[bool, Optional[str], Optional[int]]:
    """
    Validate an integer schema field strictly.
    Rejects None, booleans, non-numeric types, NaN, +/- Infinity, and fractional floats (e.g. 16.5).
    Accepts whole numbers represented as int, float (e.g. 16.0), or string ("16").
    Enforces minimum and maximum boundary constraints.
    """
    if val is None or isinstance(val, bool):
        return False, f"Field '{field_name}' must be an integer, got {type(val).__name__}.", None

    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return False, f"Field '{field_name}' cannot be NaN or Infinity.", None
        if isinstance(val, float):
            if not val.is_integer():
                return False, f"Field '{field_name}' cannot have fractional value: {val}.", None
            int_val = int(val)
        else:
            int_val = val
    elif isinstance(val, str):
        val_str = val.strip()
        try:
            f = float(val_str)
            if math.isnan(f) or math.isinf(f):
                return False, f"Field '{field_name}' cannot be NaN or Infinity.", None
            if not f.is_integer():
                return False, f"Field '{field_name}' cannot have fractional value: '{val}'.", None
            int_val = int(f)
        except ValueError:
            return False, f"Field '{field_name}' is not a valid integer string: '{val}'.", None
    else:
        return False, f"Field '{field_name}' has unsupported type {type(val).__name__}.", None

    if min_val is not None and int_val < min_val:
        return False, f"Field '{field_name}' ({int_val}) cannot be less than {min_val}.", None
    if max_val is not None and int_val > max_val:
        return False, f"Field '{field_name}' ({int_val}) cannot be greater than {max_val}.", None

    return True, None, int_val


def validate_record_for_export(doc: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validate a single MongoDB document for lakehouse export.
    Verifies presence of required fields, strict data types, and value boundaries.
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

    # 3. Strict numeric float validations (reject NaN, Inf, out-of-bounds)
    ok, err, attendance_percentage = validate_strict_float(
        doc["attendance_percentage"], "attendance_percentage", min_val=0.0, max_val=100.0
    )
    if not ok:
        return False, err, None

    ok, err, previous_exam_marks = validate_strict_float(
        doc["previous_exam_marks"], "previous_exam_marks", min_val=0.0, max_val=100.0
    )
    if not ok:
        return False, err, None

    ok, err, quiz_scores = validate_strict_float(
        doc["quiz_scores"], "quiz_scores", min_val=0.0, max_val=100.0
    )
    if not ok:
        return False, err, None

    ok, err, final_exam_marks = validate_strict_float(
        doc["final_exam_marks"], "final_exam_marks", min_val=0.0, max_val=100.0
    )
    if not ok:
        return False, err, None

    ok, err, study_hours_per_week = validate_strict_float(
        doc["study_hours_per_week"], "study_hours_per_week", min_val=0.0
    )
    if not ok:
        return False, err, None

    ok, err, assignment_completion_rate = validate_strict_float(
        doc.get("assignment_completion_rate", 75.0),
        "assignment_completion_rate",
        min_val=0.0,
        max_val=100.0,
    )
    if not ok:
        return False, err, None

    # 4. Strict integer validations (reject NaN, Inf, and fractional values)
    ok, err, age = validate_strict_int(doc.get("age", 0), "age", min_val=0)
    if not ok:
        return False, err, None

    ok, err, failures = validate_strict_int(doc.get("failures", 0), "failures", min_val=0)
    if not ok:
        return False, err, None

    ok, err, absences = validate_strict_int(doc.get("absences", 0), "absences", min_val=0)
    if not ok:
        return False, err, None

    ok, err, mother_education = validate_strict_int(
        doc.get("mother_education", doc.get("Medu", 0)), "mother_education"
    )
    if not ok:
        return False, err, None

    ok, err, father_education = validate_strict_int(
        doc.get("father_education", doc.get("Fedu", 0)), "father_education"
    )
    if not ok:
        return False, err, None

    ok, err, family_relationship = validate_strict_int(
        doc.get("family_relationship", doc.get("famrel", 3)), "family_relationship"
    )
    if not ok:
        return False, err, None

    ok, err, free_time = validate_strict_int(
        doc.get("free_time", doc.get("freetime", 3)), "free_time"
    )
    if not ok:
        return False, err, None

    ok, err, go_out = validate_strict_int(
        doc.get("go_out", doc.get("goout", 3)), "go_out"
    )
    if not ok:
        return False, err, None

    ok, err, health = validate_strict_int(
        doc.get("health", 3), "health"
    )
    if not ok:
        return False, err, None

    # 5. Construct normalized record strictly adhering to ACADEMIC_LAKEHOUSE_SCHEMA
    normalized = {
        "student_code": student_code,
        "term": term,
        "school": str(doc.get("school", "")).strip(),
        "sex": str(doc.get("sex", "")).strip(),
        "age": age,
        "address": str(doc.get("address", "")).strip(),
        "famsize": str(doc.get("famsize", "")).strip(),
        "p_status": str(doc.get("p_status", doc.get("Pstatus", ""))).strip(),
        "mother_education": mother_education,
        "father_education": father_education,
        "study_hours_per_week": study_hours_per_week,
        "failures": failures,
        "school_support": str(doc.get("school_support", doc.get("schoolsup", "no"))).strip(),
        "family_support": str(doc.get("family_support", doc.get("famsup", "no"))).strip(),
        "extra_paid_classes": str(doc.get("extra_paid_classes", doc.get("paid", "no"))).strip(),
        "activities": str(doc.get("activities", "no")).strip(),
        "higher_education": str(doc.get("higher_education", doc.get("higher", "yes"))).strip(),
        "internet": str(doc.get("internet", "yes")).strip(),
        "romantic": str(doc.get("romantic", "no")).strip(),
        "family_relationship": family_relationship,
        "free_time": free_time,
        "go_out": go_out,
        "health": health,
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


# ==============================================================================
# Bounded-Memory Batch Stream Generator
# ==============================================================================

def _generate_record_batches(
    cursor,
    batch_size: int,
    metrics: Dict[str, Any],
) -> Iterator[pa.RecordBatch]:
    """
    Consumes cursor records incrementally, validates each record, and yields PyArrow RecordBatches
    of size <= batch_size. Memory consumption is strictly bounded by batch_size.
    """
    current_batch: List[Dict[str, Any]] = []

    try:
        for doc in cursor:
            metrics["total_read"] += 1
            is_valid, reason, normalized = validate_record_for_export(doc)
            if is_valid and normalized:
                metrics["valid_count"] += 1
                key = (normalized["subject"], normalized["academic_year"])
                metrics["partition_counts"][key] = metrics["partition_counts"].get(key, 0) + 1
                current_batch.append(normalized)

                if len(current_batch) >= batch_size:
                    # Deterministic ordering within batch
                    current_batch.sort(key=lambda r: (r["subject"], r["academic_year"], r["student_code"]))
                    yield pa.RecordBatch.from_pylist(current_batch, schema=ACADEMIC_LAKEHOUSE_SCHEMA)
                    current_batch = []
            else:
                metrics["rejected_count"] += 1
                if len(metrics["rejected_samples"]) < MAX_REJECTED_SAMPLES:
                    metrics["rejected_samples"].append({
                        "row_index": metrics["total_read"],
                        "student_code": str(doc.get("student_code", "")).strip()[:50] if isinstance(doc, dict) else None,
                        "reason": reason,
                    })
                logger.debug("Rejected record #%d: %s", metrics["total_read"], reason)
    except PyMongoError as pe:
        logger.error("MongoDB iteration error while reading records: %s", str(pe))
        raise LakehouseExportError(f"MongoDB iteration failure: {str(pe)}") from pe

    # Flush final partial batch
    if current_batch:
        current_batch.sort(key=lambda r: (r["subject"], r["academic_year"], r["student_code"]))
        yield pa.RecordBatch.from_pylist(current_batch, schema=ACADEMIC_LAKEHOUSE_SCHEMA)
        current_batch = []


class ParquetLakehouseExporter:
    """
    Exports academic records from MongoDB to partitioned Apache Parquet lakehouse files.
    Enforces Snappy compression, bounded-memory batching, and safe dataset replacement with rollback.
    """

    def __init__(
        self,
        db: Optional[Database] = None,
        export_dir: Optional[str] = None,
        batch_size: Optional[int] = None,
    ):
        self.db = db
        cfg = get_config()
        self.export_dir = Path(
            export_dir or getattr(cfg, "LAKEHOUSE_PARQUET_DIR", "data/lakehouse/student_academic_records")
        ).resolve()
        self.batch_size = int(batch_size or getattr(cfg, "LAKEHOUSE_EXPORT_BATCH_SIZE", 500))
        if self.batch_size <= 0:
            raise ValueError(f"Batch size must be a positive integer, got {self.batch_size}.")

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
                       If True, uses a safe same-filesystem backup/rollback replacement workflow.
            query: Optional MongoDB query filter.

        Returns:
            Dictionary containing export summary metrics and metadata.
        """
        if self.db is None:
            raise ValueError("MongoDB database instance cannot be None.")

        export_path = self.export_dir

        # 1. Guard against accidental duplicates / silent overwrites
        if export_path.exists():
            existing_parquet_files = list(export_path.glob("**/*.parquet"))
            if existing_parquet_files and not overwrite:
                raise FileExistsError(
                    f"Target export path '{export_path}' already contains {len(existing_parquet_files)} "
                    "Parquet file(s). Set overwrite=True to replace existing lakehouse export."
                )

        # 2. Query MongoDB collection with deterministic index sort if available
        coll = self.db[collection_name]
        try:
            cursor = coll.find(query or {}, batch_size=self.batch_size)
            if hasattr(cursor, "sort"):
                cursor = cursor.sort([("subject", 1), ("academic_year", 1), ("student_code", 1)])
        except PyMongoError as pe:
            logger.error("Failed to query MongoDB collection '%s': %s", collection_name, str(pe))
            raise LakehouseExportError(f"MongoDB read failure in collection '{collection_name}': {str(pe)}") from pe

        # 3. Stream cursor in bounded-memory batches into isolated staging directory
        metrics: Dict[str, Any] = {
            "total_read": 0,
            "valid_count": 0,
            "rejected_count": 0,
            "rejected_samples": [],
            "partition_counts": {},
        }

        staging_dir = export_path.parent / f".tmp_{export_path.name}_{uuid4().hex}"
        backup_dir = export_path.parent / f".backup_{export_path.name}_{uuid4().hex}"
        timestamp_iso = datetime.now(timezone.utc).isoformat()

        try:
            staging_dir.mkdir(parents=True, exist_ok=True)

            partitioning = ds.partitioning(
                pa.schema([("subject", pa.string()), ("academic_year", pa.string())]),
                flavor="hive",
            )
            file_options = ds.ParquetFileFormat().make_write_options(compression="snappy")

            reader = pa.RecordBatchReader.from_batches(
                ACADEMIC_LAKEHOUSE_SCHEMA,
                _generate_record_batches(cursor, self.batch_size, metrics),
            )

            ds.write_dataset(
                reader,
                base_dir=str(staging_dir),
                format="parquet",
                partitioning=partitioning,
                file_options=file_options,
                existing_data_behavior="overwrite_or_ignore",
            )

            # 4. Handle empty collection or no valid records
            if metrics["total_read"] == 0:
                logger.warning("No records found in collection '%s'. Export skipped.", collection_name)
                shutil.rmtree(staging_dir, ignore_errors=True)
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

            if metrics["valid_count"] == 0:
                logger.warning("All %d records from collection '%s' failed validation.", metrics["total_read"], collection_name)
                shutil.rmtree(staging_dir, ignore_errors=True)
                no_valid_summary: Dict[str, Any] = {
                    "source_collection": collection_name,
                    "total_records_read": metrics["total_read"],
                    "valid_records_exported": 0,
                    "rejected_records": metrics["rejected_count"],
                    "partition_count": 0,
                    "partitions": [],
                    "output_location": str(export_path),
                    "export_timestamp": timestamp_iso,
                    "compression": "SNAPPY",
                    "file_format": "PARQUET",
                    "status": "NO_VALID_RECORDS",
                }
                if metrics["rejected_samples"]:
                    no_valid_summary["rejected_samples"] = metrics["rejected_samples"]
                return no_valid_summary

            # 5. Assemble partition metadata from partition counts
            partition_meta = []
            for (sub, yr), count in sorted(metrics["partition_counts"].items()):
                files_found = [
                    f for f in staging_dir.glob("**/*.parquet")
                    if sub in str(f.parent.parent) and yr in str(f.parent)
                ]
                partition_meta.append({
                    "subject": sub,
                    "academic_year": yr,
                    "record_count": count,
                    "files": len(files_found) if files_found else 1,
                })

            summary: Dict[str, Any] = {
                "source_collection": collection_name,
                "total_records_read": metrics["total_read"],
                "valid_records_exported": metrics["valid_count"],
                "rejected_records": metrics["rejected_count"],
                "partition_count": len(partition_meta),
                "partitions": partition_meta,
                "output_location": str(export_path),
                "export_timestamp": timestamp_iso,
                "compression": "SNAPPY",
                "file_format": "PARQUET",
                "status": "COMPLETED_SUCCESSFULLY",
            }
            if metrics["rejected_samples"]:
                summary["rejected_samples"] = metrics["rejected_samples"]

            # 6. Write metadata manifest into staging directory
            manifest_path = staging_dir / "_export_summary.json"
            success_marker = staging_dir / "_SUCCESS"
            try:
                with open(manifest_path, "w", encoding="utf-8") as mf:
                    json.dump(summary, mf, indent=2)
                with open(success_marker, "w", encoding="utf-8") as sf:
                    sf.write(f"EXPORT COMPLETED AT {timestamp_iso}\n")
            except OSError as oe:
                logger.warning("Could not write _export_summary.json: %s", str(oe))

            # 7. Safe Dataset Replacement Transaction with Rollback
            # Preserves previous valid dataset until the new export is fully validated.
            backup_performed = False
            if export_path.exists():
                try:
                    export_path.rename(backup_dir)
                    backup_performed = True
                except OSError as be:
                    logger.error("Failed to backup existing dataset at '%s': %s", export_path, str(be))
                    raise LakehouseExportError(f"Backup failure for existing dataset: {str(be)}") from be

            try:
                staging_dir.rename(export_path)
            except Exception as promote_err:
                logger.error(
                    "Failed to promote staging dataset to '%s': %s. Rolling back from backup...",
                    export_path,
                    str(promote_err),
                )
                # Attempt rollback to restore previous dataset if backup was created
                if backup_performed and backup_dir.exists():
                    try:
                        if export_path.exists():
                            shutil.rmtree(export_path, ignore_errors=True)
                        backup_dir.rename(export_path)
                        logger.info("Rollback complete: previous dataset at '%s' successfully restored.", export_path)
                        raise LakehouseExportError(
                            f"Dataset replacement failed: {str(promote_err)}. "
                            "Previous dataset was successfully restored from backup."
                        ) from promote_err
                    except Exception as rollback_err:
                        # If rollback_err is already our LakehouseExportError from above, let it propagate
                        if isinstance(rollback_err, LakehouseExportError):
                            raise
                        logger.critical(
                            "CRITICAL: Rollback restoration failed! Could not restore previous dataset from '%s' to '%s': %s. "
                            "The previous valid dataset has been preserved at '%s' for manual operator recovery.",
                            backup_dir,
                            export_path,
                            str(rollback_err),
                            backup_dir,
                        )
                        raise LakehouseExportError(
                            f"Dataset replacement failed ({str(promote_err)}) AND rollback restoration failed ({str(rollback_err)}). "
                            f"CRITICAL: The previous valid dataset is preserved at '{backup_dir}'. "
                            "Manual recovery required: move this backup folder to restore the dataset."
                        ) from rollback_err
                else:
                    raise LakehouseExportError(
                        f"Dataset replacement failed: {str(promote_err)}."
                    ) from promote_err

            # Promotion succeeded: safely remove backup
            if backup_performed and backup_dir.exists():
                shutil.rmtree(backup_dir, ignore_errors=True)

            logger.info(
                "Export successfully replaced at '%s': %d valid records across %d partitions.",
                export_path,
                metrics["valid_count"],
                len(partition_meta),
            )

            return summary

        except Exception as exc:
            if not isinstance(exc, (LakehouseExportError, FileExistsError)):
                logger.error("Unexpected export failure: %s", str(exc))
                raise LakehouseExportError(f"Parquet export failed: {str(exc)}") from exc
            raise

        finally:
            # Guarantee cleanup of temporary staging data ONLY.
            # NEVER delete backup_dir here if rollback failed or was not restored,
            # ensuring previous valid data is preserved for manual recovery.
            if staging_dir.exists():
                shutil.rmtree(staging_dir, ignore_errors=True)


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
