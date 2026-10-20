"""Automated database retention and data pruning service for Supabase free tier (<500 MB)."""

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from backend.models.chat_message import ChatMessage
from backend.models.listening_history import UserListeningHistory
from backend.models.room_visit import UserRoomVisit

logger = logging.getLogger(__name__)


def run_database_retention(
    db: Session,
    chat_days: int = 7,
    visit_days: int = 14,
    history_days: int = 30,
) -> dict:
    """Prune ephemeral logs (chat, visits, old history) to keep Supabase well within free tier storage."""
    now = datetime.now(timezone.utc)
    stats = {}

    try:
        # 1. Prune ephemeral chat messages older than 7 days
        chat_cutoff = now - timedelta(days=chat_days)
        deleted_chat = (
            db.query(ChatMessage)
            .filter(ChatMessage.timestamp < chat_cutoff)
            .delete(synchronize_session=False)
        )
        stats["deleted_chat_messages"] = deleted_chat

        # 2. Prune room visits older than 14 days
        visit_cutoff = now - timedelta(days=visit_days)
        deleted_visits = (
            db.query(UserRoomVisit)
            .filter(UserRoomVisit.created_at < visit_cutoff)
            .delete(synchronize_session=False)
        )
        stats["deleted_room_visits"] = deleted_visits

        # 3. Prune old listening history beyond 30 days
        history_cutoff = now - timedelta(days=history_days)
        deleted_history = (
            db.query(UserListeningHistory)
            .filter(UserListeningHistory.created_at < history_cutoff)
            .delete(synchronize_session=False)
        )
        stats["deleted_listening_history"] = deleted_history

        db.commit()
        if any(v > 0 for v in stats.values()):
            logger.info(f"Database retention cleanup executed: {stats}")
    except Exception as e:
        db.rollback()
        logger.warning(f"Database retention cleanup error: {e}")
        stats["error"] = str(e)

    return stats
