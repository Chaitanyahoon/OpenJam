/* ==========================================================================
   OPEN JAM — Landing Page Controller Module
   Manages user registration, rooms list polling, tags, filters, and GSAP intros.
   ========================================================================== */

(async () => {
  // Tiny helpers
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => { const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; };
  const initials = n => (n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const nameColor = n => {
    let h = 0;
    for (let i = 0; i < (n || '').length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 60%, 55%)`;
  };
  const toast = (msg,type='info') => {
    const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg;
    $('#toasts').appendChild(el); setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='all 0.3s'; setTimeout(()=>el.remove(),300); },3500);
  };

  let me = null;
  let rooms = [];
  let _activeGenreFilter = null;

  // Random Name Generator List
  function generateRandomName() {
    const prefixes = ['Vinyl', 'Acid', 'Neon', 'Strobe', 'Signal', 'Fader', 'Beat', 'Groove', 'Tempo', 'Decibel', 'Echo', 'Sonic', 'Analog', 'Synth'];
    const suffixes = ['Jammer', 'Listener', 'Drifter', 'Pulse', 'Wave', 'Mixer', 'Seeker', 'Beats', 'Vibe', 'Rhythm', 'Waveform'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${p}${s}${num}`;
  }

  // 1. Check Auth
  async function checkAuth(){
    try {
      const r = await fetch('/auth/me', { credentials:'include' });
      if(r.ok){ me = (await r.json()).user; }
    } catch(e){}

    if(!me){
      const stored = localStorage.getItem('openjam_display_name');
      if(stored){
        try {
          const r2 = await fetch('/auth/join', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({display_name:stored}), credentials:'include' });
          if(r2.ok) me = (await r2.json()).user;
        } catch(e){}
      }
    }

    if(me){
      $('#join-modal').classList.remove('active');

      // Show Discord avatar or initials
      const navAvatar = $('#nav-avatar');
      if (me.avatar_url) {
        navAvatar.innerHTML = `<img src="${me.avatar_url}" alt="${esc(me.display_name)}">`;
        navAvatar.style.border = '2px solid #5865F2';
        localStorage.setItem('openjam_avatar_url', me.avatar_url);
        $$('.btn-discord-cta').forEach(el => el.style.display = 'none');
      } else {
        navAvatar.textContent = initials(me.display_name);
        $$('.btn-discord-cta').forEach(el => el.style.display = 'inline-flex');
      }

      $('#nav-name').textContent = me.display_name;
      $('#navbar-user').style.display = 'flex';
      localStorage.setItem('openjam_display_name', me.display_name);
      $$('.btn-open-join-trigger').forEach(el => el.style.display = 'none');
      $$('.btn-create-room-trigger').forEach(el => el.style.display = 'inline-flex');

      const desc = $('#hero-description');
      if (desc) {
        desc.innerHTML = me.avatar_url 
          ? `Welcome back! Logged in as <strong style="color:#a5b4fc">@${esc(me.display_name)}</strong> via Discord. Create a room below or join an active jam!`
          : `Welcome back! Logged in as <strong style="color:var(--amber)">${esc(me.display_name)}</strong>. Create a room below or join an active jam!`;
      }
    } else {
      $('#join-modal').classList.remove('active');
      $('#navbar-user').style.display = 'none';
      $$('.btn-open-join-trigger').forEach(el => el.style.display = 'inline-flex');
      $$('.btn-create-room-trigger').forEach(el => el.style.display = 'none');
      $$('.btn-discord-cta').forEach(el => el.style.display = 'inline-flex');

      const desc = $('#hero-description');
      if (desc) {
        desc.textContent = 'Social Listening, but make it classy. Create a listening room, queue tracks from YouTube, and listen together in perfect sync.';
      }
    }

    // Handle Discord OAuth errors from redirect
    const urlParams = new URLSearchParams(window.location.search);
    const discordError = urlParams.get('error');
    if (discordError) {
      const errorMessages = {
        'discord_no_code': 'Discord login was cancelled.',
        'discord_not_configured': 'Discord login is not configured on this server.',
        'discord_token_failed': 'Failed to authenticate with Discord. Please try again.',
        'discord_no_token': 'Discord did not provide an access token.',
        'discord_user_failed': 'Failed to fetch Discord profile.',
        'discord_error': 'Discord login failed. Please try again.',
      };
      toast(errorMessages[discordError] || 'Login failed.', 'error');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // Intercept room card click for customization-first guest entry
  window.joinRoomAction = (roomId) => {
    if (me) {
      location.href = `/room/${roomId}`;
      return;
    }

    // Save target room, open join modal to let them choose (type name or random bypass)
    window.targetRoomId = roomId;
    window.openCreateAfterJoin = false;
    $('#join-modal').classList.add('active');
    $('#join-name').focus();
  };

  // 2. Auth Actions
  let shufflerAudioCtx = null;
  function playShufflerBlip(pitch) {
    try {
      if (!shufflerAudioCtx) {
        shufflerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (shufflerAudioCtx.state === 'suspended') {
        shufflerAudioCtx.resume();
      }
      const now = shufflerAudioCtx.currentTime;
      const osc = shufflerAudioCtx.createOscillator();
      const gain = shufflerAudioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, now + 0.06);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      
      osc.connect(gain);
      gain.connect(shufflerAudioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn("Audio context failed to initialize/play shuffler blip:", e);
    }
  }

  let isShuffling = false;
  $('#btn-join-random')?.addEventListener('click', () => {
    if (isShuffling) return;
    isShuffling = true;
    const btn = $('#btn-join-random');
    const input = $('#join-name');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🎲 ...';
    }
    
    let iterations = 0;
    const maxIterations = 8;
    const intervalTime = 100; // 100ms * 8 = 800ms total
    
    const interval = setInterval(() => {
      const tempName = generateRandomName();
      if (input) input.value = tempName;
      
      // Play retro Web Audio beep with increasing pitch
      const pitch = 250 + (iterations * 60);
      playShufflerBlip(pitch);
      
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        const finalName = generateRandomName();
        if (input) input.value = finalName;
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🎲 Roll';
        }
        isShuffling = false;
        
        // Play final confirmation blip
        playShufflerBlip(780);
      }
    }, intervalTime);
  });


  $('#btn-instant-jam')?.addEventListener('click', async () => {
    if (!me) {
      const randomName = generateRandomName();
      toast(`⚡ Instant Jam: Entering as ${randomName}...`, 'info');
      try {
        const r = await fetch('/auth/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: randomName }),
          credentials: 'include'
        });
        if (r.ok) {
          me = (await r.json()).user;
          localStorage.setItem('openjam_display_name', randomName);
        }
      } catch(e) {}
    }

    if (rooms.length > 0) {
      const sorted = [...rooms].sort((a, b) => (b.listener_count || 0) - (a.listener_count || 0));
      const targetRoom = sorted.find(r => !r.is_private) || sorted[0];
      toast(`⚡ Joining: ${targetRoom.name}`, 'success');
      setTimeout(() => location.href = `/room/${targetRoom.id}`, 800);
    } else {
      toast(`⚡ Creating a new Quick Jam room...`, 'info');
      const roomNames = ['Neon Lounge', 'Retro Beatcave', 'Analog Space', 'Echo Chamber', 'Decibel Oasis', 'Strobe Sanctuary'];
      const rName = roomNames[Math.floor(Math.random() * roomNames.length)] + ' #' + Math.floor(Math.random() * 90 + 10);
      try {
        const r = await fetch('/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: rName,
            description: '⚡ 1-Click Instant Jam. Welcome, come queue music and chill!',
            genre_tags: ['chill', 'lofi'],
            queue_mode: 'open',
            password: null
          }),
          credentials: 'include'
        });
        if (r.ok) {
          const data = await r.json();
          location.href = `/room/${data.room.id}`;
        }
      } catch(e) {
        toast('Failed to create room.', 'error');
      }
    }
  });

  // 2. Auth Actions
  $('#btn-join')?.addEventListener('click', async ()=>{
    const name = $('#join-name').value.trim();
    if(!name) return toast('Please enter a name','error');
    $('#btn-join').disabled = true; $('#btn-join').textContent = 'Joining...';
    try {
      const r = await fetch('/auth/join', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({display_name:name}), credentials:'include' });
      if(r.ok){
        me = (await r.json()).user;
        localStorage.setItem('openjam_display_name', name);
        $('#join-modal').classList.remove('active');
        $('#nav-avatar').textContent = initials(me.display_name);
        $('#nav-name').textContent = me.display_name;
        $('#navbar-user').style.display = 'flex';
        if ($('#btn-open-join')) $('#btn-open-join').style.display = 'none';
        $('#btn-create-room').style.display = 'inline-flex';
        toast(`Welcome to Open Jam, ${name}!`, 'success');
        
        if (window.targetRoomId) {
          const target = window.targetRoomId;
          window.targetRoomId = null;
          location.href = `/room/${target}`;
        } else if (window.openCreateAfterJoin) {
          window.openCreateAfterJoin = false;
          $('#create-modal').classList.add('open');
        }
      } else { throw new Error('Join failed'); }
    } catch(e){ toast(e.message||'Failed to join','error'); }
    finally { $('#btn-join').disabled=false; $('#btn-join').textContent = 'Enter Open Jam'; }
  });
  $('#join-name')?.addEventListener('keydown', e=>{ if(e.key==='Enter') $('#btn-join').click(); });
  
  $('#btn-logout')?.addEventListener('click', ()=>{
    $('#leave-modal').classList.add('active');
  });

  $('#btn-leave-cancel')?.addEventListener('click', ()=>{
    $('#leave-modal').classList.remove('active');
  });

  $('#btn-leave-confirm')?.addEventListener('click', async ()=>{
    $('#btn-leave-confirm').disabled = true;
    $('#btn-leave-confirm').textContent = 'Leaving...';
    localStorage.removeItem('openjam_display_name');
    try {
      await fetch('/auth/logout', { method:'POST', credentials:'include' });
    } catch(e) {}
    location.reload();
  });

  // 3. Load Rooms
  async function loadRooms(){
    try {
      const r = await fetch('/rooms', { credentials:'include' });
      if(!r.ok) return;
      const data = await r.json();
      rooms = data.rooms || [];
      renderGenreFilters(rooms);
      let filtered = rooms;
      const q = $('#search-input').value.toLowerCase();
      if (q) filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || (r.genre_tags||[]).some(t=>t.toLowerCase().includes(q)));
      if (_activeGenreFilter) filtered = filtered.filter(r => (r.genre_tags||[]).includes(_activeGenreFilter));
      renderRooms(filtered);
    } catch(e){ console.error(e); }
  }

  function renderGenreFilters(roomList) {
    const allTags = new Set();
    roomList.forEach(r => (r.genre_tags || []).forEach(t => allTags.add(t)));
    const container = $('#genre-filters');
    if (!container) return;
    if (allTags.size === 0) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    container.innerHTML = `<button class="genre-chip${!_activeGenreFilter ? ' active' : ''}" data-genre="all">All</button>` +
      Array.from(allTags).sort().map(tag =>
        `<button class="genre-chip${_activeGenreFilter === tag ? ' active' : ''}" data-genre="${esc(tag)}">${esc(tag)}</button>`
      ).join('');
    container.querySelectorAll('.genre-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const genre = btn.dataset.genre;
        if (genre === 'all') {
          _activeGenreFilter = null;
          container.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } else if (_activeGenreFilter === genre) {
          _activeGenreFilter = null;
          btn.classList.remove('active');
          container.querySelector('[data-genre="all"]')?.classList.add('active');
        } else {
          _activeGenreFilter = genre;
          container.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        const q = $('#search-input').value.toLowerCase();
        let filtered = rooms;
        if (q) filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || (r.genre_tags||[]).some(t=>t.toLowerCase().includes(q)));
        if (_activeGenreFilter) filtered = filtered.filter(r => (r.genre_tags||[]).includes(_activeGenreFilter));
        renderRooms(filtered);
      });
    });
  }

  function renderRooms(list){
    const roomsCountEl = $('#rooms-count');
    if (roomsCountEl) roomsCountEl.textContent = `${list.length} room${list.length!==1?'s':''}`;
    const grid = $('#rooms-grid');
    const empty = $('#empty-state');
    if (!grid) return;
    if(!list.length){
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';
    
    grid.innerHTML = list.map(r => {
      const t = r.current_track;
      const coverUrl = t?.album_art_url || '/static/img/cover-banner.png';
      const trackName = t ? esc(t.track_name) : 'No track playing';
      const artistName = t ? esc(t.artist) : 'Idle Room';

      return `
      <div class="room-card" onclick="joinRoomAction('${esc(r.id)}')">
        <div class="room-card-cover-wrap">
          <img class="room-card-cover-img" src="${coverUrl}" onerror="this.src='/static/img/cover-banner.png'" alt="Album Art">
          <div class="room-card-cover-overlay">
            <div class="room-card-badge ${r.is_private ? 'private' : 'live'}">
              ${r.is_private ? '🔒 Private' : '● Live'}
            </div>
            <div class="room-card-listeners">
              <div class="listeners-dot"></div>
              <span>${r.listener_count ?? 0}</span>
            </div>
            ${t ? `
            <div class="room-card-eq-pill">
              <div class="card-now-playing-equalizer">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>` : ''}
            <div class="room-card-play-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        
        <div class="room-card-details">
          <div class="room-card-tags">
            ${(r.genre_tags||[]).slice(0, 3).map(tag=>`<span class="tag-chip">${esc(tag)}</span>`).join('')}
          </div>
          <h3 class="room-card-title">${esc(r.name)}</h3>
          <div class="room-card-host">
            ${r.host_avatar_url 
              ? `<img class="room-card-host-avatar" src="${esc(r.host_avatar_url)}" alt="${esc(r.host_name)}" />` 
              : `<div class="room-card-host-avatar-fallback" style="background:${nameColor(r.host_name || 'Unknown')}">${initials(r.host_name || 'Unknown')}</div>`}
            <span>Hosted by <strong>${esc(r.host_name||'Unknown')}</strong></span>
          </div>
        </div>
        
        <div class="room-card-now-playing-banner">
          <div class="banner-music-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <div class="banner-track-info">
            <span class="banner-track-name">${trackName}</span>
            <span class="banner-artist-name">${artistName}</span>
          </div>
        </div>
      </div>`;
    }).join('');

    // Trigger staggered springy cards load-in on render
    gsap.fromTo(".room-card", 
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.3)", stagger: 0.08 }
    );
  }

  // Search filter
  $('#search-input')?.addEventListener('input', e=>{
    const q = e.target.value.toLowerCase();
    let filtered = rooms.filter(r => r.name.toLowerCase().includes(q) || (r.genre_tags||[]).some(t=>t.toLowerCase().includes(q)));
    if (_activeGenreFilter) filtered = filtered.filter(r => (r.genre_tags||[]).includes(_activeGenreFilter));
    renderRooms(filtered);
  });

  // 4. Create Room Modal tags logic
  const selectedTags = new Set();
  $$('#tag-grid .tag').forEach(t=>{
    t.addEventListener('click', ()=>{
      const tag = t.dataset.tag;
      if(selectedTags.has(tag)){ selectedTags.delete(tag); t.classList.remove('active'); }
      else { if(selectedTags.size>=3) return toast('Max 3 tags','error'); selectedTags.add(tag); t.classList.add('active'); }
    });
  });

  const openCreateModal = () => {
    if(!me) {
      window.openCreateAfterJoin = true;
      window.targetRoomId = null;
      toast('Please set a display name first', 'info');
      $('#join-modal').classList.add('active');
      $('#join-name').focus();
      return;
    }
    $('#create-modal').classList.add('open');
  };
  $$('.btn-create-room-trigger').forEach(el => el.addEventListener('click', openCreateModal));
  $$('.btn-open-join-trigger').forEach(el => el.addEventListener('click', () => {
    window.targetRoomId = null;
    window.openCreateAfterJoin = false;
    $('#join-modal').classList.add('active');
    $('#join-name').focus();
  }));
  $('#create-private')?.addEventListener('change', (e) => {
    if(e.target.checked) {
      $('#create-password-wrapper').style.display = 'block';
      $('#create-password').focus();
    } else {
      $('#create-password-wrapper').style.display = 'none';
      $('#create-password').value = '';
    }
  });

  $('#btn-create-cancel')?.addEventListener('click', ()=>{
    $('#create-modal').classList.remove('open');
    $('#create-name').value=''; $('#create-desc').value='';
    $('#create-private').checked = false;
    $('#create-password-wrapper').style.display = 'none';
    $('#create-password').value = '';
    selectedTags.clear(); $$('#tag-grid .tag').forEach(t=>t.classList.remove('active'));
  });
  
  $('#btn-create-submit')?.addEventListener('click', async ()=>{
    const name = $('#create-name').value.trim();
    if(!name) return toast('Room name is required', 'error');

    if(!me) {
      window.openCreateAfterJoin = true;
      window.targetRoomId = null;
      toast('Please set a display name first to start a room', 'info');
      $('#join-modal').classList.add('active');
      $('#join-name').focus();
      return;
    }

    const btn = $('#btn-create-submit');
    const desc = $('#create-desc').value.trim();
    const mode = $('#create-mode').value;
    const isPrivate = $('#create-private').checked;
    const password = isPrivate ? $('#create-password').value.trim() : null;
    
    if(isPrivate && !password) return toast('Password is required for a private room', 'error');
    btn.disabled = true; btn.textContent = 'Creating...';
    
    try {
      const r = await fetch('/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description:desc, genre_tags:Array.from(selectedTags), queue_mode:mode, password }),
        credentials: 'include'
      });
      if(r.ok){
        const data = await r.json();
        location.href = `/room/${data.room.id}`;
      } else {
        const err = await r.json();
        throw new Error(err.detail || 'Failed to create room');
      }
    } catch(e){
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Start Jamming';
    }
  });

  // 3D Card Tilting & Shine Effects (via delegation on #rooms-grid)
  const roomsGrid = $('#rooms-grid');
  if (roomsGrid) {
    roomsGrid.addEventListener('mousemove', (e) => {
      // Avoid tilting on touch devices
      if (!window.matchMedia('(hover: hover)').matches) return;

      const card = e.target.closest('.room-card');
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const xc = rect.width / 2;
      const yc = rect.height / 2;
      
      // Calculate rotation limits (-8deg to 8deg)
      const rotateX = -(yc - y) / 12;
      const rotateY = (xc - x) / 12;

      card.style.setProperty('transform', `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`, 'important');

      // Add dynamic shine flare inside card
      let shine = card.querySelector('.card-shine');
      if (!shine) {
        shine = document.createElement('div');
        shine.className = 'card-shine';
        card.appendChild(shine);
      }
      const pctX = (x / rect.width) * 100;
      const pctY = (y / rect.height) * 100;
      shine.style.background = `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 60%)`;
    });

    roomsGrid.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.room-card');
      if (!card) return;

      const related = e.relatedTarget;
      if (related && card.contains(related)) return;

      card.style.removeProperty('transform');
      const shine = card.querySelector('.card-shine');
      if (shine) shine.remove();
    });
  }

  // Let's go
  await checkAuth();
  await loadRooms();

  // Trigger entrance animations
  Motion.entrance('.hero-badge', 'fade-up', 0.05);
  Motion.entrance('.hero-title', 'fade-up', 0.1);
  Motion.entrance('.hero-sub', 'fade-up', 0.15);
  Motion.entrance('.hero-actions', 'fade-up', 0.2);
  Motion.entrance('.hero-player-card', 'pop', 0.35);

  // Trigger features entrance
  Motion.entrance('.features-badge', 'fade-up', 0.1);
  Motion.entrance('.features-title', 'fade-up', 0.15);
  Motion.entrance('.features-subtitle', 'fade-up', 0.2);
  Motion.entrance('.feature-card', 'pop', 0.08);

  // Scroll reveal Intersection Observer for active rooms section
  if ('IntersectionObserver' in window) {
    const scrollRevealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target;
          gsap.fromTo(target, 
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", clearProps: "all" }
          );
          observer.unobserve(target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    ['.rooms-section-header', '.search-wrap', '#genre-filters'].forEach(sel => {
      const el = $(sel);
      if (el) {
        gsap.set(el, { opacity: 0, y: 30 });
        scrollRevealObserver.observe(el);
      }
    });
  }


  // Initialize Interactive Tonearm Web Audio Jam
  try {
    initInteractiveTonearm();
  } catch (err) {
    console.error('[openjam] Error initializing interactive tonearm:', err);
  }

  // Refresh rooms periodically — only when tab is visible
  let _roomPollId = setInterval(loadRooms, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(_roomPollId);
    } else {
      loadRooms(); // Immediate refresh on tab focus
      _roomPollId = setInterval(loadRooms, 15000);
    }
  });

    // Interactive Vinyl Tonearm Drag & Play with Web Audio
  function initInteractiveTonearm() {
    const arm = document.querySelector('.hero-tonearm');
    const card = document.querySelector('.hero-player-card');
    const disc = document.querySelector('.hero-vinyl-disc');
    const indicator = document.querySelector('.live-indicator');
    const tip = document.querySelector('.arm-tip');
    const eqBars = document.querySelectorAll('.hero-eq-waves .eq-bar');
    if (!arm || !card || !disc) return;

    let isPlaying = false;
    let isDragging = false;
    let currentAngle = 22; // starting angle in degrees
    let audioCtx = null;
    let analyser = null;
    let visualizerId = null;
    let noiseNode = null;
    let chordsInterval = null;

    // A. 3D Hover Tilt removed


    // B. Platter Loop spin driven by GSAP loop
    // Infinite loop tween
    const spinTween = gsap.to(disc, {
      rotation: 360,
      duration: 8,
      repeat: -1,
      ease: "none",
      paused: true
    });
    // Set timeScale to 0 initially
    spinTween.timeScale(0);
    spinTween.play();

    // Origin point of the tonearm rotation
    function getArmOrigin() {
      const rect = arm.getBoundingClientRect();
      return {
        x: window.scrollX + rect.left + 15,
        y: window.scrollY + rect.top + 15
      };
    }

    // Set angle of arm
    function setArmAngle(deg) {
      currentAngle = Math.max(15, Math.min(45, deg));
      gsap.set(arm, { rotation: currentAngle });
    }

    // Toggle arm state
    function togglePlay(play) {
      isPlaying = play;
      if (isPlaying) {
        arm.classList.add('playing');
        
        // Elastic swing transition onto record using GSAP
        gsap.to(arm, {
          rotation: 38,
          duration: 0.8,
          ease: "elastic.out(1.1, 0.5)",
          overwrite: "auto",
          onComplete: () => { currentAngle = 38; }
        });

        // Platter Spin-Up acceleration transition
        gsap.to(spinTween, { timeScale: 1, duration: 1.8, ease: "power1.in" });

        if (tip) {
          tip.textContent = "Click arm to stop jam";
          tip.style.borderColor = "rgba(16, 185, 129, 0.4)";
          tip.style.color = "var(--green)";
        }
        if (indicator) {
          indicator.innerHTML = '<span class="live-dot" style="background:var(--green);box-shadow:0 0 8px var(--green)"></span>SOLO JAMMING';
          indicator.style.color = "var(--green)";
          indicator.style.background = "rgba(16, 185, 129, 0.08)";
          indicator.style.borderColor = "rgba(16, 185, 129, 0.2)";
        }
        startAudio();
      } else {
        arm.classList.remove('playing');
        
        // Elastic swing off record back to rest using GSAP
        gsap.to(arm, {
          rotation: 22,
          duration: 0.6,
          ease: "back.out(1.6)",
          overwrite: "auto",
          onComplete: () => { currentAngle = 22; }
        });

        // Platter Spin-Down deceleration transition (inertia)
        gsap.to(spinTween, { timeScale: 0, duration: 3.2, ease: "power2.out" });

        if (tip) {
          tip.textContent = "Drag needle to play preview";
          tip.style.borderColor = "rgba(212, 175, 55, 0.2)";
          tip.style.color = "var(--text-3)";
        }
        if (indicator) {
          indicator.innerHTML = '<span class="live-dot"></span>LIVE SYNC';
          indicator.style.color = "";
          indicator.style.background = "";
          indicator.style.borderColor = "";
        }
        stopAudio();
      }
    }

    // Web Audio System
    function startAudio() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Master Gain
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      masterGain.connect(analyser);

      // Create White Noise buffer for dust crackles
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Bandpass Filter crackles
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1000, audioCtx.currentTime);
      noiseFilter.Q.setValueAtTime(1.2, audioCtx.currentTime);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.015, audioCtx.currentTime);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      whiteNoise.start(0);
      noiseNode = { source: whiteNoise, gain: noiseGain };

      // Chords looping
      const chords = [
        [220.00, 261.63, 329.63, 392.00], // Am7
        [146.83, 349.23, 440.00, 523.25], // Dm7
        [98.00, 246.94, 293.66, 369.99],  // Gmaj7
        [130.81, 329.63, 392.00, 493.88]  // Cmaj7
      ];

      let chordIdx = 0;

      function playChord(frequencies) {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        const now = audioCtx.currentTime;
        frequencies.forEach(freq => {
          const osc = audioCtx.createOscillator();
          const oscGain = audioCtx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 1.5, now);

          oscGain.gain.setValueAtTime(0, now);
          oscGain.gain.linearRampToValueAtTime(0.12, now + 0.6);
          oscGain.gain.exponentialRampToValueAtTime(0.06, now + 2.5);
          oscGain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

          osc.connect(oscGain);
          oscGain.connect(masterGain);

          osc.start(now);
          osc.stop(now + 4);
        });

        // Soft kick
        playKick(now);
        playKick(now + 2.0);

        // Soft hat
        playHat(now + 1.0);
        playHat(now + 3.0);
      }

      function playKick(time) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(masterGain);

        osc.frequency.setValueAtTime(110, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);

        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

        osc.start(time);
        osc.stop(time + 0.25);
      }

      function playHat(time) {
        if (!audioCtx) return;
        const src = audioCtx.createBufferSource();
        src.buffer = noiseBuffer;

        const flt = audioCtx.createBiquadFilter();
        flt.type = 'highpass';
        flt.frequency.setValueAtTime(7000, time);

        const gn = audioCtx.createGain();
        gn.gain.setValueAtTime(0.012, time);
        gn.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        src.connect(flt);
        flt.connect(gn);
        gn.connect(masterGain);

        src.start(time);
        src.stop(time + 0.12);
      }

      playChord(chords[chordIdx]);
      chordIdx = (chordIdx + 1) % chords.length;

      chordsInterval = setInterval(() => {
        if (audioCtx && audioCtx.state !== 'suspended') {
          playChord(chords[chordIdx]);
          chordIdx = (chordIdx + 1) % chords.length;
        }
      }, 4000);

      startVisualizer();
    }

    function stopAudio() {
      if (chordsInterval) {
        clearInterval(chordsInterval);
        chordsInterval = null;
      }
      if (noiseNode) {
        try { noiseNode.source.stop(); } catch(e){}
        noiseNode = null;
      }
      if (visualizerId) {
        cancelAnimationFrame(visualizerId);
        visualizerId = null;
      }
      if (audioCtx) {
        audioCtx.suspend();
      }
      eqBars.forEach((bar) => {
        bar.style.transform = '';
      });
    }

    // VU Peak decay exponential filter
    function startVisualizer() {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const smoothedValues = new Array(eqBars.length).fill(0.15);

      function draw() {
        if (!isPlaying || !analyser) return;
        visualizerId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        eqBars.forEach((bar, idx) => {
          const val = dataArray[idx % dataArray.length] / 255;
          const targetScale = Math.max(0.15, Math.min(1.0, val * 2.2));
          
          // Fast rise, slow decay analog filtering
          if (targetScale > smoothedValues[idx]) {
            smoothedValues[idx] = targetScale;
          } else {
            smoothedValues[idx] += (targetScale - smoothedValues[idx]) * 0.16;
          }
          
          bar.style.transform = `scaleY(${smoothedValues[idx]})`;
        });
      }
      draw();
    }

    // Drag-drop implementation
    let startX = 0, startY = 0, startAngle = 22;

    function onMouseDown(e) {
      e.preventDefault();
      isDragging = true;
      arm.classList.add('dragging');
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const origin = getArmOrigin();
      startX = clientX - origin.x;
      startY = clientY - origin.y;
      startAngle = Math.atan2(startY, startX) * (180 / Math.PI);
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('touchmove', onMouseMove, { passive: false });
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchend', onMouseUp);
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const origin = getArmOrigin();
      const curX = clientX - origin.x;
      const curY = clientY - origin.y;
      const curAngle = Math.atan2(curY, curX) * (180 / Math.PI);
      
      const angleDiff = curAngle - startAngle;
      let targetAngle = currentAngle + angleDiff;
      
      targetAngle = Math.max(15, Math.min(45, targetAngle));
      setArmAngle(targetAngle);
      
      if (targetAngle > 29 && !isPlaying) {
        togglePlay(true);
      } else if (targetAngle <= 29 && isPlaying) {
        togglePlay(false);
      }
      
      startAngle = curAngle;
    }

    function onMouseUp(e) {
      if (!isDragging) return;
      isDragging = false;
      arm.classList.remove('dragging');
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchend', onMouseUp);

      if (currentAngle > 29) {
        togglePlay(true);
      } else {
        togglePlay(false);
      }
    }

    arm.addEventListener('click', (e) => {
      if (isDragging) return;
      togglePlay(!isPlaying);
    });

    arm.addEventListener('mousedown', onMouseDown);
    arm.addEventListener('touchstart', onMouseDown, { passive: false });
  }

  // PWA install + service worker
  setupPwaInstallBanner();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[openjam] Service Worker registered:', reg.scope))
      .catch(err => console.error('[openjam] Service Worker registration failed:', err));
  }
})();

