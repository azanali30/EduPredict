"""
EduPredict - Administrative CLI Commands
Provides secure commands to provision administrators and initialize database schemas.
"""

import sys
import click
from flask import current_app
from flask.cli import with_appcontext
from backend.extensions import mongo
from backend.services.user_service import UserService
from backend.services.backup_service import BackupService, PROTECTED_DATABASES
from backend.database.schema import init_db_indexes


@click.command("create-admin")
@click.option("--email", prompt="Admin Email", help="Administrator email address.")
@click.option(
    "--password",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="Administrator password (min 8 chars, 1 letter, 1 digit).",
)
@click.option("--name", prompt="Full Name", default="System Administrator", help="Administrator full name.")
@with_appcontext
def create_admin_command(email, password, name):
    """Securely create the initial administrator account."""
    click.echo(f"Creating administrator account for '{email}'...")
    user, err = UserService.create_user(
        db=mongo.db,
        email=email,
        plain_password=password,
        full_name=name,
        role="admin",
    )
    if err or not user:
        click.echo(click.style(f"Error: {err}", fg="red"))
    else:
        click.echo(click.style(f"Administrator successfully created with ID: {user.id}", fg="green"))


@click.command("init-db")
@with_appcontext
def init_db_command():
    """Initialize MongoDB collections and indexes."""
    click.echo("Initializing MongoDB 6.x indexes for EduPredict...")
    try:
        created = init_db_indexes(mongo.db)
        for col, idxs in created.items():
            click.echo(f" - Collection '{col}': {len(idxs)} indexes created/verified.")
        click.echo(click.style("Database initialization complete.", fg="green"))
    except Exception as e:
        click.echo(click.style(f"Failed to initialize database: {str(e)}", fg="red"))
        sys.exit(1)


@click.command("backup-db")
@click.option("--retention", default=None, type=int, help="Number of backups to retain (default from config).")
@with_appcontext
def backup_db_command(retention):
    """Create a compressed, SHA-256-verified MongoDB BSON backup archive."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    ret = retention if retention is not None else current_app.config.get("BACKUP_RETENTION_COUNT", 7)
    meta, err = BackupService.create_backup(mongo.db, backup_dir=backup_dir, retention_count=ret)
    if err or not meta:
        click.echo(click.style(f"Backup failed: {err}", fg="red"), err=True)
        sys.exit(1)
    click.echo(
        click.style(
            f"Backup created: {meta['backup_id']} ({meta['total_documents']} docs, {meta['archive_size']} bytes)",
            fg="green",
        )
    )


@click.command("verify-backup")
@click.argument("backup_id")
@with_appcontext
def verify_backup_command(backup_id):
    """Verify SHA-256 checksums and BSON integrity of a backup archive."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    ok, details, err = BackupService.verify_backup(backup_dir=backup_dir, backup_id=backup_id, db=mongo.db)
    if not ok:
        click.echo(click.style(f"Verification failed: {err}", fg="red"), err=True)
        sys.exit(1)
    manifest = (details or {}).get("manifest", {})
    click.echo(
        click.style(
            f"Backup '{backup_id}' verified ({manifest.get('total_documents', 0)} docs across {len(manifest.get('collections', {}))} collections).",
            fg="green",
        )
    )


@click.command("list-backups")
@with_appcontext
def list_backups_command():
    """List available MongoDB backup archives."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    items = BackupService.list_backups(backup_dir)
    if not items:
        click.echo("No backups found.")
        return
    for b in items:
        status = "OK" if b.get("archive_exists") else "MISSING_ARCHIVE"
        click.echo(
            f"- {b.get('backup_id')} | {b.get('created_at')} | {b.get('total_documents', 0)} docs | {b.get('archive_size', 0)} bytes | {status}"
        )


@click.command("restore-db")
@click.argument("backup_id")
@click.option("--apply", is_flag=True, default=False, help="Actually apply restore (defaults to dry-run).")
@click.option("--replace", is_flag=True, default=False, help="Replace existing collections (creates safety backup first).")
@click.option("--yes", is_flag=True, default=False, help="Explicitly confirm destructive replacement.")
@click.option("--target-db", default=None, help="Optional target database name (e.g., for isolated recovery test).")
@with_appcontext
def restore_db_command(backup_id, apply, replace, yes, target_db):
    """Safely verify or restore a MongoDB backup archive (dry-run by default)."""
    backup_dir = current_app.config.get("BACKUP_DIR", "backups")
    db_obj = mongo.client[target_db] if (target_db and mongo.client is not None) else mongo.db
    if (getattr(db_obj, "name", "") or "").strip().lower() in PROTECTED_DATABASES:
        click.echo(click.style(f"Refusing restore into protected system database '{db_obj.name}'.", fg="red"), err=True)
        sys.exit(1)
    dry_run = not apply

    if replace and not dry_run and not yes:
        click.confirm(
            f"WARNING: Destructive restore into database '{db_obj.name}'. Continue?",
            abort=True,
        )
        yes = True

    res, err = BackupService.restore_backup(
        target_db=db_obj,
        backup_dir=backup_dir,
        backup_id=backup_id,
        dry_run=dry_run,
        replace_existing=replace,
        confirm_destructive=yes,
    )
    if err or not res:
        click.echo(click.style(f"Restore failed: {err}", fg="red"), err=True)
        sys.exit(1)
    click.echo(click.style(f"Restore status: {res.get('status')} (target: {res.get('target_database')})", fg="green"))