"""
EduPredict - Administrative CLI Commands
Provides secure commands to provision administrators and initialize database schemas.
"""

import click
from flask.cli import with_appcontext
from backend.extensions import mongo
from backend.services.user_service import UserService
from backend.services.global_audit_service import log_global_event
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


@click.command("create-super-admin")
@click.option("--email", prompt="Super Admin Email", help="Platform Super Admin email address.")
@click.option(
    "--password",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="Strong password (min 8 chars, 1 letter, 1 digit).",
)
@click.option("--name", prompt="Full Name", default="Platform Super Admin", help="Super Admin full name.")
@with_appcontext
def create_super_admin_command(email, password, name):
    """Securely provision an initial Platform Super Admin account (no hardcoded defaults)."""
    click.echo(f"Provisioning Platform Super Admin '{email}'...")
    user, err = UserService.create_user(
        db=mongo.db,
        email=email,
        plain_password=password,
        full_name=name,
        role="platform_super_admin",
    )
    if err or not user:
        click.echo(click.style(f"Error: {err}", fg="red"))
        return
    log_global_event(
        db=mongo.db,
        action="PLATFORM_SUPER_ADMIN_PROVISIONED",
        actor_id=user.id,
        actor_role="platform_super_admin",
        resource_type="user",
        resource_id=str(user.id),
        metadata={"email": user.email},
        outcome="success",
    )
    click.echo(click.style(f"Platform Super Admin created with ID: {user.id}", fg="green"))


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
