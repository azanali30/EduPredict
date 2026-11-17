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
- **Backend**: Python 3.12, Flask, PyMongo / Flask-PyMongo, Flask-Login, Flask-WTF
- **Database**: MongoDB 6.x (running locally on port 27017)
- **Machine Learning**: Scikit-learn, NumPy, Pandas, Joblib
- **Frontend**: Responsive HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js
- **Testing**: Pytest

---

## Project Structure
```text
EduPredict/
├── .gitignore
├── .env.example
├── requirements.txt
├── README.md
├── backend/
│   ├── app.py
│   ├── models/
│   ├── routes/
│   └── services/
├── data/
│   ├── raw/
│   └── processed/
├── documentation/
│   ├── PROJECT_OVERVIEW.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT_LOG.md
│   ├── TEST_REPORT.md
│   └── GITHUB_BACKUP.md
├── frontend/
│   ├── index.html
│   ├── css/
│   └── js/
├── ml_models/
├── notebooks/
└── tests/
```

---

## Getting Started
### 1. Environment Setup
The project uses Python 3.12 inside a dedicated virtual environment (`.venv`).
```bash
# Activate virtual environment (PowerShell)
.\.venv\Scripts\Activate.ps1
```

### 2. Database Connection
Ensure MongoDB 6.x service is running locally (`localhost:27017`).
Create a `.env` file based on `.env.example`:
```env
FLASK_APP=backend.app
FLASK_ENV=development
SECRET_KEY=your_secret_key_here
MONGO_URI=mongodb://localhost:27017/edupredict
PORT=5000
```
