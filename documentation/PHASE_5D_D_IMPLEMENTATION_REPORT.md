# EduPredict — Phase 5D-D: Student Performance, AI Predictions Hub & At-Risk Students Implementation Report

**Document Version:** 1.0.0  
**Phase:** 5D-D (Student Performance Analytics, Predictions Hub, At-Risk Triage, & Route Code Splitting)  
**Status:** Completed & Fully Verified  
**Project Path:** `C:\Users\Azan's PC\Documents\EduPredict`  
**Repository:** [https://github.com/azanali30/EduPredict](https://github.com/azanali30/EduPredict)  
**Author:** Senior Machine Learning Engineer / Lead UI-UX Architect  
**Date:** November 18, 2026  

---

## 1. Executive Summary

Phase 5D-D completes the core analytics and prediction management capabilities of the EduPredict Teacher Workspace:
1. **Student Performance Analytics (`/teacher/performance`)** — Comprehensive cohort academic telemetry, grade band distributions, curriculum subject comparisons (Mathematics vs Portuguese Language), milestone progression comparisons (M0 vs M1 vs M2), and multi-milestone individual trajectory analysis.
2. **AI Predictions Hub (`/teacher/predictions`)** — Production prediction management console featuring real backend pagination (`limit`, `skip`, `total_count`), multi-criteria filtering (student, subject, milestone, risk tier), model provenance auditing (`regressor_model`, `classifier_model`), and integrated prediction modal launching.
3. **At-Risk Learners Triage (`/teacher/at-risk`)** — Dedicated academic intervention console categorizing learners into High-Risk, Moderate-Risk, and Unscreened queues. Features mandatory, prominently styled Milestone 0 empirical holdout disclosures (disclosing the 61.54% Math and 75.00% Portuguese false-negative baselines) and evidence-based guidance.
4. **Performance & Route-Based Code Splitting** — Implementation of `React.lazy()` and `<Suspense>` across all application routes, resulting in granular vendor and page chunking without layout flickers or authentication regressions.

All telemetry, student rosters, and prediction data are strictly sourced from real backend endpoints (`api.getTeacherStudents()`, `api.listPredictions()`, `api.getStudentDetails()`). Zero simulated or synthetic records were used.

---

## 2. Inventory of Modified Files

| File Path | Nature of Change | Summary of Modifications |
|---|---|---|
| `frontend/src/pages/teacher/TeacherPerformance.tsx` | Full Implementation | Built complete academic performance analytics console: 4 telemetry cards, grade band Recharts bar chart, subject comparative analytics, milestone telemetry comparisons, multi-milestone progression trajectories, filterable performance table, `StudentProfileDrawer`, and `TeacherPredictionModal`. |
| `frontend/src/pages/teacher/TeacherPredictions.tsx` | Full Implementation | Built dedicated prediction auditing and management interface with real backend pagination, student/subject/milestone/risk filters, confidence/uncertainty pills, model metadata tags, `PredictionDetailModal`, and `TeacherPredictionModal`. |
| `frontend/src/pages/teacher/TeacherAtRisk.tsx` | Full Implementation | Built proactive triage workspace: High Risk and Moderate Risk queues, Unscreened queue, prominent Milestone 0 empirical false-negative disclosure box (61.54% Math, 75.00% Port), recommended action summaries, and real `mailto:` email action triggers. |
| `frontend/src/layouts/DashboardLayout.tsx` | Modified | Embedded `<Suspense>` boundary around `<Outlet />` inside the main workspace container to maintain stable sidebar/navbar state during route-chunk loading. |
| `frontend/src/layouts/AuthLayout.tsx` | Modified | Embedded `<Suspense>` boundary around `<Outlet />` inside the auth card container to support lazy loading of public auth pages. |
| `frontend/src/App.tsx` | Modified | Converted all page routes to dynamic imports with `React.lazy()` and top-level `<Suspense>` fallback, dramatically reducing initial bundle size. |

---

## 3. UI Features & Architectural Implementation

### 3.1 Student Performance Analytics (`/teacher/performance`)

1. **Top Telemetry StatCards:**
   - **Cohort Evaluated Ratio:** Percentage and count of assigned students evaluated (`evaluatedCount / students.length`).
   - **Highest Projected Mark:** Top continuous mark projection in cohort on 0–20 scale.
   - **Median Cohort Mark:** Calculated median mark across latest evaluations.
   - **Lowest Projected Mark:** Lowest continuous mark projection in cohort.
2. **Pedagogical Notice Banner:**
   - Transparent disclaimer: *"Projected marks are mathematical regression estimates on a continuous 0–20 scale derived from student behavioral and historical indicators. They serve as early diagnostic indicators, not official transcript grades."*
3. **Cohort Grade Band Distribution:**
   - Visual distribution using Recharts BarChart categorized by academic tiers:
     - **Distinction (16–20 / 80–100%)** — Emerald tone (`#10B981`)
     - **Merit (14–15.9 / 70–79%)** — Sky tone (`#0EA5E9`)
     - **Satisfactory Pass (10–13.9 / 50–69%)** — Amber tone (`#F59E0B`)
     - **At Risk / Failing (<10 / <50%)** — Rose tone (`#E11D48`)
4. **Curriculum Subject Comparison:**
   - Side-by-side comparative cards for **Mathematics** and **Portuguese Language**:
     - Student evaluation volume.
     - Average projected mark on 0–20 scale.
     - High-Risk vs Moderate-Risk vs Passing distribution counts.
5. **Milestone Telemetry Comparison:**
   - Multi-column comparison comparing Milestone 0 (Pre-enrollment demographics), Milestone 1 (Mid-term coursework), and Milestone 2 (Pre-final evaluations) in terms of assessment volume, mean marks, and average model confidence.
6. **Multi-Milestone Progression Trajectories:**
   - Detects students evaluated across multiple milestones and plots their mark delta ($\Delta \text{Mark}$) with visual trend indicators (Improving, Stable, Regressing).
7. **Filterable Performance Registry:**
   - Searchable student directory with subject dropdown filter, displaying student ID, name, latest subject, milestone, projected mark /20, status badge, and drawer trigger.

### 3.2 AI Predictions Hub (`/teacher/predictions`)

1. **Backend Server-Side Pagination:**
   - Connects to `api.listPredictions({ limit: 15, skip, student_id, subject, milestone })`.
   - Real page navigation (Previous / Next) driven by server `total_count` and calculated total pages.
2. **Multi-Criteria Filter Bar:**
   - **Student Selector:** Dropdown of assigned learners.
   - **Subject Dropdown:** All Subjects, Mathematics, Portuguese Language.
   - **Milestone Dropdown:** All Milestones, M0 (Enrollment), M1 (Mid-Term), M2 (Pre-Final).
   - **Risk Tier Dropdown:** All Tiers, High Risk, Moderate Risk, Low Risk / On Track.
   - **Reset Filter:** Instant reset clearing pagination and all active parameters.
3. **Comprehensive Prediction Audit Table:**
   - Columns: Student (Name + ID), Subject, Milestone pill, Projected Mark /20, `StatusBadge`, Confidence %, Uncertainty Warning alert chip, Audited ML Models (`regressor_model` and `classifier_model`), Assessment Date, and Actions.
4. **Deep Modal Integrations:**
   - **Inspect Button:** Opens `PredictionDetailModal` presenting full feature breakdown, SHAP/proxy contributions, and audit timestamps.
   - **Run New Prediction Button:** Launches `TeacherPredictionModal` directly from the header or toolbar.

### 3.3 At-Risk Intervention & Monitoring (`/teacher/at-risk`)

1. **Telemetry Triage Cards:**
   - **High-Risk Queue:** Immediate pedagogical intervention required (<10 / 20).
   - **Moderate-Risk Queue:** Proactive academic monitoring (10–13.9 / 20).
   - **Urgent Attention Index:** High risk or active uncertainty warning alerts.
   - **Unscreened Learners:** Awaiting initial baseline screening (explicitly distinguished from low risk).
2. **Mandatory Milestone 0 Safety & Empirical False-Negative Disclosure Box:**
   - High-visibility warning box quoting Phase 5A audited holdout confusion matrix baselines:
     - **Mathematics (Milestone 0 Holdout):** 16 false negatives out of 26 failing students (**61.54% false-negative rate**; 38.46% sensitivity).
     - **Portuguese Language (Milestone 0 Holdout):** 15 false negatives out of 20 failing students (**75.00% false-negative rate**; 25.00% sensitivity).
   - Core Pedagogical Safety Protocols:
     - *"Milestone 0 relies exclusively on pre-enrollment socio-demographic features before any classroom coursework or term grades exist."*
     - *"A 'Low Risk' prediction at Milestone 0 does NOT guarantee student success, and the AI model does NOT detect every student in need of academic support."*
     - *"Unscreened students must NEVER be classified as low risk. Predicted marks are continuous regression projections, not transcript grades."*
3. **Queue Segmentation & Filters:**
   - Tab switcher: `All At-Risk Learners`, `High Risk Only`, `Moderate Risk Only`, and `Unscreened Learners`.
   - Name/Email search input, curriculum subject dropdown, and milestone dropdown.
4. **Actionable Intervention Cards:**
   - Visual risk tier badge, student avatar, institutional email, subject, milestone, projected score /20, model confidence %, uncertainty warning chip, and audited classifier model.
   - Evidence-based **Recommended Action** text from `early_warning_advisory?.recommended_action` or synthesized intervention protocols.
   - Actions:
     - **Profile:** Opens `StudentProfileDrawer`.
     - **Inspect:** Opens `PredictionDetailModal`.
     - **Re-Assess / Screen Now:** Launches `TeacherPredictionModal`.
     - **Email:** Direct browser `mailto:${student.email}` client trigger (honest system, no fake internal messaging).

### 3.4 Performance & Route-Based Code Splitting

1. **Dynamic Chunking with `React.lazy()`:**
   - Converted all 17 public, student, teacher, and admin page components from monolithic static imports to dynamic imports.
2. **Suspense Boundaries:**
   - Top-level `Suspense` in `App.tsx` handles initial load and unauthorized/not-found transitions.
   - Layout-level `Suspense` in `DashboardLayout.tsx` preserves navbar and sidebar visibility while rendering page chunks.
   - Layout-level `Suspense` in `AuthLayout.tsx` preserves branding split-screen presentation.
3. **Vite Production Build Output:**
   - Verified that Vite chunks each page independently:
     - `TeacherPerformance`: 21.76 kB (5.91 kB gzip)
     - `TeacherAtRisk`: 18.74 kB (5.60 kB gzip)
     - `TeacherOverview`: 11.64 kB (3.97 kB gzip)
     - `TeacherPredictions`: 9.80 kB (3.08 kB gzip)
     - `TeacherStudents`: 9.01 kB (3.13 kB gzip)
     - Recharts chunk (`generateCategoricalChart`): 397.92 kB (109.27 kB gzip) isolated only to pages using charts.

---

## 4. Verification & Testing

### 4.1 Frontend TypeScript & Vite Compilation

Executed `npm.cmd run build` from `c:\Users\Azan's PC\Documents\EduPredict\frontend`:
- `tsc -b`: 0 errors.
- Vite build: 2,043 modules transformed into optimized chunks in 14.73s.
- Zero bundle or runtime type mismatches.

### 4.2 Backend Pytest Test Suite

Executed `.venv\Scripts\pytest.exe -v` across the entire test suite:
- **Total Tests Collected:** 89
- **Passed:** 89
- **Failed:** 0
- **Duration:** 48.73s
- **Pass Rate:** 100%

Key tests verified:
- `test_milestone_0_advisory_canonical_keys_and_empirical_metrics`: PASSED
- `test_teacher_overview_and_roster_data_integrity`: PASSED
- `test_admin_list_predictions_pagination_total_count`: PASSED
- `test_teacher_predict_assigned_vs_unassigned_student`: PASSED
- `test_prediction_history_teacher_scoping`: PASSED

---

## 5. Architectural Boundaries & Phase 5D-E Readiness

1. **Preserved Backend & DB Contracts:**
   - No modifications to MongoDB schemas, Flask endpoints, or authentication.
   - Teacher-student assignment architecture preserved without introducing subject-based assignments.
2. **Readiness for Phase 5D-E:**
   - Foundation stubs for `TeacherReports`, `TeacherProfile`, and `TeacherSettings` remain ready for Phase 5D-E.
   - All shared modals and design tokens are standardized.
