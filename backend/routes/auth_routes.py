"""
EduPredict - Authentication Routes
Endpoints for registration, login, logout, and session lifecycle.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf.csrf import generate_csrf
from backend.extensions import mongo
from backend.services.auth_service import AuthService

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/csrf-token", methods=["GET"])
def get_csrf_token():
    """Retrieve a valid CSRF token for web clients."""
    token = generate_csrf()
    return jsonify({"csrf_token": token}), 200


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    """
    Register a new student account.
    Expects JSON: { "email": "...", "password": "...", "full_name": "..." }
    Always enforces role='student'.
    """
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name")
    requested_role = data.get("role")

    if requested_role and requested_role != "student":
        return jsonify({
            "error": "Bad Request",
            "message": "Public registration is only permitted for student accounts. Other roles must be provisioned by an administrator.",
            "status_code": 400,
        }), 400

    if not email or not password or not full_name:
        return jsonify({
            "error": "Bad Request",
            "message": "email, password, and full_name are required fields.",
            "status_code": 400,
        }), 400

    user_dict, err = AuthService.register_student(
        db=mongo.db,
        email=email,
        password=password,
        full_name=full_name,
    )

    if err:
        status_code = 409 if "already exists" in err.lower() else 400
        return jsonify({
            "error": "Registration Failed",
            "message": err,
            "status_code": status_code,
        }), status_code

    return jsonify({
        "message": "Registration successful. You may now log in.",
        "user": user_dict,
        "status_code": 201,
    }), 201


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    """
    Authenticate user and establish session via Flask-Login.
    Expects JSON: { "email": "...", "password": "...", "remember": bool (optional) }
    """
    data = request.get_json()
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be valid JSON.",
            "status_code": 400,
        }), 400

    email = data.get("email")
    password = data.get("password")
    remember = bool(data.get("remember", False))

    if not email or not password:
        return jsonify({
            "error": "Bad Request",
            "message": "Both email and password are required.",
            "status_code": 400,
        }), 400

    ip_addr = request.remote_addr
    user, err = AuthService.authenticate(
        db=mongo.db,
        email=email,
        password=password,
        ip_address=ip_addr,
    )

    if err or not user:
        return jsonify({
            "error": "Authentication Failed",
            "message": err or "Invalid email or password.",
            "status_code": 401,
        }), 401

    # Establish session
    login_user(user, remember=remember)

    return jsonify({
        "message": "Login successful.",
        "user": user.to_dict(),
        "status_code": 200,
    }), 200


@auth_bp.route("/auth/logout", methods=["POST"])
@login_required
def logout():
    """Terminate the active user session."""
    logout_user()
    return jsonify({
        "message": "Successfully logged out.",
        "status_code": 200,
    }), 200
