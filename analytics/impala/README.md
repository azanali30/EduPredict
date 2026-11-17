# Apache Impala Big Data Analytical Engine – EduPredict

## Overview
This directory contains production DDL and analytical SQL queries designed for Apache Impala over Parquet-formatted datasets in the EduPredict Lakehouse architecture.

Impala is an open-source, massively parallel processing (MPP) SQL query engine running natively on Apache Hadoop. In EduPredict, Impala is specified for high-concurrency, low-latency ad-hoc SQL analytics over structured educational performance data stored in Apache Parquet format on HDFS or Cloud Object Storage.

---

## Hardware & Architecture Constraints on Host
- **Host OS**: Windows 10 Pro (x64)
- **Host RAM**: 8 GB (Intel Core i5-3360M)
- **Impala Footprint**: Standard Impala daemons (`impalad`, `statestored`, `catalogd`) require a minimum of 4–8 GB dedicated RAM and a 64-bit Linux kernel. Running these daemons natively or inside Docker Desktop on this 8GB RAM development machine alongside MongoDB, Flask, Vite, and development tools would lead to host thrashing, severe OOM swapping, or blue-screen panics.
- **Verification Strategy**: The client runner `impala_query_runner.py` actively probes the standard Hive/Impala port (`21050`), confirms socket status, validates all DDL and query syntax against standard Impala 3.x/4.x specifications, and documents the connection status cleanly and honestly.

---

## Directory Structure
- `01_create_academic_lakehouse_tables.sql`: DDL statements defining the `edupredict_lakehouse` database, external staging CSV table, and compressed columnar Parquet production tables (`academic_performance_fact`, `academic_features_parquet`).
- `02_analytical_queries.sql`: 7 production-grade analytical SQL queries utilizing MPP window functions, aggregate rollups, trajectory detection, and percentile approximations.
- `impala_query_runner.py`: Diagnostic runner and client dispatcher for testing Impala socket connectivity and dispatching queries via Thrift/HiveServer2.

---

## Analytical Query Catalog
1. **Query 1 (Subject Performance & Pass Rates)**: Aggregates total students, mean final scores (0–20 and 0–100 scaled), average absences, standard deviation, and pass rate percentage grouped by subject.
2. **Query 2 (Attendance Velocity & Academic Correlations)**: Bins absence counts into risk bands (`0-4 days: Optimal`, `5-9 days: Mild`, `10-19 days: Moderate`, `20+ days: Severe Chronic Absence`) and computes pass rates and mean grade trajectories across terms.
3. **Query 3 (Top Scholars via Window Analytic Ranking)**: Utilizes `DENSE_RANK() OVER (PARTITION BY subject ORDER BY g3_final_grade DESC, attendance_rate DESC)` to identify top 10 scholars per discipline.
4. **Query 4 (Early Warning Trajectory Detection)**: Detects students whose academic trajectory is actively declining between Term 1 (`g1_term1_grade`) and Term 3 (`g3_final_grade`) by at least 3 points, flagging students requiring targeted intervention.
5. **Query 5 (Longitudinal Term-Wise Trend)**: Tracks term progression ($G_1 \rightarrow G_2 \rightarrow G_3$) and average attendance across both school cohorts (`GP` vs. `MS`).
6. **Query 6 (Dispersion & Percentile Distribution)**: Utilizes Impala `APPX_MEDIAN()` and statistical dispersion functions to report subject distributions across percentiles.
7. **Query 7 (Data Quality & Integrity Audit)**: Flags data anomalies (out-of-bounds grades $<0$ or $>20$, negative absences, inconsistent calculated final percentages).

---

## Execution Guide on Linux/Docker Cluster

To run these queries on an Impala cluster or containerized testbed:

```bash
# 1. Connect via Impala Shell
impala-shell -i <impala-daemon-host>:21050

# 2. Execute DDL script
impala-shell -i <impala-daemon-host>:21050 -f 01_create_academic_lakehouse_tables.sql

# 3. Refresh metadata cache
impala-shell -i <impala-daemon-host>:21050 -q "INVALIDATE METADATA edupredict_lakehouse.academic_performance_fact;"

# 4. Execute analytical queries
impala-shell -i <impala-daemon-host>:21050 -d edupredict_lakehouse -f 02_analytical_queries.sql
```
