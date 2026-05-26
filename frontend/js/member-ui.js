/* ==========================================================================
   OPEN JAM — Member UI Module
   Manages member panels, collapsible listening lists, host badges, and tags.
   ========================================================================== */

(function() {
  // Global hooks
  window.toggleMembers = function() { 
    const panel = $('#members-panel');
    panel?.classList.toggle('collapsed'); 
    const btn = $('#m-toggle');
    if (btn) btn.setAttribute('aria-expanded', panel?.classList.contains('collapsed') ? 'false' : 'true');
  };

  window.updateMembers = function(listeners) {
    const app = window.roomApp;
    if (!app) return;
    const list = $('#members-list');
    const badge = $('#m-count');
    if (!list) return;
    const arr = Array.isArray(listeners) ? listeners : [];
    const count = typeof listeners === 'number' ? listeners : arr.length;

    // Update sidebar badge
    if (badge) badge.textContent = count;

    // Update room bar live listener pill
    const barNum = $('#bar-lc-num');
    if (barNum) barNum.textContent = count;

    // Update mobile People tab label
    const mobTab = $('#mob-tab-members');
    if (mobTab) {
      const lbl = mobTab.querySelector('.mob-tab-label');
      if (lbl) lbl.textContent = count > 0 ? `People (${count})` : 'People';
    }

    if (!Array.isArray(arr) || !arr.length) return;
    list.innerHTML = arr.map(l => {
      const isSelf = app.me && l.user_id === app.me.id;
      const isRoomHost = app.roomData && l.user_id === app.roomData.room?.host_user_id;
      return `
      <div class="member-item">
        ${app.avatarHTML(l.display_name || 'Jammer')}
        <span class="member-name">${esc(l.display_name)}${isSelf ? ' <span class="member-you">(you)</span>' : ''}</span>
        ${isRoomHost ? `<span class="badge badge-host">Host</span>` : ''}
      </div>`;
    }).join('');
  };
})();
