# EduPredict – AI-Powered Educational Performance Prediction System

EduPredict is a standalone AI/ML-powered Educational Performance Prediction and Analytics System.

> **Note on Scope**: EduPredict is an academic performance intelligence and early warning analytics platform. It is **not** a generic School Management System, LMS, or fee management software.

---

## Key Capabilities
- **Academic Performance Prediction**: Predict expected percentage and grade range using trained regression models.
- **Academic Risk Detection**: Classify student risk levels (High Risk, Moderate Risk, Low Risk / On Track) using machine learning classification algorithms.
- **Subject-Wise Analysis**: Granular identification of student strengths, weaknesses, and academic bottlenecks.
- **Personalized Recommendations**: Rule- and model-guided actionable improvement steps tailored to individual student performance metrics.
- **Role-Based Access Control (RBAC)**:
  - **Student**: Register, view personal profile, view own predictions, track personal academic progress. Strictly prohibited from accessing peer records.
  - **Teacher**: Access assigned students, review classroom academic indicators, monitor early warning flags. Prohibited from accessing unassigned students.
  - **Administrator**: Comprehensive governance, user directory, role assignments, student-to-teacher mappings, system audit telemetry.

---

## Technology Stack
- **Backend**: Python 3.12, Flask, PyMongo, Flask-Login, Flask-WTF, python-dotenv, bcrypt
- **Database**: MongoDB 6.x (running locally on port 27017, database: `edupredict`)
- **Machine Learning**: Scikit-learn, NumPy, Pandas, Joblib
- **Frontend**: Responsive HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js
- **Testing**: Pytest, pytest-flask

---

## Database Architecture (MongoDB 6.x)
- `users`: User profiles with unique normalized emails, bcrypt password hashes, and assigned roles (`student`, `teacher`, `admin`).
- `academic_records`: Term-based student metrics (attendance %, study hours, assignment rate, quiz average, previous marks, subject score maps).
- `predictions`: ML prediction outcomes, risk classifications, contributing factor weights, and recommendations.
- `teacher_student_assignments`: Explicit mappings linking students to authorized teachers with unique compound index.
- `system_logs`: Immutable security and administrative audit trail with UTC timestamps.

---

## API Endpoints (Phase 1 & Phase 2)

### Health & Diagnostics
- `GET /`: Application welcome and endpoint index
- `GET /health`: Lightweight uptime and database health probe
- `GET /api/health`: Full system diagnostics (versions, latency, environment)
- `GET /api/health/db`: Dedicated MongoDB connectivity probe
- `GET /api/csrf-token`: Fetch CSRF token for web clients

### Authentication
- `POST /auth/register`: Public student registration (enforces `role='student'`)
- `POST /auth/login`: User session login via Flask-Login
- `POST /auth/logout`: Terminate active session (requires authentication)

### User & Profile Management
- `GET /api/me`: Retrieve current user profile
- `PUT /api/me`: Update personal profile (e.g. `full_name`)
- `PUT /api/me/password`: Secure password change with current password verification
- `GET /api/students/<student_id>`: View student details (enforces student privacy, teacher assignment, or admin access)
- `GET /api/teacher/students`: List students assigned to the authenticated teacher

### Administration
- `GET /api/admin/users`: List system users with optional role filtering
- `PUT /api/admin/users/<user_id>/role`: Promote or reassign user roles
- `POST /api/admin/assignments`: Map a student to a teacher
- `GET /api/admin/logs`: Inspect security and administrative audit logs

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

### 3. Provision Initial Administrator Account
Use the built-in CLI command to create an administrator account without hardcoding credentials:
```powershell
.\.venv\Scripts\flask.exe create-admin --email admin@edupredict.com --name "System Administrator"
```

### 4. Initialize Database Indexes
Initialize collections and unique indexes in MongoDB:
```powershell
.\.venv\Scripts\flask.exe init-db
```

### 5. Run the Application
Start the Flask development server:
```powershell
.\.venv\Scripts\python.exe -m backend.app
```
Access the server at `http://127.0.0.1:5000/`.

### 6. Run Automated Tests
Execute the complete test suite:
```powershell
.\.venv\Scripts\pytest.exe -v
```
