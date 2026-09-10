# OpenJam Typography & Design System Specification

## 1. Problem Statement
OpenJam's visual layer previously exhibited subtle typographic inconsistencies across components:
- **Font Face Fragmentation:** Body and UI elements alternated between `Poppins`, `Inter`, raw `system-ui`, and generic `sans-serif` fallbacks across different pages (e.g. profile, playlist, modal popovers, and 3D Dome Gallery).
- **Suboptimal Readability in Dense Audio UI:** `Poppins` features wide circular bowls and loose kerning that occupy excessive horizontal space in music track queues, chat feeds, and tight metadata badges.
- **Number Jitter in Timers & Latency Badges:** Elapsed track times (`02:45 / 03:12`), volume percentages (`100%`), and NTP clock sync metrics (`±12ms`) experienced horizontal jitter when proportional numerals shifted character widths on increment.
- **Unrefined Heading Rhythm:** Headings were missing optical negative tracking, leading to loose letter spacing on high-resolution displays.

## 2. Recommended Direction: Ultra-Sleek Modern Streaming

OpenJam adopts the modern high-end audio streaming standard (reminiscent of Apple Music, Spotify, and Linear):

| Role | Font Family | Source | Weights | Purpose & Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| **UI & Body** | `Plus Jakarta Sans` | `next/font/google` | 300, 400, 500, 600, 700, 800 | Geometric yet condensed, crisp hinting, ultra-legible in queues, chat, buttons, and subtext. |
| **Display & Headers** | `Outfit` | `next/font/google` | 400, 500, 600, 700, 800, 900 | High personality, warm curved geometry, pairs seamlessly with the analog vinyl aesthetic. |
| **Metrics & Code** | `JetBrains Mono` | `next/font/google` | 400, 500, 600, 700 | Tabular numerals (`tnum`), zero width drift for playback timers, offsets, and NTP ping badges. |
| **Brand Retro Wordmark** | `Righteous` | `next/font/google` | 400 | Preserved exclusively for the `.navbar-logo` retro analog brand emblem. |

## 3. Typographic Hierarchy & Scale

```css
/* Display & Brand Headings */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  letter-spacing: -0.025em;
  line-height: 1.15;
  font-weight: 700;
}

/* Base Body & UI */
body, input, textarea, select, button {
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Timers, Durations, and Counters */
.tabular-nums, .timer-text, .stat-number, .mp-times, .queue-item-dur, .music-pill-time {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
```

## 4. Key Assumptions & Constraints
- **Zero CLS & Local Asset Optimization:** All Google Fonts are loaded exclusively via `next/font/google` at build time. No external `<link href="https://fonts.googleapis.com...">` tags are used, preventing render blocking and layout shifts.
- **Cross-Platform Consistency:** Eliminates reliance on arbitrary OS defaults (`sans-serif`, raw `system-ui`) on error/fallback views, ensuring identical rendering across Windows, macOS, iOS, and Android.
- **Social Card Fidelity:** The canvas-rendered JamCard (`JamCardModal.js`) explicitly references `"Outfit", "Plus Jakarta Sans", system-ui, sans-serif` for pixel-accurate downloadable PNGs.

## 5. Scope & What We Are NOT Doing
- **In Scope:**
  - Update `layout.js` Google Font loaders (`Poppins` → `Plus_Jakarta_Sans`).
  - Standardize CSS variables in `globals.css` (`--font-ui`, `--font-display`, `--font-mono`).
  - Add optical negative tracking to headers and titles.
  - Implement `tabular-nums` on player progress times, track durations, volume gauges, and latency tags.
  - Purge hardcoded `'Inter'`, `'Poppins'`, raw `sans-serif`, and `system-ui` from modals, profiles, playlists, and 3D Dome Gallery.
- **Not Doing:**
  - Redesigning the core layout or changing color palettes (amber/carbon/obsidian palette remains unchanged).
  - Removing `Righteous` from the logo.
