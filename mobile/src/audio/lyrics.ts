/**
 * Synced lyrics via LRCLIB (free, no key).
 * Ports frontend-next/app/room/[id]/RoomClient.js fetchLyrics.
 */
export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface Lyrics {
  lines: LyricLine[];
  /** true when lines carry real timestamps; false = plain text fallback */
  synced: boolean;
}

function cleanTrack(track: string): string {
  let t = track
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/\|.*$/g, '')
    .replace(/ft\..*|feat\..*|prod\..*/i, '')
    .replace(
      /official music video|official video|official audio|lyric video|lyrics|visualizer|audio|video|hd|4k|remastered|remix|explicit/gi,
      '',
    )
    .trim();
  return t;
}

function cleanArtist(artist: string): string {
  return (artist || '')
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/ - topic/i, '')
    .replace(/vevo/i, '')
    .replace(/official/i, '')
    .trim();
}

/** Parse LRCLIB syncedLyrics "[mm:ss.xx] text" into lines. */
function parseSynced(synced: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of synced.split('\n')) {
    const m = raw.match(/^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0;
    const text = m[4].trim();
    if (!text) continue;
    out.push({ timeMs: (min * 60 + sec) * 1000 + frac, text });
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

export async function fetchLyrics(
  artist: string,
  track: string,
  durationSec = 0,
): Promise<Lyrics> {
  if (!track) return { lines: [], synced: false };
  let cleanT = cleanTrack(track);
  let cleanA = cleanArtist(artist);
  if (cleanT.includes(' - ')) {
    const parts = cleanT.split(' - ');
    if (!cleanA || cleanA === 'Unknown' || cleanA === 'Topic') cleanA = parts[0].trim();
    cleanT = parts[1].trim();
  }
  if (!cleanT) return { lines: [], synced: false };

  const tries: string[] = [];
  if (cleanA && durationSec > 10) {
    tries.push(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(cleanA)}&duration=${Math.round(durationSec)}`,
    );
  }
  if (cleanA) {
    tries.push(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(cleanA)}`,
    );
  }
  tries.push(
    `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanT} ${cleanA}`.trim())}`,
  );

  for (const url of tries) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const hit = Array.isArray(data) ? data[0] : data;
      if (!hit) continue;
      if (hit.syncedLyrics) {
        const lines = parseSynced(hit.syncedLyrics);
        if (lines.length > 0) return { lines, synced: true };
      }
      if (hit.plainLyrics) {
        const lines = hit.plainLyrics
          .split('\n')
          .map((t: string) => t.trim())
          .filter(Boolean)
          .map((text: string, i: number) => ({ timeMs: i * 4000, text }));
        if (lines.length > 0) return { lines, synced: false };
      }
    } catch {
      // next tier
    }
  }
  return { lines: [], synced: false };
}

/** Index of the last line whose timestamp is <= positionMs. */
export function activeLyricIndex(lines: LyricLine[], positionMs: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) idx = i;
    else break;
  }
  return idx;
}
