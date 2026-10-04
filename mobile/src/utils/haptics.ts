import * as Haptics from 'expo-haptics';
import { getAppPreferences } from '../storage/history';

let hapticsEnabledCache: boolean | null = null;

// Periodically or lazily sync preference
export async function isHapticsEnabled(): Promise<boolean> {
  if (hapticsEnabledCache !== null) return hapticsEnabledCache;
  try {
    const prefs = await getAppPreferences();
    hapticsEnabledCache = prefs.hapticEnabled ?? true;
    return hapticsEnabledCache;
  } catch {
    return true;
  }
}

export function updateHapticsPreference(enabled: boolean) {
  hapticsEnabledCache = enabled;
}

/** Subtle tap for chips, scrubber ticks, and small buttons */
export async function hapticLight(): Promise<void> {
  try {
    if (await isHapticsEnabled()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
}

/** Standard feedback for primary actions (play/pause, add track, bookmark) */
export async function hapticMedium(): Promise<void> {
  try {
    if (await isHapticsEnabled()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {}
}

/** Stronger feedback for impactful actions (skip track, room leave, purge cache) */
export async function hapticHeavy(): Promise<void> {
  try {
    if (await isHapticsEnabled()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {}
}

/** Subtle tactile click on scrubber seekbar scrubbing */
export async function hapticSelection(): Promise<void> {
  try {
    if (await isHapticsEnabled()) {
      await Haptics.selectionAsync();
    }
  } catch {}
}
