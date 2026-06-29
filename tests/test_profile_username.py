"""Tests for profile username validation, availability, and vanity URLs."""

import pytest
from backend.models.user import User


def test_username_availability_unauthenticated(client):
    """Test availability check is protected by authentication."""
    response = client.get("/profile/check-username?q=chaitanya")
    assert response.status_code == 401


def test_username_availability_flow(client, auth_headers, test_user, db_session):
    """Test username availability checks."""
    # Ensure test user is treated as registered
    test_user.discord_id = "discord_test_user_id"
    db_session.commit()

    # 1. Check a valid unused username
    response = client.get("/profile/check-username?q=unique_name", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["available"] is True

    # 2. Check an invalid username (too short)
    response = client.get("/profile/check-username?q=ab", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["available"] is False
    assert "characters" in response.json()["reason"]

    # 3. Check invalid characters
    response = client.get("/profile/check-username?q=invalid-chars!", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["available"] is False

    # 4. Create another user with a username
    other_user = User(
        id="other_user_id",
        display_name="Other User",
        discord_id="discord_other",
        discord_username="other",
        username="taken_name"
    )
    db_session.add(other_user)
    db_session.commit()

    # 5. Check if taken username is unavailable
    response = client.get("/profile/check-username?q=taken_name", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["available"] is False


def test_update_username_success(client, auth_headers, test_user, db_session):
    """Test successfully updating the username."""
    # Ensure test user is treated as registered (has discord_id)
    test_user.discord_id = "discord_test_user_id"
    db_session.commit()

    # 1. Update own profile with a new username
    update_data = {
        "display_name": "Test User New",
        "profile_theme": "cobalt",
        "bio": "New bio info",
        "banner_color": "synth",
        "banner_url": None,
        "banner_position": "50%",
        "banner_scale": "100%",
        "username": "chaitanya"
    }
    response = client.put("/profile/me", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "chaitanya"

    # 2. Verify public profile can be fetched by @username
    response = client.get("/profile/@chaitanya")
    assert response.status_code == 200
    assert response.json()["user"]["id"] == test_user.id
    assert response.json()["user"]["display_name"] == "Test User New"

    # 3. Verify public profile can be fetched by raw username
    response = client.get("/profile/chaitanya")
    assert response.status_code == 200
    assert response.json()["user"]["id"] == test_user.id
