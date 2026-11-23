# EduPredict – AI-Powered Educational Performance Prediction System

EduPredict is a standalone AI/ML-powered Educational Performance Prediction and Analytics System.

> **Note on Scope**: EduPredict is an academic performance intelligence and early warning analytics platform. It is **not** a generic School Management System, LMS, or fee management software.

---

## Key Capabilities
- **Academic Performance Prediction**: Predict expected percentage and grade range using trained regression models.
- **Academic Risk Detection**: Classify student risk levels (High Risk, Moderate Risk, Low Risk / On Track) using machine learning classification algorithms.
- **Subject-Wise Analysis**: Granular identification of student strengths, weaknesses, and academic bottlenecks.
- **Personalized Recommendations**: Rule- and model-guided actionable improvement steps tailored to individual student performance metrics.
- **Modern SaaS Web Interface**: High-performance React 18, TypeScript, and Vite single-page application with responsive layouts for Student, Teacher, and Administrator roles.
- **Role-Based Access Control (RBAC) & Interactive Workspaces**:
  - **Student Workspace**: Register, view personal profile, generate milestone-specific academic predictions (Milestones 0, 1, 2), observe empirical early-warning false-negative disclosures, and inspect prediction audit history. Prohibited from predicting for peers.
  - **Teacher Workspace**: Access assigned learners, review classroom academic indicators, generate AI predictions on behalf of assigned students, monitor cohort risk levels, and receive academic attention alerts. Prohibited from accessing unassigned students.
  - **Administrator Console**: Comprehensive governance, user directory, role assignments, student-to-teacher mappings, system audit telemetry, and real-time AI prediction intelligence analytics.
- **Big Data Lakehouse & OLAP Analytics**: Multi-tier HDFS Lakehouse architecture, Apache Impala 3.x/4.x Parquet analytical SQL queries, MongoDB batch upsert pipeline, and native R 4.6.2 inferential hypothesis testing.

---

## Technology Stack
- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS 3.4, Recharts 2.15, PostCSS, Autoprefixer, React Router 6, Lucide React, Modern CSS System
- **Backend**: Python 3.12, Flask 3.1.3, PyMongo 4.20.0, Flask-Login, Flask-WTF, python-dotenv, bcrypt
- **Operational Database**: MongoDB Server 6.0.29 (native service on port 27017, database: `edupredict`)
- **Big Data & OLAP**: HDFS WebHDFS REST API client, Apache Impala MPP SQL query catalog, Apache Parquet
- **Statistical Computing**: Native R 4.6.2 (ANOVA, Welch t-test, Kruskal-Wallis, Pearson correlation)
- **Machine Learning & EDA**: Scikit-learn 1.9.1, NumPy 2.5.5, Pandas 3.1.1, Joblib 1.6.0, Matplotlib, Seaborn, Jupyter Notebook
- **Testing**: Pytest (227 automated tests, 100% passing across auth, RBAC, ML predictions, SDC anomaly detection, upload security, and production hardening), pytest-flask, Vitest (25 frontend tests passing), TypeScript compiler (`tsc -b`), Vite production bundler

---

## Project Structure
```text
EduPredict/
├── .env                      # Local development secrets (untracked by git)
├── .env.example              # Template environment configuration
├── .gitignore                # Exclusion rules for git (excludes .venv, secrets, node_modules)
├── requirements.txt          # Python dependencies
├── README.md                 # Project README
├── analytics/                # Big Data analytical SQL & statistical scripts
│   ├── hdfs/                 # HDFS Docker Compose testbed configuration
│   ├── impala/               # Impala DDL schema, 7 analytical queries & diagnostic client
│   └── r/                    # Native R 4.6.2 statistical validation script & exported outputs
├── backend/
│   ├── __init__.py           # Package root exposing create_app
│   ├── app.py                # Application factory, user_loader, error handlers
│   ├── config.py             # Environment configuration (Dev, Test, Prod)
│   ├── extensions.py         # Extensions (PyMongo manager, CSRF, LoginManager)
│   ├── commands/             # CLI commands (create-admin, init-db)
│   ├── database/             # MongoDB 6 schema and index governance
│   ├── data_engineering/     # Cleaning, normalization, MongoDB ingestion & HDFS lakehouse manager
│   ├── models/               # Domain entities (User, AcademicRecord, Assignment, SystemLog, PredictionRecord)
│   ├── routes/               # Modular Flask blueprints (health, auth, user, admin, prediction)
│   └── services/             # Core business, analytics & prediction services
├── data/
│   ├── raw/                  # UCI Student Performance raw CSVs (student-mat.csv, student-por.csv)
│   └── processed/            # Cleaned, standardized datasets & machine-readable data dictionary
├── documentation/
│   ├── ARCHITECTURE.md
│   ├── BIG_DATA_IMPLEMENTATION_PLAN.md
│   ├── DATA_DICTIONARY.md
│   ├── DEVELOPMENT_LOG.md
│   ├── GITHUB_BACKUP.md
│   ├── PROJECT_OVERVIEW.md
│   ├── TECHNOLOGY_FEASIBILITY.md
│   └── TEST_REPORT.md
├── frontend/                 # Modern React + TypeScript + Vite Single-Page Application
│   ├── package.json          # Node dependencies and scripts
│   ├── tsconfig.json         # TypeScript strict configuration
│   ├── vite.config.ts        # Vite build & proxy configuration (/auth, /api -> :5000)
│   ├── tailwind.config.js    # Tailwind CSS design system and color palette extension
│   ├── index.html            # HTML5 template
│   └── src/                  # React components, pages, context, and styles
├── ml_models/                # Serialized model artifacts & evaluation reports (Phase 5A)
│   ├── saved_models/         # 12 champion Scikit-learn pipelines (.joblib) & metadata (.json)
│   └── reports/              # Holdout evaluation, cross-validation & confusion matrix reports
├── notebooks/                # Executed Jupyter Notebooks (eda_academic_performance.ipynb)
└── tests/                    # 86 automated unit & integration tests
    ├── conftest.py
    ├── test_admin.py
    ├── test_app_factory.py
    ├── test_auth.py
    ├── test_config.py
    ├── test_data_pipeline.py # Dataset cleaning, MongoDB ingestion & Big Data checks
    ├── test_feature_leakage.py # Leakage guard, attendance proxy & group tests
    ├── test_health_routes.py
    ├── test_ml_models.py     # ML models, milestone restrictions & pipeline tests
    ├── test_models.py
    ├── test_mongo_connectivity.py
    ├── test_prediction_api.py # Prediction REST APIs, RBAC, leakage & safety advisories
    └── test_rbac.py
```

---

## Getting Started

### 1. Environment Setup
The backend uses Python 3.12 inside a dedicated virtual environment (`.venv`), Node.js for the frontend, and native R 4.6.2 for statistical verification.

### 2. Configure Environment
Ensure your local `.env` file exists:
```env
FLASK_APP=backend.app
FLASK_ENV=development
SECRET_KEY=your_development_secret_key_min_32_characters_long
PORT=5000
HOST=127.0.0.1
MONGO_URI=mongodb://localhost:27017/edupredict
MONGO_DB_NAME=edupredict
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000
UPLOAD_FOLDER=backend/uploads
```

### 3. Production Security & Hardening (Phase 7D)
- **Production Secret Validation**: In production (`FLASK_ENV=production`), `create_app()` strictly validates `SECRET_KEY`. It must be set via environment variable, cannot match known default/test keys, and must be at least 32 characters in length; missing or weak keys abort startup.
- **Session & Cookie Protection**: Session cookies enforce `HttpOnly=True`, `SameSite="Lax"`, `Secure=True` in production, with 8-hour lifetime and Flask-Login strong session protection.
- **Upload Security**: Multi-tier file inspection on `/api/upload` enforces extension allowlists, MIME verification, magic byte signature inspection, Pillow raster decoding and re-encoding (stripping polyglots and EXIF), 4096px dimension caps, 5 MB payload limits, server-generated UUID filenames, and path traversal protection.
- **CORS & CSRF**: State-changing requests enforce CSRF tokens via `X-CSRFToken` headers. CORS origins are explicitly allowlisted with credentials; wildcard origins are strictly prohibited.
- **Audit Logging**: Credential scrubbing automatically redacts passwords, tokens, cookies, and secrets from `system_logs`, with CRLF sanitization to prevent log injection.

### 4. Run Data Engineering & Big Data Ingestion (Phase 4)
Clean and standardize the UCI raw datasets:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe backend/data_engineering/clean_dataset.py
```

Ingest cleaned records into MongoDB 6.0 (`analytical_academic_records`):
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe backend/data_engineering/ingest_mongodb.py
```

Run HDFS Lakehouse & Impala connection diagnostics:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe backend/data_engineering/hdfs_lakehouse.py
.\.venv\Scripts\python.exe analytics/impala/impala_query_runner.py
```

Execute Native R 4.6.2 Statistical Hypothesis Testing:
```powershell
& "C:\Program Files\R\R-4.6.2\bin\x64\Rscript.exe" analytics/r/statistical_validation.R
```

### 5. Train Machine Learning Models (Phase 5A)
Train all 54 candidate pipelines across Mathematics and Portuguese cohorts and export serialized champions:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe backend/ml/train_models.py
```

### 6. Start Application Servers
Start Flask Backend (Windows CMD / PowerShell):
```cmd
.\.venv\Scripts\python.exe -m backend.app
```
Flask runs at `http://127.0.0.1:5000/`.

Start Frontend Development Server:
```cmd
cd frontend
npm run dev
```
Vite runs at `http://localhost:5173/` and proxies `/auth` and `/api` requests to `http://127.0.0.1:5000`.

### 7. Run Automated Tests
Execute full backend, data pipeline, ML, and Phase 7D security hardening test suite:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\pytest.exe -v
```
*(All 227 tests passing)*

Execute frontend test suite, type-checking, and production build:
```cmd
cd frontend
npx vitest run
npm run build
```
*(All 25 vitest tests passing, 0 TypeScript errors, clean production bundle)*
