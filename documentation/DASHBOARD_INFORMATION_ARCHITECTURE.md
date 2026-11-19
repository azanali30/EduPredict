# EduPredict — Dashboard Information Architecture & Navigation Audit
## Comprehensive Role-Based Workspaces & Information Architecture Specification

**Document Version:** 1.0.0  
**Date:** November 19, 2026  
**Author:** Senior Product Designer & React Architect  
**Project Workspace:** `C:\Users\Azan's PC\Documents\EduPredict`  
**Application Stack:** React 18, TypeScript, Vite 5, Tailwind CSS, Recharts, Lucide Icons, Flask 3, MongoDB 6  

---

## 1. Executive Summary & Audit Overview

EduPredict is an AI-driven educational analytics and predictive intelligence platform designed according to the original Aptech eProject specification. The application supports four distinct user roles:
1. **Administrator (Governance & System Administration)**
2. **Teacher (Classroom Analytics & AI Teaching Intelligence)**
3. **Student (Personal Academic Performance & Growth Hub)**
4. **Analyst (Institutional Research, Curriculum Telemetry & SDC Analytics)**

This document details the **Phase 1 Information Architecture (IA) Audit**, mapping current frontend layouts, routes, pages, APIs, and components, and establishing the unified role-based navigation specification to be implemented across all four roles.

---

## 2. Current State vs. Target Navigation Audit

### 2.1 Administrator Role

#### Current State (Baseline)
- **Current Routes:**
  - `/admin`: `AdminOverview.tsx` (Institutional telemetry, user role distribution, prediction count, risk breakdown, inspection modal).
  - `/admin/users`: `UserManagement.tsx` (Directory of system users, role filtering, role change modal).
  - `/admin/assignments`: `TeacherAssignments.tsx` (Multi-tab interface: Subjects, Teacher Allocations, Student Enrollments, Legacy Linkages).
  - `/admin/logs`: `SystemLogs.tsx` (Security audit logs, action filtering, export).
- **Current Navigation:** 4 sidebar items only.
- **Backend APIs Operational:**
  - `GET /api/admin/users`, `PUT /api/admin/users/<id>/role`
  - `GET /api/admin/subjects`, `POST /api/admin/subjects`, `PUT /api/admin/subjects/<id>/status`
  - `GET /api/admin/teacher-subjects`, `POST /api/admin/teacher-subjects`, `PUT /api/admin/teacher-subjects/<id>/status`
  - `GET /api/admin/student-enrollments`, `POST /api/admin/student-enrollments`, `PUT /api/admin/student-enrollments/<id>/status`
  - `GET /api/admin/logs`
  - `GET /api/health`, `GET /api/health/db`
  - `GET /api/predictions`, `GET /api/predictions/options`

#### Target Information Architecture (17 Distinct Navigation Pages)
| # | Navigation Item | Route Path | Implementation Plan | API Integration Source |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Overview** | `/admin` | Reused & upgraded `AdminOverview.tsx` | `api.getAdminUsers()`, `api.getHealth()`, `api.listPredictions()` |
| 2 | **User Management** | `/admin/users` | Reused `UserManagement.tsx` | `api.getAdminUsers()`, `api.updateUserRole()` |
| 3 | **Student Management** | `/admin/students` | Dedicated student directory with enrollment lookup | `api.getAdminUsers('student')`, `api.adminListStudentEnrollments()` |
| 4 | **Teacher Management** | `/admin/teachers` | Dedicated faculty directory with subject workload | `api.getAdminUsers('teacher')`, `api.adminListTeacherSubjects()` |
| 5 | **Subject & Curriculum** | `/admin/curriculum` | Curriculum catalog & subject creation console | `api.adminListSubjects()`, `api.adminCreateSubject()`, `api.adminUpdateSubjectStatus()` |
| 6 | **Student Enrollments** | `/admin/enrollments` | Dedicated student-course enrollment governance | `api.adminListStudentEnrollments()`, `api.adminEnrollStudent()`, `api.adminUpdateStudentEnrollmentStatus()` |
| 7 | **Teacher Assignments** | `/admin/assignments` | Faculty-subject allocation management | `api.adminListTeacherSubjects()`, `api.adminAssignTeacherSubject()`, `api.adminUpdateTeacherSubjectStatus()` |
| 8 | **Academic Records** | `/admin/academic-records` | Institutional academic records overview | `api.getAdminUsers('student')`, `api.adminListSubjects()` |
| 9 | **Performance Analytics**| `/admin/analytics` | Executive institutional grade & trend analytics | `api.listPredictions()`, `api.adminListSubjects()` |
| 10 | **AI Predictions** | `/admin/predictions` | Institution-wide predictive intelligence console | `api.listPredictions()`, `api.getPredictionOptions()`, `api.getPredictionDetail()` |
| 11 | **Risk & Anomaly Monitoring**| `/admin/risk-monitoring` | Institutional at-risk queue & early-warning triage | `api.listPredictions()` (filtered for High/Moderate risk) |
| 12 | **Reports & Exports** | `/admin/reports` | Executive summary generator & data exports | Institutional reporting generator (CSV/JSON) |
| 13 | **Data Management & Imports**| `/admin/data-management`| Database health, collections, data provenance | `api.getHealth()` (MongoDB 6 status, collection telemetry) |
| 14 | **Notifications & Alerts**| `/admin/notifications` | Institutional security & administrative alerts | Administrative alerts console |
| 15 | **Feedback & Support** | `/admin/feedback` | User inquiries & platform feedback triage | Institutional support center |
| 16 | **System Monitoring** | `/admin/logs` / `/admin/system-monitoring` | Security audit trail & server health monitor | `api.getAuditLogs()`, `api.getHealth()` |
| 17 | **Profile & Settings** | `/admin/settings` | Admin account security, preferences & credentials | `api.getMe()`, `api.updateProfile()`, `api.changePassword()` |

---

### 2.2 Teacher Role

#### Current State (Baseline)
- **Current Routes:**
  - `/teacher`: `TeacherOverview.tsx` (Subject context switcher, assigned student count, risk metrics, recent students roster, prediction drawer).
  - `/teacher/students`: `TeacherStudents.tsx` (Assigned student list, profile drawer, run prediction button).
  - `/teacher/performance`: `TeacherPerformance.tsx` (Classroom grade distributions, milestone bar charts).
  - `/teacher/predictions`: `TeacherPredictions.tsx` (Subject prediction history, run prediction modal).
  - `/teacher/at-risk`: `TeacherAtRisk.tsx` (At-risk student triage list, action items).
  - `/teacher/reports`: `TeacherReports.tsx` (Classroom reporting and roster export).
  - `/teacher/profile`: `TeacherProfile.tsx` (Teacher details, assigned subjects list).
  - `/teacher/settings`: `TeacherSettings.tsx` (Workspace preferences, password change).
- **Current Navigation:** 8 sidebar items.
- **Backend APIs Operational:**
  - `GET /api/teacher/subjects`
  - `GET /api/teacher/students?subject_id=<id>`
  - `GET /api/students/<id>` (scoped by subject assignment)
  - `POST /api/predictions`, `GET /api/predictions`, `GET /api/predictions/options`, `GET /api/predictions/<id>`
  - `GET /api/me`, `PUT /api/me`, `PUT /api/me/password`

#### Target Information Architecture (14 Distinct Navigation Pages)
| # | Navigation Item | Route Path | Implementation Plan | API Integration Source |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Overview** | `/teacher` | Reused & upgraded `TeacherOverview.tsx` | `api.getTeacherStudents()`, `api.listPredictions()` |
| 2 | **My Subjects** | `/teacher/subjects` | Dedicated subject syllabus & enrollment view | `api.getTeacherSubjects()` |
| 3 | **My Students** | `/teacher/students` | Reused `TeacherStudents.tsx` | `api.getTeacherStudents()`, `api.getStudentDetails()` |
| 4 | **Academic Records** | `/teacher/academic-records` | Classroom marks & assessment history | `api.getTeacherStudents()`, `api.listPredictions()` |
| 5 | **Performance Analytics**| `/teacher/performance` | Reused `TeacherPerformance.tsx` | `api.getTeacherStudents()`, `api.listPredictions()` |
| 6 | **AI Predictions** | `/teacher/predictions` | Reused `TeacherPredictions.tsx` | `api.listPredictions()`, `api.createPrediction()` |
| 7 | **At-Risk Students** | `/teacher/at-risk` | Reused `TeacherAtRisk.tsx` | `api.getTeacherStudents()`, `api.listPredictions()` |
| 8 | **Anomaly Monitoring** | `/teacher/anomalies` | Discrepancy & unexpected trajectory alerts | `api.listPredictions()` (advisory discrepancy indicators) |
| 9 | **Attendance Records** | `/teacher/attendance` | Attendance proxy velocity (clearly labeled proxy) | `api.getTeacherStudents()`, `api.listPredictions()` |
| 10 | **Reports** | `/teacher/reports` | Reused `TeacherReports.tsx` | `api.getTeacherStudents()`, `api.listPredictions()` |
| 11 | **Notifications** | `/teacher/notifications` | Classroom notices, milestone alerts | Classroom alert notification center |
| 12 | **Feedback & Support** | `/teacher/feedback` | Student academic notes & faculty helpdesk | Faculty support & academic feedback |
| 13 | **My Profile** | `/teacher/profile` | Reused `TeacherProfile.tsx` | `api.getMe()`, `api.getTeacherSubjects()` |
| 14 | **Settings** | `/teacher/settings` | Reused `TeacherSettings.tsx` | `api.getMe()`, `api.updateProfile()`, `api.changePassword()` |

---

### 2.3 Student Role

#### Current State (Baseline)
- **Current Routes:**
  - `/student`: `StudentOverview.tsx` (Hero greeting, KPIs, enrolled subjects, academic velocity chart, radar chart).
  - `/student/profile`: `StudentProfile.tsx` (Demographic profile, study background, password change).
  - `/student/records`: `StudentRecords.tsx` (Subject list, attendance proxy, past grades).
  - `/student/predictions`: `StudentPredictions.tsx` (Prediction history, self-assessment form).
- **Current Navigation:** 4 sidebar items.
- **Backend APIs Operational:**
  - `GET /api/student/subjects`
  - `GET /api/me`, `PUT /api/me`, `PUT /api/me/password`
  - `POST /api/predictions`, `GET /api/predictions`, `GET /api/predictions/options`, `GET /api/predictions/<id>`

#### Target Information Architecture (12 Distinct Navigation Pages)
| # | Navigation Item | Route Path | Implementation Plan | API Integration Source |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Overview** | `/student` | Reused & upgraded `StudentOverview.tsx` | `api.getStudentSubjects()`, `api.listPredictions()` |
| 2 | **My Profile** | `/student/profile` | Reused `StudentProfile.tsx` | `api.getMe()`, `api.updateProfile()` |
| 3 | **My Subjects** | `/student/subjects` | Dedicated enrolled courses & faculty info | `api.getStudentSubjects()` |
| 4 | **Academic Records** | `/student/records` | Reused `StudentRecords.tsx` | `api.getStudentSubjects()`, `api.getMe()` |
| 5 | **Performance Analytics**| `/student/performance` | Personal learning trends & radar benchmarks | `api.listPredictions()`, `api.getStudentSubjects()` |
| 6 | **AI Predictions** | `/student/predictions` | Reused `StudentPredictions.tsx` | `api.listPredictions()`, `api.createPrediction()` |
| 7 | **My Progress & Trends**| `/student/progress` | Learning velocity over time & study correlations | `api.listPredictions()`, `api.getStudentSubjects()` |
| 8 | **Improvement Recommendations**| `/student/recommendations` | Explainable study recommendations & intervention tips | Personalized academic advisory engine |
| 9 | **Attendance Records** | `/student/attendance` | Attendance proxy tracking & consistency metrics | Heuristic attendance proxy tracking |
| 10 | **Notifications** | `/student/notifications` | Exam reminders, milestone alerts | Student notification center |
| 11 | **Feedback & Support** | `/student/feedback` | Course feedback & academic advisor support | Student feedback & counseling portal |
| 12 | **Settings** | `/student/settings` | Personal account preferences & security | `api.getMe()`, `api.changePassword()` |

---

### 2.4 Analyst Role

#### Current State (Baseline)
- **Current Routes:** None (Role added at backend in Phase 7A).
- **Backend APIs Operational:**
  - `GET /api/analyst/overview` (Institutional aggregates with $N < 5$ cell suppression & complementary suppression)
  - `GET /api/analyst/curriculum-stats` (Subject-wise metrics with $N < 5$ cell suppression)
  - `GET /api/analyst/diagnostics` (Strict analyst diagnostic channel)
  - `GET /api/me`, `PUT /api/me`, `PUT /api/me/password`

#### Target Information Architecture (9 Distinct Navigation Pages)
| # | Navigation Item | Route Path | Implementation Plan | API Integration Source |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Overview** | `/analyst` | Institutional macro KPI command center | `api.getAnalystOverview()`, `api.getAnalystCurriculumStats()` |
| 2 | **Institutional Analytics**| `/analyst/institutional` | Macro student/faculty distribution & trends | `api.getAnalystOverview()` |
| 3 | **Subject & Curriculum Analytics**| `/analyst/curriculum` | Curriculum enrollment analytics with $N < 5$ badges | `api.getAnalystCurriculumStats()` |
| 4 | **Performance Trends** | `/analyst/trends` | Institutional grade trends across terms | `api.getAnalystCurriculumStats()`, `api.getAnalystOverview()` |
| 5 | **Academic Risk Analytics**| `/analyst/risk` | Macro academic attrition & vulnerability telemetry | `api.getAnalystOverview()` |
| 6 | **Anomaly Analysis** | `/analyst/anomalies` | Diagnostic anomaly distribution & channel status | `api.getAnalystDiagnostics()`, `api.getAnalystOverview()` |
| 7 | **Data Quality & Insights**| `/analyst/data-quality` | Dataset completeness, benchmark dataset audit | Data quality telemetry |
| 8 | **Reports & Exports** | `/analyst/reports` | SDC-compliant anonymized institutional exports | Export generator (with cell suppression) |
| 9 | **Profile & Settings** | `/analyst/settings` | Analyst preferences, session security | `api.getMe()`, `api.updateProfile()`, `api.changePassword()` |

---

## 3. Unified Design System & Layout Architecture

### 3.1 Design Tokens & Color Palette
- **Royal Blue (Primary Accent):** `#2455C5`
- **Ocean Blue (Secondary Accent):** `#168CCB`
- **Mint Teal (Success / AI Glow):** `#18D6B5`
- **Canvas Background:** `#F8FAFC` (Slate-50)
- **Card Background:** `#FFFFFF` (White)
- **Border Tone:** `#E2E8F0` (Slate-200)
- **Deep Navy (Sidebar / Contrast Cards):** `#0A0F1D` to `#0F172A`

### 3.2 Key Layout Enhancements (Phase 3)
1. **Collapsible Sidebar:**
   - Smooth transition between expanded (64 / 256px) and collapsed (20 / 80px) states.
   - Distinct role badges (`Admin`, `Teacher`, `Student`, `Analyst`).
   - Grouped or structured navigation links with intuitive Lucide icons.
   - Active state styling with left indicator accent and soft gradient background.
2. **Top Navigation Bar:**
   - Page title and contextual breadcrumb.
   - Subject Context Selector (rendered for Teacher workspace).
   - Live MongoDB / API connection health indicator with pulsating status dot.
   - Notification Center modal/dropdown with real-time operational alerts.
   - User profile dropdown with quick links to Profile, Settings, and Sign Out.
3. **Empty, Loading & Error States:**
   - Standardized `LoadingState` spinner with contextual messaging.
   - Informative `EmptyState` with actionable buttons.
   - Resilient `ErrorAlert` with retry callbacks.
4. **Statistical Disclosure Control (SDC) Badging:**
   - Any metric subject to $N < 5$ cell suppression renders as `"<5"` with a tooltip: `"Suppressed for Privacy (N < 5)"`.

---

## 4. Next Implementation Steps

- **Step 1:** Add Analyst API client methods to `frontend/src/services/api.ts` and add `'analyst'` to `UserRole` in `frontend/src/types/index.ts`.
- **Step 2:** Upgrade `Sidebar.tsx` and `Navbar.tsx` to support all 4 role menus, collapsible sidebar mode, notifications dropdown, and breadcrumbs.
- **Step 3:** Implement new and reusable pages for all missing routes across Administrator, Teacher, Student, and Analyst.
- **Step 4:** Update `App.tsx` router configuration with role-based `ProtectedRoute` guards and direct URL support.
- **Step 5:** Verify with automated backend pytest, frontend vitest, TypeScript checks, and production build.
