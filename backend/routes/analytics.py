"""Analytics and micro-feedback ingestion routes."""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models.analytics import AnalyticsEvent, Feedback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

ALLOWED_RATINGS = {"great", "meh", "confusing"}
ALLOWED_EVENTS = {
    "page_view",
    "room_joined",
    "room_created",
    "track_queued",
    "invite_copied",
    "session_duration",
    "tip_modal_opened",
}


class EventPayload(BaseModel):
    event: str = Field(..., min_length=1, max_length=64)
    session_id: str = Field(..., min_length=1, max_length=64)
    room_id: Optional[str] = Field(None, max_length=128)
    user_id: Optional[str] = Field(None, max_length=128)
    metadata: Optional[Dict[str, Any]] = None


class FeedbackPayload(BaseModel):
    rating: str = Field(..., min_length=2, max_length=32)
    comment: Optional[str] = Field(None, max_length=1000)
    session_id: Optional[str] = Field(None, max_length=64)
    room_id: Optional[str] = Field(None, max_length=128)
    user_id: Optional[str] = Field(None, max_length=128)


@router.post("/event", status_code=status.HTTP_200_OK)
async def track_event(payload: EventPayload, db: Session = Depends(get_db)):
    """Ingest lightweight client-side analytics event."""
    try:
        # Standardize event name to lowercase
        event_name = payload.event.strip().lower()
        if len(event_name) > 64:
            event_name = event_name[:64]

        meta_str = None
        if payload.metadata:
            try:
                meta_str = json.dumps(payload.metadata)[:2048]
            except Exception:
                meta_str = None

        record = AnalyticsEvent(
            event=event_name,
            session_id=payload.session_id.strip()[:64],
            user_id=payload.user_id.strip()[:128] if payload.user_id else None,
            room_id=payload.room_id.strip()[:128] if payload.room_id else None,
            metadata_json=meta_str,
            created_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to record analytics event: {e}")
        # Return ok to client so tracking never breaks user experience
        return {"ok": False, "error": "db_error"}


@router.post("/feedback", status_code=status.HTTP_200_OK)
async def submit_feedback(payload: FeedbackPayload, db: Session = Depends(get_db)):
    """Ingest lightweight user feedback."""
    rating_clean = payload.rating.strip().lower()
    if rating_clean not in ALLOWED_RATINGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid rating. Allowed: {list(ALLOWED_RATINGS)}",
        )

    try:
        record = Feedback(
            rating=rating_clean,
            comment=payload.comment.strip()[:1000] if payload.comment else None,
            session_id=payload.session_id.strip()[:64] if payload.session_id else None,
            user_id=payload.user_id.strip()[:128] if payload.user_id else None,
            room_id=payload.room_id.strip()[:128] if payload.room_id else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.commit()
        return {"ok": True, "id": record.id}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save user feedback: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save feedback",
        )


@router.get("/summary")
async def get_analytics_summary(days: int = 7, db: Session = Depends(get_db)):
    """Get aggregated analytics and feedback summary for creator visibility."""
    days = max(1, min(days, 30))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Event counts by type
    event_counts = (
        db.query(AnalyticsEvent.event, func.count(AnalyticsEvent.id))
        .filter(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.event)
        .all()
    )
    events_by_type = {event: count for event, count in event_counts}
    total_events = sum(events_by_type.values())

    # Distinct active sessions
    unique_sessions = (
        db.query(func.count(func.distinct(AnalyticsEvent.session_id)))
        .filter(AnalyticsEvent.created_at >= since)
        .scalar()
        or 0
    )

    # Feedback breakdown
    feedback_counts = (
        db.query(Feedback.rating, func.count(Feedback.id))
        .filter(Feedback.created_at >= since)
        .group_by(Feedback.rating)
        .all()
    )
    feedback_by_rating = {rating: count for rating, count in feedback_counts}
    total_feedback = sum(feedback_by_rating.values())

    # Recent feedback comments
    recent_feedbacks = (
        db.query(Feedback)
        .order_by(Feedback.created_at.desc())
        .limit(15)
        .all()
    )

    return {
        "period_days": days,
        "total_events": total_events,
        "unique_sessions": unique_sessions,
        "events_by_type": events_by_type,
        "total_feedback": total_feedback,
        "feedback_by_rating": feedback_by_rating,
        "recent_feedback": [fb.to_dict() for fb in recent_feedbacks],
    }
