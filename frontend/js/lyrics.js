/* ========================================
   OPEN JAM — Synchronized Lyrics Controller
   Uses https://lrclib.net to fetch LRC data
   ======================================== */

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

class LyricsManager {
  constructor(containerEl) {
    this.container = containerEl;
    this.lyricsData = [];
    this.activeLineIdx = -1;
    this.isLoading = false;
    this.currentUri = null;
  }

  async loadLyrics(trackName, artistName, trackUri) {
    if (!this.container) return;
    
    // Prevent reloading if same track
    if (this.currentUri === trackUri && this.lyricsData.length > 0) return;
    this.currentUri = trackUri;
    
    this.container.innerHTML = '<div class="lyric-error">Loading lyrics...<br>(<span style="font-size:10px;">via lrclib.net</span>)</div>';
    this.lyricsData = [];
    this.activeLineIdx = -1;
    this.isLoading = true;

    if (!trackName) return;

    try {
      // Remove text inside brackets for better searching (e.g., "(Official Video)")
      const cleanTrack = trackName.replace(/\[.*?\]|\(.*?\)/g, '').trim();
      const cleanArtist = (artistName || '').replace(/\[.*?\]|\(.*?\)/g, '').trim();

      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error('Lyrics not found');
      
      const data = await res.json();
      if (!data.syncedLyrics) throw new Error('No synced lyrics available');

      this.parseLRC(data.syncedLyrics);
      this.render();
    } catch {
      this.container.innerHTML = '<div class="lyric-error">No synced lyrics found for this track.</div>';
    } finally {
      this.isLoading = false;
    }
  }

  parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    this.lyricsData = [];
    
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (const line of lines) {
      const match = timeReg.exec(line);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const timeMs = (min * 60 * 1000) + (sec * 1000) + ms;
        const text = line.replace(timeReg, '').trim();
        
        if (text) {
          this.lyricsData.push({ timeMs, text });
        }
      }
    }
  }

  render() {
    if (this.lyricsData.length === 0) {
      this.container.innerHTML = '<div class="lyric-error">No synced lyrics found.</div>';
      return;
    }
    
    this.container.innerHTML = '<div style="height:40%"></div>' + // padding top
      this.lyricsData.map((l, i) => `<div class="lyric-line" id="lyr-${i}">${escapeHtml(l.text)}</div>`).join('') +
      '<div style="height:50%"></div>'; // padding bottom
  }

  sync(currentMs) {
    if (this.lyricsData.length === 0) return;

    // Find the latest line where timeMs <= currentMs
    let newIdx = -1;
    for (let i = 0; i < this.lyricsData.length; i++) {
        if (this.lyricsData[i].timeMs <= currentMs + 300) { // +300ms lookahead feels more responsive
            newIdx = i;
        } else {
            break;
        }
    }

    if (newIdx !== this.activeLineIdx && newIdx !== -1) {
      if (this.activeLineIdx !== -1) {
        const oldEl = document.getElementById(`lyr-${this.activeLineIdx}`);
        if (oldEl) oldEl.classList.remove('active');
      }
      
      this.activeLineIdx = newIdx;
      const newEl = document.getElementById(`lyr-${newIdx}`);
      if (newEl) {
        newEl.classList.add('active');
        // Smooth scroll to center
        newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}
