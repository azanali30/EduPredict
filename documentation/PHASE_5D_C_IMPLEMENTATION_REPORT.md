# EduPredict — Phase 5D-C: Teacher Overview & Student Roster Implementation Report

**Document Version:** 1.0.0  
**Phase:** 5D-C (Teacher Overview & Student Roster Redesign)  
**Status:** Completed & Fully Verified  
**Project Path:** `C:\Users\Azan's PC\Documents\EduPredict`  
**Repository:** [https://github.com/azanali30/EduPredict](https://github.com/azanali30/EduPredict)  
**Author:** Senior Machine Learning Engineer / Lead UI-UX Architect  
**Date:** November 18, 2026  

---

## 1. Executive Summary

Phase 5D-C delivers the complete visual and functional redesign of the primary teacher workspaces:
1. **Teacher Classroom Overview (`/teacher`)** — Executive command center featuring 4 core KPIs, Recharts cohort risk distribution, Priority Attention Queue, and Recent AI Predictions telemetry.
2. **Assigned Student Roster (`/teacher/students`)** — High-density student management directory featuring multi-criteria search, risk/subject filters, working slide-over Student Profile Drawer, and prediction assessment launchers.

All metrics, student tables, and prediction feeds are strictly backed by real, authenticated MongoDB and Flask endpoints. Zero fabricated metrics, fake students, or simulated grades were introduced.

---

## 2. Inventory of Modified & Created Files

| File Path | Nature of Change | Summary of Modifications |
|---|---|---|
| `frontend/src/pages/teacher/TeacherOverview.tsx` | Redesigned | Implemented 4 core KPIs, Recharts risk distribution chart with coverage disclaimer, Priority Attention Queue, Recent AI Predictions feed, slide-over `StudentProfileDrawer`, and `PredictionDetailModal`. |
| `frontend/src/pages/teacher/TeacherStudents.tsx` | Redesigned | Implemented search toolbar (name, ID, email), risk-status filter, subject filter, academic roster table, working `StudentProfileDrawer`, and `TeacherPredictionModal`. |
| `tests/test_prediction_api.py` | Added Test | Added `test_teacher_overview_and_roster_data_integrity` validating teacher assigned student scoping, empty prediction handling, and profile inspection data safety. |
| `documentation/PHASE_5D_C_IMPLEMENTATION_REPORT.md` | Created | Technical architecture, data mapping, test results, and limitations report. |

---

## 3. UI Features & Architectural Implementation

### 3.1 Teacher Overview (`/teacher`)

1. **Four Core KPI Cards:**
   - **Total Assigned Students:** Count of active students mapped to the teacher (`students.length`).
   - **Students with High Risk:** Count of assigned students whose latest prediction status is `'High Risk'` (`highRiskCount`).
   - **Students with Moderate Risk:** Count of assigned students whose latest prediction status is `'Moderate Risk'` (`modRiskCount`).
   - **Students Not Yet Screened:** Count of assigned students without any prediction record in the loaded sample (`unscreenedCount = students.length - evaluatedCount`).
2. **Student Risk Distribution (Recharts):**
   - Renders cohort classification across High Risk (`#E11D48`), Moderate Risk (`#F59E0B`), Low Risk (`#10B981`), and Unscreened (`#94A3B8`).
   - Includes transparent data coverage note disclosing that risk classifications represent the latest prediction per student from the loaded sample of assessments.
3. **Priority Attention Queue:**
   - Automatically filters and sorts learners flagged as High Risk or Moderate Risk.
   - Displays student identity, institutional email, course subject, `StatusBadge`, and projected mark out of 100.
   - Working **View Student** action opening the `StudentProfileDrawer`.
   - Working **Re-Assess** action opening the `TeacherPredictionModal`.
   - Clean, positive empty state when no students are flagged at risk.
4. **Recent AI Predictions Stream:**
   - Displays the 6 most recent predictions generated for the teacher's cohort.
   - Columns: Student name (mapped from ID), Subject, Milestone (`M0`, `M1`, `M2`), Projected Mark, Risk Status, and Date.
   - Working **Details** button triggering `PredictionDetailModal` for deep feature/confidence audit.
5. **Loading, Empty & Error States:**
   - Utilizes `LoadingState`, `ErrorState` with retry button, and `EmptyState`.

### 3.2 My Students Directory (`/teacher/students`)

1. **Search & Multi-Criteria Filtering:**
   - Real-time search by student name, ID, or institutional email.
   - Risk status filter: `All Cohort`, `High Risk`, `Moderate Risk`, `Low Risk / On Track`, and `Not Yet Screened`.
   - Subject filter: `All Subjects`, `Mathematics`, and `Portuguese Language` (mapped to students' latest recorded assessment).
   - Dynamic reset action and live count indicator (`Showing X of Y assigned learners`).
2. **Cohort Attention Banner:**
   - Prominent notification alert when learners are flagged as High or Moderate risk, complete with a single-click button to filter flagged learners.
3. **Student Information Table:**
   - Displays student name with avatar initial, monospace database ID snippet (`s.id.slice(-8)`), email, enrolled date, subject, `StatusBadge` (with clear `'Unscreened'` pill if unassessed), and continuous projected mark.
   - Working **Profile** action opening the `StudentProfileDrawer`.
   - Working **Assess AI** / **Assess Initial** action launching the `TeacherPredictionModal`.

### 3.3 Student Profile Drawer Integration

The slide-over `StudentProfileDrawer` seamlessly displays real data from authorized API responses:
- Student database ID
- Full Name and institutional email
- Account enrollment date and active status
- Latest AI assessment summary (subject, milestone, risk tier, projected mark, model confidence probability, and uncertainty warning notice)
- Direct **Launch AI Assessment** shortcut.
- Zero private credentials, session tokens, or password hashes exposed.

---

## 4. API Endpoints & Data Mapping Matrix

| Page / Component | Metric / Action | Backend Endpoint | HTTP Method | Data Source & Transformation |
|---|---|---|---|---|
| **Overview KPIs** | Total Assigned Students | `/api/teacher/students` | `GET` | `students.length` |
| **Overview KPIs** | High / Moderate Risk Counts | `/api/predictions?limit=100` | `GET` | Computed across latest prediction per assigned student (`latestPredMap`) |
| **Overview KPIs** | Unscreened Students Count | Mapped in memory | N/A | `students.length - evaluatedStudentsCount` |
| **Overview Chart** | Risk Distribution | `/api/predictions?limit=100` | `GET` | Aggregated counts by `predicted_status` + `Unscreened` |
| **Overview Table** | Priority Attention Queue | Filtered in memory | N/A | Filtered `predicted_status in ['High Risk', 'Moderate Risk']` |
| **Overview Table** | Recent Predictions | `/api/predictions?limit=100` | `GET` | `predictions.slice(0, 6)` |
| **My Students** | Roster Table | `/api/teacher/students` | `GET` | `students` array combined with `latestPredMap` |
| **My Students** | Prediction Modal | `/api/predictions` | `POST` | Generates new prediction for `student.id` |
| **My Students** | Profile Drawer | `/api/students/<student_id>` | `GET` | Scoped by `can_access_student_data` check |

---

## 5. Authorization & Data Integrity Guardrails

1. **Teacher Assignment Boundary:** The Flask backend verifies assignment through `AssignmentService.get_students_for_teacher()`. Teachers can only retrieve or predict for students assigned to them in MongoDB.
2. **No False Low-Risk Assumptions:** Students without an assessment are explicitly labeled and counted as **"Unscreened"** / **"Not Yet Screened"** with a neutral slate badge; they are never treated as low risk.
3. **Preservation of ML Governance:**
   - Milestone 0, 1, and 2 feature restrictions are maintained.
   - Prohibited features (`G3`, final exam marks, academic status) remain strictly blocked.
   - Milestone 0 empirical false-negative rate caveats (61.54% Math, 75.00% Port) remain prominent in the assessment modal.
4. **No Data Leakage:** `User.to_dict()` excludes `password_hash`. All API responses omit sensitive authentication artifacts.

---

## 6. Verification & Automated Test Results

### 6.1 Frontend Production Build & TypeScript Type Checking
- **Command:** `cd frontend; npm.cmd run build` (`tsc -b && vite build`)
- **Result:** **PASSED (0 TypeScript Errors)**
- **Output:**
  - `dist/index.html`: 0.81 kB
  - `dist/assets/index-B-w2Ssx4.css`: 43.14 kB
  - `dist/assets/index-Dyt74ZD3.js`: 835.81 kB
  - Built in **18.72s**

### 6.2 Backend Pytest Suite
- **Command:** `.venv\Scripts\pytest.exe -v`
- **Result:** **89 / 89 tests PASSED (100% pass rate in 50.17s)**
- **New Test Added:** `test_teacher_overview_and_roster_data_integrity`
  - Validates assigned student isolation via `/api/teacher/students`.
  - Validates empty prediction history handling (returns empty list with `total_count == 0`).
  - Validates student profile inspection data safety (omits `password_hash`).
  - Validates prediction generation for assigned student and confirms overview listing reflects the record.

---

## 7. Known Limitations & Boundaries

1. **Pagination Limits on In-Memory Slices:** The teacher overview and roster currently query up to 100 recent predictions via `/api/predictions?limit=100`. If an assigned cohort exceeds 100 historical assessments, client-side distribution represents the latest 100 records as disclosed in the UI disclaimer note.
2. **Upcoming Modules:** Pages for Student Performance (`/teacher/performance`), Predictions Hub (`/teacher/predictions`), and At-Risk Triage (`/teacher/at-risk`) remain active foundation stubs and will be implemented in **Phase 5D-D**.
3. **Future Functional Modules:** Attendance registers, timetable schedules, and assignment gradebooks are not present in the backend and remain disclosed as future roadmap features.

---

## 8. Phase 5D-C Conclusion

Phase 5D-C is complete, verified, and ready for review. All code changes remain strictly focused on the Teacher Overview and Student Roster. Execution is stopped in accordance with instructions.
