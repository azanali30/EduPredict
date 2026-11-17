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

### Module 3: Tableau Business Intelligence Integration
- **Directory Structure in Repo**: `tableau/` and `backend/services/bigdata/tableau_export_service.py`
- **Design**:
  - Generates standardized, denormalized Tableau-ready datasets (`tableau/EduPredict_Tableau_Data.csv`) containing student demographics, normalized performance metrics, predicted risks, and calculated risk factors.
  - Generates a pre-configured **Tableau Workbook specification** (`tableau/EduPredict_Analytics_Workbook.twb`) ready for instant opening in Tableau Desktop or Tableau Public.
  - Interactive UI action in the Admin Dashboard: "Export for Tableau" button delivering real-time generated BI data.
- **Deliverables**:
  - `tableau/EduPredict_Analytics_Workbook.twb`
  - `documentation/TABLEAU_INTEGRATION_GUIDE.md`

### Module 4: Jupyter & RStudio Data Science Workflows
- **Directory Structure in Repo**: `notebooks/` and `scripts/r_analytics/`
- **Design**:
  - **Jupyter Notebooks**:
    - `notebooks/01_exploratory_data_analysis.ipynb`: Data inspection, missing value handling, skewness, outliers, correlation heatmaps.
    - `notebooks/02_model_training_and_evaluation.ipynb`: Regression (Linear, Decision Tree, Random Forest) and Classification (Logistic, Decision Tree, Random Forest) model training, ROC curves, confusion matrices, and feature importance bar charts.
  - **RStudio / R Scripts**:
    - `scripts/r_analytics/academic_hypothesis_testing.R`: Null hypothesis testing ($H_0$: Attendance has no effect on academic risk level), two-way ANOVA, and regression diagnostic plots.
- **Deliverables**:
  - 2 fully executed, reproducible Jupyter Notebooks.
  - Standalone R script with comprehensive statistical commentary.

### Module 5: Real-Time Event Streaming & Parallel Batch Processing
- **Directory Structure in Repo**: `backend/services/event_streamer.py` and `backend/services/batch_processor.py`
- **Design**:
  - **Real-Time Streaming**: Server-Sent Events (SSE) `/api/stream/events` allowing the front-end dashboard to receive live simulated academic events (e.g. attendance scan, quiz submission) and immediately display real-time recalculation of risk.
  - **Parallel Batch Processing**: Multiprocessing pipeline using Python's `ProcessPoolExecutor` that ingests thousands of student records simultaneously, performs parallel feature transformation and batch inference, and benchmarks throughput (records per second).
- **Deliverables**:
  - Event streaming backend endpoint + front-end listener.
  - Batch processor service + performance benchmarking script (`scripts/benchmark_batch_processing.py`).

### Module 6: Production Web Tier (Apache HTTP Server)
- **Directory Structure in Repo**: `apache/`
- **Design**:
  - Production Apache VirtualHost configuration (`apache/httpd-edupredict.conf`) defining:
    - Reverse proxy to WSGI server (`ProxyPass / http://127.0.0.1:5000/`)
    - Static asset directory mapping (`/static/` direct caching)
    - Compression rules (`mod_deflate`) and security headers (`X-Content-Type-Options`, `X-Frame-Options`).
  - Production WSGI entry point (`wsgi.py`).
- **Deliverables**:
  - `apache/httpd-edupredict.conf`
  - `wsgi.py`
