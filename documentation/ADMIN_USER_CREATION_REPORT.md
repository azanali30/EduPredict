# EduPredict — Administrator Student & Teacher Creation Report

**Project**: EduPredict (Aptech eProject Big Data / Academic Analytics)  
**Date**: November 2026  
**Status**: Implemented & Verified  

---

## 1. Executive Summary

To satisfy institutional governance and Aptech SRS requirements, Administrator user management has been expanded to support direct, verified creation and status management of **Student** and **Teacher** accounts. 

Prior to this implementation, users were primarily registered through public authentication or seeded scripts. Now, administrators have full control to create student and faculty accounts with institutional identifiers (`student_id` / Admission ID, `employee_id` / Teacher ID, `contact_number`, and `department`), toggle account activity status (`is_active`), and inspect user profiles—while maintaining strict separation from course enrollment and subject allocation.

---

## 2. Architecture & Data Modeling

### 2.1 User Model Enhancements (`backend/models/user_model.py`)
Extended `User` domain model with optional institutional metadata attributes:
- `student_id`: Unique institutional admission / roll number for students (e.g., `STU-2026-001`).
- `employee_id`: Unique institutional faculty code for teachers (e.g., `FAC-ENG-042`).
- `contact_number`: Optional guardian/instructor contact telephone.
- `department`: Faculty department/division (e.g., `Mathematics & Computing`, `Languages & Literature`).

### 2.2 Database Indexes & Constraints (`backend/database/schema.py`)
Added sparse unique indexes on the `users` collection to guarantee identity uniqueness while preserving compatibility for legacy records:
```python
db.users.create_index(
    [("student_id", ASCENDING)],
    name="idx_users_student_id_unique",
    unique=True,
    sparse=True,
)
db.users.create_index(
    [("employee_id", ASCENDING)],
    name="idx_users_employee_id_unique",
    unique=True,
    sparse=True,
)
```

---

## 3. Administrator API Endpoints (`backend/routes/admin_routes.py`)

### 3.1 Account Creation: `POST /api/admin/users`
- **Access Control**: Strictly restricted to `@admin_required`.
- **Allowed Roles**: Whitelisted exclusively to `'student'` and `'teacher'`.
- **Validation Rules**:
  - Full Name: Minimum 2 characters.
  - Email: Valid email format, duplicate rejection with HTTP 409 Conflict.
  - Password: Minimum 8 characters, hashed with PBKDF2 via Werkzeug security.
  - Role-specific Identifiers:
    - `student`: `student_id` is mandatory and validated for uniqueness across all student records.
    - `teacher`: `employee_id` is mandatory and validated for uniqueness across all teacher records.
  - Audit Logging: Creates an immutable entry in the `system_logs` collection.
- **Response**: Returns HTTP 201 Created with sanitized user payload (excluding password hash).

### 3.2 Account Status Toggle: `PUT /api/admin/users/<user_id>/status`
- **Access Control**: Strictly restricted to `@admin_required`.
- **Payload**: `{"is_active": true | false}`.
- **Safety Guard**: Prevents administrators from deactivating their own administrative account (HTTP 400 Bad Request with explanatory message: `"Administrators cannot deactivate their own account."`).
- **Audit Logging**: Logs status change action with actor identity.

---

## 4. Frontend Management Interfaces

### 4.1 Student Management (`frontend/src/pages/admin/AdminStudents.tsx`)
- **Action Placement**: Prominent `+ Add Student` primary button in both the `PageHeader` actions and the `SectionCard` directory header.
- **Modal Form**:
  - Full Name (text input)
  - Student ID / Admission ID (formatted, e.g. `STU-2026-XXXX`)
  - Institutional Email (validated)
  - Contact Number (optional)
  - Initial Password with view/hide toggle
  - Initial Account Status (Active / Inactive)
- **Directory Table**:
  - Student Identity (avatar initials + full name)
  - Admission ID badge (`# STU-XXXX`)
  - Email with icon
  - Contact number
  - Registered subjects count
  - Status badge (Active / Deactivated)
  - Action buttons: "Inspect Profile" (opens slide-out drawer) and "Deactivate" / "Activate" toggle.

### 4.2 Teacher Management (`frontend/src/pages/admin/AdminTeachers.tsx`)
- **Action Placement**: Prominent `+ Add Teacher` primary button in both `PageHeader` actions and `SectionCard` directory header.
- **Modal Form**:
  - Full Name (text input)
  - Faculty / Employee ID (e.g. `FAC-XXXX`)
  - Institutional Email (validated)
  - Department Selection dropdown
  - Contact Number (optional)
  - Initial Password with view/hide toggle
  - Initial Account Status (Active / Inactive)
- **Directory Table**:
  - Faculty Member (avatar initials + full name)
  - Employee ID badge
  - Department badge
  - Email with icon
  - Contact number
  - Assigned courses count
  - Status badge (Active / Deactivated)
  - Action buttons: "Deactivate" / "Activate" toggle.

### 4.3 Separation of Concerns
The creation of user accounts strictly provisions identity credentials and profile records. It intentionally does **not** auto-enroll students or auto-assign teachers to courses. Subject assignments and student course registrations remain managed via the dedicated Allocation Matrix (`TeacherAssignments.tsx` and `AdminEnrollments.tsx`), ensuring architectural integrity and preventing unintentional data linkage.

---

## 5. Automated Verification & Test Coverage

### 5.1 Backend Test Cases (`tests/test_admin.py`)
The admin test suite was expanded with 6 dedicated integration tests:
1. `test_admin_create_student_success`: Validates student creation, password hashing, and user document persistence.
2. `test_admin_create_teacher_success`: Validates faculty creation with department and employee ID.
3. `test_admin_create_user_duplicate_email_and_id_rejected`: Enforces duplicate email and duplicate ID rejection with 409 Conflict.
4. `test_admin_create_user_role_and_field_validations`: Validates role restrictions (rejects admin or invalid roles) and required field checks.
5. `test_non_admin_cannot_create_user`: Verifies teacher, student, and unauthenticated users receive 403 / 401.
6. `test_admin_update_user_status_and_self_guard`: Validates account activation/deactivation and self-deactivation guard.

### 5.2 Verification Results
- **Backend Admin Tests**: 13 / 13 passed (`tests/test_admin.py`).
- **Full Backend Regression Suite**: 146 / 146 passed.
- **Frontend Type Safety**: 0 TypeScript compilation errors (`tsc -b`).
- **Production Bundle**: Clean build via Vite (`vite build`).
