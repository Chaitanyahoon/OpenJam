const DB_NAME = 'OpenJamOfflineDB';
const DB_VERSION = 1;

class OfflineDB {
  constructor() {
    this.db = null;
  }

  init() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported on this environment.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  async getTrack(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readonly');
      const store = transaction.objectStore('tracks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTrack(track) {
    const db = await this.init();
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (e) {}
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.put(track);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTrack(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTracks() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readonly');
      const store = transaction.objectStore('tracks');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPlaylists() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('playlists', 'readonly');
      const store = transaction.objectStore('playlists');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async savePlaylist(playlist) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('playlists', 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.put(playlist);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deletePlaylist(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('playlists', 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineDb = new OfflineDB();
