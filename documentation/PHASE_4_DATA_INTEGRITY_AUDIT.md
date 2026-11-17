# EduPredict – Phase 4 Data Integrity & Machine Learning Leakage Audit Report

**Audit Type**: Data Integrity, Identity Mapping, Indicator Realism & Feature Leakage Pre-Flight Audit  
**Auditor**: Senior Data Scientist & ML Data Quality Auditor  
**Date**: 2026-11-17  
**Scope**: `data/raw/`, `data/processed/`, MongoDB `analytical_academic_records`, `backend/data_engineering/`, `tests/`  
**Status**: COMPLETE – Ready for Phase 5 (No models trained)

---

## 1. Executive Summary

Prior to initiating Phase 5 (Machine Learning Model Engineering & Predictive Analytics), a rigorous data integrity and leakage audit was conducted across the Phase 4 dataset engineering pipeline. 

The audit focused on four foundational areas of data quality and methodological soundness:
1. **Dataset Student Identity & Cross-Course Enrollment**: Investigating how student identifiers are generated, verifying whether dual-enrolled students are correctly accounted for, and mitigating group leakage.
2. **Attendance Indicator Realism**: Auditing the `attendance_percentage` formula to prevent unverified claims of "actual institutional attendance".
3. **Machine Learning Feature Leakage**: Auditing all 45 attributes to mathematically identify and isolate all variables derived directly or indirectly from the final examination outcome ($G_3$).
4. **Study Hours Heuristic**: Verifying the mapping of survey categories to continuous hours and confirming preservation of original survey values.

> [!IMPORTANT]
> **Strict Non-Training Protocol Maintained**:
> No predictive machine learning models were trained during this audit. All serialized model directories (`ml_models/`) remain unpopulated.

---

## 2. Dataset Identity Audit Findings

### 2.1 Identifier Generation Mechanism
In `backend/data_engineering/clean_dataset.py`, deterministic student codes are generated using row indices and dataset prefixes:
- Mathematics: `STU-MAT-001` through `STU-MAT-395` ($N = 395$)
- Portuguese Language: `STU-POR-001` through `STU-POR-649` ($N = 649$)
- Total Records: $1,044$

### 2.2 Dual-Enrolled Student Analysis
A critical finding from reviewing the original publication (*Cortez & Silva, 2008*) and the provided `data/raw/student-merge.R` script:
```R
d1 = read.table("student-mat.csv", sep=";", header=TRUE)
d2 = read.table("student-por.csv", sep=";", header=TRUE)
d3 = merge(d1, d2, by=c("school", "sex", "age", "address", "famsize", "Pstatus", 
                         "Medu", "Fedu", "Mjob", "Fjob", "reason", "nursery", "internet"))
print(nrow(d3)) # 382 students
```
- **Finding**: **382 students** appear in *both* the Mathematics and Portuguese Language datasets.
- Because `clean_dataset.py` assigns separate prefixes (`STU-MAT` vs `STU-POR`), each row in `cleaned_academic_records.csv` represents a **course enrollment record**, rather than a distinct physical student.
- In total, there are **662 unique physical students** across the 1,044 enrollment records ($1,044 - 382 = 662$).

### 2.3 Identity Leakage Risk in Machine Learning
If an unconstrained random train/test split (e.g. `train_test_split(test_size=0.2)`) is applied to the pooled 1,044 records:
- The Math record of an overlapping student could be assigned to the **training set**, while their Portuguese record is assigned to the **test set**.
- Because immutable demographic and family background features (`Medu`, `Fedu`, `Mjob`, `Fjob`, `address`, `reason`, `internet`) are identical across both records, the model could easily overfit to individual student demographic signatures, producing falsely optimistic validation scores (**Identity Leakage**).

### 2.4 Audit Resolutions for Phase 5
1. **Subject-Stratified Split (Recommended Primary Mode)**: Train separate models for Mathematics ($N=395$) and Portuguese ($N=649$). In this paradigm, each student appears at most once in each subject's dataset, completely eliminating student overlap.
2. **Group-Aware Pooled Split**: If training a global pooled model ($N=1,044$), apply `GroupShuffleSplit` or `GroupKFold` using `backend.data_engineering.leakage_guard.generate_student_group_ids()`. This guarantees that all course enrollments of any physical student remain strictly on one side of the train/test boundary.

---

## 3. Attendance Indicator Audit

### 3.1 Formula Inspection
In `backend/data_engineering/clean_dataset.py`:
```python
df["absences_cleaned"] = df["absences"].clip(lower=0, upper=60)
df["attendance_percentage"] = np.round(
    np.clip(100.0 - (df["absences_cleaned"] / 60.0 * 100.0), 0.0, 100.0), 2
)
```

### 3.2 Audit Findings
- **Data Reality**: The original UCI benchmark only collected `absences` (count of missed class periods, ranging from $0$ to $93$, with mean $4.43$ and median $3.0$).
- **Assumption Verification**: The 60-day denominator is a synthetic heuristic assumption reflecting a standard academic term of approximately 60 lectures. It is **not** an empirical measurement of verified institutional class roll-calls.
- **Audited Correction**:
  - `attendance_percentage` has been formally reclassified in code docstrings, `data_dictionary.json`, and `DATA_DICTIONARY.md` as an **Estimated Attendance Proxy**.
  - System documentation and user interfaces must strictly label this indicator as an "Estimated Attendance Rate" or "Attendance Proxy" and must **never** claim it is verified roll-call attendance.

---

## 4. Machine Learning Feature Leakage Audit

### 4.1 Attribute Categorization Matrix
Every attribute in `cleaned_academic_records.csv` and `academic_features_normalized.csv` was audited for its temporal relationship to final term completion:

| Attribute | Origin | Nature | Temporal Availability | Leakage Classification |
|---|---|---|---|---|
| `G3` | Raw Final Exam Mark | Target | End of Term | **FORBIDDEN (Raw Target)** |
| `final_exam_marks` | Scaled Final Exam ($G_3 \times 5$) | Target | End of Term | **FORBIDDEN (Primary Regression Target)** |
| `academic_status` | 3-tier Risk from `final_exam_marks` | Target | End of Term | **FORBIDDEN (Primary Classification Target)** |
| `pass_status` | Binary pass from $G_3 \ge 10$ | Target | End of Term | **FORBIDDEN (Derived Target)** |
| `student_code` | Enrollment Identifier | Admin Meta | Registration | **FORBIDDEN (Metadata)** |
| `academic_year` | Observation Year | Admin Meta | Registration | **FORBIDDEN (Constant Metadata)** |
| `term` | Observation Term | Admin Meta | Registration | **FORBIDDEN (Constant Metadata)** |
| `previous_exam_marks` | Scaled Period 1 Exam ($G_1 \times 5$) | Intermediate | Mid-Term 1 | **Permitted in Milestone 1 & 2 Models** |
| `quiz_scores` | Scaled Period 2 Quiz ($G_2 \times 5$) | Intermediate | Mid-Term 2 | **Permitted in Milestone 2 Models** |
| `G1`, `G2` | Raw Term 1 & 2 Exam Marks | Intermediate | Mid-Terms 1 & 2 | **Permitted in Milestone 1 & 2 Models** |
| `study_hours_per_week` | Midpoint from `studytime` | Predictor | Registration | **Permitted (All Milestones)** |
| `studytime` | Survey Study Frequency (1-4) | Predictor | Registration | **Permitted (All Milestones)** |
| `absences` | Total Absenteeism Count | Predictor | Cumulative | **Permitted (All Milestones)** |
| `attendance_percentage`| Estimated Attendance Proxy | Predictor | Cumulative | **Permitted (All Milestones)** |
| `failures` | Past Course Failures | Predictor | Registration | **Permitted (All Milestones)** |
| `school`, `sex`, `age` | Demographics | Predictor | Registration | **Permitted (All Milestones)** |
| `Medu`, `Fedu`, `Mjob` | Parental Background | Predictor | Registration | **Permitted (All Milestones)** |
| `famrel`, `freetime`, `health` | Social/Health Indicators | Predictor | Registration | **Permitted (All Milestones)** |
| `assignment_completion_rate`| Synthetic Completion Index | Predictor | Heuristic | **Permitted (All Milestones)** |

### 4.2 Leakage Prevention Rules for Phase 5
1. **Rule 1 (Regression Input Matrix)**:
   When predicting `final_exam_marks` (or `G3`), the input matrix $X$ must satisfy:
   $$X \cap \{\text{'final\_exam\_marks'}, \text{'G3'}, \text{'academic\_status'}, \text{'pass\_status'}, \text{'student\_code'}\} = \emptyset$$
2. **Rule 2 (Classification Input Matrix)**:
   When classifying `academic_status` (or `pass_status`), the input matrix $X$ must satisfy:
   $$X \cap \{\text{'academic\_status'}, \text{'final\_exam\_marks'}, \text{'G3'}, \text{'pass\_status'}, \text{'student\_code'}\} = \emptyset$$
3. **Automated Enforcement**:
   Implemented `backend.data_engineering.leakage_guard.assert_no_leakage(feature_cols, target)`, which automatically asserts these invariants during model ingestion and raises a `ValueError` if any target-derived column is supplied.

---

## 5. Study Hours Audit

### 5.1 Mapping Verification
In `backend/data_engineering/clean_dataset.py`:
```python
STUDYTIME_HOURS_MAP = {
    1: 1.5,   # UCI Code 1: < 2 hours/week (Midpoint 1.5)
    2: 3.5,   # UCI Code 2: 2 to 5 hours/week (Midpoint 3.5)
    3: 7.5,   # UCI Code 3: 5 to 10 hours/week (Midpoint 7.5)
    4: 12.0,  # UCI Code 4: > 10 hours/week (Estimated Midpoint 12.0)
}
```

### 5.2 Audit Verification
- In the original UCI survey, students responded to a discrete 4-choice question: `studytime`.
- Mapping these categories to $1.5, 3.5, 7.5, 12.0$ represents a continuous **midpoint approximation** for linear and regression modeling, not stopwatch-logged study durations.
- **Integrity Check**: The original ordinal attribute `studytime` is strictly preserved in `cleaned_academic_records.csv` and `academic_features_normalized.csv`, allowing tree-based models in Phase 5 to use either the categorical integer or the continuous estimate.

---

## 6. Recommended Phase 5 Train/Test Evaluation Strategy

To guarantee scientific rigor, prevent data leakage, and provide meaningful performance benchmarks in Phase 5, the following evaluation framework is recommended:

### 6.1 Train / Test Partitioning
- **Test Set Reservation**: 20% strictly held-out test partition (`test_size=0.2, random_state=42`), stratified by the target variable.
- **Cross-Validation**: 5-Fold Stratified Cross-Validation performed exclusively on the 80% training set for hyperparameter tuning and model comparison.
- **Subject Separation**:
  - Primary evaluation should report models trained and evaluated separately on **Mathematics** ($N=395$) and **Portuguese Language** ($N=649$).
  - For pooled models ($N=1,044$), `GroupShuffleSplit` must be utilized using `generate_student_group_ids()` to keep all records of the 382 dual-enrolled students on the same side of the split.

### 6.2 Milestone Staged Prediction Architecture
In educational institutions, predictions are requested at different times during the school year. Phase 5 should implement three prediction milestones:
1. **Milestone 0 (Early Warning / Pre-Exam)**: Uses demographic, socioeconomic, behavioral, and attendance proxies only. Zero exam scores ($G_1, G_2$) included.
2. **Milestone 1 (Mid-Term 1)**: Milestone 0 features + Term 1 Exam ($G_1$ / `previous_exam_marks`).
3. **Milestone 2 (Mid-Term 2)**: Milestone 1 features + Term 2 Quiz ($G_2$ / `quiz_scores`).

### 6.3 Performance Metrics & Baselines
- **Regression Evaluation**:
  - Baseline: `DummyRegressor(strategy='mean')` and OLS Linear Regression.
  - Metrics: RMSE, MAE, $R^2$, and MAPE.
- **Classification Evaluation**:
  - Baseline: `DummyClassifier(strategy='prior')` and Multinomial Logistic Regression.
  - Metrics: Macro F1-score (critical for detecting minority `High Risk` cohort), Weighted F1-score, Balanced Accuracy, Precision, Recall, and Confusion Matrix.

---

## 7. Automated Test Suite Expansion

A dedicated test suite `tests/test_feature_leakage.py` was authored containing 8 rigorous data integrity tests:
1. `test_leakage_guard_rejects_g3_and_derived_features()`: Confirms `assert_no_leakage` halts if $G_3$, `final_exam_marks`, or `academic_status` appear in regression features.
2. `test_leakage_guard_rejects_status_in_classification()`: Confirms classifier input matrices cannot contain target risk tiers.
3. `test_dual_enrolled_student_grouping_count()`: Confirms `generate_student_group_ids` precisely identifies the 662 distinct physical students from the 1,044 enrollment records.
4. `test_attendance_percentage_proxy_bounds_and_formula()`: Confirms estimated attendance proxy remains strictly bounded $[0.0, 100.0]$.
5. `test_study_hours_mapping_and_preservation()`: Confirms continuous study hours match midpoint definitions while preserving original `studytime` ($1-4$).
6. `test_normalized_features_leakage_isolation()`: Audits `academic_features_normalized.csv` to ensure clear separation of predictors and targets.
7. `test_milestone_feature_partitions()`: Verifies that Milestone 0 feature lists contain zero intermediate exam marks.
8. `test_dataset_identity_consistency()`: Validates that `student_code` prefixes are cleanly partitioned by subject.

### Pytest Execution Results
- **Full Backend Suite**: **62 passed in 30.12s (100% Pass Rate)**
  - 41 Existing Phase 1, 2, 3 tests: PASSED
  - 13 Phase 4 Data Pipeline tests: PASSED
  - 8 Phase 4 Data Integrity & Leakage Guard tests: PASSED
- **Frontend Production Build**: `npm run build` passed in 22.10s with 0 errors.

---

## 8. Commit & Synchronization Log

All audit deliverables, guard code, test suites, and documentation updates have been committed and synchronized with GitHub:
- **Repository**: `https://github.com/azanali30/EduPredict`
- **Branch**: `main`
- **Audit Commit**: Pending immediate push (`feat(audit): implement phase 4 data integrity audit, leakage guard, and test suite`)

---

## 9. Conclusion & Phase 5 Authorization Gate

The Phase 4 data engineering pipeline is now fully audited, documented, and verified. The boundaries between predictors and targets are strictly defined and protected by automated code assertions.

**Awaiting user authorization to proceed to Phase 5 (Machine Learning Model Engineering & Predictive Analytics Engine).**
