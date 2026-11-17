# EduPredict – Project Overview

## 1. Executive Summary
EduPredict is an AI/ML-driven Educational Performance Prediction, Risk Classification, and Big Data Analytics Platform. It bridges predictive artificial intelligence with institutional big-data analytics to provide early warning signals, actionable learning recommendations, and executive-level academic telemetry.

EduPredict is **not** a generic School Management System, LMS, or billing portal. Its focus is strictly on **predictive academic intelligence, risk diagnostics, and institutional data analytics**.

---

## 2. Core Functional Scope & Technology Map

| Category | Functionality | Primary Technology | Aptech Mapping |
|---|---|---|---|
| **Operational Store** | User management, session storage, private student profiles, real-time predictions | MongoDB 6.0.29 (Native Service) | MongoDB 6.x |
| **Database Tooling** | Graphical inspection, migration verification, indexing | MongoDB Compass & `mongosh` | Compass & Shell |
| **Big Data Lake** | Historical archive of multi-year academic datasets | HDFS Lake Format & WebHDFS Service | Apache Hadoop & HDFS |
| **Analytical Querying** | Massively Parallel Processing (MPP) SQL analytics over cohort data | Apache Impala DDL/Queries & Python OLAP Engine | Apache Impala |
| **Web Gateway** | Production reverse proxy, static caching, WSGI server | Apache HTTP Server config (`httpd.conf`) + Flask | Apache Server |
| **Predictive ML** | Performance regression, risk classification, feature importance | Scikit-learn, NumPy, Pandas, Joblib | Machine Learning |
| **Data Science & EDA** | Interactive exploratory analysis, statistical distributions | Jupyter Notebooks (`notebooks/`) | Jupyter / Anaconda |
| **Statistical Validation** | Hypothesis testing, ANOVA, statistical significance | RStudio / Standalone R scripts (`scripts/r_analytics/`) | RStudio |
| **Enterprise BI** | Executive academic reporting, interactive BI dashboards | Tableau Public / Desktop (.twb workbook & exports) | Tableau |
| **Processing Models** | Parallel cohort scoring & real-time campus event streaming | Multiprocessing (`concurrent.futures`) & SSE streaming | Batch & Real-Time |
| **Front-End SaaS** | Role-partitioned student, teacher, and administrator dashboards | HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js | Web UI / UX |
| **Quality & QA** | Automated unit, integration, and security test suites | Pytest | Testing |

---

## 3. User Roles and Separation of Concerns

### Student
- Secure authentication.
- Private academic record input (attendance, study hours, assignment rate, quiz scores, previous marks, subject grades).
- View predicted results and risk level (Low, Moderate, High).
- Diagnostic breakdown of strong vs. weak subjects.
- Personalized, actionable improvement recommendations.
- Historical progress tracking over time.

### Teacher
- Secure instructor dashboard.
- Roster of assigned students.
- Class-wide performance and risk distribution analytics.
- Automated at-risk student early warning flags.
- Drill-down into individual student indicators.

### Administrator
- User provisioning and role assignment.
- System-wide telemetry, performance metrics, and audit logs.
- Dataset management and HDFS / Tableau export triggers.
- ML model performance tracking and retraining pipeline controls.
- Impala OLAP analytical query runner.
