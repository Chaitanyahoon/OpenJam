# Changelog

## Unreleased - 2026-05-16

### Added
- `docs/img/vibecat.gif` — fun animated GIF used in README (already present in repo).
- Debug panel in the room UI (toggled with `?debug=1`) showing socket and YouTube player status.

### Changed
- `README.md` — complete refresh: humorous, aesthetic content; usage and troubleshooting tips; references to `vibecat.gif`.
- `frontend/js/youtube-player.js` — updated `updateDisplay()` to support both legacy (`#progress-fill`, `#time-elapsed`, `#time-total`) and canonical (`#progress`, `#time-cur`, `#time-dur`) DOM IDs so progress/time display remains consistent.
- `frontend/room.html` — unified progress element updates to set both `#progress-fill` and `#progress`; added debug panel markup and small UI tweaks.
- `frontend/js/socket-client.js` — optional client-side socket debug logging when `?debug=1` is present.

### Rationale
- Fix visual inconsistencies in the progress/time display across templates.
- Add lightweight debugging tools to help diagnose live playback and socket issues.
- Improve README to better communicate the project's purpose and local development steps.

---
