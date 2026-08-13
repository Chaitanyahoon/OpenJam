import robots from '../../frontend-next/app/robots.js';
import sitemap from '../../frontend-next/app/sitemap.js';

console.log('--- EMPIRICAL TEST FOR M1 ---');

// Test 1: Verify robots() function return structure
console.log('\n[TEST 1] robots() verification');
const robotsResult = robots();
console.log('Robots output:', JSON.stringify(robotsResult, null, 2));

const generalRule = robotsResult.rules.find(r => r.userAgent === '*');
const aiRule = robotsResult.rules.find(r => Array.isArray(r.userAgent) && r.userAgent.includes('GPTBot'));

let test1Passed = true;
if (!generalRule || generalRule.allow !== '/' || !generalRule.disallow.includes('/admin')) {
  console.error('FAIL: General crawler rule incorrect');
  test1Passed = false;
}

if (!aiRule || !aiRule.userAgent.includes('ClaudeBot') || !aiRule.userAgent.includes('PerplexityBot') || !aiRule.userAgent.includes('Google-Extended')) {
  console.error('FAIL: AI crawlers missing from userAgent list');
  test1Passed = false;
}

if (!aiRule.allow.includes('/room/')) {
  console.error('FAIL: /room/ not allowed for AI crawlers');
  test1Passed = false;
}

if (robotsResult.sitemap !== 'https://www.openjam.fun/sitemap.xml') {
  console.error('FAIL: sitemap URL incorrect');
  test1Passed = false;
}

if (test1Passed) {
  console.log('✓ TEST 1 PASSED: robots.js is fully compliant.');
}

// Test 2: sitemap() fallback handling (when backend fetch fails)
console.log('\n[TEST 2] sitemap() offline fallback verification');
const staticSitemap = await sitemap();
console.log('Sitemap offline count:', staticSitemap.length);
console.log('Sitemap offline entries:', staticSitemap);

let test2Passed = true;
if (staticSitemap.length !== 3) {
  console.error(`FAIL: Expected 3 static entries when offline, got ${staticSitemap.length}`);
  test2Passed = false;
}
if (!staticSitemap.some(e => e.url === 'https://www.openjam.fun') ||
    !staticSitemap.some(e => e.url === 'https://www.openjam.fun/privacy') ||
    !staticSitemap.some(e => e.url === 'https://www.openjam.fun/terms')) {
  console.error('FAIL: Missing static sitemap URLs');
  test2Passed = false;
}

if (test2Passed) {
  console.log('✓ TEST 2 PASSED: sitemap.js fallback works correctly when backend is offline.');
}

// Test 3: sitemap() with mock backend fetching public & private rooms
console.log('\n[TEST 3] sitemap() dynamic fetching verification');
const originalFetch = global.fetch;

global.fetch = async (url) => {
  if (url.includes('/rooms?limit=100')) {
    return {
      ok: true,
      json: async () => ({
        rooms: [
          { id: 'public-room-1', name: 'Public Room 1', is_private: false, created_at: '2026-01-01T00:00:00Z' },
          { id: 'private-room-2', name: 'Private Room 2', is_private: true, created_at: '2026-01-01T00:00:00Z' },
          { id: 'public-room-3', name: 'Public Room 3', is_private: false },
          { id: null, name: 'Invalid Room', is_private: false },
        ]
      })
    };
  }
  return { ok: false };
};

const dynamicSitemap = await sitemap();
console.log('Sitemap dynamic count:', dynamicSitemap.length);
console.log('Sitemap dynamic entries:', dynamicSitemap);

let test3Passed = true;
const roomEntries = dynamicSitemap.filter(e => e.url.includes('/room/'));
if (roomEntries.length !== 2) {
  console.error(`FAIL: Expected 2 public room entries, got ${roomEntries.length}`);
  test3Passed = false;
}

if (roomEntries.some(e => e.url.includes('private-room-2'))) {
  console.error('FAIL: Private room included in sitemap!');
  test3Passed = false;
}

if (!roomEntries.some(e => e.url === 'https://www.openjam.fun/room/public-room-1') ||
    !roomEntries.some(e => e.url === 'https://www.openjam.fun/room/public-room-3')) {
  console.error('FAIL: Expected public rooms missing from sitemap');
  test3Passed = false;
}

if (roomEntries.find(e => e.url.includes('public-room-1'))?.priority !== 0.8 ||
    roomEntries.find(e => e.url.includes('public-room-1'))?.changeFrequency !== 'hourly') {
  console.error('FAIL: Room entry priority or changeFrequency incorrect');
  test3Passed = false;
}

if (test3Passed) {
  console.log('✓ TEST 3 PASSED: sitemap.js dynamically filters public rooms with priority 0.8 & hourly frequency.');
}

// Reset fetch
global.fetch = originalFetch;

console.log('\n--- VERIFICATION SUMMARY ---');
if (test1Passed && test2Passed && test3Passed) {
  console.log('ALL FRONTEND METADATA TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exit(1);
}
