'use client';

import React, { useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';

export default function VinylPlayer() {
  const armRef = useRef(null);
  const discRef = useRef(null);
  const cardRef = useRef(null);
  const barRefs = useRef([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(22);
  const [tipText, setTipText] = useState('Drag needle to play preview');
  const [tipStyle, setTipStyle] = useState({});
  const [indicatorText, setIndicatorText] = useState('LIVE SYNC');
  const [indicatorStyle, setIndicatorStyle] = useState({});

  // Web Audio Nodes
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const chordsIntervalRef = useRef(null);
  const visualizerIdRef = useRef(null);
  const spinTweenRef = useRef(null);
  const activeOscillatorsRef = useRef([]);

  const isDraggingRef = useRef(false);
  const dragStartAngleRef = useRef(0);

  useEffect(() => {
    // A. Platter Loop spin driven by GSAP loop
    if (discRef.current) {
      const spin = gsap.to(discRef.current, {
        rotation: 360,
        duration: 8,
        repeat: -1,
        ease: 'none',
        paused: true,
      });
      spin.timeScale(0);
      spin.play();
      spinTweenRef.current = spin;
    }

    return () => {
      stopAudio();
      if (spinTweenRef.current) {
        spinTweenRef.current.kill();
      }
    };
  }, []);

  // Set angle of arm
  const setArmAngle = (deg) => {
    const clampedDeg = Math.max(15, Math.min(45, deg));
    setCurrentAngle(clampedDeg);
    gsap.set(armRef.current, { rotation: clampedDeg });
  };

  const getArmOrigin = () => {
    if (!armRef.current) return { x: 0, y: 0 };
    const rect = armRef.current.getBoundingClientRect();
    return {
      x: window.scrollX + rect.left + 15,
      y: window.scrollY + rect.top + 15,
    };
  };

  // Toggle arm state
  const togglePlay = (play) => {
    setIsPlaying(play);
    if (play) {
      // Elastic swing transition onto record using GSAP
      gsap.to(armRef.current, {
        rotation: 38,
        duration: 0.8,
        ease: 'elastic.out(1.1, 0.5)',
        overwrite: 'auto',
        onComplete: () => {
          setCurrentAngle(38);
        },
      });

      // Platter Spin-Up acceleration transition
      if (spinTweenRef.current) {
        gsap.to(spinTweenRef.current, { timeScale: 1, duration: 1.8, ease: 'power1.in' });
      }

      setTipText('Click arm to stop jam');
      setTipStyle({
        borderColor: 'rgba(16, 185, 129, 0.4)',
        color: 'var(--green)',
      });

      setIndicatorText('SOLO JAMMING');
      setIndicatorStyle({
        color: 'var(--green)',
        background: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
      });

      startAudio();
    } else {
      // Elastic swing off record back to rest using GSAP
      gsap.to(armRef.current, {
        rotation: 22,
        duration: 0.6,
        ease: 'back.out(1.6)',
        overwrite: 'auto',
        onComplete: () => {
          setCurrentAngle(22);
        },
      });

      // Platter Spin-Down deceleration transition (inertia)
      if (spinTweenRef.current) {
        gsap.to(spinTweenRef.current, { timeScale: 0, duration: 3.2, ease: 'power2.out' });
      }

      setTipText('Drag needle to play preview');
      setTipStyle({});
      setIndicatorText('LIVE SYNC');
      setIndicatorStyle({});

      stopAudio();
    }
  };

  // Web Audio System
  const startAudio = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Master Gain
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 32;
    masterGain.connect(analyser);
    analyserRef.current = analyser;

    // Create White Noise buffer for dust crackles
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Bandpass Filter crackles
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    noiseFilter.Q.setValueAtTime(1.2, audioCtx.currentTime);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.015, audioCtx.currentTime);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    whiteNoise.start(0);
    noiseNodeRef.current = { source: whiteNoise, gain: noiseGain };

    // Chords looping
    const chords = [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [146.83, 349.23, 440.0, 523.25], // Dm7
      [98.0, 246.94, 293.66, 369.99], // Gmaj7
      [130.81, 329.63, 392.0, 493.88], // Cmaj7
    ];

    let chordIdx = 0;

    const playKick = (time) => {
      if (!audioCtxRef.current) return;
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.connect(gain);
      gain.connect(masterGain);

      osc.frequency.setValueAtTime(110, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);

      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

      osc.start(time);
      osc.stop(time + 0.25);
    };

    const playHat = (time) => {
      if (!audioCtxRef.current) return;
      const src = audioCtxRef.current.createBufferSource();
      src.buffer = noiseBuffer;

      const flt = audioCtxRef.current.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.setValueAtTime(7000, time);

      const gn = audioCtxRef.current.createGain();
      gn.gain.setValueAtTime(0.012, time);
      gn.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      src.connect(flt);
      flt.connect(gn);
      gn.connect(masterGain);

      src.start(time);
      src.stop(time + 0.12);
    };

    const playChord = (frequencies) => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
      const now = audioCtxRef.current.currentTime;
      frequencies.forEach((freq) => {
        const osc = audioCtxRef.current.createOscillator();
        const oscGain = audioCtxRef.current.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 1.5, now);

        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(0.12, now + 0.6);
        oscGain.gain.exponentialRampToValueAtTime(0.06, now + 2.5);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 4);
        activeOscillatorsRef.current.push(osc);
      });

      playKick(now);
      playKick(now + 2.0);
      playHat(now + 1.0);
      playHat(now + 3.0);
    };

    playChord(chords[chordIdx]);
    chordIdx = (chordIdx + 1) % chords.length;

    chordsIntervalRef.current = setInterval(() => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'suspended') {
        playChord(chords[chordIdx]);
        chordIdx = (chordIdx + 1) % chords.length;
      }
    }, 4000);

    startVisualizer();
  };

  const stopAudio = () => {
    if (chordsIntervalRef.current) {
      clearInterval(chordsIntervalRef.current);
      chordsIntervalRef.current = null;
    }
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.source.stop();
      } catch (e) {}
      noiseNodeRef.current = null;
    }
    activeOscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {}
    });
    activeOscillatorsRef.current = [];

    if (visualizerIdRef.current) {
      cancelAnimationFrame(visualizerIdRef.current);
      visualizerIdRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.suspend();
    }
    barRefs.current.forEach((bar) => {
      if (bar) bar.style.transform = '';
    });
  };

  const startVisualizer = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const smoothedValues = new Array(5).fill(0.15);

    const draw = () => {
      if (!analyserRef.current || !visualizerIdRef.current) return;
      visualizerIdRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      barRefs.current.forEach((bar, idx) => {
        if (!bar) return;
        const val = dataArray[idx % dataArray.length] / 255;
        const targetScale = Math.max(0.15, Math.min(1.0, val * 2.2));

        if (targetScale > smoothedValues[idx]) {
          smoothedValues[idx] = targetScale;
        } else {
          smoothedValues[idx] += (targetScale - smoothedValues[idx]) * 0.16;
        }

        bar.style.transform = `scaleY(${smoothedValues[idx]})`;
      });
    };
    visualizerIdRef.current = requestAnimationFrame(draw);
  };

  // Mouse / Touch Event Drag Handlers
  const handleDragStart = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    if (armRef.current) armRef.current.classList.add('dragging');

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const origin = getArmOrigin();
    const startX = clientX - origin.x;
    const startY = clientY - origin.y;
    dragStartAngleRef.current = Math.atan2(startY, startX) * (180 / Math.PI);

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchend', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const origin = getArmOrigin();
    const x = clientX - origin.x;
    const y = clientY - origin.y;
    const moveAngle = Math.atan2(y, x) * (180 / Math.PI);
    const angleDiff = moveAngle - dragStartAngleRef.current;

    setArmAngle(startAngleAdjusted(angleDiff));
  };

  const startAngleAdjusted = (diff) => {
    let target = currentAngle + diff;
    if (isPlaying) {
      // If currently playing and dragging, base angle defaults to 38 deg on platter
      target = 38 + diff;
    } else {
      target = 22 + diff;
    }
    return target;
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (armRef.current) armRef.current.classList.remove('dragging');

    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);

    // If drag angle is moved far enough (>30deg), trigger loop playback
    if (currentAngle > 30) {
      togglePlay(true);
    } else {
      togglePlay(false);
    }
  };

  const handleArmClick = () => {
    // Toggle play state on arm click
    if (isPlaying) {
      togglePlay(false);
    } else {
      togglePlay(true);
    }
  };

  return (
    <div className="hero-showcase-right">
      <div className="hero-player-card" ref={cardRef}>
        <div className="card-screw top-left"></div>
        <div className="card-screw top-right"></div>
        <div className="card-screw bottom-left"></div>
        <div className="card-screw bottom-right"></div>
        
        <div className="hero-player-top">
          <span className="live-indicator" style={indicatorStyle}>
            <span className="live-dot" style={isPlaying ? { background: 'var(--green)', boxShadow: '0 0 8px var(--green)' } : {}}></span>
            {indicatorText}
          </span>
          <span className="host-badge">OpenJam Vinyl</span>
        </div>
        
        <div className="arm-tip" style={tipStyle}>{tipText}</div>
        
        <div className="hero-vinyl-container">
          <div className="hero-vinyl-disc" ref={discRef}>
            <div className="hero-vinyl-grooves"></div>
            <div className="hero-vinyl-label">
              <div className="hero-vinyl-center"></div>
            </div>
          </div>
          
          <div
            className="hero-tonearm"
            ref={armRef}
            style={{ transform: `rotate(${currentAngle}deg)` }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={handleArmClick}
          >
            <svg width="30" height="130" viewBox="0 0 30 130" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="15" r="12" fill="var(--amber)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
              <circle cx="15" cy="15" r="5" fill="#050508" />
              <rect x="13" y="27" width="4" height="85" fill="#cbd5e1" />
              <rect x="9" y="112" width="12" height="15" rx="2" fill="#475569" />
              <path d="M12 127L18 127L15 120Z" fill="#94a3b8" />
            </svg>
          </div>
        </div>
        
        <div className="hero-player-info">
          <div className="hero-track-details">
            <div className="hero-track-title">Lofi Chill beats #42</div>
            <div className="hero-track-artist">Analog Vibe Collective</div>
          </div>
          
          <div className="hero-eq-waves">
            {[1, 2, 3, 4, 5].map((num, idx) => (
              <span
                key={num}
                className={`eq-bar eq-${num}`}
                ref={(el) => {
                  barRefs.current[idx] = el;
                }}
                style={!isPlaying ? { animation: 'none' } : {}}
              ></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
