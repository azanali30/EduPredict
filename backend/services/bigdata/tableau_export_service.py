"""
EduPredict - Tableau BI Export Service (Workstream B / Phase 14)
Module: backend.services.bigdata.tableau_export_service
Purpose: Generates non-PII, formula-safe, provenance-tagged CSV and JSON analytical
datasets from live MongoDB collections for Tableau Desktop / Public visualization.
Enforces strict Statistical Disclosure Control (N < 5 suppression) on Analyst exports
and contains zero student PII across all export scopes.
"""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pymongo.database import Database

from backend.services.analyst_trends_service import (
    CELL_SUPPRESSION_THRESHOLD,
    _extract_raw20_prediction,
    get_analyst_trends_data,
)

VALID_TABLEAU_DATASETS: Dict[str, Dict[str, Any]] = {
    "academic_performance": {
        "title": "Academic Performance & Risk Summary",
        "description": "Aggregated prediction scores, milestone levels, risk tiers, and verified coursework averages by subject and term.",
        "source_collections": ["predictions", "academic_records"],
        "columns": [
            "subject",
            "academic_term",
            "milestone",
            "risk_tier",
            "distinct_students_display",
            "evaluation_count",
            "avg_predicted_raw20",
            "avg_predicted_pct",
            "avg_coursework_final_raw20",
            "suppressed",
        ],
    },
    "subject_trends": {
        "title": "Multi-Term Subject Trends",
        "description": "Term-by-term Mathematics, Portuguese Language, coursework, and attendance indicators.",
        "source_collections": ["predictions", "academic_records", "attendance_records"],
        "columns": [
            "academic_term",
            "distinct_students_display",
            "institutional_avg_raw20",
            "math_avg_raw20",
            "portuguese_avg_raw20",
            "coursework_avg_raw20",
            "verified_attendance_rate_pct",
            "suppressed",
        ],
    },
    "attendance_summary": {
        "title": "Verified Institutional Attendance Summary",
        "description": "Roll-call session attendance totals and percentages strictly separated from ML 60-session proxies.",
        "source_collections": ["attendance_sessions", "attendance_records"],
        "columns": [
            "subject_name",
            "subject_code",
            "academic_term",
            "session_count",
            "distinct_students_display",
            "present_count",
            "absent_count",
            "late_count",
            "excused_count",
            "verified_attendance_rate_pct",
            "suppressed",
            "attendance_source",
        ],
    },
    "dropout_risk_summary": {
        "title": "Dropout Risk Cohort Summary",
        "description": "De-identified early-warning dropout tier distribution and average probabilities by academic term.",
        "source_collections": ["dropout_records"],
        "columns": [
            "academic_term",
            "risk_tier",
            "cohort_count_display",
            "avg_risk_probability",
            "suppressed",
        ],
    },
    "demand_forecast_summary": {
        "title": "Course Enrollment Demand Forecasts",
        "description": "Projected subject enrollment volume and confidence bounds by target term.",
        "source_collections": ["demand_forecasts"],
        "columns": [
            "department",
            "subject_name",
            "target_term",
            "forecast_horizon",
            "predicted_enrollment",
            "lower_ci",
            "upper_ci",
            "trend_direction",
        ],
    },
    "anomaly_summary": {
        "title": "Academic Anomaly Telemetry Summary",
        "description": "Aggregate counts of detected performance anomalies grouped by subject, severity, and review state.",
        "source_collections": ["anomaly_records"],
        "columns": [
            "subject",
            "severity",
            "review_status",
            "alert_count_display",
            "suppressed",
        ],
    },
}

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: Any) -> str:
    """Neutralize spreadsheet CSV formula injection and render nulls cleanly."""
    if value is None:
        return ""
    text = str(value)
    if text and text[0] in _FORMULA_PREFIXES:
        return "'" + text
    return text


def rows_to_csv_string(columns: List[str], rows: List[Dict[str, Any]]) -> str:
    """Serialize column-ordered aggregate dictionaries into a formula-safe UTF-8 CSV string."""
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([sanitize_csv_cell(row.get(col)) for col in columns])
    return buf.getvalue()


def _safe_avg(vals: List[float]) -> Optional[float]:
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def _suppress_needed(count: int, enforce_sdc: bool) -> bool:
    return enforce_sdc and 0 < count < CELL_SUPPRESSION_THRESHOLD


class TableauExportService:
    """Generates Tableau-compatible non-PII CSV/JSON exports from EduPredict MongoDB data."""

    @staticmethod
    def list_available_datasets(db: Optional[Database]) -> List[Dict[str, Any]]:
        counts_by_col: Dict[str, int] = {}
        if db is not None:
            for col_name in (
                "predictions",
                "academic_records",
                "attendance_sessions",
                "attendance_records",
                "dropout_records",
                "demand_forecasts",
                "anomaly_records",
            ):
                try:
                    counts_by_col[col_name] = db[col_name].count_documents({})
                except Exception:
                    counts_by_col[col_name] = 0

        catalog = []
        for key, meta in VALID_TABLEAU_DATASETS.items():
            catalog.append(
                {
                    "dataset": key,
                    "title": meta["title"],
                    "description": meta["description"],
                    "columns": meta["columns"],
                    "source_collections": meta["source_collections"],
                    "source_document_counts": {
                        c: counts_by_col.get(c, 0) for c in meta["source_collections"]
                    },
                }
            )
        return catalog

    @classmethod
    def generate_export(
        cls,
        db: Database,
        dataset_name: str,
        actor_user: Any,
        output_format: str = "json",
        apply_sdc: Optional[bool] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        if db is None:
            return None, "Database unavailable.", 503

        role = getattr(actor_user, "role", None)
        if role not in ("admin", "analyst"):
            return None, "Forbidden: Tableau BI exports are restricted to Administrators and Analysts.", 403

        ds_key = (dataset_name or "").strip().lower()
        if ds_key not in VALID_TABLEAU_DATASETS:
            return (
                None,
                f"Unknown dataset '{dataset_name}'. Valid options: {', '.join(VALID_TABLEAU_DATASETS.keys())}.",
                400,
            )

        fmt = (output_format or "json").strip().lower()
        if fmt not in ("json", "csv"):
            return None, "Invalid format parameter. Must be 'json' or 'csv'.", 400

        # Analysts ALWAYS enforce N < 5 Statistical Disclosure Control regardless of query flags
        effective_sdc = True if role == "analyst" else (True if apply_sdc is None else bool(apply_sdc))

        schema_meta = VALID_TABLEAU_DATASETS[ds_key]
        columns = schema_meta["columns"]

        if ds_key == "academic_performance":
            rows = cls._build_academic_performance_rows(db, effective_sdc)
        elif ds_key == "subject_trends":
            rows = cls._build_subject_trend_rows(db, effective_sdc)
        elif ds_key == "attendance_summary":
            rows = cls._build_attendance_summary_rows(db, effective_sdc)
        elif ds_key == "dropout_risk_summary":
            rows = cls._build_dropout_summary_rows(db, effective_sdc)
        elif ds_key == "demand_forecast_summary":
            rows = cls._build_demand_forecast_rows(db)
        else:  # anomaly_summary
            rows = cls._build_anomaly_summary_rows(db, effective_sdc)

        metadata = {
            "dataset": ds_key,
            "title": schema_meta["title"],
            "exported_at_utc": datetime.now(timezone.utc).isoformat(),
            "exported_by_role": role,
            "sdc_enforced": effective_sdc,
            "sdc_threshold": CELL_SUPPRESSION_THRESHOLD if effective_sdc else None,
            "contains_pii": False,
            "source_collections": schema_meta["source_collections"],
            "row_count": len(rows),
            "format": fmt,
        }

        csv_content = rows_to_csv_string(columns, rows) if fmt == "csv" else None
        return {
            "metadata": metadata,
            "columns": columns,
            "rows": rows,
            "csv_content": csv_content,
        }, None, 200

    @classmethod
    def _build_academic_performance_rows(cls, db: Database, enforce_sdc: bool) -> List[Dict[str, Any]]:
        preds = list(
            db.predictions.find(
                {},
                {
                    "student_id": 1,
                    "subject": 1,
                    "academic_term": 1,
                    "milestone": 1,
                    "predicted_status": 1,
                    "predicted_grade_raw20": 1,
                    "predicted_marks": 1,
                },
            )
        )
        ac_records = list(
            db.academic_records.find(
                {},
                {
                    "student_id": 1,
                    "subject": 1,
                    "term": 1,
                    "final_exam_marks": 1,
                },
            )
        )

        # Coursework final exam mean & distinct student count per (subject, term)
        coursework_by_st: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for r in ac_records:
            subj = (r.get("subject") or "Unspecified").strip()
            term = (r.get("term") or "Unspecified").strip()
            val = r.get("final_exam_marks")
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                cw_bucket = coursework_by_st.setdefault((subj, term), {"students": set(), "vals": []})
                cw_bucket["vals"].append(float(val))
                if r.get("student_id") is not None:
                    cw_bucket["students"].add(r["student_id"])

        buckets: Dict[Tuple[str, str, int, str], Dict[str, Any]] = {}
        for p in preds:
            subj = (p.get("subject") or "Unspecified").strip()
            term = (p.get("academic_term") or "Unspecified").strip()
            ms = int(p.get("milestone", 0) or 0)
            tier = (p.get("predicted_status") or "Unscreened").strip()
            key = (subj, term, ms, tier)
            b = buckets.setdefault(
                key,
                {"students": set(), "count": 0, "raw20": [], "pct": []},
            )
            if p.get("student_id") is not None:
                b["students"].add(p["student_id"])
            b["count"] += 1

            val20 = _extract_raw20_prediction(p)
            if val20 is not None:
                b["raw20"].append(val20)
            pct = p.get("predicted_marks")
            if isinstance(pct, (int, float)) and not isinstance(pct, bool):
                b["pct"].append(float(pct))
            elif val20 is not None:
                b["pct"].append(round(val20 * 5.0, 2))

        rows = []
        for (subj, term, ms, tier), b in sorted(buckets.items()):
            stu_n = len(b["students"])
            suppressed = _suppress_needed(stu_n, enforce_sdc)
            cw_bucket = coursework_by_st.get((subj, term))
            cw_avg = None
            if cw_bucket and (not enforce_sdc or len(cw_bucket["students"]) >= CELL_SUPPRESSION_THRESHOLD):
                cw_avg = _safe_avg(cw_bucket["vals"])
            rows.append(
                {
                    "subject": subj,
                    "academic_term": term,
                    "milestone": ms,
                    "risk_tier": tier,
                    "distinct_students_display": f"<{CELL_SUPPRESSION_THRESHOLD} (Suppressed)" if suppressed else stu_n,
                    "evaluation_count": None if suppressed else b["count"],
                    "avg_predicted_raw20": None if suppressed else _safe_avg(b["raw20"]),
                    "avg_predicted_pct": None if suppressed else _safe_avg(b["pct"]),
                    "avg_coursework_final_raw20": None if suppressed else cw_avg,
                    "suppressed": suppressed,
                }
            )
        return rows

    @classmethod
    def _build_subject_trend_rows(cls, db: Database, enforce_sdc: bool) -> List[Dict[str, Any]]:
        trends_payload = get_analyst_trends_data(db)
        rows = []
        for item in trends_payload.get("term_trends", []):
            if not enforce_sdc and item.get("suppressed"):
                term = item["term"]
                preds = list(
                    db.predictions.find(
                        {"academic_term": term},
                        {"student_id": 1, "subject": 1, "predicted_grade_raw20": 1, "predicted_marks": 1},
                    )
                )
                ac = list(db.academic_records.find({"term": term}, {"student_id": 1, "final_exam_marks": 1}))
                att = list(db.attendance_records.find({"academic_term": term}, {"student_id": 1, "status": 1}))
                distinct_s = {d.get("student_id") for d in preds + ac + att if d.get("student_id") is not None}

                all_r20: List[float] = []
                m_r20: List[float] = []
                p_r20: List[float] = []
                for d in preds:
                    val20 = _extract_raw20_prediction(d)
                    if val20 is not None:
                        all_r20.append(val20)
                        subj_low = (d.get("subject") or "").lower()
                        if "math" in subj_low:
                            m_r20.append(val20)
                        elif "port" in subj_low:
                            p_r20.append(val20)

                cw_r20 = [
                    float(d["final_exam_marks"])
                    for d in ac
                    if isinstance(d.get("final_exam_marks"), (int, float))
                ]
                eff_att = [d for d in att if d.get("status") != "Excused"]
                att_rate = (
                    round((sum(1 for d in eff_att if d.get("status") in ("Present", "Late")) / len(eff_att)) * 100.0, 1)
                    if eff_att
                    else None
                )
                rows.append(
                    {
                        "academic_term": term,
                        "distinct_students_display": len(distinct_s),
                        "institutional_avg_raw20": _safe_avg(all_r20),
                        "math_avg_raw20": _safe_avg(m_r20),
                        "portuguese_avg_raw20": _safe_avg(p_r20),
                        "coursework_avg_raw20": _safe_avg(cw_r20),
                        "verified_attendance_rate_pct": att_rate,
                        "suppressed": False,
                    }
                )
            else:
                rows.append(
                    {
                        "academic_term": item["term"],
                        "distinct_students_display": item["display_count"],
                        "institutional_avg_raw20": item["institutional_avg_raw20"],
                        "math_avg_raw20": item["math_avg_raw20"],
                        "portuguese_avg_raw20": item["portuguese_avg_raw20"],
                        "coursework_avg_raw20": item["coursework_avg_raw20"],
                        "verified_attendance_rate_pct": item["attendance_rate_percentage"],
                        "suppressed": item["suppressed"],
                    }
                )
        return rows

    @classmethod
    def _build_attendance_summary_rows(cls, db: Database, enforce_sdc: bool) -> List[Dict[str, Any]]:
        sessions = list(
            db.attendance_sessions.find(
                {},
                {"subject_id": 1, "subject_name": 1, "subject_code": 1, "academic_term": 1},
            )
        )
        records = list(
            db.attendance_records.find(
                {},
                {"subject_id": 1, "subject_name": 1, "academic_term": 1, "student_id": 1, "status": 1},
            )
        )

        buckets: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for s in sessions:
            key = (s.get("subject_name") or "Unknown", s.get("academic_term") or "Unspecified")
            b = buckets.setdefault(
                key,
                {
                    "subject_code": s.get("subject_code", ""),
                    "sessions": 0,
                    "students": set(),
                    "Present": 0,
                    "Absent": 0,
                    "Late": 0,
                    "Excused": 0,
                },
            )
            b["sessions"] += 1

        for r in records:
            key = (r.get("subject_name") or "Unknown", r.get("academic_term") or "Unspecified")
            b = buckets.setdefault(
                key,
                {
                    "subject_code": "",
                    "sessions": 0,
                    "students": set(),
                    "Present": 0,
                    "Absent": 0,
                    "Late": 0,
                    "Excused": 0,
                },
            )
            if r.get("student_id") is not None:
                b["students"].add(r["student_id"])
            st = r.get("status", "")
            if st in ("Present", "Absent", "Late", "Excused"):
                b[st] += 1

        rows = []
        for (subj_name, term), b in sorted(buckets.items()):
            n_stu = len(b["students"])
            suppressed = _suppress_needed(n_stu, enforce_sdc)
            eff = b["Present"] + b["Absent"] + b["Late"]
            rate = round(((b["Present"] + b["Late"]) / eff) * 100.0, 1) if eff > 0 else None
            rows.append(
                {
                    "subject_name": subj_name,
                    "subject_code": b["subject_code"],
                    "academic_term": term,
                    "session_count": b["sessions"],
                    "distinct_students_display": f"<{CELL_SUPPRESSION_THRESHOLD} (Suppressed)" if suppressed else n_stu,
                    "present_count": None if suppressed else b["Present"],
                    "absent_count": None if suppressed else b["Absent"],
                    "late_count": None if suppressed else b["Late"],
                    "excused_count": None if suppressed else b["Excused"],
                    "verified_attendance_rate_pct": None if suppressed else rate,
                    "suppressed": suppressed,
                    "attendance_source": "verified_institutional_register",
                }
            )
        return rows

    @classmethod
    def _build_dropout_summary_rows(cls, db: Database, enforce_sdc: bool) -> List[Dict[str, Any]]:
        docs = list(
            db.dropout_records.find(
                {},
                {"student_id": 1, "academic_term": 1, "risk_tier": 1, "risk_probability": 1},
            )
        )
        buckets: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for d in docs:
            key = ((d.get("academic_term") or "Unspecified").strip(), (d.get("risk_tier") or "Unscreened").strip())
            b = buckets.setdefault(key, {"students": set(), "probs": []})
            if d.get("student_id") is not None:
                b["students"].add(d["student_id"])
            if isinstance(d.get("risk_probability"), (int, float)):
                b["probs"].append(float(d["risk_probability"]))

        rows = []
        for (term, tier), b in sorted(buckets.items()):
            n = len(b["students"]) if b["students"] else len(b["probs"])
            suppressed = _suppress_needed(n, enforce_sdc)
            rows.append(
                {
                    "academic_term": term,
                    "risk_tier": tier,
                    "cohort_count_display": f"<{CELL_SUPPRESSION_THRESHOLD} (Suppressed)" if suppressed else n,
                    "avg_risk_probability": None if suppressed else _safe_avg(b["probs"]),
                    "suppressed": suppressed,
                }
            )
        return rows

    @classmethod
    def _build_demand_forecast_rows(cls, db: Database) -> List[Dict[str, Any]]:
        docs = list(db.demand_forecasts.find({}))
        rows = []
        for d in docs:
            target_term = d.get("forecast_period") or d.get("target_term") or ""
            horizon = d.get("periods_ahead") if d.get("periods_ahead") is not None else d.get("forecast_horizon", "")
            lower_ci = d.get("confidence_lower") if d.get("confidence_lower") is not None else d.get("lower_ci")
            upper_ci = d.get("confidence_upper") if d.get("confidence_upper") is not None else d.get("upper_ci")
            rows.append(
                {
                    "department": d.get("department", ""),
                    "subject_name": d.get("subject_name") or d.get("subject", ""),
                    "target_term": target_term,
                    "forecast_horizon": horizon,
                    "predicted_enrollment": d.get("predicted_enrollment"),
                    "lower_ci": lower_ci,
                    "upper_ci": upper_ci,
                    "trend_direction": d.get("trend_direction", ""),
                }
            )
        rows.sort(key=lambda r: (str(r["target_term"]), str(r["subject_name"])))
        return rows

    @classmethod
    def _build_anomaly_summary_rows(cls, db: Database, enforce_sdc: bool) -> List[Dict[str, Any]]:
        docs = list(
            db.anomaly_records.find(
                {},
                {
                    "subject": 1,
                    "anomaly_severity": 1,
                    "severity": 1,
                    "review_status": 1,
                    "status": 1,
                    "student_id": 1,
                },
            )
        )
        buckets: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        for d in docs:
            subj = (d.get("subject") or "Unspecified").strip()
            sev = (d.get("anomaly_severity") or d.get("severity") or "Low / Typical").strip()
            rev_st = (d.get("review_status") or d.get("status") or "Pending Review").strip()
            key = (subj, sev, rev_st)
            b = buckets.setdefault(key, {"students": set(), "count": 0})
            if d.get("student_id") is not None:
                b["students"].add(d["student_id"])
            b["count"] += 1

        rows = []
        for (subj, sev, st), b in sorted(buckets.items()):
            n = len(b["students"]) if b["students"] else b["count"]
            suppressed = _suppress_needed(n, enforce_sdc)
            rows.append(
                {
                    "subject": subj,
                    "severity": sev,
                    "review_status": st,
                    "alert_count_display": f"<{CELL_SUPPRESSION_THRESHOLD} (Suppressed)" if suppressed else b["count"],
                    "suppressed": suppressed,
                }
            )
        return rows
