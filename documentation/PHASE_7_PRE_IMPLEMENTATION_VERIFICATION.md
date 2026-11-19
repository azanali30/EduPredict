# EduPredict — Phase 7 Pre-Implementation Verification & Architecture Assessment (Revised)

**Project**: EduPredict  
**Workspace**: `C:\Users\Azan's PC\Documents\EduPredict`  
**Phase**: Pre-Phase 7 Architectural & Data Verification (Revision 2)  
**Audit Type**: Read-Only Pre-Implementation Audit & Architecture Specification  
**Author**: Senior Software Architect & Educational Data Analytics Specialist  
**Execution Timestamp**: 2026-11-19  
**Status**: REVISED & COMPLETE — AWAITING STAKEHOLDER APPROVAL  

---

## 1. Executive Summary

This revised verification report resolves all empirical metric discrepancies, establishes rigorous data and modeling boundaries, and defines a least-privilege security architecture prior to commencing Phase 7.

### Primary Objectives Verified & Corrected:
1. **ML Metric Verification**: Confirmed that serialized Scikit-learn models (`ml_models/saved_models/`) and evaluation reports (`ml_models/reports/`) remain completely authentic and unaltered. Rectified historical documentation errors in Phase 6D regarding target evaluation scales and cross-validation standard deviations.
2. **Predictive Modeling Realism & Dataset Constraints**: Formally established the boundary between academic performance prediction and institutional dropout. Clarified that true student dropout prediction and course demand forecasting cannot be legitimately trained on the static 2-subject UCI dataset without fabricating data. Re-scoped dropout prediction into a transparent, rule-based **Academic Attrition Vulnerability Indicator**.
3. **Anomaly Detection Rigor**: Re-framed unsupervised anomaly detection around **anomaly scores** (not calibrated probabilities), enforced strict feature leakage guards prohibiting $G_3$/target-derived fields, and established human-in-the-loop triage protocols.
4. **Least-Privilege Analyst Role**: Designed the `analyst` role with strict separation from administrative functions, documented explicit administrator read overrides, formulated an authorization test matrix, and identified k-anonymity re-identification risks with pseudonymous identifiers.
5. **Fail-Closed Multi-Tenant Guidance**: Corrected previous multi-tenant preparation notes by mandating future **fail-closed tenant context** rather than optional fallback parameters (`tenant_id=None`).

---

## 2. Investigation of ML Evaluation Discrepancies

### 2.1 The Documented Discrepancy
In `documentation/PHASE_6D_FINAL_AUDIT_REPORT.md` Section 6.2, the following summary metrics were reported:
- *Mathematics Milestone 1 Regressor*: $R^2 = 0.83$, $\text{RMSE} = 1.83$ marks (on 0–20 scale), $\text{SMAPE} = 9.42\%$.
- *Portuguese Language Milestone 1 Regressor*: $R^2 = 0.85$, $\text{RMSE} = 1.25$ marks, $\text{SMAPE} = 7.18\%$.

When compared against the actual serialized model metadata (`math_milestone_1_regressor_meta.json` and `holdout_evaluation_results.json`), these figures did not match the recorded holdout metrics.

### 2.2 Root-Cause Analysis & Verification Findings
Direct inspection of the serialized artifacts in `ml_models/saved_models/` and evaluation reports in `ml_models/reports/` confirmed that the **saved model artifacts themselves have never been altered, overwritten, or compromised**. 

The discrepancy arose entirely from a text documentation error in Phase 6D that mixed target evaluation scales and cross-validation standard deviations:

| Metric Dimension | Math M1 (Saved Metadata) | Math M1 (Phase 6D Text) | Portuguese M1 (Saved Metadata) | Portuguese M1 (Phase 6D Text) | Source of Truth & Explanation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Operational Target Scale** | **0–100 Scale** | Stated as 0–20 | **0–100 Scale** | Stated as 0–20 | Standardized in Phase 4 (`G3 / 20 * 100`). |
| **Holdout $R^2$** | **0.6776** | 0.83 *(Erroneous)* | **0.6935** | 0.85 *(Erroneous)* | 0.83 was CV $R^2$ for Milestone 2, not Milestone 1. |
| **Holdout RMSE (0–100 Scale)**| **12.38%** | — | **9.53%** | — | `holdout_evaluation_results.json:33, 113`. |
| **Holdout RMSE (Scaled to 0–20)**| **2.48 marks** | 1.83 marks | **1.91 marks** | 1.25 marks | True RMSE on 0-20 scale is $12.38 / 5 = 2.48$. |
| **Holdout MAE (0–100 Scale)** | **9.10%** | — | **6.36%** | — | `holdout_evaluation_results.json:32, 112`. |
| **Holdout MAE (Scaled to 0–20)** | **1.82 marks** | — | **1.27 marks** | — | True MAE on 0-20 scale is $9.10 / 5 = 1.82$. |
| **5-Fold CV Mean $R^2$** | **0.686** | — | **0.692** | — | `PHASE_5A_ML_MODEL_DEVELOPMENT.md:173, 215`. |
| **5-Fold CV Mean RMSE** | **12.78%** | — | **8.63%** | — | `PHASE_5A_ML_MODEL_DEVELOPMENT.md:173, 215`. |

### 2.3 Mathematical Origin of the Error
1. **The "1.83" Origin**: In `PHASE_5A_ML_MODEL_DEVELOPMENT.md:160`, the rejected HistGradientBoosting regressor for Milestone 0 had `std_mae = 1.83`. Alternatively, the true holdout MAE on the 0–20 scale is $9.103 / 5 = 1.8206 \approx 1.82$. The Phase 6D narrative confused this MAE figure with RMSE.
2. **The "0.83 / 0.85" Origin**: In Milestone 2 (Pre-Final evaluation using $G_1 + G_2$), the model achieves $R^2 = 0.8955$ (Math) and $R^2 = 0.9030$ (Portuguese), with cross-validation $R^2$ of $0.842$ and $0.830$. The Phase 6D narrative erroneously pasted Milestone 2 numbers into Milestone 1.

### 2.4 Conclusion for Model Integrity
The empirical source of truth is established:
- **Math M1 Champion** (`math_milestone_1_regressor.joblib`): HistGradientBoosting Regressor, Holdout $R^2 = 0.6776$, Holdout $\text{RMSE} = 12.38\%$ ($2.48$ marks on 0–20), Holdout $\text{MAE} = 9.10\%$ ($1.82$ marks on 0–20), MAE reduction vs. mean baseline: **44.38%**.
- **Portuguese M1 Champion** (`portuguese_milestone_1_regressor.joblib`): Random Forest Regressor, Holdout $R^2 = 0.6935$, Holdout $\text{RMSE} = 9.53\%$ ($1.91$ marks on 0–20), Holdout $\text{MAE} = 6.36\%$ ($1.27$ marks on 0–20), MAE reduction vs. mean baseline: **47.57%**.

No model retraining is required. Historical results remain valid as originally trained in Phase 5A.

---

## 3. Dataset Constraints & Predictive Modeling Realism

### 3.1 Student Dropout Prediction vs. Academic Failure
- **Critical Distinction**: There is an essential domain difference between **academic failure** (receiving a low or failing grade in a course while remaining enrolled) and **institutional dropout** (withdrawing from school, terminating degree registration, or transferring out).
- **UCI Dataset Limitations**: The Cortez & Silva (2008) dataset (`student-mat.csv`, `student-por.csv`) includes **only students who completed the academic term and sat for the final period examinations ($G_3$)**. The dataset contains **zero institutional dropout labels**, zero withdrawal dates, and zero termination records.
- **Academic Attrition Vulnerability Indicator (Rule-Based Heuristic)**:
  - We strictly **prohibit** describing any rule-based indicator as a "trained ML dropout model".
  - For Phase 7, we propose an **Academic Attrition Vulnerability Indicator**. This is a **transparent, rule-based diagnostic advisory**, NOT an empirical machine learning prediction.
  - *Heuristic Definition*: An advisory flag triggered when a student exhibits high absenteeism coupled with consecutive failing period marks ($G_1 < 50\% \land G_2 < 50\%$).
  - *Absence Disclaimer*: In the raw UCI dataset, absences are raw session counts (ranging from 0 to 93 in Math, 0 to 32 in Portuguese). **Absences $\ge 15$ cannot be equated to $\text{attendance} \le 75\%$** unless the total institutional session denominator is known. In Phase 4 data engineering, an estimated 60-session term baseline was used as an unverified proxy. Therefore, any threshold on raw absence counts must be explicitly documented as a heuristic institutional parameter rather than a proven percentage of scheduled instructional time.
  - *Decision*: **True student dropout prediction is deferred** until an institution-level dataset containing actual student withdrawal/retention outcomes is secured. Synthetic labels must never be generated.

### 3.2 Course Demand Forecasting
- **Dataset Limitations**: The current platform contains only two static curriculum subjects (`Mathematics` and `Portuguese Language`) observed in a cross-sectional secondary school cohort across two schools (`GP` and `MS`). There are no historical elective enrollment counts, no multi-year course catalogs, no semester-wise registration figures, and no student preference rankings.
- **Decision**: **True course demand forecasting is deferred**. Training an ML demand model on 2 static subjects would require fabricating synthetic time-series data. In Phase 7, this will be represented solely as an **Institutional Capacity Simulator** that calculates departmental faculty workload based on actual student enrollment counts in `student_subject_enrollments`.

### 3.3 Unsupervised Anomaly Detection Rigor
- **Algorithm**: Scikit-learn `IsolationForest`.
- **Target Leakage Prohibition**: Anomaly detection models **must strictly exclude** $G_3$, `final_exam_marks`, `academic_status`, `pass_status`, and any target-derived fields. The model must only ingest inputs available at the evaluated milestone (Milestone 0: demographics and study habits; Milestone 1: Milestone 0 + $G_1$; Milestone 2: Milestone 1 + $G_2$).
- **Metric Terminology**: Isolation Forest produces **anomaly scores** (decision function values / path length severity), **NOT calibrated probabilities**. Outputs must be surfaced as an "Anomaly Score" or "Anomaly Severity Index", never as an "anomaly probability" or "confidence percentage".
- **Exploratory Diagnostic Nature**: Unsupervised algorithms detect **distributional outliers**, not confirmed academic dysfunction or misconduct. For instance, a gifted student who studies very little but earns high grades, or an anxious student with perfect attendance who struggles on tests, will appear as statistical outliers.
- **Validation & Human Triage Protocol**: Anomaly scores must feed into a **human-in-the-loop review queue**. An analyst or teacher must review flagged profiles before any intervention occurs. Anomaly detection is an experimental exploratory diagnostic, not a certified real-world detection system.

---

## 4. Analyst Role Design & Least-Privilege Authorization Matrix

### 4.1 Persona & Purpose
The **Analyst** represents an institutional educational data analyst, researcher, or curriculum coordinator. The Analyst requires system-wide read access to aggregated cohort distributions, curriculum comparisons, and ML performance telemetry, but **must never inherit administrative write privileges**.

### 4.2 Explicit Administrator Override Pattern
- **Administrator Authority**: System administrators retain an explicit override for all analyst-accessible reporting endpoints (`@role_required("analyst", "admin")`). Administrators must have access to all institutional reporting.
- **Strict Role Separation**: The Analyst role **never inherits administrator privileges**. Decorators protecting administrative functions (`@admin_required` or `@role_required("admin")`) strictly exclude the Analyst role.

### 4.3 Proposed Authorization Test Matrix

| Resource / Endpoint | Student | Teacher | Analyst | Administrator | Verification Rule |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `GET /api/analyst/overview` | 403 | 403 | **200 (OK)** | **200 (OK)** | Scoped to analyst and admin only. |
| `GET /api/analyst/curriculum-stats`| 403 | 403 | **200 (OK)** | **200 (OK)** | Cross-subject aggregate metrics. |
| `GET /api/analyst/model-telemetry` | 403 | 403 | **200 (OK)** | **200 (OK)** | Model evaluation JSON reports. |
| `GET /api/analyst/anomaly-triage` | 403 | 403 | **200 (OK)** | **200 (OK)** | Outlier scores with masked PII. |
| `POST /api/admin/users` | 403 | 403 | **403 (Forbidden)** | **200 (OK)** | Analyst cannot create users. |
| `PUT /api/admin/users/:id/role` | 403 | 403 | **403 (Forbidden)** | **200 (OK)** | Analyst cannot alter roles. |
| `POST /api/admin/subjects` | 403 | 403 | **403 (Forbidden)** | **200 (OK)** | Analyst cannot create subjects. |
| `POST /api/admin/teacher-assignments`| 403 | 403 | **403 (Forbidden)** | **200 (OK)** | Analyst cannot assign instructors. |
| `POST /api/admin/student-enrollments`| 403 | 403 | **403 (Forbidden)** | **200 (OK)** | Analyst cannot enroll students. |
| `POST /api/predictions` | 200 (Self) | 200 (Assigned) | **403 (Forbidden)** | **200 (OK)** | Analyst cannot generate predictions. |
| `GET /api/admin/logs` | 403 | 403 | **403 (Forbidden)** | **200 (OK)** | Analyst cannot view audit logs. |

### 4.4 Pseudonymization & k-Anonymity Privacy Risks
- The Analyst workspace displays pseudonymous student identifiers (e.g. `STU-MAT-042`) and suppresses direct PII (names, personal email addresses, phone numbers).
- **k-Anonymity Warning**: Pseudonymous identifiers **do not guarantee complete anonymity**, particularly in small cohorts ($N < 30$). A researcher with access to quasi-identifiers (e.g., age, sex, address type, school, mother's job, father's job) could re-identify individual students through linkage attacks.
- *Safeguard Requirement*: The Analyst interface must enforce **minimum cell size suppression** (cohort subgroups with $N < 5$ students must have their aggregate performance suppressed or blurred in tabular breakdowns).

---

## 5. Multi-Tenant Future Compatibility Guidelines

### 5.1 Rejection of Insecure Fallback Patterns
- In previous draft notes, adding optional `tenant_id: Optional[str] = None` parameters was discussed. **This pattern is explicitly rejected**.
- *Security Risk*: Optional tenant parameters default to `None`, which risks silent data leakage where missing context accidentally causes queries to execute globally across all institutions.

### 5.2 Mandatory Future Requirement: Fail-Closed Tenant Context
When Multi-Institution architecture is implemented in future phases (Phase 9):
1. **Fail-Closed Principle**: Every data query must require explicit tenant context (`g.tenant_id`). If the tenant context is missing, invalid, or unauthenticated, the application must immediately abort with an authorization error (`500 Internal Configuration Error` or `403 Forbidden`). **Queries must never fall back to global data**.
2. **Compound Tenant Indexing**: Indexes must include the tenant discriminator as the leading field, e.g. `[("institution_id", ASCENDING), ("code", ASCENDING)]` for subjects.
3. **Current Phase Boundary**: In Phase 7, **no database indexes or multi-tenant schemas will be modified**. The application remains single-tenant, and all Phase 7 services will operate within the existing validated single-institution architecture.

---

## 6. Revised Phase 7 Implementation Scope

To maintain rigorous software engineering standards and empirical data integrity, Phase 7 is divided into four focused stages:

```
+----------------------------------------------------------------------------------------------------+
|                               REVISED PHASE 7 IMPLEMENTATION SCOPE                                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  PHASE 7A: ANALYST BACKEND RBAC & AUTHORIZATION REGRESSION SUITE                                   |
|  - Add "analyst" to VALID_ROLES in backend/models/user_model.py                                    |
|  - Implement @analyst_required and @role_required("analyst", "admin") decorators                   |
|  - Implement backend test suite verifying analyst read access and strict write blocking            |
|                                                                                                    |
|  PHASE 7B: ANALYST WORKSPACE FRONTEND & PRIVACY SAFEGUARDS                                         |
|  - Create /analyst dashboard route in frontend/src/ with ProtectedRoute role="analyst"             |
|  - Implement cross-curriculum performance telemetry, grade distributions, and KPI summaries        |
|  - Implement model provenance viewer rendering serialized evaluation manifests                     |
|  - Enforce PII masking and minimum cell suppression (N < 5) on analyst tables                      |
|                                                                                                    |
|  PHASE 7C: UNSUPERVISED ANOMALY DETECTION ENGINE                                                   |
|  - Implement Scikit-learn IsolationForest pipeline in backend/ml/                                  |
|  - Enforce strict feature leakage guards (zero G3 or target-derived columns)                       |
|  - Surface non-probabilistic Anomaly Scores and Severity Indices                                   |
|  - Build human-in-the-loop anomaly review triage queue in Analyst and Teacher workspaces           |
|                                                                                                    |
|  PHASE 7D: ACADEMIC ATTRITION VULNERABILITY INDICATOR                                              |
|  - Implement transparent, rule-based advisory indicator (absenteeism + consecutive failing marks)  |
|  - Surface explicit disclosures contrasting academic failure risk with unobserved dropout          |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### Deferred Capabilities:
- **True Student Dropout Prediction**: Deferred until an institution-level dataset containing actual student withdrawal and retention status is acquired.
- **Course Demand Forecasting**: Deferred until longitudinal multi-year registration time-series data is available.

---

## 7. Outstanding Risks and Dependencies

1. **Host Memory Constraints**:
   - The host system operates on 8.0 GB RAM and 2 physical CPU cores. All Phase 7 machine learning components must be lightweight. Scikit-learn's `IsolationForest` on ~1,000 records takes <150 MB RAM and under 2 seconds to train.
2. **Analyst Privilege Boundary**:
   - Developers frequently allow Analysts write access for administrative convenience. This must be prevented by automated tests asserting 403 on all mutative endpoints.
3. **Misinterpretation of Anomaly Scores**:
   - End-users must be educated via UI tooltips that an anomaly score indicates statistical rarity, not verified behavioral misconduct or academic failure.

---

### Awaiting Approval
The Phase 7 Pre-Implementation Verification Report has been fully revised and corrected. No code or database changes have been made. Please review and provide sign-off to proceed with **Phase 7A: Analyst Backend RBAC & Authorization Tests**.
