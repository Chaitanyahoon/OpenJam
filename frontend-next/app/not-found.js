'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function NotFound() {
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
      {/* Ambient glows */}
      <div className="landing-bg-glows" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '25%', left: '20%', width: '400px', height: '400px', background: 'rgba(255, 159, 28, 0.04)', filter: 'blur(150px)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '25%', right: '20%', width: '400px', height: '400px', background: 'rgba(255, 210, 63, 0.03)', filter: 'blur(150px)', borderRadius: '50%' }}></div>
      </div>

      <motion.div 
        className="glass-card" 
        style={{
          maxWidth: '480px',
          padding: '48px 32px',
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
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Animated Vinyl Disc for 404 page */}
        <motion.div 
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #121114 0%, #1e1d22 25%, #121114 50%, #1e1d22 75%, #121114 100%)',
            border: '4px solid rgba(255, 159, 28, 0.25)',
            boxShadow: '0 0 32px rgba(255, 159, 28, 0.15)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px'
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--amber)',
            boxShadow: '0 0 12px rgba(255, 159, 28, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#08080a'
            }} />
          </div>
        </motion.div>

        <h1 style={{
          fontFamily: 'var(--font-display), sans-serif',
          fontWeight: 900,
          fontSize: '72px',
          margin: 0,
          background: 'linear-gradient(135deg, var(--amber), #ffd23f)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1
        }}>404</h1>
        
        <h2 style={{
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: '20px',
          fontWeight: 600,
          margin: '12px 0 16px',
          color: '#fff'
        }}>Lost in the Noise?</h2>
        
        <p style={{
          color: 'var(--text-3)',
          fontSize: '14px',
          lineHeight: 1.6,
          marginBottom: '32px'
        }}>The page you are looking for doesn't exist or has been moved to another frequency.</p>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Link href="/" className="btn btn-primary" style={{ padding: '12px 36px', textDecoration: 'none' }}>
            Back to Homepage
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
