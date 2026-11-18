# EduPredict — Phase 5D-A: Teacher Dashboard UI/UX Audit & Redesign Blueprint

**Document Version:** 1.0.0  
**Phase:** 5D-A (Read-Only UI/UX Audit and Architecture Design Planning)  
**Status:** Complete — Awaiting Review & Approval  
**Project Path:** `C:\Users\Azan's PC\Documents\EduPredict`  
**Repository:** [https://github.com/azanali30/EduPredict](https://github.com/azanali30/EduPredict)  
**Author:** Senior Machine Learning Engineer / Lead UI-UX Architect  
**Date:** November 18, 2026  

---

## 1. Executive Summary & Phase 5D-A Mandate

Phase 5D-A establishes a comprehensive, read-only architectural and UI/UX blueprint for transforming the EduPredict Teacher Workspace from a basic two-page prototype into a world-class, production-grade Educational Analytics SaaS platform.

### Strict Phase Boundaries
- **Strictly Read-Only:** No existing source code is modified in this phase.
- **Backend & ML Preservation:** No Flask endpoints, MongoDB schemas, or machine learning model artifacts are modified or retrained.
- **Security & Authorization:** Flask-Login session management, CSRF token validation, and Role-Based Access Control (RBAC) boundaries are strictly preserved.
- **Truthful Telemetry:** Every KPI, chart, and metric is mapped directly to actual existing backend APIs. Non-existent modules (such as real-time attendance registers, class timetables, and assignment grading submission portals) are explicitly classified as future functional modules and will not be presented as implemented.
- **Branding Alignment:** Incorporates the official EduPredict brand assets provided by the user, establishing a unified corporate visual identity across all application portals (Authentication, Student, Teacher, and Administrator).

---

## 2. Comprehensive Audit of Current Teacher Workspace

### 2.1 Inventory of Existing Files Inspected

The following 27 key files were comprehensively inspected on disk:

| Subsystem | Exact File Inspected | Role & Current Functionality |
|---|---|---|
| **Teacher Pages** | `frontend/src/pages/teacher/TeacherOverview.tsx` (468 lines) | High-level overview: displays assigned students, high/moderate risk counts, average projected marks, Recharts bar chart, and roster table with search. |
| **Teacher Pages** | `frontend/src/pages/teacher/TeacherStudents.tsx` (388 lines) | Roster directory: displays student list with risk filter (`ALL`, `High Risk`, `Moderate Risk`, `Low Risk`, `NO_PRED`), search bar, and action buttons. |
| **Prediction UI** | `frontend/src/components/predictions/PredictionForm.tsx` (1064 lines) | Dynamic multi-step prediction form enforcing Milestone 0, 1, 2 feature gating, empirical M0 holdout benchmarks, presets, and validation. |
| **Prediction UI** | `frontend/src/components/predictions/PredictionResultCard.tsx` (339 lines) | Displays prediction output, continuous score, risk tier, model disagreement notice, confidence breakdown, and early warning advisory. |
| **Prediction UI** | `frontend/src/components/predictions/PredictionHistoryTable.tsx` (223 lines) | Filterable tabular view of historical predictions by subject, milestone, and risk tier with inspection modal trigger. |
| **Prediction UI** | `frontend/src/components/predictions/PredictionDetailModal.tsx` (278 lines) | Detailed modal view for inspecting individual historical prediction records with feature summaries and model metadata. |
| **Prediction UI** | `frontend/src/components/predictions/TeacherPredictionModal.tsx` (162 lines) | Instructor assessment modal embedding `PredictionForm`, `PredictionResultCard`, and `PredictionHistoryTable`. |
| **Navigation & Layout** | `frontend/src/components/common/Sidebar.tsx` (155 lines) | Left navigation sidebar; currently configures only 2 links for teachers (`Overview` and `My Students`). |
| **Navigation & Layout** | `frontend/src/components/common/Navbar.tsx` (117 lines) | Sticky top navbar with dynamic title, MongoDB status pill, user initials avatar, and sign-out dropdown. |
| **Navigation & Layout** | `frontend/src/layouts/DashboardLayout.tsx` (38 lines) | Core dashboard wrapper binding Sidebar and Navbar with max-w-7xl content container. |
| **Navigation & Layout** | `frontend/src/layouts/AuthLayout.tsx` (123 lines) | Split-screen desktop auth wrapper with legacy branding and presentation card. |
| **Routing** | `frontend/src/App.tsx` (111 lines) | Master router defining `/teacher` and `/teacher/students` under `allowedRoles={['teacher']}`. |
| **Routing** | `frontend/src/routes/ProtectedRoute.tsx` (37 lines) | Role enforcement wrapper verifying `isAuthenticated` and checking `allowedRoles`. |
| **Styles & Config** | `frontend/tailwind.config.js` (54 lines) | Tailwind theme extension defining navy (`950` to `600`), brand (`50` to `800`), shadows, and font families. |
| **Styles & Config** | `frontend/src/styles/global.css` (206 lines) | Root CSS variables, badge classes, data-table utility classes, card styles, and scrollbar rules. |
| **API Client** | `frontend/src/services/api.ts` (201 lines) | Centralized fetch wrapper handling CSRF tokens, credentials, and concrete endpoints. |
| **Data Types** | `frontend/src/types/index.ts` (131 lines) | Core TypeScript interfaces: `User`, `PredictionRecord`, `EarlyWarningAdvisory`, `PredictionOptions`, etc. |
| **Components** | `frontend/src/components/common/StatCard.tsx` (63 lines) | KPI metric card with title, value, subtitle, trend, and badge. |
| **Components** | `frontend/src/components/common/EmptyState.tsx` (39 lines) | Standardized empty state graphic with title and description. |
| **Components** | `frontend/src/components/common/ErrorAlert.tsx` (33 lines) | Dismissible error alert banner. |
| **Components** | `frontend/src/components/common/LoadingSkeleton.tsx` (47 lines) | Skeleton pulse placeholder for cards, tables, and text lines. |
| **Components** | `frontend/src/components/common/Modal.tsx` (72 lines) | Accessible popup modal dialog with backdrop blur and escape key listener. |
| **Components** | `frontend/src/components/forms/Button.tsx` (50 lines) | Reusable button component with variants (`primary`, `secondary`, `outline`, `danger`, `ghost`). |
| **Components** | `frontend/src/components/forms/InputField.tsx` (92 lines) | Form input with floating label, validation error display, and password toggle. |
| **Backend Routes** | `backend/routes/user_routes.py` (165 lines) | Implements `/api/me`, `/api/me/password`, `/api/students/<student_id>`, and `/api/teacher/students`. |
| **Backend Routes** | `backend/routes/prediction_routes.py` (198 lines) | Implements `/api/predictions/options`, `POST /api/predictions`, `GET /api/predictions`, and `GET /api/predictions/<id>`. |
| **Backend Services** | `backend/services/assignment_service.py` (112 lines) | Query layer resolving teacher-student mappings from MongoDB `teacher_assignments`. |

---

### 2.2 Current Architectural Strengths
1. **Rock-Solid Security & RBAC:** The backend strictly filters teacher queries through `AssignmentService.get_students_for_teacher()`. A teacher cannot fetch, inspect, or predict for any student not assigned to them in MongoDB.
2. **Robust Prediction Integration (Phase 5C):** The `TeacherPredictionModal` allows teachers to trigger predictions for assigned students with full milestone feature gating (M0, M1, M2), empirical advisory banners, and model disagreement notices.
3. **Clean Component Architecture:** Reusable common components (`StatCard`, `EmptyState`, `Modal`, `Button`, `LoadingSkeleton`) exist and provide a consistent base.

---

### 2.3 Identified UI/UX Limitations & Pain Points
1. **Constrained Navigation (Only 2 Pages):** The teacher workspace currently only exposes "Overview" and "My Students". All other workflows (performance analytics, historical prediction audit, at-risk triage, reporting, profile, settings) are either crammed into modals or completely missing.
2. **Modal Overload:** In the current implementation, viewing a student profile opens a basic modal; launching a prediction opens a large multi-tab modal; viewing prediction details opens another modal. This causes nested modal friction and poor usability on mobile and tablet screens.
3. **Data Truncation Ambiguity:** The teacher overview queries `api.listPredictions({ limit: 100 })` and maps predictions in memory. While BUG-5C-04 added a data coverage disclosure note, the UI lacks deep filtering (e.g. by subject, term, or milestone) directly on the dashboard.
4. **Hero Banner Clutter:** The existing dark hero greeting card takes up excessive vertical real estate on small laptops and tablets without providing direct interactive controls.
5. **No Dedicated Early-Warning Triage:** When high-risk students are detected, teachers have to manually click a filter in the students table rather than working from a purpose-built Intervention Queue with recommended actions.
6. **No Longitudinal Performance Visualization:** The dashboard lacks a multi-milestone progression view (e.g., comparing a student's score from Milestone 0 to Milestone 1 to Milestone 2).
7. **Brand Inconsistency:** The application currently uses generic icons (`GraduationCap`) and hardcoded blue gradients that do not match the official EduPredict brand assets.

---

### 2.4 Real Available Data vs Unavailable/Future Functional Data

To ensure absolute integrity and prevent fabricated metrics, the following data matrix defines the boundaries of the redesign:

| Domain | Feature / Metric | Data Status | Actual Backend Source / Implementation |
|---|---|---|---|
| **Assigned Cohort** | Total Assigned Students | **AVAILABLE** | `GET /api/teacher/students` (`students.length`) |
| **Assigned Cohort** | Student Details (Name, Email, ID, Date) | **AVAILABLE** | `GET /api/students/<student_id>` or `GET /api/teacher/students` |
| **Risk Analytics** | High-Risk Student Count | **AVAILABLE** | Mapped from latest `PredictionRecord` per student (`predicted_status === 'High Risk'`) |
| **Risk Analytics** | Moderate-Risk Student Count | **AVAILABLE** | Mapped from latest `PredictionRecord` per student (`predicted_status === 'Moderate Risk'`) |
| **Risk Analytics** | Low-Risk / On-Track Count | **AVAILABLE** | Mapped from latest `PredictionRecord` per student (`predicted_status === 'Low Risk / On Track'`) |
| **Risk Analytics** | Unscreened Count | **AVAILABLE** | Assigned students with zero predictions in fetched sample (`students.length - evaluatedCount`) |
| **Academic Marks** | Cohort Avg Projected Mark | **AVAILABLE** | Mathematical average of `predicted_marks` across evaluated assigned students |
| **Academic Marks** | Distribution by Risk Band | **AVAILABLE** | Aggregated from `PredictionRecord` documents for assigned students |
| **AI Predictions** | Real-time Inference Engine | **AVAILABLE** | `POST /api/predictions` (Milestone 0, 1, 2) |
| **AI Predictions** | Prediction History Log | **AVAILABLE** | `GET /api/predictions?student_id=...&limit=50` |
| **AI Predictions** | Model Disagreement & Uncertainty | **AVAILABLE** | `PredictionRecord.uncertainty_warning`, `regressor_model`, `classifier_model` |
| **AI Predictions** | Milestone 0 Empirical Holdout Advisory | **AVAILABLE** | `EarlyWarningAdvisory` (Math: 16/26 [61.54%]; Port: 15/20 [75.00%]) |
| **Profile** | Teacher Profile (Name, Email, Role) | **AVAILABLE** | `GET /api/me`, `PUT /api/me` |
| **Security** | Teacher Password Management | **AVAILABLE** | `PUT /api/me/password` |
| **Export** | CSV / Print Report Generation | **AVAILABLE (Client-Side)** | Generated from loaded assigned student & prediction datasets |
| **Attendance** | Daily Attendance Register / Punch Log | **FUTURE MODULE** | *Not in backend.* (No attendance collection or check-in API). |
| **Timetable** | Weekly Class / Lecture Schedule | **FUTURE MODULE** | *Not in backend.* (No timetable or classroom booking API). |
| **Assignments** | Assignment Submission & Grading Portal | **FUTURE MODULE** | *Not in backend.* (No homework submission or gradebook CRUD API). |

---

## 3. Official EduPredict Branding & Design System

The redesign is anchored in the official brand identity supplied by the user, embodying the vision: **"EduPredict: AI-Driven Education Analytics"**.

### 3.1 Official Visual Brand Assets

The user provided two official branding image assets:
1. **Full Brand Badge (`media_1794963612020_ac0cbb46.jpg`):**
   - **Emblem:** Graduation mortarboard cap in a vibrant royal-to-mint gradient, surmounting an upward-sweeping spherical crest with ascending analytical bar charts, a prominent upward-growth arrow, and a lower neural network / interconnected data mesh.
   - **Wordmark:** Geometric sans-serif typography with "Edu" in deep royal blue and "Predict" in bright ocean/teal gradient.
   - **Tagline:** *"AI-Driven Education Analytics"* in slate neutral charcoal.
2. **Standalone Emblem Mark (`media_1794963620426_d6915673.jpg`):**
   - Pure symbol mark without typography, designed for favicon, collapsed sidebar, avatar crests, and watermark stamps.

```
       ╔═════════════════════════════════════════════════════════════════╗
       ║                    OFFICIAL BRAND IDENTITY                      ║
       ║                                                                 ║
       ║    [🎓 Graduation Cap]                                          ║
       ║          │                                                      ║
       ║    [📊 Ascending Analytics Bars] ───► [↗ Upward Growth Arrow]   ║
       ║          │                                                      ║
       ║    [🕸️ Neural Data Mesh / AI Nodes]                             ║
       ║                                                                 ║
       ║    Typography:  EduPredict                                      ║
       ║    Tagline:     AI-Driven Education Analytics                   ║
       ║    Gradient:    #2455C5 (Royal) ➔ #168CCB (Ocean) ➔ #18D6B5     ║
       ╚═════════════════════════════════════════════════════════════════╝
```

---

### 3.2 Color System & Design Tokens

The palette is engineered specifically for high-density educational analytics: clean, light-themed, distraction-free, with crisp status indicators.

#### 1. Core Brand Gradient & Primary Palette
- **Brand Gradient:** `linear-gradient(135deg, #2455C5 0%, #168CCB 52%, #18D6B5 100%)`
- **Brand Royal Blue:** `#2455C5` (Primary brand emphasis, button focus, active links)
- **Brand Ocean Blue:** `#168CCB` (Secondary brand accents, icon highlights, active badges)
- **Brand Mint Teal:** `#18D6B5` (Growth indicators, AI badges, model confidence accents)
- **Brand Navy Deep:** `#0B192C` (Primary headings, dark sidebar background, high-contrast modal headers)
- **Brand Navy Medium:** `#132742` (Sidebar active container, secondary dark elements)
- **Brand Navy Border:** `#1E3E62` (Dark panel dividers)

#### 2. Surface & Background Tokens (Light SaaS Theme)
- **Page Background (`bg-page`):** `#F8FAFC` (Clean, subtle cool neutral, zero eye fatigue)
- **Card Surface (`bg-card`):** `#FFFFFF` (Pure white for elevated content cards)
- **Subtle Surface (`bg-subtle`):** `#F1F5F9` (Search inputs, table headers, inactive tabs)
- **Muted Surface (`bg-muted`):** `#E2E8F0` (Dividers, skeleton loaders, subtle borders)
- **Surface Border (`border-main`):** `#E2E8F0` / `rgba(226, 232, 240, 0.8)`
- **Border Hover (`border-hover`):** `#CBD5E1`

#### 3. Typography Hierarchy
- **Text Main (`text-main`):** `#0F172A` (Slate 900 — Maximum readability for body text and table rows)
- **Text Headings (`text-heading`):** `#0B192C` (Navy 900 — Deep, authoritative academic headers)
- **Text Muted (`text-muted`):** `#64748B` (Slate 500 — Field descriptions, secondary timestamps)
- **Text Subtle (`text-subtle`):** `#94A3B8` (Slate 400 — Table column labels, inactive icons)
- **Text Inverse (`text-inverse`):** `#FFFFFF` (White text on dark cards and buttons)

#### 4. Semantic Risk Status Colors
- **High Risk / Critical:**
  - Solid: `#E11D48` (Rose 600)
  - Surface: `#FFF1F2` (Rose 50)
  - Border: `#FECDD3` (Rose 200)
  - Text: `#9F1239` (Rose 800)
- **Moderate Risk / Advisory:**
  - Solid: `#F59E0B` (Amber 500)
  - Surface: `#FFFBEB` (Amber 50)
  - Border: `#FDE68A` (Amber 200)
  - Text: `#B45309` (Amber 800)
- **Low Risk / On Track:**
  - Solid: `#10B981` (Emerald 500)
  - Surface: `#ECFDF5` (Emerald 50)
  - Border: `#A7F3D0` (Emerald 200)
  - Text: `#065F46` (Emerald 800)
- **Unscreened / No Evaluation:**
  - Solid: `#94A3B8` (Slate 400)
  - Surface: `#F8FAFC` (Slate 50)
  - Border: `#E2E8F0` (Slate 200)
  - Text: `#475569` (Slate 600)

---

### 3.3 Typography Specifications

| Hierarchy Level | Font Family | Weight | Size | Line Height | Tracking | Purpose |
|---|---|---|---|---|---|---|
| **Display H1** | `Plus Jakarta Sans` | Extrabold (800) | `1.875rem` (30px) | `2.25rem` (36px) | `-0.025em` | Page main headers, hero greeting |
| **Section H2** | `Plus Jakarta Sans` | Bold (700) | `1.375rem` (22px) | `1.75rem` (28px) | `-0.02em` | Section titles, modal titles |
| **Card H3** | `Plus Jakarta Sans` | SemiBold (600) | `1.0625rem` (17px)| `1.5rem` (24px) | `-0.015em`| Widget cards, table headers |
| **Subheading** | `Inter` | Medium (500) | `0.875rem` (14px) | `1.25rem` (20px) | `0` | Subtitle descriptions under H1/H2 |
| **Body Regular**| `Inter` | Regular (400) | `0.875rem` (14px) | `1.375rem` (22px)| `0` | Form labels, descriptions, paragraphs |
| **Body Small** | `Inter` | Regular (400) | `0.75rem` (12px)  | `1.125rem` (18px)| `+0.01em` | Table data cells, timestamp tags |
| **Caps Label** | `Inter` | Bold (700) | `0.6875rem` (11px)| `1rem` (16px)    | `+0.06em` | Table column headers, KPI titles |
| **Monospace** | `JetBrains Mono`/ui | SemiBold (600) | `0.75rem` (12px)  | `1rem` (16px)    | `0` | Student IDs, score values, model tags |

---

### 3.4 Spacing, Elevation & Component Standards

- **Spacing Scale:** Standard 4px grid (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `48px`).
- **Border Radii:**
  - Buttons & Inputs: `0.625rem` (10px — `rounded-xl`)
  - Content Cards: `1rem` (16px — `rounded-2xl`)
  - Modals & Drawers: `1.25rem` (20px — `rounded-3xl`)
  - Badges & Pills: `9999px` (`rounded-full`)
- **Shadow Tokens:**
  - `shadow-card`: `0 1px 3px 0 rgba(11, 25, 44, 0.04), 0 4px 16px -2px rgba(11, 25, 44, 0.03)`
  - `shadow-card-hover`: `0 10px 25px -4px rgba(11, 25, 44, 0.08), 0 4px 10px -2px rgba(11, 25, 44, 0.03)`
  - `shadow-glow-brand`: `0 0 20px -2px rgba(36, 85, 197, 0.25)`
  - `shadow-glow-mint`: `0 0 20px -2px rgba(24, 214, 181, 0.3)`

---

## 4. Project-Wide Branding Implementation Plan

The official EduPredict branding will be deployed consistently across all portals of the application in Phase 5D.

### 4.1 Asset Placement Strategy
In the implementation phase, the two user-provided branding assets will be placed into the frontend public directory:
- `frontend/public/brand/edupredict-logo-full.jpg` (Full brand badge with wordmark & tagline)
- `frontend/public/brand/edupredict-emblem.jpg` (Standalone emblem icon)
- An optimized SVG vector equivalent (`edupredict-icon.svg`) will be generated for crisp rendering at small dimensions (16px to 32px favicons and sidebar marks).

### 4.2 Portal-by-Portal Branding Matrix

| Application Portal | Surface / Component | Exact Branding Touchpoint & Implementation |
|---|---|---|
| **Public Authentication** | `AuthLayout.tsx` | Split-screen desktop panel features full logo badge with subtle mint glow, official tagline *"AI-Driven Education Analytics"*, and brand gradient accents. |
| **Public Authentication** | `LoginPage.tsx`, `RegisterPage.tsx` | Mobile header features the standalone emblem mark with high-resolution typography; primary CTA button styled with the signature brand gradient. |
| **All Workspaces** | `Navbar.tsx` | Top header displays the brand emblem mark with the dynamic workspace indicator (Student / Teacher / Admin) and system status. |
| **All Workspaces** | `Sidebar.tsx` | Header displays the official emblem with gradient background (`from-[#2455C5] to-[#18D6B5]`), bold "EduPredict" wordmark, and subtle "Instructor Intelligence" subline. |
| **Teacher Workspace** | Hero Banners | Elegant light hero banner with refined royal-to-mint gradient badge, instructor greeting, and fast-action shortcuts. |
| **Teacher Workspace** | Prediction Cards | `PredictionResultCard` incorporates brand growth iconography, official risk color tokens, and model verification stamps. |
| **Teacher Workspace** | Reports | Printable PDF/CSV exports include official EduPredict emblem watermark, institution header, and holdout benchmark citations. |
| **Student Workspace** | `StudentOverview.tsx` | Clean hero header with emblem badge, personal academic trajectory cards, and early warning status indicators. |
| **Admin Workspace** | `AdminOverview.tsx` | Governance console header featuring the official brand emblem, system health status, and user management metrics. |

---

## 5. Proposed Teacher Dashboard Navigation & Information Architecture

The current 2-link sidebar will be expanded into a comprehensive 8-section educational analytics suite.

### 5.1 Route Mapping & Role Verification

All teacher routes are strictly protected by `<ProtectedRoute allowedRoles={['teacher']}>`:

| Nav Index | Navigation Label | Path | Lucide Icon | Core Purpose & Workflow |
|---|---|---|---|---|
| **1** | **Overview** | `/teacher` | `LayoutDashboard` | Executive summary: assigned cohort KPIs, risk distribution chart, priority attention queue, recent inference stream. |
| **2** | **My Students** | `/teacher/students` | `Users` | Master student directory: search, risk filtering, projected marks, student profile drawer, fast prediction launch. |
| **3** | **Student Performance** | `/teacher/performance` | `BarChart3` | Academic analytics hub: score distributions across subjects (Math vs Portuguese), milestone comparisons, mark bands. |
| **4** | **AI Predictions** | `/teacher/predictions` | `Sparkles` | Prediction management center: historical prediction audit trail, model confidence inspection, new assessment runner. |
| **5** | **At-Risk Students** | `/teacher/at-risk` | `AlertTriangle` | Early warning triage console: High & Moderate risk queue, Milestone 0 false-negative advisories, recommended interventions. |
| **6** | **Reports** | `/teacher/reports` | `FileText` | Export & reporting suite: cohort summary reports, at-risk rosters, CSV downloads, printable PDF academic summaries. |
| **7** | **My Profile** | `/teacher/profile` | `UserCheck` | Instructor profile management: verified assignments count, institutional email, name updates via `PUT /api/me`. |
| **8** | **Settings** | `/teacher/settings` | `Settings` | Teacher workspace preferences: password management via `PUT /api/me/password`, display density, session info. |

### 5.2 Future Functional Modules (Transparent Disclosure)
The following modules are explicitly designated as **Future Roadmap Capabilities** in the UI:
- **Attendance Tracking (`/teacher/attendance`)**: *Identified as Future Phase 6 module.* The UI will include a non-intrusive roadmap placeholder explaining that real-time classroom attendance tracking will be integrated once daily roll-call APIs are introduced.
- **Class Timetable & Schedule (`/teacher/timetable`)**: *Identified as Future Phase 6 module.* Classroom scheduling and calendar syncing will connect with institution timetable databases in future releases.
- **Assignment Gradebook (`/teacher/assignments-grading`)**: *Identified as Future Phase 6 module.* Direct assignment submission pipelines and continuous assessment marking will be integrated in future phases.

---

## 6. Page-by-Page Technical & UI/UX Design Specifications

---

### Page 1: Overview (`/teacher`)

**Objective:** Serve as the instructor's daily command center, immediately highlighting students needing academic attention and presenting cohort predictive telemetry.

#### Layout Structure
1. **Header Banner:**
   - Instructor personalized greeting: *"Welcome back, Instructor {user.full_name}"*.
   - Badge: *"Instructor Analytics Hub • MongoDB Operational"*.
   - Subline: *"Monitoring {students.length} assigned learners across Mathematics & Portuguese Language"*.
   - Right Action: *"New Assessment"* button launching the prediction modal for fast student selection.
2. **Top KPI Metric Cards (4 Cards Grid):**
   - **Card 1: Assigned Students**
     - Source: `students.length` from `api.getTeacherStudents()`.
     - Value: e.g. `24`
     - Subtitle: *"Active mapped learners"*.
     - Badge: *"Authorized Cohort"* (`badge-info`).
   - **Card 2: High Risk Alerts**
     - Source: Count of assigned students whose latest prediction is `'High Risk'`.
     - Value: e.g. `3`
     - Subtitle: *"Immediate intervention advised"*.
     - Badge: `High Risk` (`badge-danger`).
   - **Card 3: Moderate Risk Alerts**
     - Source: Count of assigned students whose latest prediction is `'Moderate Risk'`.
     - Value: e.g. `6`
     - Subtitle: *"Milestone monitoring recommended"*.
     - Badge: `Advisory` (`badge-warning`).
   - **Card 4: Cohort Avg Projected Mark**
     - Source: Average `predicted_marks` across all evaluated assigned students.
     - Value: e.g. `68.4%` (or `--` if 0 evaluated).
     - Subtitle: `"{scoreCount} of {students.length} evaluated"`.
     - Badge: *"AI Inference"* (`badge-success`).
3. **Analytics & Risk Distribution (Two-Column Layout):**
   - **Left Column (60%): Cohort Academic Risk Distribution (Recharts Bar Chart)**
     - Data: High Risk (`#E11D48`), Moderate Risk (`#F59E0B`), Low Risk (`#10B981`), Unscreened (`#94A3B8`).
     - Includes data coverage note: *"Evaluated from latest prediction records for your assigned cohort"*.
   - **Right Column (40%): Screening Status & Milestone Breakdown**
     - Visual breakdown of predictions by Milestone (M0 Initial, M1 Period 1, M2 Period 2).
     - Coverage progress bar showing percentage of assigned students with at least 1 prediction.
4. **Students Requiring Immediate Attention (Priority Queue):**
   - Filtered view highlighting only students flagged as High Risk or Moderate Risk.
   - Columns: Student Name, Risk Tier, Projected Mark, Top Contributing Factors / Milestone, Recommended Action, Fast Action button (`Launch Assessment` / `View Profile`).
5. **Recent AI Predictions Stream:**
   - Table of the 5 most recent predictions generated for assigned students with timestamp, subject, milestone, risk badge, and quick detail inspection modal.

---

### Page 2: My Students (`/teacher/students`)

**Objective:** Complete student roster management with multi-criteria search, filtering, and seamless access to individual student performance profiles.

#### Layout Structure
1. **Header & Quick Summary:**
   - Title: *"Assigned Students Directory"*.
   - Subtitle: *"Manage learner records, monitor risk status, and trigger AI assessments"*.
   - Total Students badge and active filter count.
2. **Search & Filter Toolbar:**
   - Search input: Real-time search by full name, institutional email, or student ID.
   - Risk Tier Filter: Dropdown (`All Students`, `High Risk`, `Moderate Risk`, `Low Risk / On Track`, `Unscreened`).
   - Subject Filter: Dropdown (`All Subjects`, `Mathematics`, `Portuguese Language`).
   - Evaluation Status Filter: Dropdown (`All`, `Evaluated`, `Awaiting Initial Screening`).
   - View Toggle: Table View (default) vs Grid Card View.
3. **Student Roster Table:**
   - Columns:
     - **Student:** Avatar with initials, full name, institutional email.
     - **Student ID:** Monospace ID snippet (e.g. `...e418a`).
     - **Enrolled Since:** Date formatted string.
     - **Latest AI Risk:** Status badge (`High Risk`, `Moderate Risk`, `Low Risk`, `No Model Run`).
     - **Projected Mark:** Continuous score out of 100 with small progress bar.
     - **Latest Milestone:** `M0 (Initial)` / `M1 (Period 1)` / `M2 (Period 2)` or `Unscreened`.
     - **Actions:**
       - Primary: `Assess (AI)` button (opens prediction modal pre-selected to this student).
       - Secondary: `Profile` button (opens student profile side drawer).
4. **Student Profile Inspection Drawer (Slide-Over Panel):**
   - Replaces cumbersome popup modal with a sleek slide-over drawer from the right.
   - Shows complete student details, academic registration metadata, and a historical list of all predictions generated for this student.

---

### Page 3: Student Performance Analytics (`/teacher/performance`)

**Objective:** Dedicated analytical dashboard providing deep academic insight into cohort marks, subject comparisons, and milestone progression.

#### Layout Structure
1. **Header & Context Selector:**
   - Title: *"Cohort Performance Analytics"*.
   - Subject Selector: Toggle between `All Subjects`, `Mathematics`, and `Portuguese Language`.
2. **Performance KPI Metrics (3 Cards Grid):**
   - **Highest Projected Mark:** Top scoring assigned student mark and name.
   - **Lowest Projected Mark:** Lowest scoring assigned student mark and name (intervention target).
   - **Cohort Median Mark:** Median projected score for the cohort.
3. **Score Band Distribution Chart (Recharts):**
   - Histogram / Bar chart grouping student predicted marks into academic grade bands:
     - `Distinction (80–100%)`: Emerald
     - `Merit (65–79%)`: Ocean Blue
     - `Pass / Moderate (50–64%)`: Amber
     - `Failing / High Risk (<50%)`: Rose
4. **Subject Comparison Matrix (Mathematics vs Portuguese Language):**
   - Side-by-side comparison of student performance metrics across the two subjects.
   - Compares average projected mark, percentage of students flagged at-risk, and assessment completion rate.
5. **Milestone Progression Tracker:**
   - For students with multiple predictions across milestones (M0 -> M1 -> M2), displays trajectory lines showing whether risk status is improving, stable, or deteriorating after Period 1 exam marks are incorporated.

---

### Page 4: AI Predictions Hub (`/teacher/predictions`)

**Objective:** Centralized intelligence center for viewing all historical predictions, inspecting model confidence, and launching new multi-milestone assessments.

#### Layout Structure
1. **Header & Fast Launch Action:**
   - Title: *"AI Prediction Intelligence Hub"*.
   - Subtitle: *"Machine learning evaluation records, model confidence scores, and milestone assessments"*.
   - Primary Action: *"Run New Assessment"* button.
2. **Filter & Query Bar:**
   - Student selector (filter predictions by a specific assigned student).
   - Subject filter (`Mathematics` / `Portuguese Language`).
   - Milestone filter (`Milestone 0`, `Milestone 1`, `Milestone 2`).
   - Risk status filter (`High Risk`, `Moderate Risk`, `Low Risk`).
3. **Predictions Audit Table:**
   - Displays all historical predictions with pagination (`skip`/`limit` support via `api.listPredictions()`).
   - Columns: Student Name, Assessment Date, Subject, Milestone, Predicted Mark, Predicted Risk, Top Confidence %, Model Uncertainty Flag, Actions (`Inspect Details`).
4. **Prediction Detail Inspection Drawer:**
   - Deep inspection of individual prediction records, showing:
     - Exact continuous mark and classification status.
     - Model disagreement alert if continuous score and classifier disagree.
     - Confidence probability distribution (e.g. High Risk: 72%, Moderate: 20%, Low: 8%).
     - Milestone 0 empirical advisory with historical false-negative caveats.
     - Feature summary list with proxy labels clearly identified.
     - Estimator provenance (`regressor_model`, `classifier_model`).

---

### Page 5: At-Risk Students Early Warning Queue (`/teacher/at-risk`)

**Objective:** Purpose-built triage interface dedicated entirely to identifying, tracking, and prioritizing learners who require academic intervention.

#### Layout Structure
1. **Critical Triage Alert Banner:**
   - Displays total high-risk and moderate-risk learners.
   - High-contrast warning banner outlining the critical importance of early academic support.
2. **Milestone 0 Safety & False-Negative Advisory Card:**
   - Prominently displays the Phase 5A holdout validation caveats:
     - **Mathematics Milestone 0:** 16 false negatives out of 26 actual high-risk students (61.54% empirical false-negative rate).
     - **Portuguese Language Milestone 0:** 15 false negatives out of 20 actual high-risk students (75.00% empirical false-negative rate).
   - Clear instructional guidance: Milestone 0 serves strictly as an early screening aid; low-risk flags at M0 must not be treated as a definitive guarantee of passing.
3. **At-Risk Learner Priority Cards:**
   - Card-based or detailed row layout sorted by intervention urgency (highest risk first).
   - Each card displays:
     - Student identity, avatar, email.
     - Current predicted mark and risk tier badge.
     - Top risk factors (e.g., high absences, previous failures, low study rhythm).
     - Actionable intervention recommendation (e.g., *"Schedule exploratory academic counseling and record Period 1 examination marks for Milestone 1 evaluation"*).
     - Direct action buttons: `Email Student`, `Re-Assess AI`, `View Complete History`.

---

### Page 6: Reports & Academic Export (`/teacher/reports`)

**Objective:** Comprehensive export and reporting center enabling instructors to generate institutional records, at-risk rosters, and audit documentation.

#### Layout Structure
1. **Header & Report Generator Options:**
   - Title: *"Academic Telemetry & Reporting Suite"*.
   - Subtitle: *"Generate cohort summaries, at-risk student rosters, and auditable prediction exports"*.
2. **Pre-Built Report Templates (3 Cards):**
   - **Template 1: Cohort Overview Report**
     - Summarizes assigned cohort size, risk distribution, average projected mark, and milestone coverage.
     - Actions: `Download CSV` | `Print / Export PDF`.
   - **Template 2: Early Warning & At-Risk Roster**
     - Filtered roster containing only High Risk and Moderate Risk learners, complete with contact emails, projected marks, and model advisories.
     - Actions: `Download CSV` | `Print / Export PDF`.
   - **Template 3: Complete Prediction Audit Trail**
     - Comprehensive tabular export of all prediction records, feature inputs, confidence scores, and model metadata.
     - Actions: `Download CSV`.
3. **Data Transparency & Governance Note:**
   - Explicitly notes data sources (`MongoDB 6.0`, `clean_dataset.py`, `PredictionService`).
   - Discloses that student predictions are based on trained ML models and must be used as advisory support.

---

### Page 7: My Profile (`/teacher/profile`)

**Objective:** Dedicated instructor profile management allowing teachers to inspect their assigned student count, institutional credentials, and update their display name.

#### Layout Structure
1. **Instructor Identity Card:**
   - Large avatar with initial and official brand gradient border.
   - Full name, institutional email address, user role badge (`badge-teacher`).
   - Account creation date and database identifier snippet.
2. **Assigned Cohort Summary Widget:**
   - Quick statistics displaying total assigned students, total predictions conducted, and active status.
3. **Update Profile Form:**
   - Form allowing the teacher to update their display name (`full_name`) via `PUT /api/me`.
   - Email is displayed as read-only (role/governance security rule).
   - Save button with loading indicator and success alert.

---

### Page 8: Settings (`/teacher/settings`)

**Objective:** Security and workspace preferences interface.

#### Layout Structure
1. **Security & Password Management:**
   - Form to change password using `PUT /api/me/password`.
   - Requires current password verification and new password complexity requirements (minimum 8 characters).
   - Validation feedback and success alerts.
2. **Workspace Display Preferences:**
   - Data table row density toggle (`Compact` vs `Comfortable`).
   - Prediction results default subject selection.
3. **Session & Security Information:**
   - Displays active session security details (Flask session cookie, CSRF protection active, MongoDB 6.0 connection status).

---

## 7. AI Prediction Workspace Integration (Phase 5C Preservation)

The redesign strictly preserves every machine learning constraint, feature schema, and governance rule established in Phases 5A, 5B, and 5C.

### 7.1 Non-Negotiable ML Rules Preserved
1. **No ML Logic Alterations:** Model pipelines, pickle artifacts (`ml_models/saved_models/`), and evaluation metrics remain untouched.
2. **Feature Gating Across Milestones:**
   - **Milestone 0 (Initial Enrollment):** Only demographic, socio-economic, lifestyle, and proxy indicators. Prohibits `G1`, `G2`, `G3`, `previous_exam_marks`, `quiz_scores`, `final_exam_marks`, `academic_status`.
   - **Milestone 1 (Period 1):** Unlocks `previous_exam_marks` (G1). Prohibits `G2`, `G3`, `quiz_scores`, `final_exam_marks`, `academic_status`.
   - **Milestone 2 (Period 2):** Unlocks `previous_exam_marks` (G1) and `quiz_scores` (G2). Prohibits `G3`, `final_exam_marks`, `academic_status`.
3. **Audited Milestone 0 Empirical Holdout Caveat:**
   - **Mathematics:** 16 false negatives out of 26 actual high-risk students (61.54% empirical false-negative rate).
   - **Portuguese Language:** 15 false negatives out of 20 actual high-risk students (75.00% empirical false-negative rate).
   - Always labeled explicitly as **historical holdout evaluation metrics**, never as individual student outcomes.
4. **Model Disagreement Detection:** When continuous predicted marks (`predicted_marks < 50` for High Risk, `< 70` for Moderate Risk, `>= 70` for Low Risk) conflict with classification output (`predicted_status`), the UI highlights the discrepancy and displays the full confidence probability breakdown.
5. **Teacher Authorization Boundary:** Predictions can only be generated or retrieved for students explicitly assigned to the authenticated teacher in MongoDB.

---

## 8. Component Architecture & Reusability Plan

The redesigned dashboard decomposes the UI into modular, typed React components:

```
frontend/src/
├── components/
│   ├── common/
│   │   ├── Navbar.tsx                   (Updated with brand emblem & health badge)
│   │   ├── Sidebar.tsx                  (Updated with 8 teacher navigation links)
│   │   ├── StatCard.tsx                 (Enhanced with micro-trend & variant icons)
│   │   ├── EmptyState.tsx               (Consistent graphic empty state)
│   │   ├── ErrorAlert.tsx               (Standard error banner)
│   │   ├── LoadingSkeleton.tsx          (Shimmer loading placeholders)
│   │   ├── Modal.tsx                    (Base accessible modal)
│   │   └── Drawer.tsx                   (NEW: Slide-over inspection drawer)
│   ├── teacher/
│   │   ├── TeacherHeroBanner.tsx        (NEW: Clean light hero banner)
│   │   ├── RiskDistributionChart.tsx   (NEW: Recharts bar chart with coverage note)
│   │   ├── PriorityAttentionQueue.tsx   (NEW: Fast triage queue for flagged students)
│   │   ├── StudentRosterTable.tsx       (NEW: Modular student table with search/filters)
│   │   ├── StudentProfileDrawer.tsx     (NEW: Slide-over student inspection panel)
│   │   ├── AtRiskStudentCard.tsx        (NEW: Actionable triage card for at-risk learners)
│   │   └── CohortReportGenerator.tsx    (NEW: Client-side CSV and printable reports)
│   └── predictions/
│       ├── PredictionForm.tsx           (Preserved from Phase 5C)
│       ├── PredictionResultCard.tsx     (Preserved from Phase 5C with brand styling)
│       ├── PredictionHistoryTable.tsx   (Preserved from Phase 5C)
│       ├── PredictionDetailModal.tsx    (Preserved from Phase 5C)
│       └── TeacherPredictionModal.tsx   (Preserved from Phase 5C)
└── pages/
    └── teacher/
        ├── TeacherOverview.tsx          (Redesigned command center)
        ├── TeacherStudents.tsx          (Redesigned roster directory)
        ├── TeacherPerformance.tsx       (NEW: Performance analytics hub)
        ├── TeacherPredictions.tsx       (NEW: Prediction audit center)
        ├── TeacherAtRisk.tsx            (NEW: Early warning triage console)
        ├── TeacherReports.tsx           (NEW: Export and reporting suite)
        ├── TeacherProfile.tsx           (NEW: Instructor profile & assignments)
        └── TeacherSettings.tsx          (NEW: Security & workspace settings)
```

---

## 9. API & Data Mapping Matrix

Every view and component maps directly to an authenticated backend endpoint:

| Page / Component | Action / Data Displayed | Backend Endpoint | HTTP Method | Request Payload / Params |
|---|---|---|---|---|
| **Overview** | Load assigned cohort & predictions | `/api/teacher/students`<br>`/api/predictions?limit=100` | `GET`<br>`GET` | None<br>`limit=100` |
| **Overview** | Fast inspect student details | `/api/students/<student_id>` | `GET` | `student_id` path param |
| **My Students** | List assigned students | `/api/teacher/students` | `GET` | None |
| **My Students** | Search & risk filter | Client-side filter on loaded cohort | N/A | None |
| **Performance** | Cohort mark aggregation | Aggregated from `PredictionRecord` sample | N/A | None |
| **AI Predictions** | Query prediction history | `/api/predictions` | `GET` | `student_id`, `subject`, `milestone`, `limit`, `skip` |
| **AI Predictions** | Generate new prediction | `/api/predictions` | `POST` | `{ student_id, subject, milestone, features }` |
| **AI Predictions** | Inspect prediction details | `/api/predictions/<id>` | `GET` | `prediction_id` path param |
| **At-Risk** | Query at-risk learners | Filtered from assigned cohort predictions | N/A | None |
| **Reports** | Export CSV / Print Report | Formatted client-side from loaded data | N/A | None |
| **My Profile** | Retrieve profile & assignment count | `/api/me`<br>`/api/teacher/students` | `GET`<br>`GET` | None |
| **My Profile** | Update display name | `/api/me` | `PUT` | `{ full_name }` |
| **Settings** | Update account password | `/api/me/password` | `PUT` | `{ current_password, new_password }` |

---

## 10. Responsive Design & Accessibility (a11y) Specifications

### 10.1 Responsive Breakpoints
- **Mobile (< 768px):**
  - Sidebar collapses into an off-canvas slide-over drawer toggled via the hamburger button in `Navbar.tsx`.
  - KPI cards stack into a 1-column layout.
  - Tables convert into horizontally scrollable data containers with sticky student name columns.
  - Modals and drawers expand to 95% screen width.
- **Tablet (768px – 1024px):**
  - KPI cards display in a 2x2 grid.
  - Analytics charts collapse into single-column vertical stacks.
  - Sidebar remains collapsible or mini-docked.
- **Desktop (1024px – 1440px):**
  - Full 260px sticky sidebar.
  - KPI cards in a 4-column horizontal grid.
  - Analytics and risk distribution charts side-by-side.
  - Max content container bounded to `max-w-7xl` with generous margins.
- **Large Desktop (1440px+):**
  - Ultra-high-density data views with expanded student detail tables.

### 10.2 Accessibility (WCAG 2.1 AA Compliance)
- **Contrast Ratios:** All text against background surfaces achieves at least 4.5:1 contrast (slate 900 `#0F172A` on white `#FFFFFF` achieves 16.1:1; slate 500 `#64748B` achieves 4.9:1).
- **Keyboard Navigation:** All interactive elements (`Button`, inputs, tabs, modal close triggers) have visible focus rings (`focus:ring-2 focus:ring-brand-500/30 focus:outline-none`).
- **Screen Readers:** Semantic HTML landmarks (`<nav>`, `<main>`, `<header>`, `<aside>`, `<section>`, `<table>`) with appropriate ARIA roles (`aria-label`, `aria-expanded`, `aria-hidden`).
- **Color Independence:** Risk statuses are never conveyed solely through color; every badge includes an explicit text label and a unique Lucide icon (`AlertTriangle`, `AlertCircle`, `CheckCircle2`).

---

## 11. Recommended Implementation Sequence

To ensure zero downtime, zero regressions, and full test stability, the redesign should be executed in 6 controlled phases:

```
╔═════════════════════════════════════════════════════════════════════════╗
║                      PHASE 5D IMPLEMENTATION ROADMAP                    ║
║                                                                         ║
║  Phase 5D-A: UI/UX Audit & Design Blueprint (CURRENT - READ-ONLY)       ║
║        │                                                                ║
║        ▼                                                                ║
║  Phase 5D-B: Component & Navigation Foundation                          ║
║        │     • Deploy brand assets (logo, emblem) to public/brand/      ║
║        │     • Expand Sidebar & Navbar navigation routes                ║
║        │     • Build Drawer & Reusable UI widgets                       ║
║        ▼                                                                ║
║  Phase 5D-C: Redesign Overview & Student Roster Pages                   ║
║        │     • Implement redesigned TeacherOverview.tsx                 ║
║        │     • Implement redesigned TeacherStudents.tsx & ProfileDrawer ║
║        ▼                                                                ║
║  Phase 5D-D: Performance, Predictions & At-Risk Hubs                    ║
║        │     • Implement TeacherPerformance.tsx                         ║
║        │     • Implement TeacherPredictions.tsx                         ║
║        │     • Implement TeacherAtRisk.tsx triage console               ║
║        ▼                                                                ║
║  Phase 5D-E: Reports, Profile, Settings & Project-Wide Branding         ║
║        │     • Implement TeacherReports.tsx                             ║
║        │     • Implement TeacherProfile.tsx & TeacherSettings.tsx       ║
║        │     • Apply brand styling to Auth, Student & Admin headers     ║
║        ▼                                                                ║
║  Phase 5D-F: Rigorous Verification, Testing & Final Audit               ║
║              • 100% Pytest pass rate (88+ tests)                        ║
║              • Zero TypeScript compiler errors                          ║
║              • Cross-device UI/UX validation & audit documentation      ║
╚═════════════════════════════════════════════════════════════════════════╝
```

---

## 12. Potential Risks, Security Guardrails & Regression Safeguards

| Risk Category | Potential Vulnerability | Mitigation & Guardrail in Blueprint |
|---|---|---|
| **Security & IDOR** | Teacher attempting to view/predict for non-assigned student | Backend `can_access_student_data` check strictly blocks unauthorized queries with 403 Forbidden. UI only renders assigned students returned from `/api/teacher/students`. |
| **Model Integrity** | Accidental retraining or modifying saved model weights | No model retraining files or `.pkl` artifacts are touched. Prediction calls remain read-only consumers of existing endpoints. |
| **Feature Leakage** | Submission of prohibited target features (`G3`, exam marks) | Prediction form strictly validates and strips prohibited features according to milestone gating before sending to API. |
| **False Negative Risk** | Instructors over-relying on Milestone 0 early screening | Prominent advisory warnings highlighting historical holdout false-negative rates (61.54% Math, 75.00% Port) across the dashboard and at-risk queue. |
| **Performance** | Slow UI rendering when mapping 100+ prediction records | Client-side memoization (`useMemo`) for latest prediction per student mapping and filtered arrays. |
| **Scope Creep** | Building unbacked attendance or timetable features | Non-existent features are strictly designated as "Future Modules" with clear placeholder roadmap notices. |

---

## 13. Blueprint Approval Request

This concludes the Phase 5D-A read-only audit and comprehensive redesign blueprint.

**Next Action:** Await user review and explicit approval of this blueprint before implementing source code modifications in Phase 5D-B.
