# EduPredict — Role-Based Dashboard Upgrade & Information Architecture Report

**Document Reference**: `documentation/DASHBOARD_UPGRADE_REPORT.md`  
**Execution Date**: 2026-11-19  
**Status**: APPROVED & FULLY VERIFIED  
**Architecture Version**: Phase 7 / EduPredict 2.0  
**Stack**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Flask, MongoDB 6.0  

---

## Executive Summary

Pursuant to the Aptech EduPredict Software Requirements Specification (SRS) and the role-based dashboard upgrade mandate, EduPredict has successfully reorganized, structured, and upgraded its entire frontend and navigation architecture across all four authorized system personas:
1. **System Administrator** (17 dedicated routes)
2. **Teacher Workspace** (14 dedicated routes)
3. **Student Learning Portal** (12 dedicated routes)
4. **Institutional Analyst Hub** (9 dedicated routes)

The upgraded interface provides an intuitive information architecture, responsive collapsible sidebar navigation, live MongoDB 6.0 connection telemetry, real-time notifications dropdown, dynamic breadcrumb tracking, and comprehensive Statistical Disclosure Control (SDC) cell suppression protection for aggregate analytics.

---

## 1. Previous vs. New Dashboard Navigation Structure

| Role | Previous State | Upgraded Information Architecture | Key Upgrades |
| :--- | :--- | :--- | :--- |
| **Administrator** | Fragmented flat menu (4 routes: Overview, Users, Teacher Assignments, Logs). | **17 categorized routes** across Core, Academic Structure, AI Analytics, and Governance. | Added Student Roster, Teacher Roster, Curriculum Management, Student Enrollments, Academic Records, Predictions Hub, Risk Monitoring, Analytics Studio, System Reports, and Data Management. |
| **Teacher** | Basic 5-route sidebar with unselected subject ambiguity. | **14 categorized routes** across Teaching, Performance & Records, AI Intelligence, and Class Operations. | Integrated Subject Workspace Context switcher, Subject Curriculum, Academic Records, Anomaly Detection, Attendance Velocity, Communication Feedback, and Profile/Settings. |
| **Student** | Limited 3-route menu (Overview, Self-Assessment, Records). | **12 categorized routes** across Academic Portal, AI Diagnostics, and Student Services. | Added Course Enrollments, Performance Benchmarks, Progress Trajectories, Explainable AI Recommendations, Attendance & Velocity, Notifications, and Feedback. |
| **Analyst** | No frontend workspace existed (backend-only role). | **9 dedicated macro-reporting routes** protected by SDC suppression rules. | Macro Overview, Institutional Analytics, Curriculum Distribution, Longitudinal Trends, Risk Vulnerability, Anomaly Detection, Data Quality, and Report Export. |

---

## 2. Comprehensive Catalog of Navigation Routes and Pages

### 2.1 Administrator Workspace (17 Routes)
- `/admin` — **Executive Institutional Overview**: Top-level KPI metrics, user distribution, AI evaluations, system logs.
- `/admin/students` — **Student Management**: Student directory with drawer profile view and enrollment status.
- `/admin/teachers` — **Teacher Directory**: Faculty listing, subject assignments, department metrics.
- `/admin/users` — **User Role Management**: RBAC elevation, user promotion, account status toggle.
- `/admin/curriculum` — **Curriculum & Disciplines**: Subject registry (Mathematics, Portuguese), course codes, active terms.
- `/admin/enrollments` — **Student Enrollments**: Active student course enrollments, cohort management, registration modal.
- `/admin/teacher-assignments` — **Faculty Subject Allocations**: Assign teachers to subject disciplines.
- `/admin/records` — **Institutional Academic Records**: Complete student academic history across cohorts.
- `/admin/analytics` — **Executive Performance Analytics**: Macro grade distributions, milestone trajectories, cross-subject benchmarks.
- `/admin/predictions` — **Institutional Predictions Registry**: Master log of all AI evaluations with audit trails.
- `/admin/risk-monitoring` — **Early Warning & Risk Monitoring**: High and moderate risk queues with escalation status.
- `/admin/reports` — **Institutional Reports**: Automated CSV data export and audit-ready academic reports.
- `/admin/data-management` — **Data Management & Backups**: MongoDB 6.0 telemetry, health check, collection statistics.
- `/admin/logs` — **Security & Audit Logs**: Immutable audit log of administrative actions and authentication events.
- `/admin/notifications` — **System Notification Center**: Broadcast and environment health notifications.
- `/admin/feedback` — **User Feedback Management**: Review and resolve submitted faculty and student inquiries.
- `/admin/settings` — **Administrator Settings**: Profile updates, security credentials, platform configuration.

### 2.2 Teacher Workspace (14 Routes)
- `/teacher` — **Classroom Cockpit**: Subject-scoped KPI summary, active student count, class performance average.
- `/teacher/students` — **Assigned Student Roster**: Filterable roster of students enrolled in the teacher's active subject.
- `/teacher/subjects` — **My Teaching Subjects**: View assigned subjects and switch active context.
- `/teacher/academic-records` — **Student Academic Records**: Subject-specific milestone records and evaluation histories.
- `/teacher/predictions` — **AI Predictions Hub**: Run new predictions with teacher-prediction modal and view history.
- `/teacher/at-risk` — **At-Risk Queue**: Prioritized student intervention list based on predictive risk classification.
- `/teacher/performance` — **Performance Analytics**: Class grade distribution histogram and milestone progression curves.
- `/teacher/anomalies` — **Performance Anomalies**: Detect friction discrepancies (e.g. high study time vs low scores).
- `/teacher/attendance` — **Attendance & Absences**: Absenteeism tracker correlating absences with risk velocity.
- `/teacher/reports` — **Classroom Reports**: Generate class-level performance and intervention reports.
- `/teacher/notifications` — **Teacher Notifications**: Evaluation window deadlines and system announcements.
- `/teacher/feedback` — **Departmental Feedback**: Submit feedback directly to department heads and administration.
- `/teacher/profile` — **Teacher Profile**: Professional faculty profile and assigned departments.
- `/teacher/settings` — **Account Settings**: Password updates and profile configuration.

### 2.3 Student Learning Portal (12 Routes)
- `/student` — **Academic Student Overview**: Active GPA forecast, risk status badge, enrolled course summary.
- `/student/subjects` — **Enrolled Subjects**: Verified registered subjects, grading scale details, and direct evaluation links.
- `/student/records` — **Academic History**: Historical academic records, term progress, and past grades.
- `/student/predictions` — **AI Grade Predictor**: Self-assessment predictor allowing students to simulate outcomes.
- `/student/performance` — **Performance Analytics**: Visual grade radar charts and milestone benchmarks.
- `/student/progress` — **Progress Trajectory**: Longitudinal prediction curve tracking improvement across runs.
- `/student/recommendations` — **AI Study Recommendations**: Transparent, feature-driven guidance (study hours, absence reduction).
- `/student/attendance` — **Attendance & Absence Tracker**: Absence impact simulation on academic risk.
- `/student/notifications` — **Student Notifications**: Exam schedules, milestone windows, and academic alerts.
- `/student/feedback` — **Student Feedback**: Direct feedback form to submit course and instructor inquiries.
- `/student/profile` — **Student Profile**: Academic details, enrollment ID, and registered contact info.
- `/student/settings` — **Account Settings**: Secure password updates and personal preferences.

### 2.4 Institutional Analyst Hub (9 Routes)
- `/analyst` — **Research & Analytics Hub**: Top-level executive overview with SDC cell-suppression badges.
- `/analyst/institutional` — **Institutional Metrics**: Macro enrollment breakdown, faculty distribution, and system volume.
- `/analyst/curriculum` — **Curricular Performance**: De-identified course statistics respecting minimum cohort thresholds ($N < 5$).
- `/analyst/trends` — **Longitudinal Trends**: Semester-over-semester performance trajectory curves.
- `/analyst/risk` — **Macro Risk Analytics**: Institutional attrition vulnerability modeling with transparent advisory disclosures.
- `/analyst/anomalies` — **System Health & Diagnostic Telemetry**: Non-sensitive analytical diagnostics.
- `/analyst/data-quality` — **Data Quality & Integrity**: Dataset schema compliance, missing value audits, dual-enrolled cohort metrics.
- `/analyst/reports` — **Analyst Reports Export**: De-identified statistical export with privacy protections.
- `/analyst/settings` — **Analyst Account Settings**: Account credentials and configuration.

---

## 3. UI/UX Design System Upgrades

1. **Collapsible Responsive Sidebar**:
   - Expanded width: `256px` (`w-64`).
   - Collapsed width: `76px` (`w-20`).
   - Smooth CSS transitions (`transition-all duration-300`).
   - Interactive hover tooltips for icon-only mode.
   - Distinct color-coded role badges (Admin = Purple, Teacher = Royal Blue, Student = Mint Green, Analyst = Amber).
2. **Branding & Visual Palette**:
   - Royal Blue (`#2455C5`) for primary actions and active navigation items.
   - Ocean Blue (`#168CCB`) for analytical charts and secondary highlights.
   - Mint Teal (`#18D6B5`) for positive status indicators, high performance, and on-track metrics.
   - Dark Slate / Navy theme backgrounds for high-contrast readability.
3. **Universal Navigation Bar**:
   - Real-time MongoDB 6.0 connection telemetry indicator (`Operational` pulse).
   - Dynamic breadcrumb trail resolving against the active route path.
   - Notifications center modal/dropdown displaying verified environment events.
   - User profile dropdown with quick navigation to role-specific settings and secure logout.

---

## 4. Security, RBAC & Statistical Disclosure Control (SDC)

1. **Role-Based Access Control**:
   - Every route is wrapped in `<ProtectedRoute allowedRoles={[...]}>`.
   - Direct URL access to unauthorized routes redirects immediately to `/unauthorized`.
2. **Subject-Based Access Control (Teacher Workspace)**:
   - Preserves `TeacherSubjectContext` with mandatory subject selector.
   - Teacher views are strictly filtered by `selectedSubjectId`.
   - Prevents cross-subject student record or prediction leakage.
3. **Statistical Disclosure Control (SDC) on Analyst Workspace**:
   - Small-cohort suppression ($1 \le N \le 4$) strictly observed.
   - Numerical values return `null` with formatted display strings (`<5`) and explicit suppression flags.
   - Transparent disclaimer regarding the Academic Attrition Vulnerability Indicator.

---

## 5. Verification & Test Suite Execution

### 5.1 Backend Pytest Regression Suite
- **Command**: `.venv\Scripts\pytest -v`
- **Result**: **140 / 140 PASSED** (100% pass rate in 109s)
- **Coverage**:
  - `test_admin.py` (7/7 passed)
  - `test_analyst_rbac.py` (19/19 passed)
  - `test_auth.py` (10/10 passed)
  - `test_prediction_api.py` (22/22 passed)
  - `test_rbac.py` (8/8 passed)
  - `test_subject_models_and_services.py` (10/10 passed)
  - `test_subject_rbac.py` (14/14 passed)
  - `test_data_pipeline.py`, `test_app_factory.py`, `test_config.py` (all passed)

### 5.2 Frontend Vitest Test Suite
- **Command**: `cd frontend; npm.cmd test -- --run`
- **Result**: **15 / 15 PASSED** (100% pass rate)
- **Suite**: `src/__tests__/subject_workspace.test.tsx`

### 5.3 TypeScript Strict Typecheck
- **Command**: `cd frontend; npx.cmd tsc -b`
- **Result**: **0 errors** (Clean exit code 0)

### 5.4 Production Build Verification
- **Command**: `cd frontend; npm.cmd run build`
- **Result**: **SUCCESS** (2,080 modules transformed, optimized chunks generated in 15.14s)

---

## 6. Git Version Control Summary

- **Repository**: `C:\Users\Azan's PC\Documents\EduPredict`
- **Branch**: `main`
- **Tracking Remote**: `origin/main`
- **Commit Hash**: `513455b44238b043e72d78ee3d8246135a18c021`
- **Commit Message**: `feat(dashboard): upgrade role-based AI analytics workspaces`
- **Push Verification**: Successfully pushed to `https://github.com/azanali30/EduPredict.git` (`main -> main`)
- **Cleanliness Check**: No `.env` secrets, no credentials, and no raw CSV databases tracked in git index.

