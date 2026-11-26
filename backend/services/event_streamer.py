"""
EduPredict - Real-Time Event Streaming Service (Phase 10)
Module: backend.services.event_streamer
Purpose: Validates, deduplicates, orders, processes, and broadcasts educational
data stream events (attendance, assessments, LMS activity, progress updates)
using MongoDB 6.x persistence and in-process SSE queues.
"""

import json
import logging
import queue
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Generator, List, Optional, Tuple
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError, PyMongoError

from backend.models.stream_event_model import (
    StreamEvent,
    VALID_EVENT_SOURCES,
    VALID_EVENT_TYPES,
)
from backend.services.system_log_service import log_event
from backend.utils.security import to_object_id

logger = logging.getLogger(__name__)

# Required & optional payload fields per event_type
EVENT_PAYLOAD_RULES: Dict[str, Dict[str, Any]] = {
    "attendance_update": {
        "required": ["absences"],
        "optional": ["attendance_rate", "session_date"],
        "numeric_ranges": {"absences": (0, 365), "attendance_rate": (0.0, 100.0)},
    },
    "assessment_result": {
        "required": ["score", "max_score"],
        "optional": ["milestone", "g1", "g2", "assessment_name"],
        "numeric_ranges": {"score": (0.0, 100.0), "max_score": (1.0, 100.0), "g1": (0.0, 20.0), "g2": (0.0, 20.0)},
    },
    "lms_activity": {
        "required": ["activity_minutes"],
        "optional": ["resource_type", "studytime", "interactions"],
        "numeric_ranges": {"activity_minutes": (0, 1440), "studytime": (1, 4), "interactions": (0, 10000)},
    },
    "progress_update": {
        "required": ["completion_pct"],
        "optional": ["milestone", "failures", "studytime"],
        "numeric_ranges": {"completion_pct": (0.0, 100.0), "failures": (0, 10), "studytime": (1, 4)},
    },
}


class SSEBroadcaster:
    """Thread-safe in-process pub/sub broadcaster for Server-Sent Events (SSE)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: List[queue.Queue] = []

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def publish(self, event_dict: Dict[str, Any]) -> None:
        with self._lock:
            dead: List[queue.Queue] = []
            for q in self._subscribers:
                try:
                    q.put_nowait(event_dict)
                except queue.Full:
                    dead.append(q)
            for d in dead:
                self._subscribers.remove(d)


broadcaster = SSEBroadcaster()


def _parse_event_timestamp(raw_ts: Any) -> Tuple[Optional[datetime], Optional[str]]:
    if raw_ts is None:
        return datetime.now(timezone.utc), None
    if isinstance(raw_ts, datetime):
        if raw_ts.tzinfo is None:
            return raw_ts.replace(tzinfo=timezone.utc), None
        return raw_ts.astimezone(timezone.utc), None
    if isinstance(raw_ts, str) and raw_ts.strip():
        try:
            iso_str = raw_ts.strip().replace("Z", "+00:00")
            parsed = datetime.fromisoformat(iso_str)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc), None
        except ValueError:
            return None, f"Invalid ISO-8601 event_timestamp: '{raw_ts}'."
    return None, "event_timestamp must be a valid ISO-8601 string or datetime."


class EventStreamer:
    """
    Core real-time educational event ingestion and stream processing service.
    Delivery guarantee: at-least-once ingestion with idempotent event_id deduplication.
    """

    @classmethod
    def validate_event_payload(
        cls, raw_event: Dict[str, Any]
    ) -> Tuple[Optional[Dict[str, Any]], List[str], Optional[str]]:
        """
        Validate incoming event envelope and payload schema.
        Gracefully detects missing optional/nullable fields without crashing,
        while rejecting malformed types or out-of-range values.
        Returns: (cleaned_data, missing_fields, error_message)
        """
        if not isinstance(raw_event, dict):
            return None, [], "Event payload must be a JSON object."

        event_id = raw_event.get("event_id")
        if not isinstance(event_id, str) or not event_id.strip():
            return None, [], "Required field 'event_id' must be a non-empty string."

        event_type = raw_event.get("event_type")
        if not isinstance(event_type, str) or event_type.strip() not in VALID_EVENT_TYPES:
            return (
                None,
                [],
                f"Invalid 'event_type'. Must be one of: {', '.join(sorted(VALID_EVENT_TYPES))}.",
            )
        clean_type = event_type.strip()

        student_oid = to_object_id(raw_event.get("student_id"))
        if not student_oid:
            return None, [], "Required field 'student_id' must be a valid ObjectId."

        subject = raw_event.get("subject")
        if not isinstance(subject, str) or not subject.strip():
            return None, [], "Required field 'subject' must be a non-empty string."

        academic_term = raw_event.get("academic_term")
        if not isinstance(academic_term, str) or not academic_term.strip():
            return None, [], "Required field 'academic_term' must be a non-empty string."

        event_ts, ts_err = _parse_event_timestamp(raw_event.get("event_timestamp"))
        if ts_err:
            return None, [], ts_err

        source = str(raw_event.get("source") or "realtime_api").strip()
        if source not in VALID_EVENT_SOURCES:
            return None, [], f"Invalid 'source'. Must be one of: {', '.join(sorted(VALID_EVENT_SOURCES))}."

        payload = raw_event.get("payload")
        if not isinstance(payload, dict):
            return None, [], "Required field 'payload' must be a JSON object."

        rules = EVENT_PAYLOAD_RULES[clean_type]
        missing_fields: List[str] = []
        cleaned_payload: Dict[str, Any] = dict(payload)

        # Check required fields: if completely absent -> reject; if explicitly None -> mark incomplete
        for req_field in rules["required"]:
            if req_field not in payload:
                return None, [], f"Missing required payload field '{req_field}' for '{clean_type}'."
            if payload[req_field] is None or payload[req_field] == "":
                missing_fields.append(req_field)

        # Check optional fields for missingness tracking only if explicitly provided as null/empty
        for opt_field in rules["optional"]:
            if opt_field in payload and (payload[opt_field] is None or payload[opt_field] == ""):
                missing_fields.append(opt_field)

        # Validate numeric ranges for any non-null numeric fields
        for num_field, (min_val, max_val) in rules["numeric_ranges"].items():
            val = payload.get(num_field)
            if val is not None and val != "":
                if isinstance(val, bool) or not isinstance(val, (int, float)):
                    return None, [], f"Payload field '{num_field}' must be numeric."
                if val < min_val or val > max_val:
                    return (
                        None,
                        [],
                        f"Payload field '{num_field}'={val} is out of valid range [{min_val}, {max_val}].",
                    )

        # Special assessment check: score cannot exceed max_score
        if clean_type == "assessment_result":
            sc = payload.get("score")
            mx = payload.get("max_score")
            if sc is not None and mx is not None and isinstance(sc, (int, float)) and isinstance(mx, (int, float)):
                if sc > mx:
                    return None, [], "Assessment 'score' cannot exceed 'max_score'."

        cleaned = {
            "event_id": event_id.strip(),
            "event_type": clean_type,
            "student_id": student_oid,
            "subject_id": to_object_id(raw_event.get("subject_id")),
            "subject": subject.strip(),
            "academic_term": academic_term.strip(),
            "payload": cleaned_payload,
            "source": source,
            "event_timestamp": event_ts,
            "is_backfill": bool(raw_event.get("is_backfill", False)) or source == "batch_backfill",
        }
        return cleaned, missing_fields, None

    @classmethod
    def ingest_event(
        cls,
        db: Database,
        raw_event: Dict[str, Any],
        actor_user: Any = None,
        simulate_transient_failure: bool = False,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Ingest, deduplicate, order-check, and process a single real-time event.
        Returns: (response_dict, error_message, http_status)
        """
        if db is None:
            return None, "Database service unavailable.", 500

        t_start = time.perf_counter()
        cleaned, missing_fields, val_err = cls.validate_event_payload(raw_event)
        if val_err or cleaned is None:
            return None, val_err or "Invalid event.", 400

        # Verify student exists in single institution
        student_doc = db.users.find_one({"_id": cleaned["student_id"], "role": "student"}, {"_id": 1})
        if not student_doc:
            return None, "Referenced student_id does not exist.", 404

        # Check idempotency before insert
        existing = db.stream_events.find_one({"event_id": cleaned["event_id"]})
        if existing:
            return {
                "status": "duplicate_ignored",
                "event": StreamEvent.from_doc(existing).to_dict(sanitize_pii=True),
            }, None, 200

        # Detect out-of-order events relative to latest processed event of same stream key
        latest_same = db.stream_events.find_one(
            {
                "student_id": cleaned["student_id"],
                "subject": cleaned["subject"],
                "event_type": cleaned["event_type"],
                "status": "processed",
            },
            sort=[("event_timestamp", DESCENDING)],
        )
        is_out_of_order = False
        if latest_same and latest_same.get("event_timestamp"):
            prev_ts = latest_same["event_timestamp"]
            if prev_ts.tzinfo is None:
                prev_ts = prev_ts.replace(tzinfo=timezone.utc)
            if cleaned["event_timestamp"] < prev_ts:
                is_out_of_order = True

        has_missing_data = len(missing_fields) > 0
        provenance = {
            "actor_id": str(getattr(actor_user, "id", "")) if actor_user else "system",
            "actor_role": getattr(actor_user, "role", "system") if actor_user else "system",
            "ingest_channel": cleaned["source"],
            "schema_version": "10.0",
        }

        event = StreamEvent(
            event_id=cleaned["event_id"],
            event_type=cleaned["event_type"],
            student_id=cleaned["student_id"],
            subject_id=cleaned["subject_id"],
            subject=cleaned["subject"],
            academic_term=cleaned["academic_term"],
            payload=cleaned["payload"],
            source=cleaned["source"],
            event_timestamp=cleaned["event_timestamp"],
            status="pending",
            is_out_of_order=is_out_of_order,
            has_missing_data=has_missing_data,
            missing_fields=missing_fields,
            is_backfill=cleaned["is_backfill"],
            provenance=provenance,
        )

        try:
            db.stream_events.insert_one(event.to_doc())
        except DuplicateKeyError:
            existing_doc = db.stream_events.find_one({"event_id": cleaned["event_id"]})
            return {
                "status": "duplicate_ignored",
                "event": StreamEvent.from_doc(existing_doc).to_dict(sanitize_pii=True) if existing_doc else None,
            }, None, 200
        except PyMongoError as pe:
            logger.error("Failed to persist stream event %s: %s", event.event_id, pe)
            return None, "Failed to persist stream event.", 500

        # Process the persisted event
        return cls._process_persisted_event(
            db,
            event,
            t_start=t_start,
            actor_user=actor_user,
            simulate_transient_failure=simulate_transient_failure,
        )

    @classmethod
    def _process_persisted_event(
        cls,
        db: Database,
        event: StreamEvent,
        t_start: Optional[float] = None,
        actor_user: Any = None,
        simulate_transient_failure: bool = False,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Process a persisted event, update academic state if applicable, and broadcast SSE."""
        start_time = t_start if t_start is not None else time.perf_counter()
        try:
            if simulate_transient_failure:
                raise RuntimeError("Simulated transient stream processing failure.")

            prediction_id: Optional[str] = event.prediction_id

            # Only update current academic state when event is NOT out-of-order and NOT a backfill
            if not event.is_out_of_order and not event.is_backfill:
                cls._sync_academic_state(db, event)

                # Predictive analytics compatibility:
                # Only trigger prediction when data is complete (no missing required fields),
                # event_type is assessment_result or progress_update, and no prediction exists for this event_id.
                if (
                    not event.has_missing_data
                    and event.event_type in {"assessment_result", "progress_update"}
                    and not prediction_id
                ):
                    prediction_id = cls._maybe_trigger_prediction(db, event, actor_user)

            now = datetime.now(timezone.utc)
            latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            db.stream_events.update_one(
                {"_id": event.id},
                {
                    "$set": {
                        "status": "processed",
                        "processed_at": now,
                        "processing_latency_ms": latency_ms,
                        "error_message": None,
                        "prediction_id": prediction_id,
                    }
                },
            )
            event.status = "processed"
            event.processed_at = now
            event.processing_latency_ms = latency_ms
            event.error_message = None
            event.prediction_id = prediction_id

            # Broadcast sanitized event (no student PII) to SSE listeners
            sanitized = event.to_dict(sanitize_pii=True)
            broadcaster.publish(sanitized)

            return {
                "status": "processed",
                "event": event.to_dict(sanitize_pii=False),
            }, None, 201

        except Exception as exc:
            latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            err_msg = str(exc)
            db.stream_events.update_one(
                {"_id": event.id},
                {
                    "$set": {
                        "status": "failed",
                        "error_message": err_msg,
                        "processing_latency_ms": latency_ms,
                    }
                },
            )
            event.status = "failed"
            event.error_message = err_msg
            event.processing_latency_ms = latency_ms
            return {
                "status": "failed",
                "error": err_msg,
                "event": event.to_dict(sanitize_pii=True),
            }, err_msg, 500

    @classmethod
    def _sync_academic_state(cls, db: Database, event: StreamEvent) -> bool:
        """
        Atomically update live stream telemetry into academic_records ONLY if no newer
        `last_stream_timestamp` exists on the target document (prevents concurrent out-of-order overwrites).
        Returns True if state was written, False if skipped due to a newer timestamp.
        """
        now = datetime.now(timezone.utc)
        update_fields: Dict[str, Any] = {
            "updated_at": now,
            "last_stream_event_id": event.event_id,
            "last_stream_timestamp": event.event_timestamp,
        }
        if event.event_type == "attendance_update" and event.payload.get("absences") is not None:
            update_fields["absences"] = int(event.payload["absences"])
        elif event.event_type == "lms_activity" and event.payload.get("studytime") is not None:
            update_fields["studytime"] = int(event.payload["studytime"])
        elif event.event_type == "assessment_result":
            if event.payload.get("g1") is not None:
                update_fields["g1"] = float(event.payload["g1"])
            if event.payload.get("g2") is not None:
                update_fields["g2"] = float(event.payload["g2"])
        elif event.event_type == "progress_update" and event.payload.get("failures") is not None:
            update_fields["failures"] = int(event.payload["failures"])

        base_key = {
            "student_id": event.student_id,
            "subject": event.subject,
            "term": event.academic_term,
        }
        conditional_filter = {
            **base_key,
            "$or": [
                {"last_stream_timestamp": {"$exists": False}},
                {"last_stream_timestamp": None},
                {"last_stream_timestamp": {"$lte": event.event_timestamp}},
            ],
        }

        res = db.academic_records.update_one(conditional_filter, {"$set": update_fields}, upsert=False)
        if res.matched_count > 0:
            return True

        existing = db.academic_records.find_one(base_key, {"_id": 1, "last_stream_timestamp": 1})
        if existing is None:
            new_doc = {
                **base_key,
                **update_fields,
                "created_at": now,
            }
            db.academic_records.insert_one(new_doc)
            return True
        return False

    @classmethod
    def _maybe_trigger_prediction(
        cls, db: Database, event: StreamEvent, actor_user: Any = None
    ) -> Optional[str]:
        """
        Generate a compatible Milestone prediction ONLY when the event carries complete
        canonical features (g1/g2 or milestone) and no prediction exists for this event_id.
        Preserves all existing ML models without retraining.
        """
        existing_pred = db.predictions.find_one({"source_event_id": event.event_id}, {"_id": 1})
        if existing_pred:
            return str(existing_pred["_id"])

        subj_lower = event.subject.lower()
        if "math" not in subj_lower and "portug" not in subj_lower:
            return None

        # Require explicit milestone score inputs to avoid fabricating predictions from incomplete data
        if event.payload.get("g1") is None:
            return None

        try:
            from backend.services.prediction_service import PredictionService
            from backend.data_engineering.leakage_guard import get_milestone_features

            canonical_subj = "Mathematics" if "math" in subj_lower else "Portuguese Language"
            milestone = int(event.payload.get("milestone", 1))
            if milestone not in (0, 1, 2):
                milestone = 1

            expected = get_milestone_features(milestone)
            features: Dict[str, Any] = {}

            # 1. Start from explicit prediction_features if supplied
            if isinstance(event.payload.get("prediction_features"), dict):
                features.update(event.payload["prediction_features"])
            else:
                # 2. Otherwise check latest academic_record for baseline demographic/prior features
                ac_doc = db.academic_records.find_one(
                    {"student_id": event.student_id, "subject": canonical_subj},
                    sort=[("created_at", DESCENDING)],
                )
                if ac_doc:
                    for k in expected:
                        if k in ac_doc and ac_doc[k] is not None:
                            features[k] = ac_doc[k]

            # Overlay live stream metrics
            if event.payload.get("g1") is not None and "previous_exam_marks" in expected:
                features["previous_exam_marks"] = round(float(event.payload["g1"]) * 5.0, 2)
            elif event.payload.get("score") is not None and event.payload.get("max_score") and "previous_exam_marks" in expected:
                features["previous_exam_marks"] = round(
                    (float(event.payload["score"]) / float(event.payload["max_score"])) * 100.0, 2
                )
            if "absences" in event.payload and "absences" in expected:
                features["absences"] = int(event.payload["absences"])
            if "studytime" in event.payload and "studytime" in expected:
                features["studytime"] = int(event.payload["studytime"])
            if "failures" in event.payload and "failures" in expected:
                features["failures"] = int(event.payload["failures"])
            if event.payload.get("g2") is not None and "quiz_scores" in expected:
                features["quiz_scores"] = round(float(event.payload["g2"]) * 5.0, 2)

            # Never fabricate predictions if required milestone features are incomplete
            if any(k not in features or features[k] is None for k in expected):
                return None

            pred_record, err, _ = PredictionService.create_prediction(
                db=db,
                student_id=event.student_id,
                actor_user=actor_user,
                subject=canonical_subj,
                milestone=milestone,
                features=features,
                academic_term=event.academic_term,
            )
            if pred_record and not err:
                db.predictions.update_one(
                    {"_id": pred_record.id},
                    {"$set": {"source_event_id": event.event_id}},
                )
                return str(pred_record.id)
        except Exception as exc:
            logger.warning("Stream prediction hook skipped for event %s: %s", event.event_id, exc)
        return None

    @classmethod
    def retry_event(
        cls, db: Database, event_id: str, actor_user: Any = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Retry a failed stream event without losing provenance."""
        if db is None:
            return None, "Database unavailable.", 500
        doc = db.stream_events.find_one({"event_id": event_id.strip()})
        if not doc:
            return None, "Stream event not found.", 404
        event = StreamEvent.from_doc(doc)
        if event.status == "processed":
            return {"status": "already_processed", "event": event.to_dict(sanitize_pii=True)}, None, 200

        db.stream_events.update_one(
            {"_id": event.id},
            {"$inc": {"retry_count": 1}, "$set": {"status": "pending"}},
        )
        event.retry_count += 1
        event.status = "pending"
        return cls._process_persisted_event(db, event, actor_user=actor_user, simulate_transient_failure=False)

    @classmethod
    def retry_failed_events(
        cls,
        db: Database,
        max_batch: int = 50,
        max_retries: int = 3,
        actor_user: Any = None,
    ) -> Tuple[Dict[str, Any], Optional[str], int]:
        """
        Bounded bulk retry for failed stream events with retry limits and per-event isolation.
        """
        if db is None:
            return {}, "Database unavailable.", 500

        bounded_limit = max(1, min(int(max_batch), 200))
        candidates = list(
            db.stream_events.find(
                {"status": "failed", "retry_count": {"$lt": int(max_retries)}}
            )
            .sort("received_at", 1)
            .limit(bounded_limit)
        )

        succeeded = 0
        failed = 0
        skipped = 0
        for doc in candidates:
            ev_id = doc.get("event_id", "")
            try:
                claimed = db.stream_events.find_one_and_update(
                    {"_id": doc["_id"], "status": "failed", "retry_count": {"$lt": int(max_retries)}},
                    {"$inc": {"retry_count": 1}, "$set": {"status": "pending"}},
                )
                if not claimed:
                    skipped += 1
                    continue
                ev = StreamEvent.from_doc(claimed)
                ev.retry_count += 1
                ev.status = "pending"
                res, err, code = cls._process_persisted_event(
                    db, ev, actor_user=actor_user, simulate_transient_failure=False
                )
                if code in (200, 201) and not err:
                    succeeded += 1
                else:
                    failed += 1
            except Exception as exc:
                logger.warning("Bulk retry failed for event %s: %s", ev_id, exc)
                failed += 1

        try:
            log_event(
                db,
                "STREAM_BULK_RETRY",
                {"attempted": len(candidates), "succeeded": succeeded, "failed": failed, "skipped": skipped},
                actor_id=getattr(actor_user, "id", None),
            )
        except Exception:
            pass

        return {
            "attempted": len(candidates),
            "succeeded": succeeded,
            "failed": failed,
            "skipped": skipped,
        }, None, 200

    @classmethod
    def recover_stale_pending_events(
        cls,
        db: Database,
        stale_seconds: int = 60,
        max_batch: int = 50,
        max_retries: int = 3,
        actor_user: Any = None,
    ) -> Tuple[Dict[str, Any], Optional[str], int]:
        """
        Safely recover stream events stuck in 'pending' longer than `stale_seconds`.
        Uses atomic find_one_and_update claiming and retry_count bounds.
        """
        if db is None:
            return {}, "Database unavailable.", 500

        cutoff = datetime.now(timezone.utc) - timedelta(seconds=max(1, int(stale_seconds)))
        bounded_limit = max(1, min(int(max_batch), 200))
        candidates = list(
            db.stream_events.find(
                {
                    "status": "pending",
                    "received_at": {"$lte": cutoff},
                    "retry_count": {"$lt": int(max_retries)},
                }
            )
            .sort("received_at", 1)
            .limit(bounded_limit)
        )

        recovered = 0
        failed = 0
        for doc in candidates:
            try:
                claimed = db.stream_events.find_one_and_update(
                    {"_id": doc["_id"], "status": "pending", "retry_count": {"$lt": int(max_retries)}},
                    {"$inc": {"retry_count": 1}},
                )
                if not claimed:
                    continue
                ev = StreamEvent.from_doc(claimed)
                ev.retry_count += 1
                res, err, code = cls._process_persisted_event(
                    db, ev, actor_user=actor_user, simulate_transient_failure=False
                )
                if code in (200, 201) and not err:
                    recovered += 1
                else:
                    failed += 1
            except Exception as exc:
                logger.warning("Stale pending recovery error: %s", exc)
                failed += 1

        try:
            log_event(
                db,
                "STREAM_STALE_RECOVERY",
                {"candidates": len(candidates), "recovered": recovered, "failed": failed, "stale_seconds": stale_seconds},
                actor_id=getattr(actor_user, "id", None),
            )
        except Exception:
            pass

        return {
            "candidates": len(candidates),
            "recovered": recovered,
            "failed": failed,
        }, None, 200

    @classmethod
    def get_monitoring_status(cls, db: Database) -> Dict[str, Any]:
        """
        Return operational stream metrics with ZERO student PII.
        """
        if db is None:
            return {
                "events_received": 0,
                "events_processed": 0,
                "events_failed": 0,
                "events_pending": 0,
                "out_of_order_events": 0,
                "incomplete_data_events": 0,
                "backfill_events": 0,
                "realtime_events": 0,
                "average_latency_ms": None,
                "delivery_guarantee": "at-least-once (idempotent event_id deduplication)",
            }

        total = db.stream_events.count_documents({})
        processed = db.stream_events.count_documents({"status": "processed"})
        failed = db.stream_events.count_documents({"status": "failed"})
        pending = db.stream_events.count_documents({"status": "pending"})
        out_of_order = db.stream_events.count_documents({"is_out_of_order": True})
        incomplete = db.stream_events.count_documents({"has_missing_data": True})
        backfill = db.stream_events.count_documents({"is_backfill": True})
        realtime = db.stream_events.count_documents({"is_backfill": False})

        lat_agg = list(
            db.stream_events.aggregate([
                {"$match": {"processing_latency_ms": {"$ne": None}}},
                {"$group": {"_id": None, "avg_latency": {"$avg": "$processing_latency_ms"}}},
            ])
        )
        avg_lat = round(float(lat_agg[0]["avg_latency"]), 2) if lat_agg else None

        latest = db.stream_events.find_one({}, sort=[("received_at", DESCENDING)])
        last_ts = latest["received_at"].isoformat() if latest and isinstance(latest.get("received_at"), datetime) else None

        return {
            "events_received": total,
            "events_processed": processed,
            "events_failed": failed,
            "events_pending": pending,
            "out_of_order_events": out_of_order,
            "incomplete_data_events": incomplete,
            "backfill_events": backfill,
            "realtime_events": realtime,
            "average_latency_ms": avg_lat,
            "last_event_at": last_ts,
            "delivery_guarantee": "at-least-once (idempotent event_id deduplication)",
        }

    @classmethod
    def list_recent_events(
        cls,
        db: Database,
        limit: int = 50,
        status: Optional[str] = None,
        subject_filter: Optional[List[str]] = None,
        sanitize_pii: bool = True,
    ) -> List[Dict[str, Any]]:
        """List recent stream events with optional status and subject scoping."""
        if db is None:
            return []
        query: Dict[str, Any] = {}
        if status and status.strip():
            query["status"] = status.strip()
        if subject_filter is not None:
            query["subject"] = {"$in": subject_filter}

        cursor = db.stream_events.find(query).sort("received_at", DESCENDING).limit(max(1, min(limit, 200)))
        return [StreamEvent.from_doc(d).to_dict(sanitize_pii=sanitize_pii) for d in cursor]

    @classmethod
    def sse_stream(cls, db: Database, allowed_subjects: Optional[List[str]] = None) -> Generator[str, None, None]:
        """Yield SSE formatted events from the in-process broadcaster."""
        q = broadcaster.subscribe()
        try:
            # Send initial status heartbeat
            snapshot = cls.get_monitoring_status(db)
            yield f"event: status\ndata: {json.dumps(snapshot)}\n\n"
            while True:
                try:
                    ev = q.get(timeout=15)
                    if allowed_subjects is None or ev.get("subject") in allowed_subjects:
                        yield f"event: stream_event\ndata: {json.dumps(ev)}\n\n"
                except queue.Empty:
                    yield ": keep-alive\n\n"
        finally:
            broadcaster.unsubscribe(q)
