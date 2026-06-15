const SILENT_WAV_B64 = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";
const getBackendUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    return 'https://openjam.onrender.com';
  }
  return 'http://localhost:8000';
};
const BACKEND_URL = getBackendUrl();

export default class YouTubePlayer {
  constructor(options = {}) {
    if (typeof window === 'undefined') return;

    this.player = new Audio();
    this.player.preload = "auto";
    this.ytPlayer = null;
    this.currentVideoId = null;
    this.positionMs = 0;
    this.durationMs = 0;
    this.isPlaying = false;
    this.progressInterval = null;
    this.onProgressUpdate = options.onProgressUpdate || null;
    this.onStreamFailUpdate = options.onStreamFailUpdate || null;
    this.toast = options.toast || console.log;
    this._ready = true;
    this._pendingLoad = null;
    this._suppressStateChange = false;
    this._onPlaybackControl = null;
    this._userUnlocked = false;
    this._pendingPlayAfterUnlock = null;
    this._useIFrame = false;
    this._useLowBitrate = false;
    this._streamFailCount = 0;
    this._maxStreamFails = 2;
    this.volume = 80;

    this._isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this._wakeLock = null;
    this._keepAliveCtx = null;
    this._keepAliveOsc = null;

    if (this._isMobile) {
      this._maxStreamFails = 4;
    }

    this._initAudio();
    this._initMediaSession();
    this._initBackgroundPlayback();

    const unlockHandler = () => {
      this.unlockAudioContext();
      document.removeEventListener('click', unlockHandler);
      document.removeEventListener('keydown', unlockHandler);
    };
    document.addEventListener('click', unlockHandler, { once: true });
    document.addEventListener('keydown', unlockHandler, { once: true });
  }

  _initAudio() {
    this.player.addEventListener('loadstart', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      this._showLoadIndicator();
    });
    this.player.addEventListener('play', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      this._onStateChange('play');
      this._hideLoadIndicator();
    });
    this.player.addEventListener('pause', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      this._onStateChange('pause');
    });
    this.player.addEventListener('ended', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      this._onStateChange('ended');
    });
    this.player.addEventListener('canplay', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      if (this._stallTimer) { clearTimeout(this._stallTimer); this._stallTimer = null; }
      this._hideLoadIndicator();
    });

    const handleAudioError = (source) => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      this._hideLoadIndicator();
      console.error(`Audio stream error from ${source}, fail count:`, this._streamFailCount);
      this._streamFailCount++;

      if (this._streamFailCount >= this._maxStreamFails) {
        if (this._isMobile) {
          console.error(`Mobile stream failed completely after ${this._streamFailCount} attempts.`);
          this.toast("Playback failed after multiple retries. Skipping...", "error");
          this._emitControlEvent('nexttrack');
        } else if (!this._useIFrame) {
          console.warn('Stream failed completely, switching to YouTube IFrame fallback');
          if (this.onStreamFailUpdate) this.onStreamFailUpdate(null);
          
          try {
            this.player.pause();
            this.player.src = '';
            this.player.load();
          } catch (e) {}

          this._useIFrame = true;
          this._initIFramePlayer();
          if (this.currentVideoId) {
            this._loadVideo(this.currentVideoId, Math.round(this.positionMs / 1000));
          }
        }
      } else {
        if (this._streamFailCount === 1 && !this._useLowBitrate && this.currentVideoId) {
          console.warn('Stream failed, trying low bitrate fallback...');
          if (this.onStreamFailUpdate) this.onStreamFailUpdate("Trying alternative source…");
          this._useLowBitrate = true;
          this.player.src = `${BACKEND_URL}/stream/${this.currentVideoId}?low=true`;
          this.setVolume(this.volume);
          this.player.currentTime = Math.round(this.positionMs / 1000);
          this.player.play().catch(() => {});
        } else if (this._streamFailCount === 2 && this.currentVideoId) {
          console.warn('Stream failed again, trying low bitrate with cache-buster...');
          if (this.onStreamFailUpdate) this.onStreamFailUpdate("Refreshing stream metadata…");
          this.player.src = `${BACKEND_URL}/stream/${this.currentVideoId}?low=true&nocache=true`;
          this.setVolume(this.volume);
          this.player.currentTime = Math.round(this.positionMs / 1000);
          this.player.play().catch(() => {});
        } else if (this._streamFailCount === 3 && this.currentVideoId) {
          console.warn('Stream failed 3 times, trying fresh standard stream...');
          if (this.onStreamFailUpdate) this.onStreamFailUpdate("Retrying standard source…");
          this.player.src = `${BACKEND_URL}/stream/${this.currentVideoId}?nocache=true`;
          this.setVolume(this.volume);
          this.player.currentTime = Math.round(this.positionMs / 1000);
          this.player.play().catch(() => {});
        }
      }
    };

    this.player.addEventListener('error', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      const err = this.player.error;
      console.error("HTML5 Audio Error details:", err ? { code: err.code, message: err.message } : "No details");
      console.error("HTML5 Audio Player State:", {
        src: this.player.src,
        networkState: this.player.networkState,
        readyState: this.player.readyState
      });
      handleAudioError('error_event');
    });

    this.player.addEventListener('stalled', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      if (this._stallTimer) clearTimeout(this._stallTimer);
      this._showLoadIndicator();
      this._stallTimer = setTimeout(() => {
        if (this.player.readyState < 2 && !this.player.paused) {
          console.warn('Stream stalled for 12s, triggering error');
          handleAudioError('stalled_timeout');
        }
      }, 12000);
    });

    this.player.addEventListener('waiting', () => {
      if (!this.player.src || !this.player.src.includes('/stream/')) return;
      if (this._stallTimer) clearTimeout(this._stallTimer);
      this._showLoadIndicator();
      this._stallTimer = setTimeout(() => {
        if (this.player.readyState < 2 && !this.player.paused) {
          console.warn('Stream waiting too long, triggering error');
          handleAudioError('waiting_timeout');
        }
      }, 12000);
    });
  }

  _initIFramePlayer() {
    if (this.ytPlayer) return;

    let wrapper = document.getElementById('yt-fallback-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'yt-fallback-wrapper';
      wrapper.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
      
      const placeholder = document.createElement('div');
      placeholder.id = 'yt-fallback-placeholder';
      wrapper.appendChild(placeholder);
      
      document.body.appendChild(wrapper);
    }

    const targetElement = document.getElementById('yt-fallback-placeholder') || wrapper;

    if (window.YT && window.YT.Player) {
      this._createYTPlayer(targetElement);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => this._createYTPlayer(targetElement);
  }

  _createYTPlayer(container) {
    this.ytPlayer = new window.YT.Player(container, {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1, fs: 0,
        modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1,
      },
      events: {
        onReady: () => { 
          this._ready = true; 
          this.setVolume(this.volume);
          this._processPending(); 
        },
        onStateChange: (e) => {
          const map = {
            [window.YT.PlayerState.PLAYING]: 'play',
            [window.YT.PlayerState.PAUSED]: 'pause',
            [window.YT.PlayerState.ENDED]: 'ended',
          };
          if (map[e.data]) this._onStateChange(map[e.data]);
        },
        onError: (e) => {
          console.error('YouTube IFrame error:', e.data);
          if (this.onStreamFailUpdate) this.onStreamFailUpdate("This track is unavailable");
          if (e.data === 150 || e.data === 101) {
            this.toast('This track is restricted. Skipping...', 'warning');
            setTimeout(() => this._onStateChange('ended'), 2000);
          } else {
            this.toast("This track can't be played in your region.", 'error');
            setTimeout(() => this._onStateChange('ended'), 2000);
          }
        },
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
      this._hideLoadIndicator();
      if (this._loadTimeout) { clearTimeout(this._loadTimeout); this._loadTimeout = null; }
      this.startProgressTimer();
      this._requestWakeLock();
      this._startSilentKeepAlive();
      const pos = this._useIFrame
        ? Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000)
        : Math.round((this.player.currentTime || 0) * 1000);
      this._emitControlEvent('play', { position_ms: pos });
    } else if (state === 'pause') {
      this.isPlaying = false;
      this.stopProgressTimer();
      this._releaseWakeLock();
      this._stopSilentKeepAlive();
      const pos = this._useIFrame
        ? Math.round(this.ytPlayer.getCurrentTime() * 1000)
        : Math.round(this.player.currentTime * 1000);
      this._emitControlEvent('pause', { position_ms: pos });
    } else if (state === 'ended') {
      this.isPlaying = false;
      this.stopProgressTimer();
      if (this._isMobile) {
        try {
          this.player.src = SILENT_WAV_B64;
          this.player.loop = true;
          this.player.play().catch(() => {});
          console.log('[MediaBG] Playing silent transition audio');
        } catch (e) {}
      } else {
        this._releaseWakeLock();
        this._stopSilentKeepAlive();
      }
      this._emitControlEvent('ended');
    }
    this.updateDisplay();
    this._updateMediaSessionPlaybackState();
    this._updateMediaSessionPositionState();
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
      const { videoId } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      const startSeconds = Math.round(this.positionMs / 1000);
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
      const { videoId } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      const startSeconds = Math.round(this.positionMs / 1000);
      this._loadVideo(videoId, startSeconds);
    } else if (this.currentVideoId && this.isPlaying) {
      if (this._useIFrame) this.ytPlayer.playVideo();
      else this.player.play().catch(() => {});
      this.startProgressTimer();
    }
  }

  _showOverlay() {
    this._hideLoadIndicator();
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
        <div style="font-family:sans-serif; font-size:20px; font-weight:700; color:#f5f0eb; margin-bottom:8px;">
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

  _showLoadIndicator() {
    if (this.onStreamFailUpdate) this.onStreamFailUpdate("Buffering stream…");
  }

  _hideLoadIndicator() {
    if (this.onStreamFailUpdate) this.onStreamFailUpdate(null);
  }

  _loadVideo(videoId, startSeconds = 0) {
    if (!videoId) return;
    if (!this._userUnlocked) {
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
      return;
    }

    this._suppressStateChange = true;
    
    if (videoId !== this.currentVideoId) {
      this._streamFailCount = 0;
      this._useLowBitrate = false;
      if (this._useIFrame) {
        this._useIFrame = false;
        if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
          try {
            this.ytPlayer.stopVideo();
          } catch (e) {
            console.error('Error stopping YT player during transition:', e);
          }
        }
      }
      try {
        this.player.pause();
        this.player.src = '';
      } catch (e) {}
    }

    this.currentVideoId = videoId;

    if (this._useIFrame) {
      if (this.ytPlayer && this._ready) {
        this.ytPlayer.loadVideoById({ videoId, startSeconds });
      } else {
        this._pendingLoad = { videoId, startSeconds };
        if (!this.ytPlayer) this._initIFramePlayer();
      }
    } else {
      if (this.onStreamFailUpdate) this.onStreamFailUpdate("Connecting to audio stream…");

      if (this._loadTimeout) clearTimeout(this._loadTimeout);
      this._loadTimeout = setTimeout(() => {
        if (this.player.readyState === 0 && this.player.src.includes('/stream/')) {
          console.warn('Stream load timeout after 6s');
          this.player.dispatchEvent(new Event('error'));
        }
      }, 6000);

      this.player.loop = false;
      this.player.src = `${BACKEND_URL}/stream/${videoId}`;
      this.setVolume(this.volume);
      if (startSeconds > 0) {
        this.player.addEventListener('loadedmetadata', () => {
          this.player.currentTime = startSeconds;
        }, { once: true });
      }
      this.player.play().catch(e => {
        if (e.name === 'AbortError') return;
        console.error('Autoplay prevented:', e);
        if (!this._userUnlocked) {
          this._pendingPlayAfterUnlock = { videoId, startSeconds };
          this._showOverlay();
        }
      });
    }
    setTimeout(() => { this._suppressStateChange = false; }, 1000);
  }

  setTrack(trackData) {
    if (!trackData || !trackData.track_uri) {
      this.stop();
      return;
    }
    const videoId = trackData.track_uri;
    const startSeconds = Math.round((trackData.position_ms || 0) / 1000);
    this.positionMs = trackData.position_ms || 0;
    this.durationMs = trackData.duration_ms || 0;
    this.isPlaying = trackData.is_playing !== false;

    if (videoId && videoId !== this.currentVideoId) {
      this._loadVideo(videoId, startSeconds);
    } else if (videoId) {
      if (this._useIFrame) {
        if (this.ytPlayer && this._ready && typeof this.ytPlayer.seekTo === 'function') {
          this.ytPlayer.seekTo(startSeconds, true);
        }
      } else if (this.player) {
        this.player.currentTime = startSeconds;
      }
    }

    if (this.isPlaying && this._userUnlocked) {
      this.startProgressTimer();
      if (videoId === this.currentVideoId) {
        if (this._useIFrame) {
          if (this.ytPlayer && this._ready && typeof this.ytPlayer.playVideo === 'function') {
            this.ytPlayer.playVideo();
          }
        } else if (this.player && this.player.paused) {
          this.player.play().catch(() => {});
        }
      }
    } else {
      this.stopProgressTimer();
    }
    this.updateDisplay();
    this._updateMediaSessionMetadata(trackData.track_name, trackData.artist, trackData.album_art_url);
    this._updateMediaSessionPlaybackState();
    this._updateMediaSessionPositionState();
  }

  syncPosition(positionMs, isPlaying) {
    this.isPlaying = isPlaying;
    this.positionMs = positionMs;

    if (!this._userUnlocked) {
      if (isPlaying && this.currentVideoId) this._showOverlay();
      this.updateDisplay();
      return;
    }

    if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      const actualMs = Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000);
      const drift = Math.abs(actualMs - positionMs);
      this._suppressStateChange = true;
      if (drift > 3000 && typeof this.ytPlayer.seekTo === 'function') this.ytPlayer.seekTo(positionMs / 1000, true);
      if (isPlaying) { if (typeof this.ytPlayer.playVideo === 'function') this.ytPlayer.playVideo(); this.startProgressTimer(); }
      else { if (typeof this.ytPlayer.pauseVideo === 'function') this.ytPlayer.pauseVideo(); this.stopProgressTimer(); }
      setTimeout(() => { this._suppressStateChange = false; }, 500);
    } else if (this._useIFrame) {
      this.updateDisplay();
      return;
    } else {
      const actualMs = Math.round((this.player.currentTime || 0) * 1000);
      const drift = Math.abs(actualMs - positionMs);
      this._suppressStateChange = true;
      if (drift > 3000) this.player.currentTime = positionMs / 1000;
      if (isPlaying) {
        this.player.play().catch(e => {
          console.error('Autoplay prevented on sync:', e);
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
    this._updateMediaSessionPlaybackState();
    this._updateMediaSessionPositionState();
  }

  setPlayState(playing) {
    if (!this._userUnlocked || !this.currentVideoId) return;
    this._suppressStateChange = true;
    this.isPlaying = playing;
    if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      if (playing) { this.ytPlayer.playVideo(); this.startProgressTimer(); }
      else { if (typeof this.ytPlayer.pauseVideo === 'function') this.ytPlayer.pauseVideo(); this.stopProgressTimer(); }
    } else if (this.player) {
      if (playing) {
        this.player.play().catch(() => {});
        this.startProgressTimer();
      } else {
        this.player.pause();
        this.stopProgressTimer();
      }
    }
    setTimeout(() => { this._suppressStateChange = false; }, 500);
    this.updateDisplay();
    this._updateMediaSessionPlaybackState();
    this._updateMediaSessionPositionState();
  }

  startProgressTimer() {
    this.stopProgressTimer();
    this.progressInterval = setInterval(() => {
      let actualMs = 0;
      try {
        if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
          actualMs = Math.round(this.ytPlayer.getCurrentTime() * 1000);
        } else if (this.player) {
          actualMs = Math.round(this.player.currentTime * 1000);
        }
      } catch (e) {}
      if (actualMs > 0) this.positionMs = actualMs;

      if (this.durationMs <= 0) {
        try {
          const actualDurSec = (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function')
            ? this.ytPlayer.getDuration()
            : (this.player ? this.player.duration : 0);
          if (actualDurSec > 0) {
            this.durationMs = Math.round(actualDurSec * 1000);
          }
        } catch (e) {}
      }

      this.updateDisplay();
      this._updateMediaSessionPositionState();
    }, 100);
  }

  stopProgressTimer() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateDisplay() {
    if (this.onProgressUpdate) {
      this.onProgressUpdate(this.positionMs, this.durationMs, this.isPlaying);
    }
  }

  stop() {
    this.stopProgressTimer();
    this._hideOverlay();
    this._hideLoadIndicator();
    this.isPlaying = false;
    this.currentVideoId = null;
    this.positionMs = 0;
    this._pendingLoad = null;
    this._pendingPlayAfterUnlock = null;
    this._releaseWakeLock();
    this._stopSilentKeepAlive();
    try {
      this.player.pause();
      this.player.src = '';
      this.player.load();
    } catch (e) {}

    if (this.ytPlayer) {
      try { this.ytPlayer.stopVideo(); } catch (e) {}
    }
    this.updateDisplay();
    this._updateMediaSessionPlaybackState();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
    }
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.player) this.player.volume = vol / 100;
    if (this.ytPlayer && this._ready && typeof this.ytPlayer.setVolume === 'function') {
      this.ytPlayer.setVolume(vol);
    }
  }

  destroy() {
    this.stop();
    if (this._useIFrame && this.ytPlayer) {
      try { this.ytPlayer.destroy(); } catch(e) {}
      this.ytPlayer = null;
    }
    const wrapper = document.getElementById('yt-fallback-wrapper');
    if (wrapper) {
      try { wrapper.remove(); } catch (e) {}
    }
  }

  /* WakeLock */
  async _requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      if (this._wakeLock) {
        try { await this._wakeLock.release(); } catch (e) {}
      }
      this._wakeLock = await navigator.wakeLock.request('screen');
      this._wakeLock.addEventListener('release', () => {
        if (this.isPlaying && !document.hidden) {
          this._requestWakeLock();
        }
      });
      console.log('[MediaBG] WakeLock acquired');
    } catch (e) {
      console.warn('[MediaBG] WakeLock request failed:', e);
    }
  }

  async _releaseWakeLock() {
    if (this._wakeLock) {
      try {
        await this._wakeLock.release();
        this._wakeLock = null;
        console.log('[MediaBG] WakeLock released');
      } catch (e) {}
    }
  }

  _startSilentKeepAlive() {
    if (this._keepAliveOsc) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this._keepAliveCtx || this._keepAliveCtx.state === 'closed') {
        this._keepAliveCtx = new AudioCtx();
      }
      if (this._keepAliveCtx.state === 'suspended') {
        this._keepAliveCtx.resume();
      }
      const osc = this._keepAliveCtx.createOscillator();
      const gain = this._keepAliveCtx.createGain();
      gain.gain.value = 0.0001;
      osc.frequency.value = 1;
      osc.connect(gain);
      gain.connect(this._keepAliveCtx.destination);
      osc.start();
      this._keepAliveOsc = osc;
      console.log('[MediaBG] Silent keepalive started');
    } catch (e) {
      console.warn('[MediaBG] Silent keepalive failed:', e);
    }
  }

  _stopSilentKeepAlive() {
    if (this._keepAliveOsc) {
      try { this._keepAliveOsc.stop(); } catch (e) {}
      this._keepAliveOsc = null;
      console.log('[MediaBG] Silent keepalive stopped');
    }
  }

  /* Media Session API */
  _initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      if (this._useIFrame && this.ytPlayer) {
        this.ytPlayer.playVideo();
      } else if (this.player) {
        this.player.play().catch(() => {});
      }
      this.isPlaying = true;
      this.startProgressTimer();
      this._emitControlEvent('play');
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (this._useIFrame && this.ytPlayer) {
        this.ytPlayer.pauseVideo();
      } else if (this.player) {
        this.player.pause();
      }
      this.isPlaying = false;
      this.stopProgressTimer();
      this._emitControlEvent('pause');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this._emitControlEvent('nexttrack');
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this._emitControlEvent('previoustrack');
    });

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const seekTime = details.seekTime;
        if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
          this.ytPlayer.seekTo(seekTime, true);
        } else if (this.player) {
          this.player.currentTime = seekTime;
        }
        this.positionMs = Math.round(seekTime * 1000);
        this._emitControlEvent('seek', { position_ms: this.positionMs });
      });
    } catch (e) {
      console.warn('[MediaSession] seekto action handler not supported:', e);
    }
  }

  _updateMediaSessionMetadata(trackName, artistName, albumArtUrl) {
    if (!('mediaSession' in navigator)) return;

    const defaultArtwork = [
      { src: '/static/img/icon-192.png', sizes: '96x96', type: 'image/png' },
      { src: '/static/img/icon-192.png', sizes: '128x128', type: 'image/png' },
      { src: '/static/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/static/img/icon-192.png', sizes: '256x256', type: 'image/png' },
      { src: '/static/img/icon-512.png', sizes: '384x384', type: 'image/png' },
      { src: '/static/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    ];

    const artwork = albumArtUrl 
      ? [
          { src: albumArtUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: albumArtUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: albumArtUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: albumArtUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: albumArtUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: albumArtUrl, sizes: '512x512', type: 'image/jpeg' },
        ]
      : defaultArtwork;

    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: trackName || 'OpenJam Track',
      artist: artistName || 'OpenJam DJ',
      album: 'OpenJam Live Room',
      artwork: artwork
    });
  }

  _updateMediaSessionPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
  }

  _updateMediaSessionPositionState() {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    try {
      const duration = (this.durationMs || 0) / 1000;
      const position = (this.positionMs || 0) / 1000;
      if (duration > 0 && position >= 0 && position <= duration) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: position
        });
      }
    } catch (e) {
      console.warn('[MediaSession] setPositionState failed:', e);
    }
  }

  _initBackgroundPlayback() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isPlaying) {
        this._requestWakeLock();
      }
    });
  }
}
