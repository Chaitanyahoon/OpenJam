import fs from 'fs';

console.log('--- EMPIRICAL TEST FOR generateMetadata IN room/[id]/page.js ---');

// Extract generateMetadata source code or evaluate it dynamically
const pageContent = fs.readFileSync('frontend-next/app/room/[id]/page.js', 'utf8');

// Isolate generateMetadata implementation
const metaFuncMatch = pageContent.match(/export async function generateMetadata[\s\S]*?\n\}/);
if (!metaFuncMatch) {
  console.error('FAIL: Could not locate generateMetadata in page.js');
  process.exit(1);
}

// We can construct a standalone module string wrapping generateMetadata
const standaloneCode = `
${metaFuncMatch[0].replace('export async function generateMetadata', 'async function generateMetadata')}

export { generateMetadata };
`;

fs.writeFileSync('.agents/teamwork_preview_challenger_m1_1/temp_metadata.mjs', standaloneCode);

const { generateMetadata } = await import('./temp_metadata.mjs');

// Test Case 1: Loading state (id = 'loading')
console.log('\n[TEST METADATA 1] Loading room ID');
const resLoading = await generateMetadata({ params: Promise.resolve({ id: 'loading' }) });
console.log('Loading metadata:', resLoading);
if (resLoading.robots.index !== false || resLoading.robots.follow !== false) {
  console.error('FAIL: Loading state should have robots index: false, follow: false');
  process.exit(1);
}
console.log('✓ TEST METADATA 1 PASSED');

// Test Case 2: Public room (is_private = false)
console.log('\n[TEST METADATA 2] Public room (is_private = false)');
global.fetch = async (url) => {
  if (url.includes('/rooms/public-123')) {
    return {
      ok: true,
      json: async () => ({
        room: {
          id: 'public-123',
          name: 'Rock Party',
          is_private: false,
          host_name: 'Alice',
          listener_count: 5
        }
      })
    };
  }
  return { ok: false };
};

const resPublic = await generateMetadata({ params: { id: 'public-123' } });
console.log('Public room metadata:', resPublic);
if (resPublic.robots.index !== true || resPublic.robots.follow !== true) {
  console.error('FAIL: Public room should have robots index: true, follow: true');
  process.exit(1);
}
if (!resPublic.title.includes('Rock Party')) {
  console.error('FAIL: Title missing room name');
  process.exit(1);
}
console.log('✓ TEST METADATA 2 PASSED');

// Test Case 3: Private room (is_private = true)
console.log('\n[TEST METADATA 3] Private room (is_private = true)');
global.fetch = async (url) => {
  if (url.includes('/rooms/private-456')) {
    return {
      ok: true,
      json: async () => ({
        room: {
          id: 'private-456',
          name: 'Secret Lounge',
          is_private: true,
          host_name: 'Bob',
          listener_count: 2
        }
      })
    };
  }
  return { ok: false };
};

const resPrivate = await generateMetadata({ params: Promise.resolve({ id: 'private-456' }) });
console.log('Private room metadata:', resPrivate);
if (resPrivate.robots.index !== false || resPrivate.robots.follow !== false) {
  console.error('FAIL: Private room should have robots index: false, follow: false');
  process.exit(1);
}
console.log('✓ TEST METADATA 3 PASSED');

// Test Case 4: Fetch error / 404 room
console.log('\n[TEST METADATA 4] Fetch error / non-existent room');
global.fetch = async () => ({ ok: false, status: 404 });

const resError = await generateMetadata({ params: { id: 'missing-999' } });
console.log('Error fallback metadata:', resError);
if (resError.robots.index !== false || resError.robots.follow !== false) {
  console.error('FAIL: Error fallback should have robots index: false, follow: false');
  process.exit(1);
}
console.log('✓ TEST METADATA 4 PASSED');

// Test Case 5: Network Exception
console.log('\n[TEST METADATA 5] Network exception');
global.fetch = async () => { throw new Error('Network error'); };

const resException = await generateMetadata({ params: { id: 'network-err' } });
console.log('Exception fallback metadata:', resException);
if (resException.robots.index !== false || resException.robots.follow !== false) {
  console.error('FAIL: Exception fallback should have robots index: false, follow: false');
  process.exit(1);
}
console.log('✓ TEST METADATA 5 PASSED');

// Cleanup
fs.unlinkSync('.agents/teamwork_preview_challenger_m1_1/temp_metadata.mjs');

console.log('\nALL ROOM METADATA EMPIRICAL TESTS PASSED SUCCESSFULLY!');
