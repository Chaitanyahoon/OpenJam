"""Pytest configuration and fixtures for Open Jam tests."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.database import Base, get_db
from backend.models.user import User
from backend.models.room import Room
from backend.middleware.auth import create_session_token


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_engine():
    """Create test database engine."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create test database session."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create test client with database override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session):
    """Create test user."""
    user = User(
        display_name="Test User",
        avatar_url="https://example.com/avatar.jpg",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_room(db_session, test_user):
    """Create test room."""
    import json
    room = Room(
        name="Test Room",
        host_user_id=test_user.id,
        description="A test room",
        genre_tags=json.dumps(["test", "demo"]),
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


@pytest.fixture(scope="function")
def auth_token(test_user):
    """Create authentication token for test user."""
    return create_session_token(test_user.id, display_name=test_user.display_name)


@pytest.fixture(scope="function")
def auth_headers(auth_token):
    """Create auth headers with token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Cookie": f"session_token={auth_token}",
    }
