"""Tests for authentication routes."""

def test_get_me_authenticated(client, auth_headers, test_user):
    """Test getting current user info when authenticated."""
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == test_user.id
    assert data["user"]["display_name"] == test_user.display_name
    assert data["user"]["avatar_url"] is None


def test_get_me_unauthenticated(client):
    """Test getting current user info when not authenticated."""
    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["user"] is None


def test_logout_authenticated(client, auth_headers):
    """Test logout when authenticated."""
    response = client.post("/auth/logout", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Logged out"


def test_logout_unauthenticated(client):
    """Test logout when not authenticated."""
    response = client.post("/auth/logout")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Logged out"


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Open Jam"
