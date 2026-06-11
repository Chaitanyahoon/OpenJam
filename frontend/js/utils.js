/* ========================================
   OPEN JAM — Utility Functions
   ======================================== */

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function formatTime(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(message, type = 'info') {
  const container = $('#toasts');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function getRoomIdFromUrl() {
  const parts = window.location.pathname.split('/');
  const roomIndex = parts.indexOf('room');
  if (roomIndex !== -1 && parts[roomIndex + 1]) {
    return parts[roomIndex + 1];
  }
  return null;
}

/** Shared PWA install prompt banner (landing + room pages). */
function setupPwaInstallBanner() {
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (sessionStorage.getItem('pwa_install_dismissed') === 'true') return;
    showBanner();
  });

  function showBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-install-banner-body">
        <img src="/static/img/logo.png" alt="" class="pwa-install-banner-icon" width="40" height="40" />
        <div class="pwa-install-banner-text">
          <div class="pwa-install-banner-title">Install OpenJam</div>
          <div class="pwa-install-banner-sub">Add to Home Screen for the full app experience</div>
        </div>
      </div>
      <div class="pwa-install-banner-actions">
        <button type="button" id="pwa-install-btn" class="btn btn-primary pwa-install-btn">Install</button>
        <button type="button" id="pwa-dismiss-btn" class="btn btn-ghost pwa-dismiss-btn" aria-label="Dismiss">✕</button>
      </div>
    `;

    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));

    banner.querySelector('#pwa-install-btn')?.addEventListener('click', () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        banner.remove();
      });
    });

    banner.querySelector('#pwa-dismiss-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('pwa_install_dismissed', 'true');
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 350);
    });
  }
}

/** Keep mobile mini-player in sync with the main Now Playing panel. */
window.syncMiniPlayer = function syncMiniPlayer(opts = {}) {
  const bar = document.getElementById('mobile-mini-player');
  if (!bar) return;

  const { title, artist, artUrl, playing, progressPct, visible } = opts;

  if (typeof title === 'string') {
    const el = document.getElementById('mini-title');
    if (el) el.textContent = title;
  }
  if (typeof artist === 'string') {
    const el = document.getElementById('mini-artist');
    if (el) el.textContent = artist;
  }
  if (typeof artUrl === 'string') {
    const img = document.getElementById('mini-art');
    if (img && artUrl) img.src = artUrl;
  }
  if (typeof playing === 'boolean') {
    const play = document.getElementById('mini-ico-play');
    const pause = document.getElementById('mini-ico-pause');
    if (play) play.style.display = playing ? 'none' : 'block';
    if (pause) pause.style.display = playing ? 'block' : 'none';
    const art = document.getElementById('mini-art');
    if (art) art.classList.toggle('spinning', playing);
  }
  if (typeof progressPct === 'number') {
    const prog = document.getElementById('mini-progress');
    if (prog) prog.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
  }
  if (typeof visible === 'boolean') {
    bar.classList.toggle('is-visible', visible);
    bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
    document.body.classList.toggle('mini-player-active', visible);
  }
};

window.updateMiniPlayerVisibility = function updateMiniPlayerVisibility(activeTab) {
  const isMobile = window.innerWidth <= 640;
  const show = isMobile && activeTab !== 'nowplaying';
  syncMiniPlayer({ visible: show });
};
