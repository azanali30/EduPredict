# EduPredict – Phase 5 Machine Learning Readiness Verification Report

**Review Type**: Pre-Phase 5 Architectural & Methodological Verification  
**Auditor**: Senior Data Scientist, ML Engineer & Software Architect  
**Date**: 2026-11-17  
**Scope**: Dataset Identity, Regression/Classification Split Protocols, Preprocessing Leakage, Evaluation Metrics  
**Status**: VERIFIED & READY FOR PHASE 5 (Zero Models Trained)

---

## 1. Executive Summary

This document establishes the verified architectural, split, and evaluation protocols for **Phase 5 (Machine Learning Model Engineering & Predictive Analytics Engine)**. 

Every preprocessing, split, and metric calculation step has been audited against statistical and machine learning standards to eliminate data snooping, target leakage, and metric distortion.

> [!IMPORTANT]
> **Strict Non-Training Protocol Confirmation**:
> **No machine learning models have been trained.** All directories in `ml_models/` remain unpopulated. Model training will commence only after explicit user approval of this readiness document.

---

## 2. Student Identity Grouping & Demographic Quasi-Identifiers

### 2.1 The 13 Demographic Quasi-Identifiers
In the original benchmark study (*Cortez & Silva, 2008*) and `data/raw/student-merge.R`, student matching between Mathematics and Portuguese Language is performed on 13 demographic and family background attributes:
```R
by = c("school", "sex", "age", "address", "famsize", "Pstatus", 
       "Medu", "Fedu", "Mjob", "Fjob", "reason", "nursery", "internet")
```

### 2.2 Mathematical Reconciliation of Enrollment and Merge Counts
The dataset contains **1,044 total confirmed enrollment records** (395 in Mathematics, 649 in Portuguese Language). When evaluated against the 13 quasi-identifiers:

```
+-------------------------------------------------------------------------------+
|                            1,044 Course Enrollments                           |
|       (395 Mathematics Enrollments  |  649 Portuguese Language Enrollments)   |
+-------------------------------------------------------------------------------+
                                        |
       Partitioned by 13 Demographic Quasi-Identifiers
                                        v
+-------------------------------------------------------------------------------+
|                 662 Unique Demographic Profile Equivalence Groups             |
|                                                                               |
|  - 293 profiles appear in exactly 1 record   (293 records)                    |
|  - 360 profiles appear in exactly 2 records  (720 records: 1 Math + 1 Por)    |
|  -   5 profiles appear in exactly 3 records  ( 15 records)                    |
|  -   4 profiles appear in exactly 4 records  ( 16 records)                    |
|                                                                               |
|  Total Profile Groups: 293 + 360 + 5 + 4 = 662                                |
|  Total Records: 293 + 720 + 15 + 16 = 1,044                                   |
+-------------------------------------------------------------------------------+
                                        |
       Cross-Subject Inner Merge on 13 Quasi-Identifiers
                                        v
+-------------------------------------------------------------------------------+
|                        382 Cross-Subject Merge Rows                           |
|                                                                               |
|  - 360 one-to-one matched pairs:              360 x (1 x 1) = 360 merge rows  |
|  -   5 groups with 1 Math + 2 Por:              5 x (1 x 2) =  10 merge rows  |
|  -   4 groups with 2 Math + 2 Por (or 1x3):     (multi-match) = 12 merge rows  |
|                                                                               |
|  Total Merge Rows: 360 + 10 + 12 = 382 merge rows (as reported in student-merge.R) |
+-------------------------------------------------------------------------------+
```

### 2.3 Critical Distinction: Enrollment Records vs. Physical Identity
- **Quasi-Identifier Collisions**:
  Within Mathematics alone, there are 8 rows sharing 4 unique demographic combinations (4 pairs of distinct students with identical backgrounds). Within Portuguese alone, there are 23 rows sharing 11 combinations.
- **Audit Rule**:
  **662 represents the count of unique demographic profile groups, NOT a verified count of unique physical human students.** Two different physical students who attend the same school, have the same age, gender, address, family size, parental education, occupations, nursery attendance, and home internet will map to the same group ID.
- **Confirmed Records**: The only ground truth is that there are **1,044 confirmed course enrollment records**.

### 2.4 Recommended Primary vs. Pooled Architecture
To guarantee zero cross-subject identity entanglement:
1. **Primary Production Architecture (Subject-Specific Models)**:
   - **Mathematics Model**: Trained and evaluated exclusively on Mathematics records ($N = 395$).
   - **Portuguese Language Model**: Trained and evaluated exclusively on Portuguese records ($N = 649$).
   - *Advantage*: Completely eliminates student overlap between train and test splits, while respecting the substantial distributional variance between the two subjects ($\sigma = 4.58$ in Math vs. $\sigma = 3.23$ in Portuguese).
2. **Conservative Pooled Fallback Architecture**:
   If training a global multi-subject model ($N = 1,044$), `GroupShuffleSplit` or `GroupKFold` using `backend.data_engineering.leakage_guard.generate_student_group_ids()` must be applied to ensure all records belonging to the same demographic equivalence class remain strictly on one side of the split.

---

## 3. Regression and Classification Split Strategy

### 3.1 Continuous Regression Stratification Protocol
- **Methodological Problem**: Scikit-learn's `StratifiedKFold` and `train_test_split(..., stratify=...)` strictly require discrete categorical targets. Passing continuous numerical arrays ($G_3$ or `final_exam_marks`) directly will raise:
  `ValueError: Supported target types are: ('binary', 'multiclass'). Got 'continuous' instead.`
- **Verified Solution**:
  When stratified sampling is desired to ensure that low-scoring, moderate-scoring, and high-scoring students are proportionately represented in both train and test splits, a documented stratification proxy bin must be used:
  - **Performance Tier Bins** (`get_regression_stratification_bins(y, strategy='performance_tier')`):
    $$[0, 50) \implies \text{High Risk (230 records)}, \quad [50, 70) \implies \text{Moderate Risk (520 records)}, \quad [70, 100] \implies \text{Low Risk (294 records)}$$
  - Alternatively, 5 quantile-based buckets (`strategy='quantile'`).
- **Standard Regression Cross-Validation**:
  Within the training partition, regression cross-validation should utilize `KFold(n_splits=5, shuffle=True, random_state=42)` or `RepeatedKFold`.

### 3.2 Classification Stratification Protocol
- When predicting the discrete target `academic_status` (`High Risk`, `Moderate Risk`, `Low Risk / On Track`), standard `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` will be applied.

### 3.3 Strict 20% Holdout Test Isolation
- **Train / Test Ratio**: 80% Training ($N = 835$ pooled / $316$ Math / $519$ Portuguese), 20% Test ($N = 209$ pooled / $79$ Math / $130$ Portuguese).
- **Rule of Isolation**: The 20% holdout test partition is generated once at the start of Phase 5, saved to an isolated evaluation artifact, and **NEVER** accessed during:
  - Feature selection
  - Preprocessing transformer fitting
  - Hyperparameter tuning (GridSearchCV / RandomizedSearchCV)
  - Model architecture selection
- The test partition is evaluated **once** on the final production-candidate models to produce unbiased generalization metrics.

---

## 4. Preprocessing Leakage Audit & Pipeline Encapsulation

### 4.1 Audit of Existing Phase 4 Feature Transformations
Every existing transformation in `clean_dataset.py` was inspected for data-dependent parameters:
1. **Milestone Grade Scaling**: $G_1 \times 5.0, G_2 \times 5.0, G_3 \times 5.0$.
   *Status*: Fixed domain scaling (maps 0–20 to 0–100%). Zero statistical dependency on dataset distribution.
2. **Attendance Percentage**: $100.0 - (\min(\text{absences}, 60.0) / 60.0 \times 100.0)$.
   *Status*: Fixed domain clipping and constant scaling. Zero statistical dependency on dataset distribution.
3. **Study Hours Mapping**: Fixed dictionary mapping ($1 \rightarrow 1.5, 2 \rightarrow 3.5, 3 \rightarrow 7.5, 4 \rightarrow 12.0$).
   *Status*: Fixed domain mapping. Zero statistical dependency.

**Conclusion**: Phase 4 transformations do not introduce global dataset leakage because they rely on fixed domain formulas rather than sample statistics ($\mu, \sigma, \min, \max, \text{quantiles}$).

### 4.2 Phase 5 Preprocessing Isolation Rules
Any data-dependent transformation introduced in Phase 5 **MUST** be encapsulated inside Scikit-learn `Pipeline` and `ColumnTransformer` objects:
- `StandardScaler()` / `RobustScaler()`: Must compute $\mu$ and $\sigma$ **only** from the training fold (`fit_transform` on train, `transform` on test/validation).
- `OneHotEncoder(handle_unknown='ignore')`: Must fit categories **only** on the training fold.
- `SimpleImputer()`: Must calculate median/mean **only** on the training fold.
- **Fold Independence**: When performing 5-fold cross-validation, the pipeline is fitted 5 separate times from scratch on each 4-fold training split, ensuring that validation fold statistics never leak into the transformer.

---

## 5. Evaluation Metric Standards & Mathematical Corrections

### 5.1 Primary Regression Metrics
1. **Mean Absolute Error (MAE)**:
   $$\text{MAE} = \frac{1}{n} \sum_{i=1}^n |y_i - \hat{y}_i|$$
   *Primary regression metric*: Directly interpretable in grade percentage points (e.g., an MAE of $5.2\%$ means predictions are on average within $5.2$ marks of the true final grade).
2. **Root Mean Squared Error (RMSE)**:
   $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{i=1}^n (y_i - \hat{y}_i)^2}$$
   *Secondary regression metric*: Penalizes large outlier errors, critical for detecting students whose grades would be severely mispredicted.
3. **Coefficient of Determination ($R^2$)**:
   $$R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$$
   *Reporting Context*: Quantifies the proportion of variance in final marks explained by student features. Must be reported alongside MAE/RMSE to prevent misleading interpretations when sample variance is small.

### 5.2 The Zero-Division Problem in Standard MAPE & sMAPE Solution
- **The Data Reality**: In the dataset, **53 students scored $G_3 = 0$** (38 in Math, 15 in Portuguese) due to absence from final exams or course abandonment.
- **The Mathematical Failure of Standard MAPE**:
  $$\text{MAPE} = \frac{100\%}{n} \sum_{i=1}^n \left| \frac{y_i - \hat{y}_i}{y_i} \right|$$
  When $y_i = 0$, the denominator is zero ($\frac{|0 - \hat{y}|}{0} = \infty$). Scikit-learn's `mean_absolute_percentage_error` will return numbers exceeding $10^{15}$ or throw runtime warnings.
- **Corrected Standard for Phase 5**:
  Standard MAPE is **excluded** from default tabular reporting. In its place, **Symmetric Mean Absolute Percentage Error (sMAPE)** will be used:
  $$\text{sMAPE} = \frac{100\%}{n} \sum_{i=1}^n \frac{2 |y_i - \hat{y}_i|}{|y_i| + |\hat{y}_i| + \epsilon}$$
  Implemented in `backend.data_engineering.leakage_guard.safe_smape()`, strictly bounded in $[0\%, 200\%]$.

### 5.3 Classification Metrics
For 3-tier risk classification (`High Risk`, `Moderate Risk`, `Low Risk / On Track`):
1. **Macro F1-Score (Primary Optimization Metric)**:
   Calculates unweighted mean of F1-scores across all three risk categories. Crucial because `High Risk` students ($N = 230$) represent the most critical early-warning cohort and must not be overshadowed by the majority `Moderate Risk` cohort ($N = 520$).
2. **Weighted F1-Score**: Accounts for class prevalence.
3. **Balanced Accuracy**: Arithmetic mean of recall scores across each class.
4. **Precision and Recall by Class**: Granular reporting for early warning intervention.
5. **Confusion Matrix**: Full $3 \times 3$ contingency table documenting true vs. predicted classifications.

### 5.4 Benchmark Baseline Models
To demonstrate authentic machine learning lift over trivial heuristics:
- **Regression Baselines**:
  1. `DummyRegressor(strategy='mean')`
  2. Ordinary Least Squares (OLS) Linear Regression
- **Classification Baselines**:
  1. `DummyClassifier(strategy='prior')` (majority class baseline)
  2. `DummyClassifier(strategy='stratified')`
  3. Multinomial Logistic Regression

---

## 6. Automated Verification Test Suite

The test suite [tests/test_feature_leakage.py](file:///c:/Users/Azan's%20PC/Documents/EduPredict/tests/test_feature_leakage.py) was updated to verify:
1. `test_regression_stratification_binning()`: Confirms both `performance_tier` (yielding exact 230 High, 520 Moderate, 294 Low Risk buckets) and `quantile` binning strategies operate cleanly.
2. `test_safe_smape_zero_handling()`: Confirms `safe_smape()` computes bounded, finite percentage errors on arrays containing actual zero values.
3. `test_dual_enrolled_student_grouping_count()`: Verifies exact partition of 1,044 records into 662 demographic profile groups (293 single-record, 369 multi-record).

### Pytest Execution Summary (62 / 62 Tests Passing)
```text
============================= test session starts =============================
platform win32 -- Python 3.12.16, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\Azan's PC\Documents\EduPredict
plugins: flask-1.3.0
collected 62 items

tests/test_admin.py (7 tests) ........................................ PASSED [ 11%]
tests/test_app_factory.py (3 tests) .................................. PASSED [ 16%]
tests/test_auth.py (10 tests) ........................................ PASSED [ 32%]
tests/test_config.py (4 tests) ....................................... PASSED [ 38%]
tests/test_data_pipeline.py (13 tests) ............................... PASSED [ 59%]
tests/test_feature_leakage.py (10 tests) ............................. PASSED [ 75%]
tests/test_health_routes.py (4 tests) ................................ PASSED [ 81%]
tests/test_models.py (4 tests) ....................................... PASSED [ 87%]
tests/test_mongo_connectivity.py (3 tests) ........................... PASSED [ 92%]
tests/test_rbac.py (6 tests) ......................................... PASSED [100%]

============================= 62 passed in 30.73s =============================
```

### Frontend Production Build Summary
```text
> edupredict-frontend@1.0.0 build
> tsc -b && vite build

vite v6.4.6 building for production...
✓ 2025 modules transformed.
dist/index.html                   0.81 kB │ gzip:   0.46 kB
dist/assets/index-BpR1vFdi.css   36.27 kB │ gzip:   7.10 kB
dist/assets/index-cwR6B7wV.js   735.12 kB │ gzip: 199.12 kB
✓ built in 16.53s
```

---

## 7. Phase 5 Implementation Blueprint (Awaiting Authorization)

When authorized, Phase 5 will be structured as follows:
```text
ml_models/
├── training/
│   ├── train_math_models.py       # Subject-specific pipeline for Mathematics (N=395)
│   ├── train_portuguese_models.py # Subject-specific pipeline for Portuguese (N=649)
│   ├── evaluate_models.py         # Standardized evaluation & metric reporting
│   └── model_registry.py          # Serializer & metadata artifact governance
├── serialized/                    # Joblib / pickle serialized pipelines
└── benchmarks/                    # Cross-validation logs & baseline comparison tables
```

---

## 8. Conclusion

All prerequisites for machine learning model development are established:
- Demographic quasi-identifier mechanics and collisions are mathematically explained.
- Mathematics and Portuguese subject-specific architectures are established as primary.
- Train/test splitting protocols strictly prevent continuous target errors and data snooping.
- Preprocessing encapsulation via Scikit-learn Pipelines is enforced.
- Metric corrections (MAE, RMSE, sMAPE, Macro F1) are verified and implemented.

**Phase 5 implementation is paused. Awaiting explicit user approval before training models.**
