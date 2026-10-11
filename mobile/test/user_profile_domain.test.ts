import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface TestSessionUser {
  id: string;
  display_name: string;
  discord_username?: string | null;
  avatar_url?: string | null;
}

export interface TestTrack {
  track_uri: string;
  track_name: string;
  artist?: string;
  album_art_url?: string;
  duration_ms?: number;
}

export interface TestPlaylist {
  id: string;
  name: string;
  tracks: TestTrack[];
}

/**
 * Pure profile identity resolver replicating useUserProfile isSelf resolution logic
 */
export function resolveIsSelfProfile(
  targetId: string | undefined | null,
  sessionUser: TestSessionUser | null,
): boolean {
  if (!sessionUser) return false;
  if (!targetId || targetId === 'me') return true;

  const cleanTarget = targetId.trim().replace(/^@/, '').toLowerCase();
  const userId = sessionUser.id.toLowerCase();
  const discordUser = (sessionUser.discord_username || '').toLowerCase();
  const displayName = sessionUser.display_name.toLowerCase();

  return (
    cleanTarget === userId ||
    (discordUser.length > 0 && cleanTarget === discordUser) ||
    cleanTarget === displayName
  );
}

/**
 * Pure top genres distribution calculator replicating profile domain aggregation
 */
export function computeTopGenrePercentages(
  genreCounts: Record<string, number>,
): Array<{ genre: string; count: number; percentage: number }> {
  const entries = Object.entries(genreCounts);
  if (entries.length === 0) return [];

  const total = entries.reduce((acc, [, count]) => acc + count, 0);
  if (total === 0) return [];

  return entries
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Pure milestone badge evaluator replicating profile domain achievement logic
 */
export function evaluateMilestoneBadges(stats: {
  totalMinutesJammed: number;
  totalTracksJammed: number;
  roomsVisitedCount: number;
}): Array<{ id: string; label: string; unlocked: boolean }> {
  return [
    {
      id: 'first_jam',
      label: 'First Jam',
      unlocked: stats.totalTracksJammed >= 1,
    },
    {
      id: 'marathon_listener',
      label: 'Marathon Listener',
      unlocked: stats.totalMinutesJammed >= 60,
    },
    {
      id: 'century_club',
      label: '100 Tracks Club',
      unlocked: stats.totalTracksJammed >= 100,
    },
    {
      id: 'room_hopper',
      label: 'Room Hopper',
      unlocked: stats.roomsVisitedCount >= 5,
    },
  ];
}

/**
 * Pure playlist creator helper enforcing trimming and fallback naming
 */
export function prepareNewPlaylist(
  name: string,
  existingPlaylists: TestPlaylist[],
): { id: string; name: string; tracks: TestTrack[] } {
  const trimmed = name.trim();
  const fallbackName = `Playlist #${existingPlaylists.length + 1}`;
  return {
    id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: trimmed.length > 0 ? trimmed : fallbackName,
    tracks: [],
  };
}

describe('UserProfile Domain Engine Suite', () => {
  describe('Profile Self-Identity Seam', () => {
    const mockUser: TestSessionUser = {
      id: 'user-uuid-1234',
      display_name: 'AlexVibe',
      discord_username: 'alex_lofi',
    };

    it('identifies self when target is "me"', () => {
      assert.equal(resolveIsSelfProfile('me', mockUser), true);
    });

    it('identifies self when target matches user UUID exactly', () => {
      assert.equal(resolveIsSelfProfile('user-uuid-1234', mockUser), true);
    });

    it('identifies self when target matches @discord_username case-insensitively', () => {
      assert.equal(resolveIsSelfProfile('@Alex_Lofi', mockUser), true);
      assert.equal(resolveIsSelfProfile('alex_lofi', mockUser), true);
    });

    it('identifies self when target matches display_name case-insensitively', () => {
      assert.equal(resolveIsSelfProfile('alexvibe', mockUser), true);
    });

    it('rejects identity when viewing someone else', () => {
      assert.equal(resolveIsSelfProfile('stranger_dj', mockUser), false);
      assert.equal(resolveIsSelfProfile('user-other-9999', mockUser), false);
    });

    it('safely returns false when session user is null (guest / signed out)', () => {
      assert.equal(resolveIsSelfProfile('me', null), false);
      assert.equal(resolveIsSelfProfile('alex_lofi', null), false);
    });
  });

  describe('Genre & Milestone Statistics Seam', () => {
    it('calculates rounded percentages for top genres accurately', () => {
      const counts = {
        Lofi: 50,
        Synthwave: 30,
        Jazz: 20,
      };
      const result = computeTopGenrePercentages(counts);

      assert.equal(result.length, 3);
      assert.equal(result[0].genre, 'Lofi');
      assert.equal(result[0].percentage, 50);
      assert.equal(result[1].genre, 'Synthwave');
      assert.equal(result[1].percentage, 30);
      assert.equal(result[2].genre, 'Jazz');
      assert.equal(result[2].percentage, 20);
    });

    it('handles empty genre counts safely without division by zero', () => {
      const result = computeTopGenrePercentages({});
      assert.deepEqual(result, []);
    });

    it('unlocks milestones proportionally to listening activity', () => {
      const freshStats = {
        totalMinutesJammed: 0,
        totalTracksJammed: 0,
        roomsVisitedCount: 0,
      };
      const badgesFresh = evaluateMilestoneBadges(freshStats);
      assert.equal(badgesFresh.every((b) => !b.unlocked), true);

      const activeStats = {
        totalMinutesJammed: 75,
        totalTracksJammed: 105,
        roomsVisitedCount: 6,
      };
      const badgesActive = evaluateMilestoneBadges(activeStats);
      assert.equal(badgesActive.every((b) => b.unlocked), true);
    });
  });

  describe('Playlist Operations Seam', () => {
    it('creates playlist with cleaned name or default fallback if blank', () => {
      const p1 = prepareNewPlaylist('  Night Grooves  ', []);
      assert.equal(p1.name, 'Night Grooves');
      assert.deepEqual(p1.tracks, []);

      const p2 = prepareNewPlaylist('   ', [p1]);
      assert.equal(p2.name, 'Playlist #2');
    });
  });
});
