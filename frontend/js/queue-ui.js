/* ==========================================================================
   OPEN JAM — Queue UI Module
   Manages queue rendering, search listbox options, drag/touch reordering, and bulk imports.
   ========================================================================== */

(function() {
  // Global hook to render the queue
  window.renderQueue = function(q) {
    const app = window.roomApp;
    if (!app) return;
    app._queueData = q || [];
    const list = $('#queue-list');
    if (!list) return;
    const allItems = (q||[]).filter(i => i.status !== 'played');
    $('#q-count').textContent = `${allItems.length} track${allItems.length !== 1 ? 's' : ''}`;

    if (!allItems.length) {
      list.innerHTML = `
        <div class="room-help-banner" id="room-help-banner">
          <div class="help-title">Need a quick start?</div>
          <div class="help-copy">Search for a song, then tap the + button to add it to the queue. The room will play together for everyone instantly.</div>
          <button class="btn btn-secondary btn-help" onclick="showRoomHelp()">Show me how</button>
        </div>
        <div class="empty" id="q-empty">
          <svg class="empty-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
          <div class="empty-title">Queue is empty</div>
          <div class="empty-sub">Search above to add a track</div>
        </div>`;
      return;
    }

    const playing = allItems.filter(i => i.status === 'playing');
    const queued  = allItems.filter(i => i.status !== 'playing');
    const ordered = [...playing, ...queued];

    list.innerHTML = ordered.map((item, idx) => {
      const isPlaying = item.status === 'playing';
      const voted = app.me && (item.voter_ids || []).includes(app.me.id);
      const qNum = isPlaying ? '' : `#${idx - playing.length + 1}`;
      const dur  = item.duration_ms > 0 ? fmt(item.duration_ms) : '';
      const art  = item.album_art_url || '';
      
      const dragAttr = (app.isHost && !isPlaying) ? ' draggable="true"' : '';
      const dragHandle = (app.isHost && !isPlaying) ? `<span class="drag-handle" style="cursor:grab; margin-right:8px; font-weight:bold; color:var(--text-muted); font-size:16px;" title="Drag to reorder">≡</span>` : '';

      return `
      <div class="queue-item${isPlaying ? ' playing' : ''}" data-id="${esc(item.id)}"${dragAttr}>
        ${dragHandle}
        <img class="queue-item-art" src="${esc(art)}" alt="" onerror="this.src=''">
        <div class="queue-item-info">
          <div class="queue-item-name">${esc(item.track_name || 'Unknown')}</div>
          <div class="queue-item-artist">${esc(item.artist || '')}</div>
          <div class="queue-item-meta">
            ${isPlaying
              ? `<span class="queue-now-badge">&#9654; NOW PLAYING</span>`
              : `<span class="queue-item-num">${qNum}</span>`}
            ${dur ? `<span class="queue-item-dur">${dur}</span>` : ''}
            <span class="queue-item-by">${esc(item.added_by_name || 'Unknown')}</span>
          </div>
        </div>
        ${isPlaying
          ? `<div class="eq"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
          : `<button type="button" class="vote-btn${voted ? ' voted' : ''}" onclick="doVote('${esc(item.id)}')" ${voted ? 'disabled' : ''}
               aria-label="${voted ? 'Already voted' : 'Vote to bump this track'}" title="${voted ? 'You already voted' : 'Vote to bump this track'}">
               <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l7 7H5z"/></svg>
               ${item.votes || 0}
             </button>
             ${app.isHost ? `<button type="button" class="remove-btn" onclick="doRemove('${esc(item.id)}')" title="Remove from queue" aria-label="Remove track">
               <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
             </button>` : ''}`}
      </div>`;
    }).join('');
  };

  window.doVote = id => {
    const app = window.roomApp;
    if (app && app.sc) app.sc.emit('vote_track', { room_id: app.roomId, queue_item_id: id });
  };
  
  window.doRemove = id => {
    const app = window.roomApp;
    if (app && app.isHost && app.sc) {
      app.sc.emit('remove_from_queue', { room_id: app.roomId, queue_item_id: id });
    }
  };

  window.checkQueuePermissions = function() {
    const app = window.roomApp;
    if (!app) return;
    if (!app.isHost && app.roomData?.room?.queue_mode === 'curated') {
      const wrap = $('#q-search-wrap');
      if (wrap) {
        wrap.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-3);font-size:13px;background:var(--bg-elevated);border-radius:var(--r-md);">
          <div style="font-size:24px;margin-bottom:4px">🔒</div>
          The host has locked the queue
        </div>`;
      }
    }
  };

  // Helper search API fetching routines
  async function searchTracks(q) {
    const r = await fetch(`/search/tracks?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    if (!r.ok) return [];
    return (await r.json()).tracks || [];
  }

  async function resolveYTServerSide(query) {
    try {
      const r = await fetch(`/search/resolve?q=${encodeURIComponent(query)}`, { credentials: 'include' });
      if (!r.ok) return null;
      const d = await r.json();
      return d.video_id || null;
    } catch(e) { return null; }
  }

  async function loadRecommendations() {
    try {
      const r = await fetch('/search/recommendations', { credentials: 'include' });
      if (!r.ok) return [];
      return (await r.json()).tracks || [];
    } catch(e) { return []; }
  }

  const srEl = $('#search-results');
  const qSearch = $('#q-search');

  function renderSearchResults(tracks, label = '') {
    if (!tracks.length) {
      srEl.innerHTML = `<div class="search-results empty">
        <div style="font-size:24px;margin-bottom:6px">🔍</div>No results found
      </div>`;
      srEl.classList.add('open');
      return;
    }
    const htmlStr = tracks.map(t => `
      <div class="search-result-item" role="option"
        data-uri="${esc(t.uri)}" data-name="${esc(t.name)}" data-artist="${esc(t.artist)}"
        data-art="${esc(t.album_art_url||'')}" data-dur="${t.duration_ms||0}">
        <img class="search-result-art" src="${esc(t.album_art_url||'')}" alt="" onerror="this.style.display='none'">
        <div class="search-result-info">
          <div class="search-result-name">${esc(t.name)}</div>
          <div class="search-result-artist">${esc(t.artist)}</div>
          ${t.duration_ms ? `<div class="search-result-duration">${fmt(t.duration_ms)}</div>` : ''}
        </div>
        <button type="button" class="add-btn" title="Add this track to the queue" aria-label="Add ${esc(t.name)} to queue">+</button>
      </div>`).join('');

    if (label) {
      srEl.innerHTML = `<div style="padding:8px 14px 4px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--amber);opacity:0.7">${label}</div>` + htmlStr;
    } else {
      srEl.innerHTML = htmlStr;
    }
    srEl.classList.add('open');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const app = window.roomApp;

    // Delegate Click handlers for search result listbox item
    srEl.addEventListener('click', async (e) => {
      if (app.yt && app.yt.unlockAudioContext) app.yt.unlockAudioContext();

      const item = e.target.closest('.search-result-item');
      const addBtn = e.target.closest('.add-btn');
      if (!item) return;

      if (addBtn) {
        addBtn.disabled = true;
        addBtn.classList.add('adding');
        addBtn.textContent = '✓';
      }

      srEl.classList.remove('open');
      qSearch.value = '';

      srEl.innerHTML = `<div class="search-results loading">
        <span class="search-loading-spinner"></span>
        Finding on YouTube…
      </div>`;
      srEl.classList.add('open');

      const vid = await resolveYTServerSide(item.dataset.uri);
      srEl.classList.remove('open');

      if (!vid) {
        if (addBtn) {
          addBtn.disabled = false;
          addBtn.classList.remove('adding');
          addBtn.textContent = '+';
        }
        toast('Not found on YouTube — try a different search 🙄', 'error');
        return;
      }

      app.sc.emit('add_to_queue', {
        room_id: app.roomId,
        track_uri: vid,
        track_name: item.dataset.name,
        artist: item.dataset.artist,
        album_art_url: item.dataset.art,
        duration_ms: parseInt(item.dataset.dur) || 0
      });

      toast(`➕ Queued: ${item.dataset.name}`, 'success');
    });

    // Trending recommendations triggers
    qSearch?.addEventListener('focus', async () => {
      if (qSearch.value.trim()) return;
      const recs = await loadRecommendations();
      if (recs.length) renderSearchResults(recs, '🔥 Trending Now');
    });

    // Debounced search queries + Direct link intercepts
    qSearch?.addEventListener('input', debounce(async e => {
      const q = e.target.value.trim();
      $('#q-clear').style.display = q ? 'flex' : 'none';
      if (!q) {
        const recs = await loadRecommendations();
        if (recs.length) renderSearchResults(recs, '🔥 Trending Now');
        else srEl.classList.remove('open');
        return;
      }

      const ytMatch = q.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      const ytId = ytMatch ? ytMatch[1] : null;
      if (ytId) {
        srEl.innerHTML = `<div class="search-results loading">
          <span class="search-loading-spinner"></span>
          Resolving YouTube URL…
        </div>`;
        srEl.classList.add('open');
        
        let name = 'YouTube Video';
        let artist = 'YouTube';
        try {
          const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
          if (res.ok) {
            const d = await res.json();
            name = d.title || name;
            artist = d.author_name || artist;
          }
        } catch(err) {}

        qSearch.value = '';
        $('#q-clear').style.display = 'none';
        srEl.classList.remove('open');

        app.sc.emit('add_to_queue', {
          room_id: app.roomId,
          track_uri: ytId,
          track_name: name,
          artist: artist,
          album_art_url: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          duration_ms: 0
        });
        toast(`➕ Queued Direct Link: ${name}`, 'success');
        return;
      }

      srEl.innerHTML = `<div class="search-results loading">
        <span class="search-loading-spinner"></span>
        Searching…
      </div>`;
      srEl.classList.add('open');
      const tracks = await searchTracks(q);
      renderSearchResults(tracks);
    }, 350));

    $('#q-clear')?.addEventListener('click', () => {
      qSearch.value = '';
      $('#q-clear').style.display = 'none';
      srEl.classList.remove('open');
      qSearch.dispatchEvent(new Event('input'));
    });

    document.addEventListener('click', e => { if (!e.target.closest('#q-search-wrap')) srEl.classList.remove('open'); });

    // Bulk Import setup
    $('#btn-import')?.addEventListener('click', () => {
      const m = $('#modal-import');
      if (m) {
        m.style.display = 'flex';
        m.classList.add('open');
        const modalBox = m.querySelector('.modal-box');
        if (modalBox && window.gsap) {
          window.gsap.fromTo(modalBox, 
            { scale: 0.85, y: 30, opacity: 0 },
            { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
          );
        }
      }
    });

    $('#btn-do-import')?.addEventListener('click', async () => {
      if (app.yt && app.yt.unlockAudioContext) app.yt.unlockAudioContext();
      const text = $('#import-text').value.trim();
      if (!text) return;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      
      const importModal = $('#modal-import');
      if (importModal) { importModal.classList.remove('open'); importModal.style.display = 'none'; }
      $('#import-text').value = '';
      
      toast(`Processing import request...`, 'info');
      let addedCount = 0;
      
      for (const query of lines) {
        const isPlaylist = (query.includes('spotify.com') && query.includes('/playlist/')) ||
                           (query.includes('youtube.com') && query.includes('list=')) ||
                           (query.includes('youtu.be') && query.includes('list='));
                           
        if (isPlaylist) {
          toast(`Fetching playlist tracks...`, 'info');
          try {
            const r = await fetch(`/search/playlist?url=${encodeURIComponent(query)}`, { credentials: 'include' });
            if (r.ok) {
              const data = await r.json();
              const playlistTracks = data.tracks || [];
              if (playlistTracks.length > 0) {
                toast(`Found ${playlistTracks.length} tracks in playlist. Resolving and adding...`, 'info');
                for (const track of playlistTracks) {
                  let vid = null;
                  if (track.uri && track.uri.length === 11) vid = track.uri;
                  else vid = await resolveYTServerSide(track.uri || `${track.name} ${track.artist}`);
                  
                  if (vid) {
                    app.sc.emit('add_to_queue', {
                      room_id: app.roomId,
                      track_uri: vid,
                      track_name: track.name,
                      artist: track.artist,
                      album_art_url: track.album_art_url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
                      duration_ms: track.duration_ms || 0
                    });
                    addedCount++;
                  }
                }
              }
            } else { toast('Failed to load playlist tracks.', 'error'); }
          } catch(e) { toast('Error importing playlist: ' + e.message, 'error'); }
        } else {
          try {
            const r = await fetch(`/search/tracks?q=${encodeURIComponent(query)}`, { credentials: 'include' });
            if (!r.ok) continue;
            const data = await r.json();
            const results = data.tracks;
            if (results && results.length > 0) {
              const item = results[0];
              const vid = await resolveYTServerSide(item.uri);
              if (vid) {
                app.sc.emit('add_to_queue', {
                  room_id: app.roomId,
                  track_uri: vid,
                  track_name: item.name,
                  artist: item.artist,
                  album_art_url: item.album_art_url,
                  duration_ms: item.duration_ms || 0
                });
                addedCount++;
              }
            }
          } catch(e) {}
        }
      }
      if (addedCount > 0) toast(`Bulk import complete! Added ${addedCount} tracks.`, 'success');
      else toast('Failed to import any tracks. Try again.', 'error');
    });

    // Drag-and-Drop Queue Reordering engine setup
    (function setupDragAndDrop() {
      const list = $('#queue-list');
      if (!list) return;
      
      let draggedId = null;
      let draggedElement = null;

      list.addEventListener('dragstart', (e) => {
        if (!app.isHost) return;
        const item = e.target.closest('.queue-item');
        if (!item || item.classList.contains('playing')) {
          e.preventDefault();
          return;
        }
        draggedId = item.dataset.id;
        draggedElement = item;
        e.dataTransfer.setData('text/plain', draggedId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
      });

      list.addEventListener('dragover', (e) => {
        if (!app.isHost || !draggedId) return;
        const item = e.target.closest('.queue-item');
        if (!item || item.classList.contains('playing') || item === draggedElement) return;
        e.preventDefault();
        
        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        list.querySelectorAll('.queue-item').forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after');
        });

        if (e.clientY < midpoint) item.classList.add('drag-over-before');
        else item.classList.add('drag-over-after');
      });

      list.addEventListener('dragleave', (e) => {
        const item = e.target.closest('.queue-item');
        if (item) item.classList.remove('drag-over-before', 'drag-over-after');
      });

      list.addEventListener('dragend', () => {
        if (draggedElement) draggedElement.classList.remove('dragging');
        list.querySelectorAll('.queue-item').forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after');
        });
        draggedId = null;
        draggedElement = null;
      });

      list.addEventListener('drop', (e) => {
        if (!app.isHost || !draggedId) return;
        e.preventDefault();
        
        const targetItem = e.target.closest('.queue-item');
        if (!targetItem || targetItem.classList.contains('playing') || targetItem === draggedElement) return;

        const targetId = targetItem.dataset.id;
        const isBefore = targetItem.classList.contains('drag-over-before');

        list.querySelectorAll('.queue-item').forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after');
        });

        performReorder(draggedId, targetId, isBefore);
      });

      function performReorder(dId, tId, isBefore) {
        const pendingItems = app._queueData.filter(i => i.status === 'pending');
        const playingItems = app._queueData.filter(i => i.status === 'playing');

        const draggedIndex = pendingItems.findIndex(i => i.id === dId);
        const targetIndex = pendingItems.findIndex(i => i.id === tId);

        if (draggedIndex === -1 || targetIndex === -1) return;
        const [movedItem] = pendingItems.splice(draggedIndex, 1);

        let insertIndex = targetIndex;
        if (!isBefore && draggedIndex > targetIndex) insertIndex += 1;
        else if (!isBefore) insertIndex += 1;

        pendingItems.splice(insertIndex, 0, movedItem);

        const orderedIds = pendingItems.map(i => i.id);
        const newQueue = [...playingItems, ...pendingItems];
        renderQueue(newQueue);

        app.sc.emit('reorder_queue', { ordered_ids: orderedIds });
      }

      // Mobile touch-drag handling
      let touchDraggedId = null;
      let touchDraggedElement = null;

      list.addEventListener('touchstart', (e) => {
        if (!app.isHost) return;
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        
        const item = handle.closest('.queue-item');
        if (!item || item.classList.contains('playing')) return;

        touchDraggedId = item.dataset.id;
        touchDraggedElement = item;
        touchDraggedElement.classList.add('dragging');
      }, { passive: true });

      list.addEventListener('touchmove', (e) => {
        if (!app.isHost || !touchDraggedElement) return;

        const touch = e.touches[0];
        const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
        const item = targetEl ? targetEl.closest('.queue-item') : null;

        if (e.cancelable) e.preventDefault();

        list.querySelectorAll('.queue-item').forEach(el => {
          if (el !== item) el.classList.remove('drag-over-before', 'drag-over-after');
        });

        if (!item || item.classList.contains('playing') || item === touchDraggedElement) return;

        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (touch.clientY < midpoint) {
          item.classList.remove('drag-over-after');
          item.classList.add('drag-over-before');
        } else {
          item.classList.remove('drag-over-before');
          item.classList.add('drag-over-after');
        }
      }, { passive: false });

      list.addEventListener('touchend', (e) => {
        if (!app.isHost || !touchDraggedElement) return;

        const touch = e.changedTouches[0];
        const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetItem = targetEl ? targetEl.closest('.queue-item') : null;

        touchDraggedElement.classList.remove('dragging');

        list.querySelectorAll('.queue-item').forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after');
        });

        if (targetItem && !targetItem.classList.contains('playing') && targetItem !== touchDraggedElement) {
          const rect = targetItem.getBoundingClientRect();
          const isBefore = touch.clientY < (rect.top + rect.height / 2);
          performReorder(touchDraggedId, targetItem.dataset.id, isBefore);
        }

        touchDraggedId = null;
        touchDraggedElement = null;
      }, { passive: true });

      list.addEventListener('touchcancel', () => {
        if (touchDraggedElement) touchDraggedElement.classList.remove('dragging');
        list.querySelectorAll('.queue-item').forEach(el => {
          el.classList.remove('drag-over-before', 'drag-over-after');
        });
        touchDraggedId = null;
        touchDraggedElement = null;
      }, { passive: true });
    })();

    // Queue poll fallback logic when socket drops
    let _lastQueueLen = -1;
    setInterval(async () => {
      if (app.sc?.socket?.connected) return;
      try {
        const r = await fetch(`/queue/${app.roomId}`, { credentials: 'include' });
        if (!r.ok) return;
        const d = await r.json();
        if (!Array.isArray(d.queue)) return;
        const fresh = d.queue.filter(i => i.status !== 'played');
        if (fresh.length !== _lastQueueLen) {
          _lastQueueLen = fresh.length;
          renderQueue(d.queue);
        }
      } catch(_) {}
    }, 3000);
  });
})();
