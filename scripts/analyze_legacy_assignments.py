"""
EduPredict - Legacy Assignment Safety & Multi-Subject Analysis Tool
Phase 6A: Read-only inspection tool for existing teacher-student assignments,
evidenced prediction subjects, and academic record correlations.

Usage:
    python scripts/analyze_legacy_assignments.py
"""

import os
import sys
import argparse
from typing import Any, Dict, List
from pymongo import MongoClient
from pymongo.database import Database

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.config import get_config


def analyze_assignments(db: Database) -> Dict[str, Any]:
    """
    Performs a non-destructive analysis of legacy assignments and subject evidence.
    """
    total_teachers = db.users.count_documents({"role": "teacher"})
    total_students = db.users.count_documents({"role": "student"})
    legacy_assignments_cursor = db.teacher_student_assignments.find({"status": "active"})
    legacy_assignments = list(legacy_assignments_cursor)

    teacher_student_map: Dict[str, List[str]] = {}
    for assign in legacy_assignments:
        t_id = str(assign["teacher_id"])
        s_id = str(assign["student_id"])
        if t_id not in teacher_student_map:
            teacher_student_map[t_id] = []
        teacher_student_map[t_id].append(s_id)

    # Analyze student subjects evidenced by predictions
    student_prediction_subjects: Dict[str, set] = {}
    for pred in db.predictions.find({}, {"student_id": 1, "subject": 1}):
        s_id = str(pred["student_id"])
        subj = pred.get("subject", "Unknown")
        if s_id not in student_prediction_subjects:
            student_prediction_subjects[s_id] = set()
        student_prediction_subjects[s_id].add(subj)

    # Analyze teacher assignment subject footprint
    teacher_reports = []
    teachers_requiring_confirmation = []

    teacher_docs = {
        str(u["_id"]): u
        for u in db.users.find({"role": "teacher"})
    }

    for t_id, s_ids in teacher_student_map.items():
        t_user = teacher_docs.get(t_id, {})
        t_name = t_user.get("full_name", "Unknown Teacher")
        t_email = t_user.get("email", "Unknown Email")

        # Find all subjects across assigned students
        evidenced_subjects = set()
        for s_id in s_ids:
            evidenced_subjects.update(student_prediction_subjects.get(s_id, set()))

        teacher_info = {
            "teacher_id": t_id,
            "name": t_name,
            "email": t_email,
            "assigned_student_count": len(s_ids),
            "evidenced_subjects": sorted(list(evidenced_subjects)),
        }
        teacher_reports.append(teacher_info)

        # Flag for administrator confirmation if teacher touches multiple subjects
        # or has no evidenced subjects
        if len(evidenced_subjects) != 1:
            teachers_requiring_confirmation.append(teacher_info)

    return {
        "total_teachers": total_teachers,
        "total_students": total_students,
        "total_legacy_assignments": len(legacy_assignments),
        "teachers_with_assignments": len(teacher_student_map),
        "teachers_requiring_confirmation": teachers_requiring_confirmation,
        "teacher_reports": teacher_reports,
    }


def print_report(res: Dict[str, Any]) -> None:
    print("=" * 75)
    print(" EDUPREDICT — LEGACY ASSIGNMENT & MULTI-SUBJECT SAFETY ANALYSIS")
    print("=" * 75)
    print(f" Total Registered Teachers:     {res['total_teachers']}")
    print(f" Total Registered Students:     {res['total_students']}")
    print(f" Active Legacy Assignments:     {res['total_legacy_assignments']}")
    print(f" Teachers with Cohort Mappings: {res['teachers_with_assignments']}")
    print("-" * 75)

    print(" INSTRUCTOR COHORT SUBJECT FOOTPRINT:")
    for t in res["teacher_reports"]:
        subjs_str = ", ".join(t["evidenced_subjects"]) if t["evidenced_subjects"] else "None (Unscreened)"
        print(f"   • {t['name']} ({t['email']})")
        print(f"     - Assigned Students: {t['assigned_student_count']}")
        print(f"     - Evidenced Prediction Subjects: [{subjs_str}]")

    print("-" * 75)
    print(" INSTRUCTORS REQUIRING EXPLICIT ADMIN CONFIRMATION:")
    print(" (Instructors whose assigned students span multiple subjects or have no predictions)")
    if res["teachers_requiring_confirmation"]:
        for t in res["teachers_requiring_confirmation"]:
            reason = "Multi-Subject Ambiguity" if len(t["evidenced_subjects"]) > 1 else "Zero Prediction Evidence"
            print(f"   [!] {t['name']} ({t['email']}) -> Reason: {reason}")
    else:
        print("   None. All mapped teachers exhibit unambiguous single-subject cohort footprints.")

    print("=" * 75)
    print(" [POLICY] Existing teacher_student_assignments are preserved unmodified.")
    print(" [POLICY] Phase 6A performs NO automatic conversion to teacher-subject assignments.")
    print(" [POLICY] Explicit administrator assignment is required in Phase 6B.")
    print("=" * 75)


def main():
    parser = argparse.ArgumentParser(description="Analyze legacy assignments and subject footprints.")
    parser.add_argument("--db-name", type=str, default=None, help="Database name")
    args = parser.parse_args()

    cfg = get_config()
    db_name = args.db_name or cfg.MONGO_DB_NAME or "edupredict"
    mongo_uri = cfg.MONGO_URI or "mongodb://localhost:27017"

    client = MongoClient(mongo_uri)
    db = client[db_name]

    res = analyze_assignments(db)
    print_report(res)


if __name__ == "__main__":
    main()
