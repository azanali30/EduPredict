"""
EduPredict - Local Analytical SQL & Impala Compatibility Validation Harness (Phase 7E.3)
Validates query structure, column bindings, expected schemas, and SQL compatibility
for EduPredict's Lakehouse analytical queries without requiring live Impala/Hadoop daemons.
"""

import os
import re
import math
import sqlite3
import logging
from typing import Dict, Any, List, Optional, Set, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Default path to analytical queries specification
DEFAULT_SQL_PATH = os.path.join("analytics", "impala", "02_analytical_queries.sql")

# Canonical Lakehouse schema definition for student_academic_records
STUDENT_ACADEMIC_RECORDS_SCHEMA: Dict[str, str] = {
    "student_code": "TEXT",
    "term": "TEXT",
    "school": "TEXT",
    "sex": "TEXT",
    "age": "INTEGER",
    "address": "TEXT",
    "famsize": "TEXT",
    "p_status": "TEXT",
    "mother_education": "INTEGER",
    "father_education": "INTEGER",
    "study_hours_per_week": "REAL",
    "failures": "INTEGER",
    "school_support": "TEXT",
    "family_support": "TEXT",
    "extra_paid_classes": "TEXT",
    "activities": "TEXT",
    "higher_education": "TEXT",
    "internet": "TEXT",
    "romantic": "TEXT",
    "family_relationship": "INTEGER",
    "free_time": "INTEGER",
    "go_out": "INTEGER",
    "health": "INTEGER",
    "absences": "INTEGER",
    "attendance_percentage": "REAL",
    "assignment_completion_rate": "REAL",
    "previous_exam_marks": "REAL",
    "quiz_scores": "REAL",
    "final_exam_marks": "REAL",
    "academic_status": "TEXT",
    "subject": "TEXT",
    "academic_year": "TEXT",
}

# Known Impala-specific keywords and proprietary functions
IMPALA_SPECIFIC_FUNCTIONS: Set[str] = {
    "APPX_MEDIAN",
    "NDV",
    "HEX",
    "UNHEX",
    "GROUP_CONCAT",
}

# Functions standard in Impala/Postgres but not built-in to default SQLite
NON_SQLITE_BUILTIN_FUNCTIONS: Set[str] = {
    "STDDEV",
    "STDDEV_SAMP",
    "STDDEV_POP",
    "VARIANCE",
    "VARIANCE_SAMP",
    "VARIANCE_POP",
    "VAR_SAMP",
    "VAR_POP",
}

# SQL Injection signature patterns for user-supplied filter parameters
SQL_INJECTION_PATTERN = re.compile(
    r"(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC|EXECUTE)\b|--|;|\/\*|\*\/|')",
    re.IGNORECASE,
)


class SQLStdDevAggregate:
    """Python aggregate implementation of STDDEV for SQLite validation."""
    def __init__(self):
        self.values = []

    def step(self, value):
        if value is not None:
            try:
                self.values.append(float(value))
            except (ValueError, TypeError):
                pass

    def finalize(self):
        if len(self.values) < 2:
            return 0.0
        n = len(self.values)
        mean = sum(self.values) / n
        variance = sum((x - mean) ** 2 for x in self.values) / (n - 1)
        return math.sqrt(variance)


class SQLVarianceAggregate:
    """Python aggregate implementation of VARIANCE for SQLite validation."""
    def __init__(self):
        self.values = []

    def step(self, value):
        if value is not None:
            try:
                self.values.append(float(value))
            except (ValueError, TypeError):
                pass

    def finalize(self):
        if len(self.values) < 2:
            return 0.0
        n = len(self.values)
        mean = sum(self.values) / n
        return sum((x - mean) ** 2 for x in self.values) / (n - 1)


class SQLAppxMedianAggregate:
    """Python aggregate implementation of APPX_MEDIAN for SQLite validation."""
    def __init__(self):
        self.values = []

    def step(self, value):
        if value is not None:
            try:
                self.values.append(float(value))
            except (ValueError, TypeError):
                pass

    def finalize(self):
        if not self.values:
            return 0.0
        sorted_vals = sorted(self.values)
        n = len(sorted_vals)
        mid = n // 2
        if n % 2 == 1:
            return sorted_vals[mid]
        return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0


class LocalSQLValidationHarness:
    """
    Validation engine for Lakehouse analytical SQL queries.
    Provides structural analysis, column reference checking, and local in-memory execution.
    """

    def __init__(self, sql_file_path: Optional[str] = None):
        self.sql_file_path = sql_file_path or DEFAULT_SQL_PATH
        self.known_tables = {"student_academic_records"}
        self.known_columns = set(STUDENT_ACADEMIC_RECORDS_SCHEMA.keys())

    def load_catalog(self) -> List[Dict[str, Any]]:
        """Parse raw SQL statements and metadata from analytical query file."""
        if not os.path.exists(self.sql_file_path):
            raise FileNotFoundError(f"SQL file not found at: {self.sql_file_path}")

        with open(self.sql_file_path, "r", encoding="utf-8") as f:
            content = f.read()

        raw_statements = [s.strip() for s in content.split(";") if s.strip()]
        catalog = []

        query_counter = 1
        for stmt in raw_statements:
            # Filter non-comment lines to check SQL statement type
            non_comment_lines = [l.strip() for l in stmt.split("\n") if l.strip() and not l.strip().startswith("--")]
            if not non_comment_lines:
                continue

            first_sql_line = non_comment_lines[0].upper()
            if first_sql_line.startswith("USE "):
                continue

            # Extract title and description from leading comments
            lines = stmt.split("\n")
            title = None
            description = None
            sql_lines = []

            for line in lines:
                stripped = line.strip()
                if stripped.startswith("-- QUERY"):
                    title = stripped.replace("--", "").strip()
                elif stripped.startswith("--") and title and not description:
                    description = stripped.replace("--", "").strip()
                elif not stripped.startswith("--"):
                    sql_lines.append(line)

            clean_sql = "\n".join(sql_lines).strip()
            if not clean_sql:
                continue

            catalog.append({
                "id": query_counter,
                "title": title or f"Query {query_counter}",
                "description": description or "",
                "raw_sql": clean_sql,
            })
            query_counter += 1

        return catalog

    def analyze_query_structure(self, sql: str) -> Dict[str, Any]:
        """
        Inspect query structure, referenced tables, columns, and engine-specific functions.
        """
        if not sql or not sql.strip():
            raise ValueError("SQL statement cannot be empty")

        upper_sql = sql.upper()

        # Check basic SQL keywords
        if "SELECT" not in upper_sql or "FROM" not in upper_sql:
            raise ValueError("Invalid SQL: statement must contain SELECT and FROM clauses")

        # Detect CTEs (Common Table Expressions)
        ctes = set()
        cte_match = re.findall(r"WITH\s+([a-zA-Z0-9_]+)\s+AS", sql, re.IGNORECASE)
        if cte_match:
            ctes.update(cte_match)

        # Detect referenced tables
        table_matches = re.findall(r"\bFROM\s+([a-zA-Z0-9_]+)|\bJOIN\s+([a-zA-Z0-9_]+)", sql, re.IGNORECASE)
        referenced_tables = set()
        for m in table_matches:
            for tbl in m:
                if tbl:
                    referenced_tables.add(tbl)

        # Verify referenced tables
        valid_tables = self.known_tables.union(ctes)
        unknown_tables = referenced_tables - valid_tables

        # Detect Impala-specific and non-SQLite functions
        detected_impala_features = []
        for func in IMPALA_SPECIFIC_FUNCTIONS:
            if re.search(r"\b" + func + r"\s*\(", upper_sql):
                detected_impala_features.append(func)

        for func in NON_SQLITE_BUILTIN_FUNCTIONS:
            if re.search(r"\b" + func + r"\s*\(", upper_sql):
                detected_impala_features.append(func)

        # Detect window functions
        has_window_functions = bool(re.search(r"\bOVER\s*\(", upper_sql))

        # Detect referenced known columns
        referenced_columns = set()
        for col in self.known_columns:
            if re.search(r"\b" + col + r"\b", sql, re.IGNORECASE):
                referenced_columns.add(col)

        is_strictly_ansi = len(detected_impala_features) == 0

        return {
            "valid_syntax_structure": True,
            "referenced_tables": list(referenced_tables),
            "unknown_tables": list(unknown_tables),
            "referenced_columns": sorted(list(referenced_columns)),
            "ctes": list(ctes),
            "has_window_functions": has_window_functions,
            "impala_specific_features": detected_impala_features,
            "is_strictly_ansi_sqlite_compatible": is_strictly_ansi,
        }

    def get_representative_dataset(self) -> List[Dict[str, Any]]:
        """Return a rich representative in-memory dataset matching schema."""
        return [
            {
                "student_code": "STU_1001",
                "term": "Term 3",
                "school": "GP",
                "sex": "F",
                "age": 16,
                "address": "U",
                "famsize": "GT3",
                "p_status": "T",
                "mother_education": 4,
                "father_education": 4,
                "study_hours_per_week": 10.0,
                "failures": 0,
                "school_support": "no",
                "family_support": "yes",
                "extra_paid_classes": "yes",
                "activities": "yes",
                "higher_education": "yes",
                "internet": "yes",
                "romantic": "no",
                "family_relationship": 5,
                "free_time": 3,
                "go_out": 2,
                "health": 5,
                "absences": 2,
                "attendance_percentage": 96.5,
                "assignment_completion_rate": 95.0,
                "previous_exam_marks": 78.0,
                "quiz_scores": 82.0,
                "final_exam_marks": 88.0,
                "academic_status": "Good Standing",
                "subject": "Mathematics",
                "academic_year": "2023-2024",
            },
            {
                "student_code": "STU_1002",
                "term": "Term 3",
                "school": "GP",
                "sex": "M",
                "age": 17,
                "address": "R",
                "famsize": "LE3",
                "p_status": "A",
                "mother_education": 2,
                "father_education": 2,
                "study_hours_per_week": 3.0,
                "failures": 1,
                "school_support": "no",
                "family_support": "no",
                "extra_paid_classes": "no",
                "activities": "no",
                "higher_education": "yes",
                "internet": "yes",
                "romantic": "yes",
                "family_relationship": 3,
                "free_time": 4,
                "go_out": 4,
                "health": 3,
                "absences": 14,
                "attendance_percentage": 78.0,
                "assignment_completion_rate": 60.0,
                "previous_exam_marks": 55.0,
                "quiz_scores": 48.0,
                "final_exam_marks": 42.0,
                "academic_status": "High Risk",
                "subject": "Mathematics",
                "academic_year": "2023-2024",
            },
            {
                "student_code": "STU_1003",
                "term": "Term 3",
                "school": "MS",
                "sex": "F",
                "age": 18,
                "address": "U",
                "famsize": "GT3",
                "p_status": "T",
                "mother_education": 3,
                "father_education": 3,
                "study_hours_per_week": 6.0,
                "failures": 0,
                "school_support": "yes",
                "family_support": "yes",
                "extra_paid_classes": "no",
                "activities": "yes",
                "higher_education": "yes",
                "internet": "yes",
                "romantic": "no",
                "family_relationship": 4,
                "free_time": 3,
                "go_out": 3,
                "health": 4,
                "absences": 6,
                "attendance_percentage": 90.0,
                "assignment_completion_rate": 85.0,
                "previous_exam_marks": 65.0,
                "quiz_scores": 70.0,
                "final_exam_marks": 72.0,
                "academic_status": "Good Standing",
                "subject": "Portuguese Language",
                "academic_year": "2023-2024",
            },
            {
                "student_code": "STU_1004",
                "term": "Term 3",
                "school": "MS",
                "sex": "M",
                "age": 16,
                "address": "U",
                "famsize": "GT3",
                "p_status": "T",
                "mother_education": 1,
                "father_education": 1,
                "study_hours_per_week": 2.0,
                "failures": 2,
                "school_support": "no",
                "family_support": "no",
                "extra_paid_classes": "no",
                "activities": "no",
                "higher_education": "no",
                "internet": "no",
                "romantic": "no",
                "family_relationship": 2,
                "free_time": 5,
                "go_out": 5,
                "health": 2,
                "absences": 22,
                "attendance_percentage": 68.0,
                "assignment_completion_rate": 45.0,
                "previous_exam_marks": 45.0,
                "quiz_scores": 35.0,
                "final_exam_marks": 25.0,
                "academic_status": "High Risk",
                "subject": "Portuguese Language",
                "academic_year": "2023-2024",
            },
            {
                "student_code": "STU_1005",
                "term": "Term 3",
                "school": "GP",
                "sex": "F",
                "age": 16,
                "address": "U",
                "famsize": "GT3",
                "p_status": "T",
                "mother_education": 4,
                "father_education": 3,
                "study_hours_per_week": 8.0,
                "failures": 0,
                "school_support": "no",
                "family_support": "yes",
                "extra_paid_classes": "no",
                "activities": "yes",
                "higher_education": "yes",
                "internet": "yes",
                "romantic": "no",
                "family_relationship": 5,
                "free_time": 2,
                "go_out": 2,
                "health": 5,
                "absences": 1,
                "attendance_percentage": 98.0,
                "assignment_completion_rate": 98.0,
                "previous_exam_marks": 85.0,
                "quiz_scores": 88.0,
                "final_exam_marks": 92.0,
                "academic_status": "Good Standing",
                "subject": "Mathematics",
                "academic_year": "2023-2024",
            },
            {
                "student_code": "STU_ANOMALY",
                "term": "Term 3",
                "school": "GP",
                "sex": "M",
                "age": 19,
                "address": "U",
                "famsize": "GT3",
                "p_status": "T",
                "mother_education": 1,
                "father_education": 1,
                "study_hours_per_week": 0.0,  # Missing study hours anomaly
                "failures": 3,
                "school_support": "no",
                "family_support": "no",
                "extra_paid_classes": "no",
                "activities": "no",
                "higher_education": "no",
                "internet": "no",
                "romantic": "no",
                "family_relationship": 1,
                "free_time": 5,
                "go_out": 5,
                "health": 1,
                "absences": 55,  # High absence vs high mark anomaly
                "attendance_percentage": 105.0,  # Out of range anomaly
                "assignment_completion_rate": 10.0,
                "previous_exam_marks": 95.0,
                "quiz_scores": 92.0,
                "final_exam_marks": 95.0,
                "academic_status": "High Risk",
                "subject": "Mathematics",
                "academic_year": "2023-2024",
            },
        ]

    def create_in_memory_database(
        self,
        records: Optional[List[Dict[str, Any]]] = None,
        allow_emulation: bool = True,
    ) -> sqlite3.Connection:
        """
        Creates an in-memory SQLite database populated with schema and test rows.
        Optionally registers Python aggregates for Impala statistical functions.
        """
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row

        # Register aggregate functions if emulation enabled
        if allow_emulation:
            conn.create_aggregate("STDDEV", 1, SQLStdDevAggregate)
            conn.create_aggregate("STDDEV_SAMP", 1, SQLStdDevAggregate)
            conn.create_aggregate("VARIANCE", 1, SQLVarianceAggregate)
            conn.create_aggregate("VAR_SAMP", 1, SQLVarianceAggregate)
            conn.create_aggregate("APPX_MEDIAN", 1, SQLAppxMedianAggregate)

        # Build CREATE TABLE statement
        col_defs = [f"{col} {dtype}" for col, dtype in STUDENT_ACADEMIC_RECORDS_SCHEMA.items()]
        create_sql = f"CREATE TABLE student_academic_records ({', '.join(col_defs)});"
        conn.execute(create_sql)

        # Insert representative records
        dataset = records if records is not None else self.get_representative_dataset()
        if dataset:
            columns = list(STUDENT_ACADEMIC_RECORDS_SCHEMA.keys())
            placeholders = ", ".join(["?"] * len(columns))
            insert_sql = f"INSERT INTO student_academic_records ({', '.join(columns)}) VALUES ({placeholders})"

            rows = []
            for item in dataset:
                row = [item.get(col) for col in columns]
                rows.append(row)

            conn.executemany(insert_sql, rows)
            conn.commit()

        return conn

    def execute_query(
        self,
        sql: str,
        conn: Optional[sqlite3.Connection] = None,
        allow_emulation: bool = True,
    ) -> Dict[str, Any]:
        """
        Execute an analytical SQL query against the local database.
        Returns result rows, execution status, and column schema.
        """
        structure = self.analyze_query_structure(sql)

        # If not strictly ANSI and emulation disabled, report why execution is skipped
        if not structure["is_strictly_ansi_sqlite_compatible"] and not allow_emulation:
            return {
                "executed": False,
                "error": (
                    f"Query contains Impala-specific functions: {structure['impala_specific_features']}. "
                    "Requires real Apache Impala cluster or allow_emulation=True."
                ),
                "structure": structure,
                "columns": [],
                "row_count": 0,
                "rows": [],
            }

        should_close = False
        if conn is None:
            conn = self.create_in_memory_database(allow_emulation=allow_emulation)
            should_close = True

        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            rows = [dict(row) for row in cursor.fetchall()]
            column_names = [desc[0] for desc in cursor.description] if cursor.description else []
            return {
                "executed": True,
                "error": None,
                "structure": structure,
                "columns": column_names,
                "row_count": len(rows),
                "rows": rows,
            }
        except Exception as e:
            return {
                "executed": False,
                "error": str(e),
                "structure": structure,
                "columns": [],
                "row_count": 0,
                "rows": [],
            }
        finally:
            if should_close and conn:
                conn.close()

    def validate_catalog(self, allow_emulation: bool = True) -> Dict[str, Any]:
        """
        Validates all queries in the catalog, categorizing each into:
        - Locally executed successfully
        - Structurally validated only
        - Impala-specific requiring live cluster
        """
        catalog = self.load_catalog()
        results = []

        conn = self.create_in_memory_database(allow_emulation=allow_emulation)
        try:
            for item in catalog:
                exec_res = self.execute_query(item["raw_sql"], conn=conn, allow_emulation=allow_emulation)
                strict_check = self.analyze_query_structure(item["raw_sql"])

                classification = "LOCALLY_EXECUTED"
                if not exec_res["executed"]:
                    classification = "STRUCTURAL_VALIDATION_ONLY"
                elif not strict_check["is_strictly_ansi_sqlite_compatible"]:
                    classification = "EXECUTED_WITH_IMPALA_EMULATION"

                results.append({
                    "id": item["id"],
                    "title": item["title"],
                    "classification": classification,
                    "is_ansi_compatible": strict_check["is_strictly_ansi_sqlite_compatible"],
                    "impala_features": strict_check["impala_specific_features"],
                    "row_count": exec_res["row_count"],
                    "columns": exec_res["columns"],
                    "error": exec_res["error"],
                })
        finally:
            conn.close()

        total = len(results)
        executed_count = sum(1 for r in results if r["classification"] in ("LOCALLY_EXECUTED", "EXECUTED_WITH_IMPALA_EMULATION"))
        ansi_count = sum(1 for r in results if r["is_ansi_compatible"])

        return {
            "total_queries": total,
            "strictly_ansi_queries": ansi_count,
            "locally_executed_queries": executed_count,
            "queries": results,
        }

    @staticmethod
    def sanitize_filter_parameter(param_name: str, value: Any, allowed_values: Optional[List[str]] = None) -> str:
        """
        Sanitizes dynamic query parameters against SQL injection attempts.
        Validates value type and rejects dangerous characters/tokens.
        """
        if value is None:
            raise ValueError(f"Parameter '{param_name}' cannot be None")

        val_str = str(value).strip()

        if allowed_values and val_str not in allowed_values:
            raise ValueError(
                f"Invalid value '{val_str}' for parameter '{param_name}'. "
                f"Must be one of: {allowed_values}"
            )

        if SQL_INJECTION_PATTERN.search(val_str):
            raise ValueError(f"Potential SQL injection detected in parameter '{param_name}': {val_str}")

        return val_str


def generate_validation_report() -> str:
    """Generate markdown documentation reporting local validation results."""
    harness = LocalSQLValidationHarness()
    res = harness.validate_catalog(allow_emulation=True)

    report_lines = [
        "# EduPredict — Local SQL / Impala Validation Report",
        "",
        f"**Target Specification**: `analytics/impala/02_analytical_queries.sql`  ",
        f"**Total Queries Analyzed**: {res['total_queries']}  ",
        f"**Strict ANSI SQL Queries**: {res['strictly_ansi_queries']} / {res['total_queries']}  ",
        f"**Locally Executed Queries (with Emulation)**: {res['locally_executed_queries']} / {res['total_queries']}  ",
        "",
        "---",
        "",
        "## Query Validation Matrix",
        "",
        "| ID | Title | Compatibility | Impala Features | Local Execution Status | Output Columns |",
        "|:---:|:---|:---:|:---:|:---:|:---|",
    ]

    for q in res["queries"]:
        features = ", ".join(q["impala_features"]) if q["impala_features"] else "None (Pure ANSI)"
        status = "PASSED" if q["error"] is None else f"FAILED ({q['error']})"
        cols = f"{len(q['columns'])} columns: " + ", ".join(q["columns"][:3]) + ("..." if len(q["columns"]) > 3 else "")
        report_lines.append(
            f"| {q['id']} | **{q['title']}** | {q['classification']} | `{features}` | {status} | `{cols}` |"
        )

    report_lines.extend([
        "",
        "---",
        "",
        "## Impala vs. Local Engine Compatibility Notes",
        "",
        "1. **Pure ANSI Queries (Queries 2, 4, 5, 7)**:",
        "   - 100% ANSI-compliant. Executed natively on SQLite 3.25+ without any custom functions.",
        "2. **Window Function Queries (Query 3)**:",
        "   - Uses CTE (`WITH RankedScholars AS ...`) and `DENSE_RANK() OVER (PARTITION BY subject ORDER BY ...)`.",
        "   - Fully supported by SQLite 3.25+ and executed natively.",
        "3. **Impala Statistical Queries (Queries 1 & 6)**:",
        "   - **Query 1**: Uses `STDDEV(final_exam_marks)`.",
        "   - **Query 6**: Uses `APPX_MEDIAN(final_exam_marks)`, `STDDEV()`, and `VARIANCE()`.",
        "   - In strict native mode, SQLite rejects these because `APPX_MEDIAN`, `STDDEV`, and `VARIANCE` are not built-in SQLite functions.",
        "   - In the EduPredict Local SQL Harness, aggregate implementations in Python allow these queries to execute with simulated analytical data.",
        "   - On a live production cluster, Apache Impala compiles these down to distributed LLVM machine code.",
    ])

    return "\n".join(report_lines)
