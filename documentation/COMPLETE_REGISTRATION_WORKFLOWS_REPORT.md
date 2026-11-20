# EduPredict — Complete Student & Faculty Profile Registration Report

**Project**: EduPredict (Aptech eProject Big Data / Academic Analytics)  
**Date**: November 2026  
**Status**: Implemented, Verified & Committed  

---

## 1. Executive Summary

This report documents the implementation of the comprehensive, multi-section registration workflows for **Students** and **Faculty Members (Teachers)** in EduPredict. 

The previous implementation provided basic registration forms capturing minimal account identity information. This upgrade introduces an enterprise-grade multi-step registration workflow that gathers personal identity, contact details, parent/guardian information (for students), professional/academic credentials (for teachers), employment metadata, document/photo management, and security account setup—while strictly adhering to the architectural decoupling between user identity provisioning and course/workload allocations.

---

## 2. Fields Implemented

### 2.1 Student Registration (`StudentRegistrationModal.tsx`)

| Section | Field Name | Type | Constraint | Description |
|---|---|---|---|---|
| **A. Personal Info** | `avatar_url` | String (URL) | Optional | Secure uploaded profile photo URL |
| | `full_name` | String | **Required** | Student's legal full name |
| | `student_id` | String | **Required, Unique** | Institutional admission / roll identifier |
| | `personal_info.date_of_birth` | Date (YYYY-MM-DD) | Optional | Learner birth date |
| | `personal_info.gender` | String | Optional | Gender identity (Male, Female, Non-binary, Other, Prefer not to say) |
| | `personal_info.nationality` | String | Optional | Student nationality / citizenship |
| **B. Contact Info** | `email` | String | **Required, Unique** | Institutional learner email (`@edupredict.edu`) |
| | `contact_info.personal_email` | String | Optional | Personal secondary email |
| | `contact_number` | String | Optional | Primary student telephone |
| | `contact_info.alternate_contact_number` | String | Optional | Alternate contact telephone |
| | `contact_info.residential_address` | String | Optional | Street / residential address |
| | `contact_info.city` | String | Optional | Residential city |
| | `contact_info.country` | String | Optional | Residential country |
| **C. Guardian Info** | `guardian_info.guardian_full_name` | String | Optional | Parent / legal guardian full name |
| | `guardian_info.relationship` | String | Optional | Relationship (Father, Mother, Legal Guardian, etc.) |
| | `guardian_info.guardian_contact_number` | String | Optional | Guardian primary phone |
| | `guardian_info.guardian_email` | String | Optional | Guardian contact email |
| | `guardian_info.emergency_contact_number` | String | Optional | Emergency contact telephone |
| **D. Academic Info** | `academic_info.admission_date` | Date (YYYY-MM-DD) | Optional | Official institution matriculation date |
| | `academic_info.academic_year` | String | Optional | Enrolled academic year (e.g. `2026-2027`) |
| | `academic_info.academic_term` | String | Optional | Entry academic term (e.g. `2026-T1`) |
| | `academic_info.program_course` | String | Optional | Degree / Program (e.g. `B.Sc. Data Science`) |
| | `department` | String | Optional | Department (e.g. `STEM & Mathematics`) |
| | `academic_info.class_grade` | String | Optional | Grade cohort / Section (e.g. `Year 1, Section A`) |
| | `academic_info.previous_institution` | String | Optional | Prior secondary school / college attended |
| | `academic_info.previous_qualification` | String | Optional | Prior academic degree or certificate |
| **E. Documents & Enrollment** | `documents` | Array[Object] | Optional | Uploaded admission docs & certificates |
| | *Curriculum Preview* | Informational | Read-only | Subject catalog display with decoupled enrollment notice |
| **F. Account Setup** | `is_active` | Boolean | Default: `true` | Portal login authorization toggle |
| | `password` | String | **Required** | Initial secure password ($\ge 8$ chars, hashed with PBKDF2) |
| | `must_change_password` | Boolean | Default: `true` | Enforces password change on initial student authentication |

---

### 2.2 Teacher Registration (`TeacherRegistrationModal.tsx`)

| Section | Field Name | Type | Constraint | Description |
|---|---|---|---|---|
| **A. Personal Info** | `avatar_url` | String (URL) | Optional | Secure uploaded faculty photo URL |
| | `full_name` | String | **Required** | Faculty member's legal full name |
| | `employee_id` | String | **Required, Unique** | Faculty employee / staff code |
| | `personal_info.date_of_birth` | Date (YYYY-MM-DD) | Optional | Date of birth |
| | `personal_info.gender` | String | Optional | Gender identity |
| | `personal_info.nationality` | String | Optional | Nationality |
| **B. Contact Info** | `email` | String | **Required, Unique** | Institutional faculty email |
| | `contact_info.personal_email` | String | Optional | Personal secondary email |
| | `contact_number` | String | Optional | Primary telephone |
| | `contact_info.alternate_contact_number` | String | Optional | Alternate contact telephone |
| | `contact_info.residential_address` | String | Optional | Residential address |
| | `contact_info.city` | String | Optional | City |
| | `contact_info.country` | String | Optional | Country |
| **C. Professional Info** | `department` | String | **Required** | STEM & Mathematics, Humanities & Languages, Natural Sciences, Social Sciences, Computer Science & Data Analytics |
| | `professional_info.job_title` | String | Optional | Academic title (e.g. Professor, Senior Lecturer) |
| | `professional_info.highest_qualification` | String | Optional | Highest degree (e.g. Ph.D., M.Sc.) |
| | `professional_info.specialization` | String | Optional | Academic discipline / research specialization |
| | `professional_info.experience_years` | Number / String | Optional | Total years of teaching experience |
| | `professional_info.previous_institution` | String | Optional | Prior university / institution |
| | `professional_info.bio` | String | Optional | Professional biography and research summary |
| **D. Employment Info** | `employment_info.joining_date` | Date (YYYY-MM-DD) | Optional | Official institution start date |
| | `employment_info.employment_type` | String | Optional | Full-time, Part-time, Contract, Adjunct, Visiting |
| | `employment_info.employment_status` | String | Optional | Active, On Leave, Probation |
| | `employment_info.academic_year` | String | Optional | Current appointment academic year |
| | `employment_info.internal_notes` | String | Optional | Confidential administrator notes |
| **E. Documents & Allocations** | `documents` | Array[Object] | Optional | Uploaded CV and qualification certificates |
| | *Allocation Preview* | Informational | Read-only | Course workload catalog with decoupled allocation notice |
| **F. Account Setup** | `is_active` | Boolean | Default: `true` | Portal login authorization toggle |
| | `password` | String | **Required** | Initial secure password ($\ge 8$ chars) |
| | `must_change_password` | Boolean | Default: `true` | Enforces password change on initial faculty authentication |

---

## 3. Database Changes

### 3.1 MongoDB Collections & Schemas
No legacy collections were altered or removed. The `users` collection document mapping was expanded in `backend/models/user_model.py`:
- `avatar_url`: string
- `must_change_password`: boolean
- `personal_info`: embedded document
- `contact_info`: embedded document
- `guardian_info`: embedded document (students)
- `academic_info`: embedded document (students)
- `professional_info`: embedded document (teachers)
- `employment_info`: embedded document (teachers)
- `documents`: array of subdocuments `[{ id, name, file_url, file_type, category, size, uploaded_at }]`

### 3.2 Index Integrity (`backend/database/schema.py`)
- Sparse unique index on `student_id`: `idx_users_student_id_unique` (unique: True, sparse: True)
- Sparse unique index on `employee_id`: `idx_users_employee_id_unique` (unique: True, sparse: True)
- Unique index on `email`: `idx_users_email_unique`

---

## 4. API Changes

| Method | Endpoint | Access Control | Description |
|---|---|---|---|
| `POST` | `/api/upload` | `@login_required` | Uploads avatar photo (PNG, JPG, JPEG, WEBP) or document (PDF, DOC, DOCX, PNG, JPG). Enforces $\le 5\text{ MB}$ limit. Returns relative protected URL. |
| `GET` | `/api/uploads/<folder>/<filename>` | `@login_required` | Protected asset delivery. Avatars served to authenticated users; documents restricted to Administrators or the owning user (preventing IDOR). |
| `POST` | `/api/admin/users` | `@admin_required` | Creates student/teacher user with all multi-section profile data, validates role restrictions, email/ID uniqueness, and hashes initial passwords. |
| `GET` | `/api/admin/users/<user_id>` | `@admin_required` | Retrieves complete user document including nested metadata sections. |
| `PUT` | `/api/admin/users/<user_id>` | `@admin_required` | Updates editable profile fields while preserving role immutability and enforcing unique constraint checks. |
| `PUT` | `/api/admin/users/<user_id>/status` | `@admin_required` | Toggles active status with self-deactivation protection for administrators. |

---

## 5. Security Controls & Decoupled Architecture

1. **Decoupled Architecture Enforced**:
   - Creating a student account provisions their institutional identity and credentials. It deliberately **does not** automatically enroll the student into course cohorts. Course enrollments remain isolated within the dedicated `Student Enrollments` workflow.
   - Creating a teacher account provisions their faculty identity. It deliberately **does not** grant subject permissions. Subject allocations remain managed in `Faculty Allocations`.
2. **File Upload Hardening**:
   - Strict extension whitelisting:
     - Photos: `.png`, `.jpg`, `.jpeg`, `.webp`
     - Documents: `.pdf`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`
   - File size enforced at maximum $5\text{ MB}$ ($5,242,880\text{ bytes}$).
   - Safe filename generation using `uuid.uuid4().hex + '_' + secure_filename(filename)`.
   - Traversal protection using `werkzeug.utils.secure_filename` and directory isolation.
   - Private document authorization guard: Non-administrators cannot download or view documents that do not belong to their own account.
3. **Password Security**:
   - Password minimum length $\ge 8$ characters, complexity validated.
   - Passwords hashed using PBKDF2 with SHA-256 via Werkzeug security.
   - Plaintext passwords never stored in MongoDB or exposed in API responses.
   - `must_change_password` flag triggers first-login password rotation.
4. **Audit Logging**:
   - Administrative events (`USER_CREATED`, `ADMIN_USER_UPDATED`) logged immutably in `system_logs`.

---

## 6. User Experience & Interfaces

1. **Step Progress Tracker**:
   - Visual 6-step progress bar with indicators for passed, active, and pending steps.
   - Step labels: `1. Personal Identity` $\rightarrow$ `2. Contact Details` $\rightarrow$ `3. Guardian / Professional` $\rightarrow$ `4. Academic / Employment` $\rightarrow$ `5. Docs & Catalog` $\rightarrow$ `6. Security & Setup`.
2. **Draft Persistence**:
   - "Save Draft" writes form state to `localStorage` (`edupredict_student_reg_draft` / `edupredict_teacher_reg_draft`).
   - "Restore Draft" and "Discard" controls appear automatically when a saved draft is detected.
3. **Profile Drawers**:
   - [StudentProfileDrawer.tsx](file:///c:/Users/Azan's%20PC/Documents/EduPredict/frontend/src/components/common/StudentProfileDrawer.tsx): Displays student avatar thumbnail, institutional credentials, academic profile, guardian info, address details, attached documents with links, and AI risk prediction telemetry.
   - [TeacherProfileDrawer.tsx](file:///c:/Users/Azan's%20PC/Documents/EduPredict/frontend/src/components/common/TeacherProfileDrawer.tsx): Displays faculty avatar, professional biography, qualifications, employment details, contact info, assigned courses, and attached CV/certifications.
4. **Profile Editing ([EditUserModal.tsx](file:///c:/Users/Azan's%20PC/Documents/EduPredict/frontend/src/components/admin/EditUserModal.tsx))**:
   - Accessible via "Edit" in the directory tables or "Edit Profile" from the profile drawers.
   - Allows administrators to modify permitted profile fields and save updates via `PUT /api/admin/users/<id>`.
5. **Directory Enhancements**:
   - Added Department filter dropdown and Status filter dropdown in both [AdminStudents.tsx](file:///c:/Users/Azan's%20PC/Documents/EduPredict/frontend/src/pages/admin/AdminStudents.tsx) and [AdminTeachers.tsx](file:///c:/Users/Azan's%20PC/Documents/EduPredict/frontend/src/pages/admin/AdminTeachers.tsx).
   - Displayed avatar thumbnails in the table rows.

---

## 7. Verification & Automated Test Suite Results

| Test Suite | Scope | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `tsc -b` | **PASSED** | 0 compilation errors across entire frontend. |
| **Vite Production Build** | `npm run build` | **PASSED** | 2,084 modules transformed, built in 16.11s. |
| **Frontend Unit Tests** | `vitest run --run` | **PASSED** | 15 / 15 passed (`subject_workspace.test.tsx`). |
| **Registration Workflow Tests** | `pytest tests/test_registration_workflows.py` | **PASSED** | 5 / 5 passed (student full profile, teacher full profile, avatar upload & validation, doc upload & validation, admin profile editing). |
| **Admin Management Tests** | `pytest tests/test_admin.py` | **PASSED** | 13 / 13 passed. |
| **Full Regression Suite** | `pytest` | **PASSED** | **151 / 151 passed (0 failures, 100% pass rate)**. |

---

## 8. Git Commit & Remote Synchronization

- **Commit Message**: `feat(admin): implement comprehensive student and faculty registration`
- **Files Included**:
  - `backend/app.py`: Blueprint registration for `upload_bp`
  - `backend/config.py`: Upload folder configuration and max content length
  - `backend/models/user_model.py`: Extended User entity with multi-section profile fields
  - `backend/services/user_service.py`: Extended `create_user` and added `update_user_by_admin`
  - `backend/routes/admin_routes.py`: Enhanced `POST /api/admin/users`, added `GET /api/admin/users/<id>`, `PUT /api/admin/users/<id>`
  - `backend/routes/upload_routes.py`: File upload and protected asset delivery
  - `frontend/src/types/index.ts`: Full TypeScript interfaces for personal, guardian, academic, professional, and employment metadata
  - `frontend/src/services/api.ts`: Added `uploadFile`, `adminGetUser`, and `adminUpdateUser`
  - `frontend/src/components/admin/StudentRegistrationModal.tsx`: Multi-step student registration wizard
  - `frontend/src/components/admin/TeacherRegistrationModal.tsx`: Multi-step faculty registration wizard
  - `frontend/src/components/admin/EditUserModal.tsx`: Admin profile editor
  - `frontend/src/components/common/StudentProfileDrawer.tsx`: Comprehensive student profile drawer
  - `frontend/src/components/common/TeacherProfileDrawer.tsx`: Comprehensive faculty profile drawer
  - `frontend/src/pages/admin/AdminStudents.tsx`: Upgraded student directory with filters, registration wizard, drawer, and edit actions
  - `frontend/src/pages/admin/AdminTeachers.tsx`: Upgraded faculty directory with filters, registration wizard, drawer, and edit actions
  - `tests/test_registration_workflows.py`: Dedicated integration test suite
  - `documentation/COMPLETE_REGISTRATION_WORKFLOWS_REPORT.md`: This comprehensive implementation report
