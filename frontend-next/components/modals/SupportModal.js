'use client';

import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Copy, Check, ExternalLink, Smartphone, Sparkles, Zap, ShieldCheck, Heart } from 'lucide-react';
import { trackEvent } from '@/utils/analytics';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 420, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 12,
    transition: { duration: 0.15 },
  },
};

const PRESET_AMOUNTS = [
  { value: 50, emoji: '☕', label: '₹50', name: 'Chai' },
  { value: 100, emoji: '🎧', label: '₹100', name: 'Coffee' },
  { value: 250, emoji: '⚡', label: '₹250', name: 'Fuel' },
  { value: 500, emoji: '🚀', label: '₹500', name: 'Server' },
];

export default function SupportModal({ show, onClose, triggerToast }) {
  const titleId = useId();
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || 'chaitanyapatil700-1@oksbi';
  const payeeName = process.env.NEXT_PUBLIC_UPI_NAME || 'OpenJam';
  const externalSupportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || 'https://www.chaitanyapatil.online/support/';

  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [, setQrLoaded] = useState(false);

  useEffect(() => {
    if (!show) return undefined;

    trackEvent('tip_modal_opened');

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

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    upiUri
  )}&margin=4`;

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
      trackEvent('tip_modal_opened', { action: 'copy_upi', amount: activeAmount });
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
          role="presentation"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001, // Stay above Stage View (9999) and play-unlock-overlay (9990)
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            background: 'rgba(5, 5, 8, 0.82)',
            padding: '16px',
            touchAction: 'none',
          }}
        >
          <motion.div
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
              maxWidth: '420px',
              width: '100%',
              padding: '14px 18px 12px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              background: 'linear-gradient(180deg, #16151f 0%, #0d0c13 100%)',
              border: '1px solid rgba(255, 159, 28, 0.3)',
              borderRadius: '22px',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(255, 159, 28, 0.1)',
              maxHeight: 'min(92vh, 680px)',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 159, 28, 0.25) transparent',
              WebkitOverflowScrolling: 'touch',
              boxSizing: 'border-box',
            }}
          >
            {/* Top ambient radial glow */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                right: '20%',
                height: '80px',
                background: 'radial-gradient(ellipse at top, rgba(255, 159, 28, 0.18), transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Pill Badge & Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 9px',
                  borderRadius: '999px',
                  background: 'rgba(255, 159, 28, 0.12)',
                  border: '1px solid rgba(255, 159, 28, 0.28)',
                  color: 'var(--theme-accent, #ff9f1c)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  minWidth: 0,
                }}
              >
                <Sparkles size={10} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  100% Ad-Free • Community Funded
                </span>
              </div>

              <motion.button
                type="button"
                onClick={onClose}
                aria-label="Close support dialog"
                style={{
                  fontSize: '14px',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-3)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
                whileHover={{ rotate: 90, scale: 1.1, color: '#ffffff' }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </div>

            {/* Header Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <motion.div
                whileHover={{ scale: 1.06, rotate: 5 }}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(255, 159, 28, 0.25) 0%, rgba(255, 120, 0, 0.1) 100%)',
                  border: '1.5px solid rgba(255, 159, 28, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--theme-accent, #ff9f1c)',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(255, 159, 28, 0.2)',
                }}
              >
                <Coffee size={17} />
              </motion.div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 id={titleId} style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.3px', margin: 0, color: '#ffffff', lineHeight: 1.2 }}>
                  Fuel OpenJam
                </h2>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '2px 0 0 0', lineHeight: 1.3 }}>
                  Keep real-time sync, Redis memory, and 24/7 queues alive
                </p>
              </div>
            </div>

            {/* Impact Feature Tags */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                marginBottom: '8px',
                padding: '5px 8px',
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <Zap size={10} style={{ color: '#ff9f1c', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Sub-50ms Sync</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <ShieldCheck size={10} style={{ color: '#10b981', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Zero Ads</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <Heart size={10} style={{ color: '#f43f5e', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Direct to Server</span>
              </div>
            </div>

            {/* Amount Selection */}
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--text-3)',
                  marginBottom: '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Choose Your Tip</span>
                <span style={{ color: 'var(--theme-accent, #ff9f1c)', fontSize: '10.5px', fontWeight: 700 }}>
                  {activeAmount > 0 ? `Selected: ₹${activeAmount}` : 'Any Amount'}
                </span>
              </div>

              {/* Preset Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '6px' }}>
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
                        padding: '5px 2px 4px',
                        borderRadius: '10px',
                        border: isSelected
                          ? '2px solid var(--theme-accent, #ff9f1c)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isSelected
                          ? 'linear-gradient(180deg, rgba(255, 159, 28, 0.22) 0%, rgba(255, 159, 28, 0.08) 100%)'
                          : 'rgba(255, 255, 255, 0.035)',
                        color: isSelected ? '#ffffff' : 'var(--text-2)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        boxShadow: isSelected ? '0 0 14px rgba(255, 159, 28, 0.25)' : 'none',
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: '13px', lineHeight: 1 }}>{item.emoji}</div>
                      <div style={{ fontSize: '11.5px', fontWeight: 800, color: isSelected ? '#ff9f1c' : '#ffffff', marginTop: '2px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 600, color: isSelected ? '#ffffff' : 'var(--text-3)', marginTop: '1px' }}>
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
                  borderRadius: '10px',
                  padding: '2px 8px',
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--theme-accent, #ff9f1c)', marginRight: '5px' }}>
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
                    minWidth: 0,
                    fontSize: '11.5px',
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 0',
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
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* QR Card with High-Contrast Instant Scan */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(20, 20, 28, 0.6) 0%, rgba(10, 10, 15, 0.8) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '8px 10px',
                marginBottom: '8px',
              }}
            >
              {/* Accepted UPI Apps Strip */}
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--text-3)',
                  marginBottom: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
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
                  padding: '6px',
                  borderRadius: '10px',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 14px rgba(255, 159, 28, 0.15)',
                  marginBottom: '6px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={upiUri}
                  src={qrImageUrl}
                  alt={`UPI QR code to tip ₹${activeAmount || 100} to OpenJam`}
                  width={110}
                  height={110}
                  onLoad={() => setQrLoaded(true)}
                  style={{
                    display: 'block',
                    borderRadius: '4px',
                    width: '110px',
                    height: '110px',
                  }}
                />
              </div>

              {/* Dynamic Amount Label */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  color: 'var(--theme-accent, #ff9f1c)',
                  background: 'rgba(255, 159, 28, 0.1)',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 159, 28, 0.25)',
                }}
              >
                <span>Paying:</span>
                <span style={{ color: '#ffffff' }}>₹{activeAmount > 0 ? activeAmount : 'Any Amount'}</span>
              </div>
            </div>

            {/* UPI ID Monospace Row (Collision-Free) */}
            <div style={{ marginBottom: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.09)',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  minWidth: 0,
                }}
              >
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 800, letterSpacing: '0.6px' }}>
                    Direct UPI VPA
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      letterSpacing: '0.2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={upiId}
                  >
                    {upiId}
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={handleCopyUPI}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    borderRadius: '7px',
                    cursor: 'pointer',
                    background: copied ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 159, 28, 0.15)',
                    border: copied ? '1px solid #22c55e' : '1px solid rgba(255, 159, 28, 0.35)',
                    color: copied ? '#4ade80' : 'var(--theme-accent, #ff9f1c)',
                    flexShrink: 0,
                  }}
                >
                  {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </motion.button>
              </div>
            </div>

            {/* Mobile UPI Direct App Intent */}
            <motion.a
              href={upiUri}
              onClick={() => trackEvent('tip_modal_opened', { action: 'pay_upi_intent', amount: activeAmount })}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 12px',
                fontSize: '12.5px',
                fontWeight: 800,
                borderRadius: '10px',
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #ff9f1c 0%, #f77f00 100%)',
                boxShadow: '0 4px 14px rgba(255, 159, 28, 0.3)',
                marginBottom: '8px',
                color: '#000000',
                boxSizing: 'border-box',
              }}
            >
              <Smartphone size={14} />
              <span>Pay {activeAmount > 0 ? `₹${activeAmount}` : ''} via UPI App</span>
            </motion.a>

            {/* International & Web Fallback */}
            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
              <a
                href={externalSupportUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '10.5px',
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
                <span>Outside India? Card or Web support</span>
                <ExternalLink size={10} />
              </a>
              <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '2px', opacity: 0.65 }}>
                100% of contributions pay monthly streaming servers. Thank you! ❤️
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
