/* ========================================
   OPEN JAM — Home Page Controller
   Anonymous join flow, no OAuth
   ======================================== */

(async function () {
  let currentUser = null;
  let selectedTags = [];

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  // ---- Anonymous Auth Flow ----
  async function checkAuth() {
    try {
      const data = await API.getCurrentUser();
      currentUser = data.user;
    } catch {
      currentUser = null;
    }

    if (currentUser) {
      showUserInNav(currentUser.display_name);
      hideNamePrompt();
    } else {
      // Check localStorage for saved name — re-join silently
      const savedName = localStorage.getItem('openjam_display_name');
      if (savedName) {
        try {
          const data = await API.join(savedName);
          currentUser = data.user;
          showUserInNav(currentUser.display_name);
          hideNamePrompt();
        } catch {
          showNamePrompt();
        }
      } else {
        showNamePrompt();
      }
    }
  }

  function showUserInNav(name) {
    $('#navbar-user').style.display = 'flex';
    $('#navbar-username').textContent = name;
    $('#navbar-avatar').textContent = getInitials(name);
    $('#btn-create-room').style.display = 'inline-flex';
  }

  function showNamePrompt() {
    const modal = $('#name-prompt-modal');
    if (modal) modal.classList.add('active');
  }

  function hideNamePrompt() {
    const modal = $('#name-prompt-modal');
    if (modal) modal.classList.remove('active');
  }

  // ---- Name Prompt Submit ----
  const enterBtn = $('#btn-enter-jam');
  const nameInput = $('#display-name-input');

  if (enterBtn) {
    enterBtn.addEventListener('click', () => submitName());
  }
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitName();
    });
    // Auto-focus
    setTimeout(() => nameInput.focus(), 100);
  }

  async function submitName() {
    const name = (nameInput?.value || '').trim();
    if (!name) {
      showToast('Please enter a display name', 'error');
      return;
    }
    try {
      enterBtn.disabled = true;
      enterBtn.textContent = 'Joining...';
      const data = await API.join(name);
      currentUser = data.user;
      localStorage.setItem('openjam_display_name', name);
      showUserInNav(name);
      hideNamePrompt();
      showToast(`Welcome, ${name}!`, 'success');
    } catch (err) {
      showToast('Failed to join. Try again.', 'error');
    } finally {
      enterBtn.disabled = false;
      enterBtn.textContent = 'Enter the Jam';
    }
  }

  // ---- Logout ----
  const logoutBtn = $('#btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => API.logout());
  }

  // ---- Load Rooms ----
  async function loadRooms(search = '') {
    try {
      const data = await API.getRooms(search);
      renderRooms(data.rooms);
    } catch {
      showToast('Failed to load rooms', 'error');
    }
  }

  function renderRooms(rooms) {
    const grid = $('#rooms-grid');
    const empty = $('#empty-state');
    const count = $('#rooms-count');

    count.textContent = `${rooms.length} room${rooms.length !== 1 ? 's' : ''}`;

    if (rooms.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }

    empty.style.display = 'none';
    grid.innerHTML = rooms.map(room => {
      const tags = (room.genre_tags || []).map(t =>
        `<span class="tag">${escapeHtml(t)}</span>`
      ).join('');

      const modeLabel = room.queue_mode === 'curated' ? 'DJ Only' : 'Open Party';
      const modeClass = room.queue_mode === 'curated' ? 'badge-curated' : 'badge-open';
      const statusBadge = `
        <div class="room-card-meta">
          <span class="room-card-badge ${modeClass}">${modeLabel}</span>
          <span class="room-card-vibe">${((room.genre_tags || []).slice(0,2).map(escapeHtml).join(' · ') || 'Eclectic mix')}</span>
        </div>`;

      const np = room.current_track;
      const nowPlaying = np ? `
        <div class="room-card-now-playing${np.status === 'playing' ? ' playing' : ''}">
          <img class="room-card-album-art" src="${np.album_art_url || ''}" alt="Album art" onerror="this.style.display='none'">
          <div class="room-card-track-info">
            <div class="room-card-track-head">
              <div class="room-card-track-name">${escapeHtml(np.track_name)}</div>
              ${np.status === 'playing' ? `<span class="room-card-now-badge">Now Playing</span>` : ''}
            </div>
            <div class="room-card-track-artist">${escapeHtml(np.artist)}</div>
            ${np.duration_ms ? `<div class="room-card-track-meta">${formatDuration(np.duration_ms)}</div>` : ''}
          </div>
        </div>` : `
        <div class="room-card-idle">No track playing</div>`;

      return `
        <div class="room-card" onclick="window.location.href='/room/${room.id}'">
          <div class="room-card-header">
            <div>
              <div class="room-card-title">${escapeHtml(room.name)}</div>
              <div class="room-card-host">Hosted by ${escapeHtml(room.host_name || 'Unknown')}</div>
            </div>
            <div class="room-card-listeners">${room.listener_count}</div>
          </div>
          ${statusBadge}
          ${tags ? `<div class="room-card-tags">${tags}</div>` : ''}
          ${nowPlaying}
        </div>`;
    }).join('');
  }

  // ---- Search ----
  const searchInput = $('#search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      loadRooms(e.target.value);
    }, 300));
  }

  // ---- Create Room Modal ----
  const modal = $('#create-room-modal');
  const createBtn = $('#btn-create-room');
  const cancelBtn = $('#btn-cancel-room');
  const submitBtn = $('#btn-submit-room');

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      if (!currentUser) {
        showNamePrompt();
        return;
      }
      modal.classList.add('active');
    });
  }
  if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  $$('.tag-selector .tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const value = tag.dataset.tag;
      if (selectedTags.includes(value)) {
        selectedTags = selectedTags.filter(t => t !== value);
        tag.classList.remove('tag-active');
      } else {
        selectedTags.push(value);
        tag.classList.add('tag-active');
      }
    });
  });

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const name = $('#room-name').value.trim();
      if (!name) { showToast('Room name is required', 'error'); return; }
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        const data = await API.createRoom({
          name,
          description: $('#room-description').value.trim(),
          genre_tags: selectedTags,
          queue_mode: 'open',
        });
        modal.classList.remove('active');
        showToast('Room created!', 'success');
        window.location.href = `/room/${data.room.id}`;
      } catch (err) {
        showToast(err.message || 'Failed to create room', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Room';
      }
    });
  }

  // ---- Empty State Create Button ----
  const emptyCreateBtn = $('#btn-empty-create');
  if (emptyCreateBtn) {
    emptyCreateBtn.addEventListener('click', () => {
      if (!currentUser) {
        showNamePrompt();
        return;
      }
      modal.classList.add('active');
    });
  }
})();
