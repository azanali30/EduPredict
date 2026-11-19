# EduPredict — Phase 6B Security Review & Legacy Roster Fallback Verification Report

**Project**: EduPredict  
**Workspace**: `C:\Users\Azan's PC\Documents\EduPredict`  
**Phase**: Phase 6B — Security Review & Legacy Roster Fallback Verification  
**Status**: VERIFIED & RESOLVED — 121 / 121 BACKEND TESTS PASSING (100% SUITE PASS RATE)  
**Execution Date**: 2026-11-18  

---

## 1. Executive Summary

During the Phase 6B post-implementation security inspection, a critical architectural vulnerability was identified in the teacher student roster endpoint (`GET /api/teacher/students`) and generic student profile decorator (`can_access_student_data`):

- **Identified Defect**: The initial Phase 6B implementation contained a dual-mode fallback that fell back to the legacy `teacher_student_assignments` collection if a teacher had no active subject assignments. Under that fallback, an unmigrated teacher holding legacy student-level assignments could retrieve student records (including names, emails, and IDs) and view student profiles via `GET /api/students/<student_id>`.
- **Security Remediation**: 
  1. The legacy fallback in `GET /api/teacher/students` was **completely eliminated**.
  2. Unmigrated teachers with zero active subject assignments now receive an empty roster (`students: []`, `count: 0`) and a clear, non-sensitive assignment status message: `"No active subject assignments. Please contact an administrator to configure subject assignments."`.
  3. The legacy assignment fallback was **removed from `can_access_student_data`**; teachers can view a student profile only if they share an active subject assignment and enrollment in the same academic term.
  4. The enrollment query in `AssignmentService.get_students_for_teacher_by_subject()` was hardened to enforce strict **academic term alignment**, preventing cross-term student leakage.
  5. The legacy collection (`teacher_student_assignments`) is preserved untouched without automatic record conversion or deletion.
  6. All 120 backend unit and security tests pass with a 100% success rate.
  7. **Zero frontend files were modified**.

---

## 2. Critical Issue Analysis: Legacy Roster Fallback

### 2.1 Root Cause & Inspection
In [backend/routes/user_routes.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/routes/user_routes.py) lines 185–193, the previous code was:
```python
# VULNERABLE CODE (PRE-FIX)
if not students and not subject_id and not academic_term:
    has_subject_assignments = mongo.db.teacher_subject_assignments.count_documents({
        "teacher_id": current_user.id,
        "status": "active",
    }) > 0
    if not has_subject_assignments:
        students = AssignmentService.get_students_for_teacher(mongo.db, current_user.id)
```
And in [backend/utils/decorators.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/utils/decorators.py) lines 97–103:
```python
# VULNERABLE CODE (PRE-FIX)
# Legacy assignment fallback for generic profile
assignment = db.teacher_student_assignments.find_one({
    "teacher_id": teacher_oid,
    "student_id": target_oid,
    "status": "active",
})
return assignment is not None
```

### 2.2 Security Impact
1. An unmigrated teacher with legacy records could access the complete roster of students through `GET /api/teacher/students`.
2. The endpoint exposed student identifiers, names, emails, and creation timestamps without any verified subject assignment.
3. An unmigrated teacher could call `GET /api/students/<student_id>` and retrieve full student profile metadata.

---

## 3. Implemented Security Fixes

### 3.1 Roster Endpoint Remediation ([backend/routes/user_routes.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/routes/user_routes.py))
The fallback to `AssignmentService.get_students_for_teacher` was removed entirely. The endpoint now checks for active subject assignments first. If none exist, an empty list is immediately returned with an informative, non-sensitive message:

```python
@user_bp.route("/api/teacher/students", methods=["GET"])
@role_required("teacher")
def get_assigned_students():
    """
    Retrieve list of students assigned to the authenticated teacher.
    Strictly requires active subject-based teacher assignment and student enrollment.
    Legacy student-level assignments never grant roster access.
    """
    subject_id = request.args.get("subject_id")
    academic_term = request.args.get("academic_term")

    # Check if teacher has any active subject assignments
    has_subject_assignments = mongo.db.teacher_subject_assignments.count_documents({
        "teacher_id": current_user.id,
        "status": "active",
    }) > 0

    if not has_subject_assignments:
        return jsonify({
            "students": [],
            "count": 0,
            "message": "No active subject assignments. Please contact an administrator to configure subject assignments.",
            "status_code": 200,
        }), 200

    students = AssignmentService.get_students_for_teacher_by_subject(
        mongo.db,
        current_user.id,
        subject_id=subject_id,
        academic_term=academic_term,
    )

    return jsonify({
        "students": students,
        "count": len(students),
        "status_code": 200,
    }), 200
```

### 3.2 Student Profile Authorization Remediation ([backend/utils/decorators.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/utils/decorators.py))
In `can_access_student_data()`, legacy assignment fallback was removed. A teacher can access a student profile only if there is an active teacher-subject assignment and an active student-subject enrollment sharing the same academic term:

```python
    # 3. Teacher can access generic student profile ONLY if linked by active subject assignment and enrollment
    if actor_role == "teacher":
        if db is None:
            return False
        teacher_oid = to_object_id(actor_user.id)

        # Subject-based link check: teacher must hold active assignment in a subject the student is actively enrolled in
        t_subjs = list(db.teacher_subject_assignments.find({"teacher_id": teacher_oid, "status": "active"}))
        if not t_subjs:
            return False

        term_conditions = []
        for a in t_subjs:
            s_id = a.get("subject_id")
            term = a.get("academic_term")
            if s_id:
                cond: Dict[str, Any] = {
                    "student_id": target_oid,
                    "subject_id": s_id,
                    "status": "active",
                }
                if term:
                    cond["academic_term"] = term
                term_conditions.append(cond)

        if not term_conditions:
            return False

        if len(term_conditions) == 1:
            enroll_q = term_conditions[0]
        else:
            enroll_q = {"$or": term_conditions}

        has_enrollment = db.student_subject_enrollments.find_one(enroll_q)
        return has_enrollment is not None
```

### 3.3 Cross-Term Boundary Hardening ([backend/services/assignment_service.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/services/assignment_service.py))
In `AssignmentService.get_students_for_teacher_by_subject()`, the student enrollment query was updated from a simple subject ID list `$in` query to a term-aligned compound query. Even when no `academic_term` query parameter is passed by the caller, student enrollments are matched against the specific terms for which the teacher is assigned:

```python
        # Build term-aligned enrollment query conditions
        term_conditions = []
        for a in assignments:
            s_id = a.get("subject_id")
            term = a.get("academic_term")
            if s_id:
                cond: Dict[str, Any] = {"subject_id": s_id, "status": "active"}
                if term:
                    cond["academic_term"] = term
                term_conditions.append(cond)

        if not term_conditions:
            return []

        if len(term_conditions) == 1:
            enroll_query = term_conditions[0]
        else:
            enroll_query = {"$or": term_conditions}

        if academic_term:
            enroll_query["academic_term"] = academic_term.strip()

        enrollments = list(db.student_subject_enrollments.find(enroll_query))
```

---

## 4. End-to-End Route & Surface Security Audit

| Surface / Route | Subject Authorization Mechanism | Unmigrated Teacher Behavior | Cross-Subject / Cross-Term Behavior |
| :--- | :--- | :--- | :--- |
| **Student Roster** (`GET /api/teacher/students`) | `AssignmentService.get_students_for_teacher_by_subject` | Returns `students: []`, `count: 0`, and non-sensitive migration message | Scoped strictly to teacher's assigned subjects and assigned terms; students from other terms or subjects are excluded. |
| **Student Profile** (`GET /api/students/<student_id>`) | `can_access_student_data` | Returns `403 Forbidden`; no student profile or contact data returned | Returns `403 Forbidden` if student is not enrolled in teacher's assigned subjects or matching terms. |
| **Prediction Inference** (`POST /api/predictions`) | `can_access_student_subject_data` | Returns `403 Forbidden` | Returns `403 Forbidden` if teacher is unassigned to the subject or student is unenrolled / from another term. |
| **Prediction History** (`GET /api/predictions`) | `PredictionService.list_predictions` | Returns `predictions: []`, `total_count: 0` | Dynamic `$or` aggregation filters strictly by authorized student-subject pairs; unassigned subject queries return `403 Forbidden`. |
| **Prediction Details** (`GET /api/predictions/<id>`) | `can_access_student_subject_data` | Returns `403 Forbidden` | Returns `403 Forbidden` without disclosing prediction payload, confidence scores, features, or risk status. |
| **Subject Performance & Risk Hub** | Client-side aggregation over `/api/predictions` | Produces 0 records / empty state | Cannot aggregate data from unassigned subjects because API returns 0 records. |
| **Teacher Reports & CSV Exports** | Client-side aggregation over `/api/teacher/students` and `/api/predictions` | Exports 0 records / blank cohort | Only contains students and predictions authorized by the backend APIs. |

---

## 5. Security Test Suite & Verification Results

### 5.1 Dedicated Security Tests

1. `tests/test_rbac.py::test_unmigrated_teacher_with_legacy_assignment_alone_denied_access`:
   - Sets up an unmigrated teacher holding ONLY a legacy `teacher_student_assignments` record.
   - Asserts `GET /api/teacher/students` returns `students: []`, `count: 0`, and status message.
   - Asserts `GET /api/students/<student_id>` returns `403 Forbidden` with zero disclosed fields.
   - Asserts `GET /api/predictions` returns `predictions: []` and `total_count: 0`.
   - **Result: PASSED**.

2. `tests/test_rbac.py::test_teacher_cross_term_roster_isolation`:
   - Teacher assigned to Mathematics in `2026-T1`.
   - Student 1 enrolled in Mathematics in `2026-T1`.
   - Student 2 enrolled in Mathematics in `2026-T2`.
   - Asserts `GET /api/teacher/students` returns ONLY Student 1 (`count: 1`).
   - Asserts `GET /api/students/<student_2.id>` returns `403 Forbidden`.
   - **Result: PASSED**.

3. `tests/test_subject_rbac.py::test_academic_roster_enforces_subject_scope`:
   - Mathematics teacher queries Portuguese student profile -> returns `403 Forbidden`.
   - Mathematics teacher queries `GET /api/teacher/students?subject_id=<port_id>` -> returns `count: 0`, `students: []`.
   - Mathematics teacher queries `GET /api/predictions?subject=Portuguese Language` -> returns `403 Forbidden`.
   - **Result: PASSED**.

4. `tests/test_subject_rbac.py::test_academic_term_boundaries_strictly_enforced`:
   - Asserts predictions cannot be generated or accessed across mismatched academic terms.
   - **Result: PASSED**.

5. `tests/test_subject_rbac.py::test_legacy_student_assignment_alone_does_not_grant_subject_access`:
   - Asserts legacy assignment alone yields `403 Forbidden` on prediction operations.
   - **Result: PASSED**.

6. `tests/test_subject_rbac.py::test_phase_6b_dual_enrolled_student_privacy_isolation`:
   - Dual-enrolled Student Ali (Mathematics and Portuguese Language in `2026-T1`).
   - Teacher A assigned only to Mathematics in `2026-T1`.
   - Teacher B assigned only to Portuguese Language in `2026-T1`.
   - Asserts all 7 mandatory privacy criteria:
     1. Teacher A accesses only Mathematics information (roster, list, detail, create).
     2. Teacher A is strictly barred from Ali's Portuguese predictions, marks, and history (403 on detail, unassigned subject list, creation, and Portuguese absent from roster/list).
     3. Teacher B accesses only Portuguese Language information.
     4. Neither teacher can access other subject data by parameter manipulation (`?subject=...`, `?student_id=...`) or ID forging.
     5. Generic student profile (`GET /api/students/<ali.id>`) contains standard identity fields (`id`, `full_name`, `email`, `role`, `is_active`) with zero academic marks or predictions.
     6. Administrator retains authorized system access across both subjects.
     7. Student Ali retains full access across both enrolled subjects.
   - **Result: PASSED**.

### 5.2 Full Test Suite Results
Command: `.venv\Scripts\pytest -v`
```
======================= 121 passed in 81.33s (0:01:21) ========================
```
- Total Tests: 121
- Passed: 121
- Failures: 0
- Errors: 0
- Pass Rate: 100%

---

## 6. Dual-Enrolled Student Final Privacy Verification (Ali Scenario)

### 6.1 Setup Matrix
- **Student**: Ali (`ali@edupredict.com`)
  - Enrolled: `Mathematics` (`2026-T1`)
  - Enrolled: `Portuguese Language` (`2026-T1`)
- **Teacher A**: `teacher.a@edupredict.com`
  - Assigned: `Mathematics` (`2026-T1`)
- **Teacher B**: `teacher.b@edupredict.com`
  - Assigned: `Portuguese Language` (`2026-T1`)
- **Predictions**:
  - Baseline Milestone 0 prediction created for Ali in Mathematics (`math_pred_id`)
  - Baseline Milestone 0 prediction created for Ali in Portuguese Language (`port_pred_id`)

### 6.2 Findings & Verification Matrix

| Actor | Action / Endpoint | Expected Result | Actual Result | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Teacher A** | `GET /api/teacher/students` | Ali listed; `enrolled_subjects_under_teacher == ["Mathematics"]` | Math only; Portuguese absent | PASS |
| **Teacher A** | `GET /api/predictions` | Lists only `math_pred_id` (Mathematics) | 1 item returned; Portuguese absent | PASS |
| **Teacher A** | `GET /api/predictions/<math_pred_id>` | 200 OK with prediction details | 200 OK | PASS |
| **Teacher A** | `GET /api/predictions/<port_pred_id>` | 403 Forbidden; no prediction data | 403 Forbidden (`"prediction"` not in response) | PASS |
| **Teacher A** | `GET /api/predictions?subject=Portuguese Language` | 403 Forbidden | 403 Forbidden | PASS |
| **Teacher A** | `POST /api/predictions` (subject: Portuguese) | 403 Forbidden | 403 Forbidden | PASS |
| **Teacher A** | `GET /api/students/<ali.id>` | 200 OK with identity metadata; 0 marks/predictions | 200 OK; marks/predictions absent | PASS |
| **Teacher B** | `GET /api/teacher/students` | Ali listed; `enrolled_subjects_under_teacher == ["Portuguese Language"]` | Portuguese only; Math absent | PASS |
| **Teacher B** | `GET /api/predictions` | Lists only `port_pred_id` (Portuguese Language) | 1 item returned; Math absent | PASS |
| **Teacher B** | `GET /api/predictions/<port_pred_id>` | 200 OK with prediction details | 200 OK | PASS |
| **Teacher B** | `GET /api/predictions/<math_pred_id>` | 403 Forbidden; no prediction data | 403 Forbidden (`"prediction"` not in response) | PASS |
| **Teacher B** | `GET /api/predictions?subject=Mathematics` | 403 Forbidden | 403 Forbidden | PASS |
| **Teacher B** | `POST /api/predictions` (subject: Mathematics) | 403 Forbidden | 403 Forbidden | PASS |
| **Teacher B** | `GET /api/students/<ali.id>` | 200 OK with identity metadata; 0 marks/predictions | 200 OK; marks/predictions absent | PASS |
| **Admin** | `GET /api/predictions?student_id=<ali.id>` | Lists both Math and Portuguese predictions | 2 items returned (`{"Mathematics", "Portuguese Language"}`) | PASS |
| **Admin** | `GET /api/predictions/<id>` (both) | 200 OK for both | 200 OK for both | PASS |
| **Student Ali** | `GET /api/predictions` | Lists both Math and Portuguese predictions | 2 items returned | PASS |
| **Student Ali** | `GET /api/predictions/<id>` (both) | 200 OK for both | 200 OK for both | PASS |
| **Student Ali** | `POST /api/predictions` (both) | 201 Created for both enrolled subjects | 201 Created for both | PASS |

---

## 7. Audit Requirement Checklist

| Requirement | Audit Finding | Status |
| :--- | :--- | :--- |
| **1. Legacy assignments never grant subject-level roster access** | Legacy fallback removed from `user_routes.py`. Unmigrated teachers cannot access roster. | Verified |
| **2. Unmigrated teacher receives empty roster** | Returns `{"students": [], "count": 0, ...}` when teacher has 0 active subject assignments. | Verified |
| **3. API returns clear, non-sensitive migration message** | Returns: `"No active subject assignments. Please contact an administrator to configure subject assignments."`. | Verified |
| **4. Zero exposure of student names, emails, IDs, records** | Unmigrated teachers receive no student profile, roster, or prediction data. | Verified |
| **5. Legacy collection not removed or deleted** | `teacher_student_assignments` collection and indexes remain completely intact. | Verified |
| **6. Legacy assignments not auto-converted** | No automatic conversions performed; assignments must be created explicitly via Phase 6 admin endpoints or CLI migration scripts. | Verified |
| **7. Academic-term isolation enforced** | Cross-term prediction access and cross-term roster access are blocked. | Verified |
| **8. Frontend files untouched** | Confirmed with `git status` that zero frontend files have been modified. | Verified |

---

## 8. Current Git Working Tree Status

```
Changes not staged for commit:
	modified:   backend/database/schema.py
	modified:   backend/models/__init__.py
	modified:   backend/models/prediction_model.py
	modified:   backend/routes/admin_routes.py
	modified:   backend/routes/prediction_routes.py
	modified:   backend/routes/user_routes.py
	modified:   backend/services/assignment_service.py
	modified:   backend/services/prediction_service.py
	modified:   backend/utils/decorators.py
	tests/conftest.py
	tests/test_prediction_api.py
	tests/test_rbac.py

Untracked files:
	backend/models/student_subject_enrollment_model.py
	backend/models/subject_model.py
	backend/models/teacher_subject_assignment_model.py
	backend/services/enrollment_service.py
	backend/services/subject_service.py
	documentation/PHASE_6A_IMPLEMENTATION_REPORT.md
	documentation/PHASE_6B_IMPLEMENTATION_REPORT.md
	documentation/PHASE_6B_SECURITY_REVIEW.md
	documentation/SUBJECT_BASED_ASSIGNMENT_ARCHITECTURE_AUDIT.md
	scripts/
	tests/test_subject_models_and_services.py
	tests/test_subject_rbac.py
```
*(All modifications are isolated to `backend/`, `tests/`, `scripts/`, and `documentation/`; frontend remains untouched).*

---

## 9. Conclusion

The legacy roster fallback vulnerability has been remediated and verified through automated test suites. The backend now strictly enforces subject-based authorization across all data-exposing routes.

All work has halted in accordance with project instructions. Phase 6C will not begin until explicit final security approval is granted by the project owner.
