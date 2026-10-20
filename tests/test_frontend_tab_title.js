/**
 * Automated test suite for dynamic browser tab title updates and unmount cleanup.
 * Simulates DOM document.title behavior matching frontend-next/app/room/[id]/RoomClient.js.
 */

const assert = require('assert');

// Mock DOM document
const document = {
  title: 'Initial Title'
};

const defaultSiteTitle = 'OpenJam — Listen to Music with Friends Online Free | Virtual Music Room';

// Exact function signature and logic from RoomClient.js
function createTitleUpdater(initialRoom, initialNowPlaying) {
  let room = initialRoom;
  let nowPlaying = initialNowPlaying;
  const roomRef = { current: initialRoom };
  const nowPlayingRef = { current: initialNowPlaying };

  const updateDocumentTitle = (track, isPlaying, roomName) => {
    const currentTrack = track !== undefined ? track : (nowPlayingRef.current || nowPlaying);
    const trackName = currentTrack?.track_name || currentTrack?.name || currentTrack?.title;
    const artist = currentTrack?.artist || currentTrack?.artist_name || currentTrack?.channel;
    if (trackName) {
      const artistStr = artist || 'OpenJam';
      const prefix = isPlaying ? '▶' : '❚❚';
      document.title = `${prefix} ${trackName} • ${artistStr} | OpenJam`;
    } else {
      const name = roomName || roomRef.current?.name || room?.name || 'Live Room';
      document.title = `${name} • OpenJam`;
    }
  };

  const setRoom = (newRoom) => {
    room = newRoom;
    roomRef.current = newRoom;
  };

  const setNowPlaying = (newTrack) => {
    nowPlaying = newTrack;
    nowPlayingRef.current = newTrack;
  };

  const unmount = () => {
    document.title = defaultSiteTitle;
  };

  return { updateDocumentTitle, setRoom, setNowPlaying, unmount, getTitle: () => document.title };
}

console.log('--- Running Dynamic Tab Title Unit & Integration Tests ---');

// Test 1: Empty / Idle room title
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge', slug: 'chill-beats-lounge-1234' }, null);
  updater.updateDocumentTitle(null, false, 'Chill Beats Lounge');
  assert.strictEqual(document.title, 'Chill Beats Lounge • OpenJam');
  console.log('✓ Test 1 Passed: Empty room sets "${room.name} • OpenJam"');
}

// Test 2: Playback starts (playing ▶)
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, null);
  const track = { track_name: 'Midnight City', artist: 'M83' };
  updater.setNowPlaying(track);
  updater.updateDocumentTitle(track, true, 'Chill Beats Lounge');
  assert.strictEqual(document.title, '▶ Midnight City • M83 | OpenJam');
  console.log('✓ Test 2 Passed: Playing track sets "▶ ${track_name} • ${artist} | OpenJam"');
}

// Test 3: Playback paused (paused ❚❚)
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, { track_name: 'Midnight City', artist: 'M83' });
  updater.updateDocumentTitle(undefined, false, 'Chill Beats Lounge');
  assert.strictEqual(document.title, '❚❚ Midnight City • M83 | OpenJam');
  console.log('✓ Test 3 Passed: Paused playback sets "❚❚ ${track_name} • ${artist} | OpenJam"');
}

// Test 4: Track with missing artist falls back to OpenJam
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, null);
  const track = { track_name: 'Mystery Synth', artist: null };
  updater.setNowPlaying(track);
  updater.updateDocumentTitle(track, true, 'Chill Beats Lounge');
  assert.strictEqual(document.title, '▶ Mystery Synth • OpenJam | OpenJam');
  console.log('✓ Test 4 Passed: Missing artist gracefully defaults to "• OpenJam | OpenJam"');
}

// Test 5: Queue ends / track clears to null (resets to room name)
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, { track_name: 'Midnight City', artist: 'M83' });
  updater.setNowPlaying(null);
  updater.updateDocumentTitle(null, false, 'Chill Beats Lounge');
  assert.strictEqual(document.title, 'Chill Beats Lounge • OpenJam');
  console.log('✓ Test 5 Passed: Queue end clearing track sets "${room.name} • OpenJam"');
}

// Test 6: Room renamed live via room_updated event
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, null);
  updater.updateDocumentTitle(null, false, 'Chill Beats Lounge');
  assert.strictEqual(document.title, 'Chill Beats Lounge • OpenJam');
  // Host renames room
  updater.setRoom({ name: 'Midnight Lo-Fi Radio' });
  updater.updateDocumentTitle(null, false, 'Midnight Lo-Fi Radio');
  assert.strictEqual(document.title, 'Midnight Lo-Fi Radio • OpenJam');
  console.log('✓ Test 6 Passed: Renamed room dynamically updates tab title');
}

// Test 7: Component unmount restores default site title
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, { track_name: 'Midnight City', artist: 'M83' });
  updater.updateDocumentTitle(undefined, true, 'Chill Beats Lounge');
  assert.strictEqual(document.title, '▶ Midnight City • M83 | OpenJam');
  updater.unmount();
  assert.strictEqual(document.title, defaultSiteTitle);
  console.log('✓ Test 7 Passed: Component unmount restores default site title');
}

// Test 8: Track with .title and .channel from external/YouTube formats
{
  const updater = createTitleUpdater({ name: 'Chill Beats Lounge' }, null);
  const track = { title: 'Neon Lights', channel: 'Synthwave Boy' };
  updater.setNowPlaying(track);
  updater.updateDocumentTitle(track, true, 'Chill Beats Lounge');
  assert.strictEqual(document.title, '▶ Neon Lights • Synthwave Boy | OpenJam');
  console.log('✓ Test 8 Passed: Alternative schema (.title and .channel) sets correct tab title');
}

// Test 9: Rapid duplicate socket event deduplication simulation
{
  let trackSetCalls = 0;
  let lyricsFetchCalls = 0;
  let lastTrackChange = { uri: null, time: 0 };

  const handleTrackChanged = (data, player, fetchLyrics) => {
    if (data) {
      const now = Date.now();
      const uri = data.track_uri || data.id;
      const isDuplicate = Boolean(lastChange = lastTrackChange.uri && lastTrackChange.uri === uri && (now - lastTrackChange.time < 1200));
      lastTrackChange = { uri, time: now };
      if (!isDuplicate) {
        player.setTrack(data);
        fetchLyrics(data.artist, data.track_name);
      }
    }
  };

  const mockPlayer = { setTrack: () => { trackSetCalls++; } };
  const mockFetchLyrics = () => { lyricsFetchCalls++; };

  const trackEvent = { track_uri: 'vid123', track_name: 'Song', artist: 'Artist' };
  // First delivery
  handleTrackChanged(trackEvent, mockPlayer, mockFetchLyrics);
  // Rapid duplicate delivery (e.g. 5ms later from dual socket room emission)
  handleTrackChanged(trackEvent, mockPlayer, mockFetchLyrics);

  assert.strictEqual(trackSetCalls, 1, 'Player.setTrack should only be called once');
  assert.strictEqual(lyricsFetchCalls, 1, 'fetchLyrics should only be called once');
  console.log('✓ Test 9 Passed: Rapid duplicate socket delivery successfully deduplicated');
}

console.log('--- ALL 9 DYNAMIC TAB TITLE TESTS PASSED ---');

