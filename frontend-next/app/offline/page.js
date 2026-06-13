'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      margin: 0,
      background: '#08080a',
      color: '#fff',
      fontFamily: 'var(--font-ui), sans-serif',
      textAlign: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient glows */}
      <div className="landing-bg-glows" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: '300px', height: '300px', background: 'rgba(255, 159, 28, 0.04)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: '300px', height: '300px', background: 'rgba(255, 85, 0, 0.03)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
      </div>

      <motion.div 
        className="glass-card"
        style={{
          maxWidth: '480px',
          padding: '40px 30px',
          borderRadius: '32px',
          border: '1px solid rgba(255, 159, 28, 0.15)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          style={{ fontSize: '64px', marginBottom: '20px' }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          📡
        </motion.div>

        <h2 style={{
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: '24px',
          fontWeight: 700,
          margin: '0 0 12px',
          background: 'linear-gradient(135deg, var(--amber), #ff5500)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Connection Dropped
        </h2>

        <p style={{
          color: 'var(--text-3)',
          fontSize: '14px',
          lineHeight: 1.6,
          marginBottom: '32px'
        }}>
          It seems you&apos;re currently offline. Please check your internet connection and try reconnecting.
        </p>

        <motion.button 
          onClick={handleRetry} 
          className="btn btn-primary"
          style={{ padding: '12px 36px', border: 'none', cursor: 'pointer' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Retry Connection
        </motion.button>
      </motion.div>
    </div>
  );
}
