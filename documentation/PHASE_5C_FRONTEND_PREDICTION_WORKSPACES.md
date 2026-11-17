# EduPredict – Phase 5C: Frontend Prediction Interfaces & Role-Based Workspaces
**System Architecture & Implementation Report**

**Module**: Frontend Workspaces & Prediction Interface Integration  
**Date**: November 17, 2026  
**Status**: APPROVED & FULLY IMPLEMENTED  
**Commit Baseline**: `5f8a94f` (Phase 5B Safety Audit)

---

## 1. Executive Summary

Phase 5C delivers professional, responsive, role-based frontend workspaces for EduPredict's machine learning inference pipeline. Integrating the Phase 5B REST APIs (`/api/predictions/options`, `POST /api/predictions`, `GET /api/predictions`, and `GET /api/predictions/<id>`), Phase 5C enables students, teachers, and administrators to interact transparently with the 12 Scikit-learn champion model pipelines.

All interfaces strictly adhere to educational data governance, empirical false-negative disclosures, uncalibrated probability representations, and leakage-safe milestone partitioning.

---

## 2. Implemented Architecture & Component Structure

### 2.1 Component Hierarchy

```
frontend/src/
├── types/
│   └── index.ts                                # Domain types: PredictionRecord, MilestoneOption, PredictionOptions, etc.
├── services/
│   └── api.ts                                  # Strongly typed API client methods for /api/predictions
├── components/
│   ├── common/
│   │   └── Modal.tsx                           # Reusable modal container enhanced with customizable maxWidth
│   └── predictions/
│       ├── PredictionForm.tsx                  # Milestone-aware dynamic form (33/34/35 features), presets & validation
│       ├── PredictionResultCard.tsx            # Continuous marks progress, discrete risk badge, disagreement & advisory alerts
│       ├── PredictionHistoryTable.tsx          # Filterable audit table (Subject, Milestone, Risk) with modal inspect
│       ├── PredictionDetailModal.tsx           # Full feature payload audit with provenance & proxy tagging
│       └── TeacherPredictionModal.tsx          # Instructor prediction drawer for authorized assigned learners
└── pages/
    ├── student/
    │   └── StudentPredictions.tsx              # Interactive Student Workspace (Generate Prediction & History tabs)
    ├── teacher/
    │   ├── TeacherOverview.tsx                 # Cohort risk telemetry KPI cards & risk breakdown chart
    │   └── TeacherStudents.tsx                 # Roster with AI status, quick Predict action & risk filters
    └── admin/
        └── AdminOverview.tsx                   # System-wide AI prediction intelligence KPIs, Recharts & audit log
```

---

## 3. Detailed Workspace Features

### 3.1 Student Prediction Workspace (`/student/predictions`)

1. **Milestone-Aware Feature Rendering**:
   - **Milestone 0 (Early Warning)**: Renders exactly 33 behavioral, demographic, and home features. All examination indicators (`previous_exam_marks`, `quiz_scores`) are excluded to prevent temporal leakage.
   - **Milestone 1 (Mid-Term)**: Dynamically reveals Period 1 Exam Marks (`previous_exam_marks`, 34 features total).
   - **Milestone 2 (Pre-Final)**: Dynamically reveals Period 2 Quiz Scores (`quiz_scores`, 35 features total).
2. **Prominent Milestone 0 Early Warning Advisory**:
   - Prominently warns users of the empirical holdout false-negative rate:
     - **Mathematics**: $61.54\%$ false-negative rate (8 of 13 failing students predicted as Moderate/Low Risk).
     - **Portuguese Language**: $75.00\%$ false-negative rate (9 of 12 failing students predicted as Moderate/Low Risk).
   - Explicitly explains: *"Behavioral indicators alone cannot reliably detect failing students prior to examination results. Screenings must be supplemented with midterm examination marks."*
3. **Explicit Estimated Proxy Badges**:
   - Transparently distinguishes synthetic/heuristic features from verified institutional records:
     - `assignment_completion_rate`: `"Estimated Study Discipline Index (Derived Heuristic)"`
     - `attendance_percentage`: `"Estimated Attendance Proxy (60-Session Baseline)"`
     - `study_hours_per_week`: `"Estimated Weekly Study Hours (Midpoint Approximation)"`
4. **Evaluation Presets**:
   - One-click testing presets ("At Risk Profile", "Average Profile", "Excelling Profile") allowing rapid validation without manual entry of 33 parameters.
5. **Prediction Result Display**:
   - **Continuous Regressor Output**: Projected final marks ($0 - 100$) with visual color-coded progress bar.
   - **Discrete Classifier Output**: Risk badge (`High Risk` red, `Moderate Risk` amber, `Low Risk / On Track` emerald).
   - **Model Disagreement Advisory**: Automatically evaluates whether the regressor mark band ($<50$ High, $50-69$ Mod, $\ge 70$ Low) conflicts with the classifier's `predicted_status`. Displays an informational advisory explaining both independent estimators without altering either.
   - **Uncalibrated Confidence Representation**: Displays top-class confidence with explicit estimator description:
     - Random Forest: `"Uncalibrated ensemble vote-based confidence estimate"`
     - HistGradientBoosting: `"Uncalibrated gradient-boosting probability estimate"`
   - **Uncertainty Warning**: Highlights predictions where `top_confidence < 0.55`.
6. **Archived Audit Trail**:
   - Filterable prediction history table with subject and milestone dropdowns and a detailed provenance inspection modal.

---

### 3.2 Teacher Prediction Workspace (`/teacher/students` & `/teacher`)

1. **Authorized Student Scoping**:
   - Only students assigned to the authenticated instructor via `/api/teacher/students` are listed.
   - Server-side RBAC guarantees instructors cannot predict for or view unassigned students.
2. **Roster AI Diagnostic Indicators**:
   - The student roster table displays each student's `Latest AI Status` (`High Risk`, `Moderate Risk`, `Low Risk`, or `No Model Run`) and `Projected Mark`.
3. **In-Context Prediction Modal**:
   - Clicking `"Predict AI"` launches the `TeacherPredictionModal` pre-populated with the target learner's ID and name.
   - Teachers can execute predictions, view immediate results, and inspect student prediction history within the modal.
4. **Cohort Attention Banner**:
   - Displays a dynamic cohort advisory banner when any assigned student is flagged High or Moderate Risk, providing one-click filtering.
5. **Teacher Overview Analytics (`/teacher`)**:
   - Live KPI cards: `Assigned Students`, `High Risk Alerts`, `Moderate Risk Alerts`, and `Cohort Avg Projected Mark`.
   - Cohort Academic Risk Classification distribution bar chart powered by Recharts.

---

### 3.3 Admin Prediction Overview (`/admin`)

1. **System-Wide Prediction Telemetry**:
   - Sourced dynamically from `/api/predictions` with no hardcoded figures:
     - `Total Predictions`: Total count of persisted inference records.
     - `High Risk Detected`: Count of students categorized as High Risk.
     - `Mathematics Inferences`: Total predictions evaluated on Mathematics models.
     - `Portuguese Inferences`: Total predictions evaluated on Portuguese models.
2. **Interactive Visualizations (Recharts)**:
   - **Academic Risk Distribution**: Donut/Pie chart displaying High Risk (rose), Moderate Risk (amber), and Low Risk (emerald) proportions.
   - **Milestone Volume Spread**: Bar chart tracking volume across Milestone 0, Milestone 1, and Milestone 2.
3. **Recent Prediction Activity Log**:
   - Audit table displaying recent inferences across the entire institution with direct access to the `PredictionDetailModal` for regulatory auditing.

---

## 4. Verification and Quality Assurance

### 4.1 Frontend TypeScript Compilation & Vite Build
```bash
> tsc -b && vite build

vite v6.4.6 building for production...
✓ 2030 modules transformed.
rendering chunks...
dist/index.html                   0.81 kB │ gzip:   0.46 kB
dist/assets/index-BrHctykr.css   40.45 kB │ gzip:   7.68 kB
dist/assets/index-DEHaZ7xT.js   801.68 kB │ gzip: 210.73 kB
✓ built in 19.44s
```
- **0 TypeScript errors**.
- **0 Vite build warnings or syntax defects**.

### 4.2 Backend Test Suite Verification
```bash
pytest -v
============================= 86 passed in 40.88s =============================
```
- **86 of 86 tests passed (100% pass rate)**.
- Full regression coverage across authentication, RBAC, feature leakage guard, ML pipeline isolation, and prediction endpoints.
