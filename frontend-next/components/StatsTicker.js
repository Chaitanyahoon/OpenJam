'use client';

import React from 'react';

export default function StatsTicker({ rooms = [] }) {
  const roomCount = rooms.length;
  const totalListeners = rooms.reduce((sum, r) => sum + (r.listener_count || 0), 0);
  const nowPlayingCount = rooms.filter((r) => r.current_track?.track_name).length;
  
  const genres = new Set();
  rooms.forEach((r) => (r.genre_tags || []).forEach((g) => genres.add(g)));
  const genreCount = genres.size;

  const renderStatsGroup = () => (
    <>
      <span>
        <span className="ticker-dot"></span>
        <span className="ticker-stat">
          <strong>{roomCount}</strong> active room{roomCount !== 1 ? 's' : ''}
        </span>
      </span>
      <span>
        <span className="ticker-dot"></span>
        <span className="ticker-stat">
          <strong>{totalListeners}</strong> listener{totalListeners !== 1 ? 's' : ''} online
        </span>
      </span>
      <span>
        <span className="ticker-dot"></span>
        <span className="ticker-stat">
          <strong>{nowPlayingCount}</strong> now playing
        </span>
      </span>
      <span>
        <span className="ticker-dot"></span>
        <span className="ticker-stat">
          <strong>{genreCount}</strong> genre{genreCount !== 1 ? 's' : ''} live
        </span>
      </span>
      <span>
        <span className="ticker-dot"></span>
        Synced listening · OpenJam
      </span>
    </>
  );

  return (
    <div className="stats-ticker" id="stats-ticker" aria-label="Live Jam Statistics">
      <div className="stats-ticker-track" id="stats-ticker-track">
        <div className="stats-ticker-group" id="stats-ticker-a">
          {renderStatsGroup()}
        </div>
        <div className="stats-ticker-group" id="stats-ticker-b" aria-hidden="true">
          {renderStatsGroup()}
        </div>
        <div className="stats-ticker-group" id="stats-ticker-c" aria-hidden="true">
          {renderStatsGroup()}
        </div>
      </div>
    </div>
  );
}
