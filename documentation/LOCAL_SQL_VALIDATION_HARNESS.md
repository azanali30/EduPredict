# EduPredict — Local SQL / Apache Impala Validation Harness (Phase 7E.3)

**Specification Baseline**: Aptech eProject Big Data / EduPredict SRS  
**Target Query File**: `analytics/impala/02_analytical_queries.sql`  
**DDL Specification**: `analytics/impala/01_create_academic_lakehouse_tables.sql`  
**Implementation**: `backend/data_engineering/sql_validator.py`  
**Test Suite**: `tests/test_sql_validation_harness.py` (20 automated tests passing)  
**Execution Mode**: In-Memory SQLite 3.25+ with Statistical Emulation & AST Analysis  
**Status**: VERIFIED & DOCUMENTED  

---

## 1. Executive Summary & Purpose

Phase 7E.3 provides a reliable local validation environment for EduPredict's Lakehouse analytical SQL queries without pretending that a live Apache Impala cluster is active on the local development workstation.

As documented in [PHASE_7E_READINESS_AUDIT.md](file:///C:/Users/Azan's%20PC/Documents/EduPredict/documentation/PHASE_7E_READINESS_AUDIT.md), running Apache Impala daemons (`impalad`, `statestored`, `catalogd`) and Apache Hadoop daemons natively or via Docker Desktop on this 8 GB RAM host would risk severe memory exhaustion, disk thrashing, or system instability.

The `LocalSQLValidationHarness` solves this constraint by providing:
1. **Structural AST & Column Reference Validation**: Parses and analyzes SQL syntax, table references, CTEs, window functions, and engine-specific functions without executing anything.
2. **Strict ANSI SQL Execution**: Evaluates pure ANSI SQL queries directly against an in-memory SQLite database populated with canonical Lakehouse schemas and representative student records.
3. **Statistical Emulation for Impala-Specific Functions**: Registers Python implementations of Impala's proprietary or statistical aggregate functions (`APPX_MEDIAN`, `STDDEV`, `VARIANCE`) to verify query output schemas, grouping behavior, and arithmetic correctness locally.
4. **Edge-Case & Fault Tolerance Verification**: Tests query execution over empty datasets, nonexistent columns, missing tables, and verifies SQL injection protection.

---

## 2. Analytical Query Validation Matrix

| Query # | Title & Objective | Engine Compatibility | Impala-Specific Features | Local Validation Status | Verified Output Schema |
|:---:|:---|:---:|:---:|:---:|:---|
| **Query 1** | **Average Academic Performance & Pass Rates by Subject**<br>Aggregates mean attendance, study hours, term marks, and overall pass rates. | Executed with Emulation | `STDDEV()` | **PASSED** | `subject`, `academic_year`, `enrolled_students`, `avg_attendance_pct`, `avg_study_hours`, `avg_term1_exam_pct`, `avg_term2_quiz_pct`, `avg_final_exam_pct`, `stddev_final_exam`, `pass_rate_pct` |
| **Query 2** | **Attendance Velocity vs. Final Academic Results**<br>Segments students into attendance tiers and evaluates grade correlations. | Pure ANSI | None (`CASE WHEN`, `GROUP BY 1`) | **PASSED** | `attendance_tier`, `total_students`, `group_avg_attendance`, `group_avg_study_hours`, `group_avg_final_marks`, `high_risk_count`, `high_risk_rate_pct` |
| **Query 3** | **Top-Performing Students Across Curriculum**<br>Identifies top 10 scholars per discipline using window analytical ranking. | Pure ANSI (SQLite 3.25+) | Window functions (`DENSE_RANK() OVER (PARTITION BY ...)`), CTE (`WITH RankedScholars AS ...`) | **PASSED** | `rank_in_subject`, `student_code`, `subject`, `attendance_percentage`, `study_hours_per_week`, `final_exam_marks` |
| **Query 4** | **Early Warning Detection: Declining Performance**<br>Detects students whose evaluation marks degraded across consecutive terms ($G_1 > G_2 > G_3$). | Pure ANSI | None (Relational predicates & arithmetic) | **PASSED** | `student_code`, `subject`, `term1_exam_pct`, `term2_quiz_pct`, `final_exam_pct`, `total_grade_decline`, `attendance_percentage`, `study_hours_per_week`, `failures`, `academic_status` |
| **Query 5** | **Longitudinal Term-Wise Performance Trajectory**<br>Measures cohort migration and percentage of improving students. | Pure ANSI | None (`AVG(CASE ...)`, grouping) | **PASSED** | `subject`, `cohort_size`, `term1_mean`, `term2_mean`, `final_term_mean`, `net_trajectory_delta`, `pct_students_improved` |
| **Query 6** | **Subject-Level Performance Distribution**<br>Computes statistical quantiles (median) and dispersion metrics. | Executed with Emulation | `APPX_MEDIAN()`, `STDDEV()`, `VARIANCE()` | **PASSED** | `subject`, `sample_size`, `min_score`, `mean_score`, `median_score`, `max_score`, `std_dev`, `variance_val` |
| **Query 7** | **Data Quality Audit: Anomalous Records**<br>Scans for data integrity anomalies violating academic domain boundaries. | Pure ANSI | None (`CASE` rules, complex `WHERE` predicates) | **PASSED** | `student_code`, `subject`, `attendance_percentage`, `final_exam_marks`, `absences`, `study_hours_per_week`, `anomaly_type` |

---

## 3. Impala vs. Local SQL Engine Differences & Limitations

| Capability | Apache Impala (Production) | Local SQL Harness (Development) | Impact / Mitigation |
|:---|:---|:---|:---|
| **Underlying Data Storage** | Distributed Apache Parquet on HDFS / Cloud Storage | In-memory SQLite table | The harness uses the exact same table schema (`student_academic_records`) and field names as the Parquet export. |
| **Approximate Median (`APPX_MEDIAN`)** | Uses an approximate quantile estimation algorithm optimized for petabyte-scale data | Exact sorted median computed via Python aggregate callback | For local tests with sample datasets, exact median yields correct statistical baselines. |
| **Dispersion Functions (`STDDEV`, `VARIANCE`)** | Distributed parallel sample standard deviation and variance | Bessel's-corrected ($n-1$) sample variance and stddev registered as SQLite aggregates | In strict mode (`allow_emulation=False`), these functions are flagged as requiring Impala. In emulation mode (`allow_emulation=True`), queries execute locally. |
| **Catalog Directives (`USE edupredict_lakehouse;`)** | Switches Hive Metastore database context | Filtered out during query catalog loading | Session-level catalog commands are decoupled from SQL statement execution. |
| **Execution Architecture** | Distributed MPP engine compiling queries to LLVM machine code across cluster nodes | Single-threaded in-memory C SQLite engine | Verified local execution confirms relational query structure and output schemas without cluster overhead. |

---

## 4. Parameter Sanitization & Injection Protection

The harness provides `LocalSQLValidationHarness.sanitize_filter_parameter(param_name, value, allowed_values)`.

- **Whitelist Enforcement**: Categorical parameters (such as `subject`) are strictly validated against authorized lists (e.g., `["Mathematics", "Portuguese Language"]`).
- **Signature Detection**: Rejects classic SQL injection patterns including `UNION`, `DROP`, `SELECT`, `--`, `;`, `/* ... */`, and unbalanced single quotes (`'`).
- **Input Type Guarding**: Explicitly rejects `None` or non-string inputs that could bypass string validation.

Automated regression tests in `tests/test_sql_validation_harness.py` verify that malicious payloads (e.g. `Mathematics' OR '1'='1`, `Mathematics; DROP TABLE ...`) are caught and raise clear `ValueError` exceptions before any query execution.

---

## 5. Verification Commands

### Run Focused SQL Validation Harness Suite:
```powershell
.\.venv\Scripts\pytest.exe tests/test_sql_validation_harness.py -v
```

### Run Full Backend Test Suite:
```powershell
.\.venv\Scripts\pytest.exe tests/ -v
```
