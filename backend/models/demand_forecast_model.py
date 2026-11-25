"""
EduPredict - Course Demand Forecast Record Model (Phase 8B)
Module: backend.models.demand_forecast_model
Purpose: Document model representing persisted course/subject enrollment demand forecasts
and model evaluation metadata in MongoDB 6.x.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from backend.utils.security import to_object_id

VALID_DEMAND_TIERS = {"High Demand", "Moderate Demand", "Low Demand", "Unclassified", "Insufficient Data"}
VALID_VALIDATION_STATUSES = {
    "institutionally_validated",
    "walk_forward_evaluated",
    "experimental",
    "baseline",
    "insufficient_data",
    "validated",  # Backward compatibility for previously saved records
}


class DemandForecastRecord:
    """Represents a course/subject enrollment demand forecast snapshot in MongoDB."""

    def __init__(
        self,
        subject_id: ObjectId | str,
        subject_code: str,
        subject_name: str,
        forecast_period: str,
        predicted_enrollment: float,
        periods_ahead: int = 1,
        department: str = "",
        organization_id: Optional[str] = None,
        historical_series: Optional[List[Dict[str, Any]]] = None,
        latest_actual_enrollment: Optional[int] = None,
        confidence_lower: Optional[float] = None,
        confidence_upper: Optional[float] = None,
        confidence_level: str = "Low (Heuristic)",
        interval_type: str = "heuristic_residual_band",
        is_calibrated_confidence_interval: bool = False,
        growth_rate_pct: Optional[float] = None,
        trend_direction: str = "Insufficient Data",
        demand_tier: str = "Insufficient Data",
        capacity: Optional[int] = None,
        utilization_pct: Optional[float] = None,
        model_used: str = "BaselineMovingAverage",
        validation_status: str = "baseline",
        data_sufficiency: str = "insufficient",
        evaluation_metrics: Optional[Dict[str, Any]] = None,
        disclaimer: str = (
            "Estimated enrollment demand for academic planning only — not confirmed registration. "
            "Requires administrative review."
        ),
        created_by: Optional[ObjectId | str] = None,
        created_at: Optional[datetime] = None,
        record_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.subject_id = to_object_id(subject_id)
        if not self.subject_id:
            raise ValueError("Valid subject_id is required.")
        self.subject_code = (subject_code or "").strip().upper()
        self.subject_name = (subject_name or "").strip()
        self.department = (department or "").strip()
        self.organization_id = str(organization_id).strip() if organization_id else None
        self.forecast_period = (forecast_period or "Next Term").strip()
        self.periods_ahead = max(1, int(periods_ahead))
        self.historical_series = historical_series or []
        self.latest_actual_enrollment = (
            int(latest_actual_enrollment) if latest_actual_enrollment is not None else None
        )
        self.predicted_enrollment = max(0.0, float(predicted_enrollment))
        self.confidence_lower = (
            max(0.0, float(confidence_lower)) if confidence_lower is not None else None
        )
        self.confidence_upper = (
            max(0.0, float(confidence_upper)) if confidence_upper is not None else None
        )
        self.confidence_level = confidence_level
        self.interval_type = interval_type
        self.is_calibrated_confidence_interval = bool(is_calibrated_confidence_interval)
        self.growth_rate_pct = (
            round(float(growth_rate_pct), 2) if growth_rate_pct is not None else None
        )
        self.trend_direction = trend_direction
        self.demand_tier = demand_tier if demand_tier in VALID_DEMAND_TIERS else "Insufficient Data"
        self.capacity = int(capacity) if capacity is not None else None
        self.utilization_pct = (
            round(float(utilization_pct), 2) if utilization_pct is not None else None
        )
        self.model_used = model_used
        self.validation_status = (
            validation_status if validation_status in VALID_VALIDATION_STATUSES else "baseline"
        )
        self.data_sufficiency = data_sufficiency
        self.evaluation_metrics = evaluation_metrics or {}
        self.disclaimer = disclaimer
        self.created_by = to_object_id(created_by) if created_by else None
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_doc(self) -> Dict[str, Any]:
        """Convert to MongoDB document."""
        doc: Dict[str, Any] = {
            "_id": self.id,
            "subject_id": self.subject_id,
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "department": self.department,
            "forecast_period": self.forecast_period,
            "periods_ahead": self.periods_ahead,
            "historical_series": self.historical_series,
            "latest_actual_enrollment": self.latest_actual_enrollment,
            "predicted_enrollment": round(self.predicted_enrollment, 2),
            "confidence_lower": round(self.confidence_lower, 2) if self.confidence_lower is not None else None,
            "confidence_upper": round(self.confidence_upper, 2) if self.confidence_upper is not None else None,
            "confidence_level": self.confidence_level,
            "interval_type": self.interval_type,
            "is_calibrated_confidence_interval": self.is_calibrated_confidence_interval,
            "growth_rate_pct": self.growth_rate_pct,
            "trend_direction": self.trend_direction,
            "demand_tier": self.demand_tier,
            "capacity": self.capacity,
            "utilization_pct": self.utilization_pct,
            "model_used": self.model_used,
            "validation_status": self.validation_status,
            "data_sufficiency": self.data_sufficiency,
            "evaluation_metrics": self.evaluation_metrics,
            "disclaimer": self.disclaimer,
            "created_by": self.created_by,
            "created_at": self.created_at,
        }
        if self.organization_id is not None:
            doc["organization_id"] = self.organization_id
        return doc

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "id": str(self.id),
            "subject_id": str(self.subject_id),
            "subject_code": self.subject_code,
            "subject_name": self.subject_name,
            "department": self.department,
            "organization_id": self.organization_id,
            "forecast_period": self.forecast_period,
            "periods_ahead": self.periods_ahead,
            "historical_series": self.historical_series,
            "latest_actual_enrollment": self.latest_actual_enrollment,
            "predicted_enrollment": round(self.predicted_enrollment, 2),
            "confidence_lower": round(self.confidence_lower, 2) if self.confidence_lower is not None else None,
            "confidence_upper": round(self.confidence_upper, 2) if self.confidence_upper is not None else None,
            "confidence_level": self.confidence_level,
            "interval_type": self.interval_type,
            "is_calibrated_confidence_interval": self.is_calibrated_confidence_interval,
            "growth_rate_pct": self.growth_rate_pct,
            "trend_direction": self.trend_direction,
            "demand_tier": self.demand_tier,
            "capacity": self.capacity,
            "utilization_pct": self.utilization_pct,
            "model_used": self.model_used,
            "validation_status": self.validation_status,
            "data_sufficiency": self.data_sufficiency,
            "evaluation_metrics": self.evaluation_metrics,
            "disclaimer": self.disclaimer,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    @classmethod
    def from_doc(cls, doc: Dict[str, Any]) -> "DemandForecastRecord":
        """Instantiate DemandForecastRecord from MongoDB document."""
        if not doc:
            raise ValueError("Document cannot be None.")
        return cls(
            record_id=doc.get("_id"),
            subject_id=doc.get("subject_id"),
            subject_code=doc.get("subject_code", ""),
            subject_name=doc.get("subject_name", ""),
            department=doc.get("department", ""),
            organization_id=doc.get("organization_id"),
            forecast_period=doc.get("forecast_period", "Next Term"),
            periods_ahead=doc.get("periods_ahead", 1),
            historical_series=doc.get("historical_series", []),
            latest_actual_enrollment=doc.get("latest_actual_enrollment"),
            predicted_enrollment=doc.get("predicted_enrollment", 0.0),
            confidence_lower=doc.get("confidence_lower"),
            confidence_upper=doc.get("confidence_upper"),
            confidence_level=doc.get("confidence_level", "Low (Heuristic)"),
            interval_type=doc.get("interval_type", "heuristic_residual_band"),
            is_calibrated_confidence_interval=doc.get("is_calibrated_confidence_interval", False),
            growth_rate_pct=doc.get("growth_rate_pct"),
            trend_direction=doc.get("trend_direction", "Insufficient Data"),
            demand_tier=doc.get("demand_tier", "Insufficient Data"),
            capacity=doc.get("capacity"),
            utilization_pct=doc.get("utilization_pct"),
            model_used=doc.get("model_used", "BaselineMovingAverage"),
            validation_status=doc.get("validation_status", "baseline"),
            data_sufficiency=doc.get("data_sufficiency", "insufficient"),
            evaluation_metrics=doc.get("evaluation_metrics", {}),
            disclaimer=doc.get("disclaimer", ""),
            created_by=doc.get("created_by"),
            created_at=doc.get("created_at"),
        )
