/**
 * OpenJam Sandboxed Audio Vault & Offline Storage Manager.
 *
 * Capabilities:
 * 1. Downloads audio streams (.m4a / .mp3) to sandboxed device storage:
 *    `FileSystem.documentDirectory + 'openjam_audio/'`
 * 2. Indexes downloaded audio in AsyncStorage ('openjam_offline_vault_v1').
 * 3. Smart LRU cache pruning to respect storage limits (default 1GB).
 * 4. Dual-mode routing: Provides direct file:// URI to expo-audio for 0-latency offline playback.
 * 5. Batch downloader for Liked Songs & Curated Playlists with progress tracking.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { TrackInfo } from '../sync/protocol';
import { getBackendUrl } from '../config';

const VAULT_INDEX_KEY = 'openjam_offline_vault_v1';
export const DEFAULT_STORAGE_BUDGET_BYTES = 1024 * 1024 * 1024; // 1 GB default

export interface VaultTrack extends TrackInfo {
  local_file_uri: string;
  file_size_bytes: number;
  downloaded_at: number;
  is_liked: boolean;
  last_played_at: number;
  play_count: number;
}

export interface VaultStats {
  totalTracks: number;
  totalBytes: number;
  formattedSize: string;
  storageBudgetBytes: number;
  percentUsed: number;
}

export type DownloadState = 'idle' | 'downloading' | 'completed' | 'error';

export interface TrackDownloadProgress {
  trackUri: string;
  state: DownloadState;
  percent: number;
  error?: string;
}

const activeDownloadProgress: Record<string, TrackDownloadProgress> = {};
const progressListeners = new Set<(progress: Record<string, TrackDownloadProgress>) => void>();

export function getDownloadProgressMap(): Record<string, TrackDownloadProgress> {
  return { ...activeDownloadProgress };
}

export function getTrackDownloadProgress(trackUri: string): TrackDownloadProgress | null {
  return activeDownloadProgress[trackUri] || null;
}

export function subscribeDownloadProgress(
  listener: (progress: Record<string, TrackDownloadProgress>) => void,
): () => void {
  progressListeners.add(listener);
  listener({ ...activeDownloadProgress });
  return () => {
    progressListeners.delete(listener);
  };
}

function updateProgress(trackUri: string, update: Partial<TrackDownloadProgress>) {
  activeDownloadProgress[trackUri] = {
    trackUri,
    state: update.state || 'downloading',
    percent: update.percent ?? (activeDownloadProgress[trackUri]?.percent || 0),
    error: update.error,
  };
  for (const listener of progressListeners) {
    try {
      listener({ ...activeDownloadProgress });
    } catch {}
  }
}

export type DownloadProgressCallback = (receivedBytes: number, totalBytes: number, percent: number) => void;

/** Formats byte counts into human-readable strings (e.g. 4.2 MB) */
export function formatBytesPure(bytes: number): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0.0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/** Calculates summary storage metrics */
export function calculateVaultStatsPure(
  tracks: VaultTrack[],
  budgetBytes = DEFAULT_STORAGE_BUDGET_BYTES,
): VaultStats {
  const totalTracks = tracks.length;
  const totalBytes = tracks.reduce((sum, t) => sum + (t.file_size_bytes || 0), 0);
  const percentUsed = Math.min(100, Math.round((totalBytes / budgetBytes) * 100));

  return {
    totalTracks,
    totalBytes,
    formattedSize: formatBytesPure(totalBytes),
    storageBudgetBytes: budgetBytes,
    percentUsed,
  };
}

/** Prunes unpinned tracks when storage budget is exceeded (pure for testing) */
export function pruneLruVaultPure(
  tracks: VaultTrack[],
  maxBytes: number,
): { kept: VaultTrack[]; evicted: VaultTrack[] } {
  let currentBytes = tracks.reduce((s, t) => s + (t.file_size_bytes || 0), 0);
  if (currentBytes <= maxBytes) {
    return { kept: [...tracks], evicted: [] };
  }

  // Never evict liked tracks; sort unliked tracks by last_played_at ascending (oldest first)
  const liked = tracks.filter((t) => t.is_liked);
  const unliked = tracks.filter((t) => !t.is_liked).sort((a, b) => a.last_played_at - b.last_played_at);

  const keptUnliked: VaultTrack[] = [];
  const evicted: VaultTrack[] = [];

  for (const track of unliked) {
    if (currentBytes > maxBytes) {
      currentBytes -= track.file_size_bytes || 0;
      evicted.push(track);
    } else {
      keptUnliked.push(track);
    }
  }

  return {
    kept: [...liked, ...keptUnliked],
    evicted,
  };
}

/**
 * Extracts and deduplicates all session tracks (now playing + upcoming queue)
 * excluding any tracks that already reside inside the offline vault.
 */
export function filterSessionTracksToDownloadPure(
  nowPlaying: TrackInfo | null,
  queue: Array<{ track_uri?: string; track_name?: string; artist?: string; album_art_url?: string; duration_ms?: number }>,
  existingVaultUris: Set<string>,
): TrackInfo[] {
  const result: TrackInfo[] = [];
  const seenUris = new Set<string>();

  if (nowPlaying?.track_uri) {
    seenUris.add(nowPlaying.track_uri);
    if (!existingVaultUris.has(nowPlaying.track_uri)) {
      result.push(nowPlaying);
    }
  }

  for (const item of queue) {
    if (!item?.track_uri) continue;
    if (seenUris.has(item.track_uri)) continue;
    seenUris.add(item.track_uri);

    if (!existingVaultUris.has(item.track_uri)) {
      result.push({
        track_uri: item.track_uri,
        track_name: item.track_name || 'Queued Track',
        artist: item.artist || 'Unknown Artist',
        album_art_url: item.album_art_url,
        duration_ms: item.duration_ms,
      });
    }
  }

  return result;
}

/** Get the sandboxed audio directory path */
export function getVaultDirectory(): string {
  const base = FileSystem.documentDirectory || '';
  return `${base}openjam_audio/`;
}

/** Retrieves all downloaded tracks currently stored in the offline vault */
export async function getVaultTracks(): Promise<VaultTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[Vault] Failed to load offline vault index:', err);
    return [];
  }
}

/** Retrieves a single vault track by URI if downloaded */
export async function getVaultTrack(trackUri: string): Promise<VaultTrack | null> {
  if (!trackUri) return null;
  const tracks = await getVaultTracks();
  return tracks.find((t) => t.track_uri === trackUri) || null;
}

/** Check if a track is downloaded and ready for offline play */
export async function isTrackDownloaded(trackUri: string): Promise<boolean> {
  const t = await getVaultTrack(trackUri);
  return !!t && !!t.local_file_uri;
}

/** Parse or extract standard YouTube ID from track URI */
function extractVideoId(uri: string): string | null {
  if (!uri) return null;
  const clean = uri.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  if (clean.startsWith('yt:')) {
    const sub = clean.slice(3).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(sub)) return sub;
  }
  const match = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/);
  if (match && match[1]) return match[1];
  return null;
}

/**
 * Downloads a track stream into the sandboxed offline audio vault with automatic
 * multi-tier retries, fallback stream resolution, and granular progress reporting.
 */
export async function downloadTrackToVault(
  track: TrackInfo,
  isLiked = false,
  onProgress?: DownloadProgressCallback,
): Promise<VaultTrack> {
  if (!track || !track.track_name) {
    throw new Error('Invalid track information provided');
  }

  // Ensure vault directory exists
  const vaultDir = getVaultDirectory();
  const dirInfo = await FileSystem.getInfoAsync(vaultDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });
  }

  // Check if already downloaded
  const existing = await getVaultTrack(track.track_uri);
  if (existing) {
    const fileInfo = await FileSystem.getInfoAsync(existing.local_file_uri);
    if (fileInfo.exists && fileInfo.size && fileInfo.size > 1000) {
      updateProgress(track.track_uri, { state: 'completed', percent: 100 });
      onProgress?.(fileInfo.size, fileInfo.size, 100);
      return existing;
    }
  }

  // Mark starting state
  updateProgress(track.track_uri, { state: 'downloading', percent: 5 });
  onProgress?.(0, 100, 5);

  const backendUrl = getBackendUrl();
  let videoId = extractVideoId(track.track_uri);

  // If not a direct video ID, resolve via backend search
  if (!videoId && !track.track_uri.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const query = `${track.track_name} ${track.artist || ''}`.trim();
      const resp = await fetch(`${backendUrl}/search/resolve?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.video_id) {
          videoId = data.video_id;
        }
      }
    } catch (resolveErr) {
      console.warn('[Vault] Track resolution warning:', resolveErr);
    }
  }

  // Candidate URLs with fallback qualities and cache-busting
  const candidateUrls: string[] = [];
  if (videoId) {
    candidateUrls.push(`${backendUrl}/stream/${videoId}`);
    candidateUrls.push(`${backendUrl}/stream/${videoId}?low=true`);
    candidateUrls.push(`${backendUrl}/stream/${videoId}?nocache=true`);
  } else if (track.track_uri.startsWith('http')) {
    candidateUrls.push(track.track_uri);
  }

  if (candidateUrls.length === 0) {
    updateProgress(track.track_uri, { state: 'error', percent: 0, error: 'Could not resolve audio stream' });
    throw new Error(`Could not resolve downloadable audio stream for "${track.track_name}"`);
  }

  const safeFilename = `${track.track_uri.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.m4a`;
  const localTargetUri = `${vaultDir}${safeFilename}`;

  let success = false;
  let lastError: any = null;

  for (let attempt = 0; attempt < candidateUrls.length; attempt++) {
    const candidateUrl = candidateUrls[attempt];
    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        candidateUrl,
        localTargetUri,
        {},
        (downloadProgress) => {
          const total = downloadProgress.totalBytesExpectedToWrite;
          const current = downloadProgress.totalBytesWritten;
          const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 25;
          updateProgress(track.track_uri, { state: 'downloading', percent: Math.max(5, pct) });
          onProgress?.(current, total, pct);
        },
      );
      await downloadResumable.downloadAsync();

      const stat = await FileSystem.getInfoAsync(localTargetUri);
      if (stat.exists && stat.size && stat.size > 1000) {
        success = true;
        break;
      } else {
        try {
          await FileSystem.deleteAsync(localTargetUri, { idempotent: true });
        } catch {}
      }
    } catch (downloadErr) {
      lastError = downloadErr;
      try {
        await FileSystem.deleteAsync(localTargetUri, { idempotent: true });
      } catch {}
      // Brief pause before trying fallback stream
      if (attempt < candidateUrls.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  if (!success) {
    updateProgress(track.track_uri, { state: 'error', percent: 0, error: lastError?.message || 'Download failed' });
    throw new Error(`Failed to download audio for "${track.track_name}". Server may be busy, please retry.`);
  }

  const stat = await FileSystem.getInfoAsync(localTargetUri);
  const fileSize = stat.exists && 'size' in stat ? (stat.size ?? 0) : 0;
  const now = Date.now();
  const vaultEntry: VaultTrack = {
    ...track,
    local_file_uri: localTargetUri,
    file_size_bytes: fileSize,
    downloaded_at: now,
    is_liked: isLiked,
    last_played_at: now,
    play_count: 0,
  };

  const allTracks = await getVaultTracks();
  const filtered = allTracks.filter((t) => t.track_uri !== track.track_uri);
  const updated = [vaultEntry, ...filtered];
  await AsyncStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(updated));

  updateProgress(track.track_uri, { state: 'completed', percent: 100 });
  onProgress?.(fileSize, fileSize, 100);

  return vaultEntry;
}

/**
 * Removes a track from the offline vault and deletes its physical audio file.
 */
export async function deleteTrackFromVault(trackUri: string): Promise<boolean> {
  try {
    delete activeDownloadProgress[trackUri];
    for (const listener of progressListeners) {
      try {
        listener({ ...activeDownloadProgress });
      } catch {}
    }
    const allTracks = await getVaultTracks();
    const target = allTracks.find((t) => t.track_uri === trackUri);
    if (!target) return false;

    // Delete local file
    if (target.local_file_uri) {
      try {
        await FileSystem.deleteAsync(target.local_file_uri, { idempotent: true });
      } catch (e) {
        console.warn('[Vault] Failed to delete file on disk:', e);
      }
    }

    const updated = allTracks.filter((t) => t.track_uri !== trackUri);
    await AsyncStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('[Vault] Error deleting track from vault:', err);
    return false;
  }
}

/**
 * Clears all downloaded tracks from device disk and wipes the index.
 */
export async function clearVault(): Promise<void> {
  try {
    const vaultDir = getVaultDirectory();
    try {
      await FileSystem.deleteAsync(vaultDir, { idempotent: true });
    } catch {}
    await AsyncStorage.removeItem(VAULT_INDEX_KEY);
  } catch (err) {
    console.error('[Vault] Failed to clear vault:', err);
  }
}

/**
 * Updates track playback stats to keep LRU sorting accurate.
 */
export async function recordVaultTrackPlayed(trackUri: string): Promise<void> {
  try {
    const tracks = await getVaultTracks();
    const item = tracks.find((t) => t.track_uri === trackUri);
    if (!item) return;

    item.last_played_at = Date.now();
    item.play_count = (item.play_count || 0) + 1;
    await AsyncStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(tracks));
  } catch {}
}

/**
 * Fetches current storage summary.
 */
export async function getVaultStats(budgetBytes = DEFAULT_STORAGE_BUDGET_BYTES): Promise<VaultStats> {
  const tracks = await getVaultTracks();
  return calculateVaultStatsPure(tracks, budgetBytes);
}
