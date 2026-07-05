"""Tests for playlist like/unlike/saved feature."""

import pytest
from backend.models.user import User
from backend.models.playlist import Playlist

def test_like_playlist_unauthenticated(client):
    """Test liking a playlist requires authentication."""
    response = client.post("/playlists/some-playlist-id/like")
    assert response.status_code == 401

def test_like_playlist_not_found(client, auth_headers):
    """Test liking a non-existent playlist."""
    response = client.post("/playlists/non-existent-id/like", headers=auth_headers)
    assert response.status_code == 404

def test_like_unlike_playlist_flow(client, auth_headers, test_user, db_session):
    """Test liking, checking, and unliking a playlist."""
    # Create another user who owns the playlist
    other_user = User(
        id="playlist_owner_id",
        display_name="Playlist Owner",
        discord_id="discord_owner",
        discord_username="owner"
    )
    db_session.add(other_user)
    db_session.commit()

    # Create a public playlist
    playlist = Playlist(
        id="test_playlist_id",
        name="Cool Vibes",
        creator_id=other_user.id,
        is_private=False
    )
    db_session.add(playlist)
    db_session.commit()

    # 1. Like the playlist
    response = client.post(f"/playlists/{playlist.id}/like", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Playlist liked successfully"

    # 2. Get liked playlists list
    liked_resp = client.get("/playlists/liked", headers=auth_headers)
    assert liked_resp.status_code == 200
    liked_data = liked_resp.json()
    assert len(liked_data["playlists"]) == 1
    assert liked_data["playlists"][0]["id"] == playlist.id
    assert liked_data["playlists"][0]["name"] == "Cool Vibes"

    # Also verify it shows up in my profile details
    profile_resp = client.get("/profile/me", headers=auth_headers)
    assert profile_resp.status_code == 200
    profile_data = profile_resp.json()
    assert len(profile_data["saved_playlists"]) == 1
    assert profile_data["saved_playlists"][0]["id"] == playlist.id

    # 3. Unlike the playlist
    unlike_resp = client.delete(f"/playlists/{playlist.id}/like", headers=auth_headers)
    assert unlike_resp.status_code == 200
    assert unlike_resp.json()["message"] == "Playlist unliked successfully"

    # 4. Verify it's no longer liked
    liked_resp = client.get("/playlists/liked", headers=auth_headers)
    assert liked_resp.status_code == 200
    assert len(liked_resp.json()["playlists"]) == 0
