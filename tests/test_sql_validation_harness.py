"""
EduPredict - Local Analytical SQL Validation Harness Tests (Phase 7E.3)
Automated test suite verifying the local SQL validation harness, query structure,
catalog parsing, empty datasets, missing columns, error handling, and SQL injection protection.
"""

import pytest
import sqlite3
from typing import Dict, Any

from backend.data_engineering.sql_validator import (
    LocalSQLValidationHarness,
    STUDENT_ACADEMIC_RECORDS_SCHEMA,
    IMPALA_SPECIFIC_FUNCTIONS,
    generate_validation_report,
)


@pytest.fixture
def harness():
    return LocalSQLValidationHarness()


# ==============================================================================
# 1. Query Discovery and Loading Tests
# ==============================================================================

def test_query_catalog_discovery_and_loading(harness):
    """Verify that all 7 production analytical queries are discovered and loaded."""
    catalog = harness.load_catalog()
    assert len(catalog) == 7

    expected_query_titles = [
        "Average Academic Performance & Pass Rates by Subject",
        "Attendance Velocity vs. Final Academic Results",
        "Top-Performing Students Across Curriculum",
        "Early Warning Detection",
        "Longitudinal Term-Wise Performance Trajectory",
        "Subject-Level Performance Distribution",
        "Data Quality Audit",
    ]

    for item, expected_title_part in zip(catalog, expected_query_titles):
        assert expected_title_part in item["title"]
        assert item["id"] >= 1
        assert "SELECT" in item["raw_sql"].upper()
        assert "FROM" in item["raw_sql"].upper()


def test_catalog_file_not_found():
    """Verify that a nonexistent SQL file path raises FileNotFoundError."""
    invalid_harness = LocalSQLValidationHarness(sql_file_path="nonexistent_dir/queries.sql")
    with pytest.raises(FileNotFoundError):
        invalid_harness.load_catalog()


# ==============================================================================
# 2. Structural Analysis & Compatibility Tests
# ==============================================================================

def test_analyze_query_structure_pure_ansi(harness):
    """Verify structural analysis for pure ANSI query (e.g. Query 4)."""
    catalog = harness.load_catalog()
    query4 = catalog[3]["raw_sql"]  # Early warning detection

    analysis = harness.analyze_query_structure(query4)
    assert analysis["valid_syntax_structure"] is True
    assert "student_academic_records" in analysis["referenced_tables"]
    assert len(analysis["unknown_tables"]) == 0
    assert analysis["is_strictly_ansi_sqlite_compatible"] is True
    assert len(analysis["impala_specific_features"]) == 0
    assert "previous_exam_marks" in analysis["referenced_columns"]
    assert "final_exam_marks" in analysis["referenced_columns"]


def test_analyze_query_structure_window_functions_and_ctes(harness):
    """Verify structural analysis for window function CTE query (Query 3)."""
    catalog = harness.load_catalog()
    query3 = catalog[2]["raw_sql"]  # RankedScholars CTE

    analysis = harness.analyze_query_structure(query3)
    assert analysis["valid_syntax_structure"] is True
    assert "student_academic_records" in analysis["referenced_tables"]
    assert "RankedScholars" in analysis["ctes"]
    assert analysis["has_window_functions"] is True
    assert analysis["is_strictly_ansi_sqlite_compatible"] is True


def test_analyze_query_structure_impala_specific_functions(harness):
    """Verify detection of Impala-specific functions in Query 1 and Query 6."""
    catalog = harness.load_catalog()
    query1 = catalog[0]["raw_sql"]
    query6 = catalog[5]["raw_sql"]

    analysis1 = harness.analyze_query_structure(query1)
    assert "STDDEV" in analysis1["impala_specific_features"]
    assert analysis1["is_strictly_ansi_sqlite_compatible"] is False

    analysis6 = harness.analyze_query_structure(query6)
    assert "APPX_MEDIAN" in analysis6["impala_specific_features"]
    assert "STDDEV" in analysis6["impala_specific_features"]
    assert "VARIANCE" in analysis6["impala_specific_features"]
    assert analysis6["is_strictly_ansi_sqlite_compatible"] is False


def test_analyze_query_structure_invalid_empty_sql(harness):
    """Verify that empty or invalid SQL raises ValueError."""
    with pytest.raises(ValueError, match="cannot be empty"):
        harness.analyze_query_structure("")

    with pytest.raises(ValueError, match="must contain SELECT and FROM"):
        harness.analyze_query_structure("UPDATE student_academic_records SET age = 17")


# ==============================================================================
# 3. Local Execution & Expected Result Schemas
# ==============================================================================

def test_local_execution_pure_ansi_queries(harness):
    """Verify local execution of queries 2, 3, 4, 5, 7 without emulation."""
    catalog = harness.load_catalog()
    ansi_indices = [1, 2, 3, 4, 6]  # 0-indexed corresponding to Q2, Q3, Q4, Q5, Q7

    for idx in ansi_indices:
        query_item = catalog[idx]
        res = harness.execute_query(query_item["raw_sql"], allow_emulation=False)
        assert res["executed"] is True, f"Query {query_item['title']} failed: {res['error']}"
        assert res["error"] is None
        assert res["row_count"] > 0
        assert len(res["columns"]) > 0


def test_local_execution_with_impala_emulation(harness):
    """Verify local execution of queries 1 and 6 when statistical emulation is enabled."""
    catalog = harness.load_catalog()
    q1 = catalog[0]
    q6 = catalog[5]

    # Without emulation: should not execute and report clear Impala reason
    res1_strict = harness.execute_query(q1["raw_sql"], allow_emulation=False)
    assert res1_strict["executed"] is False
    assert "Impala-specific" in res1_strict["error"]

    res6_strict = harness.execute_query(q6["raw_sql"], allow_emulation=False)
    assert res6_strict["executed"] is False
    assert "APPX_MEDIAN" in res6_strict["error"]

    # With emulation: should execute successfully
    res1_emu = harness.execute_query(q1["raw_sql"], allow_emulation=True)
    assert res1_emu["executed"] is True
    assert res1_emu["error"] is None
    assert "avg_final_exam_pct" in res1_emu["columns"]
    assert "pass_rate_pct" in res1_emu["columns"]

    res6_emu = harness.execute_query(q6["raw_sql"], allow_emulation=True)
    assert res6_emu["executed"] is True
    assert res6_emu["error"] is None
    assert "median_score" in res6_emu["columns"]
    assert "std_dev" in res6_emu["columns"]


def test_validate_all_7_queries_in_catalog(harness):
    """Verify batch validation across all 7 queries."""
    summary = harness.validate_catalog(allow_emulation=True)
    assert summary["total_queries"] == 7
    assert summary["strictly_ansi_queries"] == 5
    assert summary["locally_executed_queries"] == 7

    for q in summary["queries"]:
        assert q["error"] is None
        assert q["row_count"] > 0
        assert len(q["columns"]) > 0


# ==============================================================================
# 4. Edge Cases: Empty Datasets & Missing Columns
# ==============================================================================

def test_queries_execute_safely_on_empty_dataset(harness):
    """Verify that all analytical queries execute on an empty table without crashing."""
    conn = harness.create_in_memory_database(records=[], allow_emulation=True)
    catalog = harness.load_catalog()

    try:
        for item in catalog:
            res = harness.execute_query(item["raw_sql"], conn=conn, allow_emulation=True)
            assert res["executed"] is True, f"Failed on empty dataset for {item['title']}: {res['error']}"
            assert res["error"] is None
            # Verify columns schema is preserved even with 0 rows (or 1 aggregated row with nulls)
            assert len(res["columns"]) > 0
    finally:
        conn.close()


def test_missing_or_invalid_column_handling(harness):
    """Verify that queries referencing nonexistent columns fail with clean diagnostic errors."""
    invalid_sql = "SELECT student_code, nonexistent_metric_column FROM student_academic_records;"
    res = harness.execute_query(invalid_sql)
    assert res["executed"] is False
    assert "no such column" in res["error"]


def test_unknown_table_reference_handling(harness):
    """Verify that queries referencing unknown tables fail gracefully."""
    invalid_sql = "SELECT * FROM nonexistent_foreign_lakehouse_table;"
    res = harness.execute_query(invalid_sql)
    assert res["executed"] is False
    assert "no such table" in res["error"]


# ==============================================================================
# 5. SQL Injection Protection Tests
# ==============================================================================

def test_sanitize_filter_parameter_valid_inputs(harness):
    """Verify valid parameter inputs pass sanitization."""
    sanitized_subj = harness.sanitize_filter_parameter(
        "subject",
        "Mathematics",
        allowed_values=["Mathematics", "Portuguese Language"],
    )
    assert sanitized_subj == "Mathematics"

    sanitized_year = harness.sanitize_filter_parameter("academic_year", "2023-2024")
    assert sanitized_year == "2023-2024"


@pytest.mark.parametrize("malicious_input", [
    "Mathematics' OR '1'='1",
    "Mathematics; DROP TABLE student_academic_records; --",
    "Mathematics' UNION SELECT * FROM users --",
    "Portuguese Language/*comment*/",
    "admin' --",
])
def test_sanitize_filter_parameter_rejects_sql_injection(harness, malicious_input):
    """Verify that SQL injection payloads are detected and rejected."""
    with pytest.raises(ValueError, match="(Potential SQL injection|Invalid value)"):
        harness.sanitize_filter_parameter(
            "subject",
            malicious_input,
            allowed_values=["Mathematics", "Portuguese Language"],
        )


def test_sanitize_filter_parameter_rejects_none(harness):
    """Verify that None values are rejected."""
    with pytest.raises(ValueError, match="cannot be None"):
        harness.sanitize_filter_parameter("term", None)


# ==============================================================================
# 6. Report Generation Test
# ==============================================================================

def test_generate_validation_report():
    """Verify markdown validation report generation."""
    report = generate_validation_report()
    assert "# EduPredict — Local SQL / Impala Validation Report" in report
    assert "Total Queries Analyzed" in report
    assert "QUERY 1: Average Academic Performance" in report
    assert "APPX_MEDIAN" in report
    assert "Window Function Queries" in report
