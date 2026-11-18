# EduPredict – Phase 5C Final Frontend Functional & Data Integrity Audit
**Strictly Read-Only System Audit Report**

**Module**: Frontend Workspaces, Prediction UI, and Role-Based Analytics  
**Auditor**: Senior Machine Learning Auditor & Lead Frontend QA Engineer  
**Date**: November 18, 2026  
**Audited Commits**:
- `3052088` (`feat(phase-5c): modern prediction workspaces, dynamic forms, model disagreement handling, and role-based analytics`)
- `d50ce8f` (`docs(phase-5c): record Phase 5C commit hash in backup log`)  
**Baseline References**:
- Phase 5A Evaluation Artifacts (`ml_models/reports/confusion_matrices.json`, `holdout_evaluation_results.json`)
- Phase 5B Backend Prediction Service (`backend/services/prediction_service.py`, `backend/ml/model_loader.py`)
- Phase 5B Final API Safety Audit (`documentation/PHASE_5B_FINAL_API_SAFETY_AUDIT.md`)

---

## 1. Files Inspected

The following source, configuration, and evaluation files were audited in detail:

| File Path | Component / Layer | Primary Audit Focus |
|---|---|---|
| `ml_models/reports/confusion_matrices.json` | ML Evaluation Artifacts | Ground truth holdout confusion matrices & class labels |
| `ml_models/reports/holdout_evaluation_results.json` | ML Evaluation Artifacts | Model performance metrics, MAE, Macro F1, baseline lifts |
| `backend/ml/model_loader.py` | Model Inference Engine | `predict_student()`, probability calculations, `early_warning_advisory` schema |
| `backend/services/prediction_service.py` | Prediction Business Service | Schema validation, target leakage defense, RBAC scoping |
| `backend/routes/prediction_routes.py` | REST API Blueprint | `/options`, `POST /`, `GET /` endpoints, pagination handling |
| `frontend/src/types/index.ts` | Frontend Type System | `PredictionRecord`, `EarlyWarningAdvisory`, `PredictionOptions` definitions |
| `frontend/src/services/api.ts` | API Client | `createPrediction`, `listPredictions`, CSRF management |
| `frontend/src/components/predictions/PredictionForm.tsx` | UI Form Component | 33/34/35 feature partition, M0 advisory prose, proxy indicators |
| `frontend/src/components/predictions/PredictionResultCard.tsx` | UI Result Component | Marks display, risk badges, disagreement banner, advisory rendering |
| `frontend/src/components/predictions/PredictionHistoryTable.tsx` | UI History Component | History filtering, pagination handling, detail modal launcher |
| `frontend/src/components/predictions/PredictionDetailModal.tsx` | UI Audit Modal | Full feature payload inspection, metadata provenance |
| `frontend/src/components/predictions/TeacherPredictionModal.tsx` | UI Teacher Modal | Instructor-supervised student evaluation drawer |
| `frontend/src/pages/student/StudentPredictions.tsx` | Student Workspace Page | Tab navigation, state management, history isolation |
| `frontend/src/pages/teacher/TeacherOverview.tsx` | Teacher Overview Page | Cohort telemetry cards, Recharts risk distribution, pagination |
| `frontend/src/pages/teacher/TeacherStudents.tsx` | Teacher Roster Page | Roster display, latest status mapping, unassigned student blocking |
| `frontend/src/pages/admin/AdminOverview.tsx` | Admin Governance Page | Institutional telemetry, `total_count` vs `length`, Recharts visuals |
| `frontend/src/routes/ProtectedRoute.tsx` | Routing Security | Client-side role gating and redirection |
| `tests/test_prediction_api.py` | Integration Test Suite | Automated validation of prediction endpoints & security |

---

## 2. Milestone 0 Numerical Verification & Advisory Discrepancy Investigation

### 2.1 Ground Truth Evaluation Artifacts (Phase 5A)

Inspection of `ml_models/reports/confusion_matrices.json` reveals the exact holdout test partition ($20\%$, $N=79$ Math, $N=130$ Portuguese) confusion matrices for Milestone 0:

#### Mathematics Milestone 0 Holdout Confusion Matrix ($N=79$)
```json
{
  "labels": ["High Risk", "Moderate Risk", "Low Risk / On Track"],
  "matrix": [
    [10, 13, 3],   // Actual High Risk (Failing)
    [8,  18, 7],   // Actual Moderate Risk
    [0,  4,  16]   // Actual Low Risk / On Track
  ]
}
```
- **Actual High Risk Students ($N_{\text{failing}}$)**: $10 + 13 + 3 = \mathbf{26}$
- **True Positives ($TP_{\text{HighRisk}}$)**: $10$
- **False Negatives ($FN_{\text{HighRisk}}$)**: $13 \text{ (predicted Moderate Risk)} + 3 \text{ (predicted Low Risk)} = \mathbf{16}$
- **False Negative Rate**:
  $$\text{FNR}_{\text{Math}} = \frac{16}{26} = \frac{8}{13} \approx 61.5385\% \implies \mathbf{61.54\%}$$

#### Portuguese Language Milestone 0 Holdout Confusion Matrix ($N=130$)
```json
{
  "labels": ["High Risk", "Moderate Risk", "Low Risk / On Track"],
  "matrix": [
    [5,  13, 2],   // Actual High Risk (Failing)
    [5,  47, 19],  // Actual Moderate Risk
    [0,  21, 18]   // Actual Low Risk / On Track
  ]
}
```
- **Actual High Risk Students ($N_{\text{failing}}$)**: $5 + 13 + 2 = \mathbf{20}$
- **True Positives ($TP_{\text{HighRisk}}$)**: $5$
- **False Negatives ($FN_{\text{HighRisk}}$)**: $13 \text{ (predicted Moderate Risk)} + 2 \text{ (predicted Low Risk)} = \mathbf{15}$
- **False Negative Rate**:
  $$\text{FNR}_{\text{Port}} = \frac{15}{20} = \frac{3}{4} = 75.00\% \implies \mathbf{75.00\%}$$

---

### 2.2 Root Cause Analysis of the Reported "8 of 13" and "9 of 12" Counts

In `frontend/src/components/predictions/PredictionForm.tsx` (lines 166–170) and `documentation/PHASE_5C_FRONTEND_PREDICTION_WORKSPACES.md`:
```typescript
const mathFnRate = '61.54%';
const portFnRate = '75.00%';
const currentFnRate = subject === 'Mathematics' ? mathFnRate : portFnRate;
const failingCount = subject === 'Mathematics' ? '8 of 13' : '9 of 12';
```

#### Investigation Findings:
1. **Mathematics ("8 of 13")**:
   - The fraction $\frac{16}{26}$ simplifies algebraically to $\frac{8}{13}$ ($\frac{16 \div 2}{26 \div 2} = \frac{8}{13}$).
   - The developer simplified the ratio mathematically, but expressed it in prose as physical student counts: *"failed to detect 8 of 13 failing students"*.
   - **Audit Verdict**: This is **factually misleading**. There were **26** actual failing students in the holdout set, and **16** were false negatives. Reducing physical cohort counts like fractions distorts the empirical sample size.
2. **Portuguese ("9 of 12")**:
   - The true false negative count is $\frac{15}{20} = 75.00\% = \frac{3}{4}$.
   - The text reported `"9 of 12"`, which equals $\frac{9}{12} = \frac{3}{4} = 75.00\%$.
   - **Audit Verdict**: This was an arbitrary fraction representing $75\%$ ($3 \times 3 / 4 \times 3$). The physical Portuguese holdout test set contained **20** failing students, of which **15** were false negatives.
3. **Evaluation Population Check**:
   - This discrepancy did **not** arise from cross-validation folds or another dataset. It was an inaccurate textual transcription of the true holdout confusion matrix.

---

### 2.3 Runtime Property Key Mismatch Defect

A property key mismatch exists between the Phase 5B backend response and the Phase 5C frontend components:

| Semantic Field | Backend Key (`model_loader.py`) | Frontend Type & Component Access (`types/index.ts`, `PredictionResultCard.tsx`, `PredictionDetailModal.tsx`) | Impact |
|---|---|---|---|
| **False Negative Rate** | `false_negative_rate_estimate_pct` | `early_warning_advisory.false_negative_rate_pct` | `undefined.toFixed(2)` throws runtime `TypeError` |
| **Warning Text** | `notice` | `early_warning_advisory.warning` | Renders blank (`undefined`) |
| **Guidance / Action** | `recommended_action` | `early_warning_advisory.actionable_guidance` | Renders blank (`undefined`) |

#### Code Evidence:
In `frontend/src/components/predictions/PredictionResultCard.tsx` (lines 144–153):
```tsx
{milestone === 0 && early_warning_advisory && (
  ...
  <span>
    Holdout False-Negative Rate:{' '}
    {early_warning_advisory.false_negative_rate_pct.toFixed(2)}%  {/* CRASHES: undefined.toFixed */}
  </span>
  <p>{early_warning_advisory.warning}</p>                       {/* undefined */}
  <p>{early_warning_advisory.actionable_guidance}</p>           {/* undefined */}
)}
```
Identical code appears in `frontend/src/components/predictions/PredictionDetailModal.tsx` (lines 90–94).

---

## 3. Admin Analytics Accuracy

Inspection of lines 53–99 in `frontend/src/pages/admin/AdminOverview.tsx`:
```typescript
const [usersRes, healthRes, predsRes] = await Promise.all([
  api.getAdminUsers(),
  api.getHealth(),
  api.listPredictions({ limit: 100 }),
]);
setPredictions(predsRes.predictions || []);
```
And downstream calculations:
```typescript
const totalPredictions = predictions.length;
const mathPredictions = predictions.filter((p) => p.subject === 'Mathematics').length;
const portPredictions = predictions.filter((p) => p.subject === 'Portuguese Language').length;
const highRiskCount = predictions.filter((p) => p.predicted_status === 'High Risk').length;
const modRiskCount = predictions.filter((p) => p.predicted_status === 'Moderate Risk').length;
const lowRiskCount = predictions.filter((p) => p.predicted_status === 'Low Risk / On Track').length;
const m0Count = predictions.filter((p) => p.milestone === 0).length;
const m1Count = predictions.filter((p) => p.milestone === 1).length;
const m2Count = predictions.filter((p) => p.milestone === 2).length;
```

### Audit Findings on Admin Analytics:
1. **Pagination Truncation Defect**:
   - `AdminOverview.tsx` passes `{ limit: 100 }` to `api.listPredictions()`.
   - The backend `GET /api/predictions` returns `total_count` (the true count in MongoDB) alongside `predictions` (up to 100 records).
   - The frontend sets `totalPredictions = predictions.length`, completely ignoring `predsRes.total_count`.
   - **Defect**: If the institution has 500 predictions, the dashboard displays `Total Predictions: 100`.
2. **Incomplete Distribution Statistics**:
   - `mathPredictions`, `portPredictions`, `highRiskCount`, `riskDistributionData`, and `milestoneDistributionData` are computed via client-side `.filter()` over only the first 100 records.
3. **Absence of Aggregation Endpoint**:
   - The backend currently lacks an analytical summary endpoint (`GET /api/predictions/stats` or `summary`).

---

## 4. Teacher Cohort Analytics

Inspection of `TeacherOverview.tsx` and `TeacherStudents.tsx`:

| Criterion | Verified Implementation | Audit Assessment |
|---|---|---|
| **Assigned Students Count** | `students.length` where `students` is retrieved from `api.getTeacherStudents()`. | **PASS**: Counts distinct registered student users assigned to the instructor, NOT prediction records. |
| **Latest AI Status** | Uses `latestPredMap` built by iterating predictions and updating if `new Date(p.created_at) > new Date(existing.created_at)`. | **PASS**: Each student is accurately linked to their latest chronological prediction. |
| **Projected Mark** | Renders `latestPred.predicted_marks` from `latestPredMap`. | **PASS**: Reflects the student's latest assessment score. |
| **Cohort Average Score** | Iterates strictly over `students` (distinct assigned students), looks up `latestPredMap.get(s.id)`, and divides by `scoreCount`. | **PASS**: Each student contributes at most one score. Multiple prediction runs for a single student do not inflate or bias the average. |
| **Unassigned Student Isolation** | Backend query scopes `student_id: {"$in": assigned_student_ids}`. Frontend only iterates over `students` from `getTeacherStudents()`. | **PASS**: Unassigned students cannot enter teacher telemetry or appear in the roster. |
| **Cohort Risk Distribution** | Increments `highRiskCount`, `modRiskCount`, `lowRiskCount`, and `Unscreened` during the distinct student iteration. | **PASS**: Donut/bar chart accurately visualizes the current risk profile of the instructor's cohort. |

### Pagination Consideration:
- `TeacherOverview.tsx` calls `api.listPredictions({ limit: 100 })`. If the teacher's assigned cohort generates over 100 total predictions across the academic year, older students whose last prediction occurred prior to the latest 100 runs will fall off page 1 and appear as `"No Model Run"` or `"Unscreened"`.

---

## 5. Student Workspace Verification

Inspection of `StudentPredictions.tsx` and `PredictionForm.tsx`:

| Milestone | Expected Features | Visible Fields in Form | Backend Accepted | Target Leakage Check | Audit Status |
|---|---|---|---|---|---|
| **Milestone 0 (Early Warning)** | 33 | 33 (15 Demographics, 15 Habits/Social, 3 Proxies) | 33 | Zero exam marks (`G1`, `G2`, `G3`, `quiz_scores`, `previous_exam_marks`) present. | **PASS** |
| **Milestone 1 (Mid-Term)** | 34 | 34 (M0 + `previous_exam_marks`) | 34 | `quiz_scores`, `final_exam_marks`, `G2`, `G3` excluded. | **PASS** |
| **Milestone 2 (Pre-Final)** | 35 | 35 (M1 + `quiz_scores`) | 35 | `final_exam_marks`, `G3`, `academic_status` excluded. | **PASS** |

### Additional Checks:
- **Field Visibility**: Exam Marks tab is hidden at Milestone 0. `quiz_scores` is hidden at Milestone 1.
- **Estimated Proxy Indicators**: Explicitly badged (`Estimated Study Discipline Index`, `Estimated Attendance Proxy`, `Estimated Weekly Study Hours`) with transparency warning box.
- **Demo Presets**: Clearly labeled as testing presets ("At Risk", "Average", "Excelling").
- **History Isolation**: Scoped server-side to `current_user.id`; IDOR attempts return `403 Forbidden`.

---

## 6. Model Result Presentation Verification

Inspection of `PredictionResultCard.tsx`:

| UI Feature | Logic / Code | Visual Representation | Verification Status |
|---|---|---|---|
| **Projected Marks** | `predicted_marks.toFixed(1)` | Large font (e.g. `68.5 / 100`) with visual colored progress bar. | **PASS** |
| **Risk Status Category** | `predicted_status` | Distinct color badges: High Risk (red), Moderate Risk (amber), Low Risk (green). | **PASS** |
| **Model Disagreement Detection** | `continuousRiskTier !== predicted_status` where `<50` is High, `50-69` Moderate, `70+` Low. | Informational sky-blue banner explaining MSE optimization vs. cross-entropy. Neither output is suppressed. | **PASS** |
| **Confidence Type Description** | Checks if `classifier_model` contains "random" or "forest". | Accurately distinguishes "uncalibrated ensemble vote-based" from "uncalibrated gradient-boosting probability". | **PASS** |
| **Uncertainty Warning** | `uncertainty_warning === true` (triggered when `top_confidence < 0.55`). | Amber banner advising caution due to narrow statistical separation between classes. | **PASS** |
| **Milestone 0 Advisory** | `{milestone === 0 && early_warning_advisory && ...}` | Warning box displayed. | **DEFECT**: Crashes due to key mismatch (`false_negative_rate_pct` vs `false_negative_rate_estimate_pct`). |

---

## 7. Authorization Findings

- **Route Guarding**: `ProtectedRoute.tsx` guards student, teacher, and admin route hierarchies. Unauthenticated requests redirect to `/login` with location preserved; unauthorized roles redirect to `/unauthorized`.
- **API Security**: `api.ts` attaches `X-CSRFToken` to mutating requests and retries expired tokens.
- **Backend Defense**: Server-side decorators (`@login_required`, `@role_required`, `can_access_student_data`) enforce authorization independent of frontend state.

---

## 8. Browser Verification Results

### Testing Execution Statement:
The automated browser subagent was **blocked** from launching interactive sessions because the host machine's existing Google Chrome process was running without the remote debugging flag (`--remote-debugging-port=9222`), resulting in `Could not find DevToolsActivePort`.

In accordance with strict audit integrity rules, **we do not claim live browser visual automation**.

### Verification Breakdown:
- **Verified**:
  - TypeScript Compilation (`tsc -b`): 0 errors across all types, components, and pages.
  - Vite Production Bundler (`vite build`): 2030 modules transformed, 801 kB bundle in 19.44s.
  - Backend Test Suite (`pytest -v`): 86 / 86 tests passed in 40.88s (100%).
  - API Payload Execution: M0, M1, M2 payloads successfully executed and verified via test client.
- **Unverified**:
  - Automated browser DevTools pixel rendering and clickthroughs (requires Chrome started with remote debugging).

---

## 9. Severity Classification of Audit Findings

| Finding ID | Finding Description | Affected Component | Severity | Justification |
|---|---|---|---|---|
| **BUG-5C-01** | Advisory Property Key Mismatch causing runtime `TypeError` (`undefined.toFixed`) | `PredictionResultCard.tsx`, `PredictionDetailModal.tsx` | **CRITICAL** | Directly crashes the frontend when attempting to view a Milestone 0 prediction result card or detail modal. |
| **BUG-5C-02** | Mathematically reduced & inaccurate physical student counts ("8 of 13", "9 of 12") | `PredictionForm.tsx`, Phase 5C report | **MAJOR** | Distorts empirical holdout sample size; true counts are 16 of 26 (Math) and 15 of 20 (Portuguese). |
| **BUG-5C-03** | Admin Total Predictions capped at 100 due to using `predictions.length` instead of `total_count` | `AdminOverview.tsx` | **MAJOR** | Displays truncated and misleading institutional metrics once predictions exceed 100. |
| **BUG-5C-04** | Teacher and Admin distribution charts computed on first 100 records rather than full dataset | `AdminOverview.tsx`, `TeacherOverview.tsx` | **MEDIUM** | Incomplete historical telemetry due to absence of dedicated aggregation endpoint. |

---

## 10. Final Readiness Verdict

**Verdict**: **CONDITIONALLY APPROVED — REMEDIATION REQUIRED BEFORE PHASE 6**

### Summary:
Phase 5C successfully delivers modern, responsive, role-based workspaces with strict feature gating (33, 34, 35 features), transparent estimated proxy labels, model disagreement detection, and sound authorization architecture.

However, **BUG-5C-01** (runtime crash on M0 advisory rendering) and **BUG-5C-02** (inaccurate holdout count prose) must be corrected before Phase 5C can be considered production-ready.

### Action Plan for Post-Audit Remediation:
1. Update `types/index.ts`, `PredictionResultCard.tsx`, and `PredictionDetailModal.tsx` to safely access `false_negative_rate_estimate_pct`, `notice`, and `recommended_action`.
2. Update `PredictionForm.tsx` to display `'16 of 26'` for Mathematics and `'15 of 20'` for Portuguese Language, explicitly labeling them as historical holdout results.
3. Update `AdminOverview.tsx` to bind `Total Predictions` to `predsRes.total_count` and add a clear coverage label to distribution charts.
