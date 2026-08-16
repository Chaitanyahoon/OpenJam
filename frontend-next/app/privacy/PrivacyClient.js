'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
};

export default function PrivacyPage() {
  return (
    <main className="policy-page-wrap">
      {/* Background ambient glows */}
      <div className="landing-bg-glows" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: '500px', height: '500px', background: 'rgba(255, 159, 28, 0.03)', filter: 'blur(160px)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '500px', height: '500px', background: 'rgba(255, 210, 63, 0.02)', filter: 'blur(160px)', borderRadius: '50%' }}></div>
      </div>

      <motion.div 
        className="policy-card"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Link href="/" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-3)',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '32px',
            transition: 'color 0.2s'
          }}
          className="hover-white"
          >
            ← Back to Open Jam
          </Link>
        </motion.div>

        <motion.h1 
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: '36px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            marginBottom: '8px'
          }}
          variants={itemVariants}
        >
          Privacy Policy
        </motion.h1>

        <motion.p 
          style={{
            fontSize: '13px',
            color: 'var(--text-3)',
            marginBottom: '40px'
          }}
          variants={itemVariants}
        >
          Last updated: June 2026
        </motion.p>

        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '28px', lineHeight: 1.75 }} variants={itemVariants}>
          <section>
            <p>Open Jam (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website at https://www.openjam.fun. This Privacy Policy explains how we collect, use, and share information when you use our service.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>1. Information We Collect</h2>
            <p>We collect minimal information to provide our service:</p>
            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <li><strong>Display name:</strong> A name you choose when joining (not verified or linked to real identity).</li>
              <li><strong>Session data:</strong> A temporary session cookie to identify you during your visit.</li>
              <li><strong>Usage data:</strong> Anonymous analytics via Google Analytics (pages visited, time spent).</li>
              <li><strong>Chat messages:</strong> Messages you send in room chats are stored temporarily and deleted when the room closes.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>2. How We Use Information</h2>
            <p>We use collected information solely to:</p>
            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <li>Enable real-time music listening rooms</li>
              <li>Display your chosen name to other room members</li>
              <li>Maintain chat history during active sessions</li>
              <li>Improve our service through anonymous analytics</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>3. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <li><strong>Google Analytics:</strong> For anonymous usage analytics. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Google Privacy Policy</a></li>
              <li><strong>YouTube:</strong> For music playback. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Google Privacy Policy</a></li>
              <li><strong>Render:</strong> For hosting. <a href="https://render.com/legal/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Render Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>4. Data Retention</h2>
            <p>Room data (chat messages, queue items) is deleted when a room is closed. Session data expires after 7 days. Analytics data is retained per Google&apos;s policies.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>5. Your Rights</h2>
            <p>Since we do not require accounts or collect personal information, there is no personal data to access, modify, or delete. You may clear your browser cookies at any time to remove your session.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>6. Children&apos;s Privacy</h2>
            <p>Our service is not directed to children under 13. We do not knowingly collect information from children.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>7. Changes</h2>
            <p>We may update this policy. Changes will be posted on this page with an updated date.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>8. Contact</h2>
            <p>For questions about this policy, contact us at the email listed on our homepage.</p>
          </section>
        </motion.div>
      </motion.div>
    </main>
  );
}
