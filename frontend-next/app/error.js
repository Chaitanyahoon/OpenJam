'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

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
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: '400px', height: '400px', background: 'rgba(244, 63, 94, 0.04)', filter: 'blur(120px)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: '400px', height: '400px', background: 'rgba(255, 159, 28, 0.03)', filter: 'blur(120px)', borderRadius: '50%' }}></div>
      </div>

      <motion.div 
        className="glass-card"
        style={{
          maxWidth: '480px',
          padding: '40px 30px',
          borderRadius: '32px',
          border: '1px solid rgba(244, 63, 94, 0.2)',
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
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>

        <h2 style={{
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: '24px',
          fontWeight: 700,
          margin: '0 0 12px',
          background: 'linear-gradient(135deg, var(--red, #f43f5e), var(--amber, #ff9f1c))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Something went wrong
        </h2>

        <p style={{
          color: 'var(--text-3, #64748b)',
          fontSize: '14px',
          lineHeight: 1.6,
          marginBottom: error?.message ? '16px' : '32px'
        }}>
          An unexpected error occurred. We have logged the details and are working to stabilize the system.
        </p>

        {error?.message && (
          <code style={{
            fontSize: '12px',
            color: '#f43f5e',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            padding: '8px 14px',
            borderRadius: '8px',
            marginBottom: '28px',
            maxWidth: '100%',
            wordBreak: 'break-word',
            display: 'inline-block'
          }}>
            {error.message}
          </code>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.button 
            onClick={reset} 
            className="btn btn-primary"
            style={{ padding: '12px 28px', border: 'none', cursor: 'pointer' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Try again
          </motion.button>

          <motion.button 
            onClick={() => { window.location.href = '/'; }} 
            className="btn btn-secondary"
            style={{ 
              padding: '12px 24px', 
              background: 'rgba(255, 255, 255, 0.08)', 
              color: '#fff', 
              border: '1px solid rgba(255, 255, 255, 0.15)', 
              borderRadius: '9999px',
              cursor: 'pointer',
              fontWeight: 600
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Back to Home
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
