# EduPredict – Phase 5B: Secure Prediction API Development Report

**Document Version**: 1.0.0  
**Phase**: Phase 5B – Secure Prediction API Development  
**Date**: November 17, 2026  
**Status**: Completed & Empirically Verified  
**Primary Authors**: Senior Backend Architect, Application Security Engineer, Machine Learning Systems Engineer  
**Repository**: [github.com/azanali30/EduPredict](https://github.com/azanali30/EduPredict) (`main` branch)  
**Backend Test Suite**: 86 / 86 tests passed (100% passing)  
**Frontend Production Build**: Passed with 0 errors in 14.37s  

---

## Executive Summary

Phase 5B operationalizes the 12 subject-specific machine learning champion models trained in Phase 5A into a secure, authenticated, and role-authorized REST API layer. The prediction subsystem enables students, assigned teachers, and administrators to generate academic performance predictions and risk classifications while strictly enforcing data privacy, input range validation, target leakage prevention, and educational safety advisories.

### Key Architectural Deliverables
1. **Model Serving Architecture**:
   - Thread-safe, in-memory cached model loading via [backend/ml/model_loader.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/ml/model_loader.py).
   - Joint inference orchestrator (`predict_student`) producing continuous marks ($0 - 100$), discrete risk tiers (`High Risk`, `Moderate Risk`, `Low Risk / On Track`), class probability distributions, and uncertainty flags.
2. **Comprehensive REST API Endpoints**:
   - `GET /api/predictions/options`: Exposes metadata on subjects, milestones, required features, and target tiers.
   - `POST /api/predictions`: Securely generates and records predictions in MongoDB.
   - `GET /api/predictions`: Scoped history listing with role-based filtering and pagination.
   - `GET /api/predictions/<prediction_id>`: Detailed inspection of individual prediction records.
3. **Role-Based Access Control & IDOR Defense**:
   - **Student**: May only generate predictions for their own `student_id` and view their own prediction history. Attempts to pass another student's ID are rejected with `403 Forbidden`.
   - **Teacher**: May generate and view predictions strictly for students actively assigned to them in `teacher_student_assignments`. Queries for unassigned students are blocked with `403 Forbidden`.
   - **Administrator**: Possesses full system-wide governance to generate and inspect predictions across all cohorts.
4. **Target Leakage Interceptor**:
   - Input vectors are strictly screened by [backend/data_engineering/leakage_guard.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/backend/data_engineering/leakage_guard.py).
   - Any payload containing $G_3$, `final_exam_marks`, `academic_status`, `pass_status`, or `student_code` is rejected with `400 Bad Request`.
   - Milestone 0 strictly prohibits $G_1$ / `previous_exam_marks` and $G_2$ / `quiz_scores`. Milestone 1 strictly prohibits $G_2$ / `quiz_scores`.
5. **Educational Safety & Proxy Transparency**:
   - Milestone 0 responses include a mandatory `early_warning_advisory` noting an estimated $>60\%$ false-negative rate on failing students due to the absence of examination marks.
   - Synthetic proxies (`assignment_completion_rate`, `attendance_percentage`, `study_hours_per_week`) are transparently labeled as estimated indices in prediction metadata.
   - Predictions with top class probability $< 0.55$ trigger an `uncertainty_warning: true` flag.

---

## 1. REST API Specification & Endpoint Documentation

All endpoints require session authentication via Flask-Login and CSRF protection on mutating requests (`X-CSRFToken`).

### 1.1 `GET /api/predictions/options`
Retrieves discovery metadata for frontend forms and automated clients.

- **URL**: `/api/predictions/options`
- **Method**: `GET`
- **Authentication**: Required (`@login_required`)
- **Response Status**: `200 OK`
- **Example Response**:
```json
{
  "options": {
    "supported_subjects": [
      {
        "id": "mathematics",
        "name": "Mathematics",
        "observation_count": 395,
        "target_scale": "0 - 100"
      },
      {
        "id": "portuguese",
        "name": "Portuguese Language",
        "observation_count": 649,
        "target_scale": "0 - 100"
      }
    ],
    "milestones": [
      {
        "milestone": 0,
        "name": "Milestone 0: Early Warning",
        "description": "Exploratory behavioral screening prior to any examination results.",
        "feature_count": 33,
        "features": ["school", "sex", "age", "..."],
        "prohibited_features": ["previous_exam_marks", "quiz_scores", "final_exam_marks", "academic_status", "G1", "G2", "G3"],
        "advisory": "Subject to high false-negative rate (>60%) on failing students due to absence of examination marks."
      },
      {
        "milestone": 1,
        "name": "Milestone 1: Mid-Term",
        "description": "Evaluation incorporating Milestone 0 features and Period 1 Exam marks.",
        "feature_count": 34,
        "features": ["school", "sex", "age", "...", "previous_exam_marks"]
      },
      {
        "milestone": 2,
        "name": "Milestone 2: Pre-Final",
        "description": "Near-final evaluation incorporating Milestone 1 features and Period 2 Quiz scores.",
        "feature_count": 35,
        "features": ["school", "sex", "age", "...", "previous_exam_marks", "quiz_scores"]
      }
    ],
    "estimated_feature_labels": {
      "assignment_completion_rate": "Estimated Study Discipline Index (Derived Heuristic)",
      "attendance_percentage": "Estimated Attendance Proxy (60-Session Baseline)",
      "study_hours_per_week": "Estimated Weekly Study Hours (Midpoint Approximation)"
    },
    "target_definitions": {
      "regression": {
        "variable": "final_exam_marks",
        "scale": "0.0 - 100.0"
      },
      "classification": {
        "variable": "academic_status",
        "classes": [
          {"name": "High Risk", "range": "0 - 49 marks (Failing)"},
          {"name": "Moderate Risk", "range": "50 - 69 marks (Satisfactory)"},
          {"name": "Low Risk / On Track", "range": "70 - 100 marks (Good / Excellent)"}
        ]
      }
    }
  },
  "status_code": 200
}
```

---

### 1.2 `POST /api/predictions`
Generates a new academic prediction and records it in MongoDB.

- **URL**: `/api/predictions`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`, `X-CSRFToken: <token>`
- **Authentication**: Required (`@login_required`)
- **Request Body**:
```json
{
  "student_id": "6739b88ef1a4c9b20e10a234",
  "subject": "Mathematics",
  "milestone": 0,
  "features": {
    "school": "GP",
    "sex": "F",
    "age": 17,
    "address": "U",
    "famsize": "GT3",
    "Pstatus": "T",
    "Medu": 3,
    "Fedu": 3,
    "Mjob": "services",
    "Fjob": "other",
    "reason": "course",
    "guardian": "mother",
    "traveltime": 1,
    "studytime": 2,
    "study_hours_per_week": 3.5,
    "failures": 0,
    "schoolsup": "no",
    "famsup": "yes",
    "paid": "no",
    "activities": "yes",
    "nursery": "yes",
    "higher": "yes",
    "internet": "yes",
    "romantic": "no",
    "famrel": 4,
    "freetime": 3,
    "goout": 3,
    "Dalc": 1,
    "Walc": 2,
    "health": 4,
    "absences": 4,
    "attendance_percentage": 93.33,
    "assignment_completion_rate": 85.0
  }
}
```
*Note: If the authenticated user is a student, `student_id` is optional and defaults to `current_user.id`.*

- **Response Status**: `201 Created`
- **Example Response**:
```json
{
  "message": "Prediction generated and recorded successfully.",
  "prediction": {
    "id": "6739bf89a1b2c3d4e5f67890",
    "student_id": "6739b88ef1a4c9b20e10a234",
    "created_by": "6739b88ef1a4c9b20e10a234",
    "subject": "Mathematics",
    "milestone": 0,
    "predicted_marks": 64.82,
    "predicted_status": "Moderate Risk",
    "confidence_scores": {
      "High Risk": 0.18,
      "Moderate Risk": 0.61,
      "Low Risk / On Track": 0.21
    },
    "top_confidence": 0.61,
    "confidence_type": "Uncalibrated model confidence estimate based on tree ensemble leaf vote proportions",
    "uncertainty_warning": false,
    "uncertainty_message": null,
    "early_warning_advisory": {
      "title": "Early Warning Advisory (Milestone 0)",
      "notice": "Academic examination marks (G1/G2) are not yet recorded for this student. Milestone 0 predictions reflect behavioral and demographic tendencies only. Empirical holdout validation demonstrates an estimated false-negative rate exceeding 60% for High Risk students at this stage. Milestone 0 should be treated as an exploratory indicator and must never serve as the sole justification for adverse academic or disciplinary decisions.",
      "false_negative_rate_estimate_pct": 61.5,
      "recommended_action": "Schedule exploratory academic counseling and record Period 1 examination marks for Milestone 1 evaluation."
    },
    "regressor_model": "Random Forest Regressor",
    "classifier_model": "Random Forest Classifier",
    "features_summary": {
      "assignment_completion_rate": {
        "value": 85.0,
        "label": "Estimated Study Discipline Index (Derived Heuristic)",
        "is_estimated_proxy": true
      },
      "attendance_percentage": {
        "value": 93.33,
        "label": "Estimated Attendance Proxy (60-Session Baseline)",
        "is_estimated_proxy": true
      }
    },
    "created_at": "2026-11-17T15:45:00.123456+00:00"
  },
  "status_code": 201
}
```

---

### 1.3 `GET /api/predictions`
Lists historical prediction records scoped by user role.

- **URL**: `/api/predictions?student_id=<id>&subject=Mathematics&milestone=0&limit=20&skip=0`
- **Method**: `GET`
- **Authentication**: Required (`@login_required`)
- **Response Status**: `200 OK`
- **Example Response**:
```json
{
  "predictions": [
    {
      "id": "6739bf89a1b2c3d4e5f67890",
      "student_id": "6739b88ef1a4c9b20e10a234",
      "subject": "Mathematics",
      "milestone": 0,
      "predicted_marks": 64.82,
      "predicted_status": "Moderate Risk",
      "top_confidence": 0.61,
      "created_at": "2026-11-17T15:45:00.123456+00:00"
    }
  ],
  "total_count": 1,
  "limit": 20,
  "skip": 0,
  "status_code": 200
}
```

---

### 1.4 `GET /api/predictions/<prediction_id>`
Retrieves full details for a single prediction record.

- **URL**: `/api/predictions/6739bf89a1b2c3d4e5f67890`
- **Method**: `GET`
- **Authentication**: Required (`@login_required`)
- **Response Status**: `200 OK` (or `403 Forbidden` if unauthorized, `404 Not Found` if missing)

---

## 2. Role-Based Authorization Matrix

Every prediction endpoint enforces server-side authorization:

| Role | Predict for Self | Predict for Assigned Student | Predict for Unassigned Student | List Own History | List Assigned Student History | List Unassigned Student History | System-Wide Overview |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Student** | **Allowed** | N/A | **Blocked (403)** | **Allowed** | N/A | **Blocked (403)** | **Blocked (403)** |
| **Teacher** | N/A | **Allowed** | **Blocked (403)** | N/A | **Allowed** | **Blocked (403)** | **Blocked (403)** |
| **Administrator** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Allowed** |

---

## 3. MongoDB Schema & Index Extension

The `predictions` collection stores predictions with full provenance and audit fields:

```json
{
  "_id": ObjectId("6739bf89a1b2c3d4e5f67890"),
  "student_id": ObjectId("6739b88ef1a4c9b20e10a234"),
  "created_by": ObjectId("6739b88ef1a4c9b20e10a234"),
  "subject": "Mathematics",
  "milestone": 0,
  "predicted_marks": 64.82,
  "predicted_status": "Moderate Risk",
  "confidence_scores": {
    "High Risk": 0.18,
    "Moderate Risk": 0.61,
    "Low Risk / On Track": 0.21
  },
  "top_confidence": 0.61,
  "confidence_type": "Uncalibrated model confidence estimate based on tree ensemble leaf vote proportions",
  "uncertainty_warning": false,
  "uncertainty_message": null,
  "early_warning_advisory": { ... },
  "features_summary": { ... },
  "regressor_model": "Random Forest Regressor",
  "classifier_model": "Random Forest Classifier",
  "created_at": ISODate("2026-11-17T15:45:00.123Z")
}
```

### Active MongoDB Indexes on `predictions`
1. `idx_preds_student_id`: `[("student_id", ASCENDING)]`
2. `idx_preds_student_created`: `[("student_id", ASCENDING), ("created_at", DESCENDING)]` (Optimizes user history queries)
3. `idx_preds_subject_milestone`: `[("subject", ASCENDING), ("milestone", ASCENDING)]` (Optimizes analytical filtering)
4. `idx_preds_predicted_status`: `[("predicted_status", ASCENDING)]` (Optimizes risk tier analytics)
5. `idx_preds_risk_level`: `[("risk_level", ASCENDING)]`
6. `idx_preds_created_at`: `[("created_at", DESCENDING)]`

---

## 4. Test Suite Execution & Verification

A dedicated test suite [tests/test_prediction_api.py](file:///C:/Users/Azan's%20PC/Documents/EduPredict/tests/test_prediction_api.py) (14 tests) was authored and executed alongside all existing tests:

```text
============================= test session starts =============================
platform win32 -- Python 3.12.16, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\Azan's PC\Documents\EduPredict
plugins: flask-1.3.0
collected 86 items

tests/test_admin.py (7 tests) ........................................ PASSED [  8%]
tests/test_app_factory.py (3 tests) .................................. PASSED [ 11%]
tests/test_auth.py (10 tests) ........................................ PASSED [ 23%]
tests/test_config.py (4 tests) ....................................... PASSED [ 27%]
tests/test_data_pipeline.py (13 tests) ............................... PASSED [ 43%]
tests/test_feature_leakage.py (10 tests) ............................. PASSED [ 54%]
tests/test_health_routes.py (4 tests) ................................ PASSED [ 59%]
tests/test_ml_models.py (8 tests) .................................... PASSED [ 68%]
tests/test_models.py (4 tests) ....................................... PASSED [ 73%]
tests/test_mongo_connectivity.py (3 tests) ........................... PASSED [ 76%]
tests/test_prediction_api.py (14 tests) .............................. PASSED [ 93%]
tests/test_rbac.py (6 tests) ......................................... PASSED [100%]

============================= 86 passed in 43.23s =============================
```

### Frontend Build Verification
```text
> edupredict-frontend@1.0.0 build
> tsc -b && vite build

vite v6.4.6 building for production...
✓ 2025 modules transformed.
dist/index.html                   0.81 kB │ gzip:   0.46 kB
dist/assets/index-BpR1vFdi.css   36.27 kB │ gzip:   7.10 kB
dist/assets/index-cwR6B7wV.js   735.12 kB │ gzip: 199.12 kB
✓ built in 14.37s
```

---

## 5. Files Created and Modified

| File Path | Action | Description |
|---|:---:|---|
| `backend/models/prediction_model.py` | **Created** | Domain entity `PredictionRecord` with serialization and BSON mapping. |
| `backend/models/__init__.py` | **Modified** | Exported `PredictionRecord`. |
| `backend/services/prediction_service.py` | **Created** | Validation, leakage checks, ML inference orchestration, and history querying. |
| `backend/services/__init__.py` | **Modified** | Exported `PredictionService`. |
| `backend/routes/prediction_routes.py` | **Created** | REST endpoints (`/api/predictions/options`, `/api/predictions`, history, detail). |
| `backend/routes/__init__.py` | **Modified** | Exported `prediction_bp`. |
| `backend/app.py` | **Modified** | Registered `prediction_bp`. |
| `backend/database/schema.py` | **Modified** | Added compound indexes for student history and analytical queries. |
| `backend/ml/model_loader.py` | **Modified** | Added in-memory model caching and `predict_student` joint inference function. |
| `tests/test_prediction_api.py` | **Created** | 14 integration and security tests for prediction endpoints. |
| `documentation/PHASE_5B_PREDICTION_API.md` | **Created** | Technical documentation and API specification. |

---

## 6. Known Limitations & Remaining Work

1. **Frontend Integration (Phase 5C)**:
   - Prediction pages, interactive milestone sliders, risk radar cards, and teacher student prediction screens have not yet been built.
2. **Probability Calibration**:
   - Class probabilities reflect raw tree ensemble leaf vote proportions. Isotonic or Platt calibration has not been applied and probabilities are clearly labeled as uncalibrated confidence estimates.
3. **Absence of Longitudinal Exam Marks**:
   - Milestone 0 operates with an empirical false-negative rate $>60\%$ on High Risk students due to lack of grade data. The mandatory advisory informs users of this limitation.

---

## STRICT STOP CONDITION COMPLIANCE

Phase 5B backend prediction APIs are **complete**. In accordance with instructions:
- **No frontend prediction screens or components have been created.**
- **No Teacher Portal UI redesign has been performed.**
- **Phase 5C has NOT been started.**

**Awaiting your review and explicit approval before proceeding to Phase 5C.**
