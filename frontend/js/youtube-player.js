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
    this.onStreamFailUpdate = null;
    this._ready = true;
    this._pendingLoad = null;
    this._suppressStateChange = false;
    this._onPlaybackControl = null;
    this._userUnlocked = false;
    this._pendingPlayAfterUnlock = null;
    this._useIFrame = false;
    this._useLowBitrate = false;
    this._streamFailCount = 0;
    this._maxStreamFails = 1;  // Switch to IFrame after 1 fail (don't waste user's time)
    this.volume = 80; // Default volume (persists across tracks)

    this._initAudio();
    this._initMediaSession();

    const unlockHandler = () => {
      this.unlockAudioContext();
      document.removeEventListener('click', unlockHandler);
      document.removeEventListener('keydown', unlockHandler);
    };
    document.addEventListener('click', unlockHandler, { once: true });
    document.addEventListener('keydown', unlockHandler, { once: true });
  }

  _initAudio() {
    this.player.addEventListener('loadstart', () => this._showLoadIndicator());
    this.player.addEventListener('play', () => {
      this._onStateChange('play');
      this._hideLoadIndicator();
    });
    this.player.addEventListener('pause', () => this._onStateChange('pause'));
    this.player.addEventListener('ended', () => this._onStateChange('ended'));
    this.player.addEventListener('canplay', () => {
      if (this._stallTimer) { clearTimeout(this._stallTimer); this._stallTimer = null; }
      this._hideLoadIndicator();
    });

    const handleAudioError = (source) => {
      this._hideLoadIndicator();
      console.error(`Audio stream error from ${source}, fail count:`, this._streamFailCount);
      this._streamFailCount++;

      if (this._streamFailCount === 1 && !this._useLowBitrate && this.currentVideoId) {
        console.warn('Stream failed, trying low bitrate fallback...');
        if (this.onStreamFailUpdate) this.onStreamFailUpdate("Trying alternative source…");
        this._useLowBitrate = true;
        this.player.src = `/stream/${this.currentVideoId}?low=true`;
        this.setVolume(this.volume);
        this.player.currentTime = Math.round(this.positionMs / 1000);
        this.player.play().catch(() => {});
      } else if (this._streamFailCount >= this._maxStreamFails && !this._useIFrame) {
        console.warn('Stream failed multiple times, switching to YouTube IFrame fallback');
        if (this.onStreamFailUpdate) this.onStreamFailUpdate("Playing via YouTube video");
        
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
    };

    this.player.addEventListener('error', () => handleAudioError('error_event'));

    // Timeout: if stream doesn't start within 15s, treat as failure
    this.player.addEventListener('stalled', () => {
      if (this._stallTimer) clearTimeout(this._stallTimer);
      this._showLoadIndicator();
      this._stallTimer = setTimeout(() => {
        if (this.player.readyState < 2 && !this.player.paused) {
          console.warn('Stream stalled for 15s, triggering error');
          handleAudioError('stalled_timeout');
        }
      }, 15000);
    });

    this.player.addEventListener('waiting', () => {
      if (this._stallTimer) clearTimeout(this._stallTimer);
      this._showLoadIndicator();
      this._stallTimer = setTimeout(() => {
        if (this.player.readyState < 2 && !this.player.paused) {
          console.warn('Stream waiting too long, triggering error');
          handleAudioError('waiting_timeout');
        }
      }, 15000);
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
            [YT.PlayerState.PLAYING]: 'play',
            [YT.PlayerState.PAUSED]: 'pause',
            [YT.PlayerState.ENDED]: 'ended',
          };
          if (map[e.data]) this._onStateChange(map[e.data]);
        },
        onError: (e) => {
          console.error('YouTube IFrame error:', e.data);
          if (this.onStreamFailUpdate) this.onStreamFailUpdate("This track is unavailable");
          if (e.data === 150 || e.data === 101) {
            if (typeof toast === 'function') toast('This track is restricted. Skipping...', 'warning');
            setTimeout(() => this._onStateChange('ended'), 2000);
          } else {
            if (typeof toast === 'function') toast("This track can't be played in your region.", 'error');
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
      if (this._loadTimeout) { clearTimeout(this._loadTimeout); this._loadTimeout = null; }
      this.startProgressTimer();
      const pos = this._useIFrame
        ? Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000)
        : Math.round((this.player.currentTime || 0) * 1000);
      this._emitControlEvent('play', { position_ms: pos });
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

  _showLoadIndicator() {
    const el = document.getElementById('stream-loader');
    if (el) el.style.display = 'flex';
  }

  _hideLoadIndicator() {
    const el = document.getElementById('stream-loader');
    if (el) el.style.display = 'none';
  }

  _loadVideo(videoId, startSeconds = 0) {
    if (!this._userUnlocked) {
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
      return;
    }

    this._suppressStateChange = true;
    
    if (videoId !== this.currentVideoId) {
      this._streamFailCount = 0;
      this._useLowBitrate = false;
      // Reset IFrame mode per-track — give server-side streaming another chance
      if (this._useIFrame) {
        this._useIFrame = false;
      }
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
          console.warn('Stream load timeout after 10s');
          this.player.dispatchEvent(new Event('error'));
        }
      }, 10000);

      this.player.src = `/stream/${videoId}`;
      this.setVolume(this.volume);
      if (startSeconds > 0) {
        this.player.addEventListener('loadedmetadata', () => {
          this.player.currentTime = startSeconds;
        }, { once: true });
      }
      this.player.play().catch(e => {
        if (e.name === 'AbortError') return; // Ignore rapid play/pause aborts
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
      // IFrame not ready yet, just update state
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

  /**
   * Externally set play/pause state without seeking.
   * Used by playback_sync to keep listener play/pause in sync with host.
   */
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
      } catch (e) { /* ytPlayer not ready yet */ }
      if (actualMs > 0) this.positionMs = actualMs;

      // Extract duration from actual player if it is missing or zero
      if (this.durationMs <= 0) {
        try {
          const actualDurSec = (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function')
            ? this.ytPlayer.getDuration()
            : (this.player ? this.player.duration : 0);
          if (actualDurSec > 0) {
            this.durationMs = Math.round(actualDurSec * 1000);
          }
        } catch (e) { /* ytPlayer not ready yet */ }
      }

      this.updateDisplay();
      this._updateMediaSessionPositionState();
    }, 250);
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

  destroy() {
    this.stop();
    if (this._useIFrame && this.ytPlayer) {
      try { this.ytPlayer.destroy(); } catch(e) {}
      this.ytPlayer = null;
    }
  }

  /* ─── Media Session API Integration ──────────────────── */
  _initMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      console.log('[MediaSession] OS Play trigger');
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
      console.log('[MediaSession] OS Pause trigger');
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
      console.log('[MediaSession] OS Next Track trigger');
      this._emitControlEvent('nexttrack');
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      console.log('[MediaSession] OS Previous Track trigger');
      this._emitControlEvent('previoustrack');
    });

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        console.log('[MediaSession] OS Seekto trigger:', details);
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

    navigator.mediaSession.metadata = new MediaMetadata({
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
    const durSec = (this.durationMs || 0) / 1000;
    const posSec = (this.positionMs || 0) / 1000;

    if (durSec > 0 && posSec >= 0 && posSec <= durSec) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durSec,
          playbackRate: 1.0,
          position: posSec
        });
      } catch (e) {
        console.warn('[MediaSession] Error setting position state:', e);
      }
    }
  }

  setVolume(vol) {
    this.volume = vol;
    if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      this.ytPlayer.setVolume(vol);
      if (typeof this.ytPlayer.unMute === 'function') {
        vol === 0 ? this.ytPlayer.mute() : this.ytPlayer.unMute();
      }
    } else if (this.player) {
      this.player.volume = vol / 100;
      this.player.muted = (vol === 0);
    }
  }
}
