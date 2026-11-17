# EduPredict – AI-Powered Educational Performance Prediction System

EduPredict is a standalone AI/ML-powered Educational Performance Prediction and Analytics System.

> **Note on Scope**: EduPredict is an academic performance intelligence and early warning analytics platform. It is **not** a generic School Management System, LMS, or fee management software.

---

## Key Capabilities
- **Academic Performance Prediction**: Predict expected percentage and grade range using trained regression models.
- **Academic Risk Detection**: Classify student risk levels (High Risk, Moderate Risk, Low Risk / On Track) using machine learning classification algorithms.
- **Subject-Wise Analysis**: Granular identification of student strengths, weaknesses, and academic bottlenecks.
- **Personalized Recommendations**: Rule- and model-guided actionable improvement steps tailored to individual student performance metrics.
- **Role-Based Access Control**:
  - **Student**: Access personal performance dashboard, predictions, risk level, strengths/weaknesses, and actionable guidance.
  - **Teacher**: Access assigned students, class performance analytics, at-risk alerts, and individual student academic profiles.
  - **Administrator**: Comprehensive system metrics, user role governance, dataset management, and ML model monitoring.

---

## Technology Stack
- **Backend**: Python 3.12, Flask, PyMongo, Flask-Login, Flask-WTF, python-dotenv
- **Database**: MongoDB 6.x (running locally on port 27017, database: `edupredict`)
- **Machine Learning**: Scikit-learn, NumPy, Pandas, Joblib
- **Frontend**: Responsive HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js
- **Testing**: Pytest, pytest-flask

---

## Project Structure
```text
EduPredict/
├── .env                      # Local development secrets (untracked by git)
├── .env.example              # Template environment configuration
├── .gitignore                # Exclusion rules for git (excludes .venv, secrets, cache)
├── requirements.txt          # Python dependencies
├── README.md                 # Project README
├── backend/
│   ├── __init__.py           # Package initializer
│   ├── app.py                # Application factory (create_app)
│   ├── config.py             # Environment configuration (Dev, Test, Prod)
│   ├── extensions.py         # Extensions (PyMongo manager, CSRF, LoginManager)
│   ├── models/               # MongoDB models and schemas
│   ├── routes/               # Modular Flask blueprints (health, auth, etc.)
│   └── services/             # Core business & analytics services
├── data/
│   ├── raw/                  # Raw academic datasets
│   └── processed/            # Preprocessed feature datasets
├── documentation/
│   ├── ARCHITECTURE.md
│   ├── BIG_DATA_IMPLEMENTATION_PLAN.md
│   ├── DEVELOPMENT_LOG.md
│   ├── GITHUB_BACKUP.md
│   ├── PROJECT_OVERVIEW.md
│   ├── TECHNOLOGY_FEASIBILITY.md
│   └── TEST_REPORT.md
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
├── ml_models/
├── notebooks/
└── tests/
    ├── conftest.py
    ├── test_app_factory.py
    ├── test_config.py
    ├── test_health_routes.py
    └── test_mongo_connectivity.py
```

---

## Getting Started

### 1. Environment Setup
The project uses Python 3.12 inside a dedicated virtual environment (`.venv`).
```powershell
# Activate virtual environment (PowerShell)
.\.venv\Scripts\Activate.ps1
```

### 2. Configure Environment
Ensure your local `.env` file exists (copied from `.env.example`):
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

### 3. Run the Application
Start the Flask development server:
```powershell
.\.venv\Scripts\python.exe -m backend.app
```
Access the server at `http://127.0.0.1:5000/`.

Health endpoints:
- `http://127.0.0.1:5000/health` – Lightweight uptime & DB check
- `http://127.0.0.1:5000/api/health` – Detailed system and MongoDB 6 diagnostics
- `http://127.0.0.1:5000/api/health/db` – Dedicated MongoDB connectivity check

### 4. Run Automated Tests
Execute the pytest suite:
```powershell
.\.venv\Scripts\pytest.exe -v
```
