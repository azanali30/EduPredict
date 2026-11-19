# EduPredict — Phase 6A Implementation Report: Database Schemas, Subject Catalog & Migration Foundation

> **Phase**: Phase 6A  
> **Status**: COMPLETED & VERIFIED  
> **Timestamp**: 2026-11-18T07:58:30+05:00  
> **Git Baseline**: `ee036fb` (Phase 5D-F Final QA)  
> **Execution Mode**: Strictly scoped foundation implementation (zero Phase 6B authorization or frontend changes)

---

## 1. Executive Summary

Phase 6A establishes the foundational multi-course and subject catalog infrastructure for **EduPredict**, executing the first milestone approved in [`documentation/SUBJECT_BASED_ASSIGNMENT_ARCHITECTURE_AUDIT.md`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/documentation/SUBJECT_BASED_ASSIGNMENT_ARCHITECTURE_AUDIT.md).

All implementations strictly adhere to the mandatory Phase 6A rules:
- **Zero Frontend Modifications**: React components, routing, and dashboards remain completely untouched.
- **Zero Authorization Disruptions**: Authorization functions (such as `can_access_student_data`) remain unmodified.
- **Legacy Assignment Safety**: The legacy `teacher_student_assignments` collection is preserved and continues to function without alteration.
- **Multi-Term Isolation**: Unique compound indexes ensure no duplicate assignments or enrollments exist within the same academic term.
- **Non-Destructive Migration Tools**: The migration CLI defaults strictly to `DRY RUN (READ ONLY)`, requiring an explicit `--apply` flag for database writes.

---

## 2. Files Created and Modified

### 2.1 Files Created
1. [`backend/models/subject_model.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/models/subject_model.py):
   Domain entity representing an academic subject in the course catalog (`code`, `name`, `canonical_key`, `department`, `description`, `target_scale`, `is_active`, timestamps).
2. [`backend/models/teacher_subject_assignment_model.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/models/teacher_subject_assignment_model.py):
   Domain entity linking teachers to academic subjects and terms (`teacher_id`, `subject_id`, `academic_term`, `assigned_by`, `status`, timestamps).
3. [`backend/models/student_subject_enrollment_model.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/models/student_subject_enrollment_model.py):
   Domain entity tracking student course enrollments (`student_id`, `subject_id`, `academic_term`, `enrolled_by`, `status`, timestamps).
4. [`backend/services/subject_service.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/services/subject_service.py):
   Service layer for subject catalog registration, case-normalized lookups, and idempotent canonical subject seeding.
5. [`backend/services/enrollment_service.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/services/enrollment_service.py):
   Service layer for student enrollments, dropping, reactivation without duplicate documents, and multi-term queries.
6. [`scripts/migrate_prediction_subject_ids.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/scripts/migrate_prediction_subject_ids.py):
   CLI tool for backfilling canonical `subject_id` on historical prediction records (default safe dry-run mode, explicit `--apply` mode).
7. [`scripts/analyze_legacy_assignments.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/scripts/analyze_legacy_assignments.py):
   Non-destructive analysis tool inspecting legacy teacher-student mappings, student prediction subjects, and instructor cohort footprints.
8. [`tests/test_subject_models_and_services.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/tests/test_subject_models_and_services.py):
   13 comprehensive pytest integration and unit tests covering models, services, term isolation, duplicate prevention, migration idempotency, and legacy isolation.

### 2.2 Files Modified
1. [`backend/models/__init__.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/models/__init__.py):
   Exported `Subject`, `TeacherSubjectAssignment`, and `StudentSubjectEnrollment`.
2. [`backend/services/assignment_service.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/services/assignment_service.py):
   Added `assign_teacher_to_subject`, `get_subjects_for_teacher`, and `get_students_for_teacher_by_subject` while preserving all legacy methods.
3. [`backend/database/schema.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/database/schema.py):
   Registered indexes for `subjects`, `teacher_subject_assignments`, `student_subject_enrollments`, and `predictions.subject_id`.
4. [`tests/conftest.py`](file:///C:/Users/Azan's%20PC/Documents/EduPredict/tests/conftest.py):
   Updated `clean_db` fixture to clean the three new collections during test teardown.

---

## 3. MongoDB Collection Schemas & Indexes

### 3.1 Collection: `subjects`
```json
{
  "_id": "ObjectId",
  "code": "MATH-101",
  "name": "Mathematics",
  "canonical_key": "mathematics",
  "department": "STEM",
  "description": "Core secondary education mathematics curriculum.",
  "target_scale": "0 - 100",
  "is_active": true,
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```
**Indexes**:
- `idx_subjects_code_unique`: `{"code": 1}`, `unique=True`
- `idx_subjects_canonical_unique`: `{"canonical_key": 1}`, `unique=True`
- `idx_subjects_is_active`: `{"is_active": 1}`

### 3.2 Collection: `teacher_subject_assignments`
```json
{
  "_id": "ObjectId",
  "teacher_id": "ObjectId",
  "subject_id": "ObjectId",
  "academic_term": "2026-T1",
  "assigned_by": "ObjectId",
  "status": "active",
  "assigned_at": "ISODate",
  "updated_at": "ISODate"
}
```
**Indexes**:
- `idx_teacher_subj_term_unique`: `{"teacher_id": 1, "subject_id": 1, "academic_term": 1}`, `unique=True`
- `idx_teacher_subj_status`: `{"teacher_id": 1, "status": 1}`
- `idx_subj_teachers_status`: `{"subject_id": 1, "status": 1}`

### 3.3 Collection: `student_subject_enrollments`
```json
{
  "_id": "ObjectId",
  "student_id": "ObjectId",
  "subject_id": "ObjectId",
  "academic_term": "2026-T1",
  "enrolled_by": "ObjectId",
  "status": "active",
  "enrolled_at": "ISODate",
  "updated_at": "ISODate"
}
```
**Indexes**:
- `idx_student_subj_term_unique`: `{"student_id": 1, "subject_id": 1, "academic_term": 1}`, `unique=True`
- `idx_student_subj_status`: `{"student_id": 1, "status": 1}`
- `idx_subj_students_status`: `{"subject_id": 1, "status": 1}`

### 3.4 Augmented Collection: `predictions`
- Added sparse index `idx_preds_student_subject`: `{"student_id": 1, "subject_id": 1}` (`sparse=True`), preserving existing documents without `subject_id`.

---

## 4. Service Methods Implemented

### 4.1 `SubjectService`
- `create_subject(db, code, name, canonical_key, department, description, target_scale, admin_id)`
  * Validates non-empty attributes, normalizes `code` to uppercase and `canonical_key` to lowercase.
  * Validates uniqueness of both `code` and `canonical_key` prior to insert.
- `get_subject_by_id(db, subject_id)`
- `get_subject_by_canonical_key(db, canonical_key)`
- `get_subject_by_code(db, code)`
- `list_active_subjects(db)`
- `ensure_canonical_subjects(db)`
  * Seeds `MATH-101` (`mathematics`) and `PORT-101` (`portuguese`) idempotently.

### 4.2 `EnrollmentService`
- `enroll_student(db, student_id, subject_id, academic_term, enrolled_by)`
  * Verifies student role and active subject existence.
  * If already active in term, returns existing document (zero duplicate creation).
  * If dropped or completed, reactivates status to `"active"`.
- `drop_student(db, student_id, subject_id, academic_term, actor_id)`
  * Transitions enrollment status to `"dropped"` with timestamp update.
- `get_student_enrolled_subjects(db, student_id, academic_term, active_only)`
  * Resolves subject records with attached term and enrollment status.
- `get_enrolled_students_for_subject(db, subject_id, academic_term, active_only)`
  * Resolves student profiles enrolled in the specified subject.

### 4.3 Enhanced `AssignmentService`
- `assign_teacher_to_subject(db, teacher_id, subject_id, academic_term, admin_id)`
  * Verifies teacher role and active subject existence.
  * If already active, returns existing document.
  * If inactive, reactivates status to `"active"`.
- `get_subjects_for_teacher(db, teacher_id, academic_term, active_only)`
  * Queries subjects allocated to the instructor.
- `get_students_for_teacher_by_subject(db, teacher_id, subject_id, academic_term)`
  * Performs relational join between instructor's allocated subjects and student enrollments.
- **Preserved Legacy Methods**: `assign_teacher_to_student`, `get_students_for_teacher`, `is_student_assigned_to_teacher` remain unmodified.

---

## 5. Migration & Analysis Script Execution Results

### 5.1 Historical Prediction Migration (`scripts/migrate_prediction_subject_ids.py`)

Command:
```powershell
.venv\Scripts\python scripts/migrate_prediction_subject_ids.py
```
Output:
```
2026-11-18 07:56:34,277 [INFO] SubjectMigration: Connecting to MongoDB: mongodb://localhost:27017/edupredict (database: edupredict)
======================================================================
 EDUPREDICT — HISTORICAL PREDICTION SUBJECT_ID MIGRATION REPORT
======================================================================
 Execution Mode:            DRY RUN (READ ONLY)
 Total Predictions Scanned: 2
 Already Migrated (Valid):  0
 Matched Canonical Subject: 2
 Unmatched Subject String:  0
 Missing Subject Field:     0
 Successfully Written:      0
 Failed Writes:             0
----------------------------------------------------------------------
 [NOTE] Dry-run executed. Zero database modifications were made.
 To apply these changes, rerun with: python scripts/migrate_prediction_subject_ids.py --apply
======================================================================
```
*Verification: Verified that dry-run scanned 2 records, identified 2 matches, and performed 0 database writes.*

### 5.2 Legacy Assignment Safety Analysis (`scripts/analyze_legacy_assignments.py`)

Command:
```powershell
.venv\Scripts\python scripts/analyze_legacy_assignments.py
```
Output:
```
===========================================================================
 EDUPREDICT — LEGACY ASSIGNMENT & MULTI-SUBJECT SAFETY ANALYSIS
===========================================================================
 Total Registered Teachers:     1
 Total Registered Students:     1
 Active Legacy Assignments:     1
 Teachers with Cohort Mappings: 1
---------------------------------------------------------------------------
 INSTRUCTOR COHORT SUBJECT FOOTPRINT:
   • Dr. Sarah Foster (dr.foster@edupredict.com)
     - Assigned Students: 1
     - Evidenced Prediction Subjects: [Mathematics, Portuguese Language]
---------------------------------------------------------------------------
 INSTRUCTORS REQUIRING EXPLICIT ADMIN CONFIRMATION:
 (Instructors whose assigned students span multiple subjects or have no predictions)
   [!] Dr. Sarah Foster (dr.foster@edupredict.com) -> Reason: Multi-Subject Ambiguity
===========================================================================
 [POLICY] Existing teacher_student_assignments are preserved unmodified.
 [POLICY] Phase 6A performs NO automatic conversion to teacher-subject assignments.
 [POLICY] Explicit administrator assignment is required in Phase 6B.
===========================================================================
```

---

## 6. Test Suite Execution & Verification

### 6.1 Phase 6A Dedicated Test Suite (`tests/test_subject_models_and_services.py`)
- `test_subject_model_creation_and_normalization` — **PASSED**
- `test_subject_model_empty_validation` — **PASSED**
- `test_subject_service_create_and_unique_constraints` — **PASSED**
- `test_subject_service_lookups_and_canonical_seeding` — **PASSED**
- `test_teacher_subject_assignment_lifecycle` — **PASSED**
- `test_teacher_subject_assignment_role_and_subject_validation` — **PASSED**
- `test_student_enrollment_lifecycle` — **PASSED**
- `test_student_enrollment_role_validation` — **PASSED**
- `test_teacher_subject_student_lookups` — **PASSED**
- `test_legacy_assignments_remain_unaltered` — **PASSED**
- `test_migration_dry_run_causes_zero_writes` — **PASSED**
- `test_migration_apply_and_idempotency` — **PASSED**
- `test_schema_init_indexes_repeatable` — **PASSED**

**Result**: `13 passed in 7.27s`

### 6.2 Full Project Regression Test Suite
Command:
```powershell
.venv\Scripts\pytest -v
```
**Result**: `103 passed in 58.75s` (100% pass rate across all 103 unit and integration tests).

---

## 7. Known Limitations & Phase 6B Prerequisites

### 7.1 Scope Boundaries Strictly Enforced in Phase 6A
1. **No Authorization Changes**: `can_access_student_data` continues to evaluate access via `teacher_student_assignments`. Subject-scoped authorization has not yet been turned on.
2. **No Frontend Changes**: The teacher dashboard and student portal continue to operate using the existing APIs without subject selector filtering.
3. **No Automatic Assignment Inference**: Legacy teacher-student relationships were NOT automatically converted into subject assignments, preventing unauthorized access escalation.

### 7.2 Phase 6B Implementation Prerequisites
When Phase 6B is approved:
1. Update `backend/utils/decorators.py` to evaluate `(student_id, subject_id)` against `teacher_subject_assignments` and `student_subject_enrollments`.
2. Add subject authorization checks inside `PredictionService.create_prediction`, `list_predictions`, and `get_prediction_by_id`.
3. Expose administrative REST endpoints for managing teacher-subject assignments and student enrollments (`/api/admin/teacher-subjects`, `/api/admin/student-enrollments`).
4. Execute `python scripts/migrate_prediction_subject_ids.py --apply` to link historical predictions to canonical subjects.
5. Provide administrative UI for allocating faculty to subjects.

---

## 8. Conclusion

Phase 6A has been completed cleanly, reliably, and with 100% regression test verification. The system is fully prepared for **Phase 6B (Backend RBAC & API Enforcement)** upon project owner approval.
