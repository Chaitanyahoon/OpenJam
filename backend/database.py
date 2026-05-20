import os

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    db_url = make_url(settings.DATABASE_URL)
    if db_url.database and db_url.database != ":memory:":
        db_dir = os.path.dirname(os.path.abspath(db_url.database))
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

engine_kwargs = {"echo": False}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL — Supabase free tier allows max 2 simultaneous connections.
    # With PgBouncer (port 6543) in transaction mode, 2 connections handle many users.
    engine_kwargs["pool_size"] = 1          # Keep only 1 connection in pool
    engine_kwargs["max_overflow"] = 1       # Allow 1 extra during bursts (total ≤ 2)
    engine_kwargs["pool_pre_ping"] = True   # Verify connection before use
    engine_kwargs["pool_recycle"] = 120     # Recycle every 2 min to stay fresh
    engine_kwargs["connect_args"] = {
        "connect_timeout": 10,              # Fail fast if DB is unreachable
    }

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)


if is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from backend.models import User, Room, QueueItem, ChatMessage, Vote  # noqa: F401
    Base.metadata.create_all(bind=engine)
    
    # Auto-migration: Check if 'is_admin' column exists in 'users' table, and add it if missing
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            # We wrap in a text() object for SQLAlchemy 2.0 compatibility
            conn.execute(text("SELECT is_admin FROM users LIMIT 1"))
        except Exception:
            try:
                # Add the missing is_admin column (compatible with PostgreSQL and SQLite)
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
            except Exception as e:
                # Log or print the error
                print(f"Failed to auto-migrate users.is_admin: {e}")
