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
    from backend.models import User, Room, QueueItem, ChatMessage, Vote, UserLike, Playlist, PlaylistTrack, PlaylistLike, Follow  # noqa: F401
    Base.metadata.create_all(bind=engine)
    
    # Auto-migration: Check if 'is_admin', 'is_premium', 'stripe_customer_id', 'bio', 'banner_color' columns exist in 'users' table, and add them if missing
    from sqlalchemy import text
    is_admin_exists = True
    is_premium_exists = True
    stripe_customer_id_exists = True
    bio_exists = True
    banner_color_exists = True
    
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
        try:
            conn.execute(text("SELECT bio FROM users LIMIT 1"))
        except Exception:
            bio_exists = False
        try:
            conn.execute(text("SELECT banner_color FROM users LIMIT 1"))
        except Exception:
            banner_color_exists = False
        
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

    if not bio_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN bio VARCHAR"))
            print("Successfully added bio column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.bio: {e}")

    if not banner_color_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN banner_color VARCHAR NOT NULL DEFAULT 'default'"))
            print("Successfully added banner_color column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.banner_color: {e}")

    # Check for banner_url in users
    banner_url_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT banner_url FROM users LIMIT 1"))
        except Exception:
            banner_url_exists = False

    if not banner_url_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN banner_url VARCHAR NULL"))
            print("Successfully added banner_url column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.banner_url: {e}")

    # Check for banner_position in users
    banner_position_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT banner_position FROM users LIMIT 1"))
        except Exception:
            banner_position_exists = False

    if not banner_position_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN banner_position VARCHAR NOT NULL DEFAULT '50%'"))
            print("Successfully added banner_position column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.banner_position: {e}")

    # Check for banner_scale in users
    banner_scale_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT banner_scale FROM users LIMIT 1"))
        except Exception:
            banner_scale_exists = False

    if not banner_scale_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN banner_scale VARCHAR NOT NULL DEFAULT '100%'"))
            print("Successfully added banner_scale column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.banner_scale: {e}")

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

    # Check for allow_guest_controls in rooms
    allow_guest_controls_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT allow_guest_controls FROM rooms LIMIT 1"))
        except Exception:
            allow_guest_controls_exists = False

    if not allow_guest_controls_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE rooms ADD COLUMN allow_guest_controls BOOLEAN NOT NULL DEFAULT FALSE"))
            print("Successfully added allow_guest_controls column to rooms table.")
        except Exception as e:
            print(f"Failed to auto-migrate rooms.allow_guest_controls: {e}")

    # Auto-migration: Discord OAuth2 columns in 'users' table
    discord_id_exists = True
    discord_username_exists = True
    
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT discord_id FROM users LIMIT 1"))
        except Exception:
            discord_id_exists = False
        try:
            conn.execute(text("SELECT discord_username FROM users LIMIT 1"))
        except Exception:
            discord_username_exists = False

    if not discord_id_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN discord_id VARCHAR NULL UNIQUE"))
            print("Successfully added discord_id column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.discord_id: {e}")

    if not discord_username_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN discord_username VARCHAR NULL"))
            print("Successfully added discord_username column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.discord_username: {e}")

    # Auto-migration: Check if 'profile_theme' exists in 'users' table, and add it if missing
    profile_theme_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT profile_theme FROM users LIMIT 1"))
        except Exception:
            profile_theme_exists = False

    if not profile_theme_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_theme VARCHAR NOT NULL DEFAULT 'amber'"))
            print("Successfully added profile_theme column to users table.")
        except Exception as e:
            print(f"Failed to auto-migrate users.profile_theme: {e}")

    # Auto-migration: Check if 'import_url' exists in 'playlists' table, and add it if missing
    import_url_exists = True
    last_synced_at_exists = True
    auto_sync_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT import_url FROM playlists LIMIT 1"))
        except Exception:
            import_url_exists = False
        try:
            conn.execute(text("SELECT last_synced_at FROM playlists LIMIT 1"))
        except Exception:
            last_synced_at_exists = False
        try:
            conn.execute(text("SELECT auto_sync FROM playlists LIMIT 1"))
        except Exception:
            auto_sync_exists = False

    if not import_url_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE playlists ADD COLUMN import_url VARCHAR NULL"))
            print("Successfully added import_url column to playlists table.")
        except Exception as e:
            print(f"Failed to auto-migrate playlists.import_url: {e}")

    if not last_synced_at_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE playlists ADD COLUMN last_synced_at TIMESTAMP NULL"))
            print("Successfully added last_synced_at column to playlists table.")
        except Exception as e:
            print(f"Failed to auto-migrate playlists.last_synced_at: {e}")

    if not auto_sync_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE playlists ADD COLUMN auto_sync BOOLEAN NOT NULL DEFAULT TRUE"))
            print("Successfully added auto_sync column to playlists table.")
        except Exception as e:
            print(f"Failed to auto-migrate playlists.auto_sync: {e}")

    # Auto-migration: Check if 'username' exists in 'users' table, and add it if missing
    username_exists = True
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT username FROM users LIMIT 1"))
        except Exception:
            username_exists = False

    if not username_exists:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR NULL"))
            print("Successfully added username column to users table.")
            
            # Create index
            try:
                with engine.begin() as conn:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)"))
                print("Successfully created unique index for users.username.")
            except Exception as e:
                print(f"Failed to create unique index for users.username: {e}")
                
            # Backfill existing users
            import re
            from backend.models.user import User
            
            db = SessionLocal()
            try:
                users = db.query(User).all()
                existing_usernames = set()
                for u in users:
                    if u.username:
                        existing_usernames.add(u.username.lower())
                
                for u in users:
                    if not u.username:
                        base = u.discord_username or u.display_name or "jammer"
                        base_clean = re.sub(r'[^a-zA-Z0-9_]', '', base).lower()
                        if not base_clean or len(base_clean) < 3:
                            base_clean = "jammer"
                        base_clean = base_clean[:15]
                        
                        candidate = base_clean
                        counter = 1
                        while candidate in existing_usernames:
                            suffix = f"_{counter}"
                            candidate = f"{base_clean}{suffix}"
                            counter += 1
                        
                        u.username = candidate
                        existing_usernames.add(candidate)
                db.commit()
                print(f"Successfully backfilled usernames for {len(users)} users.")
            except Exception as e:
                print(f"Failed to backfill usernames: {e}")
                db.rollback()
            finally:
                db.close()
        except Exception as e:
            print(f"Failed to auto-migrate users.username: {e}")


def safe_isoformat(dt) -> str:
    """Safely convert a datetime object or raw SQLite string to an ISO 8601 formatted string."""
    if dt is None:
        return None
    if isinstance(dt, str):
        # Normalize SQLite space separator to 'T'
        return dt.replace(" ", "T")
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


