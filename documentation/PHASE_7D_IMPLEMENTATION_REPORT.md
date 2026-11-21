# EduPredict — Phase 7D Implementation Report
## Academic Attrition Vulnerability Indicator (Cohort Advisory)

**Status:** Implementation branch opened; validation pending  
**Branch:** `phase-7d-academic-attrition-advisory`

### Scope and data integrity
Phase 7D introduces a transparent rule-based Academic Attrition Vulnerability Indicator over the existing `analytical_academic_records` collection. It does not train or claim a machine-learning dropout model.

The current UCI Student Performance cohorts contain completed-term records and no verified institutional withdrawal/retention labels. Therefore, genuine dropout prediction remains deferred until an institution supplies consented, correctly linked, longitudinal outcome data. Synthetic dropout labels are prohibited.

### Rule
A record contributes to the cohort advisory count only when all three conditions hold:
- Raw absence sessions are at or above the configurable threshold (default 15).
- Period 1 mark is below 50%.
- Period 2 mark is below 50%.

The default absence threshold is an explicit heuristic parameter, not a claim that 15 absences equals a particular attendance percentage. Invalid or missing measurements are excluded from the eligible denominator.

### API
- `GET /api/attrition/advisory-summary`
- Roles: admin, teacher, analyst; students denied.
- Admin receives institution-wide subject aggregates.
- Teachers receive aggregates for assigned subjects only.
- Analysts receive aggregate-only data with N<5 cell suppression.
- No student IDs, names, source record IDs, or row-level data are returned.
- Threshold may be set with `absence_threshold` (integer 1–93).

### Governance limitations
This is an exploratory cohort-level heuristic, not a calibrated probability, certified dropout forecast, student-level classification, or proof of withdrawal. It must not trigger penalties, enrollment changes, or automated intervention. Because the source records are pseudonymous and are not safely linked to institutional user accounts, this release intentionally provides no learner-level queue or case-management workflow.

### Validation
Unit tests are added for the three-part rule, raw absence semantics, missing/invalid measurements, subject scoping, and small-cell suppression. The branch must still be run through the project's full backend/frontend regression suites and a live MongoDB smoke test before merge or submission. No test pass is claimed until those commands have actually been executed.
