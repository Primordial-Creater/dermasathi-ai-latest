from logging.config import fileConfig
from pathlib import Path
import sys
import os

from alembic import context
from sqlalchemy import create_engine, pool

# Ensure the backend root is importable.
BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.db.base import Base
import app.models.persistence

# Register every existing ORM model.
import app.models.audit
import app.models.consultation
import app.models.prescription
import app.models.user
import app.models.platform


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# Optional isolated schema for baseline generation and migration tests.
MIGRATION_SCHEMA = os.environ.get("DERMASATHI_ALEMBIC_SCHEMA")

if MIGRATION_SCHEMA and not MIGRATION_SCHEMA.replace("_", "").isalnum():
    raise RuntimeError("Invalid migration schema identifier.")

VERSION_TABLE_SCHEMA = MIGRATION_SCHEMA or "public"


def migration_connect_args():
    if MIGRATION_SCHEMA:
        return {"options": f"-csearch_path={MIGRATION_SCHEMA}"}
    return {}



def include_object(obj, name, type_, reflected, compare_to):
    """Exclude Alembic's internal version table from ORM schema diffs."""

    if type_ == "table" and name == "alembic_version":
        return False

    return True



def run_migrations_offline():

    database_url = settings.DATABASE_URL

    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        version_table_schema=VERSION_TABLE_SCHEMA,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():

    connectable = create_engine(
        settings.DATABASE_URL,
        connect_args=migration_connect_args(),
        poolclass=pool.NullPool,
        pool_pre_ping=True,
    )

    try:

        with connectable.connect() as connection:

            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                include_object=include_object,
                compare_type=True,
                compare_server_default=True,
                version_table_schema=VERSION_TABLE_SCHEMA,
                transaction_per_migration=True,
            )

            with context.begin_transaction():
                context.run_migrations()

    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
