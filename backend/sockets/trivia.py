"""Socket.IO handlers and state management for OpenJam Music Trivia Mini-Game."""

import asyncio
import random
import time
import uuid
from typing import Dict, List, Optional
import socketio

from backend.logger import get_logger
from backend.services.room_manager import room_manager

logger = get_logger(__name__)

# Active room trivia countdown tasks
_trivia_tasks: Dict[str, asyncio.Task] = {}

# Rich curated fallback library for question & decoy generation
CURATED_TRIVIA_TRACKS: List[Dict[str, str]] = [
    {
        "track_name": "Blinding Lights",
        "artist": "The Weeknd",
        "track_uri": "fHI8X4OX3Lw",
        "genre": "synthwave",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a6/6e/bf/a66ebf79-5008-8948-b352-a790fc87446b/19UM1IM04638.rgb.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Sweater Weather",
        "artist": "The Neighbourhood",
        "track_uri": "GCdwKhTtNNw",
        "genre": "indie",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/28/71/00/287100fb-5c31-0195-5343-e6b3625886d0/886443969834.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Starboy",
        "artist": "The Weeknd",
        "track_uri": "34Na4j8AVgA",
        "genre": "synthwave",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/500x500bb.jpg",
    },
    {
        "track_name": "The Less I Know The Better",
        "artist": "Tame Impala",
        "track_uri": "sBzNzdxyn5I",
        "genre": "indie",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a0/9a/2c/a09a2ca3-a5a6-814b-0af7-640dc0aef0aa/091012682261.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Do I Wanna Know?",
        "artist": "Arctic Monkeys",
        "track_uri": "bpOSxM0rNPM",
        "genre": "rock",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/500x500bb.jpg",
    },
    {
        "track_name": "Instant Crush",
        "artist": "Daft Punk",
        "track_uri": "a5uQMwRM2yw",
        "genre": "synthwave",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/500x500bb.jpg",
    },
    {
        "track_name": "bad guy",
        "artist": "Billie Eilish",
        "track_uri": "DyDfgMOUjCI",
        "genre": "pop",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Resonance",
        "artist": "HOME",
        "track_uri": "8GW6sLrK40k",
        "genre": "synthwave",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/68/49/7c/68497c2a-9e7f-47dc-c3c1-eb45e7f12e10/859712711099_cover.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Get Lucky",
        "artist": "Daft Punk & Pharrell Williams",
        "track_uri": "5NV6Rdv1a3I",
        "genre": "pop",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Midnight City",
        "artist": "M83",
        "track_uri": "dX3k_QDnzHE",
        "genre": "synthwave",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/80/c2/f0/80c2f0f4-5264-b586-1cfc-c469f05ee0e0/724596951253.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Levitating",
        "artist": "Dua Lipa",
        "track_uri": "TUVcZfQe-Kw",
        "genre": "pop",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/44/d0/ea/44d0ea2b-c8c3-1ff6-e137-b615c8e3ca31/190295286101.jpg/500x500bb.jpg",
    },
    {
        "track_name": "As It Was",
        "artist": "Harry Styles",
        "track_uri": "H5v3kku4y6Q",
        "genre": "pop",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/71/84/c7/7184c7fa-1014-ce52-4752-6cb1a8ab4577/196589048039.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Heat Waves",
        "artist": "Glass Animals",
        "track_uri": "mRD0-GxqHVo",
        "genre": "indie",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1e/9e/f0/1e9ef0bf-c6f3-9d90-fb68-8097d62058fa/20UMGIM26768.rgb.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Feel Good Inc.",
        "artist": "Gorillaz",
        "track_uri": "HyHNuVaZJ-k",
        "genre": "hiphop",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/0c/33/c4/0c33c46e-1d54-15c5-e51c-4e899b82aa21/00724387383856.rgb.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Somebody That I Used to Know",
        "artist": "Gotye",
        "track_uri": "8UVNT4wvIGY",
        "genre": "indie",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a4/96/aa/a496aabf-1100-349f-b7e9-446a8d67c9d9/11UMGIM22567.rgb.jpg/500x500bb.jpg",
    },
    {
        "track_name": "Sunflower",
        "artist": "Post Malone & Swae Lee",
        "track_uri": "ApXoWvfEYVU",
        "genre": "hiphop",
        "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/17/57/54/175754ce-c8ad-f2f4-7e9b-98a442e979d5/18UMGIM78877.rgb.jpg/500x500bb.jpg",
    },
]


def generate_trivia_options(
    correct_track: dict,
    candidate_decoys: Optional[List[dict]] = None
) -> tuple[List[dict], int]:
    """Generate 4 distinct multiple choice options (1 correct, 3 decoys) shuffled.
    Returns (shuffled_options, correct_option_id).
    """
    correct_title = (correct_track.get("track_name") or correct_track.get("name") or "").strip()
    correct_artist = (correct_track.get("artist") or "").strip()

    # Collect available decoy candidates
    decoy_pool: List[dict] = []
    if candidate_decoys:
        for c in candidate_decoys:
            tname = (c.get("track_name") or c.get("name") or "").strip()
            tart = (c.get("artist") or "").strip()
            if tname and tname.lower() != correct_title.lower():
                decoy_pool.append({"title": tname, "artist": tart or "Unknown Artist"})

    # Supplement with curated library
    for c in CURATED_TRIVIA_TRACKS:
        tname = c["track_name"].strip()
        tart = c["artist"].strip()
        if tname.lower() != correct_title.lower() and not any(d["title"].lower() == tname.lower() for d in decoy_pool):
            decoy_pool.append({"title": tname, "artist": tart})

    # Pick 3 distinct decoys
    random.shuffle(decoy_pool)
    selected_decoys = decoy_pool[:3]

    # If still fewer than 3 (rare fallback)
    fallback_titles = [("Stargazing", "Travis Scott"), ("Circles", "Post Malone"), ("Stay", "The Kid LAROI & Justin Bieber")]
    for ft, fa in fallback_titles:
        if len(selected_decoys) < 3 and ft.lower() != correct_title.lower():
            selected_decoys.append({"title": ft, "artist": fa})

    # Create raw 4 options list
    raw_options = [
        {"title": correct_title, "artist": correct_artist, "_is_correct": True}
    ]
    for d in selected_decoys:
        raw_options.append({"title": d["title"], "artist": d["artist"], "_is_correct": False})

    # Fisher-Yates Shuffle
    random.shuffle(raw_options)

    # Assign IDs 0, 1, 2, 3
    final_options = []
    correct_option_id = 0
    for idx, opt in enumerate(raw_options):
        if opt.get("_is_correct"):
            correct_option_id = idx
        final_options.append({
            "id": idx,
            "title": opt["title"],
            "artist": opt["artist"],
        })

    return final_options, correct_option_id


async def _trivia_countdown(room_id: str, round_id: str, sio: socketio.AsyncServer, duration_sec: float = 10.0):
    """Asynchronous countdown timer task for a trivia round."""
    try:
        await asyncio.sleep(duration_sec)
        result = room_manager.end_trivia_round(room_id, round_id)
        if result:
            logger.info(f"Trivia round {round_id} ended in room {room_id}. Broadcasting results.")
            await sio.emit("trivia_round_ended", result, room=room_id)
    except asyncio.CancelledError:
        logger.info(f"Trivia countdown task cancelled for room {room_id}")
    except Exception as e:
        logger.error(f"Error in trivia countdown task for room {room_id}: {e}")
    finally:
        _trivia_tasks.pop(room_id, None)


def register_trivia_handlers(sio: socketio.AsyncServer):
    """Register Socket.IO event handlers for the real-time music trivia game."""

    @sio.event
    async def start_trivia_round(sid, data):
        """Host initiates a 10-second music trivia round."""
        data = data or {}
        info = room_manager.get_user_by_sid(sid)
        room_id = data.get("room_id") or (info and info.get("room_id"))
        if not room_id:
            logger.warning(f"start_trivia_round: No room_id for sid {sid}")
            return

        # Check host authority
        if not room_manager.is_host(room_id, sid):
            # Check session/db user
            session = await sio.get_session(sid)
            user_id = session.get("user_id") if session else None
            # Allow if host or guest controls enabled
            if not room_manager.can_control(room_id, sid):
                logger.warning(f"Unauthorized start_trivia_round attempt in room {room_id} by sid {sid}")
                await sio.emit("trivia_error", {"message": "Only the host can start a trivia round."}, to=sid)
                return

        # Cancel any running countdown task for this room
        old_task = _trivia_tasks.pop(room_id, None)
        if old_task and not old_task.done():
            old_task.cancel()

        # 1. Resolve Target Track
        correct_track = data.get("track") or data.get("correct_track")
        if not correct_track:
            # Fallback to current room playback
            pb = room_manager.get_playback(room_id)
            if pb and pb.get("track_name"):
                correct_track = {
                    "track_name": pb.get("track_name"),
                    "artist": pb.get("artist") or "Unknown Artist",
                    "track_uri": pb.get("track_uri") or "",
                    "album_art_url": pb.get("album_art_url") or "",
                }
            else:
                # Fallback to a random curated discovery track
                correct_track = random.choice(CURATED_TRIVIA_TRACKS)

        # 2. Gather decoy candidates from current room queue / playback
        candidate_decoys = []
        try:
            from backend.database import SessionLocal
            from backend.services.queue_manager import queue_manager
            db = SessionLocal()
            try:
                queue_items = queue_manager.get_queue(db, room_id)
                for item in queue_items:
                    candidate_decoys.append({
                        "track_name": item.get("track_name"),
                        "artist": item.get("artist"),
                    })
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Could not load room queue for trivia decoys: {e}")

        # 3. Generate options and correct option ID
        options, correct_option_id = generate_trivia_options(correct_track, candidate_decoys)

        # 4. Generate round metadata
        round_id = f"tr_{uuid.uuid4().hex[:8]}"
        duration_sec = float(data.get("duration_sec", 10.0))
        duration_ms = int(duration_sec * 1000)
        start_timestamp = int(time.time() * 1000)

        # 5. Initialize trivia state in RoomManager
        trivia_state = room_manager.init_trivia_session(
            room_id=room_id,
            round_id=round_id,
            correct_track=correct_track,
            options=options,
            duration_ms=duration_ms,
            start_timestamp=start_timestamp,
            correct_option_id=correct_option_id,
        )

        # 6. Start async 10s countdown task
        _trivia_tasks[room_id] = asyncio.create_task(
            _trivia_countdown(room_id, round_id, sio, duration_sec)
        )

        # 7. Broadcast round start payload (server-side hides correct_option_id)
        broadcast_payload = {
            "round_id": round_id,
            "round_number": trivia_state.get("round_number", 1),
            "question": data.get("question", "Name this track!"),
            "track_uri": correct_track.get("track_uri", ""),
            "snippet_start_ms": int(data.get("snippet_start_ms", 30000)),
            "duration_ms": duration_ms,
            "start_timestamp": start_timestamp,
            "options": [
                {"id": opt["id"], "title": opt["title"], "artist": opt["artist"]}
                for opt in options
            ],
        }

        logger.info(f"Broadcast trivia_round_started in room {room_id}, round {round_id}")
        await sio.emit("trivia_round_started", broadcast_payload, room=room_id)

    @sio.event
    async def trivia_submit_answer(sid, data):
        """Listener submits their chosen option."""
        data = data or {}
        info = room_manager.get_user_by_sid(sid)
        session = await sio.get_session(sid)

        room_id = data.get("room_id") or (info and info.get("room_id"))
        round_id = data.get("round_id")
        option_id = data.get("option_id")

        if not room_id or not round_id or option_id is None:
            return

        try:
            option_id = int(option_id)
        except (ValueError, TypeError):
            return

        user_id = (session and session.get("user_id")) or (info and info.get("user_id")) or f"guest_{sid}"
        display_name = (session and session.get("display_name")) or (info and info.get("display_name")) or "Listener"
        avatar_url = (session and session.get("avatar_url")) or (info and info.get("avatar_url")) or ""

        result = room_manager.submit_trivia_answer(
            room_id=room_id,
            round_id=round_id,
            user_id=user_id,
            option_id=option_id,
            display_name=display_name,
            avatar_url=avatar_url,
            client_time_ms=data.get("client_time_ms"),
        )

        if result:
            # 1. Broadcast that user answered (to show avatars in real time)
            await sio.emit(
                "trivia_user_answered",
                {
                    "user_id": user_id,
                    "display_name": result["display_name"],
                    "avatar_url": result["avatar_url"],
                },
                room=room_id,
            )

            # 2. Privately acknowledge the submitter
            await sio.emit("trivia_answer_acknowledged", result, to=sid)

    @sio.event
    async def end_trivia_session(sid, data):
        """Host ends the trivia mini-game session."""
        data = data or {}
        info = room_manager.get_user_by_sid(sid)
        room_id = data.get("room_id") or (info and info.get("room_id"))
        if not room_id:
            return

        if not room_manager.can_control(room_id, sid):
            return

        # Cancel active task if running
        task = _trivia_tasks.pop(room_id, None)
        if task and not task.done():
            task.cancel()

        final_trivia = room_manager.clear_trivia_session(room_id)
        final_leaderboard = []
        if final_trivia and "scores" in final_trivia:
            sorted_users = sorted(
                final_trivia["scores"].values(),
                key=lambda u: (u.get("total_score", 0), u.get("streak", 0)),
                reverse=True
            )
            for rank, u in enumerate(sorted_users, 1):
                final_leaderboard.append({
                    "rank": rank,
                    "user_id": u.get("user_id"),
                    "display_name": u.get("display_name", "Listener"),
                    "avatar_url": u.get("avatar_url", ""),
                    "total_score": u.get("total_score", 0),
                    "streak": u.get("streak", 0),
                })

        logger.info(f"Trivia session ended in room {room_id}")
        await sio.emit(
            "trivia_session_ended",
            {"room_id": room_id, "final_leaderboard": final_leaderboard},
            room=room_id,
        )
