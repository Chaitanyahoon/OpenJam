# Product Requirement Document (PRD) — OpenJam V2

## 1. Product Overview
OpenJam V2 is an ultra-premium, collaborative, real-time social music listening room platform. It enables groups of friends, virtual communities, and online pods to synchronize audio playback, queue music collectively, upvote tracks, chat, and interact in a hardware-accelerated, responsive web interface. 

---

## 2. Problem Statement
Many online listening sync platforms suffer from three distinct drawbacks:
1. **Poor Mobile Adaptation**: Viewports zoom on focus, elements overflow, and desktop-centric controls overlap on smaller touch screens.
2. **Heavy Animation Lag**: Complex visual effects (rotational vinyl discs, dynamic ambient blurs, and particles) trigger paint invalidations, causing low framerates and battery drainage on mobile.
3. **Friction to Join**: Demanding account creation processes or third-party sign-ins reduce instantaneous engagement.

---

## 3. Product Vision & Value Proposition
OpenJam V2 removes joining friction and provides a high-fidelity listen-along experience:
- **Instant Join**: Allows users to join with temporary display names without mandatory registration.
- **Premium Design System**: Uses a glassmorphism and analog vinyl aesthetic, bringing back the sensory feel of physical hi-fi hardware.
- **Flawless Mobile Experience**: A viewport-locked, scale-protected frontend utilizing bottom tab menus, slide-up mini-players, and responsive lyrics overlays.
- **High-Performance Rendering**: Restructured render-loops that run at 60fps even on mid-range smartphones.

---

## 4. Key Features & Functional Requirements

### 4.1. Room Management
- **Room Creation**: Users can define a room name, upload password protection, assign custom genre tags, and select public/private listings.
- **Dynamic Session Control**: Hosts retain administration capabilities to close rooms, reorder queues with drag-and-drop, and remove tracks.
- **Clean Teardown**: Closing a room permanently deletes room states and temporary chats on the backend.

### 4.2. Synchronized Audio Playback
- **Master-Listener Sync**: The host's current player timestamp and status (playing/paused) act as the source of truth.
- **Drift Correction**: Listening clients regularly compare local playback position against the master. If a drift of >1.5 seconds is detected, the listener client automatically seeks to align with the host.

### 4.3. Interactive Collective Queue
- **Add Tracks**: Users search the YouTube API inside the room and queue tracks instantly.
- **Upvoting**: Users can upvote queued tracks. The queue dynamically recalculates ordering based on vote weight.
- **Duplicate Protection**: Warns or blocks users from queuing a duplicate track within the same session.

### 4.4. Real-Time Chat & Activity
- **Typing Indicators**: Displays "User is typing..." when text is entered.
- **Active Presence**: Visual indicator showing current listener count and member list.
- **Chat Log**: Temporary room-scoped chat messages that disappear on room closing.

### 4.5. Progressive Web App (PWA)
- **Standalone Mode**: Configured with full layout rules to run standalone without browser chrome on iOS (Safari) and Android (Chrome).
- **Install Banner**: Shifting, non-obtrusive PWA banner positioned dynamically above active bottom tabs or mini-players.

---

## 5. Non-Functional Requirements
- **Latency**: Audio drift checks must run within 500ms intervals with <150ms websocket synchronization overhead.
- **Performance**: Frame rates must remain above 55fps during active canvas rendering, lyrics scroll, and disc rotation on standard mobile devices.
- **SEO & Search Indexing**: Static routes (Home, Privacy, Terms) must be prerendered with complete OpenGraph metadata. Administrative/temporary room views must block index crawlers via strict robots directives.
- **Compatibility**: Supports Safari, Chrome, Edge, and Firefox on desktop, tablet, iOS, and Android viewports.
