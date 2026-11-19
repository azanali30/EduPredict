"""
EduPredict - Historical Prediction Subject ID Migration Tool
Phase 6A: Backfills canonical subject_id ObjectIds on historical predictions.

Usage:
    python scripts/migrate_prediction_subject_ids.py          # Dry-run mode (DEFAULT)
    python scripts/migrate_prediction_subject_ids.py --apply  # Live migration mode
"""

import os
import sys
import argparse
import logging
from typing import Any, Dict, Optional
from pymongo import MongoClient
from pymongo.database import Database
from bson import ObjectId

# Ensure workspace root is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.config import get_config
from backend.services.subject_service import SubjectService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SubjectMigration")


# Subject string resolution map (lowercased stripped string -> canonical_key)
SUBJECT_RESOLUTION_MAP = {
    "mathematics": "mathematics",
    "math": "mathematics",
    "maths": "mathematics",
    "portuguese language": "portuguese",
    "portuguese": "portuguese",
    "port": "portuguese",
}


def run_migration(
    db: Database,
    apply_writes: bool = False,
) -> Dict[str, Any]:
    """
    Executes or simulates migration of predictions collection to backfill subject_id.

    Parameters:
    - db: Connected MongoDB database instance.
    - apply_writes: If True, executes MongoDB updates; if False, performs a dry-run.

    Returns:
    - Summary dictionary with counts and diagnostic lists.
    """
    # 1. Ensure canonical subjects exist
    canonical_subjects = SubjectService.ensure_canonical_subjects(db)
    subject_by_key = {s["canonical_key"]: s for s in canonical_subjects}

    stats = {
        "mode": "APPLY (LIVE WRITE)" if apply_writes else "DRY RUN (READ ONLY)",
        "total_predictions": 0,
        "already_migrated": 0,
        "matched_and_ready": 0,
        "unmatched_unknown_subject": 0,
        "missing_subject_field": 0,
        "written_count": 0,
        "failed_writes": 0,
        "unmatched_samples": [],
    }

    cursor = db.predictions.find()
    stats["total_predictions"] = db.predictions.count_documents({})

    updates_to_perform = []

    for doc in cursor:
        doc_id = doc["_id"]
        raw_subject = doc.get("subject")
        existing_subject_id = doc.get("subject_id")

        # Check if already migrated with valid subject_id
        if existing_subject_id:
            s_doc = db.subjects.find_one({"_id": existing_subject_id})
            if s_doc:
                stats["already_migrated"] += 1
                continue

        # Check missing or empty subject string
        if not raw_subject or not isinstance(raw_subject, str) or not raw_subject.strip():
            stats["missing_subject_field"] += 1
            continue

        clean_subject_str = raw_subject.strip().lower()
        canonical_key = SUBJECT_RESOLUTION_MAP.get(clean_subject_str)

        if not canonical_key or canonical_key not in subject_by_key:
            stats["unmatched_unknown_subject"] += 1
            if len(stats["unmatched_samples"]) < 5:
                stats["unmatched_samples"].append({
                    "id": str(doc_id),
                    "raw_subject": raw_subject,
                })
            continue

        resolved_subject = subject_by_key[canonical_key]
        resolved_subject_oid = ObjectId(resolved_subject["id"])

        stats["matched_and_ready"] += 1
        updates_to_perform.append((doc_id, resolved_subject_oid))

    # Perform writes if apply_writes is requested
    if apply_writes:
        for doc_id, subject_oid in updates_to_perform:
            try:
                res = db.predictions.update_one(
                    {"_id": doc_id},
                    {"$set": {"subject_id": subject_oid}},
                )
                if res.modified_count > 0:
                    stats["written_count"] += 1
            except Exception as e:
                logger.error("Failed to update prediction %s: %s", str(doc_id), str(e))
                stats["failed_writes"] += 1

    return stats


def print_summary(stats: Dict[str, Any]) -> None:
    """Print structured migration summary report."""
    print("=" * 70)
    print(" EDUPREDICT — HISTORICAL PREDICTION SUBJECT_ID MIGRATION REPORT")
    print("=" * 70)
    print(f" Execution Mode:            {stats['mode']}")
    print(f" Total Predictions Scanned: {stats['total_predictions']}")
    print(f" Already Migrated (Valid):  {stats['already_migrated']}")
    print(f" Matched Canonical Subject: {stats['matched_and_ready']}")
    print(f" Unmatched Subject String:  {stats['unmatched_unknown_subject']}")
    print(f" Missing Subject Field:     {stats['missing_subject_field']}")
    print(f" Successfully Written:      {stats['written_count']}")
    print(f" Failed Writes:             {stats['failed_writes']}")
    print("-" * 70)

    if stats["unmatched_samples"]:
        print(" Samples of Unmatched Subjects:")
        for sample in stats["unmatched_samples"]:
            print(f"   Prediction ID: {sample['id']} | Raw Subject: '{sample['raw_subject']}'")
        print("-" * 70)

    if stats["mode"].startswith("DRY RUN"):
        print(" [NOTE] Dry-run executed. Zero database modifications were made.")
        print(" To apply these changes, rerun with: python scripts/migrate_prediction_subject_ids.py --apply")
    else:
        print(" [NOTE] Live migration completed. Canonical subject_id properties written.")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Backfill canonical subject_id on historical predictions.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply database writes. If omitted, runs in safe DRY RUN mode.",
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default=None,
        help="Target database name (defaults to active environment configuration).",
    )
    args = parser.parse_args()

    cfg = get_config()
    db_name = args.db_name or cfg.MONGO_DB_NAME or "edupredict"
    mongo_uri = cfg.MONGO_URI or "mongodb://localhost:27017"

    logger.info("Connecting to MongoDB: %s (database: %s)", mongo_uri, db_name)
    client = MongoClient(mongo_uri)
    db = client[db_name]

    stats = run_migration(db=db, apply_writes=args.apply)
    print_summary(stats)


if __name__ == "__main__":
    main()
