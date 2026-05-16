/* ========================================
   OPEN JAM — Audio Player
   Full-length playback via Native HTML5 Audio
   ======================================== */

class YouTubePlayer {
  constructor() {
    this.player = new Audio();
    this.currentVideoId = null;
    this.positionMs = 0;
    this.durationMs = 0;
    this.isPlaying = false;
    this.progressInterval = null;
    this.onProgressUpdate = null;
    this._ready = true; // Native audio is always ready to receive commands
    this._pendingLoad = null;     // { videoId, startSeconds } to load once ready
    this._suppressStateChange = false;
    this._onPlaybackControl = null; // callback(action, data) for socket emit
    // Autoplay unlock: browsers block audio without a user gesture
    this._userUnlocked = false;
    this._pendingPlayAfterUnlock = null; // { videoId, startSeconds } to play after click
    
    this._initAudio();
    
    // Global interaction listener to aggressively unlock audio context
    const unlockHandler = () => {
      this.unlockAudioContext();
      document.removeEventListener('click', unlockHandler);
      document.removeEventListener('keydown', unlockHandler);
    };
    document.addEventListener('click', unlockHandler, { once: true });
    document.addEventListener('keydown', unlockHandler, { once: true });
  }

  _initAudio() {
    this.player.addEventListener('play', () => this._onStateChange('play'));
    this.player.addEventListener('pause', () => this._onStateChange('pause'));
    this.player.addEventListener('ended', () => this._onStateChange('ended'));
    this.player.addEventListener('error', (e) => console.error('Audio playback error:', e));

    // Removed legacy YT.Player compatibility methods. All playback uses direct audio streaming.
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
    } else if (this.currentVideoId && this.isPlaying) {
      this.player.play().catch(e => console.error('Play blocked:', e));
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
    } else if (this.currentVideoId && this.isPlaying) {
      this.player.play().catch(e => console.error('Play blocked:', e));
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

  _onStateChange(state) {
    if (this._suppressStateChange) return;

    if (state === 'play') {
      this.isPlaying = true;
      this._userUnlocked = true;
      this._hideOverlay();
      this.startProgressTimer();
      this._emitControlEvent('play');
    } else if (state === 'pause') {
      this.isPlaying = false;
      this.stopProgressTimer();
      const pos = Math.round(this.player.currentTime * 1000);
      this._emitControlEvent('pause', { position_ms: pos });
    } else if (state === 'ended') {
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
    if (!this._userUnlocked) {
      // Show overlay and queue the load for after unlock
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
      return;
    }

    this._suppressStateChange = true;
    this.player.src = `/stream/${videoId}`;
    this.player.currentTime = startSeconds;
    this.player.play().catch(e => {
      console.error('Autoplay prevented:', e);
      this._userUnlocked = false;
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
    });
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

    const actualMs = Math.round((this.player.currentTime || 0) * 1000);
    const drift = Math.abs(actualMs - positionMs);

    this._suppressStateChange = true;
    if (drift > 3000) {
      this.player.currentTime = positionMs / 1000;
    }
    if (isPlaying) {
      this.player.play().catch(e => {
        console.error('Autoplay prevented on sync:', e);
        this._userUnlocked = false;
        this._showOverlay();
      });
      this.startProgressTimer();
    } else {
      this.player.pause();
      this.stopProgressTimer();
    }
    setTimeout(() => { this._suppressStateChange = false; }, 500);

    this.updateDisplay();
  }

  startProgressTimer() {
    this.stopProgressTimer();
    this.progressInterval = setInterval(() => {
      const actualMs = Math.round(this.player.currentTime * 1000);
      if (actualMs > 0) this.positionMs = actualMs;
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
    const fillA = document.getElementById('progress-fill');
    const fillB = document.getElementById('progress');
    const elapsedA = document.getElementById('time-elapsed');
    const elapsedB = document.getElementById('time-cur');
    const totalA = document.getElementById('time-total');
    const totalB = document.getElementById('time-dur');

    const pct = this.durationMs > 0 ? (this.positionMs / this.durationMs) * 100 : 0;
    if (fillA) fillA.style.width = `${Math.min(pct, 100)}%`;
    if (fillB) fillB.style.width = `${Math.min(pct, 100)}%`;

    if (elapsedA) elapsedA.textContent = formatTime(this.positionMs);
    if (elapsedB) elapsedB.textContent = formatTime(this.positionMs);
    if (totalA) totalA.textContent = formatTime(this.durationMs);
    if (totalB) totalB.textContent = formatTime(this.durationMs);
    if (this.onProgressUpdate) {
      this.onProgressUpdate(this.positionMs, this.durationMs, this.isPlaying);
    }
  }

  destroy() {
    this.stopProgressTimer();
    this._hideOverlay();
    this.player.pause();
    this.player.src = '';
  }

  // Removed legacy YT.Player compatibility methods. All playback uses direct audio streaming.
}
