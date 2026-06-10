/* ==========================================================================
   OPEN JAM — Room Controller Module
   Manages global state, auth, socket orchestration, volume, and gestures.
   ========================================================================== */

// Tiny helpers (aliases for utils.js + room-specific)
window.esc = typeof escapeHtml !== 'undefined' ? escapeHtml : (s => { const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; });
window.fmt = typeof formatTime !== 'undefined' ? formatTime : (ms => { if(!ms||ms<0)return'0:00'; const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; });
window.initials = typeof getInitials !== 'undefined' ? getInitials : (n => (n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2));
window.ago = typeof timeAgo !== 'undefined' ? timeAgo : (d => { const parsed = (typeof d === 'string' && !d.endsWith('Z') && !d.includes('+') && !d.includes('-')) ? (d + 'Z') : d; const s=Math.floor((Date.now()-new Date(parsed))/1000); if(s<60)return'just now'; if(s<3600)return`${Math.floor(s/60)}m`; return`${Math.floor(s/3600)}h`; });
window.toast = typeof showToast !== 'undefined' ? showToast : ((msg,type='info') => { const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; $('#toasts').appendChild(el); setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-20px) scale(0.9)'; el.style.transition='all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; setTimeout(()=>el.remove(),300); },3500); });

window.roomApp = {
  roomId: (location.pathname.match(/\/room\/([^/]+)/) || [])[1],
  me: null,
  roomData: null,
  isHost: false,
  muted: false,
  vol: parseInt(localStorage.getItem('openjam_vol') ?? '80', 10) || 80,
  _premuteVol: parseInt(localStorage.getItem('openjam_vol') ?? '80', 10) || 80,
  _currentTrackUri: null,
  _queueData: [],
  _turntableAngle: 0,
  _turntableSpeed: 0,
  TARGET_TURNTABLE_SPEED: 0.5, // degrees per frame
  TURNTABLE_ACCEL: 0.01,
  TURNTABLE_DECEL: 0.005,
  _turntablePlaying: false,
  _isScratching: false,
  _loopEnabled: false,
  _skipInFlight: false,
  _lastSyncPlaying: null,
  hostSyncedOnInit: false,
  sharedAudioCtx: null,
  yt: null,
  sc: null,
  lyricsManager: null,
  _upNextShownForUri: null,
  _volRafPending: false,

  getAudioCtx() {
    if (!this.sharedAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.sharedAudioCtx = new AudioCtx();
    }
    if (this.sharedAudioCtx && this.sharedAudioCtx.state === 'suspended') {
      this.sharedAudioCtx.resume();
    }
    return this.sharedAudioCtx;
  },

  playChime() {
    if (localStorage.getItem('openjam_sounds') === 'false') return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.04, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.04, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.5);

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(880, now + 0.16); // A5
      gain3.gain.setValueAtTime(0, now);
      gain3.gain.setValueAtTime(0.04, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.6);
    } catch(e) {
      console.warn('Web Audio API chime failed:', e);
    }
  },

  playChatSound() {
    if (localStorage.getItem('openjam_sounds') === 'false') return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch(e) {}
  },

  playReactionSound() {
    if (localStorage.getItem('openjam_sounds') === 'false') return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      const baseFreq = 580 + Math.random() * 220;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.08);
      
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch(e) {}
  },

  lastScratchSoundTime: 0,
  playScratchSound(velocity) {
    if (localStorage.getItem('openjam_sounds') === 'false') return;
    const nowMs = Date.now();
    if (nowMs - this.lastScratchSoundTime < 80) return;
    this.lastScratchSoundTime = nowMs;
    
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      const baseFreq = 90 + Math.min(velocity * 900, 700);
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.35, now + 0.12);
      
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.Q.setValueAtTime(7.5, now);
      
      gain.gain.setValueAtTime(Math.min(velocity * 0.12, 0.15), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.12);
    } catch(e) {}
  },

  nameColor(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 60%, 55%)`;
  },

  avatarHTML(name, avatarUrl) {
    const c = this.nameColor(name);
    if (avatarUrl) {
      return `<div class="av-initials" style="background:${c};overflow:hidden;position:relative;">` +
             `<span style="position:absolute;z-index:1;">${initials(name)}</span>` +
             `<img src="${esc(avatarUrl)}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:2;" onerror="this.style.display='none';" />` +
             `</div>`;
    }
    return `<div class="av-initials" style="background:${c}">${initials(name)}</div>`;
  },

  async checkAuth() {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (res.ok) { this.me = (await res.json()).user; }
    if (!this.me) {
      const name = localStorage.getItem('openjam_display_name');
      if (name) {
        const r2 = await fetch('/auth/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: name }), credentials: 'include' });
        if (r2.ok) this.me = (await r2.json()).user;
      }
    }
    if (!this.me) { location.href = '/'; return; }

    $('#nav-avatar').innerHTML = this.avatarHTML(this.me.display_name, this.me.avatar_url);
    $('#nav-name').textContent = this.me.display_name;
    $('#navbar-right').style.display = 'flex';
  },

  async loadRoom() {
    const res = await fetch(`/rooms/${this.roomId}`, { credentials: 'include' });
    if (!res.ok) { toast('Room not found', 'error'); setTimeout(() => location.href = '/', 2e3); return; }
    this.roomData = await res.json();
    const room = this.roomData.room;
    document.title = `${room.name} — Open Jam`;

    $('#bar-name').textContent = room.name;
    $('#bar-name').title = room.name;
    const barHost = $('#bar-host');
    if (barHost) {
      barHost.classList.remove('skeleton');
      const hostAvatar = room.host_avatar_url 
        ? `<img class="room-host-avatar" src="${esc(room.host_avatar_url)}" alt="${esc(room.host_name)}" />` 
        : `<div class="room-host-avatar-fallback" style="background:${this.nameColor(room.host_name || 'Unknown')}">${initials(room.host_name || 'Unknown')}</div>`;
      barHost.innerHTML = `${hostAvatar} <span>Hosted by <strong style="color:var(--text-1)">${esc(room.host_name || 'Unknown')}</strong></span>`;
    }
    const barTags = $('#bar-tags');
    if (barTags) {
      const labels = [
        room.queue_mode === 'curated' ? 'DJ Only' : 'Open Party',
        ...(room.genre_tags || []).slice(0, 3)
      ];
      barTags.innerHTML = labels.filter(Boolean).map(label => `<span class="room-bar-tag">${esc(label)}</span>`).join('');
    }
    $('#room-bar').style.display = 'flex';

    this.isHost = !!(this.me && room.host_user_id === this.me.id);
    this.applyHostUI();

    this._queueData = this.roomData.queue || [];
    if (room.current_track) this.updateNP(room.current_track);
    if (window.renderQueue) window.renderQueue(this._queueData);
    if (window.updateMembers && Array.isArray(this.roomData.listeners)) window.updateMembers(this.roomData.listeners);
  },

  applyHostUI() {
    if (this.isHost) {
      $('#btn-close').style.display = 'inline-flex';
      $('#controls-row').style.display = 'flex';
      $('#controls-locked').style.display = 'none';
    } else {
      $('#btn-close').style.display = 'none';
      $('#controls-row').style.display = 'none';
      $('#controls-locked').style.display = 'block';
    }
  },

  updateAmbientArt(track, artImg, ambient, dynBg) {
    if (track.album_art_url && track.album_art_url !== artImg.src) {
      artImg.src = track.album_art_url;
      Motion.transitionArt(artImg);
      if (dynBg) { dynBg.src = track.album_art_url; dynBg.classList.add('active'); }
      if (ambient) { ambient.style.backgroundImage = `url(${track.album_art_url})`; ambient.classList.add('active'); }
      
      const app = window.roomApp;
      if (app && app.ambientGlow) {
        app.ambientGlow.updateArtwork(track.album_art_url);
      }
    }
  },

  updateNPDisplay(track) {
    const artImg = $('#art-img');
    const vinyl = $('#art-vinyl');
    const eq = $('#np-eq');
    const ambient = $('#room-ambient');
    if (!track || !track.track_uri) return;
    $('#np-title').textContent = track.track_name || 'Unknown Track';
    $('#np-artist').textContent = track.artist || '';
    this.updateAmbientArt(track, artImg, ambient, $('#dynamic-bg'));
    
    const playing = track.is_playing !== false;
    artImg.classList.toggle('spinning', playing);
    vinyl.classList.toggle('spinning', playing);
    if (eq) {
      eq.style.display = 'flex';
      eq.classList.toggle('playing', playing);
    }
    this.setPlayIcon(playing);
    this.updateProgress(track.position_ms || 0, track.duration_ms || 0);
  },

  updateNP(track) {
    const artImg = $('#art-img');
    const vinyl = $('#art-vinyl');
    const eq = $('#np-eq');
    const ambient = $('#room-ambient');
    const BLANK = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'1\' height=\'1\'%3E%3C/svg%3E';

    if (!track || !track.track_uri) {
      this._currentTrackUri = null;
      this.yt.stop();
      $('#np-title').textContent = 'Nothing playing';
      $('#np-artist').textContent = 'Add a track to the queue';
      artImg.src = BLANK;
      const dynBg = $('#dynamic-bg');
      if (dynBg) { dynBg.src = ''; dynBg.classList.remove('active'); }
      artImg.classList.remove('spinning'); 
      vinyl.classList.add('spinning'); 
      if (eq) eq.style.display = 'none';
      if (ambient) ambient.classList.remove('active');
      if (this.ambientGlow) { this.ambientGlow.stop(); }
      const ph = $('#art-placeholder'); if (ph) ph.classList.remove('hidden');
      this.setPlayIcon(false);
      this.yt.stopProgressTimer();
      $('#progress').style.width = '0%';
      $('#time-cur').textContent = '0:00'; $('#time-dur').textContent = '0:00';
      return;
    }

    $('#np-title').textContent = track.track_name || 'Unknown Track';
    $('#np-artist').textContent = track.artist || '';
    this.updateAmbientArt(track, artImg, ambient, $('#dynamic-bg'));
    const ph = $('#art-placeholder'); if (ph) ph.classList.add('hidden');

    const playing = track.is_playing !== false;
    artImg.classList.toggle('spinning', playing);
    vinyl.classList.toggle('spinning', playing);
    if (eq) {
      eq.style.display = 'flex';
      eq.classList.toggle('playing', playing);
    }
    this.setPlayIcon(playing);

    const btnSkip = $('#btn-vote-skip');
    if (btnSkip) {
      btnSkip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6 8.5 6V6l-8.5 6z"/></svg> Vote to Skip (0/0)`;
      btnSkip.disabled = false;
      btnSkip.classList.remove('voted');
    }

    if (track.track_uri !== this._currentTrackUri) {
      const vinylRecord = $('#vinyl-record');
      if (vinylRecord) {
        vinylRecord.classList.remove('vinyl-slide-in');
        vinylRecord.classList.add('vinyl-slide-out');
        setTimeout(() => {
          vinylRecord.classList.remove('vinyl-slide-out');
          vinylRecord.classList.add('vinyl-slide-in');
        }, 500);
      }
      this._currentTrackUri = track.track_uri;
      this.yt.setTrack({
        track_uri: track.track_uri,
        position_ms: track.position_ms || 0,
        duration_ms: track.duration_ms || 0,
        is_playing: playing,
        track_name: track.track_name,
        artist: track.artist,
        album_art_url: track.album_art_url
      });
      this.applyVol(this.vol);
      this.lyricsManager.loadLyrics(track.track_name, track.artist, track.track_uri);
    }

    let pos = track.position_ms || 0;
    const dur = track.duration_ms || 0;
    this.updateProgress(pos, dur);
  },

  updateProgress(pos, dur, force = false) {
    if (window._isDraggingProgressTime && !force) return;
    $('#time-cur').textContent = fmt(pos);
    $('#time-cur').title = 'Current playback time';
    $('#time-dur').textContent = fmt(dur);
    $('#time-dur').title = 'Total track duration';
    
    const pct = dur ? `${(pos/dur)*100}%` : '0%';
    const elA = document.getElementById('progress-fill'); if (elA) elA.style.width = pct;
    const elB = document.getElementById('progress');      if (elB) elB.style.width = pct;
    if (typeof this.lyricsManager !== 'undefined' && this.lyricsManager) this.lyricsManager.sync(pos);
    window._lastPos = pos;
    window._lastDur = dur;
  },

  showUpNext(track) {
    if (!track) return;
    const overlay = document.createElement('div');
    overlay.className = 'up-next-overlay';
    overlay.innerHTML = `
      <div class="up-next-content">
        <div class="up-next-label">UP NEXT IN 10s</div>
        <div class="up-next-info">
          <img src="${track.album_art_url || '/static/default-art.png'}" class="up-next-art">
          <div class="up-next-text">
            <div class="up-next-title">${esc(track.track_name)}</div>
            <div class="up-next-artist">${esc(track.artist)}</div>
          </div>
        </div>
        <div class="up-next-progress"><div class="up-next-bar"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { 
      if (overlay) {
        overlay.classList.add('out'); 
        setTimeout(() => overlay.remove(), 550); 
      }
    }, 10000);
  },

  setPlayIcon(playing) {
    const p = $('#ico-play'), pa = $('#ico-pause');
    if (p) p.style.display = playing ? 'none' : 'block';
    if (pa) pa.style.display = playing ? 'block' : 'none';
    this._turntablePlaying = playing;

    document.querySelectorAll('.eq').forEach(el => {
      if (playing) el.classList.add('playing');
      else el.classList.remove('playing');
    });
  },

  applyVol(v) {
    this.vol = Math.max(0, Math.min(100, v));
    this.yt.setVolume(this.vol);

    $('#vol-pct').textContent = `${this.vol}%`;
    const slider = $('#vol-slider');
    if (slider) {
      if (document.activeElement !== slider) slider.value = this.vol;
      slider.style.background = `linear-gradient(to right, var(--amber) ${this.vol}%, var(--bg-elevated) ${this.vol}%)`;
      slider.title = `Volume: ${this.vol}%`;
      slider.setAttribute('aria-valuenow', this.vol);
    }
    $('#ico-vol').style.display = this.vol > 0 ? 'block' : 'none';
    $('#ico-mute').style.display = this.vol > 0 ? 'none' : 'block';

    $('#mob-vol-pct').textContent = `${this.vol}%`;
    const mobSlider = $('#mob-vol-slider');
    if (mobSlider) {
      if (document.activeElement !== mobSlider) mobSlider.value = this.vol;
      mobSlider.style.background = `linear-gradient(to right, var(--amber) ${this.vol}%, var(--bg-elevated) ${this.vol}%)`;
      mobSlider.title = `Volume: ${this.vol}%`;
      mobSlider.setAttribute('aria-valuenow', this.vol);
    }
    $('#mob-ico-vol').style.display = this.vol > 0 ? 'block' : 'none';
    $('#mob-ico-mute').style.display = this.vol > 0 ? 'none' : 'block';

    localStorage.setItem('openjam_vol', String(this.vol));
  },

  hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
      sessionStorage.setItem('room_loaded', '1');
    }
    const bar = document.getElementById('top-load-bar');
    if (bar) bar.classList.remove('active');

    document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
    document.getElementById('queue-skeletons')?.remove();
    document.getElementById('chat-skeletons')?.remove();
  }
};

/* ── Mobile tab switching ──────────────────────────────────── */
window._mobUnread = 0;
window.switchMobileTab = function(tab, skipAnimation = false) {
  const left = $('#panel-left');
  const centre = $('#panel-center');
  const right = $('#panel-right');
  
  const npTab = $('#mob-tab-nowplaying');
  const qTab = $('#mob-tab-queue');
  const cTab = $('#mob-tab-chat');
  const mTab = $('#mob-tab-members');

  const tabOrder = ['nowplaying', 'queue', 'chat', 'members'];
  const panelMap = {
    'nowplaying': left,
    'queue': centre,
    'chat': right,
    'members': right
  };

  let currentTabId = tabOrder.find(t => $(`#mob-tab-${t}`)?.classList.contains('active')) || 'queue';
  const currentIndex = tabOrder.indexOf(currentTabId);
  const nextIndex = tabOrder.indexOf(tab);
  
  if (currentTabId === tab) return;

  const currentPanel = panelMap[currentTabId];
  const nextPanel = panelMap[tab];

  [npTab, qTab, cTab, mTab].forEach(t => t?.classList.remove('active'));

  const direction = nextIndex > currentIndex ? 'right' : 'left';

  if (currentPanel !== nextPanel) {
    nextPanel.style.display = 'flex';
    nextPanel.classList.add('mobile-active');
    
    if (!skipAnimation) {
      Motion.slidePanel(nextPanel, currentPanel, direction);
    } else {
      gsap.set(nextPanel, { x: 0, opacity: 1 });
      currentPanel.style.display = 'none';
      currentPanel.style.transform = '';
    }
    
    currentPanel.classList.remove('mobile-active');
  }

  if (tab === 'nowplaying') {
    npTab?.classList.add('active');
  } else if (tab === 'queue') {
    qTab?.classList.add('active');
  } else if (tab === 'chat') {
    cTab?.classList.add('active');
    $('#members-panel')?.classList.add('collapsed');
    
    window._mobUnread = 0;
    const badge = $('#mob-chat-badge');
    if (badge) badge.style.display = 'none';
    
    const msgs = $('#chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  } else if (tab === 'members') {
    mTab?.classList.add('active');
    $('#members-panel')?.classList.remove('collapsed');
  }
};

window._mobMarkUnread = function() {
  if (window.innerWidth > 640) return;
  const cTab = $('#mob-tab-chat');
  if (!cTab?.classList.contains('active')) {
    window._mobUnread++;
    const badge = $('#mob-chat-badge');
    if (badge) { badge.textContent = window._mobUnread > 9 ? '9+' : window._mobUnread; badge.style.display = 'flex'; }
  }
};

window.showRoomHelp = function() {
  const search = $('#q-search');
  if (search) {
    search.focus();
    toast('Start typing a song title or artist, then tap + to queue it.', 'info');
  } else {
    toast('Search bar is ready above — type anything to begin.', 'info');
  }
};

// Initialise everything once page DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = window.roomApp;

  // Initialize dependencies
  app.yt = new YouTubePlayer();
  app.ambientGlow = new AmbientGlowManager('ambient-canvas');
  app.lyricsManager = new LyricsManager($('#lyrics-content'));
  
  // Custom stream fallbacks status update callback
  app.yt.onStreamFailUpdate = (statusText) => {
    const elText = document.querySelector('#stream-loader .stream-loader-text');
    if (elText) elText.textContent = statusText;
  };

  app.yt.setControlCallback((action, extra = {}) => {
    if (action === 'nexttrack') {
      if (app.isHost) {
        $('#btn-next')?.click();
      } else {
        $('#btn-vote-skip')?.click();
      }
      return;
    }
    if (action === 'previoustrack') {
      if (app.isHost) {
        if (app.yt._useIFrame && app.yt.ytPlayer) {
          try { app.yt.ytPlayer.seekTo(0, true); } catch (e) {}
        } else if (app.yt.player) {
          app.yt.player.currentTime = 0;
        }
        app.yt.positionMs = 0;
        app.sc.emit('playback_update', {
          room_id: app.roomId,
          track_uri: app.yt.currentVideoId || '',
          track_name: $('#np-title')?.textContent || '',
          artist: $('#np-artist')?.textContent || '',
          album_art_url: $('#art-img')?.src || '',
          position_ms: 0,
          duration_ms: app.yt.durationMs || 0,
          is_playing: app.yt.isPlaying,
          loop: app._loopEnabled,
        });
      }
      return;
    }
    if (action === 'seek') {
      if (app.isHost) {
        app.sc.emit('playback_update', {
          room_id: app.roomId,
          track_uri: app.yt.currentVideoId || '',
          track_name: $('#np-title')?.textContent || '',
          artist: $('#np-artist')?.textContent || '',
          album_art_url: $('#art-img')?.src || '',
          position_ms: extra.position_ms,
          duration_ms: app.yt.durationMs || 0,
          is_playing: app.yt.isPlaying,
          loop: app._loopEnabled,
        });
      }
      return;
    }

    if (!app.isHost) return;
    const pos = extra.position_ms ?? app.yt.positionMs;
    const payload = {
      room_id: app.roomId,
      track_uri: app.yt.currentVideoId || '',
      track_name: $('#np-title')?.textContent || '',
      artist: $('#np-artist')?.textContent || '',
      album_art_url: $('#art-img')?.src || '',
      position_ms: pos,
      duration_ms: app.yt.durationMs || 0,
      is_playing: action === 'play',
      loop: app._loopEnabled,
    };
    if (action === 'ended') {
      if (app._loopEnabled && app._currentTrackUri) {
        app.yt.setTrack({
          track_uri: app._currentTrackUri,
          position_ms: 0,
          duration_ms: app.yt.durationMs || 0,
          is_playing: true,
          track_name: $('#np-title')?.textContent || '',
          artist: $('#np-artist')?.textContent || '',
          album_art_url: $('#art-img')?.src || ''
        });
        app.sc.emit('playback_update', { ...payload, position_ms: 0, is_playing: true, loop: true });
      } else {
        app.sc.emit('next_track', { room_id: app.roomId });
      }
    } else {
      app.sc.emit('playback_update', payload);
    }
    app.setPlayIcon(action === 'play');
  });

  app.yt.onProgressUpdate = (pos, dur, playing) => {
    app.updateProgress(pos, dur);

    if (playing && dur > 30000 && (dur - pos) <= 10500 && (dur - pos) > 9500) {
      if (app._upNextShownForUri !== app._currentTrackUri && app._queueData.length > 0) {
        app._upNextShownForUri = app._currentTrackUri;
        app.showUpNext(app._queueData[0]);
      }
    }
  };

  // Auth & Room Initialisation
  const updateLoadStatus = (msg) => {
    const sub = document.getElementById('load-sub');
    if (sub && sub.offsetParent !== null) sub.textContent = msg;
  };

  (async function initRoom() {
    updateLoadStatus('Authenticating…');
    await app.checkAuth();
    
    updateLoadStatus('Loading room…');
    await app.loadRoom();
    
    if (app.roomData?.room) {
      app.isHost = !!(app.me && app.roomData.room.host_user_id === app.me.id);
      app.applyHostUI();
    }
    if (window.checkQueuePermissions) window.checkQueuePermissions();
    
    if (app.roomData?.password_required) {
      updateLoadStatus('Private Room — Password Required');
      const modal = $('#password-modal');
      if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('open'), 10);
        const modalBox = modal.querySelector('.modal-box');
        if (modalBox && window.gsap) {
          window.gsap.fromTo(modalBox, 
            { scale: 0.85, y: 30, opacity: 0 },
            { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
          );
        }
      }
      $('#room-join-password').focus();
    } else {
      app.hideLoadingOverlay();
    }
  })().catch(e => {
    console.error('[openjam] init failed:', e);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    updateLoadStatus('Something went wrong. Please refresh.');
    const retry = document.getElementById('load-retry');
    if (retry) retry.style.display = 'inline-flex';
  });

  // Socket Connection setup
  app.sc = new SocketClient();
  
  (function connectWhenReady() {
    if (typeof io !== 'undefined') {
      // Register all websocket event listeners
      app.sc.on('skip_votes_updated', d => {
        const btn = $('#btn-vote-skip');
        if(btn) {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6 8.5 6V6l-8.5 6z"/></svg> Vote to Skip (${d.votes}/${d.required})`;
          btn.classList.toggle('voted', d.voted);
        }
      });

      app.sc.on('connect', () => {
        app.hostSyncedOnInit = false;
      });

      app.sc.on('playback_sync', d => {
        if (d?.track_uri) {
          if (!app.isHost) {
            app.updateNPDisplay(d);
            const serverPlaying = d.is_playing !== false;
            const serverPos = d.position_ms || 0;
            const clientPos = app.yt.positionMs || 0;
            const drift = Math.abs(serverPos - clientPos);

            if (app._lastSyncPlaying !== serverPlaying) {
              app._lastSyncPlaying = serverPlaying;
              app.yt.setPlayState(serverPlaying);
              app.setPlayIcon(serverPlaying);
            }

            if (drift > 3000) {
              app.yt.syncPosition(serverPos, serverPlaying);
            }
          } else if (!app.hostSyncedOnInit) {
            app.hostSyncedOnInit = true;
            const serverPlaying = d.is_playing !== false;
            const serverPos = d.position_ms || 0;
            app.yt.syncPosition(serverPos, serverPlaying);
            app.setPlayIcon(serverPlaying);
            app._lastSyncPlaying = serverPlaying;
          }
        }
      });

      app.sc.on('track_changed', d => {
        app._skipInFlight = false;
        app.updateNP(d);
        if (d) {
          toast(`▶ ${d.track_name}`, 'success');
          if (document.hidden) app.playChime();
        }
      });

      app.sc.on('queue_updated', d => {
        if (window.renderQueue) window.renderQueue(d.queue);
      });

      app.sc.on('chat_message', d => {
        if (window.addChat) window.addChat(d);
        if (document.hidden) {
          app.playChime();
        } else if (!app.me || d.user_id !== app.me.id) {
          app.playChatSound();
        }
      });

      app.sc.on('chat_history', d => {
        if (d.messages?.length && window.addChat) {
          d.messages.forEach(window.addChat);
        }
      });

      app.sc.on('listener_count', d => {
        const barNum = $('#bar-lc-num');
        const badge = $('#m-count');
        const chatCount = $('#chat-user-count');
        const count = d.listeners ? d.listeners.length : (d.count ?? 0);
        if (barNum) barNum.textContent = count;
        if (badge) badge.textContent = count;
        if (chatCount) chatCount.textContent = count;
        const mobTab = $('#mob-tab-members');
        if (mobTab) {
          const lbl = mobTab.querySelector('.mob-tab-label');
          if (lbl) lbl.textContent = count > 0 ? `People (${count})` : 'People';
        }
        if (d.listeners) {
          if (app.roomData) app.roomData.listeners = d.listeners;
          if (window.updateMembers) window.updateMembers(d.listeners);
        }
        
        const btnSkip = $('#btn-vote-skip');
        if (btnSkip && !btnSkip.classList.contains('voted')) {
          const required = Math.max(1, Math.ceil(count / 2));
          btnSkip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6 8.5 6V6l-8.5 6z"/></svg> Vote to Skip (0/${required})`;
        }
      });

      app.sc.on('user_joined', d => {
        toast(`${d.display_name} joined`, 'info');
        if (document.hidden || !app.me || d.id !== app.me.id) {
          app.playChime();
        }
      });

      app.sc.on('user_left', d => {
        toast(`${d.display_name} left`, 'info');
      });

      app.sc.on('host_changed', d => {
        if (app.roomData && app.roomData.room) {
          app.roomData.room.host_user_id = d.host_user_id;
          app.roomData.room.host_name = d.host_name;
        }
        app.isHost = !!(app.me && d.host_user_id === app.me.id);
        app.applyHostUI();
        
        const hostEl = $('#bar-host');
        if (hostEl) hostEl.textContent = `Hosted by ${d.host_name}`;
        
        if (window.checkQueuePermissions) window.checkQueuePermissions();
        if (window.renderQueue) window.renderQueue(app._queueData);
        if (app.roomData && app.roomData.listeners && window.updateMembers) {
          window.updateMembers(app.roomData.listeners);
        }
        
        toast(`${d.host_name} is now the host and controls playback!`, 'info');
      });

      app.sc.on('room_closed', d => {
        toast(d?.reason || 'Room closed', 'info');
        setTimeout(() => location.href = '/', 2500);
      });

      app.sc.on('queue_error', d => {
        toast(d.message || 'Action blocked', 'error');
      });

      app.sc.on('join_error', d => {
        if (d.reason === 'password_required' || d.reason === 'invalid_password') {
          const modal = $('#password-modal');
          const input = $('#room-join-password');
          const errMsg = $('#password-error-message');
          const submitBtn = $('#btn-password-submit');
          
          if (modal) {
            modal.style.display = 'flex';
            if (!modal.classList.contains('open')) {
              modal.classList.add('open');
              const modalBox = modal.querySelector('.modal-box');
              if (modalBox && window.gsap) {
                window.gsap.fromTo(modalBox, 
                  { scale: 0.85, y: 30, opacity: 0 },
                  { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
                );
              }
            }
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Join Room';
          input.focus();
          if (d.reason === 'invalid_password') {
            errMsg.textContent = 'Invalid password. Please try again.';
            errMsg.style.display = 'block';
            input.value = '';
          } else {
            errMsg.style.display = 'none';
          }
        } else {
          toast(d.message || 'Failed to join room', 'error');
          setTimeout(() => location.href = '/', 2000);
        }
      });

      app.sc.on('join_success', d => {
        const modal = $('#password-modal');
        if (modal) {
          modal.classList.remove('open');
          setTimeout(() => modal.style.display = 'none', 300);
        }

        if (app.roomData && app.roomData.password_required) {
          app.roomData.password_required = false;
          app.loadRoom().then(() => {
            app.hideLoadingOverlay();
          });
        }
      });

      app.sc.connect();
      app.sc.joinRoom(app.roomId);
      setTimeout(() => app.sc.requestSync(), 500);
      return;
    }
    if (window._ioFail) {
      const sub = document.getElementById('load-sub');
      if (sub) sub.textContent = 'Failed to load: socket.io blocked. Try disabling ad-blocker.';
      const retry = document.getElementById('load-retry');
      if (retry) retry.style.display = 'inline-flex';
      return;
    }
    setTimeout(connectWhenReady, 200);
  })();

  // DOM Event wires
  $('#btn-toggle-lyrics')?.addEventListener('click', () => {
    const view = $('#lyrics-view');
    const btn = $('#btn-toggle-lyrics');
    const isVisible = view.classList.toggle('active');
    btn.classList.toggle('active', isVisible);
    $('#panel-left')?.classList.toggle('lyrics-active', isVisible);
    if (isVisible && app.lyricsManager) {
      setTimeout(() => {
        app.lyricsManager.scrollToActiveLine(true);
      }, 50); // small layout settle delay
    }
  });
  $('#btn-close-lyrics')?.addEventListener('click', () => {
    $('#btn-toggle-lyrics')?.click();
  });

  // Sound chimes toggle
  const btnSound = $('#btn-sound-toggle');
  if (btnSound) {
    const soundsEnabled = localStorage.getItem('openjam_sounds') !== 'false';
    btnSound.innerHTML = soundsEnabled ? '🔊' : '🔇';
    
    btnSound.addEventListener('click', () => {
      const current = localStorage.getItem('openjam_sounds') !== 'false';
      const newVal = !current;
      localStorage.setItem('openjam_sounds', String(newVal));
      btnSound.innerHTML = newVal ? '🔊' : '🔇';
      toast(`Notification sounds ${newVal ? 'enabled' : 'disabled'}`, 'info');
      if (newVal) app.playChime();
    });
  }

  // Volume bindings
  const _onVolSliderInput = (e) => {
    app.muted = false;
    const v = +e.target.value;
    if (v > 0) app._premuteVol = v;
    if (!app._volRafPending) {
      app._volRafPending = true;
      requestAnimationFrame(() => { app.applyVol(v); app._volRafPending = false; });
    }
  };
  $('#vol-slider')?.addEventListener('input', _onVolSliderInput);
  $('#vol-icon')?.addEventListener('click', () => {
    if (app.muted || app.vol === 0) {
      app.muted = false;
      app.applyVol(app._premuteVol > 0 ? app._premuteVol : 80);
    } else {
      app._premuteVol = app.vol;
      app.muted = true;
      app.applyVol(0);
    }
  });
  $('#mob-vol-slider')?.addEventListener('input', _onVolSliderInput);
  $('#mob-vol-icon')?.addEventListener('click', () => {
    if (app.muted || app.vol === 0) {
      app.muted = false;
      app.applyVol(app._premuteVol > 0 ? app._premuteVol : 80);
    } else {
      app._premuteVol = app.vol;
      app.muted = true;
      app.applyVol(0);
    }
  });

  // Playback bindings (Host)
  $('#btn-play')?.addEventListener('click', () => {
    if (!app.isHost) return;
    let isActuallyPlaying;
    if (app.yt._useIFrame && app.yt.ytPlayer && typeof app.yt.ytPlayer.getPlayerState === 'function') {
      isActuallyPlaying = app.yt.ytPlayer.getPlayerState() === YT.PlayerState.PLAYING;
      isActuallyPlaying ? app.yt.ytPlayer.pauseVideo() : app.yt.ytPlayer.playVideo();
    } else {
      isActuallyPlaying = app.yt.player && !app.yt.player.paused;
      if (app.yt._ready && app.yt.player) { isActuallyPlaying ? app.yt.player.pause() : app.yt.player.play().catch(() => {}); }
    }
    app.setPlayIcon(!isActuallyPlaying);
    app.sc.emit('playback_update', {
      room_id: app.roomId,
      track_uri: app.yt.currentVideoId || '',
      track_name: $('#np-title')?.textContent || '',
      artist: $('#np-artist')?.textContent || '',
      album_art_url: $('#art-img')?.src || '',
      position_ms: app.yt.positionMs || 0,
      duration_ms: app.yt.durationMs || 0,
      is_playing: !isActuallyPlaying,
      loop: app._loopEnabled,
    });
  });

  $('#btn-next')?.addEventListener('click', () => {
    if (!app.isHost || app._skipInFlight) return;
    app._skipInFlight = true;
    app.sc.nextTrack();
    setTimeout(() => { app._skipInFlight = false; }, 5000);
  });

  $('#btn-loop')?.addEventListener('click', () => {
    app._loopEnabled = !app._loopEnabled;
    const btn = $('#btn-loop');
    if (btn) {
      btn.classList.toggle('active', app._loopEnabled);
      btn.title = app._loopEnabled ? 'Loop: ON' : 'Loop: OFF';
    }
    toast(app._loopEnabled ? '🔁 Loop enabled' : '➡️ Loop disabled', 'info');
    if (app.isHost) {
      app.sc.emit('playback_update', {
        room_id: app.roomId,
        track_uri: app.yt.currentVideoId || '',
        track_name: $('#np-title')?.textContent || '',
        artist: $('#np-artist')?.textContent || '',
        album_art_url: $('#art-img')?.src || '',
        position_ms: app.yt.positionMs || 0,
        duration_ms: app.yt.durationMs || 0,
        is_playing: app.yt.isPlaying,
        loop: app._loopEnabled,
      });
    }
  });

  // Seek bar (Host-only drag seek)
  let _isDraggingProgress = false;
  const handleProgressSeek = (clientX) => {
    const bar = document.getElementById('progress-bar');
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = window._lastDur || app.yt.durationMs || 0;
    if (!dur) return null;
    const seekMs = Math.round(pct * dur);
    app.updateProgress(seekMs, dur, true);
    return { seekMs, dur };
  };

  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.addEventListener('mousedown', (e) => {
      if (!app.isHost) return;
      _isDraggingProgress = true;
      window._isDraggingProgressTime = true;
      handleProgressSeek(e.clientX);
    });
    progressBar.addEventListener('touchstart', (e) => {
      if (!app.isHost) return;
      _isDraggingProgress = true;
      window._isDraggingProgressTime = true;
      if (e.touches && e.touches[0]) handleProgressSeek(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('mousemove', (e) => {
      if (_isDraggingProgress) handleProgressSeek(e.clientX);
    });
    window.addEventListener('touchmove', (e) => {
      if (_isDraggingProgress && e.touches && e.touches[0]) handleProgressSeek(e.touches[0].clientX);
    }, { passive: true });

    const endDrag = (clientX) => {
      if (_isDraggingProgress) {
        _isDraggingProgress = false;
        window._isDraggingProgressTime = false;
        const res = handleProgressSeek(clientX);
        if (res) {
          const { seekMs, dur } = res;
          if (app.yt._useIFrame && app.yt.ytPlayer && typeof app.yt.ytPlayer.seekTo === 'function') {
            app.yt.ytPlayer.seekTo(seekMs / 1000, true);
          } else if (app.yt._ready && app.yt.player) {
            app.yt.player.currentTime = seekMs / 1000;
          }
          app.sc.emit('playback_update', {
            room_id: app.roomId,
            track_uri: app.yt.currentVideoId || '',
            track_name: $('#np-title')?.textContent || '',
            artist: $('#np-artist')?.textContent || '',
            album_art_url: $('#art-img')?.src || '',
            position_ms: seekMs,
            duration_ms: dur,
            is_playing: true,
            loop: app._loopEnabled,
          });
        }
      }
    };
    window.addEventListener('mouseup', (e) => endDrag(e.clientX));
    window.addEventListener('touchend', (e) => {
      if (_isDraggingProgress) {
        const clientX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : 0;
        endDrag(clientX);
      }
    }, { passive: true });
  }

  // Close Room Modal
  $('#btn-close')?.addEventListener('click', () => {
    const modal = $('#close-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('open'), 10);
      const modalBox = modal.querySelector('.modal-box');
      if (modalBox && window.gsap) {
        window.gsap.fromTo(modalBox, 
          { scale: 0.85, y: 30, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
        );
      }
    }
  });
  $('#btn-close-cancel')?.addEventListener('click', () => {
    const modal = $('#close-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => modal.style.display = 'none', 300);
    }
  });
  $('#btn-close-confirm')?.addEventListener('click', async () => {
    const confirmBtn = document.getElementById('btn-close-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Closing...';
    const r = await fetch(`/rooms/${app.roomId}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { toast('Room closed', 'success'); setTimeout(() => location.href = '/', 1500); }
    else {
      toast('Failed to close room', 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Close Room';
      const modal = $('#close-modal');
      if (modal) {
        modal.classList.remove('open');
        setTimeout(() => modal.style.display = 'none', 300);
      }
    }
  });

  // Password modal submit/cancel event handlers
  const submitPassword = () => {
    const input = $('#room-join-password');
    const password = input.value.trim();
    if (!password) return;

    const submitBtn = $('#btn-password-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Joining...';
    }

    app.sc.joinRoom(app.roomId, password);
  };

  $('#btn-password-submit')?.addEventListener('click', submitPassword);
  $('#room-join-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPassword();
    }
  });

  $('#btn-password-cancel')?.addEventListener('click', () => {
    location.href = '/';
  });

  // Invite triggers
  $('#btn-invite')?.addEventListener('click', () => {
    const shareData = { title: `${app.roomData?.room?.name || 'OpenJam Room'}`, text: `Join my real-time collaborative listening room on OpenJam!`, url: location.href };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(err => { if (err.name !== 'AbortError') app.copyToClipboard(); });
    } else { app.copyToClipboard(); }
  });

  app.copyToClipboard = () => {
    navigator.clipboard.writeText(location.href).then(() => { toast('Room link copied! 🔗', 'success'); }).catch(() => {
      const el = document.createElement('textarea');
      el.value = location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast('Room link copied! 🔗', 'success');
    });
  };

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'ArrowUp' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      app.muted = false;
      app.applyVol(Math.min(100, app.vol + 5));
    } else if (e.code === 'ArrowDown' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      app.muted = false;
      app.applyVol(Math.max(0, app.vol - 5));
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (app.muted || app.vol === 0) {
        app.muted = false;
        app.applyVol(app._premuteVol > 0 ? app._premuteVol : 80);
      } else {
        app._premuteVol = app.vol;
        app.muted = true;
        app.applyVol(0);
      }
    }

    if (!app.isHost) return;
    if (e.code === 'Space') {
      e.preventDefault();
      $('#btn-play')?.click();
    } else if (e.code === 'ArrowRight' && e.shiftKey) {
      e.preventDefault();
      $('#btn-next')?.click();
    }
  });

  // Turntable Platter Animation Loop with Pulsing Glow
  (function setupTurntableLoop() {
    const record = $('#vinyl-record');
    const glow = $('#player-glow');
    function animateTurntable() {
      if (record) {
        if (!app._isScratching) {
          if (app._turntablePlaying) {
            if (app._turntableSpeed < app.TARGET_TURNTABLE_SPEED) app._turntableSpeed += app.TURNTABLE_ACCEL;
          } else {
            if (app._turntableSpeed > 0) {
              app._turntableSpeed -= app.TURNTABLE_DECEL;
              if (app._turntableSpeed < 0) app._turntableSpeed = 0;
            }
          }
          if (app._turntableSpeed > 0) {
            app._turntableAngle = (app._turntableAngle + app._turntableSpeed) % 360;
            record.style.transform = `rotate(${app._turntableAngle}deg)`;
          }
        }
        
        if (app._turntablePlaying) {
          const pulse = 0.25 + Math.sin(Date.now() / 250) * 0.1;
          const size = 80 + Math.sin(Date.now() / 250) * 5;
          const currentSpeedRatio = app._isScratching ? 1 : (app._turntableSpeed / app.TARGET_TURNTABLE_SPEED);
          record.style.boxShadow = `0 0 36px rgba(245, 158, 11, ${pulse * currentSpeedRatio}), 0 12px 40px rgba(0, 0, 0, 0.65)`;
          if (glow) {
            glow.style.opacity = pulse;
            glow.style.width = `${size}%`;
            glow.style.height = `${size}%`;
            glow.style.top = `${(100 - size) / 2}%`;
            glow.style.left = `${(100 - size) / 2}%`;
          }
        } else {
          const currentSpeedRatio = app._isScratching ? 1 : (app._turntableSpeed / app.TARGET_TURNTABLE_SPEED);
          if (currentSpeedRatio > 0) {
            record.style.boxShadow = `0 0 36px rgba(245, 158, 11, ${0.1 * currentSpeedRatio}), 0 12px 40px rgba(0, 0, 0, 0.65)`;
            if (glow) glow.style.opacity = 0.1 * currentSpeedRatio;
          } else {
            record.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.65)';
            if (glow) glow.style.opacity = '0';
          }
        }
      }
      requestAnimationFrame(animateTurntable);
    }
    requestAnimationFrame(animateTurntable);
  })();

  // Vinyl Record Scratching Gestures
  (function setupVinylRecordGestures() {
    const record = $('#vinyl-record');
    const artWrap = $('.art-wrap');
    if (!record || !artWrap) return;

    let startAngleDeg = 0;
    let lastAngleDeg = 0;
    let lastTime = 0;
    let startTime = 0;
    let totalRotateDelta = 0;
    
    function getAngleAtPoint(clientX, clientY) {
      const rect = record.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    }

    function onStart(clientX, clientY) {
      app._isScratching = true;
      startTime = Date.now();
      lastTime = startTime;
      totalRotateDelta = 0;

      lastAngleDeg = getAngleAtPoint(clientX, clientY);
      startAngleDeg = lastAngleDeg;

      app.getAudioCtx();

      record.style.transition = 'none';
      record.style.transform = `rotate(${app._turntableAngle}deg) scale(0.94) skewX(-3deg)`;
      gsap.killTweensOf(record);
    }

    function onMove(clientX, clientY) {
      if (!app._isScratching) return;
      const currentAngleDeg = getAngleAtPoint(clientX, clientY);
      let angleDiff = currentAngleDeg - lastAngleDeg;

      if (angleDiff > 180) angleDiff -= 360;
      else if (angleDiff < -180) angleDiff += 360;

      totalRotateDelta += angleDiff;
      app._turntableAngle = (app._turntableAngle + angleDiff) % 360;
      if (app._turntableAngle < 0) app._turntableAngle += 360;

      record.style.transform = `rotate(${app._turntableAngle}deg) scale(0.94) skewX(-3deg)`;

      const now = Date.now();
      const dt = now - lastTime;
      if (dt > 0) {
        const speed = Math.abs(angleDiff) / dt;
        if (speed > 0.05) app.playScratchSound(speed * 8);
      }

      lastAngleDeg = currentAngleDeg;
      lastTime = now;
    }

    function onEnd(clientX, clientY) {
      if (!app._isScratching) return;
      app._isScratching = false;

      record.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.1)';
      record.style.transform = `rotate(${app._turntableAngle}deg)`;

      const duration = Date.now() - startTime;
      
      if (duration < 250 && Math.abs(totalRotateDelta) < 15) {
        if (app.isHost) {
          $('#btn-play')?.click();
        } else {
          toast('Only host can pause/resume room. Tap "Vote to Skip" to skip!', 'info');
        }
      } else if (duration < 450 && Math.abs(totalRotateDelta) > 30) {
        if (totalRotateDelta < 0) {
          const targetAngle = app._turntableAngle - 360;
          gsap.to(record, {
            rotation: targetAngle,
            duration: 0.5,
            ease: 'power3.out',
            onComplete: () => {
              app._turntableAngle = targetAngle % 360;
              record.style.transform = `rotate(${app._turntableAngle}deg)`;
            }
          });
          if (app.isHost) {
            $('#btn-next')?.click();
          } else {
            $('#btn-vote-skip')?.click();
          }
        } else {
          const targetAngle = app._turntableAngle + 360;
          gsap.to(record, {
            rotation: targetAngle,
            duration: 0.5,
            ease: 'power3.out',
            onComplete: () => {
              app._turntableAngle = targetAngle % 360;
              record.style.transform = `rotate(${app._turntableAngle}deg)`;
            }
          });
          if (app.isHost) {
            if (app.yt._useIFrame && app.yt.ytPlayer && typeof app.yt.ytPlayer.seekTo === 'function') {
              app.yt.ytPlayer.seekTo(0, true);
            } else if (app.yt._ready && app.yt.player) {
              app.yt.player.currentTime = 0;
            }
            app.sc.emit('playback_update', {
              room_id: app.roomId,
              track_uri: app.yt.currentVideoId || '',
              track_name: $('#np-title')?.textContent || '',
              artist: $('#np-artist')?.textContent || '',
              album_art_url: $('#art-img')?.src || '',
              position_ms: 0,
              duration_ms: app.yt.durationMs || 0,
              is_playing: app.yt.isPlaying,
            });
            toast('Restarting track...', 'info');
          } else {
            toast('Only host can restart the track', 'warning');
          }
        }
      }
    }

    artWrap.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    artWrap.addEventListener('touchmove', (e) => {
      if (!app._isScratching) return;
      if (e.cancelable) e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    artWrap.addEventListener('touchend', (e) => {
      if (!app._isScratching) return;
      onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, { passive: true });

    artWrap.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      const onMouseMove = (moveEv) => onMove(moveEv.clientX, moveEv.clientY);
      const onMouseUp = (upEv) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        onEnd(upEv.clientX, upEv.clientY);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  })();

  // Swipe gesture tabs between screens (mobile only)
  (function setupMobileSwipeGestures() {
    let _touchStartX = 0;
    let _touchStartY = 0;
    let _isSwiping = false;
    let _isScrolling = false;
    let _activeIdx = 1;
    let _width = 0;
    let _currentPanel = null;
    let _prevPanel = null;
    let _nextPanel = null;

    const left = $('#panel-left');
    const centre = $('#panel-center');
    const right = $('#panel-right');
    const _panels = [left, centre, right];

    const grid = $('#room-grid');
    if (grid) {
      grid.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 640) return;
        const target = e.target;
        if (target.closest('.vol-slider') || 
            target.closest('.progress-bar') || 
            target.closest('.lyrics-view') || 
            target.closest('.input-field') || 
            target.closest('.clear-btn') || 
            target.closest('.icon-btn') || 
            target.closest('.btn-react') || 
            target.closest('.drag-handle') ||
            target.closest('.art-wrap')) {
          _touchStartX = 0;
          _touchStartY = 0;
          return;
        }

        _touchStartX = e.touches[0].clientX;
        _touchStartY = e.touches[0].clientY;
        _isSwiping = false;
        _isScrolling = false;
        _width = grid.getBoundingClientRect().width;
        
        _activeIdx = _panels.findIndex(p => p?.classList.contains('mobile-active'));
        if (_activeIdx === -1) _activeIdx = 1;
        
        _currentPanel = _panels[_activeIdx];
        _prevPanel = _activeIdx > 0 ? _panels[_activeIdx - 1] : null;
        _nextPanel = _activeIdx < _panels.length - 1 ? _panels[_activeIdx + 1] : null;
        
        if (_currentPanel) gsap.killTweensOf(_currentPanel);
        if (_prevPanel) gsap.killTweensOf(_prevPanel);
        if (_nextPanel) gsap.killTweensOf(_nextPanel);
      }, { passive: true });

      grid.addEventListener('touchmove', (e) => {
        if (window.innerWidth > 640 || !_touchStartX) return;
        const touch = e.touches[0];
        const dx = touch.clientX - _touchStartX;
        const dy = touch.clientY - _touchStartY;
        
        if (!_isSwiping && !_isScrolling) {
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            if (Math.abs(dy) > Math.abs(dx)) {
              _isScrolling = true;
            } else {
              _isSwiping = true;
              if (_prevPanel) {
                _prevPanel.style.display = 'flex';
                _prevPanel.style.transform = `translate3d(${-_width}px, 0, 0)`;
              }
              if (_nextPanel) {
                _nextPanel.style.display = 'flex';
                _nextPanel.style.transform = `translate3d(${_width}px, 0, 0)`;
              }
            }
          }
        }
        
        if (_isSwiping) {
          if (e.cancelable) e.preventDefault();
          let tx = dx;
          if (dx > 0) {
            if (!_prevPanel) {
              tx = dx * 0.25;
              if (_currentPanel) _currentPanel.style.transform = `translate3d(${tx}px, 0, 0)`;
            } else {
              if (_currentPanel) _currentPanel.style.transform = `translate3d(${tx}px, 0, 0)`;
              if (_prevPanel) _prevPanel.style.transform = `translate3d(${-_width + tx}px, 0, 0)`;
            }
          } else {
            if (!_nextPanel) {
              tx = dx * 0.25;
              if (_currentPanel) _currentPanel.style.transform = `translate3d(${tx}px, 0, 0)`;
            } else {
              if (_currentPanel) _currentPanel.style.transform = `translate3d(${tx}px, 0, 0)`;
              if (_nextPanel) _nextPanel.style.transform = `translate3d(${_width + tx}px, 0, 0)`;
            }
          }
        }
      }, { passive: false });

      grid.addEventListener('touchend', (e) => {
        if (window.innerWidth > 640 || !_touchStartX) return;
        const dx = e.changedTouches[0].clientX - _touchStartX;
        _touchStartX = 0;
        _touchStartY = 0;
        
        if (_isSwiping) {
          const threshold = _width * 0.22;
          
          if (dx > threshold && _prevPanel) {
            gsap.to(_currentPanel, { x: _width, duration: 0.25, ease: 'power2.out', onComplete: () => { _currentPanel.style.display = 'none'; _currentPanel.style.transform = ''; } });
            gsap.to(_prevPanel, { x: 0, duration: 0.25, ease: 'power2.out', onComplete: () => { _prevPanel.style.transform = ''; const prevTabMap = ['nowplaying', 'queue', 'chat']; switchMobileTab(prevTabMap[_activeIdx - 1], true); } });
          } else if (dx < -threshold && _nextPanel) {
            gsap.to(_currentPanel, { x: -_width, duration: 0.25, ease: 'power2.out', onComplete: () => { _currentPanel.style.display = 'none'; _currentPanel.style.transform = ''; } });
            gsap.to(_nextPanel, { x: 0, duration: 0.25, ease: 'power2.out', onComplete: () => { _nextPanel.style.transform = ''; const nextTabMap = ['nowplaying', 'queue', 'chat']; switchMobileTab(nextTabMap[_activeIdx + 1], true); } });
          } else {
            gsap.to(_currentPanel, { x: 0, duration: 0.25, ease: 'back.out(1.5)', onComplete: () => { _currentPanel.style.transform = ''; } });
            if (_prevPanel) { gsap.to(_prevPanel, { x: -_width, duration: 0.25, ease: 'power2.out', onComplete: () => { _prevPanel.style.display = 'none'; _prevPanel.style.transform = ''; } }); }
            if (_nextPanel) { gsap.to(_nextPanel, { x: _width, duration: 0.25, ease: 'power2.out', onComplete: () => { _nextPanel.style.display = 'none'; _nextPanel.style.transform = ''; } }); }
          }
        }
        _isSwiping = false;
        _isScrolling = false;
      }, { passive: true });
    }
  })();

  // Connection lost indicator banner
  (function setupConnectionIndicator() {
    let _reconnBanner = null;
    const showReconnBanner = () => {
      if (_reconnBanner) return;
      _reconnBanner = document.createElement('div');
      _reconnBanner.id = 'reconn-banner';
      _reconnBanner.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:9998; background:linear-gradient(90deg, #e11d48, #f59e0b); color:#fff; text-align:center; padding:6px 12px; font-size:12px; font-weight:600; letter-spacing:0.3px; animation: slideDown 0.3s ease;';
      _reconnBanner.textContent = '⚡ Connection lost — reconnecting…';
      document.body.prepend(_reconnBanner);
    };
    const hideReconnBanner = () => {
      if (_reconnBanner) {
        _reconnBanner.style.opacity = '0';
        _reconnBanner.style.transition = 'opacity 0.3s';
        setTimeout(() => { _reconnBanner?.remove(); _reconnBanner = null; }, 300);
      }
    };
    const checkSocket = setInterval(() => {
      if (app.sc && app.sc.socket) {
        clearInterval(checkSocket);
        app.sc.socket.on('disconnect', showReconnBanner);
        app.sc.socket.on('connect', hideReconnBanner);
      }
    }, 500);
  })();

  // Apply default local storage volumes
  app.applyVol(app.vol);

  // Re-sync playback position when returning from background (mobile)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && app.sc && app.sc._ready && app.sc._ready()) {
      // Small delay to let the page fully wake up
      setTimeout(() => {
        app.sc.requestSync();
        // Also resume AudioContext if suspended (iOS requirement)
        if (app.sharedAudioCtx && app.sharedAudioCtx.state === 'suspended') {
          app.sharedAudioCtx.resume();
        }
      }, 300);
    }
  });

  // Clean-up on close
  window.addEventListener('beforeunload', () => {
    if (app.sc) app.sc.leaveRoom(app.roomId);
    if (app.yt) app.yt.destroy();
  });

  // PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[openjam] Service Worker registered:', reg.scope))
      .catch(err => console.error('[openjam] Service Worker registration failed:', err));
  }
});
