import { getBackendUrl } from '../api';
import {
  getVaultTrack,
  recordVaultTrackPlayed,
  resolveDirectAudioStreamUrls,
} from '../storage/vault';

export interface ResolvedAudioStream {
  type: 'local_vault' | 'direct_stream' | 'youtube_bridge';
  uri?: string;
  youtubeId?: string;
  title?: string;
  artist?: string;
  artworkUrl?: string;
}

export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const streamMatch = clean.match(/\/stream\/([a-zA-Z0-9_-]{11})(?:\?|$)/);
  if (streamMatch) return streamMatch[1];
  const reg =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = clean.match(reg);
  if (match && match[1]) return match[1];
  return null;
}

/**
 * Deep Audio Seam: Stream Resolver & Format Negotiator.
 *
 * Implements priority-tiered stream resolution:
 * 1. Sandboxed local file (0ms latency, offline)
 * 2. Sandboxed Vault track cached on disk (0ms latency, offline)
 * 3. Range-probed native high-fidelity audio stream (native expo-audio background playback)
 * 4. Headless WebView YouTube Audio Bridge (restricted/fail-safe fallback)
 */
export async function resolveAudioStream(
  urlOrId: string,
  meta?: { title?: string; artist?: string; artworkUrl?: string },
): Promise<ResolvedAudioStream> {
  // 1. Direct local sandboxed file
  if (urlOrId && urlOrId.startsWith('file://')) {
    return {
      type: 'local_vault',
      uri: urlOrId,
      title: meta?.title,
      artist: meta?.artist,
      artworkUrl: meta?.artworkUrl,
    };
  }

  // 2. Check if track is pre-cached in sandboxed offline vault
  try {
    const vaultTrack = await getVaultTrack(urlOrId);
    if (vaultTrack && vaultTrack.local_file_uri) {
      void recordVaultTrackPlayed(urlOrId);
      return {
        type: 'local_vault',
        uri: vaultTrack.local_file_uri,
        title: meta?.title || vaultTrack.track_name,
        artist: meta?.artist || vaultTrack.artist,
        artworkUrl: meta?.artworkUrl || vaultTrack.album_art_url,
      };
    }
  } catch {}

  let ytId = parseYouTubeId(urlOrId);

  // If it's a search query with spaces, resolve via backend search
  if (!ytId && urlOrId && !urlOrId.startsWith('http')) {
    try {
      const backendUrl = getBackendUrl();
      const resp = await fetch(
        `${backendUrl}/search/resolve?q=${encodeURIComponent(urlOrId)}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data?.video_id) {
          ytId = data.video_id;
        }
      }
    } catch (err) {
      console.warn('[streamResolver] Failed to resolve query:', err);
    }
  }

  // 3. Direct audio stream candidate probe for YouTube video
  if (ytId) {
    try {
      const directUrls = await resolveDirectAudioStreamUrls(ytId);
      for (const directUrl of directUrls) {
        try {
          const testCtrl = new AbortController();
          const testTimeout = setTimeout(() => testCtrl.abort(), 2000);
          const testRes = await fetch(directUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-1024' },
            signal: testCtrl.signal,
          });
          clearTimeout(testTimeout);
          if (testRes.ok || testRes.status === 206) {
            return {
              type: 'direct_stream',
              uri: directUrl,
              youtubeId: ytId,
              title: meta?.title,
              artist: meta?.artist,
              artworkUrl: meta?.artworkUrl,
            };
          }
        } catch {}
      }
    } catch {}

    // Fallback to YouTube Audio Bridge
    return {
      type: 'youtube_bridge',
      youtubeId: ytId,
      title: meta?.title,
      artist: meta?.artist,
      artworkUrl: meta?.artworkUrl,
    };
  }

  // 4. Raw http/https stream URL
  if (urlOrId && (urlOrId.startsWith('http://') || urlOrId.startsWith('https://'))) {
    return {
      type: 'direct_stream',
      uri: urlOrId,
      title: meta?.title,
      artist: meta?.artist,
      artworkUrl: meta?.artworkUrl,
    };
  }

  return {
    type: 'youtube_bridge',
    youtubeId: urlOrId,
    title: meta?.title,
    artist: meta?.artist,
    artworkUrl: meta?.artworkUrl,
  };
}
