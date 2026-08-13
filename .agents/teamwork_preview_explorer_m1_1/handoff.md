# Handoff Report: Milestone 1 (M1) — Search Indexing & Public Room Visibility Analysis

## 1. Observation

### Codebase Analysis of `frontend-next/app/room/[id]/page.js`
In `frontend-next/app/room/[id]/page.js` (lines 9–97), the `generateMetadata` function generates metadata for jam rooms:

```javascript
// Lines 9-19: Handling invalid or loading IDs
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id || id === 'loading') {
    return {
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room, queue tracks, and stream music with friends.',
      robots: { index: false, follow: false },
    };
  }
```

```javascript
// Lines 35-79: Successful response branch
    if (response.ok) {
      const data = await response.json();
      if (data && data.room) {
        const room = data.room;
        ...
        return {
          title,
          description,
          robots: { index: false, follow: false }, // <--- LINE 56: HARDCODED NOINDEX FOR ALL ROOMS
          alternates: { canonical: 'https://www.openjam.fun' }, // <--- LINE 57: STATIC HOME CANONICAL
          openGraph: { ... },
          twitter: { ... },
        };
      }
    }
```

```javascript
// Lines 85-96: Fallback for fetch error or non-200 response
  // Fallback metadata if fetch fails or room not found
  return {
    title: 'Jam Room — Open Jam',
    description: 'Join a live listening room and discover music together in real-time on Open Jam.',
    robots: { index: false, follow: false },
    alternates: { canonical: 'https://www.openjam.fun' },
    openGraph: { ... }
  };
```

### Backend API Response Structure (`backend/routes/rooms.py`)
- GET `/rooms/{id}` returns JSON containing `data.room`:
  - **Public Room**: `data.room.is_private` is `false`.
  - **Private Room**: `data.room.is_private` is `true`.
  - **Non-existent Room**: returns HTTP 404.

---

## 2. Logic Chain

1. **Current Defect Identification**: Line 56 of `frontend-next/app/room/[id]/page.js` hardcodes `robots: { index: false, follow: false }` for **all** fetched rooms, preventing search engines (Googlebot, Bingbot) from indexing public rooms (`!room.is_private`).
2. **Condition Matrix**:
   - **Invalid or `'loading'` ID** (lines 13-19): `!id || id === 'loading'` evaluates to `true`. Returns early with `robots: { index: false, follow: false }`. (Correct behavior to avoid indexing loading placeholders).
   - **Public Room** (`response.ok` is true, `data.room` exists, and `data.room.is_private` is `false` or falsy): `!data.room.is_private` evaluates to `true`. `robots` MUST evaluate to `{ index: true, follow: true }`.
   - **Private Room** (`response.ok` is true, `data.room` exists, and `data.room.is_private` is `true`): `!data.room.is_private` evaluates to `false`. `robots` MUST evaluate to `{ index: false, follow: false }`.
   - **Fetch Error / 404 / Catch Block** (lines 85-96): Fetch failure or missing room falls through to fallback return object. MUST retain `robots: { index: false, follow: false }`.
3. **Canonical URL Optimization**: Line 57 currently has static `canonical: 'https://www.openjam.fun'`. Changing this to dynamic `canonical: `https://www.openjam.fun/room/${id}`` prevents search engines from duplicate-canonicalizing individual room pages to the root homepage.

---

## 3. Caveats

- **ISR Revalidation Window**: Next.js `fetch` uses `{ next: { revalidate: 30 } }`. If a room transitions between private and public, search engine crawlers will pick up the updated robots header on the next revalidation cycle (within 30 seconds).
- **Backend Availability**: If the backend is unreachable during static generation or SSR metadata execution, `generateMetadata` hits the `catch` block and correctly serves `{ index: false, follow: false }` fallback metadata without throwing errors.

---

## 4. Conclusion & Precise Implementation Guidance for Worker

The Worker should update `frontend-next/app/room/[id]/page.js` in `generateMetadata` as follows:

### Target File
`frontend-next/app/room/[id]/page.js`

### Replacement Lines 53-58
**Current Code:**
```javascript
        return {
          title,
          description,
          robots: { index: false, follow: false },
          alternates: { canonical: 'https://www.openjam.fun' },
```

**Replacement Code:**
```javascript
        const isPublic = !room.is_private;

        return {
          title,
          description,
          robots: isPublic
            ? { index: true, follow: true }
            : { index: false, follow: false },
          alternates: { canonical: `https://www.openjam.fun/room/${id}` },
```

---

## 5. Verification Method

### Code Inspection
Inspect `frontend-next/app/room/[id]/page.js`:
- Confirm line 17 retains `robots: { index: false, follow: false }` for loading/invalid IDs.
- Confirm line 56 uses `!room.is_private ? { index: true, follow: true } : { index: false, follow: false }`.
- Confirm line 89 retains `robots: { index: false, follow: false }` for error/404 fallbacks.

### Test Scenarios Matrix
1. **Public Room (`is_private: false`)**: `generateMetadata` returns `{ robots: { index: true, follow: true } }`.
2. **Private Room (`is_private: true`)**: `generateMetadata` returns `{ robots: { index: false, follow: false } }`.
3. **Loading ID (`id: 'loading'`)**: `generateMetadata` returns `{ robots: { index: false, follow: false } }`.
4. **Invalid / 404 Room**: `generateMetadata` returns `{ robots: { index: false, follow: false } }`.

### Project Verification Commands
Run build inside `frontend-next`:
```bash
cd frontend-next
npm run build
```
Ensure build completes with 0 errors.
