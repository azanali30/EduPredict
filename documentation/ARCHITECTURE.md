# EduPredict – System Architecture & Technical Design

## 1. Architectural Philosophy
EduPredict is designed following a **Modular Layered Architecture** with strict separation of concerns across presentation, routing, service business logic, data persistence, and machine learning pipelines.

```
                      +---------------------------------------+
                      |       Presentation Layer (Web UI)     |
                      |  - Student Dashboard (Chart.js / CSS) |
                      |  - Teacher Analytics Dashboard        |
                      |  - Admin Console & Dataset View       |
                      +-------------------+-------------------+
                                          |
                                    HTTP / REST
                                          v
                      +---------------------------------------+
                      |       Application / Routing Layer     |
                      |  - Flask Blueprints                   |
                      |  - Authentication & RBAC Guard        |
                      |  - CSRF Protection & Input Validation |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |         Service Business Layer        |
                      |  - AuthService                        |
                      |  - StudentAnalyticsService            |
                      |  - TeacherAnalyticsService            |
                      |  - PredictionEngineService            |
                      |  - RecommendationEngineService        |
                      +-------------------+-------------------+
                                   |             |
                         +---------+             +---------+
                         v                                 v
          +-------------------------------+ +-------------------------------+
          |       Data Access Layer       | |      ML Inference Engine      |
          |  - PyMongo ODM / Client       | |  - Serialized Scikit Models   |
          |  - Document Schema Validation | |  - Preprocessing Scalers      |
          |  - MongoDB 6.x Collections    | |  - Explainability / Weights   |
          +-------------------------------+ +-------------------------------+
```

---

## 2. Directory Layout & Modular Structure
```text
EduPredict/
├── .env.example              # Template environment configuration
├── .gitignore                # Exclusion rules for git (excludes .venv, secrets, cache)
├── requirements.txt          # Python dependencies
├── README.md                 # Project README
├── backend/
│   ├── app.py                # Application factory (create_app)
│   ├── config.py             # Configuration loader from environment variables
│   ├── extensions.py         # Initialized extensions (Mongo, LoginManager, CSRF)
│   ├── models/               # MongoDB schema representations & validation helpers
│   │   ├── user.py
│   │   ├── academic_record.py
│   │   └── prediction_log.py
│   ├── routes/               # Flask Blueprints
│   │   ├── auth_routes.py
│   │   ├── student_routes.py
│   │   ├── teacher_routes.py
│   │   ├── admin_routes.py
│   │   └── api_routes.py
│   └── services/             # Core business & analytics logic
│       ├── auth_service.py
│       ├── ml_service.py
│       ├── recommendation_service.py
│       └── analytics_service.py
├── data/
│   ├── raw/                  # Source CSV/JSON datasets (synthetic/benchmarks)
│   └── processed/            # Cleaned, standardized training matrices
├── documentation/            # Comprehensive documentation
├── frontend/                 # Static assets and UI templates
│   ├── static/
│   │   ├── css/              # Professional SaaS blue theme styling
│   │   └── js/               # Chart.js initialization & dynamic UI logic
│   └── templates/            # Jinja2 templates partitioned by role
├── ml_models/                # Trained model artifacts (.joblib)
├── notebooks/                # Exploratory Data Analysis & training experiments
└── tests/                    # Pytest test suite (unit, integration, security)
```

---

## 3. Database Schema Design (MongoDB 6.x)

MongoDB 6.x runs locally on port `27017` with database name `edupredict`.

### Collections:
1. `users`:
   - `_id`: ObjectId
   - `email`: String (Unique index)
   - `password_hash`: String
   - `full_name`: String
   - `role`: Enum (`student`, `teacher`, `admin`)
   - `assigned_teacher_id`: ObjectId (optional, for students)
   - `student_id_code`: String (optional, unique)
   - `created_at`: DateTime
   - `updated_at`: DateTime

2. `academic_records`:
   - `_id`: ObjectId
   - `student_id`: ObjectId (Indexed)
   - `term` / `academic_period`: String
   - `attendance_percentage`: Float (0-100)
   - `study_hours_per_week`: Float
   - `assignment_completion_rate`: Float (0-100)
   - `quiz_average`: Float (0-100)
   - `previous_exam_marks`: Float (0-100)
   - `subject_scores`: Map of String -> Float (e.g., Mathematics, Science, English, etc.)
   - `recorded_at`: DateTime

3. `predictions`:
   - `_id`: ObjectId
   - `student_id`: ObjectId (Indexed)
   - `academic_record_id`: ObjectId (Indexed)
   - `predicted_marks`: Float
   - `predicted_grade`: String
   - `risk_level`: Enum (`LOW`, `MODERATE`, `HIGH`)
   - `risk_probability`: Float
   - `top_contributing_factors`: Array of `{ factor: String, impact: String, value: Any }`
   - `recommendations`: Array of String
   - `model_version`: String
   - `created_at`: DateTime

4. `system_logs`:
   - Audit trail for admin observability, ML retraining events, authentication security events.

---

## 4. Machine Learning Pipeline Architecture
1. **Data Ingestion & Verification**:
   - Synthetic benchmark dataset representing diverse student profiles with realistic covariance (attendance, study hours, previous scores, quiz averages).
   - Clearly documented as synthetic benchmark data.
2. **Preprocessing**:
   - Outlier detection, range clipping, standard scaling via `StandardScaler`.
3. **Model Selection & Evaluation**:
   - **Regression Task (Expected Marks Estimation)**: Linear Regression, Decision Tree Regressor, Random Forest Regressor. Evaluated using MAE, RMSE, and $R^2$.
   - **Classification Task (Academic Risk Categorization)**: Logistic Regression, Decision Tree Classifier, Random Forest Classifier. Evaluated using Accuracy, Precision, Recall, F1-Score, and ROC-AUC.
4. **Serialization**:
   - Artifacts serialized via `joblib` into `ml_models/`.
5. **Inference & Recommendation**:
   - High-performance cached runtime inference with feature impact analysis for automated personalized improvement suggestions.
