"""
EduPredict - Student Dropout Assessment Record Model (Phase 8A)
Module: backend.models.dropout_record_model
Purpose: Document model representing a student dropout risk prediction and assessment in MongoDB.
"""

from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, Dict, List, Any
from backend.utils.security import to_object_id

VALID_DROPOUT_RISK_TIERS = {"Low", "Moderate", "High"}


class DropoutRecord:
    """Represents a student dropout risk evaluation record in MongoDB."""

    def __init__(
        self,
        student_id: ObjectId | str,
        student_name: Optional[str] = None,
        risk_probability: float = 0.0,
        risk_tier: str = "Low",
        model_version: str = "Dropout_LogisticRegression_v1.0.0",
        key_risk_factors: Optional[List[Dict[str, Any]]] = None,
        protective_factors: Optional[List[Dict[str, Any]]] = None,
        recommendations: Optional[List[str]] = None,
        academic_term: Optional[str] = None,
        organization_id: Optional[str] = None,
        feature_source: str = "academic_record_mapping",
        observed_feature_count: int = 0,
        requires_human_review: bool = True,
        disclaimer: str = (
            "Experimental Early-Warning Benchmark — Not Yet Validated on Local Institutional Outcomes. "
            "Early-warning estimate designed solely for proactive academic support; "
            "requires human review by authorized advisors before taking any intervention."
        ),
        features_snapshot: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        record_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.student_id = to_object_id(student_id)
        if not self.student_id:
            raise ValueError("A valid student_id is required.")
        self.student_name = student_name.strip() if student_name else None
        self.risk_probability = float(np_or_float(risk_probability))
        self.risk_tier = risk_tier if risk_tier in VALID_DROPOUT_RISK_TIERS else "Low"
        self.model_version = str(model_version).strip()
        self.key_risk_factors = key_risk_factors or []
        self.protective_factors = protective_factors or []
        self.recommendations = recommendations or []
        self.academic_term = academic_term.strip() if academic_term else "Current Term"
        self.organization_id = str(organization_id).strip() if organization_id else None
        self.feature_source = feature_source
        self.observed_feature_count = int(observed_feature_count)
        self.requires_human_review = bool(requires_human_review)
        self.disclaimer = disclaimer
        self.features_snapshot = features_snapshot or {}
        now = datetime.now(timezone.utc)
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        """Convert to MongoDB document."""
        doc: Dict[str, Any] = {
            "_id": self.id,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "risk_probability": round(self.risk_probability, 4),
            "risk_tier": self.risk_tier,
            "model_version": self.model_version,
            "key_risk_factors": self.key_risk_factors,
            "protective_factors": self.protective_factors,
            "recommendations": self.recommendations,
            "academic_term": self.academic_term,
            "feature_source": self.feature_source,
            "observed_feature_count": self.observed_feature_count,
            "requires_human_review": self.requires_human_review,
            "disclaimer": self.disclaimer,
            "features_snapshot": self.features_snapshot,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.organization_id is not None:
            doc["organization_id"] = self.organization_id
        return doc

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "id": str(self.id),
            "student_id": str(self.student_id),
            "student_name": self.student_name,
            "risk_probability": round(self.risk_probability, 4),
            "risk_tier": self.risk_tier,
            "model_version": self.model_version,
            "key_risk_factors": self.key_risk_factors,
            "protective_factors": self.protective_factors,
            "recommendations": self.recommendations,
            "academic_term": self.academic_term,
            "organization_id": self.organization_id,
            "feature_source": self.feature_source,
            "observed_feature_count": self.observed_feature_count,
            "requires_human_review": self.requires_human_review,
            "disclaimer": self.disclaimer,
            "features_snapshot": self.features_snapshot,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Dict[str, Any]) -> "DropoutRecord":
        """Instantiate DropoutRecord from MongoDB document."""
        if not doc:
            raise ValueError("Document cannot be None.")
        return cls(
            student_id=doc.get("student_id"),
            student_name=doc.get("student_name"),
            risk_probability=doc.get("risk_probability", 0.0),
            risk_tier=doc.get("risk_tier", "Low"),
            model_version=doc.get("model_version", "Dropout_LogisticRegression_v1.0.0"),
            key_risk_factors=doc.get("key_risk_factors"),
            protective_factors=doc.get("protective_factors"),
            recommendations=doc.get("recommendations"),
            academic_term=doc.get("academic_term"),
            organization_id=doc.get("organization_id"),
            feature_source=doc.get("feature_source", "academic_record_mapping"),
            observed_feature_count=doc.get("observed_feature_count", 0),
            requires_human_review=doc.get("requires_human_review", True),
            disclaimer=doc.get("disclaimer", ""),
            features_snapshot=doc.get("features_snapshot"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
            record_id=doc.get("_id"),
        )


def np_or_float(val: Any) -> float:
    """Safe float conversion for numpy primitives."""
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0
