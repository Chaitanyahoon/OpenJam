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


def test_get_following_activity_empty(client, auth_headers):
    """Test following activity when user follows no one."""
    response = client.get("/profile/following/activity", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"activities": []}


def test_get_following_activity_with_friend_in_room(client, auth_headers, test_user, test_room, db_session):
    """Test following activity retrieves friend room session in single batch query."""
    from backend.models.room import Room
    from backend.services.room_manager import room_manager

    # 1. Create and follow a friend
    friend = User(
        id="friend_123",
        display_name="Friend User",
        discord_id="discord_friend",
        discord_username="friend_discord",
    )
    db_session.add(friend)
    db_session.commit()

    follow = Follow(follower_id=test_user.id, followed_id=friend.id)
    db_session.add(follow)
    db_session.commit()

    # 2. Put friend in an active room in room_manager store
    room_manager.store.set_room(test_room.id, {
        "users": {
            friend.id: {
                "display_name": friend.display_name,
                "avatar_url": None,
            }
        },
        "playback": {
            "track_uri": "dQw4w9WgXcQ",
            "track_name": "Never Gonna Give You Up",
            "artist": "Rick Astley",
            "album_art_url": "https://example.com/art.jpg",
            "is_playing": True,
        }
    })

    try:
        response = client.get("/profile/following/activity", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert len(data["activities"]) == 1
        act = data["activities"][0]
        assert act["room_id"] == test_room.id
        assert act["room_name"] == test_room.name
        assert act["friend"]["id"] == friend.id
        assert act["friend"]["display_name"] == "Friend User"
        assert act["current_track"]["track_name"] == "Never Gonna Give You Up"
        assert act["current_track"]["artist"] == "Rick Astley"
        assert act["current_track"]["is_playing"] is True
    finally:
        room_manager.store.del_room(test_room.id)


def test_get_following_activity_unpersisted_room_fallback(client, auth_headers, test_user, db_session):
    """Test following activity gracefully handles active rooms not yet in database and missing tracks."""
    from backend.services.room_manager import room_manager

    friend = User(
        id="friend_unpersisted",
        display_name="Friend Two",
        discord_id="discord_friend2",
        discord_username="friend_two",
    )
    db_session.add(friend)
    db_session.commit()

    follow = Follow(follower_id=test_user.id, followed_id=friend.id)
    db_session.add(follow)
    db_session.commit()

    # Room ID that does NOT exist in SQL database
    unpersisted_room_id = "unpersisted-redis-room-id"
    room_manager.store.set_room(unpersisted_room_id, {
        "users": {
            friend.id: {
                "display_name": friend.display_name,
                "avatar_url": None,
            }
        },
        # No playback active
        "playback": None
    })

    try:
        response = client.get("/profile/following/activity", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 1
        act = data["activities"][0]
        assert act["room_id"] == unpersisted_room_id
        assert act["room_name"] == "Live Room"  # Fallback room name
        assert act["friend"]["id"] == friend.id
        assert act["current_track"] is None
    finally:
        room_manager.store.del_room(unpersisted_room_id)


def test_get_following_activity_malformed_room_users_safety(client, auth_headers, test_user, db_session):
    """Test following activity gracefully handles rooms with null users or invalid payload structures."""
    from backend.services.room_manager import room_manager

    friend = User(
        id="friend_malformed",
        display_name="Friend Malformed",
    )
    db_session.add(friend)
    db_session.commit()

    follow = Follow(follower_id=test_user.id, followed_id=friend.id)
    db_session.add(follow)
    db_session.commit()

    room_manager.store.set_room("corrupt-room-1", {"users": None, "playback": None})
    room_manager.store.set_room("corrupt-room-2", "not-a-dict")
    room_manager.store.set_room("valid-room-3", {
        "users": {
            friend.id: {"display_name": friend.display_name}
        },
        "playback": None
    })

    try:
        response = client.get("/profile/following/activity", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 1
        assert data["activities"][0]["room_id"] == "valid-room-3"
    finally:
        room_manager.store.del_room("corrupt-room-1")
        room_manager.store.del_room("corrupt-room-2")
        room_manager.store.del_room("valid-room-3")


