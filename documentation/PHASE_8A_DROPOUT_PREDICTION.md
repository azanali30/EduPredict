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

### 3.2 Preprocessing, Missing-Value Imputation & Feature Mapping Audit
- **Numerical Features** (18 variables: admission grades, previous qualification grades, age at enrollment, curricular units credited/enrolled/evaluated/approved/graded, macroeconomic indicators):
  - Imputation: `SimpleImputer(strategy='median')`
  - Scaling: `StandardScaler()`
- **Nominal Categorical Features** (10 variables: marital status, application mode, course, qualifications, occupations):
  - Imputation: `SimpleImputer(strategy='most_frequent')`
  - Encoding: `OneHotEncoder(handle_unknown='ignore', sparse_output=False)`
- **Binary Features** (8 variables: daytime/evening, displaced, special needs, debtor, tuition up-to-date, gender, scholarship holder, international):
  - Imputation: `SimpleImputer(strategy='most_frequent')`
- **Output Dimensionality**: 242 encoded feature columns.

#### Missing-Value Imputation Behavior
- **Features Subject to Missingness**: Any of the 36 UCI input features may be `NaN`/`None` at inference time. In particular, when scoring EduPredict `academic_records` via `map_academic_record_to_features()`, all uncollected demographic, financial (`Tuition fees up to date`, `Debtor`, `Scholarship holder`), and macroeconomic (`Unemployment rate`, `Inflation rate`, `GDP`) fields are explicitly passed as `NaN` rather than fabricated.
- **How Statistics Are Learned**: All `SimpleImputer` medians (for the 18 numerical columns) and modes (`most_frequent` for the 10 nominal categorical and 8 binary columns) are learned exclusively from the 3,539 UCI training records during `Pipeline.fit()`.
- **Inference Handling**: During `predict_proba()`, `SimpleImputer.transform()` substitutes the learned UCI training-set median or mode for each `NaN` column.
- **Limitation**: Substituting Portuguese polytechnic training-set medians/modes for uncollected local fields does **not** measure local socioeconomic or financial risk factors and therefore does **not** establish predictive accuracy for EduPredict's local student population.

#### Academic Feature-Mapping Assumptions & Approximations
When mapping EduPredict `academic_records` into UCI features inside `DropoutService.map_academic_record_to_features()`:
1. **Assignment Completion → Approved Curricular Units**: `assignment_completion_rate` (0–100%) is approximated as an approved-unit ratio (`round(6 * completion_rate / 100)`). Assignment submission rate is an engagement proxy, not a verified count of passed university courses.
2. **Reuse Across Both Semesters**: Both `Curricular units 1st sem (approved/grade/evaluations)` and `Curricular units 2nd sem (approved/grade/evaluations)` receive the same mapped values from a single term's `AcademicRecord`, because EduPredict's `AcademicRecord` schema does not separate 1st-semester vs. 2nd-semester transcript histories.
3. **Six Enrolled Units Assumption**: `Curricular units 1st sem (enrolled)` and `Curricular units 2nd sem (enrolled)` are fixed at `6` units per semester, matching the median full-time load in the UCI dataset rather than reading actual credit registrations.

These mappings are **heuristic approximations**, not direct measurements of actual transcript records, and must never be presented as verified institutional academic records.

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
- `map_academic_record_to_features()`: Maps only genuinely observed EduPredict academic indicators (`previous_exam_marks`, `assignment_completion_rate`, `attendance_percentage`, `quiz_average`) to defensible UCI curricular/grade features. Uncollected demographic, financial, and macroeconomic fields remain `NaN`/`None` and are never fabricated. Missing required indicators return a validation error (`422`) rather than silent defaults.
- `evaluate_student_features()`: Validates features, enforces leakage guard, loads cached calibrated model, preserves unobserved fields via pipeline imputation, generates risk/protective factors strictly from observed features, and records the exact `features_snapshot` used for inference.
- `record_student_assessment()`: Validates RBAC, organization scope, and subject/term alignment; evaluates student (from explicit payload or MongoDB `academic_records`); upserts to MongoDB; records audit event via `log_event()`.
- `get_student_assessment()`: Enforces self-only access for students, active subject/enrollment/term-scoped access for teachers, organization-scoped access for admin, and `403 Forbidden` for analyst. Returns `422` if no valid academic record exists rather than fabricating a risk score.
- `get_teacher_roster_dropout()`: Enforces exact `(subject_id, academic_term)` active assignment and enrollment matching plus organization isolation; skips unassessed students without academic records.
- `get_admin_overview()`: Organization-scoped distribution, total assessed, and UCI holdout benchmark disclosures.
- `get_analyst_overview()`: Organization-scoped macro distributions with Statistical Disclosure Control (SDC) conservative $N < 5$ cell suppression and complementary partition masking; zero student PII.

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

## 7. Ethical Governance, Disclaimer & Mandatory Human Review

All predictions carry the immutable system disclaimer:
> **"Experimental Early-Warning Benchmark — Not Yet Validated on Local Institutional Outcomes."**  
> *"Early-warning estimate designed solely for proactive academic support; requires human review by authorized advisors before taking any intervention."*

Predictions must never be represented as confirmed student dropout outcomes, and the system strictly forbids automated punitive actions:
- No automatic suspension or disqualification.
- No automatic alteration of academic standing or enrollment records.
- No unapproved communication to external parties.
- Transparent explainability through key risk factors and protective indicators derived solely from genuinely observed features.
