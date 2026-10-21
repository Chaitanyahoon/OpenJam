"""Tests for 24/7 curated community radio stations."""

import pytest
from backend.constants import (
    CURATED_ROOMS,
    CURATED_ROOM_IDS,
    is_curated_room,
    get_curated_tracks,
    LOUNGE_ROOM_ID,
    DESI_ROOM_ID,
    HITS_ROOM_ID,
    SYNTH_ROOM_ID,
)
from backend.models.room import Room
from backend.database import SessionLocal


def test_curated_rooms_constants():
    assert is_curated_room(LOUNGE_ROOM_ID)
    assert is_curated_room(DESI_ROOM_ID)
    assert is_curated_room(HITS_ROOM_ID)
    assert is_curated_room(SYNTH_ROOM_ID)
    assert not is_curated_room("random-user-room")
    assert len(CURATED_ROOM_IDS) >= 4


def test_get_curated_tracks():
    desi_tracks = get_curated_tracks(DESI_ROOM_ID)
    assert len(desi_tracks) >= 5
    assert any(t["artist"] for t in desi_tracks)

    lounge_tracks = get_curated_tracks(LOUNGE_ROOM_ID)
    assert len(lounge_tracks) >= 5


def test_room_slug_curated_resolution():
    room = Room(id=DESI_ROOM_ID, name="Bollywood Chill", host_user_id="bot")
    assert room.slug == DESI_ROOM_ID

    room_hits = Room(id=HITS_ROOM_ID, name="Global Hits", host_user_id="bot")
    assert room_hits.slug == HITS_ROOM_ID


def test_curated_rooms_listed_in_api(client, db_session):
    # Ensure all curated rooms exist in test DB
    import json
    from backend.constants import SYSTEM_BOT_USER_ID

    for c_id, info in CURATED_ROOMS.items():
        existing = db_session.query(Room).filter(Room.id == c_id).first()
        if not existing:
            r = Room(
                id=c_id,
                slug=info["slug"],
                name=info["name"],
                description=info["description"],
                host_user_id=SYSTEM_BOT_USER_ID,
                genre_tags=json.dumps(info["genre_tags"]),
                is_active=True,
            )
            db_session.add(r)
    db_session.commit()

    resp = client.get("/rooms")
    assert resp.status_code == 200
    rooms = resp.json()["rooms"]
    room_ids = [r["id"] for r in rooms]

    assert LOUNGE_ROOM_ID in room_ids
    assert DESI_ROOM_ID in room_ids
    assert HITS_ROOM_ID in room_ids
    assert SYNTH_ROOM_ID in room_ids
