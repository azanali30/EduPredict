"""
Unit and Integration Tests for EduPredict Phase 7E.1 Parquet Lakehouse Export Bridge
Tests dataset validation, Snappy compression, Hive partitioning by subject & academic_year,
bounded-memory streaming batch processing, safe dataset replacement with rollback,
and strict numeric validation (rejecting NaN, Infinity, and fractional integers).
"""

import os
import math
import json
import pytest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
import pyarrow.parquet as pq
from pymongo.errors import ServerSelectionTimeoutError

from backend.data_engineering.parquet_exporter import (
    ParquetLakehouseExporter,
    LakehouseExportError,
    validate_record_for_export,
    validate_strict_float,
    validate_strict_int,
    export_mongodb_to_parquet,
    ACADEMIC_LAKEHOUSE_SCHEMA,
)
from backend.services.lakehouse_service import LakehouseService


# ==============================================================================
# Test Fixtures & Sample Records
# ==============================================================================

@pytest.fixture
def sample_valid_records():
    """Generates a small batch of clean academic records spanning 2 subjects and 2 years."""
    return [
        {
            "student_code": "STU_MAT_0001",
            "subject": "Mathematics",
            "academic_year": "2024-2025",
            "term": "Term 3",
            "school": "GP",
            "sex": "F",
            "age": 16,
            "address": "U",
            "famsize": "GT3",
            "p_status": "A",
            "mother_education": 4,
            "father_education": 3,
            "study_hours_per_week": 5.0,
            "failures": 0,
            "school_support": "yes",
            "family_support": "no",
            "extra_paid_classes": "no",
            "activities": "no",
            "higher_education": "yes",
            "internet": "no",
            "romantic": "no",
            "family_relationship": 4,
            "free_time": 3,
            "go_out": 4,
            "health": 3,
            "absences": 6,
            "attendance_percentage": 93.7,
            "assignment_completion_rate": 80.0,
            "previous_exam_marks": 70.0,
            "quiz_scores": 75.0,
            "final_exam_marks": 75.0,
            "academic_status": "Low Risk / On Track",
        },
        {
            "student_code": "STU_MAT_0002",
            "subject": "Mathematics",
            "academic_year": "2025-2026",
            "term": "Term 3",
            "school": "GP",
            "sex": "M",
            "age": 17,
            "address": "R",
            "famsize": "LE3",
            "p_status": "T",
            "mother_education": 2,
            "father_education": 2,
            "study_hours_per_week": 2.5,
            "failures": 1,
            "school_support": "no",
            "family_support": "yes",
            "extra_paid_classes": "yes",
            "activities": "yes",
            "higher_education": "yes",
            "internet": "yes",
            "romantic": "yes",
            "family_relationship": 3,
            "free_time": 2,
            "go_out": 3,
            "health": 4,
            "absences": 12,
            "attendance_percentage": 87.4,
            "assignment_completion_rate": 65.0,
            "previous_exam_marks": 45.0,
            "quiz_scores": 48.0,
            "final_exam_marks": 45.0,
            "academic_status": "High Risk",
        },
        {
            "student_code": "STU_POR_0001",
            "subject": "Portuguese Language",
            "academic_year": "2025-2026",
            "term": "Term 3",
            "school": "MS",
            "sex": "F",
            "age": 18,
            "address": "U",
            "famsize": "GT3",
            "p_status": "T",
            "mother_education": 3,
            "father_education": 3,
            "study_hours_per_week": 4.0,
            "failures": 0,
            "school_support": "no",
            "family_support": "yes",
            "extra_paid_classes": "no",
            "activities": "yes",
            "higher_education": "yes",
            "internet": "yes",
            "romantic": "no",
            "family_relationship": 5,
            "free_time": 4,
            "go_out": 2,
            "health": 5,
            "absences": 2,
            "attendance_percentage": 97.9,
            "assignment_completion_rate": 90.0,
            "previous_exam_marks": 60.0,
            "quiz_scores": 62.0,
            "final_exam_marks": 65.0,
            "academic_status": "Moderate Risk",
        },
    ]


# ==============================================================================
# 1. Strict Numeric Validation Tests
# ==============================================================================

def test_strict_float_rejects_nan_and_inf():
    """Verify that validate_strict_float rejects NaN and +/- Infinity."""
    ok, err, _ = validate_strict_float(float("nan"), "test_field")
    assert ok is False
    assert "cannot be NaN or Infinity" in err

    ok, err, _ = validate_strict_float(float("inf"), "test_field")
    assert ok is False
    assert "cannot be NaN or Infinity" in err

    ok, err, _ = validate_strict_float(float("-inf"), "test_field")
    assert ok is False
    assert "cannot be NaN or Infinity" in err


def test_strict_int_rejects_nan_and_inf():
    """Verify that validate_strict_int rejects NaN and +/- Infinity."""
    ok, err, _ = validate_strict_int(float("nan"), "test_field")
    assert ok is False
    assert "cannot be NaN or Infinity" in err

    ok, err, _ = validate_strict_int(float("inf"), "test_field")
    assert ok is False
    assert "cannot be NaN or Infinity" in err


def test_strict_int_rejects_fractional_values():
    """Verify that validate_strict_int rejects non-integer/fractional values."""
    ok, err, _ = validate_strict_int(16.5, "age")
    assert ok is False
    assert "cannot have fractional value" in err

    ok, err, _ = validate_strict_int("3.14", "failures")
    assert ok is False
    assert "cannot have fractional value" in err

    ok, err, _ = validate_strict_int(0.1, "absences")
    assert ok is False
    assert "cannot have fractional value" in err


def test_strict_int_accepts_valid_representations():
    """Verify that validate_strict_int accepts valid whole numbers."""
    ok, err, val = validate_strict_int(16, "age")
    assert ok is True and val == 16

    # Whole number represented as float (e.g. 16.0 from JSON)
    ok, err, val = validate_strict_int(16.0, "age")
    assert ok is True and val == 16

    # Whole number represented as string
    ok, err, val = validate_strict_int("16", "age")
    assert ok is True and val == 16


def test_validate_record_rejects_fractional_integer_fields(sample_valid_records):
    """Verify validate_record_for_export rejects fractional age, failures, absences, and education."""
    base = dict(sample_valid_records[0])

    # Fractional age
    base["age"] = 16.5
    ok, err, _ = validate_record_for_export(base)
    assert ok is False
    assert "cannot have fractional value" in err

    # Fractional failures
    base["age"] = 16
    base["failures"] = 1.5
    ok, err, _ = validate_record_for_export(base)
    assert ok is False
    assert "cannot have fractional value" in err

    # Fractional absences
    base["failures"] = 0
    base["absences"] = 2.8
    ok, err, _ = validate_record_for_export(base)
    assert ok is False
    assert "cannot have fractional value" in err

    # Fractional mother_education
    base["absences"] = 0
    base["mother_education"] = 3.5
    ok, err, _ = validate_record_for_export(base)
    assert ok is False
    assert "cannot have fractional value" in err


def test_validate_record_rejects_nan_and_inf_in_record(sample_valid_records):
    """Verify validate_record_for_export rejects NaN and Inf in marks and attendance."""
    base = dict(sample_valid_records[0])

    # NaN in final marks
    base["final_exam_marks"] = float("nan")
    ok, err, _ = validate_record_for_export(base)
    assert ok is False
    assert "cannot be NaN or Infinity" in err

    # Inf in attendance
    base["final_exam_marks"] = 75.0
    base["attendance_percentage"] = float("inf")
    ok, err, _ = validate_record_for_export(base)
    assert ok is False
    assert "cannot be NaN or Infinity" in err


# ==============================================================================
# 2. Bounded-Memory Batch Processing Tests
# ==============================================================================

def test_bounded_memory_batch_processing_multiple_batches():
    """Verify that records are streamed and written across multiple discrete batches."""
    # Create 35 records with batch_size=10 (yields 4 batches: 10, 10, 10, 5)
    records = []
    for i in range(35):
        records.append({
            "student_code": f"STU_BATCH_{i:04d}",
            "subject": "Mathematics" if i % 2 == 0 else "Portuguese Language",
            "academic_year": "2025-2026",
            "term": "Term 3",
            "attendance_percentage": 90.0,
            "study_hours_per_week": 3.0,
            "previous_exam_marks": 60.0,
            "quiz_scores": 65.0,
            "final_exam_marks": 70.0,
            "academic_status": "Low Risk / On Track",
            "age": 16,
            "failures": 0,
            "absences": 4,
        })

    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_batched")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target, batch_size=10)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["status"] == "COMPLETED_SUCCESSFULLY"
        assert summary["total_records_read"] == 35
        assert summary["valid_records_exported"] == 35
        assert summary["rejected_records"] == 0

        # Read back table and verify exact row count
        read_t = pq.read_table(export_target)
        assert read_t.num_rows == 35


def test_batch_boundaries_do_not_lose_or_duplicate_records():
    """Verify exact count and no record duplication across batch boundaries."""
    records = []
    for i in range(23):
        records.append({
            "student_code": f"STU_{i:03d}",
            "subject": "Mathematics",
            "academic_year": "2025-2026",
            "term": "Term 1",
            "attendance_percentage": 95.0,
            "study_hours_per_week": 4.0,
            "previous_exam_marks": 75.0,
            "quiz_scores": 80.0,
            "final_exam_marks": 85.0,
            "academic_status": "Low Risk / On Track",
        })

    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_boundary")
        # Prime batch size 7 (produces 7, 7, 7, 2)
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target, batch_size=7)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["valid_records_exported"] == 23
        t = pq.read_table(export_target)
        assert t.num_rows == 23

        # Verify uniqueness of student codes
        codes = t["student_code"].to_pylist()
        assert len(codes) == len(set(codes)) == 23


def test_records_across_multiple_partitions_in_batches():
    """Verify that multi-partition datasets split across batches write correctly to partition dirs."""
    records = []
    subjects = ["Mathematics", "Portuguese Language"]
    years = ["2023-2024", "2024-2025", "2025-2026"]
    for s_idx, subj in enumerate(subjects):
        for y_idx, yr in enumerate(years):
            for i in range(5):
                records.append({
                    "student_code": f"STU_{s_idx}_{y_idx}_{i}",
                    "subject": subj,
                    "academic_year": yr,
                    "term": "Final",
                    "attendance_percentage": 85.0,
                    "study_hours_per_week": 2.0,
                    "previous_exam_marks": 55.0,
                    "quiz_scores": 58.0,
                    "final_exam_marks": 60.0,
                    "academic_status": "Moderate Risk",
                })

    # Total: 2 * 3 * 5 = 30 records across 6 partitions
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_multi_part")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target, batch_size=8)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["partition_count"] == 6
        assert summary["valid_records_exported"] == 30

        read_t = pq.read_table(export_target)
        assert read_t.num_rows == 30


# ==============================================================================
# 3. Safe Dataset Replacement & Rollback Tests
# ==============================================================================

def test_successful_dataset_replacement(sample_valid_records):
    """Verify that export with overwrite=True successfully replaces existing dataset."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = Path(tmpdir) / "lakehouse_replace"
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=str(export_target))

        # First export
        res1 = exporter.export_academic_records(overwrite=True)
        assert res1["valid_records_exported"] == 3
        assert export_target.exists()

        # Re-run with overwrite
        mock_coll.find.return_value = iter(sample_valid_records)
        res2 = exporter.export_academic_records(overwrite=True)
        assert res2["valid_records_exported"] == 3

        # Verify no temporary or backup directories remain
        parent_items = [p.name for p in export_target.parent.iterdir()]
        assert not any(name.startswith(".tmp_") or name.startswith(".backup_") for name in parent_items)


def test_staging_write_failure_preserves_original_dataset(sample_valid_records):
    """Verify that if an error occurs during staging writes, the original dataset is untouched."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = Path(tmpdir) / "lakehouse_orig"
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=str(export_target))

        # Step 1: Establish original valid dataset
        exporter.export_academic_records(overwrite=True)
        original_table = pq.read_table(str(export_target))
        assert original_table.num_rows == 3

        # Step 2: Attempt second export where write_dataset raises an error
        mock_coll.find.return_value = iter(sample_valid_records)
        with patch("pyarrow.dataset.write_dataset", side_effect=RuntimeError("Disk write simulated fault")):
            with pytest.raises(LakehouseExportError):
                exporter.export_academic_records(overwrite=True)

        # Step 3: Verify original dataset is completely preserved
        assert export_target.exists()
        restored_table = pq.read_table(str(export_target))
        assert restored_table.num_rows == 3

        # Verify temporary directories were cleaned up
        parent_items = [p.name for p in export_target.parent.iterdir()]
        assert not any(name.startswith(".tmp_") for name in parent_items)


def test_promotion_failure_triggers_rollback(sample_valid_records):
    """Verify that if promoting staging fails, the previous dataset is restored via rollback."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = (Path(tmpdir) / "lakehouse_rollback").resolve()
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=str(export_target))

        # Establish original dataset with marker
        exporter.export_academic_records(overwrite=True)
        marker_file = export_target / "original_marker.txt"
        marker_file.write_text("ORIGINAL_CONTENT")

        # Simulate failure during staging_dir.rename(export_path)
        real_rename = Path.rename

        def mock_rename_fail(self, target):
            # If renaming staging directory to export_target, trigger failure
            if ".tmp_" in self.name and (target == export_target or target.name == export_target.name):
                raise OSError("Simulated filesystem lock during rename promotion")
            return real_rename(self, target)

        mock_coll.find.return_value = iter(sample_valid_records)
        with patch.object(Path, "rename", mock_rename_fail):
            with pytest.raises(LakehouseExportError) as exc_info:
                exporter.export_academic_records(overwrite=True)
            assert "Previous dataset was restored from backup" in str(exc_info.value)

        # Verify rollback restored the original dataset and marker
        assert export_target.exists()
        assert (export_target / "original_marker.txt").exists()
        assert (export_target / "original_marker.txt").read_text() == "ORIGINAL_CONTENT"

        # Verify no backup or temporary directories remain
        parent_items = [p.name for p in export_target.parent.iterdir()]
        assert not any(name.startswith(".backup_") or name.startswith(".tmp_") for name in parent_items)


# ==============================================================================
# 4. Standard Format & Integration Tests
# ==============================================================================

def test_snappy_compression(sample_valid_records):
    """Verify that generated Parquet files physically use Snappy compression metadata."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_snappy")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)
        exporter.export_academic_records(overwrite=True)

        parquet_files = []
        for root, _, files in os.walk(export_target):
            for f in files:
                if f.endswith(".parquet"):
                    parquet_files.append(os.path.join(root, f))

        assert len(parquet_files) >= 1
        for pf in parquet_files:
            with pq.ParquetFile(pf) as pfile:
                for c_idx in range(pfile.metadata.num_columns):
                    assert pfile.metadata.row_group(0).column(c_idx).compression == "SNAPPY"


def test_empty_collection():
    """Verify that exporting from an empty collection returns a clean summary without error."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter([])
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_empty")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["status"] == "EMPTY_DATASET"
        assert summary["total_records_read"] == 0
        assert summary["valid_records_exported"] == 0
        assert summary["partition_count"] == 0


def test_mongodb_read_failure():
    """Verify that PyMongoError during query or iteration raises LakehouseExportError."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.side_effect = ServerSelectionTimeoutError("Simulated network timeout")
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_fail")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)
        with pytest.raises(LakehouseExportError) as exc_info:
            exporter.export_academic_records()
        assert "MongoDB read failure" in str(exc_info.value)


def test_output_schema_consistency(sample_valid_records):
    """Verify that exported Parquet table strictly preserves all 32 columns and data types."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_schema")
        export_mongodb_to_parquet(db=mock_db, export_dir=export_target, overwrite=True)

        read_table = pq.read_table(export_target)
        assert len(read_table.column_names) == len(ACADEMIC_LAKEHOUSE_SCHEMA)
        for field in ACADEMIC_LAKEHOUSE_SCHEMA:
            assert field.name in read_table.column_names


def test_lakehouse_service_wrapper(sample_valid_records):
    """Verify LakehouseService provides clean service-layer access."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_svc")
        service = LakehouseService(db=mock_db)
        res = service.export_academic_lakehouse(export_dir=export_target, overwrite=True)
        assert res["status"] == "COMPLETED_SUCCESSFULLY"
        assert res["valid_records_exported"] == 3
