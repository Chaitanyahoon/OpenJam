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
    
    # Auto-migration: Check if 'is_admin', 'is_premium', 'stripe_customer_id' columns exist in 'users' table, and add them if missing
    from sqlalchemy import text
    is_admin_exists = True
    is_premium_exists = True
    stripe_customer_id_exists = True
    
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT is_admin FROM users LIMIT 1"))
        except Exception:
            is_admin_exists = False
        try:
            conn.execute(text("SELECT is_premium FROM users LIMIT 1"))
        except Exception:
            is_premium_exists = False
        try:
            conn.execute(text("SELECT stripe_customer_id FROM users LIMIT 1"))
        except Exception:
            stripe_customer_id_exists = False
        
    if not is_admin_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
            print("Successfully added is_admin column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.is_admin: {e}")

    if not is_premium_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE"))
            print("Successfully added is_premium column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.is_premium: {e}")

    if not stripe_customer_id_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR NULL"))
            print("Successfully added stripe_customer_id column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.stripe_customer_id: {e}")

    # Auto-migration: Check if 'password_hash' and 'is_private' columns exist in 'rooms' table, and add them if missing
    password_hash_exists = True
    is_private_exists = True
    
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT password_hash FROM rooms LIMIT 1"))
        except Exception:
            password_hash_exists = False
        try:
            conn.execute(text("SELECT is_private FROM rooms LIMIT 1"))
        except Exception:
            is_private_exists = False
            
    if not password_hash_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE rooms ADD COLUMN password_hash VARCHAR NULL"))
            print("Successfully added password_hash column to rooms table.")
        except Exception as e:
            print(f"Failed to auto-migrate rooms.password_hash: {e}")
            
    if not is_private_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE rooms ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE"))
            print("Successfully added is_private column to rooms table.")
        except Exception as e:
            print(f"Failed to auto-migrate rooms.is_private: {e}")
