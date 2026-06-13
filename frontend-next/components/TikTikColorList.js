'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';

export const TikTikColorList = ({
  projects = [],
  className = '',
  showPreview = true,
  previewSize = 'lg',
  enableSound = true,
  onItemClick
}) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const containerRef = useRef(null);

  // Mouse coordinate tracking for the floating preview
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring configuration for smooth cursor follow lag/inertia
  const springConfig = { stiffness: 120, damping: 18, mass: 0.6 };
  const floatX = useSpring(mouseX, springConfig);
  const floatY = useSpring(mouseY, springConfig);

  // Synthesize a satisfying clicky UI tick sound using Web Audio API (zero network latency)
  const playTickSound = () => {
    if (!enableSound) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.03);
      
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio Context failed to initialize (user interaction required first)', e);
    }
  };

  // Track mouse moves on the container
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Position relative to the container
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [mouseX, mouseY]);

  // Play tick sound whenever the hovered item changes
  const handleMouseEnterItem = (index) => {
    setHoveredIdx(index);
    playTickSound();
  };

  const handleMouseLeaveItem = () => {
    setHoveredIdx(null);
  };

  // Determine preview size styling classes
  const getPreviewSizeStyles = () => {
    switch (previewSize) {
      case 'sm':
        return { width: '140px', height: '180px' };
      case 'md':
        return { width: '190px', height: '250px' };
      case 'lg':
      default:
        return { width: '240px', height: '320px' };
    }
  };

  const currentBgColor = hoveredIdx !== null ? projects[hoveredIdx]?.bgColor : 'transparent';

  return (
    <div
      ref={containerRef}
      className={`tiktik-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '600px',
        padding: '80px 24px',
        overflow: 'hidden',
        borderRadius: '32px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        background: hoveredIdx !== null ? `${currentBgColor}0f` : 'rgba(10, 10, 15, 0.4)',
        boxShadow: hoveredIdx !== null 
          ? `inset 0 0 100px ${currentBgColor}1a, 0 20px 80px rgba(0, 0, 0, 0.6)`
          : 'inset 0 0 40px rgba(0,0,0,0.4)',
        transition: 'background 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.5s ease, box-shadow 0.8s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {/* Background Color Glow Ring */}
      <AnimatePresence>
        {hoveredIdx !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.15, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'absolute',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${projects[hoveredIdx]?.bgColor} 0%, rgba(0,0,0,0) 70%)`,
              filter: 'blur(60px)',
              pointerEvents: 'none',
              zIndex: 1,
              top: '50%',
              left: '50%',
              x: '-50%',
              y: '-50%'
            }}
          />
        )}
      </AnimatePresence>

      {/* List items block */}
      <div className="tiktik-list-wrap" style={{ width: '100%', maxWidth: '800px', zIndex: 2 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {projects.map((project, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <li
                key={project.id}
                onMouseEnter={() => handleMouseEnterItem(i)}
                onMouseLeave={handleMouseLeaveItem}
                onClick={() => onItemClick?.(project)}
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  padding: '24px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative'
                }}
              >
                {/* Custom Hover Highlight Layer */}
                {isHovered && (
                  <motion.div
                    layoutId="tiktik-item-bg"
                    className="tiktik-item-hover-bg"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '12px',
                      zIndex: -1
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}

                {/* Left Side Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        color: isHovered ? project.bgColor : 'var(--text-3)',
                        transition: 'color 0.3s ease'
                      }}
                    >
                      {project.badge}
                    </span>
                  </div>
                  
                  <motion.h3
                    style={{
                      fontSize: 'clamp(20px, 3.5vw, 28px)',
                      fontWeight: 800,
                      color: isHovered ? '#ffffff' : 'var(--text-2)',
                      letterSpacing: '-0.5px',
                      fontFamily: "var(--font-display)"
                    }}
                    animate={{ x: isHovered ? 12 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    {project.name}
                  </motion.h3>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-3)',
                      margin: 0,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      opacity: isHovered ? 0.9 : 0.6,
                      transition: 'opacity 0.3s ease'
                    }}
                  >
                    {project.description}
                  </p>
                </div>

                {/* Right Side: Animated Tick/Checkmark Icon */}
                <div style={{ paddingLeft: '16px', display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: isHovered ? `2px solid ${project.bgColor}` : '2px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                      background: isHovered ? `${project.bgColor}1a` : 'transparent',
                      boxShadow: isHovered ? `0 0 12px ${project.bgColor}4d` : 'none'
                    }}
                  >
                    <svg
                      width="12"
                      height="9"
                      viewBox="0 0 12 9"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <motion.path
                        d="M1.5 4L4.5 7L10.5 1.5"
                        stroke={isHovered ? project.bgColor : 'rgba(255, 255, 255, 0.1)'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: isHovered ? 1 : 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </svg>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Floating Spring-loaded Draggable Preview Card (Desktop Only) */}
      {showPreview && hoveredIdx !== null && (
        <motion.div
          drag
          dragConstraints={{ left: 0, right: 1000, top: 0, bottom: 800 }}
          dragElastic={0.15}
          className="tiktik-preview-card desktop-only-preview"
          style={{
            position: 'absolute',
            left: floatX,
            top: floatY,
            ...getPreviewSizeStyles(),
            pointerEvents: 'auto', // User can hover over and drag the card
            zIndex: 10,
            x: '-50%',
            y: '-50%',
            borderRadius: '24px',
            overflow: 'hidden',
            border: `1px solid ${projects[hoveredIdx]?.bgColor}40`,
            boxShadow: `0 30px 70px rgba(0, 0, 0, 0.8), 0 0 30px ${projects[hoveredIdx]?.bgColor}26`,
            cursor: 'grab'
          }}
          whileDrag={{ cursor: 'grabbing', scale: 1.05 }}
          initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* Card Glass Overlay reflection effect */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />
          <img
            src={projects[hoveredIdx]?.image}
            alt={projects[hoveredIdx]?.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
          />
        </motion.div>
      )}
    </div>
  );
};

export default TikTikColorList;
