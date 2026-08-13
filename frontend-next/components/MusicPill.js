'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import './MusicPill.css';

export default function MusicPill({
  activePreview,
  isPlaying,
  positionMs,
  durationMs,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onClose,
  onCreateRoom
}) {
  const titleContainerRef = useRef(null);
  const titleTextRef = useRef(null);
  const [shouldScrollTitle, setShouldScrollTitle] = useState(false);

  // Measure title width vs container to decide if marquee scrolling is needed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const container = titleContainerRef.current;
    const text = titleTextRef.current;
    if (!container || !text) return;
    const measure = () => {
      requestAnimationFrame(() => {
        const containerWidth = container.getBoundingClientRect().width;
        const textWidth = text.getBoundingClientRect().width;
        const needsScroll = textWidth > containerWidth + 1;
        setShouldScrollTitle(needsScroll);
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [activePreview?.trackName]);

  if (!activePreview) return null;

  // Format time mm:ss
  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const progressPercent = durationMs ? Math.min(100, 100 * (positionMs / durationMs)) : 0;

  return (
    <div className="music-pill-container">
      <div className="music-pill-inner">
        {/* Circle close button inset */}
        <button 
          className="music-pill-close" 
          onClick={onClose}
          title="Close preview"
        >
          ✕
        </button>

        {/* Album Artwork */}
        <div className="music-pill-art-wrap">
          <img decoding="async" loading="lazy" 
            src={activePreview.src} 
            alt="Album Cover" 
            className="music-pill-art"
            style={{
              width: '64px',
              height: '64px',
              minWidth: '64px',
              minHeight: '64px',
              maxWidth: '64px',
              maxHeight: '64px',
              borderRadius: isPlaying ? '50%' : '12px',
              objectFit: 'cover',
              display: 'block',
              animation: isPlaying ? 'spinVinyl 10s linear infinite' : 'none'
            }}
            draggable={false}
          />
        </div>

        {/* Info & Controls */}
        <div className="music-pill-info-pane">
          <div className="music-pill-top-row">
            <div className="music-pill-meta">
              <div className="music-pill-title-scroll" ref={titleContainerRef}>
                <div className="music-pill-title">
                  <span 
                    ref={titleTextRef}
                    style={{
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      animation: shouldScrollTitle ? 'glassy-music-player-marquee 12s linear infinite 1.2s' : 'none'
                    }}
                  >
                    <span style={{ paddingRight: shouldScrollTitle ? '48px' : '0px' }}>{activePreview.trackName}</span>
                    {shouldScrollTitle && <span style={{ paddingRight: '48px' }}>{activePreview.trackName}</span>}
                  </span>
                </div>
              </div>
              <div className="music-pill-artist">
                {activePreview.artist}
              </div>

              {/* Action Button: Join Live Room vs Create Room */}
              {activePreview.roomId ? (
                <Link
                  href={`/room/${activePreview.roomId}`}
                  className="music-pill-action-btn btn-join"
                  onClick={onClose}
                >
                  Join Room
                </Link>
              ) : (
                <button
                  type="button"
                  className="music-pill-action-btn btn-create"
                  onClick={onCreateRoom}
                >
                  Create Room
                </button>
              )}
            </div>

            {/* Playback Controls (Single circle buttons) */}
            <div className="music-pill-controls">
              {/* Prev (Jump back 5s) */}
              <button 
                className="music-pill-btn" 
                onClick={onPrev}
                title="Backward 5s"
              >
                <svg width="10" height="10" viewBox="0 0 28 28" fill="none">
                  <path d="M19 22L11 14L19 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button 
                className="music-pill-btn play-pause" 
                onClick={onTogglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg width="12" height="12" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next (Jump forward 5s) */}
              <button 
                className="music-pill-btn" 
                onClick={onNext}
                title="Forward 5s"
              >
                <svg width="10" height="10" viewBox="0 0 28 28" fill="none">
                  <path d="M9 6L17 14L9 22" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress Slider Row */}
          <div className="music-pill-progress-row">
            <div className="music-pill-progress-bar-wrap">
              <span className="music-pill-time">
                {formatTime(positionMs)}
              </span>
              <div 
                className="music-pill-track" 
                onClick={onSeek}
                title="Seek"
              >
                <div 
                  className="music-pill-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="music-pill-time">
                {formatTime(durationMs)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
