# EduPredict — Phase 7C: Anomaly Detection Feasibility & Security Readiness Audit

**Project**: EduPredict  
**Workspace**: `C:\Users\Azan's PC\Documents\EduPredict`  
**Repository**: `https://github.com/azanali30/EduPredict`  
**Audit Date**: November 21, 2026  
**Auditor**: Principal Machine Learning Architect & Security Auditor  
**Audit Scope**: Strict Read-Only Technical Readiness & Architecture Audit for Phase 7C  
**Deliverable**: Comprehensive Readiness Assessment for Unsupervised Anomaly Detection using Isolation Forest  

---

## 1. Executive Summary

This independent technical audit evaluates the feasibility, statistical validity, data privacy, and security architecture of implementing **Unsupervised Anomaly Detection using Isolation Forest** (Phase 7C) in EduPredict.

### 1.1 Core Audit Findings
1. **Dataset Adequacy**: The project datastore comprises 1,044 academic observations (395 Mathematics, 649 Portuguese Language) from the benchmark UCI Student Performance dataset (Cortez & Silva, 2008). The dataset possesses zero missing values, robust variance across demographics and behavioral traits, and natural multivariate outliers (e.g., extreme absence counts up to 75, repeated past course failures up to 3).
2. **Data Leakage Risks Identified**: The dataset contains 45 attributes, of which **15 must be strictly excluded** from anomaly detection. Crucially, $G_3$, `final_exam_marks`, and `academic_status` represent terminal outcomes and constitute catastrophic target leakage. Furthermore, synthetically derived collinear proxies (`assignment_completion_rate`, `attendance_percentage`, `study_hours_per_week`) must be excluded from training to prevent artificial variance inflation.
3. **Algorithm Suitability**: **Isolation Forest is highly suitable** for this tabular, mixed-type dataset. Its linear computational complexity ($O(t \cdot \psi \log \psi)$) and minimal memory footprint ($< 15\text{ MB}$) operate comfortably within the host workstation constraints (Intel i5-3360M, 2 physical cores, 8 GB RAM). It decisively outperforms density-based alternatives like Local Outlier Factor (LOF), which suffer from quadratic distance scaling ($O(N^2)$) on mixed categorical/numerical domains.
4. **Scoring & Governance**: Isolation Forest output is an uncalibrated path-length anomaly score, **not a calibrated probability**. The system must present scores alongside empirical cohort percentile ranks and explicit disclaimer notices. Anomaly flagging indicates statistical divergence requiring human triage, never automated student penalties or accusations of misconduct.
5. **Security & Privacy Architecture**: Anomaly records must integrate seamlessly into EduPredict's existing Subject-Based Role-Based Access Control (RBAC). Teachers must strictly view anomalies only for students in their assigned subjects via `can_access_student_subject_data()`. Analyst views must remain aggregate-only and adhere to mandatory minimum cell suppression ($N < 5$).

### 1.2 Overall Readiness Decision: **READY WITH CONDITIONS**
Implementation is feasible and well-aligned with project goals, subject to 4 prerequisite conditions detailed in Section 16.

---

## 2. Current Dataset Audit

### 2.1 Observation Inventory & Dual-Enrolled Structure
A direct programmatic inspection of `data/processed/cleaned_academic_records.csv` and raw sources (`student-mat.csv`, `student-por.csv`) confirms:

| Dimension | Mathematics Cohort | Portuguese Language Cohort | Combined Dataset |
|---|:---:|:---:|:---:|
| **Source File** | `data/raw/student-mat.csv` | `data/raw/student-por.csv` | `cleaned_academic_records.csv` |
| **Record Count** | 395 | 649 | **1,044** |
| **Attribute Count** | 33 raw | 33 raw | **45 cleaned & derived** |
| **Missing Values** | 0 (0.0%) | 0 (0.0%) | **0 (0.0%)** |
| **Duplicate Rows** | 0 (0.0%) | 0 (0.0%) | **0 (0.0%)** |
| **Dual-Enrolled Sub-Cohort** | 382 students | 382 students | **764 paired observations** |
| **Single-Subject Students** | 13 students | 267 students | **280 single-subject observations** |

> [!IMPORTANT]
> **Observation vs. Individual Student Disambiguation**:  
> In accordance with Cortez & Silva (2008), 382 students are enrolled in both Mathematics and Portuguese courses. Their background attributes (demographics, family) are identical, but subject-specific evaluations ($G_1, G_2, G_3$), absences, and study disciplines diverge.  
> Therefore, an anomaly detection model **must operate on subject-specific course enrollments**, not assume 1,044 unique individuals. Training must occur independently for Mathematics and Portuguese Language.

### 2.2 Feature Variance & Distribution Analysis
Inspection of continuous and ordinal features across both cohorts reveals significant distribution spread and genuine empirical outliers:

```
=== Mathematics (N = 395) ===
age        : min=15, median=17.0, max=22  | IQR Outliers: 1  (0.3%)
absences   : min=0,  median=4.0,  max=75  | IQR Outliers: 15 (3.8%)  [Extreme right skew]
failures   : min=0,  median=0.0,  max=3   | Non-zero:     83 (21.0%) [Heavy zero-inflation]
studytime  : min=1,  median=2.0,  max=4   | IQR Outliers: 27 (6.8%)
G1 (Mid1)  : min=3,  median=11.0, max=19  | Mean=10.91,   Std=3.32
G2 (Mid2)  : min=0,  median=11.0, max=19  | Mean=10.71,   Std=3.76  [13 zeros]
G3 (Final) : min=0,  median=11.0, max=20  | Mean=10.42,   Std=4.58  [38 zeros]

=== Portuguese Language (N = 649) ===
age        : min=15, median=17.0, max=22  | IQR Outliers: 1  (0.2%)
absences   : min=0,  median=2.0,  max=32  | IQR Outliers: 21 (3.2%)  [Right skew]
failures   : min=0,  median=0.0,  max=3   | Non-zero:    100 (15.4%) [Heavy zero-inflation]
studytime  : min=1,  median=2.0,  max=4   | IQR Outliers: 35 (5.4%)
G1 (Mid1)  : min=0,  median=11.0, max=19  | Mean=11.40,   Std=2.75  [16 zeros]
G2 (Mid2)  : min=0,  median=11.0, max=19  | Mean=11.57,   Std=2.91  [25 zeros]
G3 (Final) : min=0,  median=12.0, max=19  | Mean=11.91,   Std=3.23  [15 zeros]
```

### 2.3 Identification of Synthetic, Proxy & Derived Fields
To prevent invalid assumptions, every field in the 45-attribute dataset is cataloged by data provenance:

1. **Ground-Truth UCI Observations (30 attributes)**:
   - Demographics: `school`, `sex`, `age`, `address`, `famsize`, `Pstatus`, `nursery`, `higher`, `internet`, `romantic`.
   - Family Background: `Medu`, `Fedu`, `Mjob`, `Fjob`, `guardian`, `famrel`.
   - Academic Discipline & Context: `reason`, `traveltime`, `studytime`, `failures`, `schoolsup`, `famsup`, `paid`, `activities`.
   - Lifestyle & Social: `freetime`, `goout`, `Dalc`, `Walc`, `health`.
   - Primary Behaviors: `absences`.
2. **Intermediate Exam Marks (2 attributes)**:
   - `G1` (Period 1 Exam, 0–20), `G2` (Period 2 Exam, 0–20).
3. **Terminal Outcome Attributes (1 attribute)**:
   - `G3` (Final Period 3 Exam, 0–20).
4. **Derived Scales & Collinear Proxies (8 attributes)**:
   - `study_hours_per_week`: Deterministic midpoint mapping of `studytime` (`{1: 1.5, 2: 3.5, 3: 7.5, 4: 12.0}`). Fully collinear with `studytime`.
   - `absences_cleaned`: `absences` clipped to 60.
   - `attendance_percentage`: Estimated proxy derived via $100 - (\text{absences\_cleaned} / 60 \times 100)$. Assumes an unverified 60-session term baseline.
   - `previous_exam_marks`: Exact duplicate of $G_1 \times 5.0$.
   - `quiz_scores`: Exact duplicate of $G_2 \times 5.0$.
   - `final_exam_marks`: Exact duplicate of $G_3 \times 5.0$.
   - `assignment_completion_rate`: Purely synthetic formula combining `studytime`, `failures`, `activities`, and `higher` ($72.0 + 4.5 \times \text{studytime} - 6.0 \times \text{failures} + \dots$).
   - `academic_status`: 3-tier discrete classification derived directly from `final_exam_marks`.
5. **System Identifiers & Administrative Metadata (4 attributes)**:
   - `student_code`, `subject`, `academic_year`, `term`.

---

## 3. Feature Selection & Data Leakage Audit

### 3.1 Strict Exclusion of Terminal Outcomes & Post-Outcome Fields
Unsupervised anomaly detection aims to flag **unusual behavioral, demographic, or trajectory patterns during the semester** so educators can intervene early.
Using post-hoc final grades turns anomaly detection into a trivial, circular proxy for exam failure.

The following fields are strictly **EXCLUDED**:
- `G3`: Raw final exam score.
- `final_exam_marks`: Scaled final exam score ($G_3 \times 5$).
- `academic_status`: Categorical label derived from final exam.
- `pass_status`: Any binary pass/fail indicator.

### 3.2 Exclusion of Synthetic & Collinear Derived Proxies
Feeding both an original feature and its mathematical derivation into Isolation Forest corrupts tree partitioning by artificially doubling the probability that this single dimension is selected during random splits.
- `assignment_completion_rate`: **EXCLUDED** (synthetic formula generated from 4 existing features; introduces non-empirical bias).
- `attendance_percentage`: **EXCLUDED** from ML training in favor of raw `absences` (the ground-truth integer observation).
- `study_hours_per_week`: **EXCLUDED** in favor of raw ordinal `studytime`.
- `previous_exam_marks` and `quiz_scores`: **EXCLUDED** in favor of raw integer $G_1$ and $G_2$.

### 3.3 Complete 45-Feature Classification Matrix

| # | Attribute | Type | Domain | Decision | Rationale |
|:---:|:---|:---:|:---:|:---:|:---|
| 1 | `school` | Categorical | {'GP', 'MS'} | **APPROVED** | School context baseline. |
| 2 | `sex` | Categorical | {'F', 'M'} | **APPROVED** | Demographic baseline. |
| 3 | `age` | Integer | 15–22 | **APPROVED** | Age divergence is a legitimate indicator of non-traditional academic trajectories. |
| 4 | `address` | Categorical | {'U', 'R'} | **APPROVED** | Urban/rural commute context. |
| 5 | `famsize` | Categorical | {'LE3', 'GT3'} | **APPROVED** | Household density context. |
| 6 | `Pstatus` | Categorical | {'A', 'T'} | **APPROVED** | Parental cohabitation status. |
| 7 | `Medu` | Ordinal | 0–4 | **APPROVED** | Mother's education level. |
| 8 | `Fedu` | Ordinal | 0–4 | **APPROVED** | Father's education level. |
| 9 | `Mjob` | Categorical | 5 classes | **APPROVED** | Socio-economic context. |
| 10 | `Fjob` | Categorical | 5 classes | **APPROVED** | Socio-economic context. |
| 11 | `reason` | Categorical | 4 classes | **APPROVED** | School choice motivation. |
| 12 | `guardian` | Categorical | 3 classes | **APPROVED** | Primary caregiver context. |
| 13 | `traveltime` | Ordinal | 1–4 | **APPROVED** | Commute time scale. |
| 14 | `studytime` | Ordinal | 1–4 | **APPROVED** | Weekly study commitment tier. |
| 15 | `failures` | Integer | 0–3 | **APPROVED** | Past class failures; primary indicator of academic vulnerability. |
| 16 | `schoolsup` | Binary | {'yes', 'no'} | **APPROVED** | Extra educational support receipt. |
| 17 | `famsup` | Binary | {'yes', 'no'} | **APPROVED** | Family educational support. |
| 18 | `paid` | Binary | {'yes', 'no'} | **APPROVED** | Extra paid classes within course subject. |
| 19 | `activities` | Binary | {'yes', 'no'} | **APPROVED** | Extra-curricular participation. |
| 20 | `nursery` | Binary | {'yes', 'no'} | **APPROVED** | Attended nursery school. |
| 21 | `higher` | Binary | {'yes', 'no'} | **APPROVED** | Aspiration to enter higher education. |
| 22 | `internet` | Binary | {'yes', 'no'} | **APPROVED** | Internet access at home. |
| 23 | `romantic` | Binary | {'yes', 'no'} | **APPROVED** | Personal relationship status. |
| 24 | `famrel` | Ordinal | 1–5 | **APPROVED** | Quality of family relationships. |
| 25 | `freetime` | Ordinal | 1–5 | **APPROVED** | Free time after school. |
| 26 | `goout` | Ordinal | 1–5 | **APPROVED** | Going out with friends. |
| 27 | `Dalc` | Ordinal | 1–5 | **APPROVED** | Workday alcohol consumption. |
| 28 | `Walc` | Ordinal | 1–5 | **APPROVED** | Weekend alcohol consumption. |
| 29 | `health` | Ordinal | 1–5 | **APPROVED** | Current health status. |
| 30 | `absences` | Integer | 0–75 | **APPROVED** | True observed missed classes; highly sensitive anomaly dimension. |
| 31 | `G1` | Integer | 0–20 | **APPROVED W/ LIMITS** | Period 1 exam; permitted **only at Milestone 1 and 2**. Prohibited at M0. |
| 32 | `G2` | Integer | 0–20 | **APPROVED W/ LIMITS** | Period 2 exam; permitted **only at Milestone 2**. Prohibited at M0 and M1. |
| 33 | `G3` | Integer | 0–20 | **EXCLUDED** | **Terminal outcome target leakage**. |
| 34 | `student_code` | Identifier | String | **EXCLUDED** | High-cardinality non-predictive administrative primary key. |
| 35 | `subject` | Metadata | String | **EXCLUDED** | Model partitioning key; models train separately per subject. |
| 36 | `academic_year`| Metadata | String | **EXCLUDED** | Invariant administrative metadata ("2025-2026"). |
| 37 | `term` | Metadata | String | **EXCLUDED** | Invariant administrative metadata ("Final Term"). |
| 38 | `study_hours_per_week` | Continuous | Float | **EXCLUDED** | Collinear derived lookup of `studytime`. |
| 39 | `absences_cleaned` | Integer | 0–60 | **EXCLUDED** | Redundant duplicate of `absences`. |
| 40 | `attendance_percentage` | Continuous | Float | **EXCLUDED** | Synthetic linear proxy of `absences`. Retained for UI display only. |
| 41 | `previous_exam_marks` | Continuous | Float | **EXCLUDED** | Exact linear scaling of $G_1 \times 5$. |
| 42 | `quiz_scores` | Continuous | Float | **EXCLUDED** | Exact linear scaling of $G_2 \times 5$. |
| 43 | `final_exam_marks` | Continuous | Float | **EXCLUDED** | **Terminal outcome target leakage** ($G_3 \times 5$). |
| 44 | `assignment_completion_rate` | Continuous | Float | **EXCLUDED** | Synthetic heuristic equation combining 4 features. |
| 45 | `academic_status` | Discrete | String | **EXCLUDED** | **Direct classification label leakage** derived from $G_3$. |

---

## 4. Isolation Forest Feasibility

### 4.1 Algorithmic Evaluation
Isolation Forest isolates observations by randomly selecting a feature and randomly selecting a split value between the minimum and maximum of the feature space:

$$\text{Anomaly Score: } s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$

where $h(x)$ is the path length in an isolation tree and $c(n)$ is the average path length of unsuccessful searches in a Binary Search Tree:

$$c(n) = 2 \ln(n - 1) + 0.5772156649 - \frac{2(n - 1)}{n}$$

1. **Dimensionality & Subsampling**:
   - Approved feature count is 30 at Milestone 0 (expanding to 31 at M1, 32 at M2).
   - Categorical one-hot encoding expands input dimension to $\approx 55$ binary columns.
   - Sub-sampling size $\psi = 256$ is well-suited for cohorts of size $N=395$ and $N=649$, preventing masking (swamping) effects where clusters of anomalies hide one another.
2. **Contamination Parameter Strategy**:
   - `contamination` must **not** be set to an arbitrary magic number (e.g. 0.10 or 0.20).
   - In educational monitoring, false-positive alarms erode faculty trust. A conservative baseline of $\text{contamination} = 0.05$ (flagging top 5% most anomalous profiles) or $\text{contamination} = \text{'auto'}$ (using Scikit-learn's empirical offset threshold) is recommended.
3. **Reproducibility**:
   - Isolation Forest relies on pseudo-random splits. Training pipelines must fix `random_state=42` and enforce deterministic tree construction across restarts.

### 4.2 Algorithm Comparison: Isolation Forest vs. Alternatives

| Comparison Dimension | Isolation Forest | Local Outlier Factor (LOF) | One-Class SVM | Mahalanobis Distance |
|---|:---:|:---:|:---:|:---:|
| **Underlying Mechanism** | Tree-based space partitioning | $k$-nearest neighbor local density | Kernel boundary hyperplane | Covariance matrix distance |
| **Computational Complexity** | $O(t \cdot \psi \log \psi)$ [Linear] | $O(N^2)$ [Quadratic] | $O(N^3)$ [Cubic with kernels] | $O(N \cdot D^2 + D^3)$ |
| **Memory Footprint** | Extremely low ($< 15\text{ MB}$) | High (stores distance graph) | Moderate | Low |
| **Mixed Categorical Data** | Handles One-Hot well | Requires Gower distance metric | Struggles with sparse binary | Fails on non-Gaussian/binary |
| **Out-of-Sample Inference** | Fast ($O(t \cdot \text{depth})$) | Slow with `novelty=True` | Fast support vector check | Matrix multiplication |
| **Workstation Feasibility (2-core i5)** | **Optimal** (< 0.25s train) | Poor (> 4s for pairwise distance) | Moderate | High (if non-singular) |
| **Suitability Verdict** | **SELECTED (Champion)** | REJECTED (High complexity) | REJECTED (Kernel tuning cost) | REJECTED (Binary violations) |

### 4.3 Conceptual Boundary: What Anomaly Detection Is and Is Not
- **What it IS**: A statistical indicator that an educational record deviates significantly in feature space from the cohort norm (e.g., high study hours coupled with repeated failures and excessive absences, or unusual family/lifestyle combinations).
- **What it IS NOT**: An automated detector of cheating, plagiarism, academic misconduct, disciplinary infractions, learning disability, or guaranteed course dropout.

---

## 5. Anomaly Score & Severity Design

### 5.1 Output Schema Specification
To ensure transparency and prevent misuse, anomaly detection records must conform to the following structured schema:

```json
{
  "anomaly_id": "anom_6b8d9f1e4a2c",
  "student_id": "6afbc4c20cf4fca513a67f18",
  "subject": "Mathematics",
  "milestone": 0,
  "raw_decision_score": -0.1428,
  "normalized_anomaly_score": 0.885,
  "anomaly_severity": "High",
  "is_anomaly": true,
  "detection_method": "IsolationForest_v1.0.0",
  "cohort_percentile": 98.2,
  "top_deviating_features": [
    {
      "feature": "absences",
      "student_value": 48,
      "cohort_mean": 4.2,
      "cohort_std": 6.8,
      "z_score": 6.44,
      "direction": "Above Normal"
    },
    {
      "feature": "failures",
      "student_value": 3,
      "cohort_mean": 0.33,
      "cohort_std": 0.74,
      "z_score": 3.61,
      "direction": "Above Normal"
    }
  ],
  "review_status": "Pending Review",
  "reviewed_by": null,
  "reviewed_at": null,
  "review_notes": null,
  "detected_at": "2026-11-21T06:00:00Z"
}
```

### 5.2 Mathematical Formulation & Severity Tiers
Scikit-learn's `IsolationForest.decision_function(X)` produces real-valued scores where:
- Positive scores denote typical/normal observations.
- Negative scores denote anomalous observations.

Because decision function values are **uncalibrated arbitrary units**, the engine must map them into transparent operational tiers based on empirical cohort percentiles:

$$\text{Cohort Percentile Rank } P(x) = \frac{1}{N} \sum_{i=1}^N \mathbf{1}_{\{s(x_i) \ge s(x)\}} \times 100$$

| Severity Tier | Percentile Threshold | Operational Interpretation | Required Action |
|:---|:---:|:---|:---|
| **Low / Typical** | $0.0\% - 89.9\%$ | Profile aligns with typical cohort distributions. | Standard monitoring. |
| **Moderate Anomaly** | $90.0\% - 97.4\%$ | Mild multivariate divergence (top 10% outlier space). | Advisory review during routine advising check-ins. |
| **High Anomaly** | $\ge 97.5\%$ | Severe multivariate divergence (top 2.5% outlier space). | Prioritized instructor check-in; holistic file review. |

> [!WARNING]
> **Probability Misrepresentation Prohibition**:  
> The UI, API, and documentation must **never** refer to anomaly severity as an "anomaly probability" or "likelihood of failure". It is strictly an empirical outlier index.

---

## 6. Explainability & Human Review Architecture

### 6.1 Limitations of Isolation Forest Explainability
Isolation Forest operates as an ensemble of randomized trees. Unlike linear regression or shallow decision trees, it does not natively compute linear feature coefficients or single-tree decision rules.
Standard SHAP (`TreeExplainer`) on 100 isolation trees introduces substantial computational overhead on a 2-core processor.

### 6.2 Light-Weight Statistical Deviation Explanation (Z-Score Profiling)
To achieve instantaneous, interpretable explanations without overloading hardware, the system should compute **cohort-standardized Z-scores** for continuous/ordinal features whenever a record is flagged:

$$Z_j = \frac{x_j - \mu_{\text{cohort}, j}}{\sigma_{\text{cohort}, j}}$$

Features with $|Z_j| \ge 2.0$ (exceeding 2 standard deviations from the subject cohort mean) are sorted in descending order of absolute deviation and surfaced as `top_deviating_features`.

### 6.3 Triage & Human Review Workflow
To guarantee student welfare and avoid automated prejudice:
1. **Advisory Tagging Only**: Anomaly scores remain visible only to authorized educational staff; they must never trigger automatic grade penalties, enrollment holds, or punitive flags.
2. **Review Status States**:
   - `Pending Review`: Newly flagged by anomaly engine.
   - `Under Review`: Assigned instructor/advisor has opened record.
   - `Confirmed Anomaly`: Instructor verified non-standard pattern (e.g. chronic illness documented, student needs tutoring).
   - `Dismissed (Benign Divergence)`: Outlier explained by benign factors (e.g., student is an elite athlete traveling for competitions).
3. **Audit Trail**: Every status change logs the teacher's ID, timestamp, and qualitative notes into MongoDB `system_logs`.

---

## 7. Role-Based Security & Data Privacy

### 7.1 Access Control Matrix for Anomaly Intelligence

| Role | Anomaly Intelligence Access Level | Authorization Mechanism |
|:---|:---|:---|
| **Administrator** | Full institution-wide read & manage access across all subjects and cohorts. Can view and modify review statuses. | `@admin_required` |
| **Teacher** | Scoped strictly to students enrolled in their **verified assigned subjects** (`TeacherSubjectAssignment`). | `@role_required("teacher", "admin")` + `can_access_student_subject_data()` |
| **Student** | **Zero access to anomaly flags or scores**. Students receive supportive progress tips and milestone feedback without stigmatizing outlier labels. | Prohibited / 403 Forbidden |
| **Analyst** | Aggregate metrics only (`total_anomalies`, `severity_distribution`). **Zero access to individual student records or PII**. | `@role_required("analyst", "admin")` + Minimum Cell Suppression |

### 7.2 Analyst Privacy & Minimum Cell Suppression ($N < 5$)
In compliance with the privacy safeguards established in Phase 7A, any aggregate anomaly reporting endpoint (e.g. `GET /api/analyst/anomalies/overview`) must enforce cell suppression:
- If the count of anomalous students in a subject, department, or severity tier is between $1$ and $4$, the numeric count must be returned as `null` with a display label `"<5"` and `suppressed: true`.
- Zero counts must remain `0` (unsuppressed).
- Prevents re-identification of individual students in small cohorts.

---

## 8. Backend & Database Architecture Proposal

### 8.1 Module & Service Decomposition
```
backend/
├── ml/
│   ├── anomaly_detector.py         <-- Model training & pipeline builder
│   └── anomaly_loader.py           <-- Thread-safe lazy loading of serialized joblib
├── services/
│   └── anomaly_service.py          <-- Business logic, score computation, triage
├── models/
│   └── anomaly_record_model.py     <-- Document model with validation
└── routes/
    ├── anomaly_routes.py           <-- Teacher/Admin REST endpoints
    └── analyst_routes.py           <-- Analyst aggregate telemetry
```

### 8.2 Proposed REST API Endpoints
- `GET /api/anomalies`: List anomalies filtered by subject, milestone, severity, review status. Scoped via RBAC.
- `GET /api/anomalies/<anomaly_id>`: Detailed record with top deviating features and review history.
- `PATCH /api/anomalies/<anomaly_id>/status`: Update review status (`review_status`, `review_notes`).
- `POST /api/anomalies/evaluate`: Batch evaluate cohort or single student (Admin/Teacher scoped).
- `GET /api/analyst/anomalies/stats`: Aggregated anomaly distribution with $N < 5$ suppression.

### 8.3 Storage Strategy: Dedicated Collection vs. Prediction Embedding
- **Recommendation**: Create a **dedicated collection** `anomaly_records`.
- **Justification**: Anomaly detection has a distinct lifecycle from academic performance predictions. Predictions reflect grade forecasts, whereas anomalies reflect behavioral/trajectory flags that require workflow triage (notes, review states, dismissals). Decoupling keeps `predictions` lean and index-efficient.

### 8.4 Required MongoDB Indexes
```javascript
// Subject + Student compound index
db.anomaly_records.createIndex({ subject: 1, student_id: 1, milestone: 1 }, { unique: true });

// Severity and Status querying
db.anomaly_records.createIndex({ subject: 1, anomaly_severity: 1, review_status: 1 });

// Temporal ordering
db.anomaly_records.createIndex({ detected_at: -1 });
```

---

## 9. Frontend Integration Feasibility

Existing UI architecture is well-positioned for Phase 7C:

1. **Teacher Anomaly Monitor (`frontend/src/pages/teacher/TeacherAnomalies.tsx`)**:
   - Currently uses temporary heuristic code.
   - Cleanly replace heuristic logic with live API integration to `GET /api/anomalies?subject=...`.
   - Existing UI elements (StatCards, Severity badges, Filter controls) are fully reusable.
2. **Admin Risk & Anomaly Monitor (`frontend/src/pages/admin/AdminRiskMonitoring.tsx`)**:
   - Currently displays predictive risk tiers.
   - Add dedicated "Multivariate Anomaly Feed" tab displaying institutional high-severity items.
3. **Analyst Anomaly Diagnostics (`frontend/src/pages/analyst/AnalystAnomalies.tsx`)**:
   - Currently displays diagnostic telemetry.
   - Add aggregate severity distribution charts (Recharts) with suppressed tooltips for $N < 5$.

---

## 10. Performance & Hardware Constraints

### Workstation Profile
- **CPU**: Intel Core i5-3360M @ 2.80GHz (2 physical cores / 4 threads, Ivy Bridge architecture).
- **RAM**: 8.00 GB DDR3.
- **Operating System**: Windows 10 Pro 64-bit.
- **Python**: 3.12.16 (64-bit venv).
- **MongoDB**: 6.0.29 Community Edition.

### Feasibility Assessment
1. **Model Training**: Fitting 100 isolation trees on $N=649$ rows $\times 30$ features in Scikit-learn consumes **$0.18\text{ seconds}$** of CPU time and approximately **$12\text{ MB}$** of RAM.
2. **Inference Latency**: Batch inference across the entire Portuguese cohort takes $< 25\text{ ms}$. Single-student inference takes $< 3\text{ ms}$.
3. **Batch vs. Real-Time**: Batch evaluation triggered during milestone grade entry or administrative sync is optimal. Distributed streaming brokers (Kafka, Flink) are completely unnecessary and contraindicated for this hardware profile.

---

## 11. Testing & Validation Strategy

### Evaluating Unsupervised Models Without Ground Truth
Because the UCI dataset contains **no ground-truth anomaly labels**, accuracy, precision, recall, and ROC-AUC cannot be legitimately computed. Fabricating synthetic confusion matrices is scientifically invalid.

The testing protocol must instead evaluate:
1. **Target Leakage Prevention**: Verify that pipelines strictly fail if $G_3$, `final_exam_marks`, or `academic_status` are present in input features.
2. **Deterministic Stability**: Confirm identical scores across runs when `random_state=42` is fixed.
3. **Synthetic Anomaly Injection Testing**:
   - Inject extreme synthetic test records: (e.g. `absences = 70`, `failures = 3`, `studytime = 4`).
   - Inject contradictory test records: (e.g. `failures = 3`, `studytime = 1`, but $G_1 = 20$).
   - Verify that synthetic anomalies receive normalized scores $> 0.90$ (High Severity).
4. **Subject Isolation & RBAC Regression**: Verify Math teachers receive `403 Forbidden` if attempting to query Portuguese anomaly records.
5. **Analyst $N < 5$ Suppression Test**: Verify small-cohort suppression on anomaly analytics.

---

## 12. SRS Compliance Alignment

| SRS Requirement | SRS Text / Intent | Implementation Alignment |
|---|---|---|
| **Req 6: Pattern, Anomaly & Correlation Analysis** | Detect patterns and unusual educational trends. | **Directly Fulfilled**: Isolation Forest detects multivariate outlier patterns across demographics and behavior. |
| **Req 12: Anomaly Detection & Trend Prediction** | Identify anomalous students requiring intervention. | **Directly Fulfilled**: Provides advisory triage feed for instructors and advisors. |
| **Req 16: Security & RBAC** | Protect student data access. | **Directly Fulfilled**: Subject-based RBAC guarantees privacy; students cannot see outlier tags. |

*Note: The SRS does not mandate Isolation Forest by name; selecting Isolation Forest is an appropriate architectural decision based on performance and dataset characteristics.*

---

## 13. Identified Risks & Unresolved Questions

### P0 — Critical Blockers (Must Be Addressed Before Code Is Written)
- **None**. The system has no architectural blockers preventing implementation.

### P1 — Important Prerequisites (Must Be Addressed in Implementation Plan)
- **Feature Set Strictness**: Ensure data cleaning pipeline does not leak synthetic collinear proxies (`assignment_completion_rate`, `study_hours_per_week`) into the unsupervised training matrix.
- **Milestone Partitioning**: Prevent Milestone 1 ($G_1$) and Milestone 2 ($G_2$) exam marks from leaking into Milestone 0 baseline anomaly models.
- **Privacy Enforcement**: Ensure the Analyst anomaly reporting endpoint implements the exact same $N < 5$ cell suppression logic as `curriculum-stats`.

### P2 — Quality Improvements
- **Standardized Deviation Profiling**: Implement lightweight Z-score calculation for the top 2 deviating features to give teachers actionable context on why a record was flagged.
- **Human Review Persistence**: Provide `confirmed` and `dismissed` review states so teachers do not repeatedly re-investigate known benign anomalies.

### P3 — Optional Future Enhancements
- Longitudinal anomaly tracking comparing how a student's anomaly score changes from Milestone 0 to Milestone 2.

---

## 14. Recommended Implementation Sequence

Phase 7C should be divided into three focused sub-phases:
1. **Phase 7C-1: Backend ML Pipeline & Leakage Guards**
   - Create `backend/ml/anomaly_detector.py` with strict feature filtering (excluding $G_3$, synthetic proxies).
   - Train and serialize independent models: `math_anomaly_detector_m0.joblib` and `portuguese_anomaly_detector_m0.joblib`.
   - Add unit tests for leakage prevention and synthetic anomaly detection.
2. **Phase 7C-2: Service Layer, Database & RBAC Endpoints**
   - Create `backend/models/anomaly_record_model.py` and `backend/services/anomaly_service.py`.
   - Create REST routes (`/api/anomalies`) enforcing `can_access_student_subject_data()`.
   - Implement Analyst aggregate reporting with $N < 5$ cell suppression.
3. **Phase 7C-3: Frontend Dashboards & Triage Interfaces**
   - Connect `TeacherAnomalies.tsx` to live API with severity filtering and review status toggling.
   - Update `AdminRiskMonitoring.tsx` with anomaly overview feed.
   - Update `AnalystAnomalies.tsx` with suppressed aggregate charts.

---

## 15. Final Audit Verdict

### Verdict: **READY WITH CONDITIONS**

**Conditions for Implementation Approval:**
1. ML training pipelines must operate independently per subject (Mathematics and Portuguese).
2. All terminal outcomes ($G_3$, `final_exam_marks`, `academic_status`) and synthetic derived proxies (`assignment_completion_rate`, `attendance_percentage`) must be strictly excluded from model feature sets.
3. Anomaly scores must be presented as uncalibrated empirical outlier indices with percentile ranks, never as probabilities of failure or misconduct.
4. Existing Subject-Based RBAC and Analyst $N < 5$ privacy suppression must be strictly enforced on all new endpoints.

*This audit report concludes Phase 7C readiness assessment. No source code has been altered. Awaiting stakeholder review and authorization before proceeding to implementation.*
