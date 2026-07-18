# Developer Diagnostics & Search Utilities

This directory contains code search, regex, and database diagnostics tools used during development to trace codebase logic and test functionality.

## Search Tools
- `find_import_playlist.py`: Searches code for playlist import hooks and API endpoints.
- `find_playback_calls.py`: Traces playback events, socket handles, and synchronization points.
- `find_play_now.py`: Locates references to song skipping and instant playback features.
- `find_queue_calls.py`: Lists files referencing queue actions or queue modification routes.
- `find_stream_client.py`: Traces audio stream clients and browser-side HTML5 player handlers.
- `search_added_by.py`: Inspects database additions to trace track ownership/uploader IDs.
- `search_added_by_room.py`: Traces uploader details on a room-by-room basis.
- `search_advance_calls.py`: Inspects how track transitions and skip events are triggered.
- `search_calls.py`: Broad regex search script for codebase call tracing.
- `search_canvas.py`: Inspects visual background canvases and CSS variables.
- `search_references.py`: Locates system API and routing schemas.
- `search_registered_user.py`: Searches permissions checks distinguishing guests from registered users.

## View & Diagnostics Utilities
- `dump_queue.py`: Helper script to query and format the current track queue.
- `view_playback_advance.py`: Diagnostic utility for tracking playback advances.
- `view_playlist_details.py`: Queries and logs tracks and details of a playlist.
- `view_playlist_import_playlists.py`: Inspects playlist sync states and import lists.
- `view_queue_advances.py`: Detailed log tracking for queue skip and next-track calculations.
- `view_require_registered_user_calls.py`: Inspects permissions filters checking for registered users.
- `view_socket_handlers.py`: Logs all registered Socket.IO listeners and events.
