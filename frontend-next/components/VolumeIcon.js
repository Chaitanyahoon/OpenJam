'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const VolumeIcon = ({ isMuted, onToggle, width = 16, height = 16, className = '' }) => {
  return (
    <div
      onClick={onToggle}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        userSelect: 'none',
        flexShrink: 0
      }}
      role="button"
      aria-label={isMuted ? "Unmute audio" : "Mute audio"}
    >
      <motion.div
        initial={false}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }}
        animate={{
          rotate: isMuted ? [0, -15, 5, -2, 0] : 0,
        }}
        transition={{
          duration: 0.4
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            color: 'currentColor'
          }}
        >
          {/* Speaker Base Shape */}
          <path
            fill="currentColor"
            stroke="none"
            d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
          />

          {/* Sound Waves (Opacity synced to mute state) */}
          <motion.g
            animate={{
              opacity: isMuted ? 0.25 : 1
            }}
            transition={{ duration: 0.2 }}
          >
            <path
              fill="none"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="currentColor"
              d="M16 9a5 5 0 0 1 0 6"
            />
            <path
              fill="none"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="currentColor"
              d="M19.364 18.364a9 9 0 0 0 0-12.728"
            />
          </motion.g>
        </svg>

        {/* Diagonal Slash/Mute Line Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            transform: 'rotate(-40deg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}>
            <motion.div
              animate={{ scaleY: isMuted ? 1 : 0 }}
              transition={{
                ease: "easeInOut",
                duration: isMuted ? 0.15 : 0.08,
              }}
              style={{
                transformOrigin: "top",
                height: '120%',
                width: '3px',
                backgroundColor: 'var(--bg-base, #0c0c10)',
                borderRadius: '99px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                height: '100%',
                width: '1px',
                backgroundColor: 'currentColor',
                borderRadius: '99px'
              }} />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VolumeIcon;
