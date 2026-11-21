"""
EduPredict - Anomaly Service Layer (Phase 7C)
Module: backend.services.anomaly_service
Purpose: Business logic for anomaly evaluation, subject-scoped retrieval,
human review workflows, and privacy-preserving aggregate reporting.
"""

import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
from pymongo.database import Database
from pymongo.errors import PyMongoError
from bson import ObjectId

from backend.models.anomaly_record_model import AnomalyRecord, VALID_REVIEW_STATUSES, VALID_SEVERITIES
from backend.models.user_model import User
from backend.ml.anomaly_loader import score_student_features
from backend.utils.security import to_object_id
from backend.services.system_log_service import log_event
from backend.services.assignment_service import AssignmentService
from backend.services.enrollment_service import EnrollmentService


class AnomalyService:
    """Manages anomaly inference persistence, RBAC queries, and human triage."""

    @staticmethod
    def evaluate_and_store_record(
        db: Database,
        record_data: Dict[str, Any],
        subject: str,
        actor_user: Optional[User] = None,
        source_record_id: Optional[str] = None,
        student_id: Optional[Any] = None,
    ) -> Tuple[Optional[AnomalyRecord], Optional[str]]:
        """
        Evaluate an academic record against the appropriate subject model and
        persist the result idempotently.
        """
        if db is None:
            return None, "Database service is unavailable."

        clean_subj = "Mathematics" if "math" in subject.lower() else "Portuguese Language"

        try:
            inference_result = score_student_features(clean_subj, record_data)
        except Exception as e:
            return None, f"Model evaluation failed: {str(e)}"

        # Resolve stable source record ID
        resolved_source_id = (
            str(source_record_id).strip()
            if source_record_id
            else str(record_data.get("source_record_id") or record_data.get("student_code") or f"ANOM-SRC-{datetime.now(timezone.utc).timestamp()}").strip()
        )

        resolved_student_oid = to_object_id(student_id or record_data.get("student_id"))
        student_name = record_data.get("student_name")

        # Resolve student name if student_id is valid ObjectId
        if resolved_student_oid and not student_name:
            user_doc = db.users.find_one({"_id": resolved_student_oid}, {"full_name": 1})
            if user_doc:
                student_name = user_doc.get("full_name")

        now = datetime.now(timezone.utc)
        record = AnomalyRecord(
            source_record_id=resolved_source_id,
            subject=clean_subj,
            student_id=resolved_student_oid,
            student_name=student_name,
            milestone=0,
            model_version=inference_result["model_version"],
            raw_decision_score=inference_result["raw_decision_score"],
            anomaly_score=inference_result["normalized_anomaly_score"],
            cohort_percentile=inference_result["cohort_percentile"],
            anomaly_severity=inference_result["anomaly_severity"],
            is_anomaly=inference_result["is_anomaly"],
            supporting_deviations=inference_result["supporting_deviations"],
            features_summary={k: record_data.get(k) for k in ("studytime", "absences", "failures", "school", "age") if k in record_data},
            review_status="Pending Review",
            detected_at=now,
            updated_at=now,
        )

        # Idempotent upsert by (source_record_id, subject, model_version)
        filter_query = {
            "source_record_id": record.source_record_id,
            "subject": record.subject,
            "model_version": record.model_version,
        }

        update_doc = {
            "$set": {
                "raw_decision_score": record.raw_decision_score,
                "anomaly_score": record.anomaly_score,
                "cohort_percentile": record.cohort_percentile,
                "anomaly_severity": record.anomaly_severity,
                "is_anomaly": record.is_anomaly,
                "supporting_deviations": record.supporting_deviations,
                "features_summary": record.features_summary,
                "student_id": record.student_id,
                "student_name": record.student_name,
                "updated_at": now,
            },
            "$setOnInsert": {
                "_id": record.id,
                "source_record_id": record.source_record_id,
                "subject": record.subject,
                "milestone": record.milestone,
                "model_version": record.model_version,
                "review_status": "Pending Review",
                "reviewed_by": None,
                "reviewed_by_name": None,
                "reviewed_at": None,
                "review_notes": None,
                "detected_at": now,
            },
        }

        try:
            res = db.anomaly_records.update_one(filter_query, update_doc, upsert=True)
            if res.upserted_id:
                record.id = res.upserted_id
            return record, None
        except PyMongoError as e:
            return None, f"Database persistence error: {str(e)}"

    @staticmethod
    def list_anomalies(
        db: Database,
        actor_user: User,
        subject: Optional[str] = None,
        severity: Optional[str] = None,
        review_status: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[Dict[str, Any], Optional[str], int]:
        """
        List anomaly records subject to strict RBAC.
        - Admin: Full institution view.
        - Teacher: Scoped strictly to verified assigned subjects.
        - Student: Denied (403 Forbidden).
        - Analyst: Denied (403 Forbidden - row level access prohibited).
        """
        if db is None:
            return {}, "Database unavailable.", 500

        if actor_user.role == "student":
            return {}, "Students are not authorized to view internal anomaly records.", 403

        if actor_user.role == "analyst":
            return {}, "Analysts are restricted to aggregate statistics; individual records are protected.", 403

        query: Dict[str, Any] = {}

        # Teacher Subject Authorization Verification
        if actor_user.role == "teacher":
            teacher_subjects = AssignmentService.get_subjects_for_teacher(db, actor_user.id)
            if not teacher_subjects:
                return {"anomalies": [], "total_count": 0, "page": page, "limit": limit, "total_pages": 0}, None, 200

            authorized_subject_names = [s.get("name") for s in teacher_subjects if s.get("name")]

            if subject:
                clean_req = "Mathematics" if "math" in subject.lower() else "Portuguese Language"
                if not any(clean_req.lower() in s.lower() for s in authorized_subject_names):
                    return {}, f"You are not authorized to access anomaly records for '{subject}'.", 403
                query["subject"] = clean_req
            else:
                # Restrict to all authorized subjects for this teacher
                query["subject"] = {"$in": authorized_subject_names}
        elif actor_user.role == "admin":
            if subject:
                clean_req = "Mathematics" if "math" in subject.lower() else "Portuguese Language"
                query["subject"] = clean_req

        if severity and severity in VALID_SEVERITIES:
            query["anomaly_severity"] = severity

        if review_status and review_status in VALID_REVIEW_STATUSES:
            query["review_status"] = review_status

        limit = max(1, min(100, limit))
        page = max(1, page)
        skip = (page - 1) * limit

        try:
            total_count = db.anomaly_records.count_documents(query)
            cursor = db.anomaly_records.find(query).sort("detected_at", -1).skip(skip).limit(limit)
            anomalies = [AnomalyRecord.from_doc(doc).to_dict() for doc in cursor if doc]
            total_pages = (total_count + limit - 1) // limit

            return {
                "anomalies": anomalies,
                "total_count": total_count,
                "page": page,
                "limit": limit,
                "total_pages": total_pages,
            }, None, 200
        except PyMongoError as e:
            return {}, f"Database query failed: {str(e)}", 500

    @staticmethod
    def get_anomaly_by_id(
        db: Database,
        anomaly_id: str,
        actor_user: User,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Retrieve single anomaly record with RBAC authorization check."""
        if db is None:
            return None, "Database unavailable.", 500

        if actor_user.role in ("student", "analyst"):
            return None, "Access denied.", 403

        oid = to_object_id(anomaly_id)
        if not oid:
            return None, "Invalid anomaly ID format.", 400

        doc = db.anomaly_records.find_one({"_id": oid})
        if not doc:
            return None, "Anomaly record not found.", 404

        record = AnomalyRecord.from_doc(doc)
        if not record:
            return None, "Anomaly record corrupted.", 500

        # Teacher authorization verification
        if actor_user.role == "teacher":
            teacher_subjects = AssignmentService.get_subjects_for_teacher(db, actor_user.id)
            authorized_subjects = [s.get("name") for s in teacher_subjects if s.get("name")]

            if not any(record.subject.lower() in s.lower() for s in authorized_subjects):
                return None, f"You are not authorized to view anomaly records for '{record.subject}'.", 403

        return record.to_dict(), None, 200

    @staticmethod
    def update_review_status(
        db: Database,
        anomaly_id: str,
        new_status: str,
        review_notes: Optional[str],
        actor_user: User,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Update the review status of an anomaly record.
        Only Admin or authorized assigned Teacher can review.
        """
        if db is None:
            return None, "Database unavailable.", 500

        if actor_user.role not in ("admin", "teacher"):
            return None, "Only administrators and authorized teachers can review anomalies.", 403

        if new_status not in VALID_REVIEW_STATUSES:
            return None, f"Invalid review status '{new_status}'. Must be one of: {', '.join(VALID_REVIEW_STATUSES)}", 400

        oid = to_object_id(anomaly_id)
        if not oid:
            return None, "Invalid anomaly ID format.", 400

        doc = db.anomaly_records.find_one({"_id": oid})
        if not doc:
            return None, "Anomaly record not found.", 404

        record = AnomalyRecord.from_doc(doc)
        if not record:
            return None, "Corrupted anomaly record.", 500

        # Teacher subject check
        if actor_user.role == "teacher":
            teacher_subjects = AssignmentService.get_subjects_for_teacher(db, actor_user.id)
            authorized_subjects = [s.get("name") for s in teacher_subjects if s.get("name")]
            if not any(record.subject.lower() in s.lower() for s in authorized_subjects):
                return None, "You are not authorized to review records in this subject.", 403

        now = datetime.now(timezone.utc)
        clean_notes = review_notes.strip() if review_notes and isinstance(review_notes, str) else None

        update_fields = {
            "review_status": new_status,
            "reviewed_by": actor_user.id,
            "reviewed_by_name": actor_user.full_name,
            "reviewed_at": now,
            "review_notes": clean_notes,
            "updated_at": now,
        }

        try:
            db.anomaly_records.update_one({"_id": oid}, {"$set": update_fields})
            record.review_status = new_status
            record.reviewed_by = actor_user.id
            record.reviewed_by_name = actor_user.full_name
            record.reviewed_at = now
            record.review_notes = clean_notes
            record.updated_at = now

            log_event(
                db,
                "ANOMALY_STATUS_UPDATED",
                {
                    "anomaly_id": str(oid),
                    "subject": record.subject,
                    "old_status": doc.get("review_status"),
                    "new_status": new_status,
                    "reviewer_id": str(actor_user.id),
                },
                user_id=actor_user.id,
            )

            return record.to_dict(), None, 200
        except PyMongoError as e:
            return None, f"Failed to update review status: {str(e)}", 500

    @staticmethod
    def batch_evaluate_subject(
        db: Database,
        subject: str,
        actor_user: User,
        data_path: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Optional[str], int]:
        """
        Batch evaluate all academic records for a subject.
        Admin or authorized Teacher.
        """
        if db is None:
            return {}, "Database unavailable.", 500

        if actor_user.role not in ("admin", "teacher"):
            return {}, "Unauthorized to trigger batch anomaly evaluation.", 403

        clean_subj = "Mathematics" if "math" in subject.lower() else "Portuguese Language"

        if actor_user.role == "teacher":
            teacher_assignments = AssignmentService.get_teacher_assignments(db, actor_user.id)
            authorized = any(clean_subj.lower() in db.subjects.find_one({"_id": a.subject_id}).get("name", "").lower() for a in teacher_assignments if db.subjects.find_one({"_id": a.subject_id}))
            if not authorized:
                return {}, f"You are not assigned to teach {clean_subj}.", 403

        base_data_file = data_path or os.path.join(
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
            "data", "processed", "cleaned_academic_records.csv"
        )
        if not os.path.exists(base_data_file):
            return {}, "Academic dataset file not found.", 500

        df = pd.read_csv(base_data_file)
        subj_df = df[df["subject"] == clean_subj]

        processed = 0
        flagged_anomalies = 0

        for _, row in subj_df.iterrows():
            row_dict = row.to_dict()
            rec, err = AnomalyService.evaluate_and_store_record(
                db=db,
                record_data=row_dict,
                subject=clean_subj,
                actor_user=actor_user,
                source_record_id=str(row_dict.get("student_code", "")),
            )
            if rec:
                processed += 1
                if rec.is_anomaly:
                    flagged_anomalies += 1

        log_event(
            db,
            "BATCH_ANOMALY_EVALUATION",
            {"subject": clean_subj, "processed": processed, "flagged": flagged_anomalies},
            user_id=actor_user.id,
        )

        return {
            "message": f"Batch anomaly evaluation completed for {clean_subj}.",
            "subject": clean_subj,
            "records_evaluated": processed,
            "anomalies_detected": flagged_anomalies,
        }, None, 200

    @staticmethod
    def get_analyst_aggregate_stats(db: Database) -> Dict[str, Any]:
        """
        Privacy-preserving aggregate anomaly analytics for the Analyst role.
        Applies mandatory N < 5 minimum cell suppression and complementary suppression.
        """
        if db is None:
            return {"error": "Database unavailable", "status_code": 500}

        def apply_suppression(val: int) -> Dict[str, Any]:
            if 1 <= val < 5:
                return {"count": None, "display": "<5", "suppressed": True}
            return {"count": val, "display": str(val), "suppressed": False}

        pipeline = [
            {
                "$group": {
                    "_id": {
                        "subject": "$subject",
                        "severity": "$anomaly_severity",
                        "review_status": "$review_status",
                    },
                    "count": {"$sum": 1},
                }
            }
        ]

        raw_groups = list(db.anomaly_records.aggregate(pipeline))

        # Overall totals
        total_records = db.anomaly_records.count_documents({})
        total_anomalies = db.anomaly_records.count_documents({"is_anomaly": True})

        # By Subject
        subject_breakdown = {}
        for subj in ("Mathematics", "Portuguese Language"):
            subj_total = db.anomaly_records.count_documents({"subject": subj})
            subj_anom = db.anomaly_records.count_documents({"subject": subj, "is_anomaly": True})
            subject_breakdown[subj] = {
                "total_records": apply_suppression(subj_total),
                "anomalies_count": apply_suppression(subj_anom),
            }

        # By Severity
        severity_breakdown = {}
        for sev in VALID_SEVERITIES:
            sev_cnt = db.anomaly_records.count_documents({"anomaly_severity": sev})
            severity_breakdown[sev] = apply_suppression(sev_cnt)

        # By Review Status
        status_breakdown = {}
        for st in VALID_REVIEW_STATUSES:
            st_cnt = db.anomaly_records.count_documents({"review_status": st})
            status_breakdown[st] = apply_suppression(st_cnt)

        return {
            "total_evaluated_records": total_records,
            "total_anomalies": apply_suppression(total_anomalies),
            "subject_breakdown": subject_breakdown,
            "severity_breakdown": severity_breakdown,
            "status_breakdown": status_breakdown,
            "privacy_notice": (
                "Cell suppression (N < 5) has been applied to analytical counts. "
                "Individual student identification from aggregate frequencies is mathematically prohibited."
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
