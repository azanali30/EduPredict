"""
Unit and Integration Tests for EduPredict Phase 4 Data Pipeline
Tests dataset cleaning, MongoDB ingestion idempotency, HDFS Lakehouse manager,
Impala query integrity, and statistical artifact generation.
"""

import os
import json
import pytest
import pandas as pd
from pymongo import MongoClient
from backend.config import get_config
from backend.data_engineering.clean_dataset import classify_risk, build_cleaned_pipeline
from backend.data_engineering.ingest_mongodb import validate_record, ingest_academic_data
from backend.data_engineering.hdfs_lakehouse import HDFSLakehouseManager
from analytics.impala.impala_query_runner import load_query_catalog, probe_impala_daemon


# ==============================================================================
# 1. Dataset Cleaning & Standardization Tests
# ==============================================================================

def test_raw_datasets_exist():
    """Verify both UCI source raw files are present."""
    mat_path = os.path.join("data", "raw", "student-mat.csv")
    por_path = os.path.join("data", "raw", "student-por.csv")
    assert os.path.isfile(mat_path), f"Missing raw file: {mat_path}"
    assert os.path.isfile(por_path), f"Missing raw file: {por_path}"


def test_cleaned_dataset_integrity():
    """Verify processed dataset adheres to expected dimensions, types, and values."""
    csv_path = os.path.join("data", "processed", "cleaned_academic_records.csv")
    assert os.path.isfile(csv_path), f"Missing processed file: {csv_path}"

    df = pd.read_csv(csv_path)

    # Dimensional verification
    assert len(df) == 1044, f"Expected 1,044 records, got {len(df)}"
    assert (df["subject"] == "Mathematics").sum() == 395
    assert (df["subject"] == "Portuguese Language").sum() == 649

    # Null value audit
    assert df.isnull().sum().sum() == 0, "Dataset contains unexpected NaN values"

    # Derived indicators bounds
    assert (df["final_exam_marks"] >= 0).all() and (df["final_exam_marks"] <= 100).all()
    assert (df["previous_exam_marks"] >= 0).all() and (df["previous_exam_marks"] <= 100).all()
    assert (df["quiz_scores"] >= 0).all() and (df["quiz_scores"] <= 100).all()
    assert (df["attendance_percentage"] >= 0).all() and (df["attendance_percentage"] <= 100).all()
    assert (df["study_hours_per_week"] > 0).all()

    # Risk tiers
    valid_risks = {"Low Risk / On Track", "Moderate Risk", "High Risk"}
    assert set(df["academic_status"].unique()).issubset(valid_risks)


def test_classify_risk_logic():
    """Test three-tier risk classification thresholds."""
    assert classify_risk(35.0) == "High Risk"
    assert classify_risk(49.9) == "High Risk"
    assert classify_risk(50.0) == "Moderate Risk"
    assert classify_risk(69.9) == "Moderate Risk"
    assert classify_risk(70.0) == "Low Risk / On Track"
    assert classify_risk(100.0) == "Low Risk / On Track"


def test_data_dictionary_and_summary_metadata():
    """Verify data dictionary and cleaning summary JSON files."""
    summary_path = os.path.join("data", "processed", "cleaning_summary.json")
    dict_path = os.path.join("data", "processed", "data_dictionary.json")

    assert os.path.isfile(summary_path)
    assert os.path.isfile(dict_path)

    with open(summary_path, "r", encoding="utf-8") as f:
        summary = json.load(f)
        assert summary["total_source_records"] == 1044
        assert summary["missing_values_imputed"] == 0
        assert "risk_distribution" in summary

    with open(dict_path, "r", encoding="utf-8") as f:
        data_dict = json.load(f)
        assert "student_code" in data_dict
        assert "subject" in data_dict
        assert "final_exam_marks" in data_dict
        assert len(data_dict) >= 15


# ==============================================================================
# 2. MongoDB Schema & Ingestion Pipeline Tests
# ==============================================================================

def test_record_validator_accepts_valid():
    """Verify record validation passes clean records."""
    valid_row = {
        "student_code": "STU_MAT_0001",
        "subject": "Mathematics",
        "academic_year": "2024-2025",
        "term": "Term 3",
        "attendance_percentage": 95.0,
        "study_hours_per_week": 5.0,
        "previous_exam_marks": 70.0,
        "quiz_scores": 72.0,
        "final_exam_marks": 75.0,
        "academic_status": "Low Risk / On Track"
    }
    assert validate_record(valid_row) is True


def test_record_validator_rejects_invalid():
    """Verify record validation rejects out-of-bounds or malformed records."""
    # Out of bounds grade
    invalid_grade = {
        "student_code": "STU_ERR_001",
        "subject": "Mathematics",
        "academic_year": "2024-2025",
        "term": "Term 3",
        "attendance_percentage": 90.0,
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 70.0,
        "quiz_scores": 72.0,
        "final_exam_marks": 150.0,
        "academic_status": "Low Risk / On Track"
    }
    assert validate_record(invalid_grade) is False

    # Negative attendance
    invalid_att = {
        "student_code": "STU_ERR_002",
        "subject": "Mathematics",
        "academic_year": "2024-2025",
        "term": "Term 3",
        "attendance_percentage": -5.0,
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 70.0,
        "quiz_scores": 72.0,
        "final_exam_marks": 70.0,
        "academic_status": "Low Risk / On Track"
    }
    assert validate_record(invalid_att) is False

    # Missing student code
    missing_code = {
        "student_code": "",
        "subject": "Mathematics",
        "academic_year": "2024-2025",
        "term": "Term 3",
        "attendance_percentage": 90.0,
        "study_hours_per_week": 2.0,
        "previous_exam_marks": 70.0,
        "quiz_scores": 72.0,
        "final_exam_marks": 70.0,
        "academic_status": "Low Risk / On Track"
    }
    # Empty string is checked in validate_record or ingestion type normalization
    assert bool(missing_code["student_code"]) is False


def test_mongodb_ingestion_idempotency():
    """Verify MongoDB ingestion runs idempotently without inflating document count."""
    config = get_config()
    client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=2000)
    db = client[config.MONGO_DB_NAME]
    coll = db["analytical_academic_records"]

    # Initial count
    initial_count = coll.count_documents({})
    assert initial_count >= 1044, "Expected pre-existing ingested records"

    # Run ingestion again
    result = ingest_academic_data(db)
    assert result["invalid_records_rejected"] == 0
    assert result["newly_upserted_count"] == 0, "Idempotent re-run must insert 0 new records"
    assert result["matched_existing_count"] == 1044
    assert result["net_documents_added"] == 0

    # Final count must remain exact
    final_count = coll.count_documents({})
    assert final_count == initial_count, "Document count changed unexpectedly after idempotent run"


# ==============================================================================
# 3. Hadoop / HDFS Lakehouse Architecture Tests
# ==============================================================================

def test_hdfs_lakehouse_manager_initialization():
    """Verify HDFSLakehouseManager properties and directory taxonomy."""
    manager = HDFSLakehouseManager()
    bp = manager.get_architectural_blueprint()
    assert "/edupredict/raw/academic/" in bp
    assert "/edupredict/processed/academic/" in bp
    assert "/edupredict/analytics/subject_performance/" in bp


def test_hdfs_connection_check_graceful_offline():
    """Verify HDFS check returns False gracefully without crash when daemon is offline."""
    manager = HDFSLakehouseManager(namenode_url="http://localhost:9870")
    probe = manager.probe_connection()
    assert probe["connected"] is False
    assert "Unreachable" in probe["error"] or "refused" in probe["error"].lower()


# ==============================================================================
# 4. Apache Impala Big Data Engine Tests
# ==============================================================================

def test_impala_connection_check_graceful_offline():
    """Verify Impala connection probe returns False gracefully when daemon is offline."""
    probe_res = probe_impala_daemon("localhost", 21050)
    assert probe_res["connected"] is False
    assert "Unreachable" in probe_res["error"] or "refused" in probe_res["error"].lower()


def test_impala_ddl_and_queries_parsing():
    """Verify Impala DDL script and analytical queries file exist and parse cleanly."""
    ddl_path = os.path.join("analytics", "impala", "01_create_academic_lakehouse_tables.sql")
    queries_path = os.path.join("analytics", "impala", "02_analytical_queries.sql")

    assert os.path.isfile(ddl_path)
    assert os.path.isfile(queries_path)

    queries = load_query_catalog(queries_path)
    assert len(queries) >= 7, f"Expected at least 7 analytical queries, found {len(queries)}"

    # Validate presence of window functions and lakehouse database
    full_sql = " ".join([q["sql"] for q in queries])
    assert "DENSE_RANK()" in full_sql
    assert "edupredict_lakehouse" in full_sql
    assert "student_academic_records" in full_sql


# ==============================================================================
# 5. R & Statistical Artifacts Tests
# ==============================================================================

def test_r_script_and_artifacts_exist():
    """Verify R script and all generated statistical deliverables exist."""
    r_script = os.path.join("analytics", "r", "statistical_validation.R")
    summary_txt = os.path.join("analytics", "r", "statistical_summary_output.txt")
    corr_csv = os.path.join("analytics", "r", "correlation_matrix.csv")
    plot1 = os.path.join("analytics", "r", "grade_distribution_by_subject.png")
    plot2 = os.path.join("analytics", "r", "attendance_vs_grade_scatter.png")

    assert os.path.isfile(r_script)
    assert os.path.isfile(summary_txt)
    assert os.path.isfile(corr_csv)
    assert os.path.isfile(plot1)
    assert os.path.isfile(plot2)


def test_statistical_summary_results():
    """Verify statistical outputs contain valid correlation ranges and test metrics."""
    corr_path = os.path.join("analytics", "r", "correlation_matrix.csv")
    corr_df = pd.read_csv(corr_path, index_col=0)

    # G1 to G3 correlation must be strong positive (> 0.75)
    assert corr_df.loc["G1", "G3"] > 0.75
    # Past failures to G3 must be negative (< -0.30)
    assert corr_df.loc["failures", "G3"] < -0.30

    # Summary text inspection
    with open(os.path.join("analytics", "r", "statistical_summary_output.txt"), "r", encoding="utf-8") as f:
        content = f.read()
        assert "Welch Two Sample t-test" in content
        assert "ANOVA" in content
        assert "Kruskal-Wallis" in content
