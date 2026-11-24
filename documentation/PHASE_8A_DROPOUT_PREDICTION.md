# EduPredict — Phase 8A: Complete Student Dropout Prediction System

## 1. Executive Summary

Phase 8A implements an empirical, end-to-end **Student Dropout Early Warning System** within EduPredict. Built on genuine higher education retention benchmarks and rigorously validated against data leakage, the system provides calibrated attrition risk scoring, non-punitive supportive interventions, subject-scoped teacher queues, privacy-preserving analyst reporting, and comprehensive institutional oversight.

---

## 2. Dataset Attribution & Integrity (Phase 8A.1)

### 2.1 Genuine Academic Dataset
In accordance with Phase 8A rules prohibiting synthetic or fabricated outcome labels, EduPredict integrates the canonical benchmark dataset for higher education student attrition:
- **Dataset Title**: *Predict Students' Dropout and Academic Success*
- **Source**: UCI Machine Learning Repository (Dataset ID 697)
- **Contributors**: Valentim Real, M. V. Martins, et al. (2021), Polytechnic Institute of Portalegre, Portugal.
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Physical Location**: `data/raw/dropout/data.csv`.

### 2.2 Dataset Dimensions & Target Formulation
- **Total Records**: 4,424 student records.
- **Raw Features**: 36 demographic, socio-economic, enrollment, and curricular performance predictors.
- **Raw Outcomes**:
  - `Graduate`: 2,209 students (49.93%)
  - `Dropout`: 1,421 students (32.12%)
  - `Enrolled`: 794 students (17.95%)
- **Target Formulation**:
  - Primary Operational Target: Binary Dropout Indicator ($y \in \{0, 1\}$).
  - Positive Class ($y = 1$): `Dropout` (1,421 records, 32.12% prevalence).
  - Negative Class ($y = 0$): `Non-Dropout` (`Graduate` or `Enrolled`, 3,003 records, 67.88% prevalence).
  - Operational Justification: In retention early warning systems, active students still enrolled or already graduated represent non-attrition; early identification of students at risk of departure enables proactive academic advising.

---

## 3. Preprocessing & Leakage Prevention (Phase 8A.2)

### 3.1 Strict Leakage Guard
Implemented in `backend/ml/dropout_pipeline.py`:
- `assert_no_dropout_leakage(features)`: Validates that target indicators (`Target`, `is_dropout`, `dropout_status`, `outcome`, `graduation_date`) or post-dropout temporal data are never included in the predictor matrix.
- All curricular evaluations used represent pre-departure terms (1st and 2nd semester units).

### 3.2 Preprocessing ColumnTransformer
- **Numerical Features** (18 variables: admission grades, previous qualification grades, age at enrollment, curricular units credited/enrolled/evaluated/approved/graded, macroeconomic indicators):
  - Imputation: `SimpleImputer(strategy='median')`
  - Scaling: `StandardScaler()`
- **Nominal Categorical Features** (10 variables: marital status, application mode, course, qualifications, occupations):
  - Imputation: `SimpleImputer(strategy='most_frequent')`
  - Encoding: `OneHotEncoder(handle_unknown='ignore', sparse_output=False)`
- **Binary Features** (8 variables: daytime/evening, displaced, special needs, debtor, tuition up-to-date, gender, scholarship holder, international):
  - Imputation: `SimpleImputer(strategy='most_frequent')`
- **Output Dimensionality**: 242 encoded feature columns.

### 3.3 Stratified Partitioning
- 80/20 Stratified Train/Test Split (`random_state=42`):
  - Training Set: 3,539 student records (1,137 dropouts, 2,402 non-dropouts).
  - Test Set: 885 student records (284 dropouts, 601 non-dropouts).
  - Class proportions preserved identically (32.12% positive class).

---

## 4. Model Training & Evaluation (Phase 8A.3 & 8A.4)

### 4.1 Candidate Model Comparison (5-Fold Stratified CV on Training Cohort)
| Candidate Model | CV Mean ROC-AUC | CV Std ROC-AUC | CV Mean F1 | CV Mean Recall | CV Mean Precision |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **LogisticRegression (Balanced)** | **0.9199** | **0.0083** | **0.7846** | **0.8039** | **0.7667** |
| RandomForest (Balanced, max_depth=10) | 0.9099 | 0.0101 | 0.7763 | 0.7828 | 0.7706 |
| HistGradientBoosting (Balanced) | 0.9129 | 0.0076 | 0.7862 | 0.7713 | 0.8019 |

### 4.2 Probability Calibration
To ensure raw decision scores represent true empirical probabilities, the champion model is calibrated via `CalibratedClassifierCV(method='sigmoid', cv=5)`:
- **Brier Score**: `0.0851` (exceptional calibration quality).
- **Holdout Test Set ROC-AUC**: `0.9317`.
- **Holdout Test Set PR-AUC**: `0.9024`.
- **Holdout Precision**: `89.54%` (minimizing false alarms).
- **Holdout Recall**: `75.35%` (capturing true attrition risks).
- **Holdout Specificity**: `95.84%` (protecting on-track students from false identification).

### 4.3 Risk Tiering Boundaries
- **Low Risk**: $P(\text{Dropout}) < 0.30$
- **Moderate Risk**: $0.30 \le P(\text{Dropout}) < 0.60$
- **High Risk**: $P(\text{Dropout}) \ge 0.60$

---

## 5. Backend Architecture & Security (Phase 8A.5)

### 5.1 Document Model & Database Indexes
- Document Model: `backend/models/dropout_record_model.py` (`DropoutRecord`)
- MongoDB 6.x Collection: `dropout_records`
- Indexes initialized in `backend/database/schema.py`:
  - `idx_dropout_student_id`: `student_id` ASCENDING
  - `idx_dropout_risk_tier`: `risk_tier` ASCENDING
  - `idx_dropout_created_at`: `created_at` DESCENDING
  - `idx_dropout_student_created`: `(student_id, created_at)`

### 5.2 Service Layer (`backend/services/dropout_service.py`)
- `evaluate_student_features()`: Validates features, enforces leakage guard, loads cached calibrated model, outputs calibrated probability, risk tier, key factors, and supportive recommendations.
- `record_student_assessment()`: Validates RBAC, evaluates student, upserts to MongoDB, records audit event via `log_event()`.
- `get_student_assessment()`: Enforces self-only access for students, subject-scoped access for teachers, institution-wide for admin, and 403 Forbidden for analyst.
- `get_teacher_roster_dropout()`: Retrieves students actively enrolled in teacher's assigned subjects; returns zero records if unassigned.
- `get_admin_overview()`: Institution-wide distribution, total assessed, and model validation telemetry.
- `get_analyst_overview()`: Macro distributions with Statistical Disclosure Control (SDC) conservative $N < 5$ cell suppression and complementary partition masking; zero student PII.

### 5.3 REST API Endpoints (`backend/routes/dropout_routes.py`)
| Endpoint | Method | Allowed Roles | Description |
| :--- | :---: | :---: | :--- |
| `/api/dropout/predict` | POST | Admin, Teacher | Assess and persist student dropout risk (teacher subject-scoped). |
| `/api/dropout/student/<student_id>` | GET | Student (self), Teacher (assigned), Admin | View individual student assessment; Analyst strictly returns 403. |
| `/api/dropout/teacher/roster` | GET | Teacher, Admin | Paginated roster of dropout assessments for assigned classes. |
| `/api/dropout/admin/overview` | GET | Admin | Institution-wide retention distributions and model performance. |
| `/api/dropout/analyst/overview` | GET | Analyst, Admin | Privacy-suppressed aggregate telemetry ($N < 5$ suppression). |
| `/api/dropout/model-metadata` | GET | Admin | Model version, evaluation metrics, and feature allowlists. |

---

## 6. Frontend Dashboards Integration (Phase 8A.6)

1. **Admin Dashboard (`AdminRiskMonitoring.tsx`)**:
   - Tab: `Student Dropout Early Warning (Phase 8A)`.
   - 4 StatCards: Total Assessed, Low Risk, Moderate Risk, High Risk.
   - Model Calibration Card: Test ROC-AUC (0.9317), Precision (89.5%), Recall (75.4%), PR-AUC (0.9024), Brier Score (0.0851).
   - High-Risk Retention Triage Queue: Student name/ID, calibrated probability %, risk factors, primary recommendation, and Human Review Required badge.
2. **Teacher Dashboard (`TeacherAtRisk.tsx`)**:
   - At-Risk Student cards integrated with Dropout Risk indicator badge: `Dropout: High (72%)`, `Moderate`, or `Low`.
   - Scoped strictly to assigned subjects via `dropoutApi.getTeacherDropoutRoster()`.
   - Supportive intervention recommendations.
3. **Student Dashboard (`StudentRecommendations.tsx`)**:
   - Encouraging "Academic Retention & Degree Progression Support" section.
   - Non-stigmatizing language (`Proactive Support Recommended`, `Degree Progress On Track`).
   - Demonstrated academic strengths / protective factors.
   - Recommended next steps for support (tutoring, advisory hours, study groups).
   - Mandatory human review disclaimer.
4. **Analyst Dashboard (`AnalystRisk.tsx`)**:
   - Empirical Student Dropout Early Warning Analytics Section.
   - Statistical Disclosure Control (SDC) notice.
   - Protected cell rendering (`<5` display) for small partitions.
   - Benchmark diagnostics summary.

---

## 7. Ethical Governance & Mandatory Human Review

All predictions carry the immutable system disclaimer:
> *"Early-warning estimate designed solely for proactive academic support. Requires human review by authorized advisors before taking any intervention."*

The system strictly forbids automated punitive actions:
- No automatic suspension or disqualification.
- No automatic alteration of academic standing or enrollment records.
- No unapproved communication to external parties.
- Transparent explainability through key risk factors and protective indicators.
