"""
EduPredict - Real-Time Stream Event Model (Phase 10)
Module: backend.models.stream_event_model
Purpose: Defines canonical schema for real-time educational events and batch backfill records.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from backend.utils.security import to_object_id

VALID_EVENT_TYPES = {
    "attendance_update",
    "assessment_result",
    "lms_activity",
    "progress_update",
}

VALID_EVENT_STATUSES = {
    "pending",
    "processed",
    "failed",
    "duplicate",
}

VALID_EVENT_SOURCES = {
    "realtime_api",
    "batch_backfill",
    "lms_webhook",
}


class StreamEvent:
    """Represents an educational data stream event in MongoDB `stream_events`."""

    def __init__(
        self,
        event_id: str,
        event_type: str,
        student_id: ObjectId | str,
        subject: str,
        academic_term: str,
        payload: Dict[str, Any],
        source: str = "realtime_api",
        subject_id: Optional[ObjectId | str] = None,
        event_timestamp: Optional[datetime] = None,
        received_at: Optional[datetime] = None,
        processed_at: Optional[datetime] = None,
        processing_latency_ms: Optional[float] = None,
        status: str = "pending",
        retry_count: int = 0,
        error_message: Optional[str] = None,
        is_out_of_order: bool = False,
        has_missing_data: bool = False,
        missing_fields: Optional[List[str]] = None,
        is_backfill: bool = False,
        prediction_id: Optional[str] = None,
        provenance: Optional[Dict[str, Any]] = None,
        record_id: Optional[ObjectId | str] = None,
    ):
        self.id = to_object_id(record_id) or ObjectId()
        self.event_id = str(event_id).strip()
        self.event_type = str(event_type).strip()
        self.student_id = to_object_id(student_id)
        self.subject_id = to_object_id(subject_id) if subject_id else None
        self.subject = str(subject).strip()
        self.academic_term = str(academic_term).strip()
        self.payload = payload if isinstance(payload, dict) else {}
        self.source = source if source in VALID_EVENT_SOURCES else "realtime_api"
        now = datetime.now(timezone.utc)
        self.event_timestamp = event_timestamp or now
        self.received_at = received_at or now
        self.processed_at = processed_at
        self.processing_latency_ms = processing_latency_ms
        self.status = status if status in VALID_EVENT_STATUSES else "pending"
        self.retry_count = int(retry_count or 0)
        self.error_message = error_message
        self.is_out_of_order = bool(is_out_of_order)
        self.has_missing_data = bool(has_missing_data)
        self.missing_fields = list(missing_fields or [])
        self.is_backfill = bool(is_backfill)
        self.prediction_id = prediction_id
        self.provenance = provenance if isinstance(provenance, dict) else {}

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "event_id": self.event_id,
            "event_type": self.event_type,
            "student_id": self.student_id,
            "subject_id": self.subject_id,
            "subject": self.subject,
            "academic_term": self.academic_term,
            "payload": self.payload,
            "source": self.source,
            "event_timestamp": self.event_timestamp,
            "received_at": self.received_at,
            "processed_at": self.processed_at,
            "processing_latency_ms": self.processing_latency_ms,
            "status": self.status,
            "retry_count": self.retry_count,
            "error_message": self.error_message,
            "is_out_of_order": self.is_out_of_order,
            "has_missing_data": self.has_missing_data,
            "missing_fields": self.missing_fields,
            "is_backfill": self.is_backfill,
            "prediction_id": self.prediction_id,
            "provenance": self.provenance,
        }

    def to_dict(self, sanitize_pii: bool = False) -> Dict[str, Any]:
        def _iso(dt: Any) -> Any:
            return dt.isoformat() if isinstance(dt, datetime) else dt

        data: Dict[str, Any] = {
            "id": str(self.id),
            "event_id": self.event_id,
            "event_type": self.event_type,
            "subject_id": str(self.subject_id) if self.subject_id else None,
            "subject": self.subject,
            "academic_term": self.academic_term,
            "source": self.source,
            "event_timestamp": _iso(self.event_timestamp),
            "received_at": _iso(self.received_at),
            "processed_at": _iso(self.processed_at),
            "processing_latency_ms": self.processing_latency_ms,
            "status": self.status,
            "retry_count": self.retry_count,
            "error_message": self.error_message,
            "is_out_of_order": self.is_out_of_order,
            "has_missing_data": self.has_missing_data,
            "missing_fields": self.missing_fields,
            "is_backfill": self.is_backfill,
            "prediction_id": self.prediction_id,
        }
        if not sanitize_pii:
            data["student_id"] = str(self.student_id) if self.student_id else None
            data["payload"] = self.payload
            data["provenance"] = self.provenance
        return data

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> Optional["StreamEvent"]:
        if not doc:
            return None
        return cls(
            record_id=doc.get("_id"),
            event_id=doc.get("event_id", ""),
            event_type=doc.get("event_type", "lms_activity"),
            student_id=doc.get("student_id"),
            subject_id=doc.get("subject_id"),
            subject=doc.get("subject", ""),
            academic_term=doc.get("academic_term", ""),
            payload=doc.get("payload") or {},
            source=doc.get("source", "realtime_api"),
            event_timestamp=doc.get("event_timestamp"),
            received_at=doc.get("received_at"),
            processed_at=doc.get("processed_at"),
            processing_latency_ms=doc.get("processing_latency_ms"),
            status=doc.get("status", "pending"),
            retry_count=doc.get("retry_count", 0),
            error_message=doc.get("error_message"),
            is_out_of_order=doc.get("is_out_of_order", False),
            has_missing_data=doc.get("has_missing_data", False),
            missing_fields=doc.get("missing_fields") or [],
            is_backfill=doc.get("is_backfill", False),
            prediction_id=doc.get("prediction_id"),
            provenance=doc.get("provenance") or {},
        )
