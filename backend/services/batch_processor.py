"""
EduPredict - Parallel Batch & Backfill Processor (Phase 10)
Module: backend.services.batch_processor
Purpose: Processes historical educational datasets in parallel using ThreadPoolExecutor,
normalizes them into the canonical StreamEvent schema with deterministic event_ids,
and prevents duplicate counting or corruption of current real-time state.
"""

import hashlib
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from pymongo.database import Database

from backend.services.event_streamer import EventStreamer

logger = logging.getLogger(__name__)


def _deterministic_backfill_event_id(record: Dict[str, Any]) -> str:
    """Generate a stable, deterministic event_id for a historical record."""
    if record.get("event_id"):
        return str(record["event_id"]).strip()
    canonical = json.dumps(
        {
            "student_id": str(record.get("student_id", "")),
            "subject": str(record.get("subject", "")),
            "academic_term": str(record.get("academic_term", "")),
            "event_type": str(record.get("event_type", "assessment_result")),
            "event_timestamp": str(record.get("event_timestamp", "")),
            "payload": record.get("payload", {}),
        },
        sort_keys=True,
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:20]
    return f"batch-{digest}"


class BatchProcessor:
    """Parallel batch processor integrated with the Phase 10 streaming schema."""

    @classmethod
    def run_backfill(
        cls,
        db: Database,
        records: List[Dict[str, Any]],
        actor_user: Any = None,
        max_workers: int = 4,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Process a batch of historical educational records in parallel.
        - Marks every record with `source="batch_backfill"` and `is_backfill=True`
          so historical backfills never overwrite newer real-time academic state.
        - Uses deterministic `event_id`s to prevent duplicate counting between
          repeated batch runs and streaming datasets.
        """
        if db is None:
            return None, "Database service unavailable.", 500
        if not isinstance(records, list) or len(records) == 0:
            return None, "'records' must be a non-empty list.", 400
        if len(records) > 500:
            return None, "Batch backfill is limited to 500 records per request.", 400

        t_start = time.perf_counter()

        def _process_one(rec: Dict[str, Any]) -> Dict[str, Any]:
            enriched = dict(rec)
            enriched["event_id"] = _deterministic_backfill_event_id(enriched)
            enriched["source"] = "batch_backfill"
            enriched["is_backfill"] = True
            res, err, code = EventStreamer.ingest_event(db, enriched, actor_user=actor_user)
            if res and res.get("status") == "duplicate_ignored":
                return {"status": "duplicate", "event_id": enriched["event_id"]}
            if code in (200, 201) and res:
                return {"status": "processed", "event_id": enriched["event_id"]}
            return {"status": "failed", "event_id": enriched["event_id"], "error": err or "Unknown error"}

        processed = 0
        duplicates = 0
        failed = 0
        errors: List[Dict[str, Any]] = []

        worker_count = max(1, min(max_workers, len(records), 8))
        with ThreadPoolExecutor(max_workers=worker_count) as pool:
            futures = [pool.submit(_process_one, r) for r in records]
            for fut in as_completed(futures):
                outcome = fut.result()
                st = outcome.get("status")
                if st == "processed":
                    processed += 1
                elif st == "duplicate":
                    duplicates += 1
                else:
                    failed += 1
                    errors.append({"event_id": outcome.get("event_id"), "error": outcome.get("error")})

        elapsed_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
        return {
            "status": "completed",
            "total_submitted": len(records),
            "processed": processed,
            "duplicates_skipped": duplicates,
            "failed": failed,
            "elapsed_ms": elapsed_ms,
            "errors": errors[:20],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }, None, 200

    @classmethod
    def get_reconciliation_summary(cls, db: Database) -> Dict[str, Any]:
        """
        Provide unified batch vs. streaming reconciliation counts (zero student PII)
        to verify consistency and absence of duplicate counting.
        """
        if db is None:
            return {
                "realtime_processed": 0,
                "batch_backfill_processed": 0,
                "unique_event_count": 0,
                "consistent": True,
            }

        rt_count = db.stream_events.count_documents({"is_backfill": False, "status": "processed"})
        bf_count = db.stream_events.count_documents({"is_backfill": True, "status": "processed"})
        total_processed = db.stream_events.count_documents({"status": "processed"})

        return {
            "realtime_processed": rt_count,
            "batch_backfill_processed": bf_count,
            "total_unique_processed": total_processed,
            "consistent": (rt_count + bf_count) == total_processed,
        }
