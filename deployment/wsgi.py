"""
EduPredict - Production Waitress WSGI Entrypoint (Single-Institution)
Run with: python -m waitress --host=127.0.0.1 --port=8000 --threads=8 deployment.wsgi:application

Scalability Note:
- Waitress runs as a single OS process with multiple worker threads (`--threads=8`).
- `SSEBroadcaster` and `rate_limiter` share memory cleanly across all threads in this process.
- Scaling to multiple independent WSGI OS processes requires migrating SSE pub/sub and rate-limit
  buckets to a shared external store (not enabled in the current single-institution deployment).
"""

import os
from backend.app import create_app

application = create_app(os.getenv("FLASK_ENV", "production"))
