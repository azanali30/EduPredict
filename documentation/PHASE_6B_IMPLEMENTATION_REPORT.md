# EduPredict — Phase 6B Implementation Report: Backend Subject-Based RBAC & API Enforcement

**Project**: EduPredict  
**Workspace**: `C:\Users\Azan's PC\Documents\EduPredict`  
**Phase**: Phase 6B — Backend Subject-Based RBAC & API Enforcement  
**Baseline Git Commit**: Phase 5D-F / Phase 6A (`af55085`, `ee036fb`)  
**Status**: COMPLETE — ALL 118 BACKEND TESTS PASSING (100% SUITE PASS RATE)  
**Execution Timestamp**: 2026-11-18  

---

## 1. Executive Summary & Objective

In Phase 6B, EduPredict implemented comprehensive subject-based Role-Based Access Control (RBAC) and strict API authorization enforcement across the Flask backend. 

Prior to Phase 6B, teacher authorization operated on a monolithic teacher-student assignment model (`teacher_student_assignments`), where an assigned teacher could access all academic records and prediction data for a student regardless of subject discipline. 

Under the Phase 6B authorization model:
1. **Core Access Invariant**: A teacher can create, view, or analyze a student's academic prediction records for a subject **only when BOTH conditions are verified simultaneously**:
   - The teacher has an active assignment for that subject and applicable academic term (`teacher_subject_assignments`).
   - The student has an active enrollment in that subject and applicable academic term (`student_subject_enrollments`).
2. **Zero-Trust for Legacy Assignments**: An existing legacy student-level assignment (`teacher_student_assignments`) alone **NEVER grants subject-level or prediction-level access**.
3. **Cross-Subject Isolation**: A mathematics teacher cannot access Portuguese Language prediction records for a student, even if both teachers are assigned to that same student under legacy records.
4. **Student Self-Access**: A student can only view their own prediction records across subjects they are actively enrolled in, and cannot forge another student's identifier.
5. **Admin System Oversight**: System administrators retain verified institution-wide access for governance, audit, and assignment administration.
6. **Frontend Zero-Touch**: All enforcement is strictly implemented at the Flask backend service and decorator layer; no frontend components or routes were modified.

---

## 2. Inventory of Modified & Created Files

| File Path | Status | Purpose & Changes |
| :--- | :--- | :--- |
| `backend/utils/decorators.py` | Modified | Implemented `can_access_student_subject_data()` enforcing joint teacher-subject assignment and student-subject enrollment; updated `can_access_student_data()` for dual-mode student profile resolution. |
| `backend/models/prediction_model.py` | Modified | Added optional `subject_id` and `academic_term` fields to `PredictionRecord` while preserving legacy `subject` string compatibility in `to_doc()`, `to_dict()`, and `from_doc()`. |
| `backend/services/prediction_service.py` | Modified | Enforced subject-based RBAC in `create_prediction`, `get_prediction_by_id`, and dynamic `$or` aggregation in `list_predictions` to scope history and count totals strictly to authorized subject-student pairs. |
| `backend/routes/prediction_routes.py` | Modified | Accepted optional `academic_term` from prediction request payload and forwarded it to `PredictionService.create_prediction`. |
| `backend/routes/user_routes.py` | Modified | Added `GET /api/teacher/subjects` endpoint; updated `GET /api/teacher/students` to use `AssignmentService.get_students_for_teacher_by_subject` with fallback for unmigrated teachers. |
| `backend/routes/admin_routes.py` | Modified | Added admin management endpoints for subjects (`/api/admin/subjects`), teacher assignments (`/api/admin/teacher-subjects`), and student enrollments (`/api/admin/student-enrollments`). |
| `backend/database/schema.py` | Modified | Added compound sparse indexes `idx_preds_student_subject_created` and `idx_preds_subject_created` to the `predictions` collection for performant scoped filtering. |
| `tests/conftest.py` | Modified | Enhanced test fixtures to properly isolate subject seeding and clean DB tear-down without premature student enrollment side effects. |
| `tests/test_prediction_api.py` | Modified | Aligned teacher prediction API tests with Phase 6B prerequisites (ensured test teacher is assigned to Math and test student is enrolled in Math). |
| `tests/test_subject_rbac.py` | Created | Comprehensive security test suite covering all 15 required security scenarios. |

---

## 3. Authorization Architecture & Access Rules

### 3.1 The Invariant Enforcement Decorator: `can_access_student_subject_data`

Located in [backend/utils/decorators.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/utils/decorators.py):

```python
def can_access_student_subject_data(
    actor_user: Dict[str, Any],
    student_id: Union[str, ObjectId],
    subject: Union[str, ObjectId, Dict[str, Any]],
    db,
    academic_term: Optional[str] = None
) -> bool:
```

#### Evaluation Rules:
1. **Administrator Role**:
   - Returns `True` unconditionally.
2. **Student Role**:
   - The actor must be the student himself (`actor_id == student_id`).
   - If the student has active subject enrollments in MongoDB, the target subject must match one of their active enrolled subjects.
   - If the student is a newly registered demo student with 0 enrollments on file, self-prediction is permitted for baseline usability.
3. **Teacher Role**:
   - Resolves canonical `subject_id` from ObjectId, dict, or subject name string (e.g., `"Mathematics"`, `"Portuguese Language"`).
   - Queries `teacher_subject_assignments` for an active record: `{"teacher_id": teacher_id, "subject_id": subject_id, "status": "active"}`. If none, returns `False`.
   - Queries `student_subject_enrollments` for an active record: `{"student_id": student_id, "subject_id": subject_id, "status": "active"}`. If none, returns `False`.
   - **Academic Term Evaluation**:
     - If `academic_term` is explicitly supplied (or bound to the prediction record), both the teacher's assignment and the student's enrollment must match that exact academic term.
     - If `academic_term` is omitted, the teacher assignment terms and student enrollment terms are compared to ensure at least one active overlapping term exists ($T_{teacher} \cap T_{student} \neq \emptyset$). If there is no active term overlap, access is rejected (`False`).
4. **Legacy Assignment Invalidation**:
   - `teacher_student_assignments` is **never queried or accepted** for subject or prediction authorization.

### 3.2 Dual-Mode Profile Access: `can_access_student_data`
For non-subject-specific metadata (e.g., viewing a student's basic contact card in the roster):
- Checks whether the teacher has any active subject assignment that overlaps with any active enrollment of the student.
- If none is found, falls back to `AssignmentService.is_student_assigned_to_teacher()` to maintain read-only compatibility for unmigrated teachers.

---

## 4. API Endpoints & Request/Response Contracts

### 4.1 Prediction Endpoints

#### `POST /api/predictions`
- **Request Payload**: Accepts standard feature dictionary, `student_id`, `subject` (string or ID), and optional `academic_term` (string, e.g., `"2026-T1"`).
- **Enforcement**: Calls `can_access_student_subject_data()`. Rejects with `403 Forbidden` if the teacher lacks the subject assignment or the student is not enrolled.
- **Persistence**: Persists `subject_id` (ObjectId) and `academic_term` (str) onto the `PredictionRecord` alongside the canonical `subject` string.

#### `GET /api/predictions/<prediction_id>`
- **Enforcement**: Retrieves prediction record; resolves its `student_id`, `subject_id` (or fallback to `subject` name), and `academic_term`.
- **RBAC Check**: Calls `can_access_student_subject_data()`.
- **Data Protection**: If unauthorized, returns `403 Forbidden` with a generic access error message. No prediction attributes, probabilities, risk tiers, or feature values are leaked in the response.

#### `GET /api/predictions` (List & History)
- **Teacher Authorization Scoping**:
  - Automatically identifies all subjects assigned to the logged-in teacher and all students enrolled in those subjects.
  - Constructs a MongoDB `$or` filter: `[{"student_id": s_id, "subject_id": subj_id}, ...]`.
  - If a teacher queries `?subject=Portuguese Language` while only assigned to `Mathematics`, the query returns empty results (`items: [], total_count: 0`).
  - Total counts and pagination metadata strictly reflect only records the caller is authorized to view.

### 4.2 Teacher Roster & Subject Discovery Endpoints

#### `GET /api/teacher/subjects`
- **Authentication**: `@teacher_required`
- **Response**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "673b...",
        "name": "Mathematics",
        "code": "MATH",
        "canonical_key": "mathematics",
        "status": "active"
      }
    ]
  }
  ```

#### `GET /api/teacher/students`
- **Dual-Mode Roster Scoping**:
  - Fetches distinct students enrolled across all subjects taught by the teacher via `AssignmentService.get_students_for_teacher_by_subject()`.
  - If the teacher has not yet been assigned to any subjects in Phase 6A/6B, gracefully falls back to legacy assignments so existing teacher workflows do not crash before Phase 6C administrative migration.

### 4.3 Admin Management Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/admin/subjects` | `GET` | Admin | List all registered subjects with optional `status` filter. |
| `/api/admin/subjects` | `POST` | Admin | Register new academic subject (`name`, `code`, `canonical_key`). |
| `/api/admin/subjects/<id>/status` | `PUT` | Admin | Activate or deactivate subject (`status: "active" \| "inactive"`). |
| `/api/admin/teacher-subjects` | `POST` | Admin | Assign teacher to subject and academic term. |
| `/api/admin/teacher-subjects` | `GET` | Admin | List teacher-subject assignments with optional teacher/subject/term filters. |
| `/api/admin/teacher-subjects/<id>/status` | `PUT` | Admin | Update status of teacher-subject assignment. |
| `/api/admin/student-enrollments` | `POST` | Admin | Enroll student in subject and academic term. |
| `/api/admin/student-enrollments` | `GET` | Admin | List student enrollments with optional student/subject/term filters. |
| `/api/admin/student-enrollments/<id>/status` | `PUT` | Admin | Update status of student enrollment. |

---

## 5. Security Test Suite Verification (`tests/test_subject_rbac.py`)

All 15 mandatory security scenarios were implemented and validated:

```
tests/test_subject_rbac.py::test_math_teacher_cannot_access_portuguese_prediction PASSED [ 88%]
tests/test_subject_rbac.py::test_portuguese_teacher_cannot_access_mathematics_prediction PASSED [ 88%]
tests/test_subject_rbac.py::test_legacy_student_assignment_alone_does_not_grant_subject_access PASSED [ 89%]
tests/test_subject_rbac.py::test_teacher_without_subject_assignment_receives_403 PASSED [ 90%]
tests/test_subject_rbac.py::test_teacher_without_matching_student_enrollment_receives_403 PASSED [ 91%]
tests/test_subject_rbac.py::test_student_cannot_access_other_student_predictions PASSED [ 92%]
tests/test_subject_rbac.py::test_student_cannot_forge_student_id_on_create PASSED [ 93%]
tests/test_subject_rbac.py::test_unauthorized_prediction_detail_does_not_disclose_data PASSED [ 94%]
tests/test_subject_rbac.py::test_pagination_totals_strictly_exclude_unauthorized_records PASSED [ 94%]
tests/test_subject_rbac.py::test_academic_roster_enforces_subject_scope PASSED [ 95%]
tests/test_subject_rbac.py::test_admin_assignment_endpoints_reject_non_admins PASSED [ 96%]
tests/test_subject_rbac.py::test_authorized_teacher_can_predict_and_access_records PASSED [ 97%]
tests/test_subject_rbac.py::test_authorized_student_can_access_own_enrolled_records PASSED [ 98%]
tests/test_subject_rbac.py::test_historical_records_retain_original_subject_strings PASSED [ 99%]
tests/test_subject_rbac.py::test_academic_term_boundaries_strictly_enforced PASSED [100%]
```

### Overall Suite Pass Rate
Running `pytest -v` across the entire EduPredict backend test suite produced:
```
======================= 118 passed in 98.34s (0:01:38) ========================
```
- **Total Tests Collected**: 118
- **Total Tests Passed**: 118
- **Failed**: 0
- **Errors**: 0
- **Pass Rate**: 100%

---

## 6. Database Indexing & Query Optimizations

In [backend/database/schema.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/database/schema.py), sparse compound indexes were added to support high-throughput subject-scoped queries without table scans:

1. `idx_preds_student_subject_created`:
   - Keys: `[("student_id", ASCENDING), ("subject_id", ASCENDING), ("created_at", DESCENDING)]`
   - Purpose: Optimizes student history and single-student subject-scoped queries.
   - Sparse: `True` (preserves efficiency for legacy prediction records lacking `subject_id`).
2. `idx_preds_subject_created`:
   - Keys: `[("subject_id", ASCENDING), ("created_at", DESCENDING)]`
   - Purpose: Optimizes cohort aggregation and subject-wide reporting queries.
   - Sparse: `True`.

---

## 7. Migration Readiness & Phase 6C Prerequisites

- **Legacy Collection Status**: The legacy `teacher_student_assignments` collection remains completely intact and uncorrupted.
- **Data Integrity**: Historical prediction records retaining strings `"Mathematics"` or `"Portuguese Language"` continue to function without modification.
- **Frontend Readiness**: The frontend was left 100% untouched during Phase 6B. In Phase 6C, frontend components (Overview, Roster, Performance, Predictions Hub, and At-Risk filters) can bind to `GET /api/teacher/subjects` to allow teachers to toggle between their assigned subjects dynamically.

---

## 8. Conclusion & Sign-Off

Phase 6B is fully implemented, verified against 118 automated tests, and ready for deployment. In accordance with project instructions, all work has stopped and awaits explicit user approval prior to proceeding to Phase 6C.
