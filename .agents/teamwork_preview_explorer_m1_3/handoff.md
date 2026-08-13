# Handoff Report — Explorer 3 (M1: Search Indexing & Public Room Visibility)

## 1. Observation
- File inspected: `frontend-next/app/robots.js` (lines 1-19):
```javascript
1: export default function robots() {
2:   const baseUrl = "https://www.openjam.fun";
3:   return {
4:     rules: [
5:       {
6:         userAgent: '*',
7:         allow: '/',
8:         disallow: ['/admin', '/offline', '/_next/'],
9:       },
10:       {
11:         userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
12:         allow: ['/', '/privacy', '/terms'],
13:         disallow: ['/room/', '/admin', '/offline', '/_next/'],
14:       }
15:     ],
16:     sitemap: `${baseUrl}/sitemap.xml`,
17:   };
18: }
```
- In `frontend-next/app/robots.js`, lines 10-14 define a specific rule for AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`).
- Line 13 explicitly includes `'/room/'` inside the `disallow` array: `disallow: ['/room/', '/admin', '/offline', '/_next/']`.
- Line 12 lists allowed routes `allow: ['/', '/privacy', '/terms']` which excludes `'/room/'`.
- Standard crawlers (`userAgent: '*'`) in lines 5-9 have `allow: '/'` and `disallow: ['/admin', '/offline', '/_next/']` (which allows `/room/`).

## 2. Logic Chain
1. Requirement R1 and Feature #3 in `PROJECT.md` require public jam rooms (`/room/[id]`) to be crawlable by both search engine crawlers (Googlebot, Bingbot) and AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`).
2. Observation 1 shows standard crawlers (`userAgent: '*'`) have `allow: '/'` and are only disallowed from `/admin`, `/offline`, and `/_next/`. Thus, search engine crawlers already have site-level permission for `/room/`.
3. Observation 1 shows AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) currently have `'/room/'` explicitly disallowed on line 13.
4. Next.js exports `robots.js` into `/robots.txt`. When AI crawlers check `robots.txt`, `Disallow: /room/` blocks them from indexing or fetching public room pages (`/room/[id]`).
5. To grant AI crawlers access to public rooms while keeping internal administrative paths protected:
   - Line 13: `'/room/'` must be removed from `disallow`.
   - Line 12: `'/room/'` should be added to `allow` (`allow: ['/', '/privacy', '/terms', '/room/']`) or updated to `allow: '/'`.
6. Dynamic page-level indexing (blocking private password-protected rooms with `noindex, nofollow`) is handled separately in `app/room/[id]/page.js` metadata based on `room.is_private`, so enabling `/room/` in `robots.js` will not expose private rooms to indexation.

## 3. Caveats
- `robots.js` configures static site-level `robots.txt` rules and cannot evaluate individual room privacy status dynamically per request.
- Per-room indexation control for public (`index: true, follow: true`) vs private (`index: false, follow: false`) rooms is managed in `frontend-next/app/room/[id]/page.js` `generateMetadata()`.
- No syntax caveats: Next.js 16 App Router metadata API natively supports `userAgent` arrays.

## 4. Conclusion & Implementation Guidance for Worker

### Line-by-Line Guidance for Worker:

Target file: `c:/Users/patil/OneDrive/Desktop/open/OpenJam/frontend-next/app/robots.js`

Modify lines 10-14:

**Before:**
```javascript
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: ['/', '/privacy', '/terms'],
        disallow: ['/room/', '/admin', '/offline', '/_next/'],
      }
```

**After:**
```javascript
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: ['/', '/privacy', '/terms', '/room/'],
        disallow: ['/admin', '/offline', '/_next/'],
      }
```

**Complete Target File (`frontend-next/app/robots.js`):**
```javascript
export default function robots() {
  const baseUrl = "https://www.openjam.fun";
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/offline', '/_next/'],
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: ['/', '/privacy', '/terms', '/room/'],
        disallow: ['/admin', '/offline', '/_next/'],
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

## 5. Verification Method
1. **Build Verification**: Run `npm run build` in `frontend-next` directory to confirm `app/robots.js` compiles cleanly without TypeScript/JavaScript syntax errors.
2. **Output Check**: Inspect the rendered `/robots.txt` route output. Confirm `Disallow: /room/` is absent under `User-agent: GPTBot`, `User-agent: ClaudeBot`, `User-agent: PerplexityBot`, and `User-agent: Google-Extended`.
3. **Security Check**: Confirm `Disallow: /admin`, `Disallow: /offline`, and `Disallow: /_next/` remain in place across all `User-agent` blocks.
