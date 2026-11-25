"""
EduPredict - Course Demand Forecasting Service (Phase 8B)
Module: backend.services.demand_forecast_service
Purpose: Extracts real institutional enrollment history from MongoDB 6.x,
enforces fail-closed multi-tenant organization isolation and RBAC, runs time-series forecasting,
and persists forecast snapshots and model evaluation metadata.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import PyMongoError

from backend.models.demand_forecast_model import DemandForecastRecord
from backend.models.user_model import User
from backend.ml.demand_forecaster import (
    forecast_subject_demand,
    parse_academic_term_sort_key,
    MIN_RIDGE_HISTORY_TERMS,
    MIN_RIDGE_VALIDATION_SPLITS,
)
from backend.services.system_log_service import log_event
from backend.utils.security import to_object_id

logger = logging.getLogger(__name__)

MAX_HISTORY_LIMIT = 100
MAX_FORECAST_PERIOD_LEN = 64

DEMAND_DISCLAIMER = (
    "Estimated enrollment demand for academic planning only — not confirmed registration. "
    "Prediction intervals are heuristic residual bands, not calibrated confidence intervals, "
    "and require administrative review."
)


class DemandForecastService:
    """Service layer for course and subject enrollment demand forecasting."""

    @staticmethod
    def _require_valid_org_id(actor_user: Any) -> Tuple[Optional[str], Optional[str], int]:
        """
        Fail-closed organization context validation.
        Institutional forecasting operations strictly require a non-empty organization_id.
        """
        raw_org = getattr(actor_user, "organization_id", None) if actor_user else None
        if not raw_org or not isinstance(raw_org, str) or not raw_org.strip():
            return (
                None,
                "Organization context required. Institutional forecasting operations require a valid organization_id.",
                403,
            )
        return raw_org.strip(), None, 200

    @staticmethod
    def _get_org_student_ids(db: Database, org_id: str) -> List[ObjectId]:
        """
        Return list of student ObjectIds belonging strictly to org_id.
        Never returns None; returns empty list if org_id has no students.
        """
        if not org_id or not isinstance(org_id, str) or not org_id.strip():
            return []
        org_students = list(
            db.users.find({"role": "student", "organization_id": org_id.strip()}, {"_id": 1})
        )
        return [u["_id"] for u in org_students]

    @staticmethod
    def _validate_forecast_period_override(forecast_period: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        """Validate optional forecast_period string."""
        if forecast_period is None:
            return None, None
        if not isinstance(forecast_period, str) or not forecast_period.strip() or len(forecast_period.strip()) > MAX_FORECAST_PERIOD_LEN:
            return None, f"forecast_period must be a non-empty string up to {MAX_FORECAST_PERIOD_LEN} characters."
        return forecast_period.strip(), None

    @staticmethod
    def _get_authorized_subjects(
        db: Database,
        actor_user: User,
        org_id: str,
        department: Optional[str] = None,
        subject_ids: Optional[List[str]] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[str], int]:
        """
        Retrieve active subjects authorized for actor_user within org_id:
        - Admin / Analyst: organization-scoped active subjects (shared canonical subjects allowed,
          custom subjects restricted to org_id).
        - Teacher: strictly active subjects assigned to this teacher.
        """
        subj_query: Dict[str, Any] = {
            "is_active": True,
            "$or": [
                {"organization_id": org_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None},
            ],
        }

        if department and department.strip():
            subj_query["department"] = department.strip()

        if subject_ids is not None:
            if not isinstance(subject_ids, list) or len(subject_ids) == 0:
                return [], "subject_ids must be a non-empty list of valid subject IDs.", 400
            oids = [to_object_id(sid) for sid in subject_ids]
            if any(o is None for o in oids):
                return [], "One or more subject_ids have an invalid ObjectId format.", 400
            subj_query["_id"] = {"$in": oids}

        if getattr(actor_user, "role", "") == "teacher":
            teacher_oid = to_object_id(actor_user.id)
            assignments = list(
                db.teacher_subject_assignments.find(
                    {"teacher_id": teacher_oid, "status": "active"}
                )
            )
            assigned_ids = list({a["subject_id"] for a in assignments if a.get("subject_id")})
            if not assigned_ids:
                return [], None, 200
            if "_id" in subj_query:
                requested = set(subj_query["_id"]["$in"])
                allowed = set(assigned_ids)
                if not requested.issubset(allowed):
                    return [], "Access denied. You may only view forecasts for your assigned subjects.", 403
                subj_query["_id"] = {"$in": list(requested)}
            else:
                subj_query["_id"] = {"$in": assigned_ids}

        subjects = list(db.subjects.find(subj_query))
        return subjects, None, 200

    @classmethod
    def _extract_batch_subject_histories(
        cls,
        db: Database,
        subject_oids: List[ObjectId],
        org_student_ids: List[ObjectId],
    ) -> Dict[ObjectId, List[Dict[str, Any]]]:
        """
        Batch-aggregate actual enrollment counts per subject_id and academic_term
        for students strictly belonging to the authorized organization.
        """
        histories: Dict[ObjectId, List[Dict[str, Any]]] = {sid: [] for sid in subject_oids}
        if not subject_oids or not org_student_ids:
            return histories

        enrollments = list(
            db.student_subject_enrollments.find({
                "subject_id": {"$in": subject_oids},
                "student_id": {"$in": org_student_ids},
            })
        )
        if not enrollments:
            return histories

        grouped: Dict[ObjectId, Dict[str, Dict[str, int]]] = {sid: {} for sid in subject_oids}
        for e in enrollments:
            sid = e.get("subject_id")
            term = (e.get("academic_term") or "").strip()
            if not sid or not term or sid not in grouped:
                continue
            by_term = grouped[sid]
            if term not in by_term:
                by_term[term] = {
                    "active_count": 0,
                    "completed_count": 0,
                    "dropped_count": 0,
                    "total_count": 0,
                }
            status = (e.get("status") or "active").lower()
            if status == "active":
                by_term[term]["active_count"] += 1
            elif status == "completed":
                by_term[term]["completed_count"] += 1
            elif status == "dropped":
                by_term[term]["dropped_count"] += 1
            by_term[term]["total_count"] += 1

        for sid, by_term in grouped.items():
            series = [{"academic_term": term, **counts} for term, counts in by_term.items()]
            series.sort(key=lambda r: parse_academic_term_sort_key(r["academic_term"]))
            histories[sid] = series

        return histories

    @classmethod
    def get_demand_overview(
        cls,
        db: Database,
        actor_user: User,
        periods_ahead: int = 1,
        forecast_period_override: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Compute live course & subject enrollment demand overview from actual MongoDB records.
        Fails closed if organization_id is missing.
        """
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = cls._require_valid_org_id(actor_user)
        if org_err:
            return None, org_err, org_code

        if periods_ahead < 1 or periods_ahead > 4:
            return None, "periods_ahead must be an integer between 1 and 4.", 400

        clean_override, override_err = cls._validate_forecast_period_override(forecast_period_override)
        if override_err:
            return None, override_err, 400

        subjects, err, code = cls._get_authorized_subjects(db, actor_user, org_id=org_id, department=department)
        if err:
            return None, err, code

        org_student_ids = cls._get_org_student_ids(db, org_id)
        subject_oids = [s["_id"] for s in subjects]
        histories_map = cls._extract_batch_subject_histories(db, subject_oids, org_student_ids)

        forecasts: List[Dict[str, Any]] = []
        term_aggregates: Dict[str, int] = {}
        sufficiency_counts = {"sufficient": 0, "baseline_only": 0, "insufficient": 0}
        models_used: Dict[str, int] = {}
        mae_values: List[float] = []

        for subj in subjects:
            s_oid = subj["_id"]
            history = histories_map.get(s_oid, [])
            capacity = subj.get("capacity")
            fc = forecast_subject_demand(
                historical_series=history,
                periods_ahead=periods_ahead,
                capacity=capacity,
            )

            if clean_override:
                fc["forecast_period"] = clean_override

            suff = fc["data_sufficiency"]
            if suff in sufficiency_counts:
                sufficiency_counts[suff] += 1

            m_name = fc["model_used"]
            models_used[m_name] = models_used.get(m_name, 0) + 1

            mae_val = fc.get("evaluation_metrics", {}).get("mae")
            if mae_val is not None:
                mae_values.append(float(mae_val))

            for h in history:
                t = h["academic_term"]
                term_aggregates[t] = term_aggregates.get(t, 0) + h["total_count"]

            forecasts.append({
                "subject_id": str(s_oid),
                "subject_code": subj.get("code", ""),
                "subject_name": subj.get("name", ""),
                "department": subj.get("department", "General"),
                "capacity": capacity,
                "historical_series": history,
                "terms_observed": len(history),
                **fc,
                "disclaimer": DEMAND_DISCLAIMER,
            })

        forecasts.sort(key=lambda x: x["predicted_enrollment"], reverse=True)

        high_demand = [f for f in forecasts if f["demand_tier"] == "High Demand"]
        low_demand = [f for f in forecasts if f["demand_tier"] == "Low Demand"]
        unclassified = [f for f in forecasts if f["demand_tier"] == "Unclassified"]

        total_predicted = round(sum(f["predicted_enrollment"] for f in forecasts), 2)
        total_latest_actual = sum(
            f["latest_actual_enrollment"] for f in forecasts if f["latest_actual_enrollment"] is not None
        )

        dept_map: Dict[str, Dict[str, Any]] = {}
        for f in forecasts:
            dept = f["department"] or "General"
            if dept not in dept_map:
                dept_map[dept] = {
                    "department": dept,
                    "subject_count": 0,
                    "latest_actual": 0,
                    "predicted_enrollment": 0.0,
                }
            dept_map[dept]["subject_count"] += 1
            dept_map[dept]["latest_actual"] += f["latest_actual_enrollment"] or 0
            dept_map[dept]["predicted_enrollment"] += f["predicted_enrollment"]

        department_summary = [
            {
                **d,
                "predicted_enrollment": round(d["predicted_enrollment"], 2),
                "growth_rate_pct": round(
                    ((d["predicted_enrollment"] - d["latest_actual"]) / d["latest_actual"]) * 100.0, 2
                )
                if d["latest_actual"] > 0
                else None,
            }
            for d in dept_map.values()
        ]

        historical_timeline = [
            {"academic_term": t, "total_enrollment": cnt}
            for t, cnt in sorted(term_aggregates.items(), key=lambda kv: parse_academic_term_sort_key(kv[0]))
        ]

        if not forecasts or (sufficiency_counts["sufficient"] == 0 and sufficiency_counts["baseline_only"] == 0):
            overall_sufficiency = "insufficient"
        elif sufficiency_counts["sufficient"] > 0:
            overall_sufficiency = "sufficient"
        else:
            overall_sufficiency = "baseline_only"

        return {
            "summary": {
                "organization_id": org_id,
                "total_subjects_analyzed": len(forecasts),
                "total_latest_actual_enrollment": total_latest_actual,
                "total_predicted_enrollment": total_predicted,
                "high_demand_count": len(high_demand),
                "low_demand_count": len(low_demand),
                "unclassified_count": len(unclassified),
                "periods_ahead": periods_ahead,
                "overall_data_sufficiency": overall_sufficiency,
                "sufficiency_breakdown": sufficiency_counts,
                "average_walk_forward_mae": round(sum(mae_values) / len(mae_values), 3) if mae_values else None,
                "models_used": models_used,
            },
            "forecasts": forecasts,
            "high_demand_courses": high_demand[:10],
            "low_demand_courses": low_demand[:10],
            "department_summary": department_summary,
            "historical_timeline": historical_timeline,
            "disclaimer": DEMAND_DISCLAIMER,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }, None, 200

    @classmethod
    def get_subject_forecast(
        cls,
        db: Database,
        actor_user: User,
        subject_id: str,
        periods_ahead: int = 1,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Retrieve detailed demand forecast for a single authorized subject within organization."""
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = cls._require_valid_org_id(actor_user)
        if org_err:
            return None, org_err, org_code

        if not to_object_id(subject_id):
            return None, "Invalid subject_id format.", 400

        if periods_ahead < 1 or periods_ahead > 4:
            return None, "periods_ahead must be between 1 and 4.", 400

        subjects, err, code = cls._get_authorized_subjects(
            db, actor_user, org_id=org_id, subject_ids=[subject_id]
        )
        if err:
            return None, err, code
        if not subjects:
            return None, "Subject not found or access denied.", 404

        subj = subjects[0]
        org_student_ids = cls._get_org_student_ids(db, org_id)
        histories_map = cls._extract_batch_subject_histories(db, [subj["_id"]], org_student_ids)
        history = histories_map.get(subj["_id"], [])

        fc = forecast_subject_demand(
            historical_series=history,
            periods_ahead=periods_ahead,
            capacity=subj.get("capacity"),
        )

        return {
            "subject_id": str(subj["_id"]),
            "subject_code": subj.get("code", ""),
            "subject_name": subj.get("name", ""),
            "department": subj.get("department", "General"),
            "capacity": subj.get("capacity"),
            "historical_series": history,
            "terms_observed": len(history),
            **fc,
            "disclaimer": DEMAND_DISCLAIMER,
        }, None, 200

    @classmethod
    def generate_and_save_forecasts(
        cls,
        db: Database,
        admin_user: User,
        periods_ahead: int = 1,
        forecast_period_override: Optional[str] = None,
        subject_ids: Optional[List[str]] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """
        Run demand forecasting for authorized organization subjects and persist snapshots
        and evaluation metadata to MongoDB. Admin-only operation; fails closed without organization_id.
        """
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = cls._require_valid_org_id(admin_user)
        if org_err:
            return None, org_err, org_code

        if periods_ahead < 1 or periods_ahead > 4:
            return None, "periods_ahead must be an integer between 1 and 4.", 400

        clean_override, override_err = cls._validate_forecast_period_override(forecast_period_override)
        if override_err:
            return None, override_err, 400

        subjects, err, code = cls._get_authorized_subjects(
            db, admin_user, org_id=org_id, subject_ids=subject_ids
        )
        if err:
            return None, err, code

        # Phase 9C: Enforce advanced_forecasting entitlement and atomic prediction quota
        from backend.services.billing_service import BillingService

        fg_ok, fg_err, fg_code = BillingService.check_feature_entitlement(
            db, org_id, "advanced_forecasting"
        )
        if not fg_ok:
            return None, fg_err, fg_code

        org_student_ids = cls._get_org_student_ids(db, org_id)
        subject_oids = [s["_id"] for s in subjects]
        histories_map = cls._extract_batch_subject_histories(db, subject_oids, org_student_ids)

        saved_records: List[Dict[str, Any]] = []
        docs_to_insert: List[Dict[str, Any]] = []
        mae_list: List[float] = []
        models_used: Dict[str, int] = {}

        for subj in subjects:
            s_oid = subj["_id"]
            history = histories_map.get(s_oid, [])
            fc = forecast_subject_demand(
                historical_series=history,
                periods_ahead=periods_ahead,
                capacity=subj.get("capacity"),
            )
            target_period = clean_override if clean_override else fc["forecast_period"]

            record = DemandForecastRecord(
                subject_id=s_oid,
                subject_code=subj.get("code", ""),
                subject_name=subj.get("name", ""),
                department=subj.get("department", "General"),
                organization_id=org_id,
                forecast_period=target_period,
                periods_ahead=periods_ahead,
                historical_series=history,
                latest_actual_enrollment=fc["latest_actual_enrollment"],
                predicted_enrollment=fc["predicted_enrollment"],
                confidence_lower=fc["confidence_lower"],
                confidence_upper=fc["confidence_upper"],
                confidence_level=fc["confidence_level"],
                interval_type=fc["interval_type"],
                is_calibrated_confidence_interval=fc["is_calibrated_confidence_interval"],
                growth_rate_pct=fc["growth_rate_pct"],
                trend_direction=fc["trend_direction"],
                demand_tier=fc["demand_tier"],
                capacity=subj.get("capacity"),
                utilization_pct=fc["utilization_pct"],
                model_used=fc["model_used"],
                validation_status=fc["validation_status"],
                data_sufficiency=fc["data_sufficiency"],
                evaluation_metrics=fc["evaluation_metrics"],
                disclaimer=DEMAND_DISCLAIMER,
                created_by=admin_user.id,
            )
            docs_to_insert.append(record.to_doc())
            saved_records.append(record.to_dict())

            mae = fc.get("evaluation_metrics", {}).get("mae")
            if mae is not None:
                mae_list.append(float(mae))
            m_name = fc["model_used"]
            models_used[m_name] = models_used.get(m_name, 0) + 1

        if docs_to_insert:
            q_ok, q_err, q_code = BillingService.consume_prediction_quota(db, org_id, count=1)
            if not q_ok:
                return None, q_err, q_code
            try:
                db.demand_forecasts.insert_many(docs_to_insert)
            except PyMongoError as pe:
                logger.error("Failed to insert demand forecast records: %s", pe)
                return None, "Database error saving forecast snapshots.", 500

        meta_doc = {
            "_id": ObjectId(),
            "organization_id": org_id,
            "periods_ahead": periods_ahead,
            "subjects_forecasted": len(saved_records),
            "average_mae": round(sum(mae_list) / len(mae_list), 3) if mae_list else None,
            "models_used": models_used,
            "created_by": admin_user.id,
            "created_at": datetime.now(timezone.utc),
        }
        try:
            db.demand_model_metadata.insert_one(meta_doc)
            log_event(
                db=db,
                event_type="DEMAND_FORECAST_GENERATED",
                details={
                    "subjects_forecasted": len(saved_records),
                    "periods_ahead": periods_ahead,
                    "organization_id": org_id,
                },
                user_id=admin_user.id,
                actor_id=admin_user.id,
            )
        except PyMongoError as pe:
            logger.warning("Could not insert demand metadata/log: %s", pe)

        return {
            "message": f"Generated and saved {len(saved_records)} course demand forecast(s).",
            "forecasts": saved_records,
            "metadata": {
                "organization_id": org_id,
                "subjects_forecasted": len(saved_records),
                "average_mae": meta_doc["average_mae"],
                "models_used": models_used,
                "created_at": meta_doc["created_at"].isoformat(),
            },
        }, None, 201

    @classmethod
    def get_forecast_history(
        cls,
        db: Database,
        actor_user: User,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Retrieve paginated persisted forecast snapshots strictly scoped to actor's organization."""
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = cls._require_valid_org_id(actor_user)
        if org_err:
            return None, org_err, org_code

        if page < 1:
            return None, "page must be >= 1.", 400
        if limit < 1 or limit > MAX_HISTORY_LIMIT:
            return None, f"limit must be between 1 and {MAX_HISTORY_LIMIT}.", 400

        query: Dict[str, Any] = {"organization_id": org_id}
        skip = (page - 1) * limit
        total = db.demand_forecasts.count_documents(query)
        cursor = (
            db.demand_forecasts.find(query)
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        items = [DemandForecastRecord.from_doc(d).to_dict() for d in cursor]
        return {
            "history": items,
            "total": total,
            "page": page,
            "limit": limit,
        }, None, 200

    @classmethod
    def get_model_metadata(
        cls,
        db: Database,
        actor_user: User,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], int]:
        """Return latest demand forecasting model evaluation metadata strictly scoped to organization."""
        if db is None:
            return None, "Database connection unavailable.", 500

        org_id, org_err, org_code = cls._require_valid_org_id(actor_user)
        if org_err:
            return None, org_err, org_code

        query: Dict[str, Any] = {"organization_id": org_id}
        latest = db.demand_model_metadata.find_one(query, sort=[("created_at", DESCENDING)])
        return {
            "organization_id": org_id,
            "methodology": {
                "engine": "Time-Series Walk-Forward Demand Forecaster (Phase 8B)",
                "models_compared": ["NaiveLastValue", "MovingAverage2", "RidgeLagForecaster"],
                "minimum_evidence_for_ml": f">= {MIN_RIDGE_HISTORY_TERMS} historical terms (>= {MIN_RIDGE_VALIDATION_SPLITS} common walk-forward validation splits)",
                "leakage_prevention": "Strictly past-only lag_1, lag_2, rolling_mean_2, momentum, and completion_lag_1 features.",
                "validation_strategy": "Common-origin expanding-window walk-forward validation across identical validation indices.",
                "uncertainty_note": "Prediction intervals are heuristic residual bands, not calibrated confidence intervals.",
            },
            "latest_run": {
                "subjects_forecasted": latest.get("subjects_forecasted") if latest else 0,
                "average_mae": latest.get("average_mae") if latest else None,
                "models_used": latest.get("models_used") if latest else {},
                "created_at": latest["created_at"].isoformat() if latest and latest.get("created_at") else None,
            },
        }, None, 200
