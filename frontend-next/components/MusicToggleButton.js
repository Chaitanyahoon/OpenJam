'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useSound from 'use-sound';

export const MusicToggleButton = () => {
  const bars = 5;

  const getRandomHeights = () => {
    return Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2);
  };

  const [heights, setHeights] = useState(getRandomHeights());
  const [isPlaying, setIsPlaying] = useState(false);

  // use-sound with the correct path for our repo: /audio/audio.mp3
  const [play, { pause }] = useSound('/audio/audio.mp3', {
    loop: true,
    onplay: () => setIsPlaying(true),
    onend: () => setIsPlaying(false),
    onpause: () => setIsPlaying(false),
    onstop: () => setIsPlaying(false),
    soundEnabled: true,
  });

  useEffect(() => {
    if (isPlaying) {
      const waveformIntervalId = setInterval(() => {
        setHeights(getRandomHeights());
      }, 100);

      return () => {
        clearInterval(waveformIntervalId);
      };
    }
    setHeights(Array(bars).fill(0.1));
  }, [isPlaying]);

  const handleClick = () => {
    if (isPlaying) {
      pause();
      setIsPlaying(false);
      return;
    }
    play();
    setIsPlaying(true);
  };

  return (
    <motion.div
      onClick={handleClick}
      key="audio"
      initial={{ padding: '14px 14px' }}
      whileHover={{ padding: '18px 22px' }}
      whileTap={{ padding: '18px 22px' }}
      transition={{ duration: 1, bounce: 0.6, type: 'spring' }}
      style={{
        backgroundColor: isPlaying ? 'rgba(255, 159, 28, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        border: isPlaying ? '1px solid rgba(255, 159, 28, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
        cursor: 'pointer',
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'fit-content',
        height: 'fit-content',
        marginRight: '8px',
      }}
      title={isPlaying ? 'Pause background music' : 'Play background music'}
    >
      <motion.div
        initial={{ opacity: 0, filter: 'blur(4px)' }}
        animate={{
          opacity: 1,
          filter: 'blur(0px)',
        }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ type: 'spring', bounce: 0.35 }}
        style={{
          display: 'flex',
          height: '18px',
          width: '100%',
          alignItems: 'center',
          gap: '4px',
          borderRadius: '9999px',
          justifyContent: 'center',
        }}
      >
        {/* Waveform visualization */}
        {heights.map((height, index) => (
          <motion.div
            key={index}
            style={{
              backgroundColor: isPlaying ? 'var(--amber)' : 'var(--text-1)',
              boxShadow: isPlaying ? '0 0 6px var(--amber)' : 'none',
              width: '1px',
              borderRadius: '9999px',
            }}
            initial={{ height: 1 }}
            animate={{
              height: Math.max(4, height * 14),
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 10,
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
};

// Also keep Skiper25 for completeness if the user ever wants to use the full page layout
export const Skiper25 = () => {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: '20%', display: 'grid', alignContent: 'start', justifyItems: 'center', gap: '24px', padding: '80px 0', textAlign: 'center', color: 'var(--text-1)' }}>
        <span style={{ position: 'relative', maxWidth: '12ch', fontSize: '12px', textTransform: 'uppercase', opacity: 0.4 }}>
          Click to play the music
        </span>
      </div>
      <MusicToggleButton />
    </div>
  );
};

export default MusicToggleButton;
