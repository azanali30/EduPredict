"""Phase 7D tests for the cohort-only attrition vulnerability heuristic."""
import pytest
from backend.services.attrition_service import AttritionAdvisoryService


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows

    def find(self, query, projection):
        rows = self.rows
        if "subject" in query:
            allowed = query["subject"]["$in"]
            rows = [r for r in rows if r.get("subject") in allowed]
        return iter(rows)


class FakeDB:
    def __init__(self, rows):
        self.analytical_academic_records = FakeCollection(rows)


def row(subject="Mathematics", absences=15, first=49, second=49):
    return {
        "subject": subject,
        "absences": absences,
        "previous_exam_marks": first,
        "quiz_scores": second,
    }


def test_flags_only_when_all_three_conditions_are_met():
    db = FakeDB([
        row(),
        row(absences=14),
        row(first=50),
        row(second=50),
    ])
    result = AttritionAdvisoryService.get_cohort_summary(db)
    subject = result["subjects"][0]
    assert subject["eligible_records"]["value"] == 4
    assert subject["vulnerability_flags"]["value"] == 1
    assert subject["flag_rate_pct"] == 25.0


def test_rule_uses_raw_absence_count_not_attendance_percentage():
    db = FakeDB([row(absences=15)])
    result = AttritionAdvisoryService.get_cohort_summary(db)
    assert result["indicator"]["absence_unit"] == "raw absence sessions (not an attendance percentage)"
    assert result["subjects"][0]["vulnerability_flags"]["value"] == 1


def test_analyst_small_cohort_is_suppressed():
    db = FakeDB([row()])
    result = AttritionAdvisoryService.get_cohort_summary(db, suppress_small_cells=True)
    subject = result["subjects"][0]
    assert subject["suppressed"] is True
    assert subject["eligible_records"]["value"] is None
    assert subject["vulnerability_flags"]["value"] is None
    assert subject["flag_rate_pct"] is None


def test_subject_scope_is_applied_before_aggregation():
    db = FakeDB([row("Mathematics"), row("Portuguese Language")])
    result = AttritionAdvisoryService.get_cohort_summary(db, allowed_subjects=["Mathematics"])
    assert [s["subject"] for s in result["subjects"]] == ["Mathematics"]


@pytest.mark.parametrize("threshold", [0, 94, -1])
def test_invalid_absence_threshold_rejected(threshold):
    with pytest.raises(ValueError):
        AttritionAdvisoryService.get_cohort_summary(FakeDB([]), high_absence_threshold=threshold)


def test_invalid_or_missing_measurements_are_excluded():
    db = FakeDB([
        row(),
        {"subject": "Mathematics", "absences": None, "previous_exam_marks": 40, "quiz_scores": 40},
        {"subject": "Mathematics", "absences": 15, "previous_exam_marks": 140, "quiz_scores": 40},
    ])
    result = AttritionAdvisoryService.get_cohort_summary(db)
    assert result["subjects"][0]["eligible_records"]["value"] == 1
