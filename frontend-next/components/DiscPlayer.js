'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

/**
 * DiscPlayer — A vinyl record / turntable component.
 *
 * Upgraded to a high-fidelity glassmorphic turntable plinth with metallic platter,
 * S-shaped chrome tonearm, and central record label details.
 *
 * Props:
 *  - isPlaying       (boolean)  — whether the disc should spin
 *  - albumArtUrl     (string)   — URL of album art to show on disc
 *  - trackName       (string)   — track name to show in the center label
 *  - artist          (string)   — artist name to show in the center label
 *  - discColor       (string)   — base color of the vinyl disc
 *  - backgroundColor (string)   — container background color
 *  - needleDotColor  (string)   — color of the needle tip dot (hot-glow amber/pink)
 *  - onToggle        (function) — callback when disc is clicked
 *  - size            (number)   — size of the player in px (default 280)
 */
export default function DiscPlayer({
  isPlaying = false,
  albumArtUrl,
  trackName = '',
  artist = '',
  discColor = '#0b0b0d', // Deep vinyl black
  backgroundColor = 'transparent',
  needleDotColor = '#ffb03a', // Brand neon amber
  onToggle,
  size = 280,
}) {
  const discControls = useAnimation();
  const needleControls = useAnimation();
  const discRotationRef = useRef(0);
  const animFrameRef = useRef(null);

  // Handle disc spin + S-arm swing movement based on isPlaying
  useEffect(() => {
    if (isPlaying) {
      // Swing arm onto the vinyl disc (-20 degrees rotation around pivot)
      needleControls.start({
        rotate: -20,
        transition: { duration: 1.2, ease: [0.32, 0.72, 0, 1] },
      });
      // Continuous disc spin
      discControls.start({
        rotate: [discRotationRef.current, discRotationRef.current + 360],
        transition: {
          duration: 3,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
        },
      });
    } else {
      // Stop disc and record current rotation
      discControls.stop();
      discControls.set({ rotate: discRotationRef.current });
      // Swing arm back to the rest post (0 degrees rotation)
      needleControls.start({
        rotate: 0,
        transition: { duration: 0.8, ease: [0.32, 0.72, 0, 1] },
      });
    }
  }, [isPlaying, discControls, needleControls]);

  // Track disc rotation for smooth pause/resume
  useEffect(() => {
    if (!isPlaying) return;
    let startTime = null;
    const startRotation = discRotationRef.current;
    const degreesPerMs = 360 / 3000; // 360° per 3s

    const tick = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      discRotationRef.current = (startRotation + elapsed * degreesPerMs) % 360;
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  const handleClick = () => {
    if (onToggle) onToggle();
  };

  return (
    <div
      className="disc-player-container"
      style={{
        position: 'relative',
        width: size,
        height: size,
        background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(8, 8, 12, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 35px rgba(255, 176, 58, 0.03)',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: size * 0.02,
        overflow: 'visible',
      }}
    >
      {/* Platter base (metallic platter rim platter underneath the vinyl) */}
      <div
        style={{
          position: 'absolute',
          width: '74%',
          height: '74%',
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #1f1f2e, #47476b 25%, #1f1f2e 50%, #47476b 75%, #1f1f2e 100%)',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
          zIndex: 0,
        }}
      />

      {/* Turntable Accents: Power Switch / Dial (Bottom-Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '8%',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #555 30%, #222 80%)',
          border: '1px solid #111',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          zIndex: 1,
        }}
      />
      
      {/* Strobe speed status indicator light */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '16%',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isPlaying ? '#ef4444' : '#3f1f1f',
          boxShadow: isPlaying ? '0 0 6px #ef4444' : 'none',
          border: '0.5px solid #111',
          zIndex: 1,
          transition: 'background 0.3s ease, box-shadow 0.3s ease'
        }}
      />

      {/* Turntable Accents: Pitch Slider (Right Side) */}
      <div
        style={{
          position: 'absolute',
          right: '8%',
          bottom: '12%',
          width: '4px',
          height: '50px',
          background: '#09090d',
          borderRadius: '2px',
          border: '1px solid rgba(255,255,255,0.05)',
          zIndex: 1
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: isPlaying ? '35%' : '50%',
            left: '-5px',
            width: '14px',
            height: '6px',
            background: 'linear-gradient(to bottom, #d4d4d8, #71717a)',
            border: '1px solid #18181b',
            borderRadius: '1.5px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            transition: 'top 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          }}
        />
      </div>

      {/* Rotating Vinyl Area */}
      <div
        style={{
          position: 'relative',
          width: '72%',
          aspectRatio: '1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        {/* Vinyl Disc */}
        <motion.div
          animate={discControls}
          initial={{ rotate: 0 }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: discColor,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            backgroundImage: albumArtUrl ? `url(${albumArtUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
          onClick={handleClick}
        >
          {/* Groove rings */}
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: `${92 - i * 10}%`,
                height: `${92 - i * 10}%`,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                pointerEvents: 'none'
              }}
            />
          ))}

          {/* Vinyl reflection shine overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background:
                'conic-gradient(from 40deg, rgba(255,255,255,0.04) 0%, transparent 15%, transparent 35%, rgba(255,255,255,0.04) 50%, transparent 65%, transparent 85%, rgba(255,255,255,0.04) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Center sticker label */}
          <div
            style={{
              position: 'absolute',
              width: '32%',
              height: '32%',
              borderRadius: '50%',
              backgroundColor: '#141419',
              border: '2px solid #000',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
              zIndex: 5,
              padding: '4px',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            {/* Dashed circular details on sticker */}
            <div style={{
              width: '100%',
              height: '100%',
              border: '1px dashed rgba(255, 176, 58, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Spindle hole ring */}
              <div style={{
                position: 'absolute',
                width: '24%',
                height: '24%',
                borderRadius: '50%',
                background: '#09090b',
                border: '1px solid #222',
                zIndex: 6
              }} />

              {/* Text elements inside sticker */}
              {trackName ? (
                <>
                  <div style={{
                    position: 'absolute',
                    top: '12%',
                    fontSize: '6.5px',
                    fontWeight: '800',
                    color: 'var(--amber)',
                    width: '85%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    {trackName}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '12%',
                    fontSize: '5.5px',
                    fontWeight: '600',
                    color: '#a1a1aa',
                    width: '80%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {artist}
                  </div>
                </>
              ) : (
                <div style={{
                  position: 'absolute',
                  top: '12%',
                  fontSize: '6.5px',
                  fontWeight: '800',
                  color: 'var(--amber)',
                  width: '85%',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase'
                }}>
                  OPENJAM
                </div>
              )}
            </div>
          </div>

          {/* Actual 3D-gradient center spindle pin */}
          <div
            style={{
              position: 'absolute',
              width: '6%',
              height: '6%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #a3a3a3 40%, #525252 85%, #171717 100%)',
              border: '0.5px solid #333',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
              zIndex: 7,
              pointerEvents: 'none'
            }}
          />
        </motion.div>
      </div>

      {/* Tonearm Container overlaying the Platter */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          right: '4%',
          width: '32%',
          height: '84%',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <svg
          viewBox="0 0 100 240"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id="chrome-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="50%" stopColor="#a1a1aa" />
              <stop offset="100%" stopColor="#52525b" />
            </linearGradient>
            <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>
            <linearGradient id="weight-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3f3f46" />
              <stop offset="50%" stopColor="#d4d4d8" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
          </defs>

          {/* Static Tonearm Rest Clip base */}
          <g>
            <path d="M 68 195 Q 76 195 76 205" fill="none" stroke="#222" strokeWidth="2.5" />
            <rect x="72" y="193" width="8" height="4" fill="#3f3f46" rx="1" />
          </g>

          {/* Rotating Tonearm Assembly Group */}
          <motion.g
            animate={needleControls}
            initial={{ rotate: 0 }}
            style={{
              transformOrigin: '76px 36px',
            }}
          >
            {/* Pivot Counterweight Rod */}
            <line x1="76" y1="36" x2="76" y2="14" stroke="#a1a1aa" strokeWidth="2.5" />
            {/* Counterweight Cylinder */}
            <rect x="69" y="8" width="14" height="12" rx="1" fill="url(#weight-grad)" stroke="#111" strokeWidth="0.5" />

            {/* S-Shaped Chrome Tonearm Tube */}
            <path
              d="M 76 36 C 72 80, 86 110, 82 135 C 78 160, 82 175, 76 195"
              fill="none"
              stroke="url(#chrome-grad)"
              strokeWidth="3.2"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.45))' }}
            />

            {/* Headshell / Stylus Cartridge */}
            <g transform="translate(76, 195) rotate(-18)">
              {/* Connector ring */}
              <circle cx="0" cy="0" r="2.5" fill="url(#gold-grad)" />
              {/* Headshell plate */}
              <path d="M -2 0 L 2 0 L 3 15 L -3 15 Z" fill="#18181b" stroke="#333" strokeWidth="0.5" />
              {/* Finger lift pin */}
              <path d="M 2 6 Q 6 6 5 2" fill="none" stroke="#71717a" strokeWidth="1" />
              {/* Cartridge body */}
              <rect x="-2" y="15" width="4" height="6" fill="#eab308" />
              {/* Stylus light indicator (needleDotColor) */}
              <circle cx="0" cy="18" r="1.5" fill={needleDotColor} style={{ filter: `drop-shadow(0 0 3px ${needleDotColor})` }} />
            </g>
          </motion.g>

          {/* Static Pivot Base Cover */}
          <circle cx="76" cy="36" r="12" fill="url(#weight-grad)" stroke="#18181b" strokeWidth="1" />
          <circle cx="76" cy="36" r="6" fill="url(#chrome-grad)" stroke="#111" strokeWidth="0.5" />
        </svg>
      </div>
    </div>
  );
}
