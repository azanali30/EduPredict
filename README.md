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
- **Role-Based Access Control (RBAC)**:
  - **Student**: Register, view personal profile, view own predictions, track personal academic progress. Strictly prohibited from accessing peer records.
  - **Teacher**: Access assigned students, review classroom academic indicators, monitor early warning flags. Prohibited from accessing unassigned students.
  - **Administrator**: Comprehensive governance, user directory, role assignments, student-to-teacher mappings, system audit telemetry.
- **Big Data Lakehouse & OLAP Analytics**: Multi-tier HDFS Lakehouse architecture, Apache Impala 3.x/4.x Parquet analytical SQL queries, MongoDB batch upsert pipeline, and native R 4.6.2 inferential hypothesis testing.

---

## Technology Stack
- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS 3.4, Recharts 2.15, PostCSS, Autoprefixer, React Router 6, Lucide React, Modern CSS System
- **Backend**: Python 3.12, Flask 3.1.3, PyMongo 4.20.0, Flask-Login, Flask-WTF, python-dotenv, bcrypt
- **Operational Database**: MongoDB Server 6.0.29 (native service on port 27017, database: `edupredict`)
- **Big Data & OLAP**: HDFS WebHDFS REST API client, Apache Impala MPP SQL query catalog, Apache Parquet
- **Statistical Computing**: Native R 4.6.2 (ANOVA, Welch t-test, Kruskal-Wallis, Pearson correlation)
- **Machine Learning & EDA**: Scikit-learn 1.9.1, NumPy 2.5.5, Pandas 3.1.1, Joblib 1.6.0, Matplotlib, Seaborn, Jupyter Notebook
- **Testing**: Pytest (72 automated tests, 100% passing), pytest-flask, TypeScript compiler (`tsc -b`), Vite production bundler

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
│   ├── models/               # Domain entities (User, AcademicRecord, Assignment, SystemLog)
│   ├── routes/               # Modular Flask blueprints (health, auth, user, admin)
│   └── services/             # Core business & analytics services
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
└── tests/                    # 72 automated unit & integration tests
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
FLASK_DEBUG=1
SECRET_KEY=your_secret_key_here
PORT=5000
HOST=127.0.0.1
MONGO_URI=mongodb://localhost:27017/edupredict
MONGO_DB_NAME=edupredict
```

### 3. Run Data Engineering & Big Data Ingestion (Phase 4)
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

### 4. Train Machine Learning Models (Phase 5A)
Train all 54 candidate pipelines across Mathematics and Portuguese cohorts and export serialized champions:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe backend/ml/train_models.py
```

### 5. Start Application Servers
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

### 6. Run Automated Tests
Execute full backend, data pipeline, and machine learning pytest suite:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\pytest.exe -v
```
*(All 72 tests passing)*

Execute frontend type-checking and production build:
```cmd
cd frontend
npm run build
```
