"""
Unit and Integration Tests for EduPredict Phase 7E.1 Parquet Lakehouse Export Bridge
Tests dataset validation, Snappy compression, Hive partitioning by subject & academic_year,
empty collection handling, malformed record rejection, MongoDB read failure, repeat export behavior,
and output schema consistency.
"""

import os
import json
import pytest
import tempfile
import pyarrow.parquet as pq
from unittest.mock import MagicMock
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

from backend.data_engineering.parquet_exporter import (
    ParquetLakehouseExporter,
    LakehouseExportError,
    validate_record_for_export,
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
# 1. Validation & Schema Tests
# ==============================================================================

def test_validate_record_for_export_valid(sample_valid_records):
    """Verify that complete valid records pass validation with normalized fields."""
    rec = sample_valid_records[0]
    is_valid, reason, normalized = validate_record_for_export(rec)
    assert is_valid is True
    assert reason is None
    assert normalized["student_code"] == "STU_MAT_0001"
    assert normalized["subject"] == "Mathematics"
    assert normalized["academic_year"] == "2024-2025"
    assert normalized["attendance_percentage"] == 93.7
    assert normalized["academic_status"] == "Low Risk / On Track"
    assert "_id" not in normalized


def test_validate_record_rejects_missing_required_fields():
    """Verify that records missing mandatory keys are rejected with clear reasons."""
    # Missing student_code
    bad_rec1 = {"subject": "Mathematics", "academic_year": "2025-2026"}
    is_valid, reason, _ = validate_record_for_export(bad_rec1)
    assert is_valid is False
    assert "Missing required field" in reason

    # None value in attendance
    bad_rec2 = {
        "student_code": "STU_001",
        "subject": "Mathematics",
        "academic_year": "2025-2026",
        "term": "Term 1",
        "attendance_percentage": None,
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 50.0,
        "quiz_scores": 50.0,
        "final_exam_marks": 50.0,
        "academic_status": "Moderate Risk",
    }
    is_valid, reason, _ = validate_record_for_export(bad_rec2)
    assert is_valid is False
    assert "cannot be None" in reason


def test_validate_record_rejects_out_of_bounds_values():
    """Verify numeric range boundary enforcement."""
    base = {
        "student_code": "STU_001",
        "subject": "Mathematics",
        "academic_year": "2025-2026",
        "term": "Term 1",
        "attendance_percentage": 105.0,  # Invalid: > 100
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 50.0,
        "quiz_scores": 50.0,
        "final_exam_marks": 50.0,
        "academic_status": "Moderate Risk",
    }
    is_valid, reason, _ = validate_record_for_export(base)
    assert is_valid is False
    assert "out of bounds" in reason

    # Invalid risk category
    base["attendance_percentage"] = 90.0
    base["academic_status"] = "Unknown Risk"
    is_valid, reason, _ = validate_record_for_export(base)
    assert is_valid is False
    assert "Invalid academic_status" in reason


# ==============================================================================
# 2. End-to-End Export & Partitioning Tests
# ==============================================================================

def test_successful_parquet_export(sample_valid_records):
    """Test full export workflow to temporary directory using mocked MongoDB."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_test")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["status"] == "COMPLETED_SUCCESSFULLY"
        assert summary["total_records_read"] == 3
        assert summary["valid_records_exported"] == 3
        assert summary["rejected_records"] == 0
        assert summary["compression"] == "SNAPPY"
        assert summary["file_format"] == "PARQUET"
        assert os.path.isdir(export_target)

        # Verify summary manifest file was created
        manifest_file = os.path.join(export_target, "_export_summary.json")
        assert os.path.isfile(manifest_file)
        assert os.path.isfile(os.path.join(export_target, "_SUCCESS"))
        with open(manifest_file, "r", encoding="utf-8") as mf:
            loaded_summary = json.load(mf)
            assert loaded_summary["valid_records_exported"] == 3


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


def test_subject_and_academic_year_partitioning(sample_valid_records):
    """Verify Hive-style directory partitioning: subject=.../academic_year=..."""
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_partition")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["partition_count"] == 3
        # Check subdirectories
        sub_dirs = os.listdir(export_target)
        # Note: spaces in partition keys may be URL-encoded or literal
        has_math = any("Mathematics" in d for d in sub_dirs)
        has_por = any("Portuguese" in d for d in sub_dirs)
        assert has_math and has_por

        # Roundtrip read with PyArrow dataset reader
        dataset_table = pq.read_table(export_target)
        assert dataset_table.num_rows == 3
        col_names = dataset_table.column_names
        assert "subject" in col_names
        assert "academic_year" in col_names
        assert "final_exam_marks" in col_names


# ==============================================================================
# 3. Edge Cases & Resilience Tests
# ==============================================================================

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


def test_invalid_records_handling(sample_valid_records):
    """Verify that invalid records are filtered out, rejected count is accurate, and valid rows are written."""
    mixed_records = list(sample_valid_records)
    mixed_records.append({
        "student_code": "STU_CORRUPT",
        "subject": "Mathematics",
        "academic_year": "2025-2026",
        "term": "Term 1",
        "attendance_percentage": -20.0,  # Invalid
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 50.0,
        "quiz_scores": 50.0,
        "final_exam_marks": 50.0,
        "academic_status": "Low Risk / On Track",
    })
    mixed_records.append({
        "student_code": "STU_MISSING",
        # Missing subject
        "academic_year": "2025-2026",
        "term": "Term 1",
        "attendance_percentage": 80.0,
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 50.0,
        "quiz_scores": 50.0,
        "final_exam_marks": 50.0,
        "academic_status": "Low Risk / On Track",
    })

    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(mixed_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_mixed")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)
        summary = exporter.export_academic_records(overwrite=True)

        assert summary["status"] == "COMPLETED_SUCCESSFULLY"
        assert summary["total_records_read"] == 5
        assert summary["valid_records_exported"] == 3
        assert summary["rejected_records"] == 2

        # Verify only 3 valid rows in written Parquet
        table = pq.read_table(export_target)
        assert table.num_rows == 3


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


def test_repeat_export_behavior(sample_valid_records):
    """
    Verify repeat export behavior:
    1. First export succeeds.
    2. Second export with overwrite=False raises FileExistsError (avoids accidental duplicates).
    3. Third export with overwrite=True succeeds deterministically without inflating row count.
    """
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.find.return_value = iter(sample_valid_records)
    mock_db.__getitem__.return_value = mock_coll

    with tempfile.TemporaryDirectory() as tmpdir:
        export_target = os.path.join(tmpdir, "lakehouse_repeat")
        exporter = ParquetLakehouseExporter(db=mock_db, export_dir=export_target)

        # 1. First run
        res1 = exporter.export_academic_records(overwrite=False)
        assert res1["valid_records_exported"] == 3

        # 2. Second run without overwrite must fail
        mock_coll.find.return_value = iter(sample_valid_records)
        with pytest.raises(FileExistsError) as exc_info:
            exporter.export_academic_records(overwrite=False)
        assert "already contains" in str(exc_info.value)

        # 3. Third run with overwrite=True replaces cleanly
        mock_coll.find.return_value = iter(sample_valid_records)
        res3 = exporter.export_academic_records(overwrite=True)
        assert res3["valid_records_exported"] == 3

        table = pq.read_table(export_target)
        assert table.num_rows == 3, "Row count must remain 3 without duplicated records"


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
        # Verify non-partition + partition columns
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
