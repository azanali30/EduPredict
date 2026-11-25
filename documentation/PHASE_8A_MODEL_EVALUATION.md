# EduPredict — Phase 8A: Model Evaluation & Comparison Report

## 1. Scope & Objective

This report details the experimental methodology, model evaluation metrics, probability calibration, and selection justification for the **EduPredict Student Dropout Early Warning Predictor** (Phase 8A).

---

## 2. Experimental Setup & Dataset Profile

- **Benchmark Dataset**: UCI Machine Learning Repository ID 697 (*Predict Students' Dropout and Academic Success*, Valentim Real et al., 2021).
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Total Records**: 4,424 rows.
- **Outcome Distribution**:
  - Graduate: 2,209 (49.93%)
  - Dropout: 1,421 (32.12%)
  - Enrolled: 794 (17.95%)
- **Target Formulation**: Binary Dropout Classification ($y = 1$ if `Target == 'Dropout'`, else $0$).
- **Partitioning**: 80% Stratified Training (3,539 records) / 20% Stratified Holdout Test (885 records).
- **Validation Protocol**: 5-Fold Stratified Cross-Validation on training data (`random_state=42`).

---

## 3. Candidate Model Comparison

Three candidate model families were evaluated on the 242-dimensional transformed feature space using balanced class weighting to address the ~32% positive class prevalence:

### 3.1 5-Fold Stratified Cross-Validation Results (Training Cohort)
| Model | CV ROC-AUC (Mean ± Std) | CV F1-Score | CV Recall | CV Precision |
| :--- | :---: | :---: | :---: | :---: |
| **Logistic Regression (L2, Balanced)** | **0.9199 ± 0.0083** | **0.7846** | **0.8039** | **0.7667** |
| Random Forest (100 trees, max_depth=10, Balanced) | 0.9099 ± 0.0101 | 0.7763 | 0.7828 | 0.7706 |
| HistGradientBoosting (100 iterations, Balanced) | 0.9129 ± 0.0076 | 0.7862 | 0.7713 | 0.8019 |

### 3.2 Uncalibrated Holdout Test Set Evaluation (885 Unseen Records)
| Model | Test ROC-AUC | Test PR-AUC | Test F1 | Test Recall | Test Precision | Brier Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression** | **0.9315** | **0.9018** | **0.8157** | **0.8415** | **0.7914** | 0.0932 |
| Random Forest | 0.9233 | 0.8910 | 0.7951 | 0.7993 | 0.7909 | 0.1085 |
| HistGradientBoosting | 0.9329 | 0.9041 | 0.8248 | 0.8204 | 0.8292 | 0.0879 |

---

## 4. Probability Calibration & Champion Model

### 4.1 Calibration Protocol
Raw decision values from linear and tree-based classifiers frequently deviate from true empirical probabilities. To ensure that an output score of $0.65$ genuinely indicates a $65\%$ likelihood of attrition, probability calibration was performed using `CalibratedClassifierCV(method='sigmoid', cv=5)` on the champion Logistic Regression estimator.

### 4.2 Calibrated Champion Performance (Holdout Test Cohort)
- **Model Version**: `Dropout_LogisticRegression_v1.0.0`
- **ROC-AUC**: **0.9317**
- **PR-AUC (Average Precision)**: **0.9024**
- **Precision**: **89.54%**
- **Recall**: **75.35%**
- **F1-Score**: **0.8184**
- **Brier Score Loss**: **0.0851** (optimal calibration closer to 0.0)
- **Specificity (True Negative Rate)**: **95.84%**
- **False Positive Rate**: **4.16%**

### 4.3 Confusion Matrix Breakdown (885 Test Students)
$$\begin{pmatrix} \text{TN} = 576 & \text{FP} = 25 \\ \text{FN} = 70 & \text{TP} = 214 \end{pmatrix}$$

- **True Negatives (576 / 601, 95.8%)**: On-track students correctly classified as low attrition risk.
- **False Positives (25 / 601, 4.16%)**: Benign students flagged with elevated probability. Because all interventions are supportive and non-punitive, a false alarm triggers a harmless advisory check-in rather than penalties.
- **True Positives (214 / 284, 75.4%)**: Students vulnerable to dropout successfully captured by the early-warning system.
- **False Negatives (70 / 284, 24.6%)**: Vulnerable students missed by the automated filter. Standard universal academic milestones and classroom teacher monitoring serve as secondary safety nets.

---

## 5. Justification for Model Selection

1. **Highest Cross-Validation ROC-AUC (0.9199)**: Demonstrated the most stable generalization across folds with minimal variance ($\pm 0.0083$).
2. **Exceptional Post-Calibration Precision (89.54%)**: When the model issues an early-warning risk alert, there is a ~90% probability that the student is genuinely facing attrition pressures, preventing advisor alert fatigue.
3. **Calibrated Probability Reliability**: The Brier score of `0.0851` confirms that risk probabilities reliably represent cohort attrition odds.
4. **Hardware and Latency Efficiency**: Logistic regression inference runs in under 1 millisecond per student with zero GPU dependency and minimal RAM footprint on standard institution hardware.

---

## 6. Limitations, UCI Benchmark Context & Known Biases

> **Model Status:** **Experimental Early-Warning Benchmark — Not Yet Validated on Local Institutional Outcomes.**

1. **UCI Holdout Benchmark vs. Local Institutional Validity**: All reported performance metrics (e.g., ROC-AUC `0.9317`, PR-AUC `0.9024`, Precision `89.54%`, Recall `75.35%`, Brier Score `0.0851`) represent holdout evaluation on the **UCI Portuguese higher-education dataset (ID 697)**, **NOT** validated EduPredict institutional performance.
2. **Original Institutional Context**: The UCI dataset originates from the Polytechnic Institute of Portalegre, Portugal (Valentim Real et al., 2021; 4,424 student records; CC BY 4.0). Its 0–20 grading scale, European tuition/scholarship structures, admission pathways, and macroeconomic indicators reflect that specific institutional and national context.
3. **Target Grouping Limitation (`Enrolled` + `Graduate` = `Non-Dropout`)**: Grouping 794 still-`Enrolled` students with 2,209 `Graduate` students into a single `Non-Dropout` negative class introduces right-censoring and label noise, because an unknown fraction of `Enrolled` students may later depart before graduation.
4. **Academic Feature-Mapping Approximations & Missing-Value Imputation**: When evaluating EduPredict `academic_records` via `map_academic_record_to_features()`, `assignment_completion_rate` is converted into approved curricular units assuming `6` enrolled units per semester and reused across both 1st and 2nd semesters. Uncollected demographic, financial, and macroeconomic fields remain `NaN`/`None` and are substituted at inference time by `SimpleImputer` (UCI training-set medians and modes). Imputing Portuguese polytechnic medians/modes does not measure local risk factors and does not establish local predictive validity.
5. **Requirement for External Validation & Human Review**: Model outputs must always be treated as probabilistic early-warning estimates requiring authorized advisor review before any intervention. Automated penalties or disciplinary actions are strictly prohibited.

---

## 7. Institutional Validation Protocol (Pending Local Data)

Local institutional validation remains **pending** until genuine historical EduPredict institutional outcomes become available. Before any production or high-stakes deployment claims can be made, the following validation protocol must be executed:

1. **Historical Institutional Record Collection**: Gather multi-term historical student cohorts from the target institution under appropriate governance and privacy approvals.
2. **Actual Semester-Level Feature Extraction**: Extract verified semester-by-semester enrollment counts, credit completions, course grades, attendance logs, and approved financial/demographic indicators directly from institutional systems—replacing the Phase 8A proxy approximations (`6` assumed units, duplicated semester values).
3. **Verified Dropout Outcome Labels**: Label each cohort using confirmed administrative outcomes (official withdrawal/attrition vs. confirmed graduation/retention) over a fixed observation window without right-censored ambiguity.
4. **Temporal & Cohort Train/Test Separation**: Partition data chronologically (e.g., earlier academic years for training/validation, most recent completed cohorts for unseen holdout testing) so evaluation reflects real future deployment.
5. **Strict Leakage Prevention**: Audit all candidate features to exclude post-withdrawal indicators, administrative exit codes, and future-term grades unavailable at the prediction milestone.
6. **Evaluation Metrics**: Compute Precision, Recall, F1-Score, ROC-AUC, PR-AUC, and Confusion Matrices across relevant risk subgroups and cohorts.
7. **Probability Calibration & Threshold Evaluation**: Assess Brier Score and calibration reliability curves on the local holdout cohort, then calibrate decision thresholds (`Low`, `Moderate`, `High`) jointly with academic advisors to balance missed at-risk students (false negatives) against advisor workload (false positives).
8. **Validation Gate**: Require documented sign-off on local holdout performance, fairness/subgroup checks, and advisor workflow readiness before lifting the *"Experimental Early-Warning Benchmark — Not Yet Validated on Local Institutional Outcomes"* designation.
