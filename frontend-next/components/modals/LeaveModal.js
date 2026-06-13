'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 40 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 30 },
  },
  exit: { opacity: 0, scale: 0.92, y: 30, transition: { duration: 0.2 } },
};

export default function LeaveModal({ show, onClose, onConfirm }) {
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
            style={{ textAlign: 'center', maxWidth: '420px' }}
          >
            <motion.div
              style={{ fontSize: '48px', marginBottom: '16px', display: 'inline-block', transformOrigin: '70% 70%' }}
              initial={{ scale: 0 }}
              animate={{
                scale: [0, 1.2, 1],
                rotate: [0, -15, 15, -15, 15, 0],
              }}
              transition={{
                duration: 1.2,
                ease: 'easeInOut',
                times: [0, 0.2, 0.4, 0.6, 0.8, 1],
                delay: 0.15,
              }}
            >
              👋
            </motion.div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Leave Session?
            </div>
            <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
              You will be seamlessly removed from any active rooms. Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <motion.button
                className="btn btn-secondary btn-bubble btn-guest-bubble"
                onClick={onClose}
                whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px', minWidth: '100px' }}
              >
                <div className="bubble-bg b1" />
                <div className="bubble-bg b2" />
                <div className="bubble-bg b3" />
                <div className="bubble-bg b4" />
                <span className="btn-bubble-content">Stay</span>
              </motion.button>
              <motion.button
                className="btn btn-danger btn-bubble btn-danger-bubble"
                onClick={onConfirm}
                whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)' }}
                whileTap={{ scale: 0.98 }}
                style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px', minWidth: '100px' }}
              >
                <div className="bubble-bg b1" />
                <div className="bubble-bg b2" />
                <div className="bubble-bg b3" />
                <div className="bubble-bg b4" />
                <span className="btn-bubble-content" style={{ color: 'var(--red)' }}>Yes, Leave</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
