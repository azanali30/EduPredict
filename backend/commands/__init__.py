"""
EduPredict - CLI Commands Package
"""

from backend.commands.admin_commands import create_admin_command, init_db_command

__all__ = ["create_admin_command", "init_db_command"]
