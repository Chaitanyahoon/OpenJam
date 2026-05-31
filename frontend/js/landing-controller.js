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
      $('#nav-avatar').textContent = initials(me.display_name);
      $('#nav-name').textContent = me.display_name;
      $('#navbar-user').style.display = 'flex';
      $$('.btn-open-join-trigger').forEach(el => el.style.display = 'none');
      $$('.btn-create-room-trigger').forEach(el => el.style.display = 'inline-flex');
    } else {
      $('#join-modal').classList.remove('active');
      $('#navbar-user').style.display = 'none';
      $$('.btn-open-join-trigger').forEach(el => el.style.display = 'inline-flex');
      $$('.btn-create-room-trigger').forEach(el => el.style.display = 'none');
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
  $('#btn-join-random')?.addEventListener('click', () => {
    const randomName = generateRandomName();
    $('#join-name').value = randomName;
    $('#btn-join').click();
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
      const trackHtml = t 
        ? `<div class="room-card-track-wrap">
             <div class="room-card-track-bg" style="background-image: url('${t.album_art_url||''}')"></div>
             <div class="room-card-track">
               <img class="room-card-art" src="${t.album_art_url||''}" onerror="this.src=''">
               <div style="min-width:0;flex:1;z-index:2;">
                 <div class="room-card-track-name">${esc(t.track_name)}</div>
                 <div class="room-card-track-artist">${esc(t.artist)}</div>
               </div>
             </div>
           </div>`
        : `<div class="room-card-idle">No track playing</div>`;

      return `
      <div class="room-card" onclick="joinRoomAction('${esc(r.id)}')">
        <div class="room-card-top">
          <div style="min-width:0">
            <div class="room-card-name">${r.is_private ? '<span style="color:var(--amber);margin-right:6px;" title="Private room">🔒</span>' : ''}${esc(r.name)}</div>
            <div class="room-card-host">Hosted by ${esc(r.host_name||'Unknown')}</div>
          </div>
          <div class="room-listeners${r.listener_count > 0 ? ' pulse-listeners' : ''}">
            <div class="room-listeners-dot"></div>
            <span>${r.listener_count ?? 0}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="opacity:.7"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
          </div>
        </div>
        <div class="room-card-tags">
          ${(r.genre_tags||[]).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}
        </div>
        ${trackHtml}
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
  Motion.entrance('.hero-title', 'fade-up');
  Motion.entrance('.hero-sub', 'fade-up', 0.2);
  Motion.entrance('.search-wrap', 'fade-up', 0.3);

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

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[openjam] Service Worker registered:', reg.scope))
      .catch(err => console.error('[openjam] Service Worker registration failed:', err));
  }
})();
