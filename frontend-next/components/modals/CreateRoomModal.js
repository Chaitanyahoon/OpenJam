'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 30 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 32 },
  },
  exit: { opacity: 0, scale: 0.94, y: 20, transition: { duration: 0.15, ease: 'easeOut' } },
};

const availableTags = [
  'indie', 'rock', 'pop', 'hip-hop', 'electronic', 'r&b',
  'jazz', 'classical', 'lofi', 'metal', 'latin', 'chill'
];

export default function CreateRoomModal({
  show,
  onClose,
  createName, onCreateNameChange,
  createDesc, onCreateDescChange,
  createMode, onCreateModeChange,
  createPrivate, onCreatePrivateChange,
  createPassword, onCreatePasswordChange,
  allowGuestControls, onAllowGuestControlsChange,
  selectedTags, onToggleTag,
  onSubmit,
  isSubmitting,
  triggerToast,
  prefilledTrack = null,
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="modal-bg open"
          variants={backdropVariants}
          initial="hidden" animate="visible" exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="modal-box"
            variants={modalVariants}
            initial="hidden" animate="visible" exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">⚡ Start a New Jam</h2>
              <button type="button" className="btn btn-ghost modal-close-btn" onClick={onClose}>✕</button>
            </div>
            <form onSubmit={onSubmit}>
              {prefilledTrack && (
                <div className="mp-prefilled-track-highlight">
                  <img decoding="async" loading="lazy" src={prefilledTrack.src} alt="" className="mp-prefilled-art" />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--theme-accent)', letterSpacing: '1.2px', marginBottom: '2px' }}>Starting Track</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>{prefilledTrack.trackName}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>{prefilledTrack.artist}</span>
                  </div>
                </div>
              )}
              <div className="modal-field">
                <label className="modal-label">Room Name *</label>
                <input
                  type="text" className="input-field"
                  value={createName} onChange={(e) => onCreateNameChange(e.target.value)}
                  placeholder="e.g. Late Night Lofi Lounge" maxLength="60" required
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Description</label>
                <input
                  type="text" className="input-field"
                  value={createDesc} onChange={(e) => onCreateDescChange(e.target.value)}
                  placeholder="What kind of vibe are we playing?" maxLength="200"
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Queue Mode</label>
                <select className="input-field" value={createMode} onChange={(e) => onCreateModeChange(e.target.value)}>
                  <option value="open">Open Party (Anyone can add tracks)</option>
                  <option value="curated">DJ Only (Only host can add tracks)</option>
                </select>
              </div>
              <div className="modal-field modal-checkbox-row">
                <input
                  type="checkbox" id="create-private"
                  checked={createPrivate}
                  onChange={(e) => onCreatePrivateChange(e.target.checked)}
                />
                <label htmlFor="create-private" className="modal-label modal-label-checkbox">
                  Private Room (requires password)
                </label>
              </div>

              <AnimatePresence>
                {createPrivate && (
                  <motion.div
                    className="modal-field"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <label className="modal-label">Room Password</label>
                    <input
                      type="password" className="input-field"
                      value={createPassword} onChange={(e) => onCreatePasswordChange(e.target.value)}
                      placeholder="Enter password to join this room" maxLength="32" required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="modal-field modal-checkbox-row">
                <input
                  type="checkbox" id="create-guest-controls"
                  checked={allowGuestControls}
                  onChange={(e) => onAllowGuestControlsChange(e.target.checked)}
                />
                <label htmlFor="create-guest-controls" className="modal-label modal-label-checkbox">
                  Collaborative Playback (listeners can play/pause/skip)
                </label>
              </div>

              <div className="modal-field">
                <label className="modal-label">Genre Tags (Max 3)</label>
                <div className="tag-grid">
                  {availableTags.map((tag) => (
                    <motion.div
                      key={tag}
                      className={`tag ${selectedTags.has(tag) ? 'active' : ''}`}
                      onClick={() => onToggleTag(tag)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      layout
                    >
                      {tag}
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <motion.button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSubmitting ? 'Creating...' : 'Start Jamming'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
