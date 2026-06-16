'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import DomeGallery from './reactbits/DomeGallery';

const ArrowIcon = () => {
  return (
    <div className="arrow-icon-group">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="arrow-chevron"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <div className="arrow-stem" />
    </div>
  );
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};



export default function HeroSection({
  me,
  onInstantJam,
  onDiscordLogin,
  onJoinGuest,
  onCreateRoom,
  rooms = [],
  onPlayPreview,
  domeTracks = [],
  activePreview,
  isPlayingPreview,
  showInstallBtn,
  onInstallClick,
}) {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [sloganIndex, setSloganIndex] = useState(0);

  const slogans = ['In Sync.', 'With Friends.', 'In Real-Time.', 'In Harmony.'];

  useEffect(() => {
    setMounted(true);
  }, []);

  // const reduceMotionHook = useReducedMotion();
  const reduceMotion = false; // Bypassed OS accessibility settings for preview testing

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % slogans.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [reduceMotion]);



  return (
    <section
      className="hero"
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '120px 24px 100px',
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background Dome Gallery (covers whole hero section) */}
      <div
        className="hero-dome-bg"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'auto', // Crucial to allow clicking and dragging the dome
        }}
      >
        <DomeGallery
          images={domeTracks}
          fit={0.9}
          fitBasis="max"
          minRadius={500}
          maxRadius={1600}
          grayscale={false}
          openedImageWidth="180px"
          openedImageHeight="240px"
          imageBorderRadius="16px"
          openedImageBorderRadius="20px"
          overlayBlurColor="#08080a"
          onItemClick={onPlayPreview}
        />
      </div>

      {/* Floating Kinetic Music Notes in background space */}
      {mounted && !reduceMotion && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
          {[
            { symbol: '🎵', size: 24, left: '12%', delay: 0, duration: 16, top: '15%' },
            { symbol: '🎶', size: 20, right: '12%', delay: 3, duration: 20, top: '25%' },
            { symbol: '🎼', size: 28, left: '22%', delay: 6, duration: 18, bottom: '22%' },
            { symbol: '🎵', size: 16, right: '22%', delay: 1, duration: 24, bottom: '12%' },
          ].map((note, index) => (
            <motion.div
              key={index}
              style={{
                position: 'absolute',
                left: note.left,
                right: note.right,
                top: note.top,
                bottom: note.bottom,
                fontSize: `${note.size}px`,
                color: 'var(--amber)',
                opacity: 0.08,
                filter: 'drop-shadow(0 0 8px var(--amber))',
              }}
              animate={{
                y: [0, -80, 0],
                rotate: [0, 360, 0],
                scale: [1, 1.15, 1],
                opacity: [0.05, 0.15, 0.05],
              }}
              transition={{
                repeat: Infinity,
                duration: note.duration,
                delay: note.delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Center content container - passes pointer events to the background */}
      <div
        className="hero-container centered"
        style={{
          position: 'relative',
          zIndex: 2,
          pointerEvents: 'none', // Allow cursor drags to pass through to the dome
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0, // Reset default container gaps
          perspective: '1200px', // Enable 3D space for the glass card
        }}
      >
        <div 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
          }}
          style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: '640px', pointerEvents: 'auto' }}
        >
          {/* Interactive Peeking Vinyl Record */}
          {mounted && !reduceMotion && (
            <motion.div
              className="hero-vinyl-behind-wrapper"
              animate={{
                x: isHovered ? 260 : 70,
                scale: isHovered ? 1.05 : 1,
              }}
              transition={{
                type: 'spring',
                stiffness: 65, // Smoother spring stiffness
                damping: 15, // Butter-smooth damping
              }}
              style={{
                position: 'absolute',
                width: '340px',
                height: '340px',
                zIndex: -1,
                pointerEvents: 'none',
                top: 'calc(50% - 170px)',
                left: 'calc(50% - 170px)',
              }}
            >
              <div
                className="hero-vinyl-behind"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <div className="vinyl-grooves" style={{ width: '100%', height: '100%', borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="hero-vinyl-label">
                    <div className="hero-vinyl-label-design">
                      <span className="hero-vinyl-label-text">OPENJAM</span>
                      <div className="vinyl-spindle-hole" />
                      <span className="hero-vinyl-label-sub">V2 PLAY</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <motion.div
            className="hero-glass-card hero-glass-card-glow"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
              {/* Glass Spotlight Sheen */}
              <div className="glass-spotlight" />

              <motion.div
              className="hero-badge"
              variants={fadeUpVariants}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 159, 28, 0.12) 0%, rgba(255, 107, 53, 0.04) 100%)',
                border: '1px solid rgba(255, 159, 28, 0.3)',
                padding: '6px 18px',
                borderRadius: '99px',
                letterSpacing: '2px',
                fontWeight: 800,
                fontSize: '11px',
                marginBottom: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transform: 'translateZ(15px)', // Floating layer
              }}
            >
              <span className="hero-badge-pulse" />
              🎵 OPEN JAM V2
            </motion.div>

            {/* Popping brand name with elastic spring animation and animated text gradient */}
            <motion.h1
              className="hero-title-brand"
              variants={fadeUpVariants}
              whileHover={{
                scale: 1.03,
                letterSpacing: '0.01em',
                textShadow: '0 0 45px rgba(255, 176, 58, 0.4)',
                transition: { type: 'spring', stiffness: 350, damping: 15 }
              }}
              style={{
                fontSize: 'clamp(58px, 9vw, 98px)',
                lineHeight: 0.95,
                letterSpacing: '-0.04em',
                fontFamily: "'Outfit', sans-serif", // Cohesive brand typeface
                fontWeight: 900,
                marginBottom: '12px',
                display: 'inline-block',
                transform: 'translateZ(35px)', // Floating layer
                cursor: 'default',
              }}
            >
              <span style={{ color: '#ffffff' }}>Open</span>
              <span className="brand-gradient-jam">Jam</span>
            </motion.h1>

            <motion.h2
              className="hero-slogan"
              variants={fadeUpVariants}
              style={{
                fontSize: 'clamp(20px, 3.2vw, 26px)',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.5px',
                marginBottom: '16px',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                transform: 'translateZ(20px)', // Floating layer
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                columnGap: '8px',
                rowGap: '4px',
              }}
            >
              <span>Listen Together.</span>
              <span className="hero-slogan-dynamic">
                {reduceMotion ? (
                  <span style={{ display: 'inline-block', position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap' }}>
                    {slogans[0]}
                  </span>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={sloganIndex}
                      initial={{ opacity: 0, y: 12, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -12, filter: 'blur(2px)' }}
                      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                      style={{ display: 'inline-block', position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap' }}
                    >
                      {slogans[sloganIndex]}
                    </motion.span>
                  </AnimatePresence>
                )}
              </span>
            </motion.h2>

          {/* Dancing Audio Equalizer Visualizer */}
          {isPlayingPreview && activePreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                display: 'inline-flex',
                gap: '6px',
                alignItems: 'center',
                justifyContent: 'center',
                height: '32px',
                marginBottom: '20px',
                padding: '4px 16px',
                background: 'rgba(255, 176, 58, 0.06)',
                border: '1px solid rgba(255, 176, 58, 0.2)',
                borderRadius: '99px',
                pointerEvents: 'none',
                transform: 'translateZ(25px)', // Floating layer
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--amber)',
                  marginRight: '6px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px',
                }}
              >
                Previewing: {activePreview.trackName}
              </span>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '18px' }}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <motion.div
                    key={idx}
                    style={{
                      width: '2px',
                      backgroundColor: 'var(--amber)',
                      borderRadius: '1px',
                      boxShadow: '0 0 6px var(--amber)',
                    }}
                    animate={{
                      height: ['6px', `${Math.random() * 16 + 6}px`, '6px'],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: Math.random() * 0.4 + 0.3,
                      ease: 'easeInOut',
                      delay: idx * 0.04,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <motion.p
            className="hero-sub"
            variants={fadeUpVariants}
            style={{
              textAlign: 'center',
              maxWidth: '480px',
              margin: '0 auto 32px auto',
              fontSize: '15px',
              color: 'var(--text-2)',
              lineHeight: 1.6,
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
              transform: 'translateZ(18px)', // Floating layer
            }}
          >
            {me ? (
              me.avatar_url ? (
                <>Welcome back, <strong className="hero-sub-highlight">@{me.display_name}</strong>. Jump into a live room or spin up your own queue.</>
              ) : (
                <>Welcome back, <strong className="hero-sub-highlight">{me.display_name}</strong>. Jump into a live room or spin up your own queue.</>
              )
            ) : (
              'Social Listening, but make it classy. Create a listening room, queue tracks from YouTube, and discover music with friends in real-time.'
            )}
          </motion.p>

          <motion.div
            className="hero-actions"
            variants={fadeUpVariants}
            style={{
              justifyContent: 'center',
              gap: '14px',
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              transform: 'translateZ(28px)', // Floating layer
            }}
          >
            <motion.button
              type="button"
              id="btn-instant-jam"
              className="btn btn-primary btn-elegant-glow btn-primary-pulse btn-bubble"
              onClick={onInstantJam}
              style={{ 
                padding: '14px 28px', 
                fontSize: '15px', 
                borderRadius: '99px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px',
              }}
              whileHover={reduceMotion ? undefined : { 
                scale: 1.05, 
                boxShadow: '0 12px 32px rgba(255, 159, 28, 0.45)' 
              }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <div className="bubble-bg b1" />
              <div className="bubble-bg b2" />
              <div className="bubble-bg b3" />
              <div className="bubble-bg b4" />
              <span className="btn-bubble-content">
                <span>⚡ Instant Jam</span>
                <ArrowIcon />
              </span>
            </motion.button>

            <div className="hero-sub-actions-row">
              {!me ? (
                <>
                  <motion.button
                    type="button"
                    className="btn btn-discord btn-discord-cta btn-elegant-glow btn-bubble btn-discord-bubble"
                    onClick={onDiscordLogin}
                    style={{ 
                      borderRadius: '99px',
                    }}
                    whileHover={reduceMotion ? undefined : { 
                      scale: 1.05, 
                      boxShadow: '0 12px 32px rgba(88, 101, 242, 0.35)' 
                    }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  >
                    <div className="bubble-bg b1" />
                    <div className="bubble-bg b2" />
                    <div className="bubble-bg b3" />
                    <div className="bubble-bg b4" />
                    <span className="btn-bubble-content">
                      <svg
                        width="18"
                        height="13"
                        viewBox="0 0 71 55"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        style={{ marginRight: '8px' }}
                      >
                        <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.1v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1 58.7 58.7 0 0018-9.1v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1-.1zM23.7 37c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7z" />
                      </svg>
                      Sign in
                    </span>
                  </motion.button>
                  <motion.button
                    type="button"
                    className="btn btn-secondary btn-elegant-glow btn-bubble btn-guest-bubble"
                    onClick={onJoinGuest}
                    style={{ 
                      borderRadius: '99px',
                    }}
                    whileHover={reduceMotion ? undefined : { 
                      scale: 1.05, 
                      boxShadow: '0 12px 32px rgba(255, 255, 255, 0.15)' 
                    }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  >
                    <div className="bubble-bg b1" />
                    <div className="bubble-bg b2" />
                    <div className="bubble-bg b3" />
                    <div className="bubble-bg b4" />
                    <span className="btn-bubble-content">
                      👋 Guest
                    </span>
                  </motion.button>
                </>
              ) : (
                <motion.button
                  type="button"
                  className="btn btn-secondary btn-elegant-glow btn-bubble btn-guest-bubble"
                  onClick={onCreateRoom}
                  style={{ 
                    borderRadius: '99px',
                  }}
                  whileHover={reduceMotion ? undefined : { 
                    scale: 1.05, 
                    boxShadow: '0 12px 32px rgba(255, 255, 255, 0.15)' 
                  }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  <div className="bubble-bg b1" />
                  <div className="bubble-bg b2" />
                  <div className="bubble-bg b3" />
                  <div className="bubble-bg b4" />
                  <span className="btn-bubble-content">
                    ➕ Create Jam
                  </span>
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
        </div>
      </div>

      {/* Floating Instruction / Hint */}
      <div
        className="dome-hint"
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
          opacity: 0.85,
        }}
      >
        <span>🖱️ Click & drag background to spin • Click a cover to preview</span>
      </div>
    </section>
  );
}
