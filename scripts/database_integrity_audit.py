"""
Database Integrity Audit Script for EduPredict (Phase 6D)
Performs non-destructive dry-run integrity verification on MongoDB database.
"""
import os
import sys
from bson import ObjectId
from pymongo import MongoClient

def run_audit():
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/edupredict")
    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    print("=" * 70)
    print(f"EDUPREDICT DATABASE INTEGRITY AUDIT (Dry-Run)")
    print(f"Database: {db.name}")
    print("=" * 70)

    issues = []

    # 1. Subjects Collection
    subjects = list(db.subjects.find())
    subject_ids = {s["_id"] for s in subjects}
    subject_names = {s.get("name") for s in subjects}
    subject_codes = {s.get("code") for s in subjects}
    print(f"\n[1] SUBJECT CATALOG: {len(subjects)} subjects found.")
    for s in subjects:
        print(f"  - ID: {s['_id']}, Code: {s.get('code')}, Name: '{s.get('name')}', Key: '{s.get('canonical_key')}', Active: {s.get('is_active')}")
        if not s.get("code") or not s.get("name") or not s.get("canonical_key"):
            issues.append(f"Subject {s['_id']} missing required name/code/canonical_key.")

    # 2. Users Collection
    users = list(db.users.find())
    user_map = {u["_id"]: u for u in users}
    teachers = {uid for uid, u in user_map.items() if u.get("role") == "teacher"}
    students = {uid for uid, u in user_map.items() if u.get("role") == "student"}
    admins = {uid for uid, u in user_map.items() if u.get("role") == "admin"}
    print(f"\n[2] USERS: {len(users)} total ({len(admins)} admins, {len(teachers)} teachers, {len(students)} students).")

    # 3. Teacher-Subject Assignments
    teacher_assignments = list(db.teacher_subject_assignments.find())
    print(f"\n[3] TEACHER-SUBJECT ASSIGNMENTS: {len(teacher_assignments)} records found.")
    seen_t_keys = set()
    for ta in teacher_assignments:
        tid = ta.get("teacher_id")
        sid = ta.get("subject_id")
        term = ta.get("academic_term")
        status = ta.get("status")
        
        # Valid ObjectIds
        if not isinstance(tid, ObjectId) or tid not in user_map:
            issues.append(f"Teacher assignment {ta['_id']} references invalid/missing teacher_id: {tid}")
        elif tid not in teachers:
            issues.append(f"Teacher assignment {ta['_id']} references user {tid} whose role is not teacher ({user_map[tid].get('role')})")

        if not isinstance(sid, ObjectId) or sid not in subject_ids:
            issues.append(f"Teacher assignment {ta['_id']} references invalid/missing subject_id: {sid}")

        if not term or not isinstance(term, str) or not term.strip():
            issues.append(f"Teacher assignment {ta['_id']} has invalid academic_term: {term}")

        if status not in ("active", "inactive"):
            issues.append(f"Teacher assignment {ta['_id']} has non-standard status: {status}")

        key = (tid, sid, term)
        if key in seen_t_keys:
            issues.append(f"Duplicate teacher assignment found: teacher {tid}, subject {sid}, term '{term}'")
        seen_t_keys.add(key)

    # 4. Student-Subject Enrollments
    student_enrollments = list(db.student_subject_enrollments.find())
    print(f"\n[4] STUDENT-SUBJECT ENROLLMENTS: {len(student_enrollments)} records found.")
    seen_s_keys = set()
    for se in student_enrollments:
        sid_user = se.get("student_id")
        subj_id = se.get("subject_id")
        term = se.get("academic_term")
        status = se.get("status")

        if not isinstance(sid_user, ObjectId) or sid_user not in user_map:
            issues.append(f"Student enrollment {se['_id']} references invalid/missing student_id: {sid_user}")
        elif sid_user not in students:
            issues.append(f"Student enrollment {se['_id']} references user {sid_user} whose role is not student ({user_map[sid_user].get('role')})")

        if not isinstance(subj_id, ObjectId) or subj_id not in subject_ids:
            issues.append(f"Student enrollment {se['_id']} references invalid/missing subject_id: {subj_id}")

        if not term or not isinstance(term, str) or not term.strip():
            issues.append(f"Student enrollment {se['_id']} has invalid academic_term: {term}")

        if status not in ("active", "inactive", "dropped"):
            issues.append(f"Student enrollment {se['_id']} has non-standard status: {status}")

        key = (sid_user, subj_id, term)
        if key in seen_s_keys:
            issues.append(f"Duplicate student enrollment found: student {sid_user}, subject {subj_id}, term '{term}'")
        seen_s_keys.add(key)

    # 5. Predictions Collection
    predictions = list(db.predictions.find())
    print(f"\n[5] PREDICTIONS: {len(predictions)} records found.")
    preds_missing_subject_id = 0
    preds_with_unknown_subject = 0
    for p in predictions:
        stu_id = p.get("student_id")
        if not isinstance(stu_id, ObjectId) or stu_id not in user_map:
            issues.append(f"Prediction {p['_id']} has invalid/missing student_id: {stu_id}")

        subj_id = p.get("subject_id")
        subj_str = p.get("subject")
        if subj_id:
            if not isinstance(subj_id, ObjectId) or subj_id not in subject_ids:
                issues.append(f"Prediction {p['_id']} has invalid subject_id: {subj_id}")
        else:
            preds_missing_subject_id += 1

        if subj_str not in subject_names:
            preds_with_unknown_subject += 1

        # Check milestone values
        m = p.get("milestone")
        if m not in (0, 1, 2):
            issues.append(f"Prediction {p['_id']} has non-standard milestone: {m}")

    print(f"  - Total predictions: {len(predictions)}")
    print(f"  - Predictions without subject_id: {preds_missing_subject_id}")
    print(f"  - Predictions with subject name not in catalog: {preds_with_unknown_subject}")

    # 6. Legacy teacher_student_assignments
    legacy_count = db.teacher_student_assignments.count_documents({})
    print(f"\n[6] LEGACY ASSIGNMENTS (teacher_student_assignments): {legacy_count} records preserved.")

    # 7. Summary
    print("\n" + "=" * 70)
    print(f"INTEGRITY AUDIT SUMMARY:")
    if issues:
        print(f"CRITICAL ISSUES FOUND ({len(issues)}):")
        for iss in issues:
            print(f"  [!] {iss}")
    else:
        print("PERFECT INTEGRITY: 0 issues, 0 orphaned references, 0 duplicates.")
    print("=" * 70)

if __name__ == "__main__":
    run_audit()
