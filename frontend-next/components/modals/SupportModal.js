'use client';

import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Copy, Check, ExternalLink, Smartphone, Sparkles, Zap, ShieldCheck, Heart } from 'lucide-react';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 22 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 18,
    transition: { duration: 0.16 },
  },
};

const PRESET_AMOUNTS = [
  { value: 50, emoji: '☕', label: '₹50', name: 'Chai' },
  { value: 100, emoji: '🎧', label: '₹100', name: 'Coffee' },
  { value: 250, emoji: '⚡', label: '₹250', name: 'Sync Fuel' },
  { value: 500, emoji: '🚀', label: '₹500', name: 'Server Core' },
];

export default function SupportModal({ show, onClose, triggerToast }) {
  const titleId = useId();
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || 'chaitanyapatil700-1@oksbi';
  const payeeName = process.env.NEXT_PUBLIC_UPI_NAME || 'OpenJam';
  const externalSupportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || 'https://www.chaitanyapatil.online/support/';

  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);

  useEffect(() => {
    if (!show) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  // Build standard UPI URL
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&cu=INR${
    activeAmount > 0 ? `&am=${activeAmount}` : ''
  }&tn=${encodeURIComponent('Support OpenJam Real-time Audio')}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    upiUri
  )}&margin=6`;

  const handleCopyUPI = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(upiId);
      } else {
        const input = document.createElement('input');
        input.value = upiId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      if (triggerToast) {
        triggerToast('UPI ID copied to clipboard!', 'success');
      }
      setTimeout(() => setCopied(false), 2400);
    } catch {
      if (triggerToast) {
        triggerToast('Could not copy UPI ID automatically', 'error');
      }
    }
  };

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
          style={{
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(16px)',
            background: 'rgba(5, 5, 8, 0.78)',
          }}
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
            style={{
              position: 'relative',
              maxWidth: '440px',
              width: '92%',
              padding: '24px 22px 20px',
              background: 'linear-gradient(180deg, #16151f 0%, #0d0c13 100%)',
              border: '1px solid rgba(255, 159, 28, 0.28)',
              borderRadius: '26px',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 159, 28, 0.08)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {/* Top ambient radial glow */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                right: '20%',
                height: '120px',
                background: 'radial-gradient(ellipse at top, rgba(255, 159, 28, 0.16), transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Pill Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  background: 'rgba(255, 159, 28, 0.12)',
                  border: '1px solid rgba(255, 159, 28, 0.28)',
                  color: 'var(--theme-accent, #ff9f1c)',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={11} />
                <span>100% Ad-Free • Community Funded</span>
              </div>

              <motion.button
                type="button"
                className="btn btn-ghost modal-close-btn"
                onClick={onClose}
                aria-label="Close support dialog"
                style={{
                  fontSize: '15px',
                  padding: '4px 8px',
                  color: 'var(--text-3)',
                  borderRadius: '50%',
                }}
                whileHover={{ rotate: 90, scale: 1.15, color: '#ffffff' }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </div>

            {/* Header Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <motion.div
                whileHover={{ scale: 1.08, rotate: 6 }}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(255, 159, 28, 0.22) 0%, rgba(255, 120, 0, 0.1) 100%)',
                  border: '1.5px solid rgba(255, 159, 28, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--theme-accent, #ff9f1c)',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(255, 159, 28, 0.2)',
                }}
              >
                <Coffee size={22} />
              </motion.div>
              <div>
                <h2 className="modal-title" id={titleId} style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.3px', margin: 0 }}>
                  Fuel OpenJam
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                  Keep real-time sync, Redis memory, and 24/7 queues alive
                </p>
              </div>
            </div>

            {/* Impact Feature Tags */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                marginBottom: '16px',
                padding: '10px 8px',
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                <Zap size={12} style={{ color: '#ff9f1c' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-2)' }}>Sub-50ms Sync</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                <ShieldCheck size={12} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-2)' }}>Zero Ads Ever</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                <Heart size={12} style={{ color: '#f43f5e' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-2)' }}>Direct to Server</span>
              </div>
            </div>

            {/* Amount Selection */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--text-3)',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Choose Your Tip</span>
                <span style={{ color: 'var(--theme-accent, #ff9f1c)', fontSize: '11px' }}>
                  {activeAmount > 0 ? `Selected: ₹${activeAmount}` : 'Any Amount'}
                </span>
              </div>

              {/* Preset Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                {PRESET_AMOUNTS.map((item) => {
                  const isSelected = !customAmount && selectedAmount === item.value;
                  return (
                    <motion.button
                      key={item.value}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setCustomAmount('');
                        setSelectedAmount(item.value);
                      }}
                      style={{
                        padding: '10px 4px 8px',
                        borderRadius: '14px',
                        border: isSelected
                          ? '2px solid var(--theme-accent, #ff9f1c)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isSelected
                          ? 'linear-gradient(180deg, rgba(255, 159, 28, 0.22) 0%, rgba(255, 159, 28, 0.08) 100%)'
                          : 'rgba(255, 255, 255, 0.035)',
                        color: isSelected ? '#ffffff' : 'var(--text-2)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        boxShadow: isSelected ? '0 0 16px rgba(255, 159, 28, 0.25)' : 'none',
                        transition: 'border 0.15s ease, background 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '16px', marginBottom: '2px' }}>{item.emoji}</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#ff9f1c' : '#ffffff' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 600, color: isSelected ? '#ffffff' : 'var(--text-3)', marginTop: '2px' }}>
                        {item.name}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Custom Amount Field */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: customAmount ? '1.5px solid var(--theme-accent, #ff9f1c)' : '1px solid rgba(255, 255, 255, 0.09)',
                  borderRadius: '12px',
                  padding: '2px 10px',
                  transition: 'border 0.15s ease',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--theme-accent, #ff9f1c)', marginRight: '6px' }}>
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  placeholder="Custom amount (e.g. 150, 300, 1000)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 0',
                    color: '#ffffff',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                {customAmount && (
                  <button
                    type="button"
                    onClick={() => setCustomAmount('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-3)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* QR Card with Instant Scan Container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(20, 20, 28, 0.6) 0%, rgba(10, 10, 15, 0.8) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '16px 14px',
                marginBottom: '16px',
                position: 'relative',
              }}
            >
              {/* Accepted UPI Apps Strip */}
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--text-3)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Scan with</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>GPay</span>
                <span>•</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>PhonePe</span>
                <span>•</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>Paytm</span>
                <span>•</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>BHIM</span>
              </div>

              {/* White High-Contrast QR Code Card */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '16px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 159, 28, 0.18)',
                  marginBottom: '10px',
                  position: 'relative',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={upiUri}
                  src={qrImageUrl}
                  alt={`UPI QR code to tip ₹${activeAmount || 100} to OpenJam`}
                  width={180}
                  height={180}
                  onLoad={() => setQrLoaded(true)}
                  style={{
                    display: 'block',
                    borderRadius: '6px',
                    transition: 'opacity 0.2s ease',
                  }}
                />
              </div>

              {/* Dynamic Amount Label */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--theme-accent, #ff9f1c)',
                  background: 'rgba(255, 159, 28, 0.1)',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 159, 28, 0.25)',
                }}
              >
                <span>Paying:</span>
                <span style={{ color: '#ffffff' }}>₹{activeAmount > 0 ? activeAmount : 'Any Amount'}</span>
              </div>
            </div>

            {/* UPI ID Monospace Row */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '14px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 800, letterSpacing: '0.6px' }}>
                    Direct UPI VPA
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', letterSpacing: '0.2px' }}>
                    {upiId}
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={handleCopyUPI}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: copied ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 159, 28, 0.15)',
                    border: copied ? '1px solid #22c55e' : '1px solid rgba(255, 159, 28, 0.35)',
                    color: copied ? '#4ade80' : 'var(--theme-accent, #ff9f1c)',
                  }}
                >
                  {copied ? <Check size={14} style={{ color: '#4ade80' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy ID'}</span>
                </motion.button>
              </div>
            </div>

            {/* Mobile UPI Direct App Intent */}
            <motion.a
              href={upiUri}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '14px',
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #ff9f1c 0%, #f77f00 100%)',
                boxShadow: '0 6px 20px rgba(255, 159, 28, 0.35)',
                marginBottom: '14px',
                color: '#000000',
              }}
            >
              <Smartphone size={16} />
              <span>Pay {activeAmount > 0 ? `₹${activeAmount}` : ''} via UPI App</span>
            </motion.a>

            {/* International & web fallback */}
            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
              <a
                href={externalSupportUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  color: 'var(--text-3)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--theme-accent, #ff9f1c)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                <span>Outside India? Support via web or card</span>
                <ExternalLink size={11} />
              </a>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', opacity: 0.65 }}>
                100% of contributions directly pay monthly server bills. Thank you! ❤️
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
