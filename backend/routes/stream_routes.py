"""
EduPredict - Real-Time Streaming & Batch Integration Routes (Phase 10)
Module: backend.routes.stream_routes
Purpose: Exposes authenticated endpoints for real-time event ingestion, SSE streaming,
operational monitoring (no student PII), retry recovery, and parallel batch backfills.
"""

from flask import Blueprint, Response, jsonify, request, stream_with_context
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.services.assignment_service import AssignmentService
from backend.services.batch_processor import BatchProcessor
from backend.services.event_streamer import EventStreamer
from backend.services.subject_service import SubjectService
from backend.utils.decorators import can_access_student_subject_data, role_required
from backend.utils.security import to_object_id

stream_bp = Blueprint("stream", __name__, url_prefix="/api/stream")


def _get_teacher_allowed_subject_names(db, teacher_id) -> list[str]:
    """Return canonical/display names of subjects assigned to a teacher."""
    assignments = AssignmentService.get_teacher_assignments(db, teacher_id, active_only=True)
    names: set[str] = set()
    for a in assignments:
        s_oid = to_object_id(a.get("subject_id"))
        if s_oid:
            subj = SubjectService.get_subject_by_id(db, s_oid)
            if subj:
                names.add(subj.name)
                if subj.canonical_key == "mathematics":
                    names.add("Mathematics")
                elif subj.canonical_key == "portuguese":
                    names.add("Portuguese Language")
    return sorted(names)


@stream_bp.route("/ingest", methods=["POST"])
@login_required
@role_required("admin", "teacher")
def ingest_stream_event():
    """
    Ingest a single real-time educational event.
    - Admin: can ingest for any student/subject.
    - Teacher: strictly restricted to students enrolled in their assigned subjects.
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Bad Request", "message": "Request body must be valid JSON.", "status_code": 400}), 400

    # Teacher subject authorization check before ingestion
    if getattr(current_user, "role", "") == "teacher":
        student_oid = to_object_id(data.get("student_id"))
        subj_str = (data.get("subject") or "").strip()
        term_str = (data.get("academic_term") or "").strip() or None
        if not student_oid or not subj_str:
            return jsonify({"error": "Bad Request", "message": "student_id and subject are required.", "status_code": 400}), 400
        if not can_access_student_subject_data(
            current_user,
            student_oid,
            subj_str,
            mongo.db,
            academic_term=term_str,
        ):
            return jsonify({
                "error": "Forbidden",
                "message": "Access denied. You are not authorized to ingest events for this student/subject.",
                "status_code": 403,
            }), 403

    simulate_fail = bool(data.get("simulate_transient_failure", False))
    res, err, status = EventStreamer.ingest_event(
        mongo.db,
        data,
        actor_user=current_user,
        simulate_transient_failure=simulate_fail,
    )
    if err and status == 500 and res:
        return jsonify({"status_code": 500, **res}), 500
    if err:
        return jsonify({"error": "Ingestion Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": status, **res}), status


@stream_bp.route("/batch-backfill", methods=["POST"])
@login_required
@role_required("admin")
def batch_backfill_events():
    """Admin-only parallel batch backfill endpoint."""
    data = request.get_json(silent=True) or {}
    records = data.get("records")
    max_workers = int(data.get("max_workers", 4))
    res, err, status = BatchProcessor.run_backfill(
        mongo.db,
        records=records,
        actor_user=current_user,
        max_workers=max_workers,
    )
    if err:
        return jsonify({"error": "Backfill Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": 200, **res}), 200


@stream_bp.route("/status", methods=["GET"])
@login_required
@role_required("admin", "analyst")
def get_stream_status():
    """
    Operational stream monitoring & batch-stream reconciliation summary.
    Strictly contains zero student PII.
    """
    metrics = EventStreamer.get_monitoring_status(mongo.db)
    reconciliation = BatchProcessor.get_reconciliation_summary(mongo.db)
    return jsonify({
        "status_code": 200,
        "metrics": metrics,
        "reconciliation": reconciliation,
    }), 200


@stream_bp.route("/events", methods=["GET"])
@login_required
@role_required("admin", "teacher")
def get_stream_events():
    """
    Stream events endpoint:
    - `?format=json` returns recent sanitized events (or default if Accept is application/json).
    - `Accept: text/event-stream` or `?format=sse` opens an SSE stream.
    Teachers only receive events for their assigned subjects.
    """
    role = getattr(current_user, "role", "")
    allowed_subjects = None
    if role == "teacher":
        allowed_subjects = _get_teacher_allowed_subject_names(mongo.db, current_user.id)

    fmt = (request.args.get("format") or "").strip().lower()
    accept = request.headers.get("Accept", "")
    if fmt == "sse" or ("text/event-stream" in accept and fmt != "json"):
        return Response(
            stream_with_context(EventStreamer.sse_stream(mongo.db, allowed_subjects=allowed_subjects)),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    limit = request.args.get("limit", default=50, type=int)
    status_filter = request.args.get("status")
    events = EventStreamer.list_recent_events(
        mongo.db,
        limit=limit,
        status=status_filter,
        subject_filter=allowed_subjects,
        sanitize_pii=True,
    )
    return jsonify({"status_code": 200, "events": events, "total": len(events)}), 200


@stream_bp.route("/retry/<event_id>", methods=["POST"])
@login_required
@role_required("admin")
def retry_stream_event(event_id: str):
    """Admin-only retry for failed stream events."""
    res, err, status = EventStreamer.retry_event(mongo.db, event_id, actor_user=current_user)
    if err:
        return jsonify({"error": "Retry Error", "message": err, "status_code": status}), status
    return jsonify({"status_code": status, **res}), status


@stream_bp.route("/student/<student_id>", methods=["GET"])
@login_required
@role_required("admin", "teacher", "student")
def get_student_stream_events(student_id: str):
    """
    Retrieve stream events for a specific student with strict RBAC & IDOR protection:
    - Student: own events only.
    - Teacher: only events for subjects where teacher is assigned and student is enrolled.
    - Admin: all events for the student.
    - Analyst: blocked (403) to preserve aggregate-only privacy.
    """
    student_oid = to_object_id(student_id)
    if not student_oid:
        return jsonify({"error": "Bad Request", "message": "Invalid student_id.", "status_code": 400}), 400

    role = getattr(current_user, "role", "")
    query = {"student_id": student_oid}

    if role == "student":
        if current_user.id != student_oid:
            return jsonify({"error": "Forbidden", "message": "Access denied.", "status_code": 403}), 403
    elif role == "teacher":
        allowed_subjects = _get_teacher_allowed_subject_names(mongo.db, current_user.id)
        if not allowed_subjects:
            return jsonify({"error": "Forbidden", "message": "No assigned subjects.", "status_code": 403}), 403
        # Verify at least one authorized subject enrollment
        authorized_subjects = [
            s for s in allowed_subjects
            if can_access_student_subject_data(current_user, student_oid, s, mongo.db)
        ]
        if not authorized_subjects:
            return jsonify({"error": "Forbidden", "message": "Access denied for this student.", "status_code": 403}), 403
        query["subject"] = {"$in": authorized_subjects}

    from pymongo import DESCENDING
    from backend.models.stream_event_model import StreamEvent

    cursor = mongo.db.stream_events.find(query).sort("received_at", DESCENDING).limit(50)
    events = [StreamEvent.from_doc(d).to_dict(sanitize_pii=False) for d in cursor]
    return jsonify({"status_code": 200, "events": events, "total": len(events)}), 200
