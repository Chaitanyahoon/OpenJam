# 📜 OpenJam — Engineering Rules & Architecture Invariants

> **Purpose:** Persistent Level 1 Context Engineering rules file for AI agents and developers. Read before modifying any code.

---

## 1. Tech Stack Overview

- **Frontend:** Next.js 16 (App Router + Turbopack), React 19, Framer Motion, GSAP, Socket.IO Client. Deployed on **Vercel**.
- **Backend:** FastAPI, Python-SocketIO, AsyncIO, SQLAlchemy, HTTPX. Deployed on **Render** (Free tier Web Service).
- **Database & State:** Supabase PostgreSQL (auth, playlists, stats), Upstash Redis (active rooms, socket session mappings, URL cache).
- **Audio Pipeline:** iTunes API (keyless metadata search) $\rightarrow$ Cobalt / Invidious stream extraction $\rightarrow$ HTML5 audio player (`YouTubePlayer.js`).

---

## 2. Mandatory Verification Commands

Before committing any change, both verification gates must pass cleanly:

1. **Frontend Production Build:**
   ```powershell
   cd frontend-next
   npm run build
   ```
   *Requirement:* All 18 static/dynamic routes must build with 0 TypeScript/Turbopack errors.

2. **Backend Automated Test Suite:**
   ```powershell
   python -m pytest tests/
   ```
   *Requirement:* All 111+ pytest tests must pass (100% pass rate).

---

## 3. Core Architecture Invariants (DO NOT BREAK)

1. **Audio Sync Drift Budget ($<100\text{ms}$):**
   - NTP-style ping/pong clock offset calculations ensure tight synchronization across clients without audio stutter.
   - Do NOT introduce blocking synchronous calls or unthrottled timers on the audio clock loop.

2. **Free-Tier Resource Discipline:**
   - **Render (512MB RAM cap):** Stream proxying uses fast 302 HTTP redirects pointing directly to YouTube CDN audio streams. Do NOT stream full media buffers through Python memory.
   - Database connections must be returned to the pool; use `get_db()` context generators.

3. **Room Lifecycle & Auto-Close Rules:**
   - The permanent community lounge (`openjam-lounge`) is permanently active and NEVER auto-closed.
   - User-created rooms MUST automatically schedule closure after 5 minutes of host disconnect when empty (`room_closer.py`).

4. **Zero-Gated Social Onboarding:**
   - First-time guests entering a room URL (`/room/{id}`) MUST auto-join with a generated moniker without blocking nickname modal dialogs.
   - Audio autoplay policies on mobile: When browser policies block initial playback, display a gentle 1-tap unmute prompt without crashing the socket connection.

5. **Homepage 60fps Performance Contract:**
   - **Desktop ($>768\text{px}$):** Uses 3D Dome Gallery with an `IntersectionObserver` that pauses transforms/inertia when scrolled out of viewport.
   - **Mobile ($\le 768\text{px}$):** Renders the hardware-accelerated 2D Vinyl Carousel with horizontal touch-snapping.
   - Cursor follower glow MUST be batched via `requestAnimationFrame` and applied via `transform: translate3d(...)`. Never assign `style.left`/`style.top` directly on raw `mousemove`.

---

## 4. Operational Boundaries

- **Never commit credentials:** Secrets, tokens, and `.env` files must stay ignored by `.gitignore`.
- **Scope Discipline:** Touch only what is required for the specific task. Do not perform unsolicited refactoring of working audio or socket pipelines.
- **Maintain DAMP Tests:** Unit tests in `tests/` should be self-contained, descriptive, and assert state rather than private internal method calls.
