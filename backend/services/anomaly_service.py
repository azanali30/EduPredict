"""
EduPredict - Anomaly Service Layer (Phase 7C & Remediation)
Module: backend.services.anomaly_service
Purpose: Business logic for anomaly evaluation, subject-scoped retrieval,
human review workflows, and privacy-preserving aggregate reporting.
Enforces strict student-subject RBAC, benchmark isolation, and complementary cell suppression.
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
from backend.utils.decorators import can_access_student_subject_data


def apply_complementary_partition_suppression(
    category_counts: Dict[str, int],
    total_count: int,
    threshold: int = 5,
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any]]:
    """
    Applies conservative Statistical Disclosure Control (SDC) cell suppression
    to a categorical partition that sums to total_count.

    Guarantees:
    - Primary suppression for any cell with 1 <= count < threshold (default 5).
    - Conservative multi-cell protection: if ANY cell in a partition is suppressed
      or if total_count < threshold, all non-zero cells and the partition total
      are suppressed (<5) to guarantee that remaining visible cells and marginal
      totals can never reconstruct protected small counts or their combined values.
    - Zero counts (0) are preserved only when safe.
    - If total_count is 0, unsuppressed 0 is returned.
    """
    result: Dict[str, Dict[str, Any]] = {}
    primary_suppressed_keys = [k for k, v in category_counts.items() if 1 <= v < threshold]
    nonzero_keys = [k for k, v in category_counts.items() if v > 0]

    # Initialize basic counts
    for key, val in category_counts.items():
        if val == 0:
            result[key] = {"count": 0, "display": "0", "suppressed": False}
        elif 1 <= val < threshold:
            result[key] = {
                "count": None,
                "display": f"<{threshold}",
                "suppressed": True,
                "suppression_type": "primary",
            }
        else:
            result[key] = {"count": val, "display": str(val), "suppressed": False}

    total_suppressed = False
    total_display = str(total_count)
    total_val: Optional[int] = total_count

    # If the total itself falls below threshold:
    if 1 <= total_count < threshold:
        total_suppressed = True
        total_display = f"<{threshold}"
        total_val = None

    # If any cell is suppressed, or if the total itself is below threshold:
    has_suppression = len(primary_suppressed_keys) > 0 or total_suppressed

    if has_suppression:
        # Conservative suppression rule:
        # Suppress all non-zero cells in this partition to ensure no remaining visible cell
        # can be combined with the marginal total to reveal the hidden small cells or their sum.
        for k in nonzero_keys:
            result[k] = {
                "count": None,
                "display": f"<{threshold}",
                "suppressed": True,
                "suppression_type": "primary" if k in primary_suppressed_keys else "complementary",
            }
        total_suppressed = True
        total_display = f"<{threshold}"
        total_val = None

    # If total itself is 0, nothing is suppressed
    if total_count == 0:
        total_suppressed = False
        total_display = "0"
        total_val = 0

    total_result = {
        "count": total_val,
        "display": total_display,
        "suppressed": total_suppressed,
    }

    return result, total_result


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
        is_benchmark: bool = False,
        academic_term: Optional[str] = None,
    ) -> Tuple[Optional[AnomalyRecord], Optional[str]]:
        """
        Evaluate an academic record against the appropriate subject model and
        persist the result idempotently. Distinguishes benchmark observations
        from real institutional students.
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

        # Distinguish benchmark data from institutional student records
        is_bench = bool(is_benchmark or record_data.get("is_benchmark", False))
        resolved_student_oid = to_object_id(student_id or record_data.get("student_id"))
        student_name = record_data.get("student_name")

        if is_bench or not resolved_student_oid:
            # Benchmark / demo observations do not possess an authenticated user profile
            is_bench = True
            dataset_type = "benchmark"
            resolved_student_oid = None
            student_name = None
        else:
            # Institutional student: verify user exists in users collection
            user_doc = db.users.find_one({"_id": resolved_student_oid}, {"full_name": 1, "role": 1})
            if user_doc:
                student_name = user_doc.get("full_name")
                dataset_type = "institutional"
            else:
                # Student ID does not correspond to an institutional user; treat as benchmark/demo
                is_bench = True
                dataset_type = "benchmark"
                resolved_student_oid = None
                student_name = None

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
            is_benchmark=is_bench,
            dataset_type=dataset_type,
            academic_term=academic_term or record_data.get("academic_term"),
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
                "is_benchmark": record.is_benchmark,
                "dataset_type": record.dataset_type,
                "academic_term": record.academic_term,
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
        is_benchmark: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[Dict[str, Any], Optional[str], int]:
        """
        List anomaly records subject to strict RBAC and student-level authorization.
        - Admin: Full institution view across institutional students and benchmark reference data.
        - Teacher: Scoped strictly to verified assigned subjects AND active enrolled students.
                   Teachers can NEVER view unlinked benchmark data or students not in their roster.
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

        # -------------------------------------------------------------
        # Teacher Student-Level and Subject-Level Scoping
        # -------------------------------------------------------------
        if actor_user.role == "teacher":
            # 1. Fetch teacher's active subject assignments
            t_assignments = list(db.teacher_subject_assignments.find({
                "teacher_id": to_object_id(actor_user.id),
                "status": "active",
            }))
            if not t_assignments:
                # Teacher has no active assigned subjects -> 0 authorized records
                return {"anomalies": [], "total_count": 0, "page": page, "limit": limit, "total_pages": 0}, None, 200

            # 2. Build term-aligned assignment clauses
            authorized_clauses = []
            assigned_subject_names = set()

            for a in t_assignments:
                s_id = a.get("subject_id")
                a_term = a.get("academic_term")
                if not s_id:
                    continue
                subj_doc = db.subjects.find_one({"_id": s_id})
                if not subj_doc or not subj_doc.get("is_active", True):
                    continue
                subj_name = subj_doc.get("name")
                if not subj_name:
                    continue
                assigned_subject_names.add(subj_name)

                if not a_term or not str(a_term).strip():
                    # If assignment has no term, teacher cannot establish term-aligned authority over anomaly records
                    continue
                clean_term = str(a_term).strip()

                # Query active enrollments for this subject and term
                enroll_q: Dict[str, Any] = {"subject_id": s_id, "status": "active", "academic_term": clean_term}
                enrolled_students = [
                    e["student_id"] for e in db.student_subject_enrollments.find(enroll_q)
                    if e.get("student_id")
                ]
                if not enrolled_students:
                    continue

                clause: Dict[str, Any] = {
                    "subject": subj_name,
                    "student_id": {"$in": enrolled_students},
                    "academic_term": clean_term,
                }
                authorized_clauses.append(clause)

            if not authorized_clauses:
                # Teacher has active assignments but no students enrolled in them -> 0 records
                return {"anomalies": [], "total_count": 0, "page": page, "limit": limit, "total_pages": 0}, None, 200

            # 3. Check requested subject filter against assigned subjects
            if subject:
                clean_req = "Mathematics" if "math" in subject.lower() else "Portuguese Language"
                if clean_req not in assigned_subject_names:
                    return {}, f"You are not authorized to access anomaly records for '{subject}'.", 403

                filtered_clauses = [c for c in authorized_clauses if c["subject"] == clean_req]
                if not filtered_clauses:
                    return {"anomalies": [], "total_count": 0, "page": page, "limit": limit, "total_pages": 0}, None, 200
                authorized_clauses = filtered_clauses

            # 4. Integrate into MongoDB query
            if len(authorized_clauses) == 1:
                single_clause = authorized_clauses[0]
                query["subject"] = single_clause["subject"]
                query["student_id"] = single_clause["student_id"]
                query["academic_term"] = single_clause["academic_term"]
            else:
                query["$or"] = authorized_clauses

            # Crucial Security Rule: Teachers NEVER view unlinked benchmark reference data
            query["is_benchmark"] = {"$ne": True}

        elif actor_user.role == "admin":
            if subject:
                clean_req = "Mathematics" if "math" in subject.lower() else "Portuguese Language"
                query["subject"] = clean_req
            if is_benchmark is not None:
                query["is_benchmark"] = bool(is_benchmark)

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

            anomalies = []
            for doc in cursor:
                if not doc:
                    continue
                rec = AnomalyRecord.from_doc(doc)
                if not rec:
                    continue
                # Defense-in-depth: For teachers, verify can_access_student_subject_data
                if actor_user.role == "teacher":
                    if rec.is_benchmark or not rec.student_id or not rec.academic_term or not rec.academic_term.strip():
                        continue
                    if not can_access_student_subject_data(actor_user, rec.student_id, rec.subject, db, academic_term=rec.academic_term, require_term=True):
                        continue
                anomalies.append(rec.to_dict())

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
        """
        Retrieve single anomaly record with strict RBAC and student-subject authorization check.
        """
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

        # Teacher authorization verification: Must be institutional student in teacher's roster
        if actor_user.role == "teacher":
            if record.is_benchmark or not record.student_id:
                return None, "Teachers cannot access benchmark evaluation records.", 403

            if not record.academic_term or not record.academic_term.strip():
                return None, "Legacy anomaly records without an academic term cannot be accessed by teachers. Please contact an administrator.", 403

            if not can_access_student_subject_data(actor_user, record.student_id, record.subject, db, academic_term=record.academic_term, require_term=True):
                return None, "You do not have authorization to view this student's anomaly record.", 403

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
        Only Admin or authorized assigned Teacher with active student enrollment can review.
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

        # Teacher authorization check
        if actor_user.role == "teacher":
            if record.is_benchmark or not record.student_id:
                return None, "Teachers cannot review benchmark evaluation records.", 403

            if not record.academic_term or not record.academic_term.strip():
                return None, "Legacy anomaly records without an academic term cannot be reviewed by teachers. Please contact an administrator.", 403

            if not can_access_student_subject_data(actor_user, record.student_id, record.subject, db, academic_term=record.academic_term, require_term=True):
                return None, "You do not have authorization to review this student's anomaly record.", 403

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
        Batch evaluate academic records for a subject.
        RESTRICTED TO ADMINISTRATORS ONLY.
        Because benchmark CSV rows represent anonymized research datasets that cannot
        be linked to authenticated institutional students, teacher batch execution is rejected.
        """
        if db is None:
            return {}, "Database unavailable.", 500

        # Teacher batch evaluation restriction (Remediation Item 2)
        if actor_user.role != "admin":
            return {}, "Teacher batch evaluation is restricted to enrolled institutional students. Benchmark cohort evaluation is reserved for institutional administrators.", 403

        clean_subj = "Mathematics" if "math" in subject.lower() else "Portuguese Language"

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
                student_id=None,
                is_benchmark=True,
            )
            if rec:
                processed += 1
                if rec.is_anomaly:
                    flagged_anomalies += 1

        log_event(
            db,
            "BATCH_ANOMALY_EVALUATION",
            {"subject": clean_subj, "processed": processed, "flagged": flagged_anomalies, "dataset_type": "benchmark"},
            user_id=actor_user.id,
        )

        return {
            "message": f"Batch benchmark anomaly evaluation completed for {clean_subj}.",
            "subject": clean_subj,
            "dataset_type": "benchmark",
            "records_evaluated": processed,
            "anomalies_detected": flagged_anomalies,
        }, None, 200

    @staticmethod
    def get_analyst_aggregate_stats(db: Database) -> Dict[str, Any]:
        """
        Statistical Disclosure Control (SDC) aggregate anomaly analytics for Analyst role.
        Applies mandatory primary N < 5 cell suppression and complementary (secondary)
        suppression on marginal totals to eliminate differencing and subtraction attacks.
        """
        if db is None:
            return {"error": "Database unavailable", "status_code": 500}

        # Overall totals
        total_records = db.anomaly_records.count_documents({})
        total_anomalies = db.anomaly_records.count_documents({"is_anomaly": True})

        # 1. Subject Breakdown with Complementary Suppression
        subject_anom_counts = {
            "Mathematics": db.anomaly_records.count_documents({"subject": "Mathematics", "is_anomaly": True}),
            "Portuguese Language": db.anomaly_records.count_documents({"subject": "Portuguese Language", "is_anomaly": True}),
        }
        subject_total_counts = {
            "Mathematics": db.anomaly_records.count_documents({"subject": "Mathematics"}),
            "Portuguese Language": db.anomaly_records.count_documents({"subject": "Portuguese Language"}),
        }

        supp_subject_anom, supp_total_anomalies = apply_complementary_partition_suppression(
            subject_anom_counts, total_anomalies, threshold=5
        )
        supp_subject_totals, supp_overall_total = apply_complementary_partition_suppression(
            subject_total_counts, total_records, threshold=5
        )

        # 2. Severity Breakdown with Complementary Suppression
        severity_counts = {
            sev: db.anomaly_records.count_documents({"anomaly_severity": sev})
            for sev in ("High Anomaly", "Moderate Anomaly", "Low / Typical")
        }
        supp_severity, _ = apply_complementary_partition_suppression(
            severity_counts, total_records, threshold=5
        )

        # 3. Review Status Breakdown with Complementary Suppression
        status_counts = {
            st: db.anomaly_records.count_documents({"review_status": st})
            for st in ("Pending Review", "Confirmed Anomaly", "Dismissed (Benign)")
        }
        supp_status, _ = apply_complementary_partition_suppression(
            status_counts, total_records, threshold=5
        )

        # ----------------------------------------------------------------------
        # 4. Cross-Dimension Coupling & Defense-in-Depth Safeguards
        # ----------------------------------------------------------------------
        # A. If the entire institution has fewer than 5 records, suppress all dimensions
        if total_records < 5:
            supp_overall_total = {"count": None, "display": "<5", "suppressed": True, "suppression_type": "primary"}
            supp_total_anomalies = {"count": None, "display": "<5", "suppressed": True, "suppression_type": "primary"}
            for k in supp_severity:
                if severity_counts[k] > 0:
                    supp_severity[k] = {"count": None, "display": "<5", "suppressed": True, "suppression_type": "cross_dimension"}
            for k in supp_status:
                if status_counts[k] > 0:
                    supp_status[k] = {"count": None, "display": "<5", "suppressed": True, "suppression_type": "cross_dimension"}

        # B. If total_anomalies is suppressed, all non-zero categories in severity
        # and status breakdowns must be conservatively suppressed to prevent reconstructing
        # total anomalies through summation or differencing against total_records.
        if supp_total_anomalies["suppressed"]:
            for k in supp_severity:
                if severity_counts[k] > 0:
                    supp_severity[k] = {"count": None, "display": "<5", "suppressed": True, "suppression_type": "cross_dimension"}
            for k in supp_status:
                if status_counts[k] > 0:
                    supp_status[k] = {"count": None, "display": "<5", "suppressed": True, "suppression_type": "cross_dimension"}

        return {
            "total_evaluated_records": supp_overall_total,
            "total_anomalies": supp_total_anomalies,
            "subject_breakdown": {
                "Mathematics": {
                    "total_records": supp_subject_totals["Mathematics"],
                    "anomalies_count": supp_subject_anom["Mathematics"],
                },
                "Portuguese Language": {
                    "total_records": supp_subject_totals["Portuguese Language"],
                    "anomalies_count": supp_subject_anom["Portuguese Language"],
                },
            },
            "severity_breakdown": supp_severity,
            "status_breakdown": supp_status,
            "privacy_notice": (
                "Statistical Disclosure Control (SDC) with primary (N < 5) and complementary cell suppression is active. "
                "Marginal totals and small-cohort frequencies are protected against subtraction and differencing attacks."
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
