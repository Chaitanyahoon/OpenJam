/* ========================================
   OPEN JAM — Socket.IO Client
   ======================================== */

class SocketClient {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.roomId = null;
    this._hasConnected = false;
  }

  connect() {
    if (this.socket) return;

    try { this._debug = new URLSearchParams(location.search).has('debug'); } catch (e) { this._debug = false; }

    if (typeof io === 'undefined') {
      console.error('[openjam] socket.io library not loaded');
      return;
    }

    const token = this._getCookie('session_token');
    const guestName = localStorage.getItem('openjam_display_name') || '';

    this.socket = io({
      path: '/socket.io',
      auth: { token: token || '', guest_name: guestName },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 15,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      if (this.roomId) {
        const avatarUrl = localStorage.getItem('openjam_avatar_url');
        const payload = { room_id: this.roomId, avatar_url: avatarUrl };
        if (this.password) payload.password = this.password;
        this.socket.emit('join_room', payload);
      }
      this._hasConnected = true;
      if (this._debug) console.log('[openjam] socket connected, sid=', this.socket.id);
    });

    this.socket.on('disconnect', () => {});
    this.socket.on('connect_error', () => {});

    const events = [
      'connect', 'disconnect',
      'user_joined', 'user_left',
      'chat_message', 'chat_history',
      'queue_updated', 'queue_error',
      'playback_sync', 'track_changed',
      'listener_count', 'room_closed',
      'name_updated', 'skip_votes_updated',
      'reaction', 'user_typing', 'user_stop_typing',
      'join_error', 'heartbeat_ack',
      'chat_ack', 'join_success',
    ];
    events.forEach(event => {
      this.socket.on(event, (data) => {
        if (this._debug) console.log(`[openjam] recv ${event}`, data);
        if (this.handlers[event]) {
          this.handlers[event](data);
        }
      });
    });

    // Heartbeat: ping server every 25s to keep connection alive
    this._heartbeatInterval = setInterval(() => {
      if (this._ready()) this.socket.emit('heartbeat');
    }, 25000);
  }

  /** Register a handler BEFORE calling connect(). */
  on(event, handler) {
    this.handlers[event] = handler;
  }

  joinRoom(roomId, password) {
    this.roomId = roomId;
    if (password) this.password = password;
    if (this._ready()) {
      const avatarUrl = localStorage.getItem('openjam_avatar_url');
      const payload = { room_id: roomId, avatar_url: avatarUrl };
      if (this.password) payload.password = this.password;
      this.socket.emit('join_room', payload);
    }
  }

  leaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit('leave_room', { room_id: roomId || this.roomId });
    }
    this.roomId = null;
  }

  sendChat(message) {
    if (!this._ready()) return Promise.reject(new Error('Not connected'));
    return new Promise((resolve) => {
      const tempId = Math.random().toString(36).slice(2, 10);
      const handler = (data) => {
        if (data.temp_id === tempId) {
          this.socket.off('chat_ack', handler);
          resolve(data);
        }
      };
      this.socket.on('chat_ack', handler);
      // Timeout: if no ACK in 10s, reject so retry queue kicks in
      setTimeout(() => {
        this.socket.off('chat_ack', handler);
        resolve(null); // null = no ack, caller should retry
      }, 10000);
      this.socket.emit('send_chat', { room_id: this.roomId, message, temp_id: tempId });
    });
  }

  addToQueue(trackData) {
    if (!this._ready()) return;
    this.socket.emit('add_to_queue', { room_id: this.roomId, ...trackData });
  }

  voteTrack(queueItemId) {
    if (!this._ready()) return;
    this.socket.emit('vote_track', { room_id: this.roomId, queue_item_id: queueItemId });
  }

  requestSync() {
    if (!this._ready()) return;
    this.socket.emit('sync_request', { room_id: this.roomId });
  }

  nextTrack() {
    if (!this._ready()) return;
    this.socket.emit('next_track', { room_id: this.roomId });
  }

  updatePlayback(data) {
    if (!this._ready()) return;
    this.socket.emit('playback_update', data);
  }

  setGuestName(name) {
    if (!this._ready()) return;
    localStorage.setItem('openjam_display_name', name);
    this.socket.emit('set_guest_name', { name });
  }

  updateProfile(data) {
    if (!this._ready()) return;
    if (data.display_name) localStorage.setItem('openjam_display_name', data.display_name);
    if (data.avatar_url) localStorage.setItem('openjam_avatar_url', data.avatar_url);
    this.socket.emit('update_profile', data);
  }

  /** Generic emit passthrough — allows room.js to send arbitrary socket events. */
  emit(event, data) {
    if (!this._ready()) return;
    this.socket.emit(event, data);
  }

  disconnect() {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  _ready() {
    return this.socket && this.socket.connected;
  }

  _getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? m[2] : null;
  }
}
