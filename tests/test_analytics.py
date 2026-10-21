"""Tests for analytics event ingestion and user feedback."""

import pytest
from backend.models.analytics import AnalyticsEvent, Feedback


def test_track_event_success(client, db_session):
    payload = {
        "event": "room_joined",
        "session_id": "sess_test_12345",
        "room_id": "test-room-slug",
        "user_id": "usr_abc",
        "metadata": {"duration_seconds": 45, "referrer": "direct"},
    }
    response = client.post("/analytics/event", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") is True

    # Verify stored in DB
    event_rec = (
        db_session.query(AnalyticsEvent)
        .filter(AnalyticsEvent.session_id == "sess_test_12345")
        .first()
    )
    assert event_rec is not None
    assert event_rec.event == "room_joined"
    assert event_rec.room_id == "test-room-slug"
    assert "duration_seconds" in event_rec.to_dict()["metadata"]


def test_track_event_minimal(client):
    payload = {
        "event": "page_view",
        "session_id": "sess_min_999",
    }
    response = client.post("/analytics/event", json=payload)
    assert response.status_code == 200
    assert response.json().get("ok") is True


def test_submit_feedback_success(client, db_session):
    payload = {
        "rating": "great",
        "comment": "Loved the audio sync with my friend!",
        "session_id": "sess_fb_123",
        "room_id": "chill-lounge",
    }
    response = client.post("/analytics/feedback", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") is True
    assert "id" in data

    # Verify DB
    fb_rec = db_session.query(Feedback).filter(Feedback.session_id == "sess_fb_123").first()
    assert fb_rec is not None
    assert fb_rec.rating == "great"
    assert "audio sync" in fb_rec.comment


def test_submit_feedback_invalid_rating(client):
    payload = {
        "rating": "horrible",
        "comment": "doesn't work",
    }
    response = client.post("/analytics/feedback", json=payload)
    assert response.status_code == 400
    assert "Invalid rating" in response.json().get("detail", "")


def test_analytics_summary(client):
    # Track some events first
    client.post("/analytics/event", json={"event": "page_view", "session_id": "s_sum_1"})
    client.post("/analytics/event", json={"event": "track_queued", "session_id": "s_sum_1"})
    client.post("/analytics/feedback", json={"rating": "meh", "comment": "needs more tracks"})

    response = client.get("/analytics/summary?days=7")
    assert response.status_code == 200
    data = response.json()
    assert "total_events" in data
    assert "events_by_type" in data
    assert "total_feedback" in data
    assert "recent_feedback" in data
    assert data["total_events"] >= 2
    assert data["total_feedback"] >= 1
