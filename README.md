<div align="center">
  <br />
  <h1>🎶 OpenJam — Real-Time Synchronized Social Listening</h1>
  <p style="max-width:720px;">A classy, high-performance web app that lets you share a listening room with friends so everyone hears the same music at the exact same millisecond — zero accounts required, zero lag, zero cost.</p>

  <div style="margin-top:18px;display:flex;gap:12px;justify-content:center;align-items:center;">
    <img src="https://img.shields.io/badge/Status-Live%20%26%20Grooving-00f2ff?style=for-the-badge" alt="status" />
    <img src="https://img.shields.io/badge/License-Proprietary%20%2F%20All%20Rights%20Reserved-ff9f1c?style=for-the-badge" alt="license" />
  </div>

  <br />
  <img src="docs/img/vibecat.gif" alt="vibecat" width="520" style="border-radius:20px;box-shadow:0 24px 80px rgba(2,6,23,0.6);border:1px solid rgba(255,255,255,0.04);margin-top:18px;">
</div>

---

## 📚 Project Documentation & Quick Links

- 📜 **[Product Requirements Document (PRD)](PRD.md)** — Project vision, features, technical stack, and architecture.
- 📡 **[API & Protocol Documentation](docs/API_DOCUMENTATION.md)** — Complete specification of REST endpoints and Socket.IO real-time events.
- 🏗️ **[Architecture Overview](ARCHITECTURE.md)** — Detailed technical design, NTP clock synchronization, and data flow.
- ⚠️ **[Copyright Warning & Legal Terms](COPYRIGHT_WARNING.md)** — Intellectual property notice, anti-theft policies, and DMCA enforcement rules.

---

## ✨ Key Highlights

- **⚡ Millisecond Audio Synchronization**: NTP-style latency calculation (`sync_ping`/`sync_pong`) so all listeners hear music in exact sync.
- **🚀 Ultra-Fast Stream Resolution**: Parallel search resolution (iTunes API + yt-dlp) with 302 CDN redirects and 2.5s stall recovery.
- **💬 Real-Time Chat & Flying Reactions**: Socket.IO chat with live flying floating emoji pop-up particle animations.
- **🔑 Zero Friction & Optional Discord OAuth**: Join anonymously as a guest or link your Discord account for custom profile sync.
- **📱 Fully Responsive SPA & PWA**: Mobile bottom tab bar, desktop multi-pane layout, installable PWA manifest.
- **💰 100% Free-Tier Architecture**: Engineered to run entirely on free-tier infrastructure (Vercel, Render, Supabase, Redis).

---

## 🛠️ Quick Local Setup

### 1. Clone & Setup Environment

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

### 2. Configure Environment (`.env`)

```env
SECRET_KEY=please-change-this-super-secret-key
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
REDIS_URL=redis://localhost:6379 # Optional, falls back to in-memory store
```

### 3. Run Backend & Frontend

```bash
# Run FastAPI Backend (Port 8000)
python run.py

# Run Next.js Frontend (Port 3000)
cd frontend-next
npm install
npm run dev
```

Visit `http://localhost:3000` to start jamming!

---

## ⚠️ Copyright & Legal Warning

**Copyright (c) 2026 Chaitanya. All Rights Reserved.**

This repository is protected by copyright law and proprietary software terms.
- **No Commercial Use**: Unauthorized commercial use, paid SaaS hosting, or subscription monetisation is strictly prohibited.
- **No Re-branding or Re-skinning**: You may not clone this repo, swap logos, and re-distribute it under another name.
- **DMCA Enforcement**: Any stolen code or unauthorized public deployment will be subject to immediate **DMCA Takedown Notices**.

Refer to **[COPYRIGHT_WARNING.md](COPYRIGHT_WARNING.md)** for full licensing terms and legal enforcement procedures.
