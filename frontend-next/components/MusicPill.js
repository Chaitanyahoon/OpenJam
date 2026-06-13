'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

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
      const containerWidth = container.getBoundingClientRect().width;
      const textWidth = text.getBoundingClientRect().width;
      const needsScroll = textWidth > containerWidth + 1;
      setShouldScrollTitle(needsScroll);
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes glassy-music-player-marquee {
          0% { transform: translateX(0); }
          10% { transform: translateX(0); }
          90% { transform: translateX(-50%); }
          100% { transform: translateX(-50%); }
        }
        
        .music-pill-container {
          position: relative;
          width: 100%;
          height: 120px;
          min-height: 120px;
          max-height: 120px;
          border-radius: 24px;
          overflow: visible;
          box-sizing: border-box;
          background: rgba(10, 10, 15, 0.45);
          background-image: 
            radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.12) 0, transparent 40%),
            radial-gradient(circle at 100% 0%, rgba(160, 190, 255, 0.1) 0, transparent 45%);
          backdrop-filter: blur(32px) saturate(1.8);
          -webkit-backdrop-filter: blur(32px) saturate(1.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 30px rgba(255, 176, 58, 0.02), inset 0 1px 1px rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          padding: 0;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .music-pill-container:hover {
          border-color: rgba(255, 176, 58, 0.2);
          box-shadow: 0 24px 65px rgba(0, 0, 0, 0.7), 0 0 35px rgba(255, 176, 58, 0.05);
        }

        .music-pill-inner {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: center;
          width: 100%;
          height: 100%;
          padding: 16px 20px;
          box-sizing: border-box;
          gap: 16px;
        }

        .music-pill-art-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 72px;
          min-width: 72px;
          flex-shrink: 0;
          position: relative;
        }

        .music-pill-art {
          width: 72px;
          height: 72px;
          border-radius: 12px;
          object-fit: cover;
          background: #101015;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
          user-select: none;
          display: block;
        }

        .music-pill-info-pane {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          flex: 1;
          height: 100%;
          min-width: 0;
        }

        .music-pill-top-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          width: 100%;
          gap: 12px;
          z-index: 2;
          min-width: 0;
        }

        .music-pill-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
        }

        .music-pill-title-scroll {
          width: 100%;
          overflow: hidden;
        }

        .music-pill-title {
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -0.01em;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          user-select: none;
        }

        .music-pill-artist {
          color: rgba(255, 255, 255, 0.5);
          font-weight: 500;
          font-size: 12px;
          letter-spacing: -0.01em;
          line-height: 1.2;
          margin-top: 1px;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          user-select: none;
        }

        .music-pill-controls {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-shrink: 0;
          min-width: 0;
        }

        .music-pill-btn {
          margin: 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          outline: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.8);
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .music-pill-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
          color: #fff;
          transform: scale(1.08);
        }

        .music-pill-btn:active {
          transform: scale(0.92);
        }

        .music-pill-btn.play-pause {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.16);
          width: 40px;
          height: 40px;
        }

        .music-pill-btn.play-pause:hover {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.24);
        }

        .music-pill-btn svg {
          fill: currentColor;
        }

        .music-pill-progress-row {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 3;
          gap: 0;
        }

        .music-pill-progress-bar-wrap {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
          height: 8px;
        }

        .music-pill-time {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-mono);
          user-select: none;
          min-width: 26px;
          text-align: center;
          z-index: 3;
        }

        .music-pill-track {
          position: relative;
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
          overflow: hidden;
          cursor: pointer;
          transition: height 0.15s ease;
        }

        .music-pill-track:hover {
          height: 6px;
        }

        .music-pill-fill {
          position: absolute;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, var(--amber), #ff8c00);
          box-shadow: 0 0 8px rgba(255, 176, 58, 0.4);
          border-radius: 99px;
          z-index: 2;
        }

        .music-pill-close {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
          width: 20px;
          height: 20px;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          font-size: 8px;
          transition: all 0.2s ease;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .music-pill-close:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #fff;
          transform: scale(1.08);
        }

        .music-pill-action-btn {
          font-size: 9px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 99px;
          margin-top: 3px;
          width: fit-content;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          white-space: nowrap;
          flex-shrink: 0;
          border: 1px solid transparent;
        }

        /* Glassmorphic Active Badges */
        .music-pill-action-btn.btn-create {
          background: rgba(255, 176, 58, 0.08);
          border-color: rgba(255, 176, 58, 0.25);
          color: var(--amber);
          box-shadow: 0 2px 8px rgba(255, 176, 58, 0.03);
        }

        .music-pill-action-btn.btn-create:hover {
          background: rgba(255, 176, 58, 0.16);
          border-color: rgba(255, 176, 58, 0.45);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 176, 58, 0.08);
        }

        .music-pill-action-btn.btn-join {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.25);
          color: #10b981;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.03);
        }

        .music-pill-action-btn.btn-join:hover {
          background: rgba(16, 185, 129, 0.16);
          border-color: rgba(16, 185, 129, 0.45);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);
        }

        .music-pill-action-btn:active {
          transform: translateY(0);
        }
      ` }} />

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
          <img 
            src={activePreview.src} 
            alt="Album Cover" 
            className="music-pill-art"
            style={{
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
                      paddingRight: shouldScrollTitle ? '48px' : '0px',
                      animation: shouldScrollTitle ? 'glassy-music-player-marquee 12s linear infinite 1.2s' : 'none'
                    }}
                  >
                    {activePreview.trackName}
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
