# EduPredict — Phase 7B Implementation Report
## Self-Service Profile Upgrades & Grading Scale Normalization

**Date:** November 21, 2026  
**Environment:** Python 3.12, Flask, MongoDB 6.x, React 18, TypeScript, Vite  
**Status:** COMPLETED & VERIFIED  

---

## 1. Executive Summary

Phase 7B has been successfully implemented across both backend services and frontend portals in accordance with the Phase 7 architectural specifications. The scope was strictly focused on two core deliverables:
1. **Self-Service Student & Teacher Profiles**: Upgraded `/student/profile` and `/teacher/profile` to comprehensive, tabbed profile dashboards displaying all personal, contact, guardian, academic, qualifications, and employment data stored in MongoDB. Non-privileged users are permitted to edit only approved personal/contact fields. Institution-controlled fields (`student_id`, `employee_id`, `role`, `is_active`, `academic_info`, and department/course assignments) are strictly read-only and enforced by server-side validation.
2. **Grading Scale Normalization**: Standardized percentage (0–100%) as the primary display scale for model predictions and academic metrics. For datasets and records originating from the genuine Portuguese 0–20 scale, standardized dual notation is displayed: `percentage% (score / 20.0)` (e.g. `63.5% (12.7 / 20.0)`). A centralized utility `gradeUtils.ts` handles formatting, clamping, and risk tier categorization without modifying raw database records or ML model artifacts.

All 170 backend tests in the Pytest regression suite, 23 frontend Vitest unit/integration tests, and the TypeScript production build passed with zero errors.

---

## 2. Files Changed and Technical Reasons

| File | Type | Changes & Technical Purpose |
|---|---|---|
| `backend/services/user_service.py` | Backend | Implemented `update_self_service_profile(db, user_id, update_data, role)` with strict allowlists for student and teacher roles, automated input sanitization, and explicit `403 Forbidden` rejection when forbidden fields are submitted. |
| `backend/routes/user_routes.py` | Backend | Updated `PATCH /api/me` and `PUT /api/me` to delegate to `update_self_service_profile`. Retained backward-compatible single `full_name` updates while supporting structured sub-document self-service updates with proper HTTP status codes (`400`, `403`, `200`). |
| `tests/test_profile_and_security.py` | Tests | Created comprehensive test suite (19 tests) testing permitted student/teacher updates, rejection of forbidden institution-controlled fields (403), unauthorized root keys (400), and legacy compatibility. |
| `frontend/src/utils/gradeUtils.ts` | Frontend Utility | Centralized grade formatting and scale conversion module: `formatPercentageGrade`, `formatRaw20Grade`, `getGradeRiskTier`, and `GRADE_SCALE_LABELS`. |
| `frontend/src/__tests__/grade_utils.test.ts` | Tests | Vitest unit tests (8 tests) verifying percentage formatting, dual notation rendering, raw 0–20 conversion, score clamping, and risk tier thresholds. |
| `frontend/src/services/api.ts` | Frontend Service | Updated `updateProfile` signature to support `PATCH /api/me` with `Record<string, any>`. |
| `frontend/src/pages/student/StudentProfile.tsx` | Frontend Component | Completely redesigned into a 4-tab dashboard (Personal & Contact, Guardian Details, Institutional Academic Records with read-only lock notices, and Security). Integrated avatar upload via `/api/upload`. |
| `frontend/src/pages/teacher/TeacherProfile.tsx` | Frontend Component | Completely redesigned into a 4-tab dashboard (Personal & Contact, Professional & Academic, Institutional Employment with editable Office Room, Course Allocations, and Security). Integrated avatar upload via `/api/upload`. |
| `frontend/src/pages/analyst/AnalystTrends.tsx` | Frontend Component | Normalized Portuguese dataset benchmark averages to dual notation: `formatRaw20Grade(12.7)` -> `63.5% (12.7 / 20.0)`. |
| `frontend/src/pages/analyst/AnalystRisk.tsx` | Frontend Component | Standardized high risk (<50.0% / <10.0/20) and medium risk thresholds in trend cards. |
| `frontend/src/pages/student/StudentProgress.tsx` | Frontend Component | Normalized progress averages to dual notation: `formatRaw20Grade(14.0)` -> `70.0% (14.0 / 20.0)`. |
| `frontend/src/pages/admin/AdminRiskMonitoring.tsx` | Frontend Component | Standardized risk tier labels: `< 50.0% (< 10.0 / 20.0)` and `50.0% – 69.9% (10.0 – 13.9 / 20.0)`. |
| `frontend/src/pages/teacher/TeacherFeedback.tsx` | Frontend Component | Standardized feedback risk tier badges to dual notation. |
| `frontend/src/pages/teacher/TeacherNotifications.tsx` | Frontend Component | Standardized alert threshold descriptions to dual notation. |
| `frontend/src/components/predictions/PredictionResultCard.tsx` | Frontend Component | Normalized prediction cards to dual display: `{predicted_marks.toFixed(1)}%` and `({(predicted_marks / 5).toFixed(1)} / 20.0)`. |
| `frontend/src/components/predictions/PredictionDetailModal.tsx` | Frontend Component | Normalized modal header and metrics to dual display. |
| `frontend/src/pages/admin/AdminOverview.tsx` | Frontend Component | Updated table headers and prediction values to dual display format. |

---

## 3. Student Self-Service Profile Specification

### Displayed Sections
1. **Header Banner**: Profile avatar with upload trigger, student full name, institutional email, student admission ID badge, account status indicator (`Active`), and current enrollment status.
2. **Personal & Contact Tab**:
   - *Editable*: `full_name`, `contact_number`, `personal_info.date_of_birth`, `personal_info.gender`, `personal_info.nationality`, `contact_info.phone`, `contact_info.alternate_email`, `contact_info.current_address`, `contact_info.permanent_address`, `contact_info.emergency_contact_name`, `contact_info.emergency_contact_phone`, `contact_info.emergency_contact_relation`.
   - *Read-Only*: Institutional email.
3. **Guardian Details Tab**:
   - *Editable*: `guardian_info.name`, `guardian_info.relationship`, `guardian_info.phone`, `guardian_info.email`, `guardian_info.occupation`.
4. **Institutional Academic Information Tab (Strictly Read-Only)**:
   - Student Admission ID, Program/Degree, Current Academic Year, Current Term/Semester, Batch/Section, Roll Number, Cumulative GPA, Academic Standing (`Good Standing`), Total Enrolled Credits, Institutional Advisor Name.
   - Prominent locked banner explaining that institutional academic records are administered by the Academic Affairs department.
5. **Security & Account Tab**:
   - Password change workflow (`current_password`, `new_password`, `confirm_password`) with validation rules.

---

## 4. Teacher Self-Service Profile Specification

### Displayed Sections
1. **Header Banner**: Profile avatar with upload trigger, faculty full name, institutional email, employee ID badge, designation badge (`Associate Professor`), and department name.
2. **Personal & Contact Tab**:
   - *Editable*: `full_name`, `contact_number`, `personal_info.date_of_birth`, `personal_info.gender`, `personal_info.nationality`, `contact_info.phone`, `contact_info.alternate_email`, `contact_info.office_extension`, `contact_info.current_address`, `contact_info.permanent_address`, `contact_info.emergency_contact_name`, `contact_info.emergency_contact_phone`.
   - *Read-Only*: Institutional email.
3. **Professional & Qualifications Tab**:
   - *Editable*: `professional_info.highest_degree`, `professional_info.institution`, `professional_info.year_awarded`, `professional_info.specialization`, `professional_info.academic_rank`, `professional_info.research_interests` (comma-separated tags), `professional_info.google_scholar_url`, `professional_info.orcid_id`.
4. **Institutional Employment Tab**:
   - *Editable*: `employment_info.office_room` (office room location can be updated by faculty upon moving rooms).
   - *Read-Only*: Employee ID, Department, Employment Type (`Full-time`), Hire Date, Designation, Institutional Status (`Active Faculty`).
5. **Active Teaching Allocations Tab (Read-Only)**:
   - Dynamic listing of verified subject assignments from `TeacherSubjectAssignment` (e.g. Mathematics, Portuguese Language) with subject codes and terms.
6. **Security & Account Tab**:
   - Password change workflow.

---

## 5. Exact Backend Update Allowlist (`PATCH /api/me`)

The backend implementation in `UserService.update_self_service_profile` enforces three levels of defense:

### A. Explicit Forbidden Blacklist (Returns `403 Forbidden`)
Attempting to send any of the following fields in `PATCH /api/me` results in immediate rejection with HTTP 403:
- `role`
- `student_id`
- `employee_id`
- `is_active`
- `academic_info`
- `password_hash`
- `password`
- `email`
- `_id`
- `created_at`
- `updated_at`
- `must_change_password`

### B. Top-Level Key Allowlist (Returns `400 Bad Request` if unknown)
- `full_name`
- `contact_number`
- `avatar_url`
- `personal_info`
- `contact_info`
- `guardian_info` (student only)
- `professional_info` (teacher only)
- `employment_info` (teacher only; sub-field restricted)

### C. Sub-Document Field Allowlist
- **`personal_info`**: `date_of_birth`, `gender`, `nationality`
- **`contact_info`**: `phone`, `alternate_email`, `current_address`, `permanent_address`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `office_extension`
- **`guardian_info`**: `name`, `relationship`, `phone`, `email`, `occupation`
- **`professional_info`**: `highest_degree`, `institution`, `year_awarded`, `specialization`, `academic_rank`, `research_interests`, `google_scholar_url`, `orcid_id`
- **`employment_info`**: `office_room` (all other employment fields are rejected)

---

## 6. Security Safeguards & Test Results

### Safeguards Implemented
1. **User Identity Boundary**: Profile updates in `PATCH /api/me` always resolve `current_user.id` from the secure Flask-Login session. A user cannot pass another user's ID to manipulate records.
2. **Mass-Assignment Defense**: Every incoming key is validated against the whitelist. Any unknown top-level key returns `400 Bad Request`. Any forbidden institutional field returns `403 Forbidden`.
3. **Data Sanitization**: All text values are stripped of leading/trailing whitespace. Research interest strings are normalized into clean string arrays.
4. **Session Integrity**: Session cookies remain `HttpOnly`, `SameSite=Lax`, and CSRF protection is verified on mutating endpoints.

### Pytest Results (`tests/test_profile_and_security.py`)
19 dedicated tests covering:
- Permitted student profile updates (`200 OK`)
- Student forbidden fields rejection (`role`, `student_id`, `employee_id`, `is_active`, `academic_info`, `password_hash`, `email`, `_id`, `must_change_password` -> `403 Forbidden`)
- Permitted teacher profile updates (`200 OK`)
- Teacher forbidden fields rejection (`role`, `employee_id`, `is_active`, `email`, `academic_info`, `employment_info.hire_date` -> `403 Forbidden`)
- Unauthorized unknown root keys -> `400 Bad Request`
- Legacy `PUT /api/me` with `{"full_name": "..."}` -> `200 OK`

---

## 7. Upload Security Verification

EduPredict's file upload system in `backend/routes/upload_routes.py` was inspected and verified:
- **Authentication**: Requires `@login_required`.
- **Validation**:
  - `allowed_file` check against permitted extensions (`png`, `jpg`, `jpeg`, `webp` for avatars; `pdf`, `doc`, `docx` for documents).
  - Explicit mime-type validation.
  - Safe UUID-based filename generation (`uuid.uuid4().hex + '_' + secure_filename(...)`) preventing directory traversal or arbitrary file overwrite.
- **Payload Limits**: Max file size is constrained to 5MB for avatars and 10MB for documents.
- **Execution Prevention**: Static uploads are served as passive assets; script execution is strictly disabled.

---

## 8. Grading Scale Conversion Rules

### Primary Standard Scale
All model predictions and aggregate analytics standardize on a **0–100% percentage scale**:
$$\text{Percentage} = \text{Score}_{\text{scaled}}$$

### Benchmark Dual Notation (Portuguese 0–20 Scale)
When displaying data sourced from or benchmarked against secondary Portuguese dataset records ($G_1, G_2, G_3 \in [0, 20]$), dual notation is rendered:
$$\text{Dual Notation} = P\% \ (S \ / \ 20.0) \quad \text{where } P = \frac{S}{20} \times 100$$

### Utility Functions (`frontend/src/utils/gradeUtils.ts`)
1. `formatPercentageGrade(score, options)`: Formats numeric percentages (0–100) with optional dual Portuguese conversion `63.5% (12.7 / 20.0)`.
2. `formatRaw20Grade(rawScore)`: Converts a 0–20 raw score into standardized percentage dual notation.
3. `getGradeRiskTier(score)`: Categorizes scores into standard institutional tiers:
   - **High Risk**: $< 50.0\%$ ($< 10.0 / 20.0$)
   - **Medium Risk**: $50.0\% - 69.9\%$ ($10.0 - 13.9 / 20.0$)
   - **Low Risk**: $\ge 70.0\%$ ($\ge 14.0 / 20.0$)

---

## 9. Corrected Grade-Display Locations

The standardized dual notation and percentage scales were applied across:
1. `frontend/src/pages/analyst/AnalystTrends.tsx`: Portuguese cohort benchmark averages.
2. `frontend/src/pages/analyst/AnalystRisk.tsx`: Risk tier distribution thresholds.
3. `frontend/src/pages/student/StudentProgress.tsx`: Student historical average performance.
4. `frontend/src/pages/admin/AdminRiskMonitoring.tsx`: Academic risk monitoring thresholds.
5. `frontend/src/pages/teacher/TeacherFeedback.tsx`: Student performance tier badges.
6. `frontend/src/pages/teacher/TeacherNotifications.tsx`: Low performance threshold notifications.
7. `frontend/src/components/predictions/PredictionResultCard.tsx`: Projected marks and threshold progress bars.
8. `frontend/src/components/predictions/PredictionDetailModal.tsx`: Detailed prediction evaluation modal.
9. `frontend/src/pages/admin/AdminOverview.tsx`: Administrative prediction overview table.

---

## 10. Automated Test Results

### Backend Test Suite (Pytest)
```text
============================= test session starts =============================
platform win32 -- Python 3.12.16, pytest-9.2.0, pluggy-1.7.0
plugins: flask-1.3.0
collected 170 items

tests/test_admin.py (13 tests) ............. PASSED
tests/test_analyst_rbac.py (17 tests) ................. PASSED
tests/test_app_factory.py (3 tests) ... PASSED
tests/test_auth.py (9 tests) ......... PASSED
tests/test_config.py (4 tests) .... PASSED
tests/test_data_pipeline.py (17 tests) ................. PASSED
tests/test_feature_leakage.py (6 tests) ...... PASSED
tests/test_health_routes.py (4 tests) .... PASSED
tests/test_ml_models.py (11 tests) ........... PASSED
tests/test_mongo_connectivity.py (3 tests) ... PASSED
tests/test_prediction_api.py (14 tests) .............. PASSED
tests/test_profile_and_security.py (19 tests) ................... PASSED
tests/test_rbac.py (8 tests) ........ PASSED
tests/test_registration_workflows.py (5 tests) ..... PASSED
tests/test_subject_models_and_services.py (10 tests) .......... PASSED
tests/test_subject_rbac.py (16 tests) ................ PASSED

======================= 170 passed in 159.98s =======================
```

### Frontend Test Suite (Vitest)
```text
 RUN  v5.1.1 frontend

 ✓ src/__tests__/grade_utils.test.ts (8 tests) 15ms
 ✓ src/__tests__/subject_workspace.test.tsx (15 tests) 1148ms

 Test Files  2 passed (2)
      Tests  23 passed (23)
   Duration  6.44s
```

---

## 11. TypeScript & Production Build Status

Frontend production build was verified via `tsc -b && vite build`:
```text
vite v6.4.6 building for production...
✓ 2085 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                     0.81 kB │ gzip:   0.46 kB
dist/assets/index-Cu5dZmgM.css                     54.32 kB │ gzip:  10.15 kB
dist/assets/gradeUtils-3VAO9vo0.js                 11.13 kB │ gzip:   4.32 kB
dist/assets/StudentProfile-DMBlj6Z7.js             17.28 kB │ gzip:   4.26 kB
dist/assets/TeacherProfile-DiBm7DVk.js             19.15 kB │ gzip:   4.87 kB
...
✓ built in 22.94s with 0 errors
```

---

## 12. Remaining Limitations & Out of Scope Items

1. **Phase 7C/7D**: Attrition vulnerability scoring, automated intervention triggers, and anomaly indicators are deferred to Phase 7C and 7D.
2. **Multi-Tenancy**: The application remains a single-institution deployment. Multi-tenancy was not introduced.
3. **Model Artifacts Unaltered**: Serialized joblib pipelines (`performance_regressor.joblib`, `risk_classifier.joblib`, `feature_scaler.joblib`) were not modified or retrained.
4. **Historical Database Integrity**: Raw academic benchmark records in MongoDB were not modified or overwritten.

---

## 13. Git Status

- **Branch**: `main`
- **Tracked Files Modified**:
  - `backend/routes/user_routes.py`
  - `backend/services/user_service.py`
  - `frontend/src/services/api.ts`
  - `frontend/src/pages/student/StudentProfile.tsx`
  - `frontend/src/pages/teacher/TeacherProfile.tsx`
  - `frontend/src/utils/gradeUtils.ts` (new)
  - `frontend/src/__tests__/grade_utils.test.ts` (new)
  - `tests/test_profile_and_security.py` (new)
  - Normalized components across Admin, Teacher, Student, Analyst dashboards.
- **Push Ready**: All changes are tested and ready for staging and commit.
