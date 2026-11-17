# EduPredict – Phase 5A Final Model Integrity & Safety Audit

**Document Version**: 1.0.0  
**Phase**: Phase 5A Quality Assurance & Model Integrity Audit  
**Date**: November 17, 2026  
**Status**: Completed & Empirically Verified (Read-Only Audit)  
**Lead Auditor**: Senior Machine Learning Data Auditor & Application Security Architect  
**Project Path**: `C:\Users\Azan's PC\Documents\EduPredict`  
**GitHub Repository**: [github.com/azanali30/EduPredict](https://github.com/azanali30/EduPredict) (`main` branch)  

---

## Executive Summary & Scope

This audit provides a rigorous, read-only technical assessment of the machine learning artifacts, data engineering pipelines, feature derivation formulas, model safety characteristics, and reproducibility protocols completed under **Phase 5A**.

### Audit Boundaries & Constraints
- **Zero Retraining**: No machine learning models were retrained or modified during this audit.
- **Zero Code Modification**: Source code, saved model pipelines (`.joblib`), metadata files (`_meta.json`), and evaluation reports (`.json`) were inspected in read-only mode without mutation.
- **Phase Boundary Strictness**: No prediction endpoints (`/api/predict`), frontend prediction screens, or Teacher Portal interfaces were built. Phase 5B remains blocked pending user authorization.

### Key Audit Findings Matrix
| Audit Area | Status | Core Finding / Operational Verdict |
|---|:---:|---|
| **1. Synthetic Features** | **VERIFIED WITH RESTRICTIONS** | `assignment_completion_rate` is a 100% synthetic heuristic derived from `studytime`, `failures`, `activities`, and `higher`. It contains zero target leakage from $G_3$, but must **never** be displayed as real institutional coursework data. |
| **2. Early Warning Safety** | **CRITICAL LIMITATIONS IDENTIFIED** | Milestone 0 exhibits high false-negative rates for High Risk students: recall is only **38.46%** in Mathematics and **25.00%** in Portuguese. Milestone 0 must be labeled an "Exploratory Early Signal" with mandatory uncertainty warnings. |
| **3. Model Artifact Integrity** | **PASSED (100%)** | All 12 serialized `.joblib` pipelines load cleanly in Python 3.12.16 with scikit-learn 1.9.1. Column ordering is strictly enforced at runtime, and `assert_no_leakage()` validates every inference input. |
| **4. Reproducibility & Traceability** | **PASSED (100%)** | All 54 candidate pipelines used fixed `random_state=42`. Holdout partitions were strictly isolated from CV and model selection. Reported metrics trace with 100% numerical fidelity to machine-readable JSON reports. |

---

## 1. Synthetic Feature Audit & Provenance Verification

### 1.1 Deep-Dive Inspection: `assignment_completion_rate`

In [backend/data_engineering/clean_dataset.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/data_engineering/clean_dataset.py#L170-L175), the feature `assignment_completion_rate` is derived as follows:

```python
# 5. Derive Assignment Completion Rate
# Derived from study discipline, extracurriculars, and past failures
base_completion = 72.0 + (df["studytime"] * 4.5) - (df["failures"] * 6.0)
base_completion += np.where(df["activities"] == "yes", 4.0, 0.0)
base_completion += np.where(df["higher"] == "yes", 5.0, -3.0)
df["assignment_completion_rate"] = np.round(np.clip(base_completion, 40.0, 100.0), 2)
```

#### Mathematical Specification:
$$\text{base} = 72.0 + 4.5 \times \text{studytime} - 6.0 \times \text{failures} + 4.0 \cdot \mathbb{I}(\text{activities}=\text{'yes'}) + (5.0 \cdot \mathbb{I}(\text{higher}=\text{'yes'}) - 3.0 \cdot \mathbb{I}(\text{higher}=\text{'no'}))$$
$$\text{assignment\_completion\_rate} = \min(\max(\text{base}, 40.0), 100.0)$$

#### Provenance and Integrity Analysis:
1. **Source Columns**: `studytime` (categorical 1–4), `failures` (numeric 0–3), `activities` (binary yes/no), `higher` (binary yes/no).
2. **Empirical Nature**: **100% Synthetic Heuristic**. The UCI Student Performance dataset contains zero records of homework submissions, quiz completions, or learning management system (LMS) turn-in telemetry.
3. **Target Leakage Check**: **ZERO TARGET LEAKAGE**. The derivation relies solely on baseline demographic, behavioral, and historical indicators. Neither $G_1$, $G_2$, $G_3$, `final_exam_marks`, nor `academic_status` enter the formula directly or indirectly.
4. **Multicollinearity Observation**: Because `studytime`, `failures`, `activities`, and `higher` are already included as independent features in Milestone 0, `assignment_completion_rate` is a deterministic linear combination of these four existing features. Tree ensembles naturally partition on these redundant splits, but linear models require regularization to avoid rank-deficiency.
5. **Operational Safeguard Mandate**: `assignment_completion_rate` must be clearly documented in all API responses and UI displays as an **"Estimated Completion Index"** or **"Study Discipline Proxy"**. It is strictly forbidden to present this metric to teachers or students as verified institutional homework completion.

---

### 1.2 Comprehensive Provenance of All Derived Features

Every derived feature in the repository was audited for source inputs, derivation formula, and target leakage risk:

| Derived Feature Name | Source Columns | Exact Derivation Formula | Nature | Leakage Risk | Permitted Milestones |
|---|---|---|---|:---:|:---:|
| `study_hours_per_week` | `studytime` | Ordinal midpoint mapping: $\{1 \to 1.5, 2 \to 3.5, 3 \to 7.5, 4 \to 12.0\}$ | Synthetic Midpoint Proxy | None | All (M0, M1, M2) |
| `absences_cleaned` | `absences` | `absences.clip(lower=0, upper=60)` | Cleaned Count | None | Internal |
| `attendance_percentage` | `absences_cleaned` | $\text{round}(\text{clip}(100.0 - \frac{\text{absences\_cleaned}}{60.0} \times 100.0, 0.0, 100.0), 2)$ | Synthetic Velocity Proxy (60-session assumed base) | None | All (M0, M1, M2) |
| `assignment_completion_rate` | `studytime`, `failures`, `activities`, `higher` | $\text{clip}(72.0 + 4.5 \cdot \text{studytime} - 6.0 \cdot \text{failures} + \dots, 40.0, 100.0)$ | Synthetic Completion Index | None | All (M0, M1, M2) |
| `previous_exam_marks` | `G1` | $\text{round}(G_1 \times 5.0, 2)$ (Scale: $0 - 100$) | Direct Linear Scaling | Contains $G_1$ | **Excluded from M0**; Allowed M1, M2 |
| `quiz_scores` | `G2` | $\text{round}(G_2 \times 5.0, 2)$ (Scale: $0 - 100$) | Direct Linear Scaling | Contains $G_2$ | **Excluded from M0, M1**; Allowed M2 |
| `final_exam_marks` | `G3` | $\text{round}(G_3 \times 5.0, 2)$ (Scale: $0 - 100$) | Direct Linear Scaling | **TARGET** | **FORBIDDEN IN ALL INPUTS** |
| `academic_status` | `final_exam_marks` | $<50 \to \text{High Risk}, 50-69 \to \text{Moderate Risk}, \ge 70 \to \text{Low Risk}$ | Ordinal Target Partition | **TARGET** | **FORBIDDEN IN ALL INPUTS** |

**Audit Conclusion on Features**: No feature in the feature matrix across any milestone contains direct or indirect mathematical leakage from $G_3$, `final_exam_marks`, or `academic_status`. All synthetic features are derived strictly from pre-existing behavioral and demographic indicators.

---

## 2. Early Warning Model Safety & High-Risk Recall Analysis

### 2.1 Milestone 0 Confusion Matrix Analysis

Milestone 0 represents the system's "Early Warning" state, where models have access to 33 demographic, family, and behavioral features, but **zero academic examination grades**.

#### Mathematics Milestone 0 Holdout Evaluation ($N_{\text{test}} = 79$)
- **Champion Algorithm**: Random Forest Classifier
- **Class Breakdown**: High Risk ($N=26$), Moderate Risk ($N=33$), Low Risk / On Track ($N=20$)
- **Holdout Confusion Matrix**:
  ```text
                  Predicted High   Predicted Moderate   Predicted Low    Total Actual
  Actual High           10                 13                 3               26
  Actual Moderate        8                 18                 7               33
  Actual Low             0                  4                16               20
  Total Predicted       18                 35                26               79
  ```

#### Detailed Metric Derivation for `High Risk` in Mathematics:
- **True Positives ($TP$)**: 10
- **False Positives ($FP$)**: $8 + 0 = 8$ (all from Moderate Risk; zero Low Risk students falsely flagged)
- **False Negatives ($FN$)**: $13 + 3 = 16$ (13 predicted as Moderate Risk, 3 predicted as Low Risk)
- **Precision**: $\frac{10}{10 + 8} = \mathbf{55.56\%}$
- **Recall**: $\frac{10}{26} = \mathbf{38.46\%}$
- **Class-Specific F1-Score**: $2 \times \frac{0.5556 \times 0.3846}{0.5556 + 0.3846} = \mathbf{45.45\%}$

---

#### Portuguese Language Milestone 0 Holdout Evaluation ($N_{\text{test}} = 130$)
- **Champion Algorithm**: HistGradientBoosting Classifier
- **Class Breakdown**: High Risk ($N=20$), Moderate Risk ($N=71$), Low Risk / On Track ($N=39$)
- **Holdout Confusion Matrix**:
  ```text
                  Predicted High   Predicted Moderate   Predicted Low    Total Actual
  Actual High            5                 13                 2               20
  Actual Moderate        5                 47                19               71
  Actual Low             0                 21                18               39
  Total Predicted       10                 81                39              130
  ```

#### Detailed Metric Derivation for `High Risk` in Portuguese:
- **True Positives ($TP$)**: 5
- **False Positives ($FP$)**: $5 + 0 = 5$ (all from Moderate Risk; zero Low Risk students falsely flagged)
- **False Negatives ($FN$)**: $13 + 2 = 15$ (13 predicted as Moderate Risk, 2 predicted as Low Risk)
- **Precision**: $\frac{5}{5 + 5} = \mathbf{50.00\%}$
- **Recall**: $\frac{5}{20} = \mathbf{25.00\%}$
- **Class-Specific F1-Score**: $2 \times \frac{0.5000 \times 0.2500}{0.5000 + 0.2500} = \mathbf{33.33\%}$

---

### 2.2 Operational Risk Assessment of Early Warning Models

1. **High False-Negative Rate**:
   - In Mathematics, **61.54% of actual failing students (16 of 26) are not identified as High Risk** at Milestone 0.
   - In Portuguese, **75.00% of actual failing students (15 of 20) are not identified as High Risk** at Milestone 0.
2. **Critical Misclassifications (Actual High Risk $\to$ Predicted Low Risk)**:
   - Mathematics: **3 actual failing students** were classified as "Low Risk / On Track".
   - Portuguese: **2 actual failing students** were classified as "Low Risk / On Track".
   - This represents the most dangerous educational failure mode: providing false reassurance to students and educators who urgently require remedial support.
3. **Positive Safety Characteristic (Zero False Alarms on Low Risk Students)**:
   - In both subjects at Milestone 0, **zero actual Low Risk students were misclassified as High Risk** ($FP_{\text{Low}\to\text{High}} = 0$). This prevents stigmatization of high-performing students.

### 2.3 Early Warning Safety Mandates for Phase 5B
- **Documentation Language**: Documentation must explicitly state: *"Milestone 0 provides exploratory behavioral screening ($R^2 \approx 0.17 - 0.21$, Recall $\approx 25 - 38\%$) and must never be treated as a definitive forecast."*
- **UI Warning Banner**: When displaying Milestone 0 predictions, the interface must render a warning:
  > **[Early Warning Alert]**: Academic marks are not yet recorded for this milestone. Risk predictions reflect general demographic trends and have an estimated false-negative rate of over 60%. Do not use Milestone 0 as the sole basis for disciplinary or remedial placement.
- **Confidence Thresholding**: If the predicted probability for the top class is $< 0.55$, the UI must flag the prediction status as **"Uncertain / Insufficient Academic Data"** rather than displaying a confident risk tier.

---

## 3. Saved Model Artifact & Runtime Integrity Audit

### 3.1 Verification of All 12 Champion Artifacts

All 12 champion pipelines and metadata files in `ml_models/saved_models/` were audited in the live Python 3.12.16 virtual environment using [backend/ml/model_loader.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/ml/model_loader.py):

| Subject | M | Task | Saved Artifact Filename | Estimator Class | Features | Target Variable | Predict API | Predict Proba |
|---|:---:|:---:|---|---|:---:|---|:---:|:---:|
| Math | 0 | Regression | `math_milestone_0_regressor.joblib` | `RandomForestRegressor` | 33 | `final_exam_marks` | Verified | N/A |
| Math | 0 | Classification | `math_milestone_0_classifier.joblib` | `RandomForestClassifier` | 33 | `academic_status` | Verified | Verified |
| Math | 1 | Regression | `math_milestone_1_regressor.joblib` | `HistGradientBoostingRegressor` | 34 | `final_exam_marks` | Verified | N/A |
| Math | 1 | Classification | `math_milestone_1_classifier.joblib` | `HistGradientBoostingClassifier` | 34 | `academic_status` | Verified | Verified |
| Math | 2 | Regression | `math_milestone_2_regressor.joblib` | `RandomForestRegressor` | 35 | `final_exam_marks` | Verified | N/A |
| Math | 2 | Classification | `math_milestone_2_classifier.joblib` | `HistGradientBoostingClassifier` | 35 | `academic_status` | Verified | Verified |
| Portuguese | 0 | Regression | `portuguese_milestone_0_regressor.joblib` | `RandomForestRegressor` | 33 | `final_exam_marks` | Verified | N/A |
| Portuguese | 0 | Classification | `portuguese_milestone_0_classifier.joblib` | `HistGradientBoostingClassifier` | 33 | `academic_status` | Verified | Verified |
| Portuguese | 1 | Regression | `portuguese_milestone_1_regressor.joblib` | `RandomForestRegressor` | 34 | `final_exam_marks` | Verified | N/A |
| Portuguese | 1 | Classification | `portuguese_milestone_1_classifier.joblib` | `HistGradientBoostingClassifier` | 34 | `academic_status` | Verified | Verified |
| Portuguese | 2 | Regression | `portuguese_milestone_2_regressor.joblib` | `RandomForestRegressor` | 35 | `final_exam_marks` | Verified | N/A |
| Portuguese | 2 | Classification | `portuguese_milestone_2_classifier.joblib` | `HistGradientBoostingClassifier` | 35 | `academic_status` | Verified | Verified |

### 3.2 Runtime Feature Ordering & Leakage Prevention Guarantees

Inspection of `predict()` in [backend/ml/model_loader.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/ml/model_loader.py#L65-L88) confirms two architectural safeguards:

1. **Deterministic Feature Re-Ordering**:
   ```python
   # Line 85: Slice exact required features in metadata order
   X = df_features[expected_features].copy()
   ```
   This guarantees that even if a caller supplies columns in a different order or with extraneous columns present in the DataFrame, `X` is strictly reorganized to match the exact feature sequence the pipeline was fitted on.
2. **Mandatory Leakage Assertion**:
   ```python
   # Line 86: Validate zero leakage on sliced input matrix
   assert_no_leakage(X.columns.tolist(), target)
   ```
   If an incoming request includes `final_exam_marks`, `academic_status`, `G3`, `student_code`, or any derived target column, `assert_no_leakage()` raises a fatal `ValueError` before execution reaches `pipeline.predict(X)`.

---

## 4. Reproducibility & Traceability Audit

### 4.1 Seed Stability and Isolation Audit
1. **Fixed Random Seeds**:
   - Master seed `random_state = 42` is enforced in `train_models.py` across:
     - 80/20 train/test splits (`train_test_split`).
     - 5-fold cross-validation generators (`KFold`, `StratifiedKFold`).
     - Estimator initializations (`RandomForestRegressor`, `RandomForestClassifier`, `HistGradientBoostingRegressor`, `HistGradientBoostingClassifier`, `LogisticRegression`).
2. **Strict Test Partition Isolation**:
   - The holdout test set was created prior to cross-validation.
   - Cross-validation was performed exclusively on the training partition ($N_{\text{train}} = 316$ for Math, $N_{\text{train}} = 519$ for Portuguese).
   - Data preprocessing (`StandardScaler`, `OneHotEncoder`, `OrdinalEncoder`, `SimpleImputer`) was embedded within Scikit-learn `Pipeline` objects. In every cross-validation iteration, transformers were fitted strictly on the 4 in-sample folds, guaranteeing zero snooping into the validation fold or holdout test partition.

---

### 4.2 Cross-Validation vs. Holdout Performance Traceability

A full comparison between 5-fold cross-validation performance and holdout test set evaluation was audited against [ml_models/reports/champion_models_manifest.json](file:///C:/Users/Azan's%20PC/Documents/EduPredict/ml_models/reports/champion_models_manifest.json):

| Subject | M | Task | Champion Algorithm | 5-Fold CV Metric | Holdout Metric | Discrepancy ($\Delta$) | Audit Assessment |
|---|:---:|:---:|---|:---:|:---:|:---:|---|
| **Math** | 0 | Regression | Random Forest Regressor | MAE: 14.78% | MAE: 14.41% | -0.37% | In-distribution (within CV std: 1.79%) |
| **Math** | 0 | Classification | Random Forest Classifier | Macro F1: 0.4986 | Macro F1: 0.5599 | +0.0613 | Slight holdout advantage (within CV std: 0.062) |
| **Math** | 1 | Regression | HistGradientBoosting Regressor | MAE: 8.50% | MAE: 9.10% | +0.60% | In-distribution (within CV std: 1.04%) |
| **Math** | 1 | Classification | HistGradientBoosting Classifier | Macro F1: 0.7202 | Macro F1: 0.7386 | +0.0184 | High stability (within CV std: 0.032) |
| **Math** | 2 | Regression | Random Forest Regressor | MAE: 5.15% | MAE: 4.70% | -0.45% | In-distribution (within CV std: 0.86%) |
| **Math** | 2 | Classification | HistGradientBoosting Classifier | Macro F1: 0.8695 | Macro F1: 0.8632 | -0.0063 | High stability (within CV std: 0.038) |
| **Portuguese** | 0 | Regression | Random Forest Regressor | MAE: 9.55% | MAE: 10.62% | +1.07% | Expected generalization gap (CV std: 0.65%) |
| **Portuguese** | 0 | Classification | HistGradientBoosting Classifier | Macro F1: 0.5805 | Macro F1: 0.4711 | **-0.1094** | **Audited Class-Imbalance Divergence** |
| **Portuguese** | 1 | Regression | Random Forest Regressor | MAE: 5.94% | MAE: 6.36% | +0.42% | In-distribution (within CV std: 0.51%) |
| **Portuguese** | 1 | Classification | HistGradientBoosting Classifier | Macro F1: 0.7244 | Macro F1: 0.7060 | -0.0184 | High stability (within CV std: 0.038) |
| **Portuguese** | 2 | Regression | Random Forest Regressor | MAE: 4.12% | MAE: 3.72% | -0.41% | In-distribution (within CV std: 0.37%) |
| **Portuguese** | 2 | Classification | HistGradientBoosting Classifier | Macro F1: 0.8175 | Macro F1: 0.8121 | -0.0054 | High stability (within CV std: 0.033) |

#### Investigation of the Portuguese M0 Classification Divergence (-0.1094):
- **Why did Macro F1 drop from 0.5805 to 0.4711?**
  In the Portuguese cohort holdout set ($N=130$), the High Risk class represents only **15.4%** of the sample ($N=20$). Because Milestone 0 contains zero exam grades, the classifier identified 5 of the 20 High Risk students (Recall = 25.0%). Under macro-averaging, where each class carries equal weight ($33.3\%$), the lower recall on this small minority class heavily penalizes the holdout score. In contrast, Weighted F1 on the holdout partition remained robust at **0.5275** (due to strong accuracy on Moderate and Low Risk classes).
- **Audit Verdict**: This divergence is legitimate empirical variance caused by minority class scarcity without grades, not data snooping or pipeline corruption.

---

## 5. Recommended Phase 5B Production Safeguards

To prevent operational hazards when Phase 5B (API development and UI integration) begins, the following safeguards are formally recommended:

1. **Explicit API Metadata on Predictions**:
   Every response from the future `/api/predict` endpoint must include a `disclaimer` and `confidence_tier`:
   ```json
   {
     "milestone": 0,
     "predicted_grade": 62.4,
     "predicted_risk": "Moderate Risk",
     "confidence": 0.52,
     "uncertainty_flag": true,
     "disclaimer": "Milestone 0 predictions reflect demographic proxies only. Formal assessment should await Milestone 1 results."
   }
   ```
2. **Prohibition of Automated Adverse Actions**:
   Under no circumstances should the system trigger automated academic disciplinary flags or course drop recommendations based on Milestone 0 predictions.
3. **Transparent Heuristic Labeling in Frontend**:
   In student and teacher dashboards, `assignment_completion_rate` must be visually badged as `Estimated Study Discipline Index` rather than `Verified Homework Submissions`.
4. **Mandatory Schema Validation**:
   Future API route handlers must validate input features against `backend.data_engineering.leakage_guard.get_milestone_features(milestone)` before passing payloads to `model_loader.predict()`.

---

## 6. Verification Test Suite Status

The complete test suite was executed in read-only mode to confirm system stability:
- **ML & Leakage Tests**: `tests/test_ml_models.py` & `tests/test_feature_leakage.py` (18 tests passed in 6.27s).
- **Full Backend Pytest Suite**: 72 / 72 tests passed (100% pass rate).
- **Frontend Production Build**: Vite production build succeeded with 0 errors.

---

## Conclusion & Next Steps

Phase 5A has successfully passed this comprehensive model integrity and safety audit. All 12 champion pipelines are verified, leak-free, reproducible, and ready for service abstraction in Phase 5B.

**Awaiting user authorization to proceed to Phase 5B.**
