# Handoff Report — M1 Explorer 2: Dynamic Sitemap Implementation Analysis

## 1. Observation

### Current Implementation of `frontend-next/app/sitemap.js`
File: `frontend-next/app/sitemap.js` (24 lines total):
```js
1: export default function sitemap() {
2:   const baseUrl = "https://www.openjam.fun";
3:   return [
4:     {
5:       url: baseUrl,
6:       lastModified: new Date(),
7:       changeFrequency: 'daily',
8:       priority: 1.0,
9:     },
10:     {
11:       url: `${baseUrl}/privacy`,
12:       lastModified: new Date(),
13:       changeFrequency: 'monthly',
14:       priority: 0.5,
15:     },
16:     {
17:       url: `${baseUrl}/terms`,
18:       lastModified: new Date(),
19:       changeFrequency: 'monthly',
20:       priority: 0.5,
21:     },
22:   ];
23: }
```

### Backend API Interface & Data Models
- Endpoint: GET `/rooms` in `backend/routes/rooms.py` (lines 19-70). Accepts `limit` parameter (e.g. `GET /rooms?limit=100`).
- Response payload: `{"rooms": [room_dict_1, room_dict_2, ...], "total": count}`
- Room fields in `room_dict` (`backend/models/room.py` lines 35-49):
  - `id`: Room UUID string (e.g., `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`)
  - `name`: Room name string
  - `is_private`: Boolean (`true` for password-protected rooms, `false` for public rooms)
  - `is_active`: Boolean (`true` for active rooms)
  - `created_at`: ISO datetime string (e.g., `"2026-08-13T14:00:00Z"`)

### Backend Base URL Handling in Frontend
In `frontend-next/app/room/[id]/page.js` (lines 22-30), the standard backend URL resolver pattern is:
```js
const getBackendUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '');
    }
  }
  return 'https://api.openjam.fun';
};
```

---

## 2. Logic Chain

1. **Async Signature**: Next.js App Router allows `sitemap()` in `app/sitemap.js` to be an `async` function (`export default async function sitemap()`).
2. **Static Route Preservation**: Static entries (Homepage `/`, `/privacy`, `/terms`) should be declared first.
3. **Backend Base URL Resolution**: Using `getBackendUrl()`, the helper checks `process.env.NEXT_PUBLIC_BACKEND_URL` and defaults to `'https://api.openjam.fun'`.
4. **Fetching Active Public Rooms**:
   - Perform `fetch(`${backendUrl}/rooms?limit=100`, { next: { revalidate: 60 } })`.
   - The `{ revalidate: 60 }` cache option ensures Next.js re-evaluates the room list periodically (every 60 seconds) without pounding the backend on every search crawler request.
5. **Public Room Filtering**:
   - Check `if (response.ok)`.
   - Parse JSON: `const data = await response.json()`.
   - Extract `const rooms = data?.rooms || []`.
   - Filter `!r.is_private` (and verify `r.id` exists): `rooms.filter((r) => r && r.id && !r.is_private)`.
6. **Sitemap Entry Formatting**:
   - Map each filtered public room into a Next.js sitemap object:
     - `url`: `${baseUrl}/room/${room.id}`
     - `lastModified`: `room.created_at ? new Date(room.created_at) : new Date()`
     - `changeFrequency`: `'hourly'`
     - `priority`: `0.8`
7. **Static Build Resilience & Fallback**:
   - Wrap backend fetch logic in a `try...catch` block.
   - If the backend server is unreachable during `npm run build` static generation, catch the error, issue `console.warn(...)`, and return `staticEntries`. This ensures `npm run build` never fails due to network/backend unavailability.

---

## 3. Caveats

- **Build Time Backend Off-Line State**: During `npm run build` in CI/CD or build environments without a running backend server, `fetch()` will throw a network error. The `try / catch` fallback ensures static build succeeds cleanly with static routes.
- **Private Room Privacy**: Private password-protected rooms (`is_private: true`) MUST be filtered out (`!r.is_private`). Exposing private room URLs in `sitemap.xml` would compromise user privacy and cause search engines to index login-walled pages.
- **Limit Cap**: Querying `limit=100` returns up to 100 active rooms, which is sufficient for current platform capacity.

---

## 4. Conclusion & Implementation Guidance for Worker

### Replacement File Content for `frontend-next/app/sitemap.js`

```javascript
export default async function sitemap() {
  const baseUrl = 'https://www.openjam.fun';

  const staticEntries = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const getBackendUrl = () => {
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
      const url = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
        return url.replace(/\/$/, '');
      }
    }
    return 'https://api.openjam.fun';
  };

  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rooms?limit=100`, {
      next: { revalidate: 60 },
    });

    if (response.ok) {
      const data = await response.json();
      const rooms = data?.rooms || [];
      const publicRooms = rooms.filter((r) => r && r.id && !r.is_private);

      const roomEntries = publicRooms.map((room) => ({
        url: `${baseUrl}/room/${room.id}`,
        lastModified: room.created_at ? new Date(room.created_at) : new Date(),
        changeFrequency: 'hourly',
        priority: 0.8,
      }));

      return [...staticEntries, ...roomEntries];
    }
  } catch (error) {
    console.warn('Sitemap build: Could not fetch active rooms from backend', error?.message || error);
  }

  return staticEntries;
}
```

---

## 5. Verification Method

### Step-by-Step Verification Instructions

1. **Build Validation**:
   - Run `cd frontend-next && npm run build`
   - Verify build completes with 0 errors and generates `/sitemap.xml`.
2. **Sitemap Logic Verification**:
   - Check that static pages (`/`, `/privacy`, `/terms`) are present in output array.
   - Verify that when backend `/rooms` returns public rooms, entries for `/room/[id]` are added with `priority: 0.8` and `changeFrequency: 'hourly'`.
   - Verify that private rooms (`is_private: true`) are excluded.
3. **Fallback Invalidation Condition**:
   - If backend fetch throws network error, function must catch exception and safely return static entries without throwing an unhandled rejection.
