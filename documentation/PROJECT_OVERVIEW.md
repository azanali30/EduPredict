# EduPredict – Project Overview

## 1. Executive Summary
EduPredict is an AI/ML-driven Educational Performance Prediction and Analytics System designed to empower educational stakeholders—Students, Teachers, and Administrators—with predictive insights and early intervention intelligence.

The system addresses critical challenges in modern education:
1. **Late Identification of Academic Risk**: Traditional grading identifies failure after assessments take place. EduPredict predicts risk proactively based on attendance, study habits, assignments, quizzes, and historical exams.
2. **Subject-Specific Weakness Blindspots**: Identifies distinct bottlenecks across academic subjects.
3. **Lack of Actionable Feedback**: Translates raw predictive numbers into personalized, contextual improvement strategies.

EduPredict strictly maintains separation of concerns: it is **not** an LMS, school administration tool, or fee management portal.

---

## 2. Target Personas and User Journeys

### Student
- **Authentication**: Secure registration and login.
- **Academic Profile**: Input and maintain current coursework metrics (attendance, study hours, assignment completion, quiz scores, previous marks).
- **Personal Predictive Insights**: Real-time evaluation of projected score, estimated grade, and risk classification.
- **Diagnostics & Recommendations**: Subject-wise strength/weakness matrix with tailored action points.
- **Progress History**: Visual track record of improvement across academic periods.

### Teacher
- **Classroom Overview**: High-level telemetry of all assigned student cohorts.
- **Early Warning System**: Automated flagging of students at "High" or "Moderate" academic risk.
- **Student Profiling**: Drill down into individual academic indicators without compromising cross-student peer privacy.
- **Intervention Tracking**: Monitor performance trends post-recommendation.

### Administrator
- **Governance & Role Control**: User provisioning, activation, and role assignments (Student, Teacher, Admin).
- **System Telemetry**: Platform usage, audit logs, and overall performance aggregates.
- **Dataset Management**: Ingestion, validation, and curation of academic benchmark datasets.
- **ML Model Management**: Observability of model training metadata, test metrics, and pipeline retraining status.

---

## 3. Core Features & Functional Scope
| Category | Functionality | Primary Technology |
|---|---|---|
| **Security & Auth** | Role-Based Access Control (RBAC), bcrypt hashing, CSRF protection, session management | Flask-Login, Flask-WTF, Werkzeug |
| **Data Storage** | Persistent storage for users, academic records, cohorts, predictions, audit trails | MongoDB 6.x (local instance) |
| **Machine Learning** | Expected Marks Estimation, Risk Classification, Feature Importance | Scikit-learn, Joblib, NumPy, Pandas |
| **Analytics & UI** | Responsive dashboards, interactive trend charts, comparative breakdown | Bootstrap 5, Chart.js, HTML5/CSS3 |
| **Diagnostics & QA** | Automated unit/integration tests, data validation | Pytest |
