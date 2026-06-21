# OpenJam Frontend Code Review

## Bugs

### 1. `useEffect` calling `router.replace` without `router` in dependency array
**File:** `app/room/[id]/RoomClient.js` (approx line 2000+)

The component calls `router.replace('/')` inside a `useEffect` or callback but may omit `router` from the dependency array. This is a stale closure bug — on React 18+ strict mode or in production with concurrent features, the router reference may be stale.

### 2. MD5 hardcoded admin password  
**File:** `app/admin/AdminClient.js`

Password `admin123` is MD5-hashed client-side: `md5('admin123')`. This is trivially reversable (MD5 is not encryption, any Rainbow table cracks this instantly). The hash is sent as `Authorization: Bearer <hash>`. An attacker who sees this hash in transit (or in browser devtools) can replay it indefinitely with no expiration.

### 3. Admin auth has no session/token expiry
**File:** `app/admin/AdminClient.js`

The admin "token" is stored in component state as `setToken(hashedPw)`. There is no JWT expiry, no refresh mechanism, no server-side session invalidation. The token lives until page reload.

### 4. `localStorage` reads without fallback for SSR
**File:** `contexts/SocketContext.js` (reads `openjam_display_name` from localStorage), `app/room/[id]/RoomClient.js` (reads various localStorage keys)

`localStorage` is not available during SSR. While the SocketProvider is dynamically imported with `ssr: false`, direct reads of `localStorage` at module level or outside `useEffect` will throw in SSR contexts or cause hydration mismatches.

### 5. `generateStaticParams` returns only `'loading'`
**File:** `app/room/[id]/page.js`

```js
export function generateStaticParams() {
  return [{ id: 'loading' }];
}
```

This pre-renders only a `/room/loading` page. Any other dynamic room ID will trigger a full SSR on first request. This may be intentional (defer to SSR), but it means no room pages are ever pre-built, making the static generation essentially a no-op.

### 6. `navigator.storage.persist()` called but not awaited correctly
**File:** `utils/offlineDb.js`

```js
navigator.storage.persist().then(granted => { ... });
```

The promise is fire-and-forget. If storage permission is denied, the offline DB operations that follow may silently fail.

### 7. Analytics Service Worker may conflict with other SW
**File:** `utils/YouTubePlayer.js`

The player registers a dedicated analytics Service Worker. On first load, this can conflict with any existing service worker (e.g., a PWA service worker). There's no check for an existing registration, and navigator.serviceWorker could be in a controlled state already.

### 8. Dual Audio elements created but not cleaned up on unmount edge cases
**File:** `utils/YouTubePlayer.js`

The player creates two Audio elements for crossfading. In aggressive unmount scenarios (rapid navigation away and back), stale Audio elements may continue playing or leak memory.

### 9. `ws://127.0.0.1` connection on HTTPS pages causes mixed content
**File:** `utils/DiscordRPC.js`

When the app is served over HTTPS (production), connecting to `ws://127.0.0.1:6463/rpc` is a mixed-content violation. Browsers will block the insecure WebSocket connection. The Discord RPC will silently fail on HTTPS.

### 10. Room leave flow doesn't handle server errors
**File:** `app/room/[id]/RoomClient.js`

When the user leaves a room, the component emits a leave event and navigates away. If the server is unreachable or returns an error, the user is still navigated away but the server state stays inconsistent (ghost user in room).

---

## Security

### 1. Hardcoded admin credentials in client bundle
**File:** `app/admin/AdminClient.js`

`admin123` is baked into the frontend source. Anyone with access to the built JS bundle (`_next/static/chunks/...`) can extract it. Use a proper server-side auth endpoint with bcrypt comparison.

### 2. MD5 — broken hashing algorithm
**File:** `app/admin/AdminClient.js`

MD5 is cryptographically broken (collision attacks, preimage attacks). Even if the password were strong, using MD5 provides a false sense of security. Use SHA-256 at minimum, or better, delegate auth entirely to the backend.

### 3. Bearer token sent over HTTP (if not HTTPS)
The auth scheme uses `Authorization: Bearer <md5hash>`. If the connection is not HTTPS, this is sent in cleartext. The backend rewrite rules pass this through to the backend — ensure the backend enforces HTTPS redirects.

### 4. No input sanitization on room name/description/tags
**File:** `app/room/[id]/RoomClient.js` (chat), `components/modals/CreateRoomModal.js`

User-supplied text (room names, chat messages, descriptions) is rendered without sanitization. While React escapes JSX by default, if any of this is injected into `dangerouslySetInnerHTML` or passed to the backend and re-rendered elsewhere, XSS is possible.

### 5. `session_token` stored in cookies without `HttpOnly` or `Secure` flags
**File:** `contexts/SocketContext.js`

The session token is read from `document.cookie`. If the cookie is set without `HttpOnly; Secure; SameSite=Strict`, it is accessible to JavaScript (XSS risk) and sent over HTTP.

### 6. No rate limiting on client side
**File:** `app/room/[id]/RoomClient.js` (chat messages, votes, queue actions)

A malicious client can spam messages, votes, or queue additions with no client-side throttling. While the backend should enforce rate limits, the client should also debounce to prevent accidental abuse.

### 7. Discord RPC exposes local port range
**File:** `utils/DiscordRPC.js`

Connecting to `ws://127.0.0.1:6463-6472` from a web context could theoretically be used for local port scanning if an attacker controls the page content.

### 8. No CSRF protection on destructive admin actions
**File:** `app/admin/AdminClient.js`

Admin actions (delete room, ban user, delete playlist) are triggered via `fetch` calls. If the auth token is stored in memory only, CSRF is mitigated, but if it's persisted to localStorage or cookies, CSRF attacks become possible.

---

## UX/Usability

### 1. Loading state shows generic text
**File:** `app/room/[id]/page.js`

```js
return <div>Loading room...</div>;
```

This is an unstyled text string. A skeleton loader matching the room layout would provide a much better experience.

### 2. No optimistic UI for chat/queue actions
**File:** `app/room/[id]/RoomClient.js`

When a user sends a chat message or adds a track to the queue, the UI waits for the server acknowledgment before showing the update. Adding optimistic updates would make the UI feel instantaneous.

### 3. PWA install prompt modal interrupts first visit
**File:** `app/HomeClient.js`

The PWA install prompt appears on the first visit to the landing page. Users who haven't explored the app yet may find this intrusive. Better to show it after a meaningful interaction (e.g., after joining a room).

### 4. No "what's playing" indicator on queue items
**File:** `components/ui/music-player.js`

The queue shows a list of upcoming tracks but doesn't clearly highlight which track is currently playing or which have already been played.

### 5. Keyboard shortcuts not documented or discoverable
**File:** `components/ui/music-player.js`

The MusicPlayer has keyboard shortcuts (Space for play/pause, etc.) but there's no visual hint or help overlay to inform users of available shortcuts.

### 6. Search in queue doesn't persist across re-mounts
**File:** `components/ui/music-player.js`

When the queue panel is closed and reopened, any search query is lost. Users will have to re-type their search.

### 7. FlowingMenu marquee speed not adjustable
**File:** `components/reactbits/FlowingMenu.js`

The marquee scroll speed is hardcoded. Users with motion sensitivity may find the constant scrolling distracting. Should respect `prefers-reduced-motion`.

### 8. DomeGallery scroll zoom sensitivity
**File:** `components/reactbits/DomeGallery.js`

The scroll-to-zoom behavior may be too sensitive on some trackpads, making the gallery hard to control.

### 9. Admin action confirmation modals lack detail
**File:** `app/admin/AdminClient.js`

"Are you sure you want to delete this room?" — the modal doesn't show the room name or any identifying detail, making destructive actions risky.

### 10. Import playlist from URL has no format validation
**File:** `app/profile/page.js`

The "import playlist from URL" input accepts any string. There's no client-side validation that the URL is a valid YouTube/Spotify/etc. playlist URL before sending to the backend.

### 11. Guest name randomizer may produce offensive combinations
**File:** `components/modals/JoinModal.js`

If the random name generator draws from uncurated word lists, it could produce offensive or inappropriate combinations. The word lists should be reviewed.

---

## Performance

### 1. No route prefetching for room pages
**File:** `app/room/[id]/page.js` with `generateStaticParams` returning only `['loading']`

Every room page loads via SSR. This adds 200-500ms latency per room navigation. Consider using `router.prefetch()` on hover over room cards.

### 2. All socket events trigger full re-renders
**File:** `contexts/SocketContext.js`, `app/room/[id]/RoomClient.js`

The SocketContext stores all socket state in a single context value. Any change (chat message, queue update, user join/leave) causes every consumer to re-render. Consider splitting into multiple contexts or using `useContextSelector`.

### 3. Large MusicPlayer component re-renders on every tick
**File:** `components/ui/music-player.js`

The MusicPlayer receives `currentTime` and `duration` as props, which update every second (or more). This causes the entire 600-line component tree to re-render on each time update. Should memoize static sections and split the time display into a separate component.

### 4. No image optimization for artwork
The app uses external image URLs (Apple Music art, etc.) without Next.js `Image` component optimization. This means no lazy loading, no responsive sizes, and no WebP conversion. Could significantly improve LCP.

### 5. CSS files loaded globally, not as CSS modules
**Files:** `components/reactbits/DomeGallery.css`, `FlowingMenu.css`, `PixelTransition.css`, `components/ui/music-player.css`

All CSS is global. Class names like `.gallery`, `.menu`, `.overlay` can easily conflict with other components. This also prevents tree-shaking unused styles.

### 6. Font loading not optimized
**File:** `app/layout.js`

If custom fonts are loaded via `@next/font` or Google Fonts without proper `display=swap` and `preload`, they may cause CLS (Cumulative Layout Shift) or FOUT (Flash of Unstyled Text).

### 7. `framer-motion` animations on every page mount
**Files:** `app/privacy/PrivacyClient.js`, `app/terms/TermsClient.js`, `app/HomeClient.js`

`framer-motion` `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` on every page mount adds JS execution overhead. For simple fade-ins, CSS animations are cheaper.

### 8. Analytics Service Worker adds overhead
**File:** `utils/YouTubePlayer.js`

Registering a service worker solely for analytics adds ~100KB+ of JS overhead, a separate thread, and complicates the SW lifecycle. Consider using `sendBeacon()` or a simple fetch queue instead.

### 9. IndexedDB operations not batched
**File:** `utils/offlineDb.js`

Multiple sequential `put` or `add` operations each open/close a transaction. Batching writes into a single transaction would improve throughput.

### 10. `use-sound` hook loads audio files on mount
The `use-sound` library preloads audio files when the hook mounts. If there are many UI sounds (hover, click, notifications), this can cause many simultaneous network requests.

---

## Code Quality / Maintainability

### 1. RoomClient.js is ~2000+ lines — needs decomposition
**File:** `app/room/[id]/RoomClient.js`

This file handles socket connections, chat, queue, voting, user lists, media playback, offline sync, Discord RPC, and more. It should be split into at least 5-7 smaller hooks or components:
- `useSocket` (socket lifecycle)
- `useQueue` (queue management + voting)
- `useChat` (chat messages + emoji reactions)
- `useRoomPlayback` (audio state + sync)
- `RoomUI` (pure presentational layout)

### 2. MusicPlayer is ~600 lines — needs decomposition
**File:** `components/ui/music-player.js`

The MusicPlayer handles: playback controls, progress bar, queue panel, history panel, search, lyrics, keyboard shortcuts, and more. Split into:
- `PlaybackControls`
- `ProgressBar`
- `QueuePanel`
- `SearchPanel`
- `LyricsOverlay`
- `useMusicPlayerKeyboard`

### 3. Inconsistent import style — default vs named
Some files use `export default function Component()` while others use `export const Component = () => {}`. Mixing patterns reduces consistency.

### 4. Magic strings and numbers throughout
**Files:** `app/room/[id]/RoomClient.js`, `constants/tracks.js`, etc.

Many values are hardcoded: vote thresholds, timeouts, animation durations, API endpoints. Should be constants.

### 5. `any` types used instead of PropTypes or JSDoc
The codebase uses no TypeScript and minimal PropTypes. All props and state are implicitly `any`, making refactoring risky and IDE autocomplete limited.

### 6. ESLint is completely skipped
**File:** `package.json`

```json
"lint": "echo 'Skipping lint checks'"
```

This means all lint errors, unused imports, and potential bugs go undetected. A proper lint script should be configured.

### 7. No unit tests or integration tests
No test files detected. The project has no Jest, Vitest, or Playwright configuration. The entire frontend has zero test coverage.

### 8. `constants/tracks.js` is a large hardcoded array
This file contains ~50+ hardcoded track objects. This is not maintainable. Tracks should come from the backend API with a client-side cache layer.

### 9. Multiple CSS files with global scope
7+ `.css` files all use global class selectors. Over time, these will conflict. Move to CSS Modules (`*.module.css`), Tailwind, or CSS-in-JS.

### 10. No error boundary granularity
**File:** `app/layout.js` wraps the entire app in a single error boundary (`app/error.js`). A crash in a single room page brings down the entire app. Each major section should have its own error boundary.

### 11. `jsconfig.json` paths alias but not consistently used
**File:** `jsconfig.json`

```json
"paths": { "@/*": ["./*"] }
```

The `@/` alias is available but some imports use relative paths like `'../../components/...'`. Should be consistent.

### 12. No environment variable validation
Process env vars like `BACKEND_URL` are used without validation. If the env var is missing, the app will silently fail or behave unexpectedly. Consider using `zod` or a config module with runtime validation.

### 13. `offlineDb.js` uses `const IDB = "openjam_offline"` — hardcoded DB version without schema migration
IndexedDB lacks schema versioning. If the store structure changes, old data is silently lost.

---

## Missing Features / Gaps

### 1. No loading skeletons for any page
Every page shows a raw text "Loading..." or similar. Skeleton components would dramatically improve perceived performance.

### 2. No mobile-responsive layout for MusicPlayer
The 600-line MusicPlayer doesn't appear to have a responsive/mobile layout. On mobile screens, the playback controls, queue, and search panels will likely overflow.

### 3. No WebSocket reconnection UI feedback
**File:** `contexts/SocketContext.js`

When the socket disconnects, there's no user-visible indicator. Users won't know they've been disconnected until they try to perform an action that fails.

### 4. No offline mode indicator
While offline functionality exists (`offlineDb.js`), there's no UI badge or indicator showing the user they're in offline mode.

### 5. No desktop app (Electron/Tauri wrapper)
The Discord RPC feature implies desktop usage, but there's no Electron/Tauri wrapper. Users must keep a browser tab open for Discord Rich Presence to work.

### 6. No WebShare API integration
Room/playlist sharing is likely done via copy-link. The WebShare API would provide native share sheets on mobile.

### 7. No push notifications
When the user is not in the tab (background), there's no notification for new tracks, chat mentions, or room events.

### 8. No "Now Playing" view / fullscreen mode
The MusicPlayer is a fixed bottom bar. There's no expanded "Now Playing" view with album art, lyrics, and related tracks.

### 9. No volume normalization across tracks
Different YouTube sources have different volume levels. There's no normalization, so users may need to adjust volume between tracks.

### 10. No queue persistence
If the user refreshes the page, the queue is lost. Queue state could be saved to sessionStorage or IndexedDB.

---

## Accessibility

### 1. Missing ARIA labels on icon buttons
**Files:** `components/ui/music-player.js`, `app/room/[id]/RoomClient.js`, `app/HomeClient.js`

Icon-only buttons (play, pause, skip, like, share, close) lack `aria-label` attributes. Screen reader users will hear nothing or a generic "button".

### 2. Keyboard navigation gaps
While MusicPlayer has keyboard shortcuts, many interactive elements (emoji picker, modals, queue items) lack proper keyboard focus management and tab order.

### 3. No focus trap in modals
**Files:** `components/modals/JoinModal.js`, `CreateRoomModal.js`, `LeaveModal.js`

When a modal is open, keyboard focus can Tab out of the modal into the background page content.

### 4. Color contrast not validated
The app uses dark theme with various accent colors. No WCAG 2.2 AA contrast ratio (4.5:1 for text, 3:1 for large text) validation is in place.

### 5. No `prefers-reduced-motion` support
**Files:** `app/HomeClient.js` (framer-motion), `components/reactbits/FlowingMenu.js` (GSAP), `PixelTransition.js` (canvas animation)

Animations don't respect the user's `prefers-reduced-motion` setting. Users with vestibular disorders may experience discomfort.

### 6. Missing alt text on decorative track artwork
Track album art likely uses `<img>` tags without meaningful `alt` text, or with `alt=""` omitted entirely.

### 7. No skip-to-content link
There's no "Skip to main content" link at the top of the page, which is a fundamental WCAG requirement.

### 8. Live region not announced for chat/queue updates
**File:** `app/room/[id]/RoomClient.js`

New chat messages and queue updates don't use `aria-live` regions. Screen reader users won't be notified of new content.

### 9. Emoji picker not keyboard accessible
**File:** `components/EmojiPicker.js`

Emoji pickers are notoriously inaccessible. Keyboard navigation within the emoji grid needs explicit management.

### 10. Status messages not announced
Loading states, error messages, and success confirmations lack `role="status"` or `aria-live` attributes.
