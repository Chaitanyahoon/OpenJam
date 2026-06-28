"""Tests for profile social follow/unfollow features."""

import pytest
from backend.models.user import User
from backend.models.follow import Follow


def test_follow_unauthenticated(client):
    """Test follow endpoint is protected by authentication."""
    response = client.post("/profile/some-user/follow")
    assert response.status_code == 401


def test_follow_self_fails(client, auth_headers, test_user):
    """Test users cannot follow themselves."""
    response = client.post(f"/profile/{test_user.id}/follow", headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot follow yourself"


def test_follow_user_not_found(client, auth_headers):
    """Test following a non-existent user."""
    response = client.post("/profile/non-existent-user-id/follow", headers=auth_headers)
    assert response.status_code == 404


def test_follow_unfollow_flow(client, auth_headers, test_user, db_session):
    """Test following and unfollowing another registered user."""
    # Create another user to follow
    other_user = User(
        id="other_user_id",
        display_name="Other User",
        discord_id="discord_other",
        discord_username="other"
    )
    db_session.add(other_user)
    db_session.commit()

    # 1. Check social counts initially
    response = client.get(f"/profile/{other_user.id}/social", headers=auth_headers)
    assert response.status_code == 200
    social_data = response.json()
    assert social_data["followers_count"] == 0
    assert social_data["following_count"] == 0
    assert social_data["is_following"] is False

    # 2. Follow other user
    follow_resp = client.post(f"/profile/{other_user.id}/follow", headers=auth_headers)
    assert follow_resp.status_code == 200
    assert follow_resp.json()["message"] == "Successfully followed user"

    # 3. Verify updated social details
    response = client.get(f"/profile/{other_user.id}/social", headers=auth_headers)
    assert response.status_code == 200
    social_data = response.json()
    assert social_data["followers_count"] == 1
    assert social_data["is_following"] is True
    assert len(social_data["followers"]) == 1
    assert social_data["followers"][0]["id"] == test_user.id

    # Check own social stats (following count should be 1)
    own_social_resp = client.get(f"/profile/{test_user.id}/social", headers=auth_headers)
    assert own_social_resp.status_code == 200
    own_social = own_social_resp.json()
    assert own_social["following_count"] == 1
    assert len(own_social["following"]) == 1
    assert own_social["following"][0]["id"] == other_user.id

    # 4. Unfollow other user
    unfollow_resp = client.delete(f"/profile/{other_user.id}/follow", headers=auth_headers)
    assert unfollow_resp.status_code == 200
    assert unfollow_resp.json()["message"] == "Successfully unfollowed user"

    # 5. Verify unfollowed state
    response = client.get(f"/profile/{other_user.id}/social", headers=auth_headers)
    assert response.status_code == 200
    social_data = response.json()
    assert social_data["followers_count"] == 0
    assert social_data["is_following"] is False
    assert len(social_data["followers"]) == 0
