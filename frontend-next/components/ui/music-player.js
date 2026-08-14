"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  List,
  X,
  Settings,
  Music,
  Heart,
  Repeat,
  Shuffle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import "./music-player.css";

const defaultTrack = {
  id: "default",
  title: "Nothing playing",
  artist: "Add tracks to start the jam",
  album: "",
  artwork: "",
  duration: 0,
};

export const MusicPlayer = ({
  theme = "openjam", // openjam, midnight, spotify, cosmic, default
  currentTrack,
  queue = [],
  history = [],
  currentIndex = -1,
  initialTime = 0,
  currentTime: propCurrentTime,
  isPlaying: propIsPlaying,
  volume: propVolume,
  isMuted: propIsMuted,
  isHost = false,
  className = "",
  autoPlay = false,
  showEqualizer = true,
  disableKeyboardShortcuts = false,
  size,
  isBuffering = false,
  bufferingMsg = "",
  
  // Search state & suggestions passed from parent
  searchQuery = "",
  searchResults = [],
  onSearchQueryChange,
  onAddTrack,
  onVoteTrack,
  onRemoveTrack,
  onBulkAddClick,
  
  // Playback handlers
  onPlayPause,
  onSeek,
  onNext,
  onPrev,
  onVolumeChange,
  onMuteToggle,
  onSettingsClick,
  lyricsVisible = false,
  onLyricsToggle,
  lyricsText = [],
  lyricsLoading = false,
  lyricsActiveIdx = -1,
  isLiked: propIsLiked,
  onLikeToggle,
  isShuffled: propIsShuffled,
  onShuffleToggle,
  repeatMode: propRepeatMode,
  onRepeatModeChange,
}) => {
  const track = currentTrack || defaultTrack;
  
  // Controlled State Fallbacks
  const [localIsPlaying, setLocalIsPlaying] = useState(autoPlay);
  const isPlaying = propIsPlaying !== undefined ? propIsPlaying : localIsPlaying;
  const setIsPlaying = (val) => {
    setLocalIsPlaying(val);
    if (onPlayPause) onPlayPause(val);
  };

  const [localCurrentTime, setLocalCurrentTime] = useState(initialTime);
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : localCurrentTime;
  const setCurrentTime = (val) => {
    const nextVal = typeof val === 'function' ? val(currentTime) : val;
    setLocalCurrentTime(nextVal);
    if (onSeek) onSeek(nextVal);
  };

  const [localVolume, setLocalVolume] = useState(75);
  const volume = propVolume !== undefined ? propVolume : localVolume;
  const setVolume = (val) => {
    const nextVal = typeof val === 'function' ? val(volume) : val;
    setLocalVolume(nextVal);
    if (onVolumeChange) onVolumeChange(nextVal);
  };

  const [localIsMuted, setLocalIsMuted] = useState(false);
  const isMuted = propIsMuted !== undefined ? propIsMuted : localIsMuted;
  const setIsMuted = (val) => {
    setLocalIsMuted(val);
    if (onMuteToggle) onMuteToggle();
  };

  const [localLiked, setLocalLiked] = useState(false);
  const liked = propIsLiked !== undefined ? propIsLiked : localLiked;
  const setLiked = (val) => {
    setLocalLiked(val);
    if (onLikeToggle) onLikeToggle(val);
  };

  const [localIsShuffled, setLocalIsShuffled] = useState(false);
  const isShuffled = propIsShuffled !== undefined ? propIsShuffled : localIsShuffled;
  const setIsShuffled = (val) => {
    setLocalIsShuffled(val);
    if (onShuffleToggle) onShuffleToggle(val);
  };

  const [localRepeatMode, setLocalRepeatMode] = useState("off");
  const repeatMode = propRepeatMode !== undefined ? propRepeatMode : localRepeatMode;
  const setRepeatMode = (val) => {
    setLocalRepeatMode(val);
    if (onRepeatModeChange) onRepeatModeChange(val);
  };
  const [mounted, setMounted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [activeQueueTab, setActiveQueueTab] = useState("queue"); // queue, history
  const [hoverTime, setHoverTime] = useState(null);
  const [equalizerBars, setEqualizerBars] = useState(Array(10).fill(0));
  const [artworkHovered, setArtworkHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  
  const progressRef = useRef(null);
  const lyricsScrollRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userScrolledPlayerLyricsRef = useRef(false);
  const userPlayerScrollTimerRef = useRef(null);

  // Sync lyrics scrolling in theater mode into the golden focal region
  useEffect(() => {
    if (lyricsActiveIdx === -1 || !lyricsScrollRef.current || !lyricsText || lyricsText.length === 0) return;
    if (userScrolledPlayerLyricsRef.current) return;

    const activeEl = document.getElementById(`mp-lyr-${lyricsActiveIdx}`);
    if (activeEl && lyricsScrollRef.current) {
      const container = lyricsScrollRef.current;
      const targetScroll = activeEl.offsetTop - (container.clientHeight * 0.38) + (activeEl.clientHeight / 2);
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [lyricsActiveIdx, lyricsText]);

  // Keyboard shortcuts
  useEffect(() => {
    if (disableKeyboardShortcuts) return;
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (isHost) setCurrentTime((prev) => Math.max(0, prev - 10));
          break;
        case "ArrowRight":
          e.preventDefault();
          if (isHost) setCurrentTime((prev) => Math.min(track.duration, prev + 10));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((prev) => Math.min(100, prev + 10));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((prev) => Math.max(0, prev - 10));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [track.duration, disableKeyboardShortcuts, isHost, isPlaying]);

  // Equalizer animation
  useEffect(() => {
    let interval;
    if (isPlaying && showEqualizer && !isBuffering) {
      interval = setInterval(() => {
        setEqualizerBars((bars) => bars.map(() => Math.random() * 85 + 15));
      }, 150);
    } else {
      setEqualizerBars(Array(10).fill(6));
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, showEqualizer, isBuffering]);

  // Local time progression (only if parent isn't actively updating currentTime)
  useEffect(() => {
    let interval;
    if (isPlaying && propCurrentTime === undefined) {
      interval = setInterval(() => {
        setCurrentTime((time) => {
          if (time >= track.duration) {
            setIsPlaying(false);
            return 0;
          }
          return time + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, track.duration, propCurrentTime]);

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" + sec : sec}`;
  }

  function togglePlay() {
    setIsPlaying(!isPlaying);
  }

  const handleExpVolumeScroll = (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY);
    setVolume(prev => {
      const current = prev !== undefined ? prev : (propVolume || 0);
      const step = Math.max(1, Math.round(Math.pow(Math.max(current, 8) / 100, 0.55) * 6));
      const next = Math.max(0, Math.min(100, current + delta * step));
      if (next > 0 && isMuted) setIsMuted(false);
      return next;
    });
  };

  function handleProgressClick(e) {
    if (!progressRef.current || (!isHost && propCurrentTime !== undefined)) return;
    const { left, width } = progressRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - left;
    const percentage = Math.max(0, Math.min(1, clickPosition / width));
    const newTime = Math.floor(track.duration * percentage);
    setCurrentTime(newTime);
  }

  function handleProgressHover(e) {
    if (!progressRef.current) return;
    const { left, width } = progressRef.current.getBoundingClientRect();
    const hoverPosition = e.clientX - left;
    const percentage = Math.max(0, Math.min(1, hoverPosition / width));
    const hoverTimeValue = Math.floor(track.duration * percentage);
    setHoverTime(hoverTimeValue);
  }

  if (!mounted) return null;

  const containerStyle = lyricsVisible
    ? { maxWidth: '1080px', margin: '0 auto', width: '100%', height: '100%', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }
    : { maxWidth: '440px', width: '100%', margin: '0 auto', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' };

  return (
    <div className={`mp-container ${className} ${lyricsVisible ? 'lyrics-open' : ''}`} style={containerStyle}>
      {/* Background ambient color bleed */}
      <div 
        className="mp-ambient-glow" 
        style={{ backgroundImage: track.artwork ? `url(${track.artwork})` : "none", width: '100%', height: '100%', opacity: 0.18 }}
      />
      
      <div className={`mp-card ${theme}`} style={{ height: lyricsVisible ? '100%' : 'auto', width: '100%', borderRadius: '28px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        {/* ══ Theater Body (Artwork + Lyrics Grid) ══ */}
        <div className={`mp-theater-body ${lyricsVisible ? 'lyrics-visible' : 'lyrics-hidden'}`} style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}>
          {/* Left Side: Turntable Controls */}
          <div className="mp-theater-left">
            {/* Album artwork container — Clean, pristine square card with play overlay */}
            <div className="mp-artwork-container">
              <div
                className="mp-artwork-outer"
                onMouseEnter={() => setArtworkHovered(true)}
                onMouseLeave={() => setArtworkHovered(false)}
                onClick={togglePlay}
                onWheel={handleExpVolumeScroll}
                style={{ position: 'relative', width: '100%', maxWidth: '280px', margin: '0 auto', cursor: 'pointer' }}
                title={`Click to ${isPlaying ? 'Pause' : 'Play'} • Scroll for volume`}
              >
                {/* Album Cover Art Sleeve */}
                <div
                  className="mp-artwork-wrapper"
                  style={{
                    position: 'relative',
                    borderRadius: '22px',
                    overflow: 'hidden',
                    transform: artworkHovered ? 'scale(1.025)' : 'scale(1)',
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
                    boxShadow: artworkHovered
                      ? '0 24px 60px rgba(0,0,0,0.85), 0 0 32px rgba(255,159,28,0.25), inset 0 1px 2px rgba(255,255,255,0.3)'
                      : '0 16px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.1)',
                  }}
                >
                  {track.artwork ? (
                    <img decoding="async" loading="lazy" draggable="false" src={track.artwork} alt="" className="mp-artwork-img" style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} />
                  ) : (
                    <div className="mp-artwork-fallback" style={{ width: '100%', aspectRatio: '1/1' }}>
                      <Music className="h-12 w-12" />
                    </div>
                  )}
                  <div className="mp-artwork-glass" />

                  {/* Clean Hover Play/Pause Overlay Indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: artworkHovered ? 1 : 0,
                      transition: 'opacity 0.25s ease',
                      pointerEvents: 'none',
                      zIndex: 6,
                    }}
                  >
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: '#0a0a0f',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        transform: artworkHovered ? 'scale(1)' : 'scale(0.85)',
                        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" style={{ marginLeft: '3px' }} />}
                    </div>
                  </div>

                  {/* Holographic light sheen sweep */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.15) 50%, transparent 80%)',
                      opacity: artworkHovered ? 1 : 0,
                      transform: artworkHovered ? 'translateX(0%)' : 'translateX(-100%)',
                      transition: 'opacity 0.35s ease, transform 0.6s ease',
                      pointerEvents: 'none',
                      zIndex: 5,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Unified Track Info & Equalizer */}
            <div className="mp-meta-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', minWidth: 0, padding: '0 8px', boxSizing: 'border-box' }}>
                <h2 className="mp-track-title" data-presence="track-name">
                  {track.title}
                </h2>
                {showEqualizer && isPlaying && (
                  <div className="mp-inline-equalizer">
                    {equalizerBars.slice(0, 4).map((height, i) => (
                      <div
                        key={i}
                        className="mp-eq-bar"
                        style={{ 
                          height: `${height * 0.14}px`, 
                          transition: 'height 0.15s ease'
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="mp-track-artist" data-presence="artist">
                {track.artist}
                {isBuffering && (
                  <span className="mp-track-buffering-tag">
                    • {bufferingMsg || "Buffering..."}
                  </span>
                )}
              </p>
            </div>
            
            {/* Progress timeline bar */}
            <div className="mp-progress-section" style={{ width: '100%', marginBottom: '14px', boxSizing: 'border-box' }}>
              <div
                ref={progressRef}
                className="mp-progress-bar"
                onClick={handleProgressClick}
                onMouseMove={handleProgressHover}
                onMouseLeave={() => setHoverTime(null)}
                style={{ cursor: (isHost || propCurrentTime === undefined) ? "pointer" : "default" }}
              >
                <div
                  className="mp-progress-fill"
                  style={{ width: `${track.duration > 0 ? Math.min(100, (currentTime / track.duration) * 100) : 0}%` }}
                />
                <div
                  className="mp-progress-thumb"
                  style={{ left: `${track.duration > 0 ? Math.min(100, (currentTime / track.duration) * 100) : 0}%` }}
                />
                {hoverTime !== null && (
                  <div
                    className="mp-time-tooltip"
                    style={{ left: `${track.duration > 0 ? Math.min(100, (hoverTime / track.duration) * 100) : 0}%` }}
                  >
                    {formatTime(hoverTime)}
                  </div>
                )}
              </div>
              <div className="mp-times" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.65)' }}>
                <span>{formatTime(Math.min(currentTime, track.duration))}</span>
                <span>{formatTime(track.duration)}</span>
              </div>
            </div>


            {/* Primary Playback Controls Row */}
            <div className="mp-controls-row">
              <button
                type="button"
                className={`mp-ctrl-icon-btn shuffle ${isShuffled ? 'active' : ''}`}
                onClick={() => setIsShuffled(!isShuffled)}
                title="Shuffle Queue"
                style={{ position: 'relative' }}
              >
                <Shuffle className="h-4 w-4" />
                {isShuffled && <span className="mp-ctrl-active-dot" />}
              </button>

              <button
                type="button"
                onClick={onPrev}
                disabled={!isHost}
                className="mp-ctrl-icon-btn prev"
                title="Previous Track"
              >
                <SkipBack className="h-5 w-5" />
              </button>

              <div className={`mp-play-btn-wrapper ${isPlaying ? 'playing' : ''} ${isBuffering ? 'buffering' : ''}`}>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!isHost || isBuffering}
                  className="mp-play-btn-large"
                  title={isBuffering ? "Buffering" : isPlaying ? "Pause" : "Play"}
                >
                  {isBuffering ? (
                    <div className="mp-play-btn-spinner" />
                  ) : isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>
              </div>


              <button
                type="button"
                onClick={onNext}
                className="mp-ctrl-icon-btn next"
                title="Next/Skip Track"
              >
                <SkipForward className="h-5 w-5" />
              </button>

              <button
                type="button"
                className={`mp-ctrl-icon-btn repeat ${repeatMode !== 'off' ? 'active' : ''}`}
                onClick={() => setRepeatMode(repeatMode === 'off' ? 'context' : 'off')}
                title="Repeat Mode"
                style={{ position: 'relative' }}
              >
                <Repeat className="h-4 w-4" />
                {repeatMode !== 'off' && <span className="mp-ctrl-active-dot" />}
                {repeatMode === 'one' && <span className="mp-repeat-dot">1</span>}
              </button>
            </div>

            {/* Bottom Utility Toolbar (Heart + Volume + Lyrics Toggle) */}
            <div className="mp-utility-toolbar">
              <button
                type="button"
                className={`mp-util-btn heart ${liked ? 'active' : ''}`}
                onClick={() => setLiked(!liked)}
                title="Like Track"
              >
                <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
              </button>

              <div className="mp-util-volume-box">
                <span className="mp-util-volume-icon" onClick={() => setIsMuted(!isMuted)} title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </span>
                <input 
                  type="range" 
                  className="mp-util-volume-slider" 
                  min="0" 
                  max="100" 
                  value={isMuted ? 0 : volume} 
                  onChange={(e) => {
                    const newVol = parseInt(e.target.value);
                    setVolume(newVol);
                    if (newVol > 0 && isMuted) {
                      setIsMuted(false);
                    }
                  }}
                  style={{ background: `linear-gradient(to right, var(--theme-accent, #ff9f1c) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.15) ${isMuted ? 0 : volume}%)` }}
                  title={`Volume: ${isMuted ? 0 : volume}%`}
                />
              </div>

              <div className="mp-util-right-group">
                {onLyricsToggle && (
                  <button
                    type="button"
                    className={`mp-util-btn lyrics ${lyricsVisible ? 'active' : ''}`}
                    onClick={onLyricsToggle}
                    title="Toggle Synced Lyrics"
                    style={{ position: 'relative' }}
                  >
                    <List className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Right Side: Embedded Real-time Lyrics Panel */}
          {lyricsVisible && (
            <div className="mp-theater-lyrics">
              <div className="mp-lyrics-header">
                <span className="mp-lyrics-header-title">Synced Lyrics</span>
                <span className="mp-lyrics-header-badge">Real-time</span>
              </div>

              <div 
                ref={lyricsScrollRef}
                className="mp-lyrics-scroll-container"
                onWheel={() => {
                  userScrolledPlayerLyricsRef.current = true;
                  if (userPlayerScrollTimerRef.current) clearTimeout(userPlayerScrollTimerRef.current);
                  userPlayerScrollTimerRef.current = setTimeout(() => {
                    userScrolledPlayerLyricsRef.current = false;
                  }, 3400);
                }}
                onTouchMove={() => {
                  userScrolledPlayerLyricsRef.current = true;
                  if (userPlayerScrollTimerRef.current) clearTimeout(userPlayerScrollTimerRef.current);
                  userPlayerScrollTimerRef.current = setTimeout(() => {
                    userScrolledPlayerLyricsRef.current = false;
                  }, 3400);
                }}
              >
                <div style={{ height: '30%' }}></div>
                {lyricsLoading ? (
                  <div className="mp-lyrics-loading">Loading lyrics...</div>
                ) : lyricsText && lyricsText.length > 0 ? (
                  lyricsText.map((line, idx) => {
                    const isActive = idx === (lyricsActiveIdx >= 0 ? lyricsActiveIdx : (currentTime > 0 ? 0 : -1));
                    return (
                      <div 
                        key={idx}
                        id={`mp-lyr-${idx}`}
                        className={`mp-lyrics-line ${isActive ? 'active' : (lyricsActiveIdx >= 0 && idx < lyricsActiveIdx ? 'sung' : '')}`}
                        onClick={() => {
                          if (isHost && onSeek && line.timeMs !== undefined) {
                            onSeek(line.timeMs / 1000);
                          }
                        }}
                        style={{ cursor: isHost && line.timeMs !== undefined ? 'pointer' : 'default' }}
                      >
                        {line.text}
                      </div>
                    );
                  })
                ) : (
                  <div className="mp-lyrics-empty">
                    No synced lyrics found for this track.
                  </div>
                )}
                <div style={{ height: '40%' }}></div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
