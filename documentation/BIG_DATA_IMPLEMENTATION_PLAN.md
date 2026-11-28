# EduPredict – Big Data & Advanced Analytics Implementation Plan

## 1. Overview
This implementation plan outlines the concrete technical strategy for integrating Apache Hadoop (HDFS), Apache Impala, Tableau, RStudio, Apache Web Server, Batch Processing, and Real-Time Event Streaming into EduPredict.

---

## 2. Integrated Data Architecture & Component Exchange Flow

```
+---------------------------------------------------------------------------------------------+
|                                     INCOMING DATA SOURCES                                   |
|  - Real-Time Campus Events (Quiz scores, Attendance scans, Study logs)                      |
|  - Bulk Historical Academic Datasets (Multi-year, Multi-department student archives)        |
+------------------------------+---------------------------------------+----------------------+
                               |                                       |
                   [Stream / HTTP POST]                     [Bulk Ingestion / ETL]
                               v                                       v
+----------------------------------------------+ +----------------------------------------------+
|          OPERATIONAL STREAM & OLTP           | |             BIG DATA ANALYTICAL LAKE         |
|  - Flask Application Backend                 | |  - HDFS Storage Layer (/user/edupredict/...) |
|  - Real-Time Event Streamer (SSE/Workers)    | |  - Partitioned Parquet & Clean CSV Archives  |
|  - MongoDB 6.x (Running on port 27017)       | |  - Historical Batch Raw & Processed Data     |
|    * users, records, predictions, logs       | +----------------------+-----------------------+
+----------------------+-----------------------+                        |
                       |                                                |
               [Export / Sync]                                 [Interactive SQL Query]
                       |                                                |
                       +-------------------> + <------------------------+
                                             |
                                             v
                      +----------------------------------------------+
                      |             ANALYTICS & QUERY LAYER          |
                      |  - Apache Impala SQL Engine / Query Bridge   |
                      |  - Python Parallel Batch Processor           |
                      |  - Scikit-Learn Predictive Model Engine      |
                      +----------------------+-----------------------+
                                             |
                                 [Insights & Visualizations]
                                             v
                      +----------------------------------------------+
                      |         CONSUMPTION & PRESENTATION TIER      |
                      |  1. Student / Teacher / Admin Dashboards     |
                      |     (Flask + Bootstrap 5 + Chart.js)         |
                      |  2. Enterprise Executive BI (Tableau .twb)   |
                      |  3. Statistical Research (Jupyter & RStudio) |
                      |  4. Production Gateway (Apache HTTP Server)  |
                      +----------------------------------------------+
```

---

## 3. Concrete Module Implementation Plans

### Module 1: Apache Hadoop & HDFS Lake Storage
- **Directory Structure in Repo**: `data/hdfs_lake/` and `backend/services/bigdata/hdfs_service.py`
- **Design**:
  - Emulates and interfaces with HDFS directory naming conventions:
    `/user/edupredict/data_lake/academic_records/year=YYYY/semester=SS/cohort=CC/`
  - Supports both **Local Partitioned Data Lake** storage and remote **WebHDFS REST client** (`requests` / `pyarrow.fs.HadoopFileSystem`).
  - Allows bulk export from MongoDB into the HDFS lake format for archival and big-data queries.
- **Deliverables**:
  - `backend/services/bigdata/hdfs_service.py`
  - `scripts/export_to_hdfs.py`
  - `docker-compose.bigdata.yml` (Optional standalone cluster definition).

### Module 2: Apache Impala Analytical Engine
- **Directory Structure in Repo**: `sql/impala/` and `backend/services/bigdata/impala_service.py`
- **Design**:
  - High-performance analytical queries designed for Impala MPP syntax:
    - `01_create_academic_lake_tables.sql`: External table DDL with Parquet/CSV format mappings and partition clauses.
    - `02_cohort_risk_olap_queries.sql`: Complex multi-dimensional aggregations (e.g., risk distribution by study-hour deciles, subject failure correlation).
  - Python query executor that supports native Impala connection (`impyla` / Thrift) when an Impala server is active, with an embedded columnar query fallback to ensure tests run natively on the Windows developer machine.
- **Deliverables**:
  - Complete SQL DDL & query files.
  - Python query engine service with automated benchmark timings.

### Module 3: Tableau Business Intelligence Integration (Implemented & Export-Verified)
- **Implemented Modules in Repo**: `tableau/EduPredict_Analytics_Workbook.twb`, `backend/services/bigdata/tableau_export_service.py`, `backend/routes/tableau_routes.py`, `frontend/src/pages/admin/AdminReports.tsx`
- **Design**:
  - Live non-PII export APIs (`GET /api/tableau/datasets`, `GET /api/tableau/export/<dataset>?format=csv|json`) generating standardized, formula-safe Tableau datasets (`academic_performance`, `subject_trends`, `attendance_summary`, `dropout_risk_summary`, `demand_forecast_summary`, `anomaly_summary`) with server-side `N < 5` Statistical Disclosure Control (SDC) for Analysts and zero PII across all exports.
  - Pre-configured XML **Tableau Workbook specification** (`tableau/EduPredict_Analytics_Workbook.twb`) defining 5 datasources, 5 worksheets, and an institutional dashboard ready for Tableau Desktop / Public (external desktop software; not executed headlessly in CI).
  - Interactive UI action in `AdminReports.tsx`: `"Export Tableau CSV"` download buttons per dataset.
- **Deliverables**:
  - `tableau/EduPredict_Analytics_Workbook.twb`
  - `documentation/TABLEAU_INTEGRATION_GUIDE.md`

### Module 4: Jupyter & RStudio Data Science Workflows (Implemented & Executed)
- **Implemented Modules in Repo**: `notebooks/`, `analytics/r/`
- **Design**:
  - **Jupyter Notebooks**:
    - `notebooks/eda_academic_performance.ipynb`: Exploratory data analysis across 1,044 cleaned UCI records, distributions, and risk factors.
    - `notebooks/02_model_training_and_evaluation.ipynb`: Reproducible 20-section ML training & evaluation workflow (M0/M1/M2 Regression & Classification CV + Holdout, confusion matrices, predicted-vs-actual diagnostics, feature importances, dropout holdout benchmark, anomaly check, and non-overwrite production integrity verification), executed cleanly via Jupyter `nbconvert`.
  - **R Statistical Validation**:
    - `analytics/r/statistical_validation.R` and `analytics/r/statistical_summary_output.txt`: Native R hypothesis testing, Welch t-tests, ANOVA, and Pearson correlations.

### Module 5: Real-Time Event Streaming & Parallel Batch Processing (Implemented & Benchmarked)
- **Implemented Modules in Repo**: `backend/services/event_streamer.py`, `backend/routes/stream_routes.py`, `backend/services/batch_processor.py`, `scripts/benchmark_batch_processing.py`
- **Design**:
  - **Real-Time Streaming**: Idempotent HTTP event ingestion (`/api/stream/ingest`, `/api/stream/status`, `/api/stream/events`, `/api/stream/retry/<id>`) updating `stream_events` and `academic_records` safely.
  - **Parallel Batch Processing**: Standalone read-only benchmark script (`scripts/benchmark_batch_processing.py`) comparing Sequential vs `ThreadPoolExecutor` vs `ProcessPoolExecutor` timing, throughput (records/sec), speedup, and `tracemalloc` peak heap on configurable worker/record counts without mutating MongoDB or `.joblib` files.
- **Deliverables**:
  - `backend/services/event_streamer.py` + `backend/services/batch_processor.py`
  - `scripts/benchmark_batch_processing.py`

### Module 6: Production Web Tier (Apache HTTP Server Configuration)
- **Implemented Modules in Repo**: `deployment/httpd.conf`, `deployment/wsgi.py`
- **Design**:
  - Reverse-proxy VirtualHost and mod_wsgi entry configuration prepared for Linux/Apache production hosting (runtime multi-node deployment unverified on local single-host Windows).
- **Deliverables**:
  - `deployment/httpd.conf`
  - `deployment/wsgi.py`
