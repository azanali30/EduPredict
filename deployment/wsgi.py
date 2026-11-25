"""
EduPredict - Production Waitress WSGI Entrypoint (Phase 9)
Run with: python -m waitress --host=127.0.0.1 --port=8000 --threads=8 deployment.wsgi:application
"""

import os
from backend.app import create_app

application = create_app(os.getenv("FLASK_ENV", "production"))
