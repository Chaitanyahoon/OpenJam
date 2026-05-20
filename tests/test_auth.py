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


def test_admin_login_success(client):
    """Test admin login with correct password."""
    response = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert response.status_code == 200
    assert "session_token" in response.cookies


def test_admin_login_failure(client):
    """Test admin login with incorrect password."""
    response = client.post("/auth/admin-login", json={"password": "wrong-password"})
    assert response.status_code == 401


def test_admin_get_rooms_unauthorized(client):
    """Test fetching rooms list without admin privilege."""
    response = client.get("/admin/rooms")
    assert response.status_code in (401, 403)


def test_admin_get_rooms_success(client):
    """Test fetching rooms list as an authorized admin."""
    # First login
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200
    
    # Extract session token from cookie
    session_cookie = login_resp.cookies.get("session_token")
    assert session_cookie is not None
    
    # Use cookie to fetch rooms
    client.cookies.set("session_token", session_cookie)
    response = client.get("/admin/rooms")
    assert response.status_code == 200
    data = response.json()
    assert "rooms" in data

