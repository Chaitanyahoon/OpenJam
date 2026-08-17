'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, CheckCircle2, XCircle, Clock, Volume2, Sparkles, X, ChevronRight, Play } from 'lucide-react';

export default function TriviaOverlay({
  socket,
  roomId,
  isHost,
  me,
  triviaRound, // Active round data or null
  triviaResult, // Ended round result (correct answer, round_scores, leaderboard) or null
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
    const particles = Array.from({ length: 90 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2 + 50,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.9) * 18,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
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
        p.alpha -= 0.008;

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

  const leaderboard = triviaResult?.leaderboard || [];
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
        background: 'rgba(8, 10, 16, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '20px',
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
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          background: 'linear-gradient(180deg, rgba(26, 29, 42, 0.95) 0%, rgba(14, 16, 24, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 159, 28, 0.15)',
          borderRadius: '28px',
          overflow: 'hidden',
          zIndex: 2002,
          padding: '28px 32px',
          color: '#ffffff',
          fontFamily: 'var(--font-display-next), Outfit, system-ui, sans-serif',
        }}
      >
        {/* Close / Minimize Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          <X size={18} />
        </button>

        {/* ══ STAGE 1: ACTIVE ROUND QUESTION & BUTTONS ════════════════ */}
        {!triviaResult && triviaRound && (
          <div>
            {/* Header Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 159, 28, 0.15)',
                  border: '1px solid rgba(255, 159, 28, 0.3)',
                  color: '#ff9f1c',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                }}
              >
                <Sparkles size={14} /> Round {triviaRound.round_number || 1}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Listen to the audio snippet and guess the track!
              </span>
            </div>

            {/* Question Heading */}
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 18px 0', letterSpacing: '-0.02em' }}>
              {triviaRound.question || 'Name this track!'}
            </h2>

            {/* Neon Glowing Synced Countdown Bar */}
            <div
              style={{
                width: '100%',
                height: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '9999px',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '24px',
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
                <span>{(remainingMs / 1000).toFixed(1)}s remaining</span>
              </div>

              {isLocked ? (
                <span style={{ color: '#2ec4b6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> Locked in at {lockedLatencyMs}ms!
                </span>
              ) : (
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                  Press keys 1, 2, 3, or 4 to lock in
                </span>
              )}
            </div>

            {/* 4 Multiple Choice Option Buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                marginBottom: '24px',
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
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      textAlign: 'left',
                      cursor: isLocked ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 0 20px rgba(255, 159, 28, 0.25)' : 'none',
                    }}
                  >
                    {/* Key Shortcut Badge */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: isSelected ? '#ff9f1c' : 'rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#0e1018' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
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
                          fontSize: '12px',
                          color: 'rgba(255, 255, 255, 0.5)',
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

            {/* Live Participants Answered Stream */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                {answeredUsers.length} answered:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {answeredUsers.map((u) => (
                  <span
                    key={u.user_id}
                    title={u.display_name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    @{u.display_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ STAGE 2: POST-ROUND CELEBRATORY OLYMPIC PODIUM ═══════════ */}
        {triviaResult && (
          <div>
            {/* Reveal Banner */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
                  marginBottom: '10px',
                }}
              >
                <Trophy size={14} /> Round {triviaResult.round_number || 1} Complete!
              </span>
              <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 0 0' }}>
                Leaderboard Podium
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
                padding: '12px 16px',
                marginBottom: '28px',
              }}
            >
              {triviaResult.correct_answer?.album_art_url ? (
                <img
                  src={triviaResult.correct_answer.album_art_url}
                  alt={triviaResult.correct_answer.track_name}
                  style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '52px',
                    height: '52px',
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
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#2ec4b6' }}>
                  Correct Answer
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                gap: '12px',
                marginBottom: '28px',
                height: '180px',
              }}
            >
              {/* #2 Silver Podium (Left) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '120px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
                  {top2 ? top2.display_name : '—'}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                  {top2 ? `${top2.total_score} pts` : ''}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: '90px' }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(180deg, #94a3b8 0%, #475569 100%)',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(148, 163, 184, 0.2)',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>🥈</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>#2</span>
                </motion.div>
              </div>

              {/* #1 Gold Podium (Center) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '130px',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#ff9f1c', marginBottom: '4px', textAlign: 'center' }}>
                  {top1 ? top1.display_name : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#ff9f1c', marginBottom: '8px' }}>
                  {top1 ? (
                    <>
                      <span>{top1.total_score} pts</span>
                      {top1.streak > 1 && (
                        <span style={{ background: 'rgba(255,159,28,0.2)', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 800 }}>
                          🔥 x{top1.streak}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: '130px' }}
                  transition={{ duration: 0.6 }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(180deg, #ffb703 0%, #fb8500 100%)',
                    borderRadius: '16px 16px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 32px rgba(255, 183, 3, 0.35)',
                  }}
                >
                  <span style={{ fontSize: '32px' }}>🥇</span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#0e1018' }}>#1</span>
                </motion.div>
              </div>

              {/* #3 Bronze Podium (Right) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '120px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
                  {top3 ? top3.display_name : '—'}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                  {top3 ? `${top3.total_score} pts` : ''}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: '65px' }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(180deg, #cd7f32 0%, #8b4513 100%)',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(205, 127, 50, 0.2)',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🥉</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>#3</span>
                </motion.div>
              </div>
            </div>

            {/* Full Leaderboard Table */}
            {leaderboard.length > 3 && (
              <div
                style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  marginBottom: '24px',
                }}
              >
                {leaderboard.slice(3).map((u) => (
                  <div
                    key={u.user_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700 }}>#{u.rank}</span>
                      <span>@{u.display_name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)' }}>
                      {u.total_score} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Host Controls or Participant Waiting Banner */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
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
                    End Trivia Session
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
                      boxShadow: '0 8px 24px rgba(255, 159, 28, 0.3)',
                    }}
                  >
                    <Play size={16} fill="currentColor" /> Next Round
                  </button>
                </>
              ) : (
                <div style={{ width: '100%', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
                  Waiting for host to start the next round...
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
