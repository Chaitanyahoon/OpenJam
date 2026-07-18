# UI/UX Brief Design Document — OpenJam V2

This document details the visual guidelines, typography, design systems, and micro-interaction principles implemented in the OpenJam V2 user experience.

---

## 1. Visual Direction & Aesthetic Theme
The visual style is **Vinyl & Analog Dark**, combining the premium obsidian values of modern digital layouts with the tactile feel of physical hi-fi hardware.
- **Glassmorphism**: High-blur backdrops (`backdrop-filter: blur(20px) saturate(1.8)`) are utilized for cards and overlays to establish spatial hierarchy.
- **Warm Glows**: Elements are outlined with ambient borders (`1px solid rgba(255, 159, 28, 0.15)`) and cast subtle gold drop-shadows.

---

## 2. Design Tokens & Color System

| Token Name | Hex Code | Visual Application |
| :--- | :--- | :--- |
| `--bg-base` | `#08080a` | Global dark canvas backdrop. |
| `--bg-surface` | `#0e0e12` | Static card content backgrounds. |
| `--bg-card` | `rgba(18, 18, 24, 0.85)` | Glassmorphic overlay components. |
| `--amber` | `#ff9f1c` | Brand accent: buttons, highlights, glowing states. |
| `--gold` | `#ffd23f` | Warm highlight transitions. |
| `--red` | `#f43f5e` | Danger, room destruction, and delete warning triggers. |
| `--green` | `#10b981` | Success states, online presence indicators. |
| `--text-1` | `#f8fafc` | Primary titles and high-contrast text. |
| `--text-3` | `#64748b` | Subheadings, dates, and minor helper captions. |

---

## 3. Typography
- **Display Typeface**: **Outfit** (sans-serif)
  - Applications: Page titles, room headers, dynamic track titles.
  - Characteristics: Clean geometric properties, modern letterforms.
- **UI & Body Typeface**: **Poppins** (sans-serif)
  - Applications: Buttons, lists, chat dialogue, and settings.
  - Characteristics: Warm, readable curves across mobile dimensions.

---

## 4. Key Micro-Interactions & Physics

### 4.1. Rotating Vinyl Record
- **Infinite Orbit**: When active music is detected, the vinyl record artwork rotates infinitely:
  ```css
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  ```
- **Physics**: Smooth 6-second rotation cycle. The transition between play/pause states utilizes a CSS ease-out curve to simulate natural physical friction decelerating a vinyl turntable.

### 4.2. Breathing Ambient Visualizer
- **State Synchronization**: The background breathing central glow portal expands and pulses based on the `isPlaying` state.
- **Wave Amplitude Dynamics**: Wave heights expand from a subtle ripple (idle amplitude: 5px) to energetic waves (playing amplitude: 20px) to match the music activity.

### 4.3. Elastic Touch Feedback
- All primary interactive elements (buttons, room cards, tab selectors, equalizer blocks) utilize custom scale reduction triggers on click/press to provide physical-feeling click feedback:
  ```css
  .btn:active {
    transform: scale(0.96);
    filter: brightness(0.9);
    transition: transform 0.1s ease;
  }
  ```

---

## 5. Mobile Layout Principles
- **Viewport Scaling**: Configured viewport metadata with `maximum-scale=1.0, user-scalable=no` to lock layout proportions and prevent pinch-to-zoom issues.
- **iOS Focus Protection**: Configured text input font sizes strictly at `16px` to prevent Safari from automatically zooming in on search inputs.
- **Bottom Tab Menu**: Positioned control menus within thumb-reach at `56px` heights.
