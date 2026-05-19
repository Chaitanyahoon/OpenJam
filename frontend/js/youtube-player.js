/* ========================================
    OPEN JAM — Audio Player
    Primary: Native HTML5 Audio via yt-dlp stream
    Fallback: YouTube IFrame API (when stream fails)
    ======================================== */

class YouTubePlayer {
  constructor() {
    this.player = new Audio();
    this.ytPlayer = null;
    this.currentVideoId = null;
    this.positionMs = 0;
    this.durationMs = 0;
    this.isPlaying = false;
    this.progressInterval = null;
    this.onProgressUpdate = null;
    this._ready = true;
    this._pendingLoad = null;
    this._suppressStateChange = false;
    this._onPlaybackControl = null;
    this._userUnlocked = false;
    this._pendingPlayAfterUnlock = null;
    this._useIFrame = false;
    this._streamFailCount = 0;
    this._maxStreamFails = 2;

    this._initAudio();

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
    this.player.addEventListener('error', () => {
      this._streamFailCount++;
      if (this._streamFailCount >= this._maxStreamFails && !this._useIFrame) {
        console.warn('Stream failed multiple times, switching to YouTube IFrame fallback');
        this._useIFrame = true;
        this._initIFramePlayer();
        if (this.currentVideoId) {
          this._loadVideo(this.currentVideoId, Math.round(this.positionMs / 1000));
        }
      }
    });
  }

  _initIFramePlayer() {
    if (this.ytPlayer) return;

    let container = document.getElementById('yt-fallback-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-fallback-container';
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(container);
    }

    if (window.YT && window.YT.Player) {
      this._createYTPlayer(container);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => this._createYTPlayer(container);
  }

  _createYTPlayer(container) {
    this.ytPlayer = new YT.Player(container, {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1, fs: 0,
        modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1,
      },
      events: {
        onReady: () => { this._ready = true; this._processPending(); },
        onStateChange: (e) => {
          const map = {
            [YT.PlayerState.PLAYING]: 'play',
            [YT.PlayerState.PAUSED]: 'pause',
            [YT.PlayerState.ENDED]: 'ended',
          };
          if (map[e.data]) this._onStateChange(map[e.data]);
        },
        onError: (e) => console.error('YouTube IFrame error:', e.data),
      },
    });
  }

  _processPending() {
    if (this._pendingLoad) {
      const { videoId, startSeconds } = this._pendingLoad;
      this._pendingLoad = null;
      this._loadVideo(videoId, startSeconds);
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
      const pos = this._useIFrame
        ? Math.round(this.ytPlayer.getCurrentTime() * 1000)
        : Math.round(this.player.currentTime * 1000);
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

  setControlCallback(fn) {
    this._onPlaybackControl = fn;
  }

  unlockAudio() {
    this._userUnlocked = true;
    this._hideOverlay();

    if (this._pendingPlayAfterUnlock) {
      const { videoId, startSeconds } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      this._loadVideo(videoId, startSeconds);
    } else if (this.currentVideoId && this.isPlaying) {
      if (this._useIFrame) this.ytPlayer.playVideo();
      else this.player.play().catch(() => {});
      this.startProgressTimer();
    }
  }

  unlockAudioContext() {
    if (this._userUnlocked) return;
    this._userUnlocked = true;
    this._hideOverlay();

    if (this._pendingPlayAfterUnlock) {
      const { videoId, startSeconds } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      this._loadVideo(videoId, startSeconds);
    } else if (this.currentVideoId && this.isPlaying) {
      if (this._useIFrame) this.ytPlayer.playVideo();
      else this.player.play().catch(() => {});
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

  _loadVideo(videoId, startSeconds = 0) {
    if (!this._userUnlocked) {
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
      return;
    }

    this._suppressStateChange = true;
    this.currentVideoId = videoId;

    if (this._useIFrame && this.ytPlayer) {
      this.ytPlayer.loadVideoById({ videoId, startSeconds });
    } else {
      this.player.src = `/stream/${videoId}`;
      this.player.currentTime = startSeconds;
      this.player.play().catch(e => {
        console.error('Autoplay prevented:', e);
        // Only show overlay if user hasn't unlocked yet
        if (!this._userUnlocked) {
          this._pendingPlayAfterUnlock = { videoId, startSeconds };
          this._showOverlay();
        }
      });
    }
    setTimeout(() => { this._suppressStateChange = false; }, 1000);
  }

  setTrack(trackData) {
    const videoId = trackData.track_uri;
    const startSeconds = Math.round((trackData.position_ms || 0) / 1000);
    this.positionMs = trackData.position_ms || 0;
    this.durationMs = trackData.duration_ms || 0;
    this.isPlaying = trackData.is_playing !== false;

    if (videoId && videoId !== this.currentVideoId) {
      this._loadVideo(videoId, startSeconds);
    }

    if (this.isPlaying && this._userUnlocked) {
      this.startProgressTimer();
    } else {
      this.stopProgressTimer();
    }
    this.updateDisplay();
  }

  syncPosition(positionMs, isPlaying) {
    this.isPlaying = isPlaying;
    this.positionMs = positionMs;

    if (!this._userUnlocked) {
      if (isPlaying && this.currentVideoId) this._showOverlay();
      this.updateDisplay();
      return;
    }

    if (this._useIFrame && this.ytPlayer) {
      const actualMs = Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000);
      const drift = Math.abs(actualMs - positionMs);
      this._suppressStateChange = true;
      if (drift > 3000) this.ytPlayer.seekTo(positionMs / 1000, true);
      if (isPlaying) { this.ytPlayer.playVideo(); this.startProgressTimer(); }
      else { this.ytPlayer.pauseVideo(); this.stopProgressTimer(); }
      setTimeout(() => { this._suppressStateChange = false; }, 500);
    } else {
      const actualMs = Math.round((this.player.currentTime || 0) * 1000);
      const drift = Math.abs(actualMs - positionMs);
      this._suppressStateChange = true;
      if (drift > 3000) this.player.currentTime = positionMs / 1000;
      if (isPlaying) {
        this.player.play().catch(e => {
          console.error('Autoplay prevented on sync:', e);
          // Only show overlay if user hasn't unlocked yet
          if (!this._userUnlocked) {
            this._pendingPlayAfterUnlock = { videoId: this.currentVideoId, startSeconds: positionMs / 1000 };
            this._showOverlay();
          }
        });
        this.startProgressTimer();
      } else {
        this.player.pause();
        this.stopProgressTimer();
      }
      setTimeout(() => { this._suppressStateChange = false; }, 500);
    }

    this.updateDisplay();
  }

  startProgressTimer() {
    this.stopProgressTimer();
    this.progressInterval = setInterval(() => {
      const actualMs = this._useIFrame && this.ytPlayer
        ? Math.round(this.ytPlayer.getCurrentTime() * 1000)
        : Math.round(this.player.currentTime * 1000);
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
    const elapsedB = document.getElementById('time-cur');
    const totalB = document.getElementById('time-dur');

    const pct = this.durationMs > 0 ? (this.positionMs / this.durationMs) * 100 : 0;
    if (fillA) fillA.style.width = `${Math.min(pct, 100)}%`;
    if (fillB) fillB.style.width = `${Math.min(pct, 100)}%`;

    if (elapsedB) elapsedB.textContent = formatTime(this.positionMs);
    if (totalB) totalB.textContent = formatTime(this.durationMs);
    if (this.onProgressUpdate) {
      this.onProgressUpdate(this.positionMs, this.durationMs, this.isPlaying);
    }
  }

  destroy() {
    this.stopProgressTimer();
    this._hideOverlay();
    if (this._useIFrame && this.ytPlayer) {
      this.ytPlayer.pauseVideo();
      this.ytPlayer.destroy();
      this.ytPlayer = null;
    } else {
      this.player.pause();
      this.player.src = '';
    }
  }
}
