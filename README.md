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

---

## Technology Stack
- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS 3.4, Recharts 2.15, PostCSS, Autoprefixer, React Router 6, Lucide React, Modern CSS System
- **Backend**: Python 3.12, Flask 3.1.3, PyMongo 4.20.0, Flask-Login, Flask-WTF, python-dotenv, bcrypt
- **Database**: MongoDB 6.x (running locally on port 27017, database: `edupredict`)
- **Machine Learning**: Scikit-learn, NumPy, Pandas, Joblib (Phase 4)
- **Testing**: Pytest, pytest-flask, TypeScript compiler (`tsc -b`), Vite build verification

---

## Project Structure
```text
EduPredict/
├── .env                      # Local development secrets (untracked by git)
├── .env.example              # Template environment configuration
├── .gitignore                # Exclusion rules for git (excludes .venv, secrets, node_modules)
├── requirements.txt          # Python dependencies
├── README.md                 # Project README
├── backend/
│   ├── __init__.py           # Package root exposing create_app
│   ├── app.py                # Application factory, user_loader, error handlers
│   ├── config.py             # Environment configuration (Dev, Test, Prod)
│   ├── extensions.py         # Extensions (PyMongo manager, CSRF, LoginManager)
│   ├── commands/             # CLI commands (create-admin, init-db)
│   ├── database/             # MongoDB 6 schema and index governance
│   ├── models/               # Domain entities (User, AcademicRecord, Assignment, SystemLog)
│   ├── routes/               # Modular Flask blueprints (health, auth, user, admin)
│   └── services/             # Core business & analytics services
├── frontend/                 # Modern React + TypeScript + Vite Single-Page Application
│   ├── package.json          # Node dependencies and scripts
│   ├── tsconfig.json         # TypeScript strict configuration
│   ├── vite.config.ts        # Vite build & proxy configuration (/auth, /api -> :5000)
│   ├── tailwind.config.js    # Tailwind CSS design system and color palette extension
│   ├── postcss.config.js     # PostCSS pipeline for Tailwind & Autoprefixer
│   ├── index.html            # HTML5 template
│   └── src/
│       ├── main.tsx          # Application entry point
│       ├── App.tsx           # React Router and route guards
│       ├── types/            # TypeScript interfaces and domain types
│       ├── services/         # Centralized API service with CSRF & credential handling
│       ├── context/          # Centralized AuthContext (login, register, session restore)
│       ├── styles/           # Premium SaaS design system (Navy blue, card elevation)
│       ├── components/       # Reusable components (Navbar, Sidebar, StatCards, Forms)
│       ├── layouts/          # AuthLayout and DashboardLayout
│       ├── pages/            # Role-partitioned pages (Student, Teacher, Admin, Auth)
│       └── routes/           # ProtectedRoute with RBAC guards
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
├── ml_models/
├── notebooks/
└── tests/
    ├── conftest.py
    ├── test_admin.py
    ├── test_app_factory.py
    ├── test_auth.py
    ├── test_config.py
    ├── test_health_routes.py
    ├── test_models.py
    ├── test_mongo_connectivity.py
    └── test_rbac.py
```

---

## Getting Started

### 1. Environment Setup
The backend uses Python 3.12 inside a dedicated virtual environment (`.venv`), and the frontend uses Node.js.

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

### 3. Start Backend Server (Windows CMD / PowerShell)
```cmd
.\.venv\Scripts\python.exe -m backend.app
```
Flask runs at `http://127.0.0.1:5000/`.

### 4. Start Frontend Development Server (Windows CMD)
```cmd
cd frontend
npm run dev
```
Vite runs at `http://localhost:5173/` and automatically proxies `/auth` and `/api` requests to `http://127.0.0.1:5000`.

### 5. Run Automated Tests
Execute backend pytest suite:
```powershell
.\.venv\Scripts\pytest.exe -v
```

Execute frontend type-checking and production build:
```cmd
cd frontend
npm run build
```
