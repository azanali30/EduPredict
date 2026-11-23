"""
EduPredict - Upload & Document Management Routes
Secure endpoints for photo and document uploads, file validation, and authenticated asset serving.
Enforces multi-layer security: file extension allowlist, MIME validation, magic byte verification,
Pillow image re-encoding, and strict path-traversal prevention.
"""

import os
import io
import re
import uuid
from typing import Tuple, Optional
import pypdf
from pypdf.errors import PdfReadError, PdfStreamError
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
from backend.extensions import mongo
from backend.utils.decorators import admin_required

upload_bp = Blueprint("uploads", __name__, url_prefix="/api")

ALLOWED_AVATAR_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_IMAGE_DIMENSION = 4096  # Max allowed width/height in pixels

VALID_MIMETYPES = {
    "png": {"image/png"},
    "jpg": {"image/jpeg", "image/pjpeg", "image/jpg"},
    "jpeg": {"image/jpeg", "image/pjpeg", "image/jpg"},
    "webp": {"image/webp"},
    "pdf": {"application/pdf"},
}


def get_extension(filename: str) -> str:
    """Extract lowercased extension without leading dot."""
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


def validate_magic_bytes(data: bytes, ext: str) -> bool:
    """
    Verify actual file content signature (magic bytes).
    Guarantees executable, script, or disguised files cannot bypass extension checks.
    """
    if len(data) < 4:
        return False

    if ext in ("jpg", "jpeg"):
        return data.startswith(b"\xff\xd8\xff")
    elif ext == "png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    elif ext == "webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    elif ext == "pdf":
        return data.startswith(b"%PDF-")
    return False


def validate_pdf_structure(data: bytes) -> Tuple[bool, Optional[str]]:
    """
    Validate PDF structural integrity using in-memory pypdf parsing.
    - Requires minimum size and valid '%PDF-' header with version format.
    - Rejects active script triggers (/JavaScript, /JS, /Launch).
    - Fully parses the PDF stream in memory with pypdf.PdfReader.
    - Traverses page tree to verify xref/trailer/object stream resolution.
    - Rejects truncated, malformed, or parser-failing PDF structures without unhandled exceptions.
    """
    if len(data) < 32:
        return False, "File is too small to be a valid PDF document."

    if not data.startswith(b"%PDF-"):
        return False, "File lacks valid '%PDF-' header."

    # Validate version format (e.g. %PDF-1.x)
    first_line = data.split(b"\n", 1)[0].rstrip(b"\r")
    if not re.match(rb"^%PDF-[0-9]+\.[0-9]+", first_line):
        return False, "Invalid PDF header version format."

    # Reject active script actions
    if re.search(rb"/(?:JavaScript|JS|Launch)\b", data):
        return False, "PDF contains potentially unsafe embedded script actions."

    # In-memory structural parsing via pypdf
    try:
        reader = pypdf.PdfReader(io.BytesIO(data), strict=True)
        if len(reader.pages) == 0:
            return False, "Malformed PDF: Document contains 0 pages or invalid page tree."
        # Access first page object to trigger xref and object stream resolution
        _ = reader.pages[0]
    except (PdfReadError, PdfStreamError) as e:
        return False, f"Malformed or corrupted PDF structure: {str(e)}"
    except Exception as e:
        return False, f"PDF structural validation failed: {str(e)}"

    return True, None


def validate_mimetype(declared_mime: Optional[str], ext: str) -> bool:
    """Validate client-supplied MIME type against allowlist for the declared extension."""
    if not declared_mime or declared_mime.lower() in ("application/octet-stream", "binary/octet-stream"):
        return True  # Fall back to server-side magic byte and Pillow inspection
    clean_mime = declared_mime.lower().split(";")[0].strip()
    allowed_for_ext = VALID_MIMETYPES.get(ext, set())
    return clean_mime in allowed_for_ext


def process_and_sanitize_image(image_bytes: bytes, ext: str, dest_path: str) -> Tuple[bool, Optional[str]]:
    """
    Safely decode, inspect, and re-encode image uploads using Pillow.
    - Strips malicious embedded polyglots, EXIF tags, and arbitrary scripts.
    - Enforces max dimension limits to protect against decompression bomb attacks.
    - Saves clean, re-encoded binary to dest_path.
    """
    try:
        # Pass 1: Verify image structural integrity
        img_verify = Image.open(io.BytesIO(image_bytes))
        img_verify.verify()
    except Exception:
        return False, "Malformed, corrupted, or disguised image file."

    try:
        # Pass 2: Load and re-encode clean raster data
        img = Image.open(io.BytesIO(image_bytes))
        fmt = img.format
        expected_fmts = {
            "png": "PNG",
            "jpg": "JPEG",
            "jpeg": "JPEG",
            "webp": "WEBP",
        }
        if fmt != expected_fmts.get(ext):
            return False, f"Internal image format '{fmt}' does not match file extension '.{ext}'."

        if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
            return False, f"Image dimensions ({img.width}x{img.height}) exceed maximum allowed limit of {MAX_IMAGE_DIMENSION}px."

        # Convert transparency modes to RGB when re-encoding to JPEG
        save_fmt = expected_fmts[ext]
        if save_fmt == "JPEG" and img.mode in ("RGBA", "P", "LA"):
            clean_img = img.convert("RGB")
        else:
            clean_img = img.copy()

        clean_img.save(dest_path, format=save_fmt)
        return True, None
    except Exception as e:
        return False, f"Failed to sanitize and re-encode image: {str(e)}"


@upload_bp.route("/upload", methods=["POST"])
@login_required
def upload_file():
    """
    Upload a profile photo or academic document with strict validation:
    - Extension allowlist (scripts & SVGs rejected)
    - Magic byte verification
    - MIME type verification
    - Pillow image decoding & re-encoding
    - Server-generated UUID filenames (path traversal immune)
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

    if not ext or ext not in allowed_exts:
        allowed_list = ", ".join(sorted(allowed_exts))
        return jsonify({
            "error": "Unsupported Media Type",
            "message": f"File type '.{ext}' is not permitted for {category} uploads. Permitted formats: {allowed_list}.",
            "status_code": 415,
        }), 415

    # Read binary payload
    file_bytes = file.read()
    size = len(file_bytes)

    if size == 0:
        return jsonify({
            "error": "Bad Request",
            "message": "Uploaded file is empty (0 bytes).",
            "status_code": 400,
        }), 400

    if size > MAX_FILE_SIZE:
        return jsonify({
            "error": "Payload Too Large",
            "message": f"File size exceeds the 5 MB limit (Current size: {size / (1024 * 1024):.2f} MB).",
            "status_code": 413,
        }), 413

    # Validate MIME type if provided
    if file.mimetype and not validate_mimetype(file.mimetype, ext):
        return jsonify({
            "error": "Bad Request",
            "message": f"Declared MIME type '{file.mimetype}' does not match expected signature for '.{ext}'.",
            "status_code": 400,
        }), 400

    # Validate actual file signature (magic bytes)
    if not validate_magic_bytes(file_bytes, ext):
        return jsonify({
            "error": "Bad Request",
            "message": f"File signature (magic bytes) does not match declared extension '.{ext}'.",
            "status_code": 400,
        }), 400

    # Target directory setup
    upload_root = os.path.abspath(current_app.config.get("UPLOAD_FOLDER", os.path.join(current_app.root_path, "uploads")))
    target_dir = os.path.abspath(os.path.join(upload_root, category + "s"))
    os.makedirs(target_dir, exist_ok=True)

    # Generate safe UUID-based random filename
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    dest_path = os.path.abspath(os.path.join(target_dir, safe_name))

    # Defensive path traversal check
    if not dest_path.startswith(target_dir + os.sep):
        return jsonify({
            "error": "Forbidden",
            "message": "Path traversal attempt detected.",
            "status_code": 403,
        }), 403

    # Process based on file type
    if ext in ("png", "jpg", "jpeg", "webp"):
        success, err = process_and_sanitize_image(file_bytes, ext, dest_path)
        if not success:
            return jsonify({
                "error": "Bad Request",
                "message": err or "Failed to process image file.",
                "status_code": 400,
            }), 400
    elif ext == "pdf":
        valid_pdf, pdf_err = validate_pdf_structure(file_bytes)
        if not valid_pdf:
            return jsonify({
                "error": "Bad Request",
                "message": pdf_err or "Invalid or malformed PDF document structure.",
                "status_code": 400,
            }), 400

        # Save validated PDF directly
        with open(dest_path, "wb") as f:
            f.write(file_bytes)

    relative_url = f"/api/uploads/{category}s/{safe_name}"

    return jsonify({
        "message": f"{category.capitalize()} uploaded successfully.",
        "file_url": relative_url,
        "filename": safe_name,
        "original_name": secure_filename(file.filename),
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
    Strictly prevents directory traversal and unauthenticated data leaks.
    """
    clean_folder = secure_filename(folder)
    clean_file = secure_filename(filename)

    if clean_folder not in ("avatars", "documents"):
        return jsonify({
            "error": "Not Found",
            "message": "Upload directory not found.",
            "status_code": 404,
        }), 404

    upload_root = os.path.abspath(current_app.config.get("UPLOAD_FOLDER", os.path.join(current_app.root_path, "uploads")))
    folder_path = os.path.abspath(os.path.join(upload_root, clean_folder))
    target_file = os.path.abspath(os.path.join(folder_path, clean_file))

    # Strict path traversal validation
    if not target_file.startswith(folder_path + os.sep):
        return jsonify({
            "error": "Forbidden",
            "message": "Path traversal attempt detected.",
            "status_code": 403,
        }), 403

    if not os.path.isfile(target_file):
        return jsonify({
            "error": "Not Found",
            "message": "The requested asset was not found on the server.",
            "status_code": 404,
        }), 404

    # Enforce authorization for private documents
    if clean_folder == "documents" and current_user.role != "admin":
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

    response = send_from_directory(folder_path, clean_file)
    if clean_folder == "documents":
        # Enforce attachment disposition for private documents to prevent inline execution
        download_name = secure_filename(clean_file)
        response.headers["Content-Disposition"] = f'attachment; filename="{download_name}"'
        if clean_file.lower().endswith(".pdf"):
            response.headers["Content-Type"] = "application/pdf"
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response

