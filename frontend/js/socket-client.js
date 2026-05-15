/* ========================================
   OPEN JAM — Socket.IO Client
   ======================================== */

class SocketClient {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.roomId = null;
  }

  connect() {
    if (this.socket) return; // already created

    const token = this._getCookie('session_token');
    const guestName = localStorage.getItem('openjam_display_name') || '';

    this.socket = io({
      path: '/socket.io',
      auth: { token: token || '', guest_name: guestName },
      // Force WebSocket first — polling causes 20-25s event delivery delay
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 15,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      if (this.roomId) {
        this.socket.emit('join_room', { room_id: this.roomId });
      }
    });

    this.socket.on('disconnect', () => {});
    this.socket.on('connect_error', () => {});

    // Wire all events to handler map
    const events = [
      'user_joined', 'user_left',
      'chat_message', 'chat_history',
      'queue_updated', 'queue_error',
      'playback_sync', 'track_changed',
      'listener_count', 'room_closed',
      'name_updated', 'skip_votes_updated',
      'reaction', 'user_typing', 'user_stop_typing',
    ];
    events.forEach(event => {
      this.socket.on(event, (data) => {
        if (this.handlers[event]) {
          this.handlers[event](data);
        }
      });
    });
  }

  /** Register a handler BEFORE calling connect(). */
  on(event, handler) {
    this.handlers[event] = handler;
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    if (this._ready()) {
      const avatarUrl = localStorage.getItem('openjam_avatar_url');
      this.socket.emit('join_room', { room_id: roomId, avatar_url: avatarUrl });
    }
    // If not yet connected, the 'connect' event will join automatically
  }

  leaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit('leave_room', { room_id: roomId || this.roomId });
    }
    this.roomId = null;
  }

  sendChat(message) {
    if (!this._ready()) return;
    this.socket.emit('send_chat', { room_id: this.roomId, message });
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
