'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, CheckCircle2, XCircle, Clock, Volume2, Sparkles, X, ChevronRight, Play, Users, Disc, Zap, Award } from 'lucide-react';

export default function TriviaOverlay({
  socket,
  roomId,
  isHost,
  me,
  triviaRound, // Active round data or null
  triviaResult, // Ended round result (correct answer, round_scores, leaderboard) or null
  listeners = [],
  room = null,
  onClose,
  onStartNextRound,
  onEndSession,
}) {
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [answeredUsers, setAnsweredUsers] = useState([]);
  const [remainingMs, setRemainingMs] = useState(10000);
  const [lockedLatencyMs, setLockedLatencyMs] = useState(null);
  const confettiCanvasRef = useRef(null);

  const durationMs = triviaRound?.duration_ms || 10000;
  const startTimestamp = triviaRound?.start_timestamp || Date.now();

  // Reset local state when a new round starts
  useEffect(() => {
    if (triviaRound) {
      setSelectedOptionId(null);
      setIsLocked(false);
      setAnsweredUsers([]);
      setLockedLatencyMs(null);
    }
  }, [triviaRound?.round_id]);

  // Synchronized 10s Countdown Timer
  useEffect(() => {
    if (!triviaRound || triviaResult) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimestamp;
      const left = Math.max(0, durationMs - elapsed);
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [triviaRound, triviaResult, startTimestamp, durationMs]);

  // Real-time socket listener for other users who answered
  useEffect(() => {
    if (!socket) return;

    const handleUserAnswered = (data) => {
      setAnsweredUsers((prev) => {
        if (prev.some((u) => u.user_id === data.user_id)) return prev;
        return [...prev, data];
      });
    };

    socket.on('trivia_user_answered', handleUserAnswered);
    return () => {
      socket.off('trivia_user_answered', handleUserAnswered);
    };
  }, [socket]);

  // Submit Answer Handler
  const handleSelectOption = (optionId) => {
    if (isLocked || triviaResult || !triviaRound) return;
    const elapsed = Date.now() - startTimestamp;
    setSelectedOptionId(optionId);
    setIsLocked(true);
    setLockedLatencyMs(elapsed);

    if (socket) {
      socket.emit('trivia_submit_answer', {
        room_id: roomId,
        round_id: triviaRound.round_id,
        option_id: optionId,
        client_time_ms: elapsed,
      });
    }
  };

  // Keyboard Shortcuts (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (['1', '2', '3', '4'].includes(e.key) && triviaRound && !isLocked && !triviaResult) {
        const optIndex = parseInt(e.key, 10) - 1;
        if (triviaRound.options?.[optIndex]) {
          handleSelectOption(triviaRound.options[optIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triviaRound, isLocked, triviaResult]);

  // Celebratory Confetti Particle System for Podium
  useEffect(() => {
    if (!triviaResult || !confettiCanvasRef.current) return;
    const canvas = confettiCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ff9f1c', '#2ec4b6', '#e71d36', '#fdfffc', '#a78bfa', '#38bdf8'];
    const particles = Array.from({ length: 110 }, () => ({
      x: canvas.width * 0.6,
      y: canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.9) * 20,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      alpha: 1,
    }));

    let animationId;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // gravity
        p.rotation += p.vRot;
        p.alpha -= 0.007;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (particles.some((p) => p.alpha > 0)) {
        animationId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [triviaResult]);

  const progressPercent = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));

  // Determine progress color transition
  const getProgressColor = () => {
    if (progressPercent > 50) return '#2ec4b6'; // Cyan
    if (progressPercent > 20) return '#ff9f1c'; // Amber
    return '#e71d36'; // Crimson
  };

  // Build merged participant leaderboard & live status list
  const combinedParticipants = useMemo(() => {
    const map = new Map();

    // Seed from active room listeners
    listeners.forEach((l) => {
      map.set(l.user_id, {
        user_id: l.user_id,
        display_name: l.display_name,
        avatar_url: l.avatar_url,
        is_host: l.is_host || (room && room.host_user_id === l.user_id),
        total_score: 0,
        streak: 0,
        answered: false,
        elapsed_ms: null,
        round_points: null,
        is_correct: null,
      });
    });

    // Merge existing leaderboard / scores if available
    const leaderboard = triviaResult?.leaderboard || [];
    leaderboard.forEach((u) => {
      const existing = map.get(u.user_id) || {
        user_id: u.user_id,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        is_host: room && room.host_user_id === u.user_id,
        answered: false,
        elapsed_ms: null,
        round_points: null,
        is_correct: null,
      };
      existing.total_score = u.total_score;
      existing.streak = u.streak || 0;
      map.set(u.user_id, existing);
    });

    // Merge answered users stream
    answeredUsers.forEach((a) => {
      const existing = map.get(a.user_id);
      if (existing) {
        existing.answered = true;
        existing.elapsed_ms = a.elapsed_ms;
        existing.total_score = a.total_score ?? existing.total_score;
        existing.streak = a.streak ?? existing.streak;
      }
    });

    // Merge round results
    const roundScores = triviaResult?.round_scores || [];
    roundScores.forEach((r) => {
      const existing = map.get(r.user_id);
      if (existing) {
        existing.answered = true;
        existing.is_correct = r.is_correct;
        existing.round_points = r.round_points;
        existing.total_score = r.total_score ?? existing.total_score;
        existing.streak = r.streak ?? existing.streak;
        existing.elapsed_ms = r.elapsed_ms;
      }
    });

    // Sort by total score descending
    return Array.from(map.values()).sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
  }, [listeners, triviaResult, answeredUsers, room]);

  const leaderboard = triviaResult?.leaderboard || combinedParticipants;
  const top1 = leaderboard[0] || null;
  const top2 = leaderboard[1] || null;
  const top3 = leaderboard[2] || null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6, 8, 14, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <canvas
        ref={confettiCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2001,
        }}
      />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1080px',
          height: 'min(780px, 92vh)',
          background: 'linear-gradient(180deg, rgba(22, 24, 38, 0.97) 0%, rgba(12, 14, 22, 0.99) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.85), 0 0 50px rgba(168, 85, 247, 0.2)',
          borderRadius: '28px',
          overflow: 'hidden',
          zIndex: 2002,
          display: 'flex',
          flexDirection: 'row',
          color: '#ffffff',
          fontFamily: 'var(--font-display-next), Outfit, system-ui, sans-serif',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
          title="Minimize Trivia Arena"
        >
          <X size={18} />
        </button>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ══ LEFT SIDEBAR: PARTICIPANTS & LIVE SCOREBOARD (310px) ════════ */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            width: '310px',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.28)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {/* Arena Header */}
          <div
            style={{
              padding: '22px 20px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
                }}
              >
                <Trophy size={16} color="#fff" />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#f3e8ff' }}>
                Trivia Arena
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              <span>Round {triviaRound?.round_number || triviaResult?.round_number || 1}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={12} /> {combinedParticipants.length} Players
              </span>
            </div>
          </div>

          {/* Scrollable Participants List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {combinedParticipants.map((p, idx) => {
              const isMe = me && (p.user_id === me.id || p.display_name === me.display_name);
              const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

              return (
                <motion.div
                  key={p.user_id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '14px',
                    background: isMe
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(124, 58, 237, 0.1) 100%)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isMe
                      ? '1px solid rgba(168, 85, 247, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      fontSize: idx < 3 ? '16px' : '11px',
                      fontWeight: 800,
                      width: '24px',
                      textAlign: 'center',
                      color: idx === 0 ? '#ffb703' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {rankIcon}
                  </div>

                  {/* Avatar */}
                  <div style={{ position: 'relative' }}>
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt=""
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {p.display_name ? p.display_name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                  </div>

                  {/* Name & Status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.display_name}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: '9px', fontWeight: 800, background: 'var(--amber, #ff9f1c)', color: '#000', padding: '1px 5px', borderRadius: '6px' }}>
                          YOU
                        </span>
                      )}
                      {p.is_host && (
                        <span style={{ fontSize: '9px', fontWeight: 800, background: 'rgba(255,159,28,0.2)', color: '#ff9f1c', padding: '1px 5px', borderRadius: '6px' }}>
                          HOST
                        </span>
                      )}
                    </div>

                    {/* Dynamic Real-time Status */}
                    <div style={{ fontSize: '11px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {!triviaResult && triviaRound && (
                        p.answered ? (
                          <span style={{ color: '#2ec4b6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Zap size={10} /> Answered {p.elapsed_ms ? `(${Math.round(p.elapsed_ms)}ms)` : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                            ⏳ Listening…
                          </span>
                        )
                      )}

                      {triviaResult && (
                        p.is_correct ? (
                          <span style={{ color: '#10b981', fontWeight: 700 }}>
                            ✅ +{p.round_points || 500} pts
                          </span>
                        ) : (
                          <span style={{ color: '#f43f5e', fontWeight: 600 }}>
                            ❌ Missed
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Total Score & Streak */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#f3e8ff' }}>
                      {p.total_score || 0}
                    </div>
                    {p.streak > 1 && (
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#ff9f1c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <Flame size={10} fill="currentColor" /> x{p.streak}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ══ RIGHT MAIN DECK: THE QUIZ & AUDIO ARENA (Remaining Width) ═══ */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '24px 32px',
          }}
        >
          {/* ══ STAGE 1: ACTIVE ROUND QUESTION & BUTTONS ════════════════ */}
          {!triviaResult && triviaRound && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Audio Snippet Wave & Category Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  padding: '12px 18px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #ff9f1c 20%, #1a1d2a 70%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 16px rgba(255, 159, 28, 0.3)',
                    }}
                  >
                    <Disc size={20} color="#000" />
                  </motion.div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px', color: 'var(--amber, #ff9f1c)' }}>
                      10s Mystery Snippet Playing
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                      🎵 Guess this track before time runs out!
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#e9d5ff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '99px',
                  }}
                >
                  <Sparkles size={12} /> Round {triviaRound.round_number || 1}
                </div>
              </div>

              {/* Synchronized 10s Countdown Bar */}
              <div
                style={{
                  width: '100%',
                  height: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  position: 'relative',
                  marginBottom: '16px',
                }}
              >
                <motion.div
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                  style={{
                    height: '100%',
                    background: `linear-gradient(90deg, #ff9f1c 0%, ${getProgressColor()} 100%)`,
                    borderRadius: '9999px',
                    boxShadow: `0 0 16px ${getProgressColor()}`,
                  }}
                />
              </div>

              {/* Time Left & Answer Lock Feedback */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: getProgressColor() }}>
                  <Clock size={16} />
                  <span style={{ fontSize: '15px', fontWeight: 800 }}>{(remainingMs / 1000).toFixed(1)}s left</span>
                </div>

                {isLocked ? (
                  <span style={{ color: '#2ec4b6', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <CheckCircle2 size={16} /> Locked in ({lockedLatencyMs}ms) ⚡
                  </span>
                ) : (
                  <span style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '12px' }}>
                    Press keyboard keys <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>1</kbd> <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>2</kbd> <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>3</kbd> <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>4</kbd>
                  </span>
                )}
              </div>

              {/* 4 Large Interactive Choice Cards (2x2 Grid) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '14px',
                  marginBottom: '20px',
                  flex: 1,
                }}
              >
                {triviaRound.options?.map((opt, idx) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      disabled={isLocked}
                      onClick={() => handleSelectOption(opt.id)}
                      whileHover={!isLocked ? { scale: 1.02, y: -2 } : {}}
                      whileTap={!isLocked ? { scale: 0.98 } : {}}
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(255, 159, 28, 0.3) 0%, rgba(242, 100, 25, 0.3) 100%)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected
                          ? '2px solid #ff9f1c'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '18px',
                        padding: '18px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        textAlign: 'left',
                        cursor: isLocked ? 'default' : 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 0 24px rgba(255, 159, 28, 0.3)' : 'none',
                      }}
                    >
                      {/* Key Shortcut Badge */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: isSelected ? '#ff9f1c' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#0e1018' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.title}
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'rgba(255, 255, 255, 0.55)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {opt.artist}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Speed Bonus Helper Text */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.45)',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span>⚡ 500 Base + Up to 500 Speed Bonus Points</span>
                <span>{answeredUsers.length} / {combinedParticipants.length} Answered</span>
              </div>
            </div>
          )}

          {/* ══ STAGE 2: POST-ROUND CELEBRATORY OLYMPIC PODIUM ═══════════ */}
          {triviaResult && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                {/* Reveal Header */}
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(46, 196, 182, 0.15)',
                      border: '1px solid rgba(46, 196, 182, 0.3)',
                      color: '#2ec4b6',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      padding: '5px 14px',
                      borderRadius: '9999px',
                      marginBottom: '8px',
                    }}
                  >
                    <Trophy size={14} /> Round {triviaResult.round_number || 1} Results
                  </span>
                  <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 0 0' }}>
                    Podium Standings
                  </h2>
                </div>

                {/* Correct Track Reveal Card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    background: 'rgba(46, 196, 182, 0.08)',
                    border: '1px solid rgba(46, 196, 182, 0.25)',
                    borderRadius: '18px',
                    padding: '12px 18px',
                    marginBottom: '22px',
                  }}
                >
                  {triviaResult.correct_answer?.album_art_url ? (
                    <img
                      src={triviaResult.correct_answer.album_art_url}
                      alt={triviaResult.correct_answer.track_name}
                      style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: '#1a1d2a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Volume2 size={24} color="#2ec4b6" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: '#2ec4b6', letterSpacing: '0.5px' }}>
                      Correct Track
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {triviaResult.correct_answer?.track_name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                      {triviaResult.correct_answer?.artist}
                    </div>
                  </div>
                </div>

                {/* 3-Tier Olympic Podium */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '16px',
                    marginBottom: '20px',
                    height: '170px',
                  }}
                >
                  {/* #2 Silver Podium (Left) */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: '130px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {top2 ? top2.display_name : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                      {top2 ? `${top2.total_score} pts` : ''}
                    </div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: '80px' }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>🥈</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>#2</span>
                    </motion.div>
                  </div>

                  {/* #1 Gold Podium (Center) */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: '150px',
                    }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffb703', marginBottom: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {top1 ? top1.display_name : '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#ffb703', marginBottom: '8px' }}>
                      {top1 ? (
                        <>
                          <span>{top1.total_score} pts</span>
                          {top1.streak > 1 && (
                            <span style={{ background: 'rgba(255,183,3,0.2)', padding: '1px 6px', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>
                              🔥 x{top1.streak}
                            </span>
                          )}
                        </>
                      ) : null}
                    </div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: '120px' }}
                      transition={{ duration: 0.6 }}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(180deg, #ffb703 0%, #fb8500 100%)',
                        borderRadius: '16px 16px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 12px 32px rgba(255, 183, 3, 0.4)',
                      }}
                    >
                      <span style={{ fontSize: '32px' }}>🥇</span>
                      <span style={{ fontSize: '15px', fontWeight: 900, color: '#0e1018' }}>#1</span>
                    </motion.div>
                  </div>

                  {/* #3 Bronze Podium (Right) */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: '130px',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {top3 ? top3.display_name : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                      {top3 ? `${top3.total_score} pts` : ''}
                    </div>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: '60px' }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(180deg, #cd7f32 0%, #8b4513 100%)',
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(205, 127, 50, 0.25)',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>🥉</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>#3</span>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Host Controls or Participant Waiting Banner */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                {isHost ? (
                  <>
                    <button
                      onClick={onEndSession}
                      style={{
                        padding: '12px 20px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      End Trivia Battle
                    </button>
                    <button
                      onClick={onStartNextRound}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #ff9f1c 0%, #f26419 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#0e1018',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 8px 24px rgba(255, 159, 28, 0.35)',
                      }}
                    >
                      <Play size={16} fill="currentColor" /> Next Round
                    </button>
                  </>
                ) : (
                  <div style={{ width: '100%', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
                    Waiting for room host to launch the next round…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
