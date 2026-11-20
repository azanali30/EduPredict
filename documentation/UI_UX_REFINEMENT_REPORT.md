# EduPredict — UI/UX Quality & Layout Refinement Report

**Project**: EduPredict (Aptech eProject Big Data / Academic Analytics)  
**Date**: November 2026  
**Status**: Completed & Verified  

---

## 1. Executive Summary

This report documents the systematic UI/UX quality, layout refinement, and data presentation reconciliation performed across all four role-based workspaces in EduPredict (**Administrator**, **Teacher**, **Student**, and **Analyst**). 

The primary goals of this refinement were:
1. **Data Presentation Accuracy & Scale Reconciliation**: Identify and fix misleading grade representations (e.g. `62.3 / 20.0`), verify the canonical scale against model metadata and backend configuration, and standardize all displays to the authoritative `0 – 100` academic scale without modifying underlying ML model weights.
2. **Table Design & Layout Consistency**: Standardize data table headers, typography, column widths, action buttons, alignment, responsive horizontal scroll wrapping (`overflow-x-auto`), and visual styling.
3. **Form & Detail View Refinement**: Polish input fields, modal dialogs, status badges, and action buttons to align strictly with EduPredict brand design system specifications.

---

## 2. Root Cause Analysis: Academic Grading Scale Reconciliation

### 2.1 The Issue
Several newly implemented dashboard pages were displaying predictions formatted as `62.3 / 20.0` or calculating thresholds based on a raw 0–20 scale, while other pages displayed scores on a 0–100 scale.

### 2.2 Investigation Findings
- **Data Preprocessing (`clean_dataset.py`)**: During data ingestion and cleaning, the raw Portuguese secondary school grades (G1, G2, G3 on a 0–20 scale) are normalized to a standard academic percentage scale:
  $$\text{target} = \frac{G3}{20} \times 100$$
- **Model Training & Artifacts (`model_loader.py`)**: Both the Mathematics and Portuguese Ridge/RandomForest regressors were trained with continuous target marks in the range $[0.0, 100.0]$.
- **Canonical Subject Configuration (`backend/services/subject_service.py`)**:
  ```python
  CANONICAL_SUBJECTS = [
      {
          "name": "Mathematics",
          "code": "MATH-01",
          "target_scale": "0 - 100",
          ...
      },
      {
          "name": "Portuguese",
          "code": "LANG-01",
          "target_scale": "0 - 100",
          ...
      }
  ]
  ```
- **Inference Pipeline**: Regressor inference yields predictions such as `62.3` (representing 62.3%). Displaying `/ 20.0` was a superficial UI formatting error caused by assuming the raw UCI scale rather than the trained model's percentage scale.

### 2.3 Resolutions Applied
All occurrences of `/ 20.0` and references to `0 – 20` were systematically replaced with `/ 100` and percentage notations across:
- `AdminAcademicRecords.tsx`: Formatted predicted grades to `{pred.predicted_marks.toFixed(1)} / 100`.
- `AdminPredictions.tsx`: Standardized score badges to `{pred.predicted_marks.toFixed(1)} / 100`.
- `AdminReports.tsx`: Refined evaluation summaries to `{p.predicted_marks.toFixed(1)} / 100`.
- `AdminRiskMonitoring.tsx`: Displayed projected marks on `/ 100` scale.
- `AdminAnalytics.tsx`: Fixed subject average grade calculations and adjusted Recharts `YAxis domain={[0, 100]}`.
- `TeacherAcademicRecords.tsx`: Fixed predicted marks display and risk classification.
- `TeacherAnomalies.tsx`: Corrected predicted grade to `/ 100` and calibrated discrepancy thresholds to the 0–100 scale (`< 55`, `< 50`, `< 45`).
- `TeacherAtRisk.tsx`: Standardized projected mark to `{pred.predicted_marks.toFixed(1)} / 100` and adjusted passing benchmark copy to `50+/100`.
- `StudentPerformance.tsx`: Updated average score calculation, passing benchmark (`50.0%`), and Recharts `YAxis domain={[0, 100]}`.
- `StudentProgress.tsx`: Updated target goal to `70.0%`, passing cutoff to `50.0%`, and YAxis domain to `[0, 100]`.
- `StudentRecommendations.tsx`: Formatted grade benchmarks to `{grade.toFixed(1)}% ({grade.toFixed(1)} / 100)`.
- `TeacherSubjects.tsx` & `StudentSubjects.tsx`: Standardized target scale text badge to `0 – 100 (Standard Academic Scale)`.

---

## 3. Table Design & Layout Standardization

### 3.1 Global CSS Typography & Utilities (`frontend/src/styles/global.css`)
Added clean, enterprise-grade table utilities matching EduPredict brand guidelines:
```css
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
}
.table th {
  padding: 0.75rem 1rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-slate-500);
  background-color: var(--color-slate-50);
  border-bottom: 1px solid var(--color-slate-200);
  white-space: nowrap;
}
.table td {
  padding: 0.875rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-slate-700);
  border-bottom: 1px solid var(--color-slate-100);
  vertical-align: middle;
}
.table tbody tr:hover {
  background-color: #f8fafc;
}
```

### 3.2 Responsive Table Enclosures
Wrapped all table instances with `<div className="overflow-x-auto">` across:
- `AdminStudents.tsx`
- `AdminTeachers.tsx`
- `AdminAcademicRecords.tsx`
- `AdminEnrollments.tsx`
- `UserManagement.tsx`
- `TeacherAcademicRecords.tsx`
- `TeacherStudents.tsx`
- `StudentRecords.tsx`

This guarantees smooth horizontal scrolling on mobile, tablet, and narrow desktop viewports without clipping action buttons or badges.

### 3.3 Action Button Standardization
- Standardized action buttons with clean SVG icon wrappers and concise microcopy (e.g., `<Eye size={13} className="text-brand-royal" /> View Profile`).
- Replaced misaligned text buttons with unified `.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm`, and `.btn-danger` classes.

---

## 4. Verification & Testing

| Suite | Status | Results |
|---|---|---|
| **TypeScript Compilation** (`tsc -b`) | PASSED | 0 errors |
| **Vite Production Build** (`npm run build`) | PASSED | 2,080 modules transformed, build complete in 19.72s |
| **Frontend Unit Tests** (Vitest) | PASSED | 15 / 15 passed |
| **Backend Regression Suite** (pytest) | PASSED | 146 / 146 passed |

---

## 5. Conclusion

The EduPredict UI/UX refinement successfully resolved all data presentation discrepancies, established a uniform design language across tables and forms, and ensured complete responsiveness and accessibility across all four user roles.
