"""
EduPredict - Anomaly Record Model (Phase 7C)
Module: backend.models.anomaly_record_model
Purpose: Document model representing an unsupervised anomaly detection evaluation.
"""

from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, Dict, List, Any
from backend.utils.security import to_object_id

VALID_REVIEW_STATUSES = {"Pending Review", "Confirmed Anomaly", "Dismissed (Benign)"}
VALID_SEVERITIES = {"High Anomaly", "Moderate Anomaly", "Low / Typical"}


class AnomalyRecord:
    """Represents an anomaly detection observation in MongoDB."""

    def __init__(
        self,
        source_record_id: str,
        subject: str,
        student_id: Optional[ObjectId | str] = None,
        student_name: Optional[str] = None,
        milestone: int = 0,
        model_version: str = "IsolationForest_v1.0.0",
        raw_decision_score: float = 0.0,
        anomaly_score: float = 0.0,
        cohort_percentile: float = 0.0,
        anomaly_severity: str = "Low / Typical",
        is_anomaly: bool = False,
        supporting_deviations: Optional[List[Dict[str, Any]]] = None,
        features_summary: Optional[Dict[str, Any]] = None,
        review_status: str = "Pending Review",
        reviewed_by: Optional[ObjectId | str] = None,
        reviewed_by_name: Optional[str] = None,
        reviewed_at: Optional[datetime] = None,
        review_notes: Optional[str] = None,
        detected_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        record_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.source_record_id = str(source_record_id).strip()
        self.subject = subject.strip()
        self.student_id = to_object_id(student_id) if student_id else None
        self.student_name = student_name.strip() if student_name else None
        self.milestone = int(milestone)
        self.model_version = model_version
        self.raw_decision_score = float(raw_decision_score)
        self.anomaly_score = float(anomaly_score)
        self.cohort_percentile = float(cohort_percentile)
        self.anomaly_severity = anomaly_severity if anomaly_severity in VALID_SEVERITIES else "Low / Typical"
        self.is_anomaly = bool(is_anomaly)
        self.supporting_deviations = supporting_deviations or []
        self.features_summary = features_summary or {}
        self.review_status = review_status if review_status in VALID_REVIEW_STATUSES else "Pending Review"
        self.reviewed_by = to_object_id(reviewed_by) if reviewed_by else None
        self.reviewed_by_name = reviewed_by_name.strip() if reviewed_by_name else None
        self.reviewed_at = reviewed_at
        self.review_notes = review_notes.strip() if review_notes else None

        now = datetime.now(timezone.utc)
        self.detected_at = detected_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> dict:
        """Convert to MongoDB document dictionary."""
        return {
            "_id": self.id,
            "source_record_id": self.source_record_id,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "subject": self.subject,
            "milestone": self.milestone,
            "model_version": self.model_version,
            "raw_decision_score": self.raw_decision_score,
            "anomaly_score": self.anomaly_score,
            "cohort_percentile": self.cohort_percentile,
            "anomaly_severity": self.anomaly_severity,
            "is_anomaly": self.is_anomaly,
            "supporting_deviations": self.supporting_deviations,
            "features_summary": self.features_summary,
            "review_status": self.review_status,
            "reviewed_by": self.reviewed_by,
            "reviewed_by_name": self.reviewed_by_name,
            "reviewed_at": self.reviewed_at,
            "review_notes": self.review_notes,
            "detected_at": self.detected_at,
            "updated_at": self.updated_at,
        }

    def to_dict(self) -> dict:
        """Convert to JSON-safe dictionary for API response."""
        return {
            "id": str(self.id),
            "source_record_id": self.source_record_id,
            "student_id": str(self.student_id) if self.student_id else None,
            "student_name": self.student_name,
            "subject": self.subject,
            "milestone": self.milestone,
            "model_version": self.model_version,
            "raw_decision_score": self.raw_decision_score,
            "anomaly_score": self.anomaly_score,
            "cohort_percentile": self.cohort_percentile,
            "anomaly_severity": self.anomaly_severity,
            "is_anomaly": self.is_anomaly,
            "supporting_deviations": self.supporting_deviations,
            "features_summary": self.features_summary,
            "review_status": self.review_status,
            "reviewed_by": str(self.reviewed_by) if self.reviewed_by else None,
            "reviewed_by_name": self.reviewed_by_name,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "review_notes": self.review_notes,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: dict) -> Optional["AnomalyRecord"]:
        """Reconstruct AnomalyRecord from MongoDB document."""
        if not doc:
            return None
        return cls(
            record_id=doc.get("_id"),
            source_record_id=doc.get("source_record_id", ""),
            student_id=doc.get("student_id"),
            student_name=doc.get("student_name"),
            subject=doc.get("subject", "Mathematics"),
            milestone=doc.get("milestone", 0),
            model_version=doc.get("model_version", "IsolationForest_v1.0.0"),
            raw_decision_score=doc.get("raw_decision_score", 0.0),
            anomaly_score=doc.get("anomaly_score", 0.0),
            cohort_percentile=doc.get("cohort_percentile", 0.0),
            anomaly_severity=doc.get("anomaly_severity", "Low / Typical"),
            is_anomaly=doc.get("is_anomaly", False),
            supporting_deviations=doc.get("supporting_deviations") or [],
            features_summary=doc.get("features_summary") or {},
            review_status=doc.get("review_status", "Pending Review"),
            reviewed_by=doc.get("reviewed_by"),
            reviewed_by_name=doc.get("reviewed_by_name"),
            reviewed_at=doc.get("reviewed_at"),
            review_notes=doc.get("review_notes"),
            detected_at=doc.get("detected_at"),
            updated_at=doc.get("updated_at"),
        )
