"""
EduPredict - Lightweight Sliding-Window Rate Limiter (Phase 8D)
Module: backend.utils.rate_limiter
Purpose: Protects expensive ML prediction and bulk evaluation endpoints from abuse.
"""

import time
import threading
from functools import wraps
from collections import defaultdict, deque
from flask import request, jsonify, current_app
from flask_login import current_user

_LOCK = threading.Lock()
_REQUEST_BUCKETS: dict[str, deque] = defaultdict(deque)


def reset_rate_limits() -> None:
    """Clear in-memory rate limit buckets (for unit testing)."""
    with _LOCK:
        _REQUEST_BUCKETS.clear()


def rate_limit(max_requests: int = 30, window_seconds: int = 60):
    """
    Sliding-window rate limiter decorator keyed by authenticated user_id (or IP) + endpoint.
    In TESTING mode, rate limiting is skipped unless app.config['ENFORCE_RATE_LIMIT_IN_TESTS'] is True.
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            is_testing = current_app.config.get("TESTING", False)
            enforce_in_tests = current_app.config.get("ENFORCE_RATE_LIMIT_IN_TESTS", False)
            if is_testing and not enforce_in_tests:
                return f(*args, **kwargs)

            actor_key = (
                str(getattr(current_user, "id", ""))
                if getattr(current_user, "is_authenticated", False)
                else (request.remote_addr or "anonymous")
            )
            bucket_key = f"{request.endpoint}:{actor_key}"
            now = time.monotonic()

            with _LOCK:
                dq = _REQUEST_BUCKETS[bucket_key]
                cutoff = now - window_seconds
                while dq and dq[0] <= cutoff:
                    dq.popleft()
                if len(dq) >= max_requests:
                    return jsonify({
                        "error": "Too Many Requests",
                        "message": f"Rate limit exceeded ({max_requests} requests per {window_seconds}s). Please retry shortly.",
                        "status_code": 429,
                    }), 429
                dq.append(now)

            return f(*args, **kwargs)
        return wrapped
    return decorator
