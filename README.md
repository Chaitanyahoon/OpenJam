<div align="center">
  <br />
  <h1>🎶 Open Jam — Social Listening, but make it classy</h1>
  <p style="max-width:720px;">A cozy little web app that lets you share a listening room with friends so everyone hears the same thing at the same time — without the awkward "did you press play?" conversation.</p>

  <div style="margin-top:18px;display:flex;gap:12px;justify-content:center;align-items:center;">
    <img src="https://img.shields.io/badge/Vibe-Immortal-ff0066?style=for-the-badge" alt="vibe" />
    <img src="https://img.shields.io/badge/Status-Grooving-00f2ff?style=for-the-badge" alt="status" />
  </div>

  <br />
  <img src="docs/img/vibecat.gif" alt="vibecat" width="520" style="border-radius:20px;box-shadow:0 24px 80px rgba(2,6,23,0.6);border:1px solid rgba(255,255,255,0.04);margin-top:18px;">
  <p style="opacity:0.85;margin-top:8px;font-style:italic;">vibecat approves this playlist</p>
</div>

---

**What is this?**

Open Jam is a tiny, opinionated social music app: create a room, invite friends, queue tracks (resolved to YouTube), and listen in sync. It's built for maximum vibes and minimal friction.

---

**Highlights**

- Millisecond-friendly playback sync so people stop blaming their connection.
- Host controls + democratic voting for skips (civilized mob rule).
- Lightweight stack: FastAPI backend, Socket.IO realtime, vanilla JS frontend.
- Server-side YouTube resolution (no API key required) and a friendly PWA UI.

---

How to run (quick)

1) Clone & install

```bash
git clone https://github.com/Chaitanyahoon/OpenJam.git
cd OpenJam
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Configure (create `.env`)

```env
SECRET_KEY=please-change-this-super-secret
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:8000
```

3) Run

```bash
python run.py
# then visit http://localhost:8000/room/<your-room-id>
```

---

Troubleshooting playback (the common culprits)

- Audio is silent? Click the page once to "Tap to listen" — browsers require a user gesture to unlock audio.
- Nothing plays for you but the host hears it? Make sure there's an active host (room creator). Playback sync uses host updates.
- Socket events missing? Open the room with `?debug=1` (e.g. `/room/abc?debug=1`) to see socket connection and YouTube player status in the bottom-right debug panel.
- Search/queue resolution fails? We resolve search queries to YouTube IDs server-side using `ytmusicapi` or a safe HTML fallback — occasional resolution failures depend on the remote source.

---

Contributing

- Found a bug? Open an issue.
- Want to make the README funnier? Congratulations, you're already here.
- Pull requests welcome — keep changes focused and test locally.

---

License & thanks

Proprietary / All Rights Reserved. See [COPYRIGHT_WARNING.md](file:///c:/Users/patil/OneDrive/Desktop/open/OpenJam/COPYRIGHT_WARNING.md) for terms of use. Built with coffee, cat memes, and an unreasonable devotion to good timing.

Enjoy the vibes. 😸
