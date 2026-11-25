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

## 6. Limitations & Known Biases

1. **UCI Holdout Benchmark vs. Local Institutional Validity**: All reported performance metrics (e.g., ROC-AUC `0.9317`, PR-AUC `0.9024`, Precision `89.54%`, Recall `75.35%`, Brier Score `0.0851`) represent holdout evaluation on the **UCI Portuguese higher-education dataset (ID 697)**, NOT validated EduPredict institutional performance.
2. **Institutional Specificity**: The model was trained on European polytechnic student data (Portugal). Baseline tuition structures, grade scales (0–20), and admission pathways reflect that educational system.
3. **Academic Feature Mapping Limitations**: When evaluating EduPredict `academic_records` via `map_academic_record_to_features()`, only defensible academic indicators (exam marks, assignment completion rate, attendance, quiz average) are mapped. Uncollected demographic, financial (`Tuition fees up to date`, `Debtor`, `Scholarship holder`), and macroeconomic features are left unobserved (`NaN`/`None`) and imputed by the scikit-learn pipeline rather than fabricated. Consequently, local predictions rely solely on academic proxies until native institutional dropout labels are collected and externally validated.
4. **Requirement for External Validation & Human Review**: Model outputs must always be treated as probabilistic early-warning estimates requiring authorized advisor review before any intervention. Automated penalties or disciplinary actions are strictly prohibited.
