import { offlineDb } from './offlineDb';

const SILENT_WAV_B64 = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";
const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname.startsWith('192.168.') ||
                    window.location.hostname.startsWith('10.') ||
                    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);
    if (isLocal) {
      return `http://${window.location.hostname}:8000`;
    }
  }
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '');
    }
  }
  return 'https://api.openjam.fun';
};
const BACKEND_URL = getBackendUrl();

export default class YouTubePlayer {
  constructor(options = {}) {
    if (typeof window === 'undefined') return;

    this.player = new Audio();
    this.player.preload = "auto";
    this.activePlayer = this.player;
    this.fadePlayer = null;
    this.fadeOutInterval = null;
    this.fadeInInterval = null;
    this.ytPlayer = null;
    this.currentVideoId = null;
    this.currentTrackName = '';
    this.currentArtistName = '';
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
    this._stallTimers = new Map();
    this._lastSeekTime = 0;

    this._isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this._wakeLock = null;
    this._keepAliveCtx = null;
    this._keepAliveOsc = null;

    if (this._isMobile) {
      this._maxStreamFails = 2;
    }

    this._initAudio();
    this._initMediaSession();
    this._initBackgroundPlayback();

    // Universal gesture unlock handlers (handles mouse, keyboard, touch, and pointer)
    const unlockHandler = () => {
      this.unlockAudioContext();
      window.removeEventListener('click', unlockHandler, true);
      window.removeEventListener('keydown', unlockHandler, true);
      window.removeEventListener('touchstart', unlockHandler, true);
      window.removeEventListener('pointerdown', unlockHandler, true);
    };
    window.addEventListener('click', unlockHandler, { once: true, capture: true });
    window.addEventListener('keydown', unlockHandler, { once: true, capture: true });
    window.addEventListener('touchstart', unlockHandler, { once: true, capture: true });
    window.addEventListener('pointerdown', unlockHandler, { once: true, capture: true });
  }

  _initAudio() {
    this._setupAudioListeners(this.player, 'player');
  }

  _setupAudioListeners(audioElement, name) {
    audioElement.addEventListener('loadstart', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      this._showLoadIndicator();
    });

    audioElement.addEventListener('play', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      try {
        audioElement.defaultPlaybackRate = 1.0;
        audioElement.playbackRate = 1.0;
      } catch (e) {}
      this._onStateChange('play');
      this._hideLoadIndicator();
      
      if (this.fadePlayer) {
        this.startFadeIn(audioElement);
      }
    });

    audioElement.addEventListener('pause', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      this._onStateChange('pause');
    });

    audioElement.addEventListener('ended', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      this._onStateChange('ended');
    });

    audioElement.addEventListener('canplay', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      try {
        audioElement.playbackRate = 1.0;
      } catch (e) {}
      const timer = this._stallTimers.get(audioElement);
      if (timer) { clearTimeout(timer); this._stallTimers.delete(audioElement); }
      this._hideLoadIndicator();
    });

    audioElement.addEventListener('error', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      const err = audioElement.error;
      if (!err || err.code === 0) return;
      this._handleAudioError('error_event', audioElement);
    });

    audioElement.addEventListener('stalled', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      const existingTimer = this._stallTimers.get(audioElement);
      if (existingTimer) clearTimeout(existingTimer);
      this._showLoadIndicator();
      const timer = setTimeout(() => {
        if (audioElement.readyState < 2 && !audioElement.paused) {
          this._handleAudioError('stalled_timeout', audioElement);
        }
      }, 2000);
      this._stallTimers.set(audioElement, timer);
    });

    audioElement.addEventListener('waiting', () => {
      if (audioElement !== this.activePlayer) return;
      if (!audioElement.src || audioElement.src.startsWith('data:')) return;
      const existingTimer = this._stallTimers.get(audioElement);
      if (existingTimer) clearTimeout(existingTimer);
      this._showLoadIndicator();
      const timer = setTimeout(() => {
        if (audioElement.readyState < 2 && !audioElement.paused) {
          this._handleAudioError('waiting_timeout', audioElement);
        }
      }, 2000);
      this._stallTimers.set(audioElement, timer);
    });
  }

  _handleAudioError(source, audioElement) {
    const timer = this._stallTimers.get(audioElement);
    if (timer) { clearTimeout(timer); this._stallTimers.delete(audioElement); }
    if (audioElement !== this.activePlayer) return;
    if (!audioElement.src || audioElement.src.startsWith('data:')) return;
    this._hideLoadIndicator();
    this._streamFailCount++;

    if (this._streamFailCount >= this._maxStreamFails) {
      if (!this._useIFrame) {
        if (this.onStreamFailUpdate) this.onStreamFailUpdate("Switching to YouTube player…");
        
        try {
          audioElement.pause();
          audioElement.src = '';
          audioElement.load();
        } catch (e) {}

        this._useIFrame = true;
        this._initIFramePlayer();
        if (this.currentVideoId) {
          this._loadVideo(this.currentVideoId, Math.round(this.positionMs / 1000));
        }
      } else {
        this._emitControlEvent('nexttrack');
      }
    } else {
      setTimeout(() => {
        if (this._streamFailCount === 1 && !this._useLowBitrate && this.currentVideoId) {
          if (this.onStreamFailUpdate) this.onStreamFailUpdate("Connecting fast stream…");
          this._useLowBitrate = true;
          audioElement.src = `${BACKEND_URL}/stream/${this.currentVideoId}?low=true`;
          this.setVolume(this.volume);
          const seekSec = Math.round(this.positionMs / 1000);
          if (seekSec > 0) {
            audioElement.addEventListener('loadedmetadata', () => {
              audioElement.currentTime = seekSec;
            }, { once: true });
          }
          audioElement.play().catch(() => {});
        }
      }, 300 * this._streamFailCount);
    }
  }

  _initIFramePlayer() {
    if (this.ytPlayer) return;

    let wrapper = document.getElementById('yt-fallback-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'yt-fallback-wrapper';
      // Rendered with minimal dimensions and opacity to prevent mobile background throttling
      wrapper.style.cssText = 'position:fixed;bottom:0;right:0;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-1;overflow:hidden;';
      
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
    this._ready = false;
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
        onError: async (e) => {
          console.warn('YouTube IFrame playback notice (code ' + e.data + '): embedding restricted or track unavailable.');
          
          const trackQuery = `${this.currentTrackName || ''} ${this.currentArtistName || ''}`.trim();
          const currentVid = this.currentVideoId;
          
          if (!this._alternateTriedMap) this._alternateTriedMap = {};
          
          if (currentVid && !this._alternateTriedMap[currentVid] && (trackQuery || currentVid)) {
            this._alternateTriedMap[currentVid] = true;
            if (this.onStreamFailUpdate) this.onStreamFailUpdate("Bypassing regional restriction…");
            try {
              const res = await fetch(`/search/alternate?q=${encodeURIComponent(trackQuery || currentVid)}&exclude=${encodeURIComponent(currentVid)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.video_id && data.video_id !== currentVid) {
                  console.log(`[Player] Auto-switched region-restricted track ${currentVid} → ${data.video_id}`);
                  this.toast('Switched to available audio stream for your region', 'info');
                  const curSec = Math.round((this.positionMs || 0) / 1000);
                  this._useIFrame = false;
                  this._loadVideo(data.video_id, curSec);
                  return;
                }
              }
            } catch (altErr) {
              console.warn("[Player] Alternate stream resolution failed:", altErr);
            }
          }

          if (this.onStreamFailUpdate) this.onStreamFailUpdate("Track restricted by provider");
          if (e.data === 150 || e.data === 101) {
            this.toast('Track restricted from embedded playback. Skipping to next...', 'warning');
          } else {
            this.toast('Track unavailable in region. Skipping to next...', 'warning');
          }
          setTimeout(() => {
            this._onStateChange('ended');
            this._emitControlEvent('nexttrack');
          }, 600);
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
      const pos = (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function')
        ? Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000)
        : Math.round((this.player?.currentTime || 0) * 1000);
      this._emitControlEvent('play', { position_ms: pos });
    } else if (state === 'pause') {
      this.isPlaying = false;
      this.stopProgressTimer();
      this._releaseWakeLock();
      this._stopSilentKeepAlive();
      const pos = (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function')
        ? Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000)
        : Math.round((this.player?.currentTime || 0) * 1000);
      this._emitControlEvent('pause', { position_ms: pos });
    } else if (state === 'ended') {
      this.isPlaying = false;
      this.stopProgressTimer();
      if (this._isMobile) {
        try {
          this.player.src = SILENT_WAV_B64;
          this.player.loop = true;
          this.player.play().catch(() => {});
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
    this.unlockAudioContext();
  }

  unlockAudioContext() {
    this._userUnlocked = true;
    this._hideOverlay();

    // Pre-unlock player under the user gesture context
    try {
      if (!this.player.src || this.player.src.startsWith('data:')) {
        this.player.src = SILENT_WAV_B64;
      }
      const playPromise = this.player.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (e) {
      console.warn("Failed to pre-unlock audio element:", e);
    }

    if (this._keepAliveCtx && this._keepAliveCtx.state === 'suspended') {
      this._keepAliveCtx.resume().catch(() => {});
    }

    if (this._pendingPlayAfterUnlock) {
      const { videoId, startSeconds } = this._pendingPlayAfterUnlock;
      this._pendingPlayAfterUnlock = null;
      this._loadVideo(videoId, startSeconds);
    } else if (this.currentVideoId && this.isPlaying) {
      if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
        this.ytPlayer.playVideo();
      } else if (this.player) {
        this.player.play().catch(() => {});
      }
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
        background:rgba(10,9,8,0.85); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
        cursor:pointer; user-select:none;
        animation: fadeInOverlay 0.3s ease;
      `;
      overlay.innerHTML = `
        <style>
          @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
          @keyframes pulseRing {
            0%   { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(245,158,11,0.6); }
            70%  { transform: scale(1.04); box-shadow: 0 0 0 26px rgba(245,158,11,0); }
            100% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          }
        </style>
        <div style="
          width:92px; height:92px; border-radius:50%;
          background:linear-gradient(135deg, #f59e0b, #d97706); display:flex; align-items:center; justify-content:center;
          box-shadow: 0 0 45px rgba(245,158,11,0.45);
          animation: pulseRing 1.8s ease infinite; margin-bottom:24px;
        ">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#000" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div style="font-family:system-ui, -apple-system, sans-serif; font-size:22px; font-weight:800; color:#f5f0eb; margin-bottom:8px; letter-spacing:-0.02em;">
          Tap to Join Live Audio
        </div>
        <div style="font-family:system-ui, -apple-system, sans-serif; font-size:14px; color:#a8a29e; max-width:280px; text-align:center; line-height:1.5;">
          Tap anywhere to unlock real-time synchronized music with your friends
        </div>`;
      document.body.appendChild(overlay);
      
      const onUnlockTap = (e) => {
        if (e) e.stopPropagation();
        this.unlockAudioContext();
      };
      overlay.addEventListener('click', onUnlockTap, { once: true });
      overlay.addEventListener('touchstart', onUnlockTap, { once: true, passive: true });
      overlay.addEventListener('pointerdown', onUnlockTap, { once: true });
    }
  }

  _hideOverlay() {
    const overlay = document.getElementById('play-unlock-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.25s ease';
      setTimeout(() => overlay.remove(), 250);
    }
  }

  _showLoadIndicator() {
    if (this.onStreamFailUpdate) this.onStreamFailUpdate("Buffering stream…");
  }

  _hideLoadIndicator() {
    if (this.onStreamFailUpdate) this.onStreamFailUpdate(null);
  }

  startFadeOut(player) {
    if (!player) return;
    
    const duration = 3000;
    const intervalTime = 100;
    const steps = duration / intervalTime;
    let currentStep = 0;
    const startVol = player.volume;
    
    if (this.fadeOutInterval) {
      clearInterval(this.fadeOutInterval);
    }
    
    this.fadeOutInterval = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      
      try {
        player.volume = Math.max(0, startVol * (1 - ratio));
      } catch (e) {}
      
      if (currentStep >= steps) {
        clearInterval(this.fadeOutInterval);
        this.fadeOutInterval = null;
        if (this.fadePlayer === player) {
          this.fadePlayer = null;
        }
        try {
          player.pause();
          player.src = '';
        } catch (e) {}
      }
    }, intervalTime);
  }

  startFadeIn(player) {
    if (!player) return;
    
    const duration = 3000;
    const intervalTime = 100;
    const steps = duration / intervalTime;
    let currentStep = 0;
    
    if (this.fadeInInterval) {
      clearInterval(this.fadeInInterval);
    }
    
    player.volume = 0;
    
    this.fadeInInterval = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      const targetVol = this.volume / 100;
      
      try {
        player.volume = Math.min(targetVol, targetVol * ratio);
      } catch (e) {}
      
      if (currentStep >= steps) {
        clearInterval(this.fadeInInterval);
        this.fadeInInterval = null;
        try {
          player.volume = this.volume / 100;
        } catch (e) {}
      }
    }, intervalTime);
  }

  stopCrossfade() {
    if (this.fadeOutInterval) {
      clearInterval(this.fadeOutInterval);
      this.fadeOutInterval = null;
    }
    if (this.fadeInInterval) {
      clearInterval(this.fadeInInterval);
      this.fadeInInterval = null;
    }
    if (this.fadePlayer) {
      try {
        this.fadePlayer.pause();
        this.fadePlayer.src = '';
      } catch (e) {}
      this.fadePlayer = null;
    }
    if (this.activePlayer) {
      this.activePlayer.volume = this.volume / 100;
    }
  }

  _loadVideo(videoId, startSeconds = 0) {
    if (!videoId) return;

    // Track is immediately registered so room state knows current track
    this.currentVideoId = videoId;

    if (!this._userUnlocked) {
      this._pendingPlayAfterUnlock = { videoId, startSeconds };
      this._showOverlay();
      return;
    }

    this._suppressStateChange = true;
    
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
    } catch (e) {}

    if (this._useIFrame) {
      if (this.ytPlayer && this._ready && typeof this.ytPlayer.loadVideoById === 'function') {
        try {
          this.ytPlayer.loadVideoById({ videoId, startSeconds });
        } catch (err) {
          console.warn("[YouTubePlayer] Failed to loadVideoById:", err);
        }
      } else {
        this._pendingLoad = { videoId, startSeconds };
        if (!this.ytPlayer) {
          this._initIFramePlayer();
        }
      }
      setTimeout(() => { this._suppressStateChange = false; }, 800);
    } else {
      if (this.onStreamFailUpdate) this.onStreamFailUpdate("Connecting to audio stream…");

      if (this._loadTimeout) clearTimeout(this._loadTimeout);
      this._loadTimeout = setTimeout(() => {
        if (this.player.readyState === 0 && this.player.src && !this.player.src.startsWith('data:')) {
          console.warn('Stream load timeout after 4.5s');
          this.player.dispatchEvent(new Event('error'));
        }
      }, 4500);

      this.player.loop = false;
      
      offlineDb.getTrack(videoId).then((cachedTrack) => {
        if (cachedTrack && cachedTrack.blob) {
          console.log(`[Player] Playing downloaded track locally: ${videoId}`);
          if (this.onStreamFailUpdate) this.onStreamFailUpdate(null);
          if (this._loadTimeout) { clearTimeout(this._loadTimeout); this._loadTimeout = null; }
          
          const localUrl = URL.createObjectURL(cachedTrack.blob);
          this.player.src = localUrl;
          
          cachedTrack.playCount = (cachedTrack.playCount || 0) + 1;
          offlineDb.saveTrack(cachedTrack).catch(() => {});
        } else {
          this.player.src = `${BACKEND_URL}/stream/${videoId}`;
        }
        
        if (this.fadePlayer) {
          this.player.volume = 0;
        } else {
          this.player.volume = this.volume / 100;
        }
        
        if (startSeconds > 0) {
          this.player.addEventListener('loadedmetadata', () => {
            this.player.currentTime = startSeconds;
          }, { once: true });
        }
        this.player.play().catch(e => {
          if (e.name === 'AbortError') return;
          if (e.name === 'NotAllowedError') {
            console.error('Autoplay prevented:', e);
            this._userUnlocked = false;
            this._pendingPlayAfterUnlock = { videoId, startSeconds };
            this._showOverlay();
          } else {
            console.warn('Playback warning:', e);
          }
        });
        setTimeout(() => { this._suppressStateChange = false; }, 800);
      }).catch((err) => {
        console.error('[Player] Error checking offline cache:', err);
        this.player.src = `${BACKEND_URL}/stream/${videoId}`;
        
        if (this.fadePlayer) {
          this.player.volume = 0;
        } else {
          this.player.volume = this.volume / 100;
        }
        
        if (startSeconds > 0) {
          this.player.addEventListener('loadedmetadata', () => {
            this.player.currentTime = startSeconds;
          }, { once: true });
        }
        this.player.play().catch(e => {
          if (e.name === 'AbortError') return;
          if (e.name === 'NotAllowedError') {
            console.error('Autoplay prevented:', e);
            this._userUnlocked = false;
            this._pendingPlayAfterUnlock = { videoId, startSeconds };
            this._showOverlay();
          }
        });
        setTimeout(() => { this._suppressStateChange = false; }, 800);
      });
    }
  }

  setTrack(trackData) {
    if (!trackData || !trackData.track_uri) {
      this.stop();
      return;
    }
    const videoId = trackData.track_uri;
    const startSeconds = Math.round((trackData.position_ms || 0) / 1000);
    this.currentTrackName = trackData.track_name || '';
    this.currentArtistName = trackData.artist || '';
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
      } else if (this.player && this.player.readyState >= 2) {
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

  seek(seconds) {
    const targetSeconds = Math.max(0, seconds);
    this.positionMs = Math.round(targetSeconds * 1000);
    this._suppressStateChange = true;
    this._lastSeekTime = Date.now();
    if (this._useIFrame && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(targetSeconds, true);
    } else if (this.player) {
      this.player.currentTime = targetSeconds;
    }
    this._updateMediaSessionPositionState();
    this.updateDisplay();
    setTimeout(() => { this._suppressStateChange = false; }, 300);
  }

  syncPosition(positionMs, isPlaying) {
    this.isPlaying = isPlaying;
    this.positionMs = positionMs;

    if (!this._userUnlocked) {
      if (this._pendingPlayAfterUnlock) {
        this._pendingPlayAfterUnlock.startSeconds = Math.round(positionMs / 1000);
      }
      if (isPlaying && this.currentVideoId) this._showOverlay();
      this.updateDisplay();
      return;
    }

    if (this._useIFrame) {
      if (this.ytPlayer && this._ready && typeof this.ytPlayer.getCurrentTime === 'function') {
        const actualMs = Math.round((this.ytPlayer.getCurrentTime() || 0) * 1000);
        const drift = Math.abs(actualMs - positionMs);
        this._suppressStateChange = true;
        
        // Large drift seek with cooldown
        if (drift > 3000 && Date.now() - (this._lastSeekTime || 0) > 4000 && typeof this.ytPlayer.seekTo === 'function') {
          this.ytPlayer.seekTo(positionMs / 1000, true);
          this._lastSeekTime = Date.now();
        }
        
        if (isPlaying) {
          if (typeof this.ytPlayer.getPlayerState === 'function') {
            const st = this.ytPlayer.getPlayerState();
            if (st !== 1 && st !== 3) this.ytPlayer.playVideo();
          }
          this.startProgressTimer();
        } else {
          if (typeof this.ytPlayer.pauseVideo === 'function') this.ytPlayer.pauseVideo();
          this.stopProgressTimer();
        }
        setTimeout(() => { this._suppressStateChange = false; }, 500);
      } else if (!this._ready) {
        this._pendingLoad = { videoId: this.currentVideoId, startSeconds: Math.round(positionMs / 1000) };
      }
    } else {
      // HTML5 Audio Adaptive Synchronization Engine
      if (isPlaying) {
        if (this.player.paused && !this.player.seeking) {
          this.player.play().catch(e => {
            if (e.name === 'AbortError') return;
            if (e.name === 'NotAllowedError') {
              console.error('Autoplay prevented on sync:', e);
              this._userUnlocked = false;
              this._pendingPlayAfterUnlock = { videoId: this.currentVideoId, startSeconds: Math.round(positionMs / 1000) };
              this._showOverlay();
            }
          });
        }

        // Always ensure natural 1.0x playback speed and pitch
        if (this.player.playbackRate !== 1.0) {
          this.player.playbackRate = 1.0;
        }

        if (this.player.readyState >= 2) {
          const actualMs = Math.round((this.player.currentTime || 0) * 1000);
          const driftAbs = Math.abs(positionMs - actualMs);

          // Hard seek only for genuine large skips (> 2500ms) with 4s debounce
          if (driftAbs > 2500 && Date.now() - (this._lastSeekTime || 0) > 4000 && !this.player.seeking) {
            this._suppressStateChange = true;
            this.player.currentTime = Math.max(0, positionMs / 1000);
            this._lastSeekTime = Date.now();
            setTimeout(() => { this._suppressStateChange = false; }, 500);
          }
        }
        this.startProgressTimer();
      } else {
        if (!this.player.paused) {
          this.player.pause();
        }
        this.stopProgressTimer();
        if (this.player.playbackRate !== 1.0) {
          this.player.playbackRate = 1.0;
        }
      }
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
        this.stopCrossfade();
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
    }, 60);
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
    this.stopCrossfade();
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
    this.volume = Math.max(0, Math.min(100, vol));
    if (!this.fadeInInterval && this.player) {
      this.player.volume = this.volume / 100;
    }
    if (this.ytPlayer && this._ready && typeof this.ytPlayer.setVolume === 'function') {
      this.ytPlayer.setVolume(this.volume);
    }
  }

  destroy() {
    this.stop();
    this.stopCrossfade();
    try {
      this.player.pause();
      this.player.src = '';
    } catch (e) {}
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
    if (!('wakeLock' in navigator) || (typeof document !== 'undefined' && document.hidden)) return;
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
    } catch (e) {}
  }

  async _releaseWakeLock() {
    if (this._wakeLock) {
      try {
        await this._wakeLock.release();
        this._wakeLock = null;
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
    } catch (e) {
      console.warn('[MediaBG] Silent keepalive failed:', e);
    }
  }

  _stopSilentKeepAlive() {
    if (this._keepAliveOsc) {
      try { this._keepAliveOsc.stop(); } catch (e) {}
      this._keepAliveOsc = null;
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

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.openjam.fun';
    const defaultArtwork = [
      { src: `${origin}/static/img/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${origin}/static/img/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ];

    const artwork = albumArtUrl 
      ? [
          { src: albumArtUrl, sizes: '192x192', type: 'image/jpeg' },
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
