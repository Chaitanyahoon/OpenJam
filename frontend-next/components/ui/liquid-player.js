"use client";
import React from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

// --- ICONS ---
const IconArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const IconPlay = ({ fill }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={fill} stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconPause = ({ fill }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={fill} stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const IconMore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

// --- STYLES ---
const LIQUID_SHADOWS = `
    0 0 6px rgba(0,0,0,0.03),
    0 2px 6px rgba(0,0,0,0.08),
    inset 3px 3px 0.5px -3px rgba(255,255,255,0.9),
    inset -3px -3px 0.5px -3px rgba(255,255,255,0.85),
    inset 1px 1px 1px -0.5px rgba(255,255,255,0.6),
    inset -1px -1px 1px -0.5px rgba(255,255,255,0.6),
    inset 0 0 6px 6px rgba(255,255,255,0.12),
    inset 0 0 2px 2px rgba(255,255,255,0.06),
    0 0 12px rgba(255,255,255,0.15)
`;

const LiquidGlassFilter = ({ id }) => (
  <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
    <defs>
      <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
        <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
        <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="30" xChannelSelector="R" yChannelSelector="B" result="displaced" />
        <feGaussianBlur in="displaced" stdDeviation="1" result="finalBlur" />
        <feComposite in="finalBlur" in2="finalBlur" operator="over" />
      </filter>
    </defs>
  </svg>
);

const LiquidButton = ({ children, onClick, color, disabled }) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.06 }}
      whileTap={disabled ? {} : { scale: .94 }}
      style={{
        position: "relative",
        border: "none",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: color,
        opacity: disabled ? 0.35 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          boxShadow: LIQUID_SHADOWS,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </motion.button>
  );
};

const VolumeBars = ({ isPlaying, color }) => {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 24, marginBottom: 4 }}>
      {bars.map((i) => (
        <motion.div
          key={i}
          animate={isPlaying ? { height: [4, 20, 8, 24, 6] } : { height: 6 }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.1,
            ease: "linear",
          }}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
};

const ProgressBar = ({ currentTime, totalDuration, onSeek, tintColor, textColor, trackColor, isHost }) => {
  const safeDuration = totalDuration > 0 ? totalDuration : 1;
  const progress = (currentTime / safeDuration) * 100;

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleClick = (e) => {
    if (!isHost || totalDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.floor((x / rect.width) * totalDuration));
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: textColor, fontFamily: "monospace", opacity: 0.8 }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(totalDuration)}</span>
      </div>
      <div
        onClick={handleClick}
        style={{
          position: "relative",
          height: 8,
          width: "100%",
          backgroundColor: trackColor,
          borderRadius: 99,
          cursor: isHost ? "pointer" : "default",
          overflow: "hidden",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3), inset 0 0 0 0.5px rgba(255,255,255,0.05)",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            height: "100%",
            backgroundColor: tintColor,
            borderRadius: 99,
            boxShadow: `0 0 8px ${tintColor}55`,
          }}
        />
      </div>
    </div>
  );
};

export const LiquidMusicPlayer = ({
  currentTrack,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  isHost = false,
  volume = 75,
  isMuted = false,
  tint = "#ff9f1c", // Glowing amber accent color
  glassEffect = true,
  onPlayPause,
  onSeek,
  onNext,
  onPrev,
  onVolumeChange,
  onMuteToggle,
  onSettingsClick,
}) => {
  const track = currentTrack || {
    title: "Nothing playing",
    artist: "Queue a track",
    artwork: "",
  };

  const filterId = React.useId();
  const cleanFilterId = filterId.replace(/:/g, "");

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: 24,
          borderRadius: 32,
          isolation: "isolate",
          boxSizing: "border-box",
          background: "rgba(10, 10, 15, 0.45)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* Liquid Glass Overlay Shadows */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: 32,
            boxShadow: LIQUID_SHADOWS,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Liquid Glass Rippling Distortion Backdrop Filter */}
        {glassEffect && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              borderRadius: 32,
              zIndex: -1,
              backdropFilter: `url(#${cleanFilterId}) blur(24px) saturate(1.6)`,
              WebkitBackdropFilter: `url(#${cleanFilterId}) blur(24px) saturate(1.6)`,
              overflow: "hidden",
            }}
          />
        )}

        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Track metadata row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Album artwork */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                overflow: "hidden",
                flexShrink: 0,
                boxShadow: "0 8px 16px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)",
                background: "rgba(255, 255, 255, 0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {track.artwork ? (
                <img
                  src={track.artwork}
                  alt={`${track.title} by ${track.artist}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 28, fontWeight: 700 }}>♪</div>
              )}
            </div>

            {/* Title & Artist */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  color: "#ffffff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "-0.02em",
                }}
                title={track.title}
              >
                {track.title}
              </h3>
              <p
                style={{
                  margin: "4px 0 0 0",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'Outfit', sans-serif",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={track.artist}
              >
                {track.artist}
              </p>
            </div>

            {/* Equalizer animation */}
            <VolumeBars isPlaying={isPlaying} color={tint} />
          </div>

          {/* Progress & Controls Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Progress Bar */}
            <ProgressBar
              currentTime={currentTime}
              totalDuration={duration}
              onSeek={onSeek}
              tintColor={tint}
              textColor="rgba(255,255,255,0.5)"
              trackColor="rgba(255, 255, 255, 0.08)"
              isHost={isHost}
            />

            {/* Bottom Actions Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Media Controls */}
              <div style={{ display: "flex", gap: 12 }}>
                {/* Back button */}
                <LiquidButton
                  color="rgba(255,255,255,0.7)"
                  disabled={!isHost}
                  onClick={onPrev}
                >
                  <IconArrowLeft />
                </LiquidButton>

                {/* Play/Pause toggle */}
                <LiquidButton
                  color={tint}
                  disabled={!isHost}
                  onClick={onPlayPause}
                >
                  {isPlaying ? <IconPause fill={tint} /> : <IconPlay fill={tint} />}
                </LiquidButton>

                {/* Next button */}
                <LiquidButton
                  color="rgba(255,255,255,0.7)"
                  onClick={onNext}
                >
                  <IconArrowRight />
                </LiquidButton>
              </div>

              {/* Volume & settings controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Volume icon */}
                <LiquidButton
                  color="rgba(255,255,255,0.7)"
                  onClick={onMuteToggle}
                >
                  {isMuted || volume === 0 ? <VolumeX style={{ width: 20, height: 20 }} /> : <Volume2 style={{ width: 20, height: 20 }} />}
                </LiquidButton>
                
                {/* Volume slider input */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                  style={{
                    width: 70,
                    height: 4,
                    borderRadius: 2,
                    background: `linear-gradient(to right, ${tint} ${isMuted ? 0 : volume}%, rgba(255,255,255,0.1) ${isMuted ? 0 : volume}%)`,
                    outline: "none",
                    cursor: "pointer",
                    WebkitAppearance: "none",
                  }}
                  className="liquid-volume-slider"
                />

                {/* Room settings shortcut (upload button replacement) */}
                <LiquidButton
                  color="rgba(255,255,255,0.7)"
                  onClick={onSettingsClick}
                >
                  <IconMore />
                </LiquidButton>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* SVG liquid glass filter definition */}
      {glassEffect && <LiquidGlassFilter id={cleanFilterId} />}
    </div>
  );
};
