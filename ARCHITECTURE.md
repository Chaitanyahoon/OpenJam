# 🏗️ OpenJam — System Architecture & Technical Design

> **Copyright (c) 2026 Chaitanya. All Rights Reserved.**  
> *This document outlines the system architecture of OpenJam. Unauthorized reproduction or commercial distribution without written consent is strictly prohibited.*

---

## 1. System Topology Overview

OpenJam uses a decoupled frontend-backend architecture optimized for high-speed real-time event distribution and zero-cost hosting.

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 Frontend                      │
│                  (Vercel Edge Network)                      │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
          REST │ HTTP                    WS   │ Socket.IO
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                    FastAPI Python Backend                   │
│                     (Render Web Service)                    │
├──────────────────────────────┬──────────────────────────────┤
│  Async Event Loop (uvicorn)  │   Python-SocketIO Server     │
└──────────────┬───────────────┴──────────────▲───────────────┘
               │                              │
         ┌─────┴───────────────┐      ┌───────┴──────────────┐
         ▼                     ▼      ▼                      ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ SQLite / DB  │     │ Redis Store  │     │ iTunes API   │
  │ (Auth/Likes) │     │ (Room Cache) │     │ (Keyless)    │
  └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Component Breakdown

### 2.1 Next.js Frontend (`/frontend-next`)
- **Framework**: Next.js 16 (App Router + Turbopack).
- **Navigation**: Client-side single-page router (`router.push`) preventing full page reloads and WebSocket reconnect spikes.
- **Audio Engine**: Custom HTML5 audio wrapper (`YouTubePlayer.js`) with 2.5s stall recovery timeouts and silent error handling.
- **Visual Design System**: CSS design system with HSL dark mode, dynamic color extraction (`colorExtractor.js`), and Framer Motion micro-animations.

### 2.2 FastAPI Backend (`/backend`)
- **Framework**: FastAPI + Python-SocketIO with AsyncIO event loops.
- **Routing**: Modular APIRouter instances (`/auth`, `/rooms`, `/stream`, `/playlists`, `/likes`).
- **Stream Proxying**: Fast 302 HTTP redirects pointing directly to YouTube CDN audio streams (0% CPU proxying overhead on Render free tier).

### 2.3 Real-Time State & Storage
- **`RedisStore`**: Hybrid state manager stored in Redis (or in-memory dictionary fallback). Stores active rooms (`openjam:room:*`), user socket mappings (`openjam:sid:*`), and resolved URL caches (`openjam:url:*`).
- **Database (`SQLAlchemy` / SQLite / PostgreSQL)**: Manages registered user profiles, Discord OAuth tokens, saved playlist tracks, and liked songs.

---

## 3. Real-Time Synchronization Engine

### NTP-Style Clock Offset Calculation
To ensure every client plays music at the exact same millisecond:
1. Client sends `sync_ping` with timestamp $t_0$.
2. Server receives at $t_1$, appends server time $t_2$, and returns `sync_pong`.
3. Client receives at $t_3$.
4. **Round Trip Time (RTT)**:  
   $$\text{RTT} = (t_3 - t_0) - (t_2 - t_1)$$
5. **Clock Offset**:  
   $$\text{Offset} = \frac{(t_1 - t_0) + (t_2 - t_3)}{2}$$

When receiving `playback_sync` events from the host, clients adjust current audio playback position by incorporating latency drift ($\text{Position} + \text{Latency}$), maintaining tight synchronization without stuttering.

---

## 4. Security & Intellectual Property Notice

**Copyright (c) 2026 Chaitanya. All Rights Reserved.**

This repository is protected under international copyright law. Refer to [COPYRIGHT_WARNING.md](COPYRIGHT_WARNING.md) and [LICENSE](LICENSE) for terms of use, proprietary restrictions, and DMCA takedown procedures.
