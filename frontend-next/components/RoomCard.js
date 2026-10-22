'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PixelTransition from './PixelTransition';

const getDefaultBanner = () => '/placeholder.svg';

function RoomCard({ room, nameColor, getInitials, href, isSaved = false, onToggleSave = null }) {
  const isCurated = Boolean(room.id && (room.id.startsWith('openjam-') || room.id === 'openjam-lounge'));
  const getBadgeLabel = () => {
    if (room.id === 'openjam-lounge') return '☕ 24/7 Lounge';
    if (room.id === 'openjam-desi') return '🔥 24/7 Bollywood';
    if (room.id === 'openjam-hits') return '⚡ 24/7 Top Hits';
    if (room.id === 'openjam-synth') return '🌙 24/7 Synth';
    if (room.is_private) return 'Private';
    return 'Live';
  };

  const t = room.current_track;
  const isPlaying = !!(t && t.track_name);
  const coverUrl = isPlaying ? (t.album_art_url || '/placeholder.svg') : null;
  const trackName = isPlaying ? t.track_name : 'No track playing';
  const artistName = isPlaying ? t.artist : 'Idle room';
  const coverAlt = isPlaying ? `Album art for ${trackName} by ${artistName}` : `Cover for ${room.name}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link href={href} className="room-card room-card-link">
        <div className="room-card-cover-wrap">
          <PixelTransition
            firstContent={
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                {isPlaying ? (
                  <img decoding="async" loading="lazy"
                    className="room-card-cover-img"
                    src={coverUrl}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getDefaultBanner();
                    }}
                    alt={coverAlt}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #181824 0%, #0c0c10 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.03)"
                  }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="rgba(255, 176, 58, 0.15)" style={{ filter: "drop-shadow(0 0 10px rgba(255, 176, 58, 0.08))" }}>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                    </svg>
                  </div>
                )}
                <div className="room-card-cover-overlay" style={{ opacity: 1 }}>
                  <div className={`room-card-badge ${isCurated ? 'lounge' : (room.is_private ? 'private' : 'live')}`}>
                    {getBadgeLabel()}
                  </div>
                  <div className="room-card-listeners">
                    <div className="listeners-dot" aria-hidden="true" />
                    <span>{room.listener_count ?? 0}</span>
                  </div>
                  {t && (
                    <div className="room-card-eq-pill" aria-hidden="true">
                      <div className="card-now-playing-equalizer">
                        <span /><span /><span /><span />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            }
            secondContent={
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(circle, rgba(217, 119, 6, 0.95) 0%, rgba(180, 83, 9, 0.98) 100%)",
                color: "#000",
                gap: "10px"
              }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--amber)" style={{ marginLeft: "2px" }}>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span style={{ fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1.5px", color: "#000" }}>
                  Join Jam
                </span>
              </div>
            }
            gridSize={10}
            pixelColor="var(--amber)"
            animationStepDuration={0.35}
            aspectRatio="0%"
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div className="room-card-details">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <div className="room-card-tags" style={{ margin: 0 }}>
              {(room.genre_tags || []).slice(0, 3).map((tag) => (
                <span key={tag} className="tag-chip">{tag}</span>
              ))}
            </div>
            {onToggleSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSave(room.slug || room.id);
                }}
                aria-label={isSaved ? 'Remove from saved rooms' : 'Save room'}
                title={isSaved ? 'Remove from saved rooms' : 'Save room'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isSaved ? 'var(--amber, #ff9f1c)' : '#777',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                  flexShrink: 0
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                </svg>
              </button>
            )}
          </div>
          <h3 className="room-card-title">{room.name}</h3>
          <div className="room-card-host">
            {room.host_avatar_url ? (
              <img decoding="async" loading="lazy" className="room-card-host-avatar" src={room.host_avatar_url} alt={room.host_name ? `${room.host_name}'s avatar` : 'Room host avatar'} />
            ) : (
              <div
                className="room-card-host-avatar-fallback"
                style={{ background: nameColor(room.host_name || 'Unknown') }}
                aria-hidden="true"
              >
                {getInitials(room.host_name || 'Unknown')}
              </div>
            )}
            <span>Hosted by <strong>{room.host_name || 'Unknown'}</strong></span>
          </div>
        </div>

        <div className="room-card-now-playing-banner">
          <div className="banner-music-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div className="banner-track-info">
            <span className="banner-track-name">{trackName}</span>
            <span className="banner-artist-name">{artistName}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default React.memo(RoomCard);
