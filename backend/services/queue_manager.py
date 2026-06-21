"""Queue management service — add tracks, vote, advance playback."""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.models.queue_item import QueueItem
from backend.models.vote import Vote


class QueueManager:
    def add_track(self, db: Session, room_id: str, track_data: dict, user_id: str, user_name: str) -> QueueItem:
        max_pos = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status != "played",
        ).count()
        item = QueueItem(
            room_id=room_id,
            track_uri=track_data["uri"],
            track_name=track_data["name"],
            artist=track_data["artist"],
            album_art_url=track_data.get("album_art_url"),
            duration_ms=track_data.get("duration_ms", 0),
            added_by_user_id=user_id,
            added_by_name=user_name,
            votes=0,
            position=max_pos,
            status="pending",
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def vote_track(self, db: Session, queue_item_id: str, user_id: str) -> bool:
        item = db.query(QueueItem).filter(QueueItem.id == queue_item_id).first()
        if not item:
            return False

        existing = db.query(Vote).filter(
            Vote.queue_item_id == queue_item_id,
            Vote.user_id == user_id,
        ).first()
        if existing:
            return False

        vote = Vote(queue_item_id=queue_item_id, user_id=user_id)
        db.add(vote)
        item.votes += 1
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return False
        return True

    def get_queue(self, db: Session, room_id: str, current_user_id: str | None = None) -> list:
        items = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status != "played",
        ).order_by(
            QueueItem.status.desc(),  # "playing" > "pending"
            QueueItem.votes.desc(),
            QueueItem.position.asc(),
        ).all()

        item_ids = [item.id for item in items]
        votes_by_item = {item_id: [] for item_id in item_ids}
        if item_ids:
            votes = db.query(Vote.queue_item_id, Vote.user_id).filter(
                Vote.queue_item_id.in_(item_ids),
            ).all()
            for queue_item_id, user_id in votes:
                votes_by_item.setdefault(queue_item_id, []).append(user_id)

        item_dicts = []
        for item in items:
            d = item.to_dict()
            d["voter_ids"] = votes_by_item.get(item.id, [])
            if current_user_id:
                d["has_voted"] = current_user_id in d["voter_ids"]
            else:
                d["has_voted"] = False
            item_dicts.append(d)
        
        return item_dicts

    def get_now_playing(self, db: Session, room_id: str) -> dict | None:
        item = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status == "playing",
        ).first()
        return item.to_dict() if item else None

    def advance_queue(self, db: Session, room_id: str) -> dict | None:
        current = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status == "playing",
        ).first()
        if current:
            current.status = "played"

        next_item = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status == "pending",
        ).order_by(
            QueueItem.votes.desc(),
            QueueItem.position.asc(),
        ).first()
        if next_item:
            next_item.status = "playing"

            # Ensure the track_uri is a resolved YouTube ID
            if next_item.track_uri and (" " in next_item.track_uri or len(next_item.track_uri) != 11):
                from backend.services.music_search import music_search_service as lastfm_service
                vid = lastfm_service.resolve_youtube_sync(next_item.track_uri)
                if vid:
                    next_item.track_uri = vid

            db.commit()
            db.refresh(next_item)
            return next_item.to_dict()
        db.commit()
        return None

    def get_history(self, db: Session, room_id: str, limit: int = 20) -> list:
        items = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status == "played",
        ).order_by(
            QueueItem.created_at.desc()
        ).limit(limit).all()
        return [item.to_dict() for item in items]

queue_manager = QueueManager()
