"""
EduPredict - ML Model Registry Document Model (Phase 8C)
Module: backend.models.model_registry_model
Purpose: Tracks model versions, training/evaluation metadata, dataset fingerprints,
deployment activation status, and organization scope in MongoDB 6.x.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from backend.utils.security import to_object_id

VALID_MODEL_TYPES = {"dropout_classification", "course_demand_forecasting"}
VALID_MODEL_STATUSES = {
    "experimental",
    "walk_forward_evaluated",
    "benchmark_validated",
    "institutionally_validated",
    "insufficient_data",
}
VALID_DEPLOYMENT_STATUSES = {"active", "inactive", "retired"}


class ModelRegistryEntry:
    """Represents a versioned ML model entry in the EduPredict Model Registry."""

    def __init__(
        self,
        model_name: str,
        model_type: str,
        model_version: str,
        algorithm: str,
        training_dataset_ref: str,
        dataset_fingerprint: str = "",
        training_params: Optional[Dict[str, Any]] = None,
        evaluation_metrics: Optional[Dict[str, Any]] = None,
        validation_methodology: str = "",
        model_status: str = "experimental",
        deployment_status: str = "inactive",
        is_active: bool = False,
        organization_id: Optional[str] = None,
        created_by: Optional[ObjectId | str] = None,
        approval_notes: Optional[str] = None,
        training_timestamp: Optional[str] = None,
        evaluation_timestamp: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        entry_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(entry_id) or ObjectId()
        self.model_name = (model_name or "").strip()
        if not self.model_name:
            raise ValueError("model_name is required.")
        if model_type not in VALID_MODEL_TYPES:
            raise ValueError(f"Invalid model_type '{model_type}'. Allowed: {sorted(VALID_MODEL_TYPES)}")
        self.model_type = model_type
        self.model_version = (model_version or "").strip()
        if not self.model_version:
            raise ValueError("model_version is required.")
        self.algorithm = (algorithm or "").strip()
        self.training_dataset_ref = (training_dataset_ref or "").strip()
        self.dataset_fingerprint = (dataset_fingerprint or "").strip()
        self.training_params = training_params or {}
        self.evaluation_metrics = evaluation_metrics or {}
        self.validation_methodology = (validation_methodology or "").strip()
        self.model_status = model_status if model_status in VALID_MODEL_STATUSES else "experimental"
        self.deployment_status = (
            deployment_status if deployment_status in VALID_DEPLOYMENT_STATUSES else "inactive"
        )
        self.is_active = bool(is_active)
        self.organization_id = str(organization_id).strip() if organization_id else None
        self.created_by = to_object_id(created_by) if created_by else None
        self.approval_notes = approval_notes.strip() if approval_notes else None
        now = datetime.now(timezone.utc)
        self.training_timestamp = training_timestamp or now.isoformat()
        self.evaluation_timestamp = evaluation_timestamp or now.isoformat()
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    def to_doc(self) -> Dict[str, Any]:
        """Convert to MongoDB document."""
        doc: Dict[str, Any] = {
            "_id": self.id,
            "model_name": self.model_name,
            "model_type": self.model_type,
            "model_version": self.model_version,
            "algorithm": self.algorithm,
            "training_dataset_ref": self.training_dataset_ref,
            "dataset_fingerprint": self.dataset_fingerprint,
            "training_params": self.training_params,
            "evaluation_metrics": self.evaluation_metrics,
            "validation_methodology": self.validation_methodology,
            "model_status": self.model_status,
            "deployment_status": self.deployment_status,
            "is_active": self.is_active,
            "approval_notes": self.approval_notes,
            "training_timestamp": self.training_timestamp,
            "evaluation_timestamp": self.evaluation_timestamp,
            "created_by": self.created_by,
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
            "model_name": self.model_name,
            "model_type": self.model_type,
            "model_version": self.model_version,
            "algorithm": self.algorithm,
            "training_dataset_ref": self.training_dataset_ref,
            "dataset_fingerprint": self.dataset_fingerprint,
            "training_params": self.training_params,
            "evaluation_metrics": self.evaluation_metrics,
            "validation_methodology": self.validation_methodology,
            "model_status": self.model_status,
            "deployment_status": self.deployment_status,
            "is_active": self.is_active,
            "organization_id": self.organization_id,
            "approval_notes": self.approval_notes,
            "training_timestamp": self.training_timestamp,
            "evaluation_timestamp": self.evaluation_timestamp,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Dict[str, Any]) -> "ModelRegistryEntry":
        """Instantiate ModelRegistryEntry from MongoDB document."""
        if not doc:
            raise ValueError("Document cannot be None.")
        return cls(
            entry_id=doc.get("_id"),
            model_name=doc.get("model_name", ""),
            model_type=doc.get("model_type", "dropout_classification"),
            model_version=doc.get("model_version", ""),
            algorithm=doc.get("algorithm", ""),
            training_dataset_ref=doc.get("training_dataset_ref", ""),
            dataset_fingerprint=doc.get("dataset_fingerprint", ""),
            training_params=doc.get("training_params", {}),
            evaluation_metrics=doc.get("evaluation_metrics", {}),
            validation_methodology=doc.get("validation_methodology", ""),
            model_status=doc.get("model_status", "experimental"),
            deployment_status=doc.get("deployment_status", "inactive"),
            is_active=doc.get("is_active", False),
            organization_id=doc.get("organization_id"),
            created_by=doc.get("created_by"),
            approval_notes=doc.get("approval_notes"),
            training_timestamp=doc.get("training_timestamp"),
            evaluation_timestamp=doc.get("evaluation_timestamp"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
