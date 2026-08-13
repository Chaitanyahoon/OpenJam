import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import sitemap and robots directly (they are pure JS)
import sitemap from '../../frontend-next/app/sitemap.js';
import robots from '../../frontend-next/app/robots.js';

// Load app/room/[id]/page.js source code and extract generateMetadata to bypass Node JSX error on React component
const roomPagePath = path.resolve('frontend-next/app/room/[id]/page.js');
const roomPageCode = fs.readFileSync(roomPagePath, 'utf8');

// Strip out React JSX imports and component exports
const cleanCode = roomPageCode
  .slice(0, roomPageCode.indexOf('export default function RoomPage'))
  .replace(/import React,?\s*\{?[^}]*\}?\s*from\s*['"]react['"];?/g, '')
  .replace(/import RoomPageClient from [^;]+;/g, '')
  .replace(/import \{ RoomSkeleton \} from [^;]+;/g, '')
  .replace(/export /g, '');

// Create module wrapper for generateMetadata
const moduleFunc = new Function('exports', 'globalThis', 'fetch', 'process', cleanCode + '\nexports.generateMetadata = generateMetadata;');

let generateMetadata;

let passed = 0;
let failed = 0;

function logPass(testName) {
  console.log(`[PASS] ${testName}`);
  passed++;
}

function logFail(testName, error) {
  console.error(`[FAIL] ${testName}:`, error);
  failed++;
}

// Helper to mock fetch
function mockFetch(handler) {
  globalThis.fetch = async (url, options) => {
    return handler(url, options);
  };
  const exportsObj = {};
  moduleFunc(exportsObj, globalThis, globalThis.fetch, process);
  generateMetadata = exportsObj.generateMetadata;
}

async function runTests() {
  console.log('=== STARTING M1 EMPIRICAL STRESS TESTS ===\n');

  // Initial setup for generateMetadata
  mockFetch(async () => ({ ok: false }));

  // -------------------------------------------------------------
  // SECTION 1: sitemap.js Stress Testing
  // -------------------------------------------------------------
  console.log('--- SECTION 1: sitemap.js ---');

  // Test 1.1: Normal Backend Response with Active Public & Private Rooms
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        rooms: [
          { id: 'room-pub-1', name: 'Public Jam', is_private: false, created_at: '2026-08-01T12:00:00Z' },
          { id: 'room-priv-1', name: 'Private Jam', is_private: true, created_at: '2026-08-01T12:00:00Z' },
          { id: 'room-pub-2', name: 'Another Public Jam', is_private: false },
        ]
      })
    }));

    const result = await sitemap();
    assert.strictEqual(result.length, 5); // 3 static + 2 public rooms
    assert.strictEqual(result[0].url, 'https://www.openjam.fun');
    assert.strictEqual(result[3].url, 'https://www.openjam.fun/room/room-pub-1');
    assert.strictEqual(result[4].url, 'https://www.openjam.fun/room/room-pub-2');
    assert.strictEqual(result[3].priority, 0.8);
    assert.strictEqual(result[3].changeFrequency, 'hourly');
    logPass('sitemap.js: Normal active rooms response filtering');
  } catch (err) {
    logFail('sitemap.js: Normal active rooms response filtering', err);
  }

  // Test 1.2: Backend HTTP 500 Error
  try {
    mockFetch(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' })
    }));

    const result = await sitemap();
    assert.strictEqual(result.length, 3); // Falling back to static entries
    logPass('sitemap.js: Backend HTTP 500 handling fallback');
  } catch (err) {
    logFail('sitemap.js: Backend HTTP 500 handling fallback', err);
  }

  // Test 1.3: Backend Network Exception / Timeout
  try {
    mockFetch(async () => {
      throw new Error('ETIMEDOUT: Connection timed out');
    });

    const result = await sitemap();
    assert.strictEqual(result.length, 3); // Fallback to static entries
    logPass('sitemap.js: Network exception / timeout handling fallback');
  } catch (err) {
    logFail('sitemap.js: Network exception / timeout handling fallback', err);
  }

  // Test 1.4: Backend returns Malformed JSON (SyntaxError)
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
    }));

    const result = await sitemap();
    assert.strictEqual(result.length, 3);
    logPass('sitemap.js: Malformed JSON syntax error fallback');
  } catch (err) {
    logFail('sitemap.js: Malformed JSON syntax error fallback', err);
  }

  // Test 1.5: Backend returns null / non-object payload
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => null
    }));

    const result = await sitemap();
    assert.strictEqual(result.length, 3);
    logPass('sitemap.js: Null response body fallback');
  } catch (err) {
    logFail('sitemap.js: Null response body fallback', err);
  }

  // Test 1.6: Backend returns data.rooms as non-array (e.g., string or number)
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ rooms: "invalid_string_instead_of_array" })
    }));

    const result = await sitemap();
    assert.strictEqual(result.length, 3);
    logPass('sitemap.js: non-array data.rooms gracefully caught by try-catch');
  } catch (err) {
    logFail('sitemap.js: non-array data.rooms gracefully caught by try-catch', err);
  }

  // Test 1.7: Array containing null, undefined, primitives, objects without id
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        rooms: [null, undefined, 123, "room", {}, { id: null }, { id: "valid-1", is_private: false }]
      })
    }));

    const result = await sitemap();
    assert.strictEqual(result.length, 4); // 3 static + 1 valid public room
    assert.strictEqual(result[3].url, 'https://www.openjam.fun/room/valid-1');
    logPass('sitemap.js: Array filtering out invalid room items');
  } catch (err) {
    logFail('sitemap.js: Array filtering out invalid room items', err);
  }

  // Test 1.8: Date conversion on invalid created_at date strings
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        rooms: [
          { id: 'room-bad-date', is_private: false, created_at: 'invalid-date-string' }
        ]
      })
    }));

    const result = await sitemap();
    const entry = result.find(e => e.url && e.url.includes('room-bad-date'));
    assert.ok(entry, 'Entry with bad date should still be created');
    let toIsoFailed = false;
    try {
      entry.lastModified.toISOString();
    } catch (e) {
      toIsoFailed = true;
    }
    console.log(`  [Observation] invalid created_at ("invalid-date-string") produces NaN Date; toISOString throws RangeError: ${toIsoFailed}`);
    assert.strictEqual(result.length, 4);
    logPass('sitemap.js: Invalid date string handling check');
  } catch (err) {
    logFail('sitemap.js: Invalid date string handling check', err);
  }


  // -------------------------------------------------------------
  // SECTION 2: generateMetadata in app/room/[id]/page.js
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: app/room/[id]/page.js (generateMetadata) ---');

  // Test 2.1: Public Room returns index: true, follow: true
  try {
    mockFetch(async (url) => {
      if (url.includes('/rooms/pub-123')) {
        return {
          ok: true,
          json: async () => ({
            room: {
              id: 'pub-123',
              name: 'Chill Beats',
              description: 'Lofi tunes for studying',
              is_private: false,
              host_name: 'Alex',
              listener_count: 5,
              current_track: {
                track_name: 'Lofi Study',
                artist: 'Beats',
                album_art_url: 'https://example.com/art.jpg'
              }
            }
          })
        };
      }
      return { ok: false, status: 404 };
    });

    const meta = await generateMetadata({ params: Promise.resolve({ id: 'pub-123' }) });
    assert.deepStrictEqual(meta.robots, { index: true, follow: true });
    assert.strictEqual(meta.title, 'Now Playing: Lofi Study by Beats in Chill Beats');
    assert.strictEqual(meta.alternates.canonical, 'https://www.openjam.fun/room/pub-123');
    logPass('generateMetadata: Public room sets robots { index: true, follow: true }');
  } catch (err) {
    logFail('generateMetadata: Public room sets robots { index: true, follow: true }', err);
  }

  // Test 2.2: Private Room returns index: false, follow: false
  try {
    mockFetch(async (url) => {
      if (url.includes('/rooms/priv-456')) {
        return {
          ok: true,
          json: async () => ({
            room: {
              id: 'priv-456',
              name: 'Secret Party',
              is_private: true,
            }
          })
        };
      }
      return { ok: false, status: 404 };
    });

    const meta = await generateMetadata({ params: Promise.resolve({ id: 'priv-456' }) });
    assert.deepStrictEqual(meta.robots, { index: false, follow: false });
    logPass('generateMetadata: Private room sets robots { index: false, follow: false }');
  } catch (err) {
    logFail('generateMetadata: Private room sets robots { index: false, follow: false }', err);
  }

  // Test 2.3: Loading / empty params returns index: false, follow: false
  try {
    const metaLoading = await generateMetadata({ params: Promise.resolve({ id: 'loading' }) });
    assert.deepStrictEqual(metaLoading.robots, { index: false, follow: false });

    const metaEmpty = await generateMetadata({ params: Promise.resolve({}) });
    assert.deepStrictEqual(metaEmpty.robots, { index: false, follow: false });
    logPass('generateMetadata: Loading or missing id returns robots { index: false, follow: false }');
  } catch (err) {
    logFail('generateMetadata: Loading or missing id returns robots { index: false, follow: false }', err);
  }

  // Test 2.4: Backend HTTP 404 / 500 error returns fallback index: false, follow: false
  try {
    mockFetch(async () => ({ ok: false, status: 404 }));
    const meta404 = await generateMetadata({ params: Promise.resolve({ id: 'non-existent' }) });
    assert.deepStrictEqual(meta404.robots, { index: false, follow: false });

    mockFetch(async () => ({ ok: false, status: 500 }));
    const meta500 = await generateMetadata({ params: Promise.resolve({ id: 'error-room' }) });
    assert.deepStrictEqual(meta500.robots, { index: false, follow: false });
    logPass('generateMetadata: Backend HTTP 404/500 returns fallback index: false, follow: false');
  } catch (err) {
    logFail('generateMetadata: Backend HTTP 404/500 returns fallback index: false, follow: false', err);
  }

  // Test 2.5: Backend Network Exception / Timeout returns fallback index: false, follow: false
  try {
    mockFetch(async () => {
      throw new Error('Connection refused');
    });

    const metaTimeout = await generateMetadata({ params: Promise.resolve({ id: 'timeout-room' }) });
    assert.deepStrictEqual(metaTimeout.robots, { index: false, follow: false });
    logPass('generateMetadata: Network exception returns fallback index: false, follow: false');
  } catch (err) {
    logFail('generateMetadata: Network exception returns fallback index: false, follow: false', err);
  }

  // Test 2.6: Backend returns malformed JSON or null data
  try {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ room: null })
    }));

    const metaNull = await generateMetadata({ params: Promise.resolve({ id: 'null-room' }) });
    assert.deepStrictEqual(metaNull.robots, { index: false, follow: false });
    logPass('generateMetadata: Null room in data returns fallback index: false, follow: false');
  } catch (err) {
    logFail('generateMetadata: Null room in data returns fallback index: false, follow: false', err);
  }


  // -------------------------------------------------------------
  // SECTION 3: robots.js Verification
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: robots.js ---');

  try {
    const robotsObj = robots();
    assert.strictEqual(robotsObj.sitemap, 'https://www.openjam.fun/sitemap.xml');
    assert.ok(Array.isArray(robotsObj.rules), 'rules must be an array');
    
    // Check wildcard rule
    const wildcardRule = robotsObj.rules.find(r => r.userAgent === '*');
    assert.ok(wildcardRule, 'Wildcard userAgent * rule must exist');
    assert.strictEqual(wildcardRule.allow, '/');
    assert.deepStrictEqual(wildcardRule.disallow, ['/admin', '/offline', '/_next/']);

    // Check AI crawlers rule
    const aiCrawlers = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
    const aiRule = robotsObj.rules.find(r => 
      Array.isArray(r.userAgent) && aiCrawlers.every(bot => r.userAgent.includes(bot))
    );
    assert.ok(aiRule, 'AI crawlers rule must exist for GPTBot, ClaudeBot, PerplexityBot, Google-Extended');
    assert.ok(aiRule.allow.includes('/room/'), 'AI crawler rule must explicitly allow /room/');
    assert.ok(!aiRule.disallow.includes('/room/'), 'AI crawler rule must NOT disallow /room/');
    assert.deepStrictEqual(aiRule.disallow, ['/admin', '/offline', '/_next/']);

    logPass('robots.js: AI crawler rules and sitemap config match Requirement R1');
  } catch (err) {
    logFail('robots.js: AI crawler rules match Requirement R1', err);
  }

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
