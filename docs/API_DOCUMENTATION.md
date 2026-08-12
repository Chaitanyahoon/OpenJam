# 📡 OpenJam — Complete API & Real-Time Protocol Documentation

> **Copyright (c) 2026 Chaitanya. All Rights Reserved.**  
> *This documentation is part of the OpenJam project. Unauthorized reproduction or commercial distribution without written consent is strictly prohibited.*

---

## Overview

OpenJam uses a hybrid communications architecture:
1. **REST API (FastAPI / HTTP)** for room creation, user authentication, track search, playlist management, stream proxying, and Open Graph previews.
2. **Real-Time Protocol (Socket.IO / WebSockets)** for millisecond-synchronized music playback, queue updates, chat, listener counts, typing indicators, and floating emoji reactions.

**Base Production URL**: `https://openjam.onrender.com`  
**Frontend Origin**: `https://www.openjam.fun`

---

## 1. REST API Endpoints

### 🔐 Authentication (`/auth`)

#### `POST /auth/guest`
Generates an anonymous guest session for room participation.

- **Request Body**:
  ```json
  {
    "display_name": "Jammer" // Optional
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "user": {
      "id": "uuid-v4-string",
      "display_name": "Jammer-4F2A",
      "avatar_url": "https://cdn.discordapp.com/embed/avatars/0.png",
      "is_registered": false
    }
  }
  ```

#### `GET /auth/me`
Fetches the currently authenticated session state from cookie/header.

- **Response** `200 OK`:
  ```json
  {
    "user": {
      "id": "uuid-v4-string",
      "display_name": "Jammer-4F2A",
      "avatar_url": null,
      "discord_id": null,
      "discord_username": null,
      "is_registered": false
    }
  }
  ```

#### `GET /auth/discord`
Initiates Discord OAuth2 Login flow. Redirects user to Discord's authorization page.

#### `GET /auth/discord/callback?code={code}`
Handles Discord OAuth2 callback code exchange, creates or updates the user profile in DB, and sets `session_token` cookie.

#### `POST /auth/logout`
Revokes active session token and clears cookies.

---

### 🏠 Rooms (`/rooms`)

#### `GET /rooms`
Retrieves list of active public rooms.

- **Response** `200 OK`:
  ```json
  {
    "rooms": [
      {
        "id": "room-uuid",
        "name": "Cozy Beats Room",
        "host_name": "DJ Awesome",
        "host_avatar_url": "https://...",
        "listener_count": 4,
        "is_private": false,
        "now_playing": {
          "track_name": "Lofi Rain",
          "artist": "Chillhop",
          "album_art_url": "https://..."
        }
      }
    ]
  }
  ```

#### `POST /rooms`
Creates a new listening room.

- **Request Body**:
  ```json
  {
    "name": "Late Night Vibes",
    "password": "", // Optional for private rooms
    "is_private": false
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "room": {
      "id": "new-room-id",
      "name": "Late Night Vibes",
      "host_user_id": "user-uuid",
      "host_name": "DJ Awesome",
      "is_private": false
    }
  }
  ```

#### `DELETE /rooms/{room_id}`
Host-only room closure endpoint. Deletes room state and notifies connected clients via socket.

---

### 🎵 Track Search & Streaming (`/search`, `/stream`)

#### `GET /search?q={query}`
Searches tracks using Apple iTunes API and YouTube Music resolution. Zero API key required.

- **Query Parameters**:
  - `q`: Search query string (e.g. `"Starboy The Weeknd"`)
- **Response** `200 OK`:
  ```json
  [
    {
      "uri": "Starboy The Weeknd official audio",
      "name": "Starboy",
      "artist": "The Weeknd ft. Daft Punk",
      "album_art_url": "https://is1-ssl.mzstatic.com/image/thumb/...",
      "duration_ms": 230400
    }
  ]
  ```

#### `GET /stream/{video_id}`
Streams track audio or returns a direct 302 CDN redirect.

- **Query Parameters**:
  - `video_id`: YouTube video ID string (e.g. `"FX1_FXlKxXY"`)
  - `low`: (Optional) `true` for lower bitrate fallback stream
  - `nocache`: (Optional) `true` to bypass cache
- **Response**:
  - `302 Found`: Direct redirect to high-speed CDN stream URL.
  - `200 OK / 206 Partial Content`: Streamed WebM/M4A audio bytes from server cache.

---

### 📚 Playlists & Likes (`/playlists`, `/likes`)

#### `GET /likes`
Fetches user's saved favourite tracks.

#### `POST /likes`
Saves a track to user's favourites.

#### `DELETE /likes?track_uri={uri}`
Removes a track from user's favourites.

#### `GET /playlists`
Retrieves user's created playlists.

#### `POST /playlists`
Creates a custom playlist.

#### `POST /playlists/{id}/tracks/bulk`
Adds bulk tracks to a playlist (e.g., exporting a room queue).

---

## 2. Real-Time Socket.IO Protocol

Clients connect to `/socket.io/?EIO=4&transport=websocket`.

### Client ➔ Server Events

| Event | Payload | Description |
|---|---|---|
| `join_room` | `{ room_id, password, avatar_url }` | Joins a room session. |
| `leave_room` | `{ room_id }` | Leaves current room. |
| `send_chat` | `{ room_id, content }` | Sends a chat message to room. |
| `send_reaction` | `{ room_id, emoji }` | Triggers a live floating emoji reaction. |
| `add_to_queue` | `{ room_id, track_uri, track_name, artist, album_art_url, duration_ms }` | Adds a track to room queue. |
| `remove_from_queue` | `{ room_id, queue_item_id }` | Removes a track from queue. |
| `reorder_queue` | `{ room_id, ordered_ids }` | Reorders pending queue (Host only). |
| `vote_skip` | `{ room_id }` | Casts a skip vote for current song. |
| `next_track` | `{ room_id }` | Advances to next track (Host only). |
| `playback_update` | `{ room_id, position_ms, is_playing, ... }` | Syncs host playback state across room. |
| `sync_ping` | `{ t0 }` | Clock synchronization request. |
| `typing` / `stop_typing` | `{ room_id }` | Typing status notifications. |

---

### Server ➔ Client Events

| Event | Payload | Description |
|---|---|---|
| `join_success` | `{ room_id, queue, now_playing, playback, listeners }` | Confirms room entry and state. |
| `join_error` | `{ message }` | Sent on incorrect password or DB failure. |
| `chat_history` | `{ messages: [...] }` | Sends recent chat history on join. |
| `chat_message` | `{ id, user_id, user_name, content, timestamp }` | Broadcasts real-time chat message. |
| `reaction` | `{ user_id, user_name, emoji }` | Broadcasts floating emoji particle. |
| `listener_count` | `{ count, listeners }` | Broadcasts online user count and list. |
| `queue_updated` | `{ queue: [...] }` | Broadcasts updated queue list. |
| `playback_sync` | `{ position_ms, is_playing, server_timestamp }` | High-precision playback sync tick. |
| `track_changed` | `{ track_name, artist, album_art_url, duration_ms }` | Fired when new track starts playing. |
| `skip_votes_updated` | `{ votes, required }` | Broadcasts current skip vote tally. |
| `sync_pong` | `{ t0, t1, t2 }` | NTP clock synchronization response. |
| `room_closed` | `{ room_id }` | Notifies clients that room was closed. |

---

## 3. Error Codes & Handling

| HTTP Code | Error Key | Cause |
|---|---|---|
| `400` | `Invalid video ID` | Malformed or unsafe video identifier. |
| `401` | `Unauthorized` | Session token missing or invalid. |
| `403` | `Incorrect room password` | Password check failed for private room. |
| `404` | `Could not extract audio stream` | Track unavailable on remote endpoints. |
| `501` | `Discord login not configured` | Missing `DISCORD_CLIENT_ID` env variable. |
