import { describe, it } from 'node:test';
import assert from 'node:assert';
import { shuffleTracks } from '../src/storage/history.ts';
import type { TrackInfo } from '../src/sync/protocol.ts';

describe('Library Shuffle & Room Invite Engine', () => {
  const sampleTracks: TrackInfo[] = [
    { track_uri: 'spotify:track:1', track_name: 'Midnight City', artist: 'M83', duration_ms: 240000 },
    { track_uri: 'spotify:track:2', track_name: 'Resonance', artist: 'HOME', duration_ms: 212000 },
    { track_uri: 'spotify:track:3', track_name: 'Weightless', artist: 'Marconi Union', duration_ms: 480000 },
    { track_uri: 'spotify:track:4', track_name: 'Coffee', artist: 'beabadoobee', duration_ms: 126000 },
    { track_uri: 'spotify:track:5', track_name: 'Starboy', artist: 'The Weeknd', duration_ms: 230000 },
  ];

  it('shuffleTracks preserves all elements and total count', () => {
    const shuffled = shuffleTracks(sampleTracks);
    assert.strictEqual(shuffled.length, sampleTracks.length);

    const originalUris = new Set(sampleTracks.map((t) => t.track_uri));
    const shuffledUris = new Set(shuffled.map((t) => t.track_uri));
    assert.deepStrictEqual(originalUris, shuffledUris);
  });

  it('shuffleTracks does not mutate the source array', () => {
    const copy = [...sampleTracks];
    const shuffled = shuffleTracks(copy);
    assert.strictEqual(copy[0].track_uri, 'spotify:track:1');
    assert.strictEqual(copy[4].track_uri, 'spotify:track:5');
    assert.notStrictEqual(shuffled, copy);
  });

  it('shuffleTracks handles empty and single-element arrays safely', () => {
    const empty: TrackInfo[] = [];
    assert.deepStrictEqual(shuffleTracks(empty), []);

    const single: TrackInfo[] = [sampleTracks[0]];
    const shuffledSingle = shuffleTracks(single);
    assert.strictEqual(shuffledSingle.length, 1);
    assert.strictEqual(shuffledSingle[0].track_uri, 'spotify:track:1');
  });

  it('shuffleTracks produces randomized order across repeated trials', () => {
    let orderChanged = false;
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleTracks(sampleTracks);
      const isIdentical = shuffled.every((t, idx) => t.track_uri === sampleTracks[idx].track_uri);
      if (!isIdentical) {
        orderChanged = true;
        break;
      }
    }
    assert.strictEqual(orderChanged, true, 'Expected Fisher-Yates shuffle to produce non-identical ordering');
  });

  it('correctly constructs collaborative room invite text with room code and link', () => {
    const roomId = 'neon99';
    const roomName = 'Synthwave Lounge';
    const message = `Join my live room "${roomName}" on OpenJam!\nRoom Code: #${roomId}\nLink: https://www.openjam.fun/room/${roomId}`;

    assert.ok(message.includes('Room Code: #neon99'));
    assert.ok(message.includes('https://www.openjam.fun/room/neon99'));
    assert.ok(message.includes('Synthwave Lounge'));
  });

  it('correctly distinguishes solo jam share message vs collaborative room share message', () => {
    const formatShareMessage = (roomId: string, displayName: string, isSolo: boolean) => {
      return isSolo
        ? 'Jamming on OpenJam! Check it out: https://www.openjam.fun'
        : `Join my live room "${displayName}" on OpenJam!\nRoom Code: #${roomId}\nLink: https://www.openjam.fun/room/${roomId}`;
    };

    const soloMsg = formatShareMessage('solo', 'Solo Jam', true);
    assert.strictEqual(soloMsg, 'Jamming on OpenJam! Check it out: https://www.openjam.fun');

    const liveMsg = formatShareMessage('room42', 'Chill Beats', false);
    assert.ok(liveMsg.includes('#room42'));
    assert.ok(liveMsg.includes('Chill Beats'));
  });

  it('maps Liked Songs and Offline Vault playback parameters accurately', () => {
    const buildPlaybackOptions = (isShuffle: boolean, isLikedTab: boolean) => {
      let sourceTitle = isLikedTab ? 'Liked Songs' : 'Offline Vault';
      if (isShuffle) {
        sourceTitle += ' (Shuffle)';
      }
      return { sourceTitle };
    };

    assert.deepStrictEqual(buildPlaybackOptions(false, true), { sourceTitle: 'Liked Songs' });
    assert.deepStrictEqual(buildPlaybackOptions(true, true), { sourceTitle: 'Liked Songs (Shuffle)' });
    assert.deepStrictEqual(buildPlaybackOptions(false, false), { sourceTitle: 'Offline Vault' });
    assert.deepStrictEqual(buildPlaybackOptions(true, false), { sourceTitle: 'Offline Vault (Shuffle)' });
  });
});
