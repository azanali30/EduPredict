"""
EduPredict - Prediction Record Model
Module: backend.models.prediction_model
Defines domain entity and validation for student academic predictions in MongoDB.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
from bson import ObjectId
from backend.utils.security import to_object_id


class PredictionRecord:
    """Represents a persisted student performance prediction in MongoDB."""

    def __init__(
        self,
        student_id: ObjectId | str,
        subject: str,
        milestone: int,
        predicted_marks: float,
        predicted_status: str,
        confidence_scores: Dict[str, float],
        top_confidence: float,
        created_by: ObjectId | str,
        features_summary: Dict[str, Any],
        regressor_model: str,
        classifier_model: str,
        confidence_type: str = "Uncalibrated model confidence estimate based on tree ensemble leaf vote proportions",
        uncertainty_warning: bool = False,
        uncertainty_message: Optional[str] = None,
        early_warning_advisory: Optional[Dict[str, Any]] = None,
        subject_id: Optional[ObjectId | str] = None,
        academic_term: Optional[str] = None,
        record_id: Optional[ObjectId | str] = None,
        created_at: Optional[datetime] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.student_id = to_object_id(student_id)
        if not self.student_id:
            raise ValueError("Valid student_id is required for prediction record.")

        self.created_by = to_object_id(created_by) or self.student_id
        self.subject = str(subject).strip()
        self.subject_id = to_object_id(subject_id)
        self.academic_term = str(academic_term).strip() if academic_term else None
        self.milestone = int(milestone)
        if self.milestone not in (0, 1, 2):
            raise ValueError(f"Invalid milestone {self.milestone}. Must be 0, 1, or 2.")

        self.predicted_marks = float(round(predicted_marks, 2))
        self.predicted_status = str(predicted_status).strip()
        self.confidence_scores = confidence_scores or {}
        self.top_confidence = float(round(top_confidence, 4))
        self.confidence_type = confidence_type
        self.uncertainty_warning = bool(uncertainty_warning)
        self.uncertainty_message = uncertainty_message
        self.early_warning_advisory = early_warning_advisory
        self.features_summary = features_summary or {}
        self.regressor_model = str(regressor_model)
        self.classifier_model = str(classifier_model)
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_doc(self) -> Dict[str, Any]:
        """Convert domain entity to BSON document for MongoDB storage."""
        return {
            "_id": self.id,
            "student_id": self.student_id,
            "created_by": self.created_by,
            "subject": self.subject,
            "subject_id": self.subject_id,
            "academic_term": self.academic_term,
            "milestone": self.milestone,
            "predicted_marks": self.predicted_marks,
            "predicted_status": self.predicted_status,
            "confidence_scores": self.confidence_scores,
            "top_confidence": self.top_confidence,
            "confidence_type": self.confidence_type,
            "uncertainty_warning": self.uncertainty_warning,
            "uncertainty_message": self.uncertainty_message,
            "early_warning_advisory": self.early_warning_advisory,
            "features_summary": self.features_summary,
            "regressor_model": self.regressor_model,
            "classifier_model": self.classifier_model,
            "created_at": self.created_at,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert domain entity to JSON-serializable dictionary."""
        return {
            "id": str(self.id),
            "student_id": str(self.student_id),
            "created_by": str(self.created_by),
            "subject": self.subject,
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "academic_term": self.academic_term,
            "milestone": self.milestone,
            "predicted_marks": self.predicted_marks,
            "predicted_status": self.predicted_status,
            "confidence_scores": self.confidence_scores,
            "top_confidence": self.top_confidence,
            "confidence_type": self.confidence_type,
            "uncertainty_warning": self.uncertainty_warning,
            "uncertainty_message": self.uncertainty_message,
            "early_warning_advisory": self.early_warning_advisory,
            "features_summary": self.features_summary,
            "regressor_model": self.regressor_model,
            "classifier_model": self.classifier_model,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["PredictionRecord"]:
        """Instantiate domain entity from MongoDB document."""
        if not doc:
            return None
        return cls(
            record_id=doc.get("_id"),
            student_id=doc.get("student_id"),
            created_by=doc.get("created_by"),
            subject=doc.get("subject", ""),
            milestone=doc.get("milestone", 0),
            predicted_marks=doc.get("predicted_marks", 0.0),
            predicted_status=doc.get("predicted_status", ""),
            confidence_scores=doc.get("confidence_scores", {}),
            top_confidence=doc.get("top_confidence", 0.0),
            confidence_type=doc.get(
                "confidence_type",
                "Uncalibrated model confidence estimate based on tree ensemble leaf vote proportions",
            ),
            uncertainty_warning=doc.get("uncertainty_warning", False),
            uncertainty_message=doc.get("uncertainty_message"),
            early_warning_advisory=doc.get("early_warning_advisory"),
            subject_id=doc.get("subject_id"),
            academic_term=doc.get("academic_term"),
            features_summary=doc.get("features_summary", {}),
            regressor_model=doc.get("regressor_model", ""),
            classifier_model=doc.get("classifier_model", ""),
            created_at=doc.get("created_at"),
        )
