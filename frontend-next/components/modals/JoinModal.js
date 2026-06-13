'use client';

import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 20,
    transition: { duration: 0.2 },
  },
};

export default function JoinModal({
  show,
  onClose,
  guestName,
  onGuestNameChange,
  onRoll,
  isShuffling,
  onSubmit,
  isSubmitting,
  onDiscordLogin,
}) {
  const titleId = useId();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!show) return undefined;

    const previousFocus = document.activeElement;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="modal-bg open"
          role="presentation"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" id={titleId}>Join OpenJam</h2>
              <button
                type="button"
                className="btn btn-ghost modal-close-btn"
                onClick={onClose}
                aria-label="Close join dialog"
              >
                ✕
              </button>
            </div>

            <motion.button
              type="button"
              className="btn btn-discord"
              style={{ width: '100%', marginBottom: '18px' }}
              onClick={onDiscordLogin}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }} aria-hidden="true">
                <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.1v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1 58.7 58.7 0 0018-9.1v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1-.1zM23.7 37c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7z" />
              </svg>
              Sign in with Discord
            </motion.button>

            <div className="join-divider" style={{ marginBottom: '18px' }}>
              <span>or continue as guest</span>
            </div>

            <p className="modal-text-muted" style={{ marginBottom: '14px' }}>
              Pick a nickname to represent you, or roll a random one.
            </p>

            <form onSubmit={onSubmit}>
              <div className="modal-field name-shuffler-field" style={{ marginBottom: '20px' }}>
                <label className="sr-only" htmlFor="guest-display-name">Display name</label>
                <input
                  ref={inputRef}
                  id="guest-display-name"
                  type="text"
                  className="input-field"
                  value={guestName}
                  onChange={(e) => onGuestNameChange(e.target.value)}
                  placeholder="e.g. DJSpin, BassHead"
                  maxLength="30"
                  autoComplete="nickname"
                  required
                />
                <motion.button
                  type="button"
                  className="btn btn-secondary btn-shuffler"
                  onClick={onRoll}
                  disabled={isShuffling}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                  aria-label="Generate random nickname"
                >
                  {isShuffling ? 'Rolling…' : 'Roll name'}
                </motion.button>
              </div>
              <div className="modal-actions-grid">
                <motion.button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSubmitting ? 'Joining…' : 'Enter jam'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
