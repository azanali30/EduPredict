"""
EduPredict - Upload & Document Management Routes
Secure endpoints for photo and document uploads, file validation, and authenticated asset serving.
"""

import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from backend.extensions import mongo
from backend.utils.decorators import admin_required

upload_bp = Blueprint("uploads", __name__, url_prefix="/api")

ALLOWED_AVATAR_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "doc", "docx", "png", "jpg", "jpeg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def get_extension(filename: str) -> str:
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


@upload_bp.route("/upload", methods=["POST"])
@login_required
def upload_file():
    """
    Upload a profile photo or academic document.
    Expects multipart/form-data:
      - file: binary file payload
      - category: 'avatar' | 'document' (default: 'document')
    """
    if "file" not in request.files:
        return jsonify({
            "error": "Bad Request",
            "message": "No file field included in multipart request.",
            "status_code": 400,
        }), 400

    file = request.files["file"]
    if not file or not file.filename or not file.filename.strip():
        return jsonify({
            "error": "Bad Request",
            "message": "No file selected for upload.",
            "status_code": 400,
        }), 400

    category = request.form.get("category", "document").strip().lower()
    if category not in ("avatar", "document"):
        category = "document"

    ext = get_extension(file.filename)
    allowed_exts = ALLOWED_AVATAR_EXTENSIONS if category == "avatar" else ALLOWED_DOCUMENT_EXTENSIONS

    if ext not in allowed_exts:
        allowed_list = ", ".join(sorted(allowed_exts))
        return jsonify({
            "error": "Unsupported Media Type",
            "message": f"File type '.{ext}' is not permitted for {category} uploads. Permitted formats: {allowed_list}.",
            "status_code": 415,
        }), 415

    # Validate file size (<= 5 MB)
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)

    if size > MAX_FILE_SIZE:
        return jsonify({
            "error": "Payload Too Large",
            "message": f"File size exceeds the 5 MB limit (Current size: {size / (1024 * 1024):.2f} MB).",
            "status_code": 413,
        }), 413

    if size == 0:
        return jsonify({
            "error": "Bad Request",
            "message": "Uploaded file is empty (0 bytes).",
            "status_code": 400,
        }), 400

    # Ensure target directory exists
    upload_root = current_app.config.get("UPLOAD_FOLDER", os.path.join(current_app.root_path, "uploads"))
    target_dir = os.path.join(upload_root, category + "s")  # avatars or documents
    os.makedirs(target_dir, exist_ok=True)

    safe_original = secure_filename(file.filename)
    safe_name = f"{uuid.uuid4().hex}_{safe_original}"
    dest_path = os.path.join(target_dir, safe_name)
    file.save(dest_path)

    relative_url = f"/api/uploads/{category}s/{safe_name}"

    return jsonify({
        "message": f"{category.capitalize()} uploaded successfully.",
        "file_url": relative_url,
        "filename": safe_name,
        "original_name": file.filename,
        "file_type": ext,
        "size": size,
        "category": category,
        "status_code": 201,
    }), 201


@upload_bp.route("/uploads/<folder>/<filename>", methods=["GET"])
@login_required
def serve_upload(folder: str, filename: str):
    """
    Serve uploaded assets with role and ownership access control.
    - Avatars: Accessible to authenticated users.
    - Documents: Accessible to administrators or the owning user (student/teacher).
    Prevents directory traversal and unauthenticated data leaks.
    """
    clean_folder = secure_filename(folder)
    clean_file = secure_filename(filename)

    if clean_folder not in ("avatars", "documents"):
        return jsonify({
            "error": "Not Found",
            "message": "Upload directory not found.",
            "status_code": 404,
        }), 404

    upload_root = current_app.config.get("UPLOAD_FOLDER", os.path.join(current_app.root_path, "uploads"))
    folder_path = os.path.join(upload_root, clean_folder)
    target_file = os.path.join(folder_path, clean_file)

    if not os.path.isfile(target_file):
        return jsonify({
            "error": "Not Found",
            "message": "The requested asset was not found on the server.",
            "status_code": 404,
        }), 404

    # Enforce authorization for private documents
    if clean_folder == "documents" and current_user.role != "admin":
        # Check if the document belongs to current_user
        has_access = False
        user_docs = getattr(current_user, "documents", []) or []
        for doc in user_docs:
            if clean_file in doc.get("file_url", "") or clean_file == doc.get("filename"):
                has_access = True
                break

        if not has_access:
            return jsonify({
                "error": "Forbidden",
                "message": "You do not have authorization to view this private document.",
                "status_code": 403,
            }), 403

    return send_from_directory(folder_path, clean_file)
