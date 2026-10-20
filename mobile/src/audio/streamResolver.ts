import * as FileSystem from 'expo-file-system';
import { getBackendUrl } from '../api';
import {
  getVaultTrack,
  recordVaultTrackPlayed,
  deleteTrackFromVault,
} from '../storage/vault';

export interface ResolvedAudioStream {
  type: 'local_vault' | 'direct_stream';
  uri?: string;
  youtubeId?: string;
  title?: string;
  artist?: string;
  artworkUrl?: string;
}

const BARE_YT_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const PREFIX_REGEX = /^(?:yt:|ytid:)([a-zA-Z0-9_-]{11})(?:\?|$)/;
const STREAM_REGEX = /\/stream\/([a-zA-Z0-9_-]{11})(?:\?|$)/;
const YT_URL_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;

export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  if (clean.length === 11 && BARE_YT_REGEX.test(clean)) return clean;
  if (clean.startsWith('yt:') || clean.startsWith('ytid:')) {
    const prefixMatch = clean.match(PREFIX_REGEX);
    if (prefixMatch) return prefixMatch[1];
  }
  if (clean.includes('/stream/')) {
    const streamMatch = clean.match(STREAM_REGEX);
    if (streamMatch) return streamMatch[1];
  }
  if (clean.includes('youtu')) {
    const match = clean.match(YT_URL_REGEX);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Deep Audio Seam: Stream Resolver & Format Negotiator.
 *
 * Implements priority-tiered stream resolution:
 * 1. Sandboxed local file (0ms latency, offline)
 * 2. Sandboxed Vault track cached on disk (0ms latency, offline)
 * 3. Range-probed native high-fidelity audio stream (native expo-audio background playback)
 * 4. Backend /stream/:id proxy (fail-safe fallback)
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
    const vaultTrack = await getVaultTrack(urlOrId, meta);
    if (vaultTrack && vaultTrack.local_file_uri) {
      const fileInfo = await FileSystem.getInfoAsync(vaultTrack.local_file_uri);
      if (fileInfo.exists && (fileInfo.size ?? 0) >= 32768) {
        void recordVaultTrackPlayed(urlOrId);
        return {
          type: 'local_vault',
          uri: vaultTrack.local_file_uri,
          title: meta?.title || vaultTrack.track_name,
          artist: meta?.artist || vaultTrack.artist,
          artworkUrl: meta?.artworkUrl || vaultTrack.album_art_url,
        };
      } else {
        // Corrupted or removed from disk by OS cache cleaner
        void deleteTrackFromVault(urlOrId).catch(() => {});
      }
    }
  } catch {}

  let ytId = parseYouTubeId(urlOrId);

  // If it's a search query with spaces, resolve via backend search
  if (!ytId && urlOrId && !urlOrId.startsWith('http')) {
    try {
      const backendUrl = getBackendUrl();
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(
        `${backendUrl}/search/resolve?q=${encodeURIComponent(urlOrId)}`,
        { signal: ctrl.signal },
      );
      clearTimeout(timeout);
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

  // 3. Direct audio stream for YouTube video
  if (ytId) {
    const backendUrl = getBackendUrl();
    return {
      type: 'direct_stream',
      uri: `${backendUrl}/stream/${ytId}`,
      youtubeId: ytId,
      title: meta?.title,
      artist: meta?.artist,
      artworkUrl: meta?.artworkUrl || `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
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

  const backendUrl = getBackendUrl();
  return {
    type: 'direct_stream',
    uri: `${backendUrl}/stream/${encodeURIComponent(urlOrId)}`,
    youtubeId: urlOrId,
    title: meta?.title,
    artist: meta?.artist,
    artworkUrl: meta?.artworkUrl,
  };
}
