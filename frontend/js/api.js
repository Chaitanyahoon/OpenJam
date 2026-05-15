/* ========================================
   OPEN JAM — API Client
   ======================================== */

const API = {
  async request(url, options = {}) {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error [${url}]:`, err);
      throw err;
    }
  },

  getCurrentUser() {
    return this.request('/auth/me');
  },

  /** Create anonymous session with a display name. */
  join(displayName) {
    return this.request('/auth/join', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName }),
    });
  },

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    localStorage.removeItem('openjam_display_name');
    window.location.reload();
  },

  getRooms(search = '') {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/rooms${params}`);
  },

  createRoom(data) {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getRoom(roomId) {
    return this.request(`/rooms/${roomId}`);
  },

  closeRoom(roomId) {
    return this.request(`/rooms/${roomId}`, { method: 'DELETE' });
  },

  addToQueue(roomId, trackData) {
    return this.request(`/rooms/${roomId}/queue`, {
      method: 'POST',
      body: JSON.stringify(trackData),
    });
  },

  voteTrack(roomId, itemId) {
    return this.request(`/rooms/${roomId}/queue/${itemId}/vote`, {
      method: 'POST',
    });
  },

  searchTracks(query) {
    return this.request(`/search/tracks?q=${encodeURIComponent(query)}`);
  }
};
