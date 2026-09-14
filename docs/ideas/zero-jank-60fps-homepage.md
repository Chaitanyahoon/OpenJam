# OpenJam: Zero-Jank 60fps Homepage Engine

## Problem Statement

How might we transform the OpenJam homepage into an ultra-fluid 60fps experience across all devices while preserving its signature 3D visual dome on desktop and delivering an equally delightful, hardware-accelerated experience on mobile?

---

## Recommended Direction

We converge on an **Adaptive Hero Architecture with GPU Compositor Isolation and Reference Stability**:

1. **Adaptive Viewport Split (Desktop 3D Dome vs. Mobile 2D Vinyl Carousel):**
   - **Desktop (> 768px):** Keep the full 3D visual density, perspective depth, and drag-to-spin physics of the Dome Gallery. Equip it with an `IntersectionObserver` that completely pauses RAF loops, inertia calculations, and transforms when the user scrolls past the hero section.
   - **Mobile (<= 768px or Touch Devices):** Automatically swap out the heavy 175-node 3D dome for a sleek, native-feel **2D Vinyl Carousel**. Features horizontal touch-snapping, album covers with rotating vinyl disc accents, song titles, and instantaneous 1-tap track preview playing. Zero CSS 3D matrix math; runs at a locked 60fps on any smartphone.

2. **RAF-Batched Transform Engine for Cursor Glow:**
   - Eliminate continuous layout thrashing from `style.left` and `style.top` inside mouse event listeners.
   - Batch coordinates into `requestAnimationFrame` and apply via GPU compositor transform: `translate3d(x, y, 0) translate(-50%, -50%)`.
   - Replace the heavy `mix-blend-mode: screen` and 700px blur with an optimized multi-stop alpha radial gradient.
   - Completely disable cursor glow event listeners and hide DOM node on mobile and coarse pointer devices via `@media (pointer: coarse)`.

3. **Track Signature Memoization for 15s Room Polling:**
   - Derive a deterministic string signature from active room tracks (`tracks.map(t => t.track_uri).join(',')`).
   - Only produce a new `computedDomeTracks` array reference when the tracks actually change, preventing the 15-second polling tick from tearing down and re-rendering all dome items.

4. **Offscreen Content Containment:**
   - Apply `content-visibility: auto; contain-intrinsic-size: 800px;` to `#active-rooms`, `#faq`, and `#offline-library` so the browser skips rendering offscreen DOM nodes until scrolled into view.

---

## Key Assumptions to Validate

- [ ] **Mobile Carousel Conversion:** Validate that mobile visitors find the 2D vinyl carousel just as engaging for previewing and creating rooms as the desktop 3D dome, with 0 touch latency.
- [ ] **Compositor Efficiency:** Validate in Chrome DevTools Performance panel that moving the cursor produces 0 forced synchronous layouts (`Layout Clean` maintained, 0 yellow warning flags).
- [ ] **Hydration Parity:** Ensure responsive switching between mobile carousel and desktop dome avoids hydration mismatch warnings in Next.js SSR.

---

## MVP Scope

### In Scope
- **HeroSection Adaptive Switcher:**
  - Viewport detection hook / media query for desktop vs mobile.
  - Desktop: Pausable 3D DomeGallery with IntersectionObserver.
  - Mobile: Hardware-accelerated 2D Vinyl Carousel with touch swiping and 1-tap preview integration.
- **HomeClient Performance Hardening:**
  - RAF-batched cursor follower with `translate3d`.
  - Elimination of `getBoundingClientRect()` on mousemove inside `HeroSection.js`.
  - Memoized `computedDomeTracks` tied to track URI signatures to eliminate 15-second re-render churn.
  - Media query disabling of cursor glow on touch screens.
- **CSS Compositor Optimization:**
  - Elimination of `mix-blend-mode: screen` on `.cursor-glow`.
  - Application of `content-visibility: auto` to offscreen sections.

### Not Doing (and Why)
- **Migrating DomeGallery to WebGL / Three.js:** Unnecessary bundle weight (an extra ~150KB gzip) and complexity when CSS `translate3d` and responsive culling achieve 60fps natively.
- **Removing Preview Audio Playback:** The ability to click an album tile and preview the music is a core signature differentiator for OpenJam and must remain intact on both desktop and mobile.
- **Eliminating Glassmorphism Entirely:** The amber/noir glass aesthetic defines OpenJam; we achieve high performance through compositor containment rather than flattening the brand identity.

---

## Open Questions

- *Do we want the mobile vinyl carousel to gently auto-scroll when idle, or remain strictly touch-driven?* (Recommendation: strictly touch-driven with subtle initial float to maximize battery life).
