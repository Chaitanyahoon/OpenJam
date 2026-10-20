'use client';

import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Copy, Check, ExternalLink, Smartphone } from 'lucide-react';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 16,
    transition: { duration: 0.18 },
  },
};

const PRESET_AMOUNTS = [
  { value: 50, label: '₹50', desc: 'Chai' },
  { value: 100, label: '₹100', desc: 'Coffee' },
  { value: 250, label: '₹250', desc: 'Sync Fuel' },
  { value: 500, label: '₹500', desc: 'Server Node' },
];

export default function SupportModal({ show, onClose, triggerToast }) {
  const titleId = useId();
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || 'chaitanyapatil700-1@oksbi';
  const payeeName = process.env.NEXT_PUBLIC_UPI_NAME || 'OpenJam';
  const externalSupportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || 'https://www.chaitanyapatil.online/support/';

  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [copied, setCopied] = useState(false);

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
          style={{ zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
              maxWidth: '430px',
              width: '92%',
              padding: '22px',
              background: '#121218',
              border: '1px solid rgba(255, 159, 28, 0.28)',
              borderRadius: '24px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(255, 159, 28, 0.08)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ marginBottom: '14px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: 'rgba(255, 159, 28, 0.15)',
                    border: '1px solid rgba(255, 159, 28, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--theme-accent, #ff9f1c)',
                    flexShrink: 0,
                  }}
                >
                  <Coffee size={20} />
                </div>
                <div>
                  <h2 className="modal-title" id={titleId} style={{ fontSize: '18px', fontWeight: 800 }}>
                    Support OpenJam
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                    Keep audio sync servers & real-time queues ad-free
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost modal-close-btn"
                onClick={onClose}
                aria-label="Close support dialog"
                style={{ fontSize: '16px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Subtext */}
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-2)',
                lineHeight: 1.5,
                margin: '0 0 16px 0',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              100% of contributions fund high-availability audio stream servers, sub-50ms WebSocket compute, and zero-ad listening.
            </p>

            {/* Amount Selector */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--text-3)',
                  marginBottom: '8px',
                }}
              >
                Select Amount
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                {PRESET_AMOUNTS.map((item) => {
                  const isSelected = !customAmount && selectedAmount === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setCustomAmount('');
                        setSelectedAmount(item.value);
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '12px',
                        border: isSelected
                          ? '1.5px solid var(--theme-accent, #ff9f1c)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isSelected ? 'rgba(255, 159, 28, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                        color: isSelected ? 'var(--theme-accent, #ff9f1c)' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 800 }}>{item.label}</div>
                      <div style={{ fontSize: '9.5px', color: isSelected ? '#ff9f1c' : 'var(--text-3)', marginTop: '2px' }}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom amount row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  placeholder="Other amount (₹)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: customAmount ? '1px solid var(--theme-accent, #ff9f1c)' : '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* QR Card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '16px 12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  padding: '10px',
                  borderRadius: '14px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(255, 159, 28, 0.15)',
                  marginBottom: '10px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt={`UPI QR code to tip ${activeAmount ? `₹${activeAmount}` : ''} to OpenJam`}
                  width={180}
                  height={180}
                  style={{ display: 'block', borderRadius: '4px' }}
                />
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-2)' }}>
                Scan with GPay, PhonePe, Paytm, or BHIM
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                Instant zero-fee transfer to OpenJam
              </div>
            </div>

            {/* UPI ID & Copy action */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.5px' }}>
                    UPI VPA
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
                    {upiId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUPI}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy ID'}</span>
                </button>
              </div>
            </div>

            {/* Mobile UPI App Direct Intent */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <a
                href={upiUri}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '12px',
                  textDecoration: 'none',
                }}
              >
                <Smartphone size={15} />
                <span>Pay via UPI App</span>
              </a>
            </div>

            {/* International fallback */}
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
                <span>Outside India? Support or send feedback via web</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
