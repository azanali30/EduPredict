"""
Phase 7D — transparent academic attrition vulnerability advisory.

This is a deterministic, explainable heuristic over the existing analytical
cohort records. It is NOT a trained dropout model and does not identify or
contact individual learners.
"""
from typing import Any, Dict, List
from pymongo.database import Database

DEFAULT_HIGH_ABSENCE_THRESHOLD = 15
FAIL_MARK_THRESHOLD = 50.0
CELL_SUPPRESSION_THRESHOLD = 5


def _numeric(value: Any):
    try:
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _suppressed_count(value: int) -> Dict[str, Any]:
    if 0 < value < CELL_SUPPRESSION_THRESHOLD:
        return {"value": None, "display": "<5", "suppressed": True}
    return {"value": value, "display": str(value), "suppressed": False}


class AttritionAdvisoryService:
    """Computes cohort-only counts for a transparent attrition-vulnerability rule."""

    @staticmethod
    def get_cohort_summary(
        db: Database,
        allowed_subjects: List[str] | None = None,
        high_absence_threshold: int = DEFAULT_HIGH_ABSENCE_THRESHOLD,
        suppress_small_cells: bool = False,
    ) -> Dict[str, Any]:
        if db is None:
            raise ValueError("Database is unavailable.")
        if not isinstance(high_absence_threshold, int) or not 1 <= high_absence_threshold <= 93:
            raise ValueError("high_absence_threshold must be an integer between 1 and 93.")

        query: Dict[str, Any] = {}
        if allowed_subjects is not None:
            query["subject"] = {"$in": allowed_subjects}

        grouped: Dict[str, Dict[str, int]] = {}
        cursor = db.analytical_academic_records.find(
            query,
            {
                "subject": 1,
                "absences": 1,
                "previous_exam_marks": 1,
                "quiz_scores": 1,
            },
        )
        for row in cursor:
            subject = row.get("subject")
            if not isinstance(subject, str) or not subject.strip():
                continue
            absences = _numeric(row.get("absences"))
            first_mark = _numeric(row.get("previous_exam_marks"))
            second_mark = _numeric(row.get("quiz_scores"))
            if absences is None or first_mark is None or second_mark is None:
                continue
            if not (0 <= absences <= 93 and 0 <= first_mark <= 100 and 0 <= second_mark <= 100):
                continue

            stats = grouped.setdefault(subject, {"eligible_records": 0, "flagged_records": 0})
            stats["eligible_records"] += 1
            if (
                absences >= high_absence_threshold
                and first_mark < FAIL_MARK_THRESHOLD
                and second_mark < FAIL_MARK_THRESHOLD
            ):
                stats["flagged_records"] += 1

        results = []
        for subject in sorted(grouped):
            stats = grouped[subject]
            cohort_n = stats["eligible_records"]
            flagged_n = stats["flagged_records"]
            if suppress_small_cells and 0 < cohort_n < CELL_SUPPRESSION_THRESHOLD:
                results.append({
                    "subject": subject,
                    "eligible_records": _suppressed_count(cohort_n),
                    "vulnerability_flags": _suppressed_count(flagged_n),
                    "flag_rate_pct": None,
                    "suppressed": True,
                })
                continue
            results.append({
                "subject": subject,
                "eligible_records": _suppressed_count(cohort_n) if suppress_small_cells else {
                    "value": cohort_n, "display": str(cohort_n), "suppressed": False
                },
                "vulnerability_flags": _suppressed_count(flagged_n) if suppress_small_cells else {
                    "value": flagged_n, "display": str(flagged_n), "suppressed": False
                },
                "flag_rate_pct": round((flagged_n / cohort_n) * 100, 2) if cohort_n else 0.0,
                "suppressed": False,
            })

        return {
            "status": "ok",
            "scope": "cohort_aggregate_only",
            "indicator": {
                "name": "Academic Attrition Vulnerability Indicator",
                "type": "transparent_rule_based_advisory",
                "high_absence_threshold": high_absence_threshold,
                "absence_unit": "raw absence sessions (not an attendance percentage)",
                "period_mark_threshold_pct": FAIL_MARK_THRESHOLD,
                "rule": "absences >= threshold AND period_1_mark < 50% AND period_2_mark < 50%",
                "warning": (
                    "This heuristic is not a trained dropout model, calibrated probability, "
                    "or evidence that a learner has withdrawn. It flags a historical cohort "
                    "pattern for research and must not trigger penalties or automated action."
                ),
            },
            "subjects": results,
            "privacy_policy": {
                "cell_suppression_threshold": CELL_SUPPRESSION_THRESHOLD,
                "small_cohorts_suppressed": suppress_small_cells,
            },
        }
