<div align="center">
  <br />
  <p align="center">
    <img src="https://img.shields.io/badge/Vibe-Immortal-ff0066?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Nickelback-Blocked-black?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Status-Grooving-00f2ff?style=for-the-badge" />
  </p>
  
  <h1 align="center">🌊 OPEN JAM</h1>
  
  <p align="center">
    <b>Stop listening to music alone like a misunderstood protagonist in a 2000s indie movie.</b><br />
    A high-fidelity social listening experience that actually stays in sync.
  </p>

  <p align="center">
    <a href="https://openjam.onrender.com/"><strong>Enter the Chaos &raquo;</strong></a>
  </p>
  
  <br />
</div>

---

### 🎧 THE VISION (Or: Why we built this)

Let’s face it: sharing music online usually involves sending a link that your friend "promises" to check out later (they won't). **OpenJam** fixes this. It’s a digital room where you can force—*ahem*, invite—your friends to listen to your superior music taste in real-time. 

<div align="center">
  <br />
  <img src="docs/img/vibecat.gif" width="450" style="border-radius: 30px; box-shadow: 0 20px 80px rgba(0, 242, 255, 0.2); border: 2px solid rgba(255,255,255,0.1);" />
  <p align="center"><i>Actual footage of a user discovering their friend likes Lo-Fi beats.</i></p>
  <br />
</div>

---

### ✨ THE GOOD STUFF

*   🌀 **Millisecond-Perfect Sync** — We spent way too much time on socket logic so you don't have to count "3... 2... 1... PLAY" over a Discord call.
*   🎨 **The Mood Ring UI** — The interface changes colors based on the album art. It’s basically a lava lamp for your browser.
*   🎭 **Persona Picker** — Choose a cute animal avatar. It won’t make your music taste better, but it’ll make you look more trustworthy.
*   💬 **Live Heckling** — A real-time chat for praising the DJ or immediately demanding a skip when the vibe gets weird.
*   🗳️ **Democratic Playback** — Use the power of the vote to skip tracks. Finally, a way to legally silence your friend's obsession with 10-minute experimental jazz.
*   📱 **PWA Magic** — Install it on your phone so you can judge people's music choices on the go.

---

### 🛠️ THE RECIPE

| Ingredient | Role | Why? |
| :--- | :--- | :--- |
| **FastAPI** | The Brains | Because waiting for a server is so 2015. |
| **Socket.IO** | The Pulse | The secret sauce that keeps everyone vibing at the exact same time. |
| **SQLite** | The Memory | A tiny database that packs a punch. No "Cloud" nonsense needed. |
| **Vanilla JS** | The Art | No 500MB React folders here. Just pure, organic, artisanal ES6. |
| **YouTube API** | The Source | If it's on YouTube, you can jam to it. (Yes, even that one song). |

---

### 🚀 HOW TO SUMMON THE VIBE

#### 1. Grab the code
```bash
git clone https://github.com/Chaitanyahoon/OpenJam.git
cd openjam
python -m venv .venv && source .venv/bin/activate # Unix
# .venv\Scripts\activate # Windows
pip install -r requirements.txt
```

#### 2. Tell the server who's boss
Create a `.env` in the root (Don't share your Secret Key, or the vibes will be compromised):
```env
SECRET_KEY=something-cooler-than-password123
ENVIRONMENT=production
ALLOWED_ORIGINS=http://localhost:8000
```

#### 3. Ignition
```bash
python run.py
```
*Head to `http://localhost:8000` and start your musical empire.*

---

### 🌌 THE LEGAL STUFF (Kind of)

*   **Audio Unlock**: Browsers hate fun. You *must* click anywhere on the page once to "unlock" the audio. It’s like a secret handshake.
*   **License**: MIT. Use it, break it, build something cooler. Just don't blame us if your friends' music taste ruins your day.

<div align="center">
  <br />
  <p>Built with ❤️ and way too much caffeine.</p>
  <p><b>OPEN JAM</b> — SOCIAL LISTENING, REINVENTED.</p>
</div>
