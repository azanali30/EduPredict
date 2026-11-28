"""
EduPredict - Cohort Trend Aggregation & SDC Service (Workstream A / Phase 13)
Module: backend.services.analyst_trends_service
Purpose: Computes real institution-wide term trends across persisted predictions,
academic records, and attendance roll-call aggregates while strictly enforcing
Statistical Disclosure Control (N < 5 suppression) and returning zero student-level PII.
"""

from typing import Any, Dict, List, Optional, Set
from pymongo.database import Database

CELL_SUPPRESSION_THRESHOLD = 5


def _safe_mean(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _extract_raw20_prediction(pred_doc: Dict[str, Any]) -> Optional[float]:
    """Derive 0-20 scale grade from explicit raw20 field or real PredictionRecord.predicted_marks (0-100)."""
    raw20 = pred_doc.get("predicted_grade_raw20")
    if isinstance(raw20, (int, float)) and not isinstance(raw20, bool):
        return float(raw20)
    pct = pred_doc.get("predicted_marks")
    if isinstance(pct, (int, float)) and not isinstance(pct, bool):
        return round(float(pct) / 5.0, 2)
    return None


def get_analyst_trends_data(db: Optional[Database]) -> Dict[str, Any]:
    """Build SDC-compliant multi-term institutional trend series from MongoDB collections."""
    if db is None:
        return {
            "term_trends": [],
            "monitored_terms_count": 0,
            "unsuppressed_terms_count": 0,
            "institutional_avg_raw20": None,
            "institutional_avg_percentage": None,
            "institutional_suppressed": True,
            "growth_delta_raw20": None,
            "trend_available": False,
            "trend_message": "Database unavailable.",
            "sdc_threshold": CELL_SUPPRESSION_THRESHOLD,
        }

    preds = list(
        db.predictions.find(
            {},
            {
                "student_id": 1,
                "subject": 1,
                "academic_term": 1,
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
    att_records = list(
        db.attendance_records.find(
            {},
            {
                "student_id": 1,
                "academic_term": 1,
                "status": 1,
            },
        )
    )

    term_buckets: Dict[str, Dict[str, Any]] = {}

    def _bucket(term_name: str) -> Dict[str, Any]:
        if term_name not in term_buckets:
            term_buckets[term_name] = {
                "students": set(),
                "math_students": set(),
                "port_students": set(),
                "coursework_students": set(),
                "att_students": set(),
                "all_raw20": [],
                "all_pct": [],
                "math_raw20": [],
                "port_raw20": [],
                "coursework_raw20": [],
                "att_present_late": 0,
                "att_effective": 0,
            }
        return term_buckets[term_name]

    for p in preds:
        term = (p.get("academic_term") or "Unspecified").strip() or "Unspecified"
        b = _bucket(term)
        sid = p.get("student_id")
        if sid is not None:
            b["students"].add(sid)

        val20 = _extract_raw20_prediction(p)
        pct = p.get("predicted_marks")
        val_pct = float(pct) if isinstance(pct, (int, float)) and not isinstance(pct, bool) else (round(val20 * 5.0, 2) if val20 is not None else None)

        if val20 is not None:
            b["all_raw20"].append(val20)
            subj = (p.get("subject") or "").strip().lower()
            if "math" in subj:
                b["math_raw20"].append(val20)
                if sid is not None:
                    b["math_students"].add(sid)
            elif "port" in subj:
                b["port_raw20"].append(val20)
                if sid is not None:
                    b["port_students"].add(sid)
        if val_pct is not None:
            b["all_pct"].append(val_pct)

    for rec in ac_records:
        term = (rec.get("term") or "Unspecified").strip() or "Unspecified"
        b = _bucket(term)
        sid = rec.get("student_id")
        if sid is not None:
            b["students"].add(sid)
        final_m = rec.get("final_exam_marks")
        if isinstance(final_m, (int, float)) and not isinstance(final_m, bool):
            b["coursework_raw20"].append(float(final_m))
            if sid is not None:
                b["coursework_students"].add(sid)

    for att in att_records:
        term = (att.get("academic_term") or "Unspecified").strip() or "Unspecified"
        b = _bucket(term)
        sid = att.get("student_id")
        if sid is not None:
            b["students"].add(sid)
            b["att_students"].add(sid)
        st = att.get("status", "")
        if st != "Excused":
            b["att_effective"] += 1
            if st in ("Present", "Late"):
                b["att_present_late"] += 1

    term_trends: List[Dict[str, Any]] = []
    unsuppressed_students: Set[Any] = set()
    unsuppressed_raw20: List[float] = []
    unsuppressed_pct: List[float] = []

    for term_name in sorted(term_buckets.keys()):
        b = term_buckets[term_name]
        cohort_n = len(b["students"])
        suppressed = cohort_n < CELL_SUPPRESSION_THRESHOLD

        if suppressed:
            term_trends.append(
                {
                    "term": term_name,
                    "suppressed": True,
                    "display_count": f"<{CELL_SUPPRESSION_THRESHOLD} (Suppressed)",
                    "student_count": None,
                    "institutional_avg_raw20": None,
                    "institutional_avg_percentage": None,
                    "math_avg_raw20": None,
                    "portuguese_avg_raw20": None,
                    "coursework_avg_raw20": None,
                    "attendance_rate_percentage": None,
                }
            )
            continue

        unsuppressed_students.update(b["students"])
        unsuppressed_raw20.extend(b["all_raw20"])
        unsuppressed_pct.extend(b["all_pct"])

        math_n = len(b["math_students"])
        port_n = len(b["port_students"])
        math_ok = math_n >= CELL_SUPPRESSION_THRESHOLD
        port_ok = port_n >= CELL_SUPPRESSION_THRESHOLD

        # Complementary suppression: if either subject has 1..4 students while the other exists,
        # suppress both subject averages so suppressed sub-cohort values cannot be backed out
        if (0 < math_n < CELL_SUPPRESSION_THRESHOLD) or (0 < port_n < CELL_SUPPRESSION_THRESHOLD):
            math_ok = False
            port_ok = False

        cw_ok = len(b["coursework_students"]) >= CELL_SUPPRESSION_THRESHOLD
        att_ok = len(b["att_students"]) >= CELL_SUPPRESSION_THRESHOLD and b["att_effective"] > 0
        att_rate = (
            round((b["att_present_late"] / b["att_effective"]) * 100.0, 1) if att_ok else None
        )

        term_trends.append(
            {
                "term": term_name,
                "suppressed": False,
                "display_count": str(cohort_n),
                "student_count": cohort_n,
                "institutional_avg_raw20": _safe_mean(b["all_raw20"]),
                "institutional_avg_percentage": _safe_mean(b["all_pct"]),
                "math_avg_raw20": _safe_mean(b["math_raw20"]) if math_ok else None,
                "portuguese_avg_raw20": _safe_mean(b["port_raw20"]) if port_ok else None,
                "coursework_avg_raw20": _safe_mean(b["coursework_raw20"]) if cw_ok else None,
                "attendance_rate_percentage": att_rate,
            }
        )

    # Aggregate institutional summary strictly across unsuppressed cohorts to eliminate residual inference
    institutional_suppressed = len(unsuppressed_students) < CELL_SUPPRESSION_THRESHOLD
    institutional_avg_raw20 = None if institutional_suppressed else _safe_mean(unsuppressed_raw20)
    institutional_avg_percentage = None if institutional_suppressed else _safe_mean(unsuppressed_pct)

    unsuppressed_with_avg = [
        t for t in term_trends if not t["suppressed"] and t["institutional_avg_raw20"] is not None
    ]
    trend_available = len(unsuppressed_with_avg) >= 2
    growth_delta_raw20: Optional[float] = None
    trend_message = "Not enough data to calculate a trend"
    if trend_available:
        first_avg = unsuppressed_with_avg[0]["institutional_avg_raw20"]
        last_avg = unsuppressed_with_avg[-1]["institutional_avg_raw20"]
        if first_avg is not None and last_avg is not None:
            growth_delta_raw20 = round(last_avg - first_avg, 2)
            trend_message = (
                f"Computed across {len(unsuppressed_with_avg)} unsuppressed terms "
                f"({unsuppressed_with_avg[0]['term']} to {unsuppressed_with_avg[-1]['term']})."
            )

    return {
        "term_trends": term_trends,
        "monitored_terms_count": len(term_trends),
        "unsuppressed_terms_count": len([t for t in term_trends if not t["suppressed"]]),
        "institutional_avg_raw20": institutional_avg_raw20,
        "institutional_avg_percentage": institutional_avg_percentage,
        "institutional_suppressed": institutional_suppressed,
        "growth_delta_raw20": growth_delta_raw20,
        "trend_available": trend_available,
        "trend_message": trend_message,
        "sdc_threshold": CELL_SUPPRESSION_THRESHOLD,
    }
