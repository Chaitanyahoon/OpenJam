/* ========================================
   OPEN JAM — YouTube Player
   Full-length playback via YouTube IFrame API
   ======================================== */

class YouTubePlayer {
  constructor() {
    this.player = null;           // YT.Player instance
    this.currentVideoId = null;
    this.positionMs = 0;
    this.durationMs = 0;
    this.isPlaying = false;
    this.progressInterval = null;
    this.onProgressUpdate = null;
    this._ready = false;
    this._pendingLoad = null;     // { videoId, startSeconds } to load once ready
    this._suppressStateChange = false;
    this._onPlaybackControl = null; // callback(action, data) for socket emit
    // Autoplay unlock: browsers block audio without a user gesture
    this._userUnlocked = false;
    this._pendingPlayAfterUnlock = null; // { videoId, startSeconds } to play after click
    this._initYouTubeAPI();
    
    // Global interaction listener to aggressively unlock audio context
    const unlockHandler = () => {
      this.unlockAudioContext();
      document.removeEventListener('click', unlockHandler);
      document.removeEventListener('keydown', unlockHandler);
    };
    document.addEventListener('click', unlockHandler, { once: true });
    document.addEventListener('keydown', unlockHandler, { once: true });
  }

  /** Load YouTube IFrame API if not already loaded. */
  _initYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      this._createPlayer();
      return;
    }
    window.onYouTubeIframeAPIReady = () => this._createPlayer();
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }

  _createPlayer() {
    const container = document.getElementById('youtube-player-container');
    if (!container) return;

    this.player = new YT.Player('youtube-player-container', {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0,      // We control playback manually after user unlock
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          this._ready = true;
          if (this._pendingLoad) {
            const { videoId, startSeconds } = this._pendingLoad;
            this._pendingLoad = null;
            this._loadVideo(videoId, startSeconds);
          }
        },
        onStateChange: (event) => this._onStateChange(event),
      },
    });
  }

  /**
   * Called by the room page once the user has clicked the "Tap to Listen" overlay.
   * Unlocks the audio context and immediately starts any pending playback.
   */
  unlockAudio() {
    this._userUnlocked = true;
    this._hideOverlay();

    if (this._pendingPlayAfterUnlock) {
      const { videoId, startSeconds } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      this._loadVideo(videoId, startSeconds);
    } else if (this._ready && this.player && this.currentVideoId && this.isPlaying) {
      // Already loaded, just unpause
      this.player.playVideo();
      this.startProgressTimer();
    }
  }

  /**
   * Called to explicitly unlock the audio context on any user gesture
   * to ensure playback isn't blocked.
   */
  unlockAudioContext() {
    if (this._userUnlocked) return;
    this._userUnlocked = true;
    this._hideOverlay();
    
    if (this._pendingPlayAfterUnlock) {
      const { videoId, startSeconds } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      this._loadVideo(videoId, startSeconds);
    } else if (this._ready && this.player && this.currentVideoId && this.isPlaying) {
      // Already loaded, just unpause
      this.player.playVideo();
      this.startProgressTimer();
    }
  }

  _showOverlay() {
    let overlay = document.getElementById('play-unlock-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'play-unlock-overlay';
      overlay.style.cssText = `
        position:fixed; inset:0; z-index:9990;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        background:rgba(10,9,8,0.82); backdrop-filter:blur(16px);
        cursor:pointer; user-select:none;
        animation: fadeInOverlay 0.4s ease;
      `;
      overlay.innerHTML = `
        <style>
          @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
          @keyframes pulseRing {
            0%   { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
            70%  { transform: scale(1);   box-shadow: 0 0 0 24px rgba(245,158,11,0); }
            100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          }
        </style>
        <div style="
          width:88px; height:88px; border-radius:50%;
          background:#f59e0b; display:flex; align-items:center; justify-content:center;
          box-shadow: 0 0 40px rgba(245,158,11,0.35);
          animation: pulseRing 1.8s ease infinite; margin-bottom:24px;
        ">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div style="font-family:'Righteous',cursive; font-size:20px; font-weight:700; color:#f5f0eb; margin-bottom:8px;">
          Tap to listen
        </div>
        <div style="font-size:14px; color:#9e958a; max-width:260px; text-align:center; line-height:1.5;">
          Your browser needs a tap to unlock audio
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', () => this.unlockAudio(), { once: true });
    }
  }

  _hideOverlay() {
    const overlay = document.getElementById('play-unlock-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => overlay.remove(), 300);
    }
  }

  _onStateChange(event) {
    if (this._suppressStateChange) return;
    const state = event.data;

    // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0, BUFFERING=3
    if (state === YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      this._userUnlocked = true;
      this._hideOverlay();
      this.startProgressTimer();
      this._emitControlEvent('play');
    } else if (state === YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      this.stopProgressTimer();
      const pos = this.player ? Math.round(this.player.getCurrentTime() * 1000) : this.positionMs;
      this._emitControlEvent('pause', { position_ms: pos });
    } else if (state === YT.PlayerState.ENDED) {
      this.isPlaying = false;
      this.stopProgressTimer();
      this._emitControlEvent('ended');
    }
    this.updateDisplay();
  }

  _emitControlEvent(action, extra = {}) {
    if (this._onPlaybackControl) {
      this._onPlaybackControl(action, { ...extra });
    }
  }

  /** Called by room.js to wire up socket emissions on local user interaction. */
  setControlCallback(fn) {
    this._onPlaybackControl = fn;
  }

  _loadVideo(videoId, startSeconds = 0) {
    if (!this._ready || !this.player) {
      this._pendingLoad = { videoId, startSeconds };
      return;
    }

    if (!this._userUnlocked) {
      // Show overlay and queue the load for after unlock
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
      return;
    }

    this._suppressStateChange = true;
    this.player.loadVideoById({ videoId, startSeconds });
    setTimeout(() => { this._suppressStateChange = false; }, 1000);
  }

  /** Called when a new track starts (from socket track_changed or initial load). */
  setTrack(trackData) {
    const videoId = trackData.track_uri;  // track_uri is now a YouTube video ID
    const startSeconds = Math.round((trackData.position_ms || 0) / 1000);
    this.positionMs = trackData.position_ms || 0;
    this.durationMs = trackData.duration_ms || 0;
    this.isPlaying = trackData.is_playing !== false;

    if (videoId && videoId !== this.currentVideoId) {
      this.currentVideoId = videoId;
      this._loadVideo(videoId, startSeconds);
    }

    if (this.isPlaying && this._userUnlocked) {
      this.startProgressTimer();
    } else {
      this.stopProgressTimer();
    }
    this.updateDisplay();
  }

  /** Called on every playback_sync socket event. */
  syncPosition(positionMs, isPlaying) {
    this.isPlaying = isPlaying;
    this.positionMs = positionMs;

    if (!this._userUnlocked) {
      // Show overlay if there is something actually playing
      if (isPlaying && this.currentVideoId) this._showOverlay();
      this.updateDisplay();
      return;
    }

    if (this._ready && this.player && this.player.getPlayerState) {
      const actualMs = Math.round((this.player.getCurrentTime?.() || 0) * 1000);
      const drift = Math.abs(actualMs - positionMs);

      this._suppressStateChange = true;
      if (drift > 3000) {
        this.player.seekTo(positionMs / 1000, true);
      }
      if (isPlaying) {
        this.player.playVideo();
        this.startProgressTimer();
      } else {
        this.player.pauseVideo();
        this.stopProgressTimer();
      }
      setTimeout(() => { this._suppressStateChange = false; }, 500);
    }

    this.updateDisplay();
  }

  startProgressTimer() {
    this.stopProgressTimer();
    this.progressInterval = setInterval(() => {
      if (this._ready && this.player && this.player.getCurrentTime) {
        const actualMs = Math.round(this.player.getCurrentTime() * 1000);
        if (actualMs > 0) this.positionMs = actualMs;
      } else if (this.isPlaying) {
        this.positionMs += 1000;
      }
      this.updateDisplay();
    }, 1000);
  }

  stopProgressTimer() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateDisplay() {
    const fill = document.getElementById('progress-fill');
    const elapsed = document.getElementById('time-elapsed');
    const total = document.getElementById('time-total');

    if (fill) {
      const pct = this.durationMs > 0 ? (this.positionMs / this.durationMs) * 100 : 0;
      fill.style.width = `${Math.min(pct, 100)}%`;
    }
    if (elapsed) elapsed.textContent = formatTime(this.positionMs);
    if (total) total.textContent = formatTime(this.durationMs);
    if (this.onProgressUpdate) {
      this.onProgressUpdate(this.positionMs, this.durationMs, this.isPlaying);
    }
  }

  destroy() {
    this.stopProgressTimer();
    this._hideOverlay();
    if (this.player && this.player.destroy) {
      try { this.player.destroy(); } catch (_) {}
    }
  }
}
