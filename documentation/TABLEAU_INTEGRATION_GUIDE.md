# EduPredict Tableau BI Integration Guide

**Workstream B — Tableau BI Export Bridge & Workbook Schema**  
**Scope:** Non-PII institutional aggregates generated dynamically from MongoDB 6.x (`predictions`, `academic_records`, `attendance_sessions`, `attendance_records`, `dropout_records`, `demand_forecasts`, `anomaly_records`).

---

## 1. Environment & Tooling Disclosure

- EduPredict provides a **live REST export service** (`backend/services/bigdata/tableau_export_service.py` + `backend/routes/tableau_routes.py`) and a pre-configured Tableau Desktop XML workbook ([`tableau/EduPredict_Analytics_Workbook.twb`](../tableau/EduPredict_Analytics_Workbook.twb)).
- **Tableau Desktop / Tableau Server runtime is not installed in headless verification environments.** Workbook XML validity is verified programmatically with Python's `xml.etree.ElementTree`, and live CSV/JSON exports are verified end-to-end via Flask API integration tests.
- All exported schemas strictly **exclude Personally Identifiable Information (PII)**: student emails, full names, passwords, contact numbers, and internal account identifiers are never included.

---

## 2. Role-Based Governance & Privacy Rules

| Role | `/api/tableau/datasets` | `/api/tableau/export/<dataset>` | Statistical Disclosure Control (`N < 5`) |
| --- | --- | --- | --- |
| **Admin** | Allowed | Allowed (`csv` / `json`) | Zero PII; SDC enabled by default (`apply_sdc=false` permits unsuppressed non-PII counts for admin capacity audits) |
| **Analyst** | Allowed | Allowed (`csv` / `json`) | **Mandatory `N < 5` suppression enforced server-side** (cannot be overridden) |
| **Teacher** | `403 Forbidden` | `403 Forbidden` | Blocked |
| **Student** | `403 Forbidden` | `403 Forbidden` | Blocked |

Every CSV export neutralizes spreadsheet formula injection by prefixing values starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a leading single quote (`'`).

---

## 3. Supported Tableau Export Datasets

1. **`academic_performance`** — Aggregated by `(subject, academic_term, milestone, risk_tier)` with mean predicted score (`0–20` & `%`) and coursework final exam marks (`0–20`).
2. **`subject_trends`** — Longitudinal term series matching `/api/analyst/trends` (`institutional_avg_raw20`, `math_avg_raw20`, `portuguese_avg_raw20`, `coursework_avg_raw20`, `verified_attendance_rate_pct`).
3. **`attendance_summary`** — Roll-call session & status aggregates from `attendance_sessions` and `attendance_records` tagged `attendance_source = verified_institutional_register`.
4. **`dropout_risk_summary`** — Aggregate dropout tier distribution and mean risk probability by `academic_term` and `risk_tier`.
5. **`demand_forecast_summary`** — Subject enrollment projections with `lower_ci` and `upper_ci` confidence intervals.
6. **`anomaly_summary`** — Academic anomaly telemetry grouped by `(subject, severity, review_status)`.

---

## 4. How to Connect Tableau Desktop to EduPredict Exports

1. Sign in to EduPredict as an **Admin** (or **Analyst** via API) and navigate to **Reports -> Tableau BI Analytics Exports** in `AdminReports.tsx`.
2. Download the desired CSV datasets (`edupredict_tableau_academic_performance.csv`, `edupredict_tableau_subject_trends.csv`, `edupredict_tableau_attendance_summary.csv`, `edupredict_tableau_dropout_risk_summary.csv`, `edupredict_tableau_demand_forecast_summary.csv`) into the [`tableau/`](../tableau/) directory alongside `EduPredict_Analytics_Workbook.twb`.
3. Open [`tableau/EduPredict_Analytics_Workbook.twb`](../tableau/EduPredict_Analytics_Workbook.twb) in Tableau Desktop (2018.1+ or Tableau Public Desktop Edition).
4. Tableau reads the relative CSV data sources directly and populates the five worksheets plus the composite `EduPredict Institutional Analytics Dashboard`.
5. Whenever new term records are ingested, re-download updated CSV extracts from EduPredict and choose **Data -> Refresh All Data Sources** in Tableau Desktop.
