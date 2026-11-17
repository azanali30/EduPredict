# EduPredict – System Architecture & Technical Design

## 1. Architectural Philosophy
EduPredict is an AI/ML-driven Educational Performance Prediction and Analytics Platform designed using a **Decoupled Modular Architecture**. It combines a responsive web layer, a high-throughput operational NoSQL datastore (MongoDB 6.x), a scalable Big Data analytical lakehouse (HDFS / Impala), an enterprise BI bridge (Tableau), and an extensible machine learning inference engine.

```
                      +-------------------------------------------------------+
                      |                 Presentation & BI Tier                |
                      |  - Web UI: Student, Teacher, Admin (HTML5/Bootstrap5) |
                      |  - Interactive Analytics: Chart.js                    |
                      |  - Enterprise BI: Tableau Public / Desktop (.twb)     |
                      |  - Research Workbenches: Jupyter Notebook & RStudio   |
                      +---------------------------+---------------------------+
                                                  |
                                            HTTP / REST
                                                  v
                      +-------------------------------------------------------+
                      |              Web & Application Gateway                |
                      |  - Apache HTTP Server (Reverse Proxy & Static Cache)  |
                      |  - Flask WSGI Application (Waitress / Gunicorn)       |
                      |  - Authentication & RBAC Guard (@role_required)       |
                      |  - Real-Time Event Streamer (SSE / WebSockets)        |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |                Service Business Tier                  |
                      |  - AuthService & Role Enforcement                     |
                      |  - AcademicRecordService                              |
                      |  - PredictionEngineService & RecommendationService    |
                      |  - ParallelBatchProcessor (Multiprocessing Engine)    |
                      |  - BigDataBridge (HDFS Adapter, Impala OLAP, Tableau) |
                      +-------------------+-------------------+---------------+
                                          |                   |
                        +-----------------+                   +-----------------+
                        v                                                       v
    +---------------------------------------+               +---------------------------------------+
    |         Operational Datastore         |               |          Big Data & ML Layer          |
    |  - MongoDB Server 6.0.29 (Native)     |               |  - HDFS Storage Lake (/user/...)      |
    |  - Collections: users, records,       |               |  - Apache Impala SQL OLAP Queries     |
    |    predictions, system_logs           |               |  - Serialized Scikit-Learn Models     |
    |  - Admin tools: mongosh & Compass     |               |  - Feature Scalers & Encoders         |
    +---------------------------------------+               +---------------------------------------+
```

---

## 2. Component Interaction & Data Flow

1. **OLTP Flow (Operational)**:
   - Student/Teacher inputs academic metrics via Flask Web Interface.
   - Verified via Flask-WTF; stored into **MongoDB 6.x** (`academic_records`).
   - Triggering of `PredictionEngineService`: Scikit-learn models evaluate features, compute predicted grade and risk tier, generate recommendations, and persist in `predictions` collection.
2. **Real-Time Streaming Flow**:
   - Campus academic events (attendance logs, quiz scores) are streamed via `EventStreamerService`.
   - Front-end dashboards receive live updates using Server-Sent Events (SSE).
3. **Big Data Lake & Batch Processing Flow**:
   - Historical student records from MongoDB are exported to the **HDFS Data Lake** in partitioned formats (`/user/edupredict/cohorts/year=YYYY/`).
   - **Parallel Batch Processor** leverages multi-core CPU workers to compute cohort-level statistics.
   - **Apache Impala SQL Engine** runs deep analytical aggregations across the historical lake.
4. **Business Intelligence & Data Science Flow**:
   - **Tableau Export Service** generates denormalized datasets and links directly to `tableau/EduPredict_Analytics_Workbook.twb`.
   - **Jupyter Notebooks** execute reproducible EDA and ML training pipelines.
   - **RStudio Scripts** perform rigorous statistical hypothesis tests (ANOVA, regression diagnostics).

---

## 3. Database Schema Design (MongoDB 6.x)

MongoDB 6.x runs locally on port `27017` with database name `edupredict`.

### Collections:
1. `users`:
   - `_id`: ObjectId
   - `email`: String (Unique index)
   - `password_hash`: String (bcrypt)
   - `full_name`: String
   - `role`: Enum (`student`, `teacher`, `admin`)
   - `assigned_teacher_id`: ObjectId (optional, for students)
   - `student_id_code`: String (optional, unique)
   - `created_at`: DateTime
   - `updated_at`: DateTime

2. `academic_records`:
   - `_id`: ObjectId
   - `student_id`: ObjectId (Indexed)
   - `term`: String
   - `attendance_percentage`: Float (0-100)
   - `study_hours_per_week`: Float
   - `assignment_completion_rate`: Float (0-100)
   - `quiz_average`: Float (0-100)
   - `previous_exam_marks`: Float (0-100)
   - `subject_scores`: Object (e.g., `{"Mathematics": 82, "Science": 74, "English": 88}`)
   - `recorded_at`: DateTime

3. `predictions`:
   - `_id`: ObjectId
   - `student_id`: ObjectId (Indexed)
   - `academic_record_id`: ObjectId (Indexed)
   - `predicted_marks`: Float
   - `predicted_grade`: String (`A`, `B`, `C`, `D`, `F`)
   - `risk_level`: Enum (`LOW`, `MODERATE`, `HIGH`)
   - `risk_probability`: Float
   - `top_contributing_factors`: Array of `{ factor: String, impact: String, value: Any }`
   - `recommendations`: Array of String
   - `model_version`: String
   - `created_at`: DateTime

4. `system_logs`:
   - `_id`: ObjectId
   - `event_type`: String (`AUTH_LOGIN`, `MODEL_INFERENCE`, `BATCH_RUN`, `EXPORT_TABLEAU`, `SECURITY_EVENT`)
   - `user_id`: ObjectId (optional)
   - `details`: Object
   - `timestamp`: DateTime

---

## 4. Big Data Lake & Analytical SQL Schema (HDFS / Impala)

### HDFS Storage Paths:
- `/user/edupredict/raw/academic_records/`
- `/user/edupredict/analytical_lake/cohort_parquet/`

### Impala Analytical External Table:
```sql
CREATE EXTERNAL TABLE IF NOT EXISTS edupredict_lake.student_cohort_analytics (
    student_id STRING,
    cohort STRING,
    academic_year INT,
    attendance_pct DOUBLE,
    study_hours_weekly DOUBLE,
    assignment_rate DOUBLE,
    quiz_avg DOUBLE,
    prev_exam_marks DOUBLE,
    predicted_marks DOUBLE,
    risk_level STRING,
    risk_probability DOUBLE
)
PARTITIONED BY (term STRING)
STORED AS PARQUET
LOCATION '/user/edupredict/analytical_lake/cohort_parquet/';
```

---

## 5. Machine Learning Pipeline Architecture
1. **Regression Task (Expected Marks Estimation)**:
   - Algorithms: Linear Regression, Decision Tree Regressor, Random Forest Regressor.
   - Evaluated using MAE, RMSE, and $R^2$.
2. **Classification Task (Academic Risk Categorization)**:
   - Algorithms: Logistic Regression, Decision Tree Classifier, Random Forest Classifier.
   - Evaluated using Accuracy, Precision, Recall, F1-Score, and ROC-AUC.
3. **Artifact Serialization**:
   - Model pipelines and `StandardScaler` saved via `joblib` in `ml_models/`.
