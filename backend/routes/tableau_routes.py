"""
EduPredict - Tableau BI Export REST Routes (Workstream B / Phase 14)
Module: backend.routes.tableau_routes
Purpose: Provides RBAC-protected endpoints for discovering and exporting non-PII,
SDC-aware Tableau-compatible CSV and JSON datasets.
"""

from flask import Blueprint, Response, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.bigdata.tableau_export_service import TableauExportService
from backend.services.system_log_service import log_event
from backend.utils.decorators import role_required

tableau_bp = Blueprint("tableau", __name__, url_prefix="/api/tableau")


@tableau_bp.route("/datasets", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def list_tableau_datasets():
    """List supported non-PII Tableau BI analytical export schemas and source counts."""
    datasets = TableauExportService.list_available_datasets(mongo.db)
    return jsonify({
        "status_code": 200,
        "datasets": datasets,
        "count": len(datasets),
    }), 200


@tableau_bp.route("/export/<dataset_name>", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def export_tableau_dataset(dataset_name: str):
    """Export one aggregated dataset in JSON or downloadable formula-safe CSV."""
    output_format = request.args.get("format", "json")
    apply_sdc_param = request.args.get("apply_sdc")
    apply_sdc = None
    if apply_sdc_param is not None:
        apply_sdc = apply_sdc_param.strip().lower() in ("1", "true", "yes")

    res, err, status = TableauExportService.generate_export(
        mongo.db,
        dataset_name=dataset_name,
        actor_user=current_user,
        output_format=output_format,
        apply_sdc=apply_sdc,
    )
    if err or res is None:
        return jsonify({"error": "Tableau Export Error", "message": err, "status_code": status}), status

    log_event(
        mongo.db,
        event_type="tableau_export_generated",
        actor_id=current_user.id,
        details={
            "dataset": res["metadata"]["dataset"],
            "format": res["metadata"]["format"],
            "sdc_enforced": res["metadata"]["sdc_enforced"],
            "row_count": res["metadata"]["row_count"],
        },
    )

    if res["metadata"]["format"] == "csv":
        filename = f"edupredict_tableau_{res['metadata']['dataset']}.csv"
        return Response(
            res["csv_content"],
            status=200,
            mimetype="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return jsonify({"status_code": 200, **res}), 200
