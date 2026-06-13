'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const VIBES = {
  ambient: {
    name: 'Ambient Lo-Fi',
    bpm: 72,
    color: '#ffb03a',
    accentColor: '#ffd23f',
    visualPreset: 'particles',
    track: 'Quiet Space',
    artist: 'Lofi Collective',
    specs: 'TYPE: ANALOG LOFI • FILTER: LOWPASS • MODE: CHILL'
  },
  synth: {
    name: 'Cyber Synth',
    bpm: 110,
    color: '#ff2a85',
    accentColor: '#a855f7',
    visualPreset: 'wave',
    track: 'Neon Grid Runner',
    artist: 'Retro Horizon',
    specs: 'TYPE: WAVETABLE • FILTER: BANDPASS • MODE: TURBO'
  },
  techno: {
    name: 'Dark Techno',
    bpm: 130,
    color: '#00f5ff',
    accentColor: '#0ea5e9',
    visualPreset: 'rings',
    track: 'Industrial Core',
    artist: 'Frequency Shift',
    specs: 'TYPE: MODULAR • FILTER: HIGHPASS • MODE: RAVE'
  }
};

export default function VibeConsole({ onVibeChange }) {
  const [activeVibeKey, setActiveVibeKey] = useState('ambient');
  const [isPlaying, setIsPlaying] = useState(true);
  const [filterKnob, setFilterKnob] = useState(60);  // 0 to 100
  const [decayKnob, setDecayKnob] = useState(40);   // 0 to 100
  const [mixKnob, setMixKnob] = useState(80);       // 0 to 100
  
  const activeVibe = VIBES[activeVibeKey];

  // Callback to parent for background glows
  useEffect(() => {
    if (onVibeChange) {
      onVibeChange({
        color: activeVibe.color,
        glowColor: activeVibe.accentColor,
        bgTheme: `${activeVibeKey}-theme`
      });
    }
  }, [activeVibeKey]);

  // Simulate audio level meters (VU meter values: 0 to 10)
  const [leftVU, setLeftVU] = useState(Array(10).fill(false));
  const [rightVU, setRightVU] = useState(Array(10).fill(false));

  useEffect(() => {
    if (!isPlaying) {
      setLeftVU(Array(10).fill(false));
      setRightVU(Array(10).fill(false));
      return;
    }

    const interval = setInterval(() => {
      // VU levels depend on active volume/mix knobs
      const mixScale = mixKnob / 100;
      const maxL = Math.floor(Math.random() * 7 * mixScale + 3);
      const maxR = Math.floor(Math.random() * 7 * mixScale + 3);

      setLeftVU(Array(10).fill(false).map((_, i) => i < maxL));
      setRightVU(Array(10).fill(false).map((_, i) => i < maxR));
    }, 120);

    return () => clearInterval(interval);
  }, [isPlaying, mixKnob]);

  return (
    <div className="te-synthesizer">
      {/* Top Deck Info bar */}
      <div className="te-header-bar">
        <div className="te-led-status">
          <span className={`te-led-indicator ${isPlaying ? 'on' : ''}`} style={{ backgroundColor: activeVibe.color, boxShadow: `0 0 10px ${activeVibe.color}` }} />
          <span className="te-led-label">{activeVibe.specs}</span>
        </div>
        <div className="te-bpm-readout" style={{ color: activeVibe.color }}>
          {activeVibe.bpm} <span className="lbl">BPM</span>
        </div>
      </div>

      {/* Main Grid: VU Left, Center Screen, knobs Column */}
      <div className="te-body-grid">
        {/* VU Left */}
        <div className="te-vu-column">
          <span className="vu-label">L</span>
          <div className="vu-led-stack">
            {leftVU.slice().reverse().map((active, i) => (
              <span 
                key={i} 
                className={`vu-led-bar ${active ? 'active' : ''}`} 
                style={active ? { backgroundColor: i < 3 ? '#ff3b30' : i < 6 ? '#ffcc00' : '#34c759' } : {}}
              />
            ))}
          </div>
        </div>

        {/* Center Canvas / Screen */}
        <div className="te-screen" style={{ borderColor: `${activeVibe.color}22` }}>
          {/* Waveform graphic */}
          <div className="te-screen-inner">
            <svg viewBox="0 0 200 200" className="te-waveform-svg">
              {/* Concentric pulsing rings */}
              <motion.circle 
                cx="100" cy="100" r="30" 
                stroke={`${activeVibe.color}22`} strokeWidth="1" fill="none"
                animate={isPlaying ? { scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.circle 
                cx="100" cy="100" r="45" 
                stroke={`${activeVibe.color}33`} strokeWidth="1" fill="none"
                animate={isPlaying ? { scale: [1, 1.6, 1], opacity: [0.6, 0.1, 0.6] } : {}}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />

              {/* Central Audio Orbit */}
              <motion.g 
                animate={isPlaying ? { rotate: 360 } : {}}
                transition={{ repeat: Infinity, ease: 'linear', duration: activeVibeKey === 'ambient' ? 12 : activeVibeKey === 'synth' ? 6 : 4 }}
                style={{ transformOrigin: '100px 100px' }}
              >
                {/* Orbital nodes */}
                <circle cx="100" cy="50" r="4" fill={activeVibe.color} />
                <circle cx="140" cy="140" r="3.5" fill={activeVibe.accentColor} />
                <line x1="100" y1="100" x2="100" y2="50" stroke={`${activeVibe.color}1e`} strokeWidth="1.5" />
                <line x1="100" y1="100" x2="140" y2="140" stroke={`${activeVibe.accentColor}16`} strokeWidth="1.5" />
              </motion.g>

              {/* Pulsing Visual Wave Center Ring */}
              <motion.circle 
                cx="100" cy="100" r="14" 
                fill="none" stroke={activeVibe.color} strokeWidth="3"
                animate={isPlaying ? { strokeWidth: [3, 6, 3], scale: [0.95, 1.1, 0.95] } : {}}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <circle cx="100" cy="100" r="5" fill="#fff" />
            </svg>
          </div>

          <div className="te-screen-text">
            <span className="sc-artist">{activeVibe.artist}</span>
            <span className="sc-track" style={{ color: activeVibe.color }}>{activeVibe.track}</span>
          </div>
        </div>

        {/* VU Right */}
        <div className="te-vu-column">
          <span className="vu-label">R</span>
          <div className="vu-led-stack">
            {rightVU.slice().reverse().map((active, i) => (
              <span 
                key={i} 
                className={`vu-led-bar ${active ? 'active' : ''}`} 
                style={active ? { backgroundColor: i < 3 ? '#ff3b30' : i < 6 ? '#ffcc00' : '#34c759' } : {}}
              />
            ))}
          </div>
        </div>

        {/* Tactile Rotary Knobs Column */}
        <div className="te-knobs-column">
          {/* Knob 1: Filter */}
          <div className="te-knob-wrapper">
            <div className="knob-label-group">
              <span className="knob-lbl">FILTER</span>
              <span className="knob-val">{filterKnob}</span>
            </div>
            <div className="te-rotary-knob-outer" onClick={() => setFilterKnob(p => (p + 20) % 120)}>
              <motion.div 
                className="te-rotary-knob-pointer"
                animate={{ rotate: (filterKnob / 100) * 270 - 135 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{ backgroundColor: activeVibe.color }}
              />
            </div>
          </div>

          {/* Knob 2: Mix */}
          <div className="te-knob-wrapper">
            <div className="knob-label-group">
              <span className="knob-lbl">MIX</span>
              <span className="knob-val">{mixKnob}</span>
            </div>
            <div className="te-rotary-knob-outer" onClick={() => setMixKnob(p => (p + 20) % 120)}>
              <motion.div 
                className="te-rotary-knob-pointer"
                animate={{ rotate: (mixKnob / 100) * 270 - 135 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{ backgroundColor: activeVibe.color }}
              />
            </div>
          </div>

          {/* Knob 3: Decay */}
          <div className="te-knob-wrapper">
            <div className="knob-label-group">
              <span className="knob-lbl">DECAY</span>
              <span className="knob-val">{decayKnob}</span>
            </div>
            <div className="te-rotary-knob-outer" onClick={() => setDecayKnob(p => (p + 20) % 120)}>
              <motion.div 
                className="te-rotary-knob-pointer"
                animate={{ rotate: (decayKnob / 100) * 270 - 135 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{ backgroundColor: activeVibe.color }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preset Buttons & Control Keys */}
      <div className="te-footer-controls">
        <div className="te-preset-tabs">
          {Object.keys(VIBES).map((key) => {
            const vibe = VIBES[key];
            const active = activeVibeKey === key;
            return (
              <button
                key={key}
                onClick={() => setActiveVibeKey(key)}
                className={`te-vibe-tab ${active ? 'active' : ''}`}
                style={active ? { '--vibe-color': vibe.color, color: vibe.color } : {}}
              >
                {vibe.name.toUpperCase()}
              </button>
            );
          })}
        </div>

        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`te-power-btn ${isPlaying ? 'on' : ''}`}
          style={{ borderColor: activeVibe.color, color: activeVibe.color }}
        >
          {isPlaying ? 'PAUSE MODULE' : 'RUN MODULE'}
        </button>
      </div>
    </div>
  );
}
