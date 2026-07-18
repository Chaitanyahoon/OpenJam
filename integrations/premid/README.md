# OpenJam PreMiD Discord Presence

This directory contains the custom Discord Rich Presence integration for OpenJam using [PreMiD](https://premid.app/).

## Features
- **Real-Time Playback Sync**: Displays the currently playing track title and artist while listening in a Jam Room.
- **Idle State Handling**: Shows *"In a Jam Room — Waiting for music..."* when in a room with no active audio stream.
- **App Browsing**: Displays *"Browsing OpenJam"* when navigating other pages of the application.
- **Interactive Buttons**: Adds an optional "Join Room" button directly to your Discord profile card.
- **Customizable Timestamps**: Displays track elapsed time.

## Directory Structure
- `metadata.json`: Contains presence settings, pattern matching configurations, and author details.
- `presence.ts`: Main script containing DOM extraction logic for track metadata and state tracking.
