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

export default function TermsPage() {
  return (
    <div className="policy-page-wrap">
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
          Terms of Service
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
            <p>By accessing or using Open Jam (&quot;the Service&quot;), you agree to be bound by these Terms of Service.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>1. Service Description</h2>
            <p>Open Jam is a social music listening platform that allows users to create rooms, queue tracks, and listen to music together in real-time. Music is streamed via YouTube and resolved using third-party services.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>2. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <li>Use the Service for any illegal purpose</li>
              <li>Harass, abuse, or harm other users through chat or room activity</li>
              <li>Upload or queue content that violates copyright or contains illegal material</li>
              <li>Attempt to disrupt, damage, or gain unauthorized access to the Service</li>
              <li>Use automated tools (bots, scrapers) to interact with the Service</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>3. User Content</h2>
            <p>Messages you send in room chats are visible to other room members. You are responsible for the content you share. We reserve the right to remove content that violates these terms.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>4. Intellectual Property</h2>
            <p>Open Jam&apos;s code is open source under the MIT License. Music content streamed through the Service is owned by its respective copyright holders. We do not host or store any music files.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>5. Third-Party Services</h2>
            <p>The Service relies on YouTube for music playback. YouTube&apos;s Terms of Service apply to all music content. We are not responsible for YouTube&apos;s service availability or content.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>6. Disclaimers</h2>
            <p>The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee uninterrupted access, and the Service may be modified or discontinued at any time.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>7. Limitation of Liability</h2>
            <p>Open Jam and its contributors shall not be liable for any indirect, incidental, or consequential damages arising from use of the Service.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>8. DMCA / Copyright</h2>
            <p>If you believe content on Open Jam infringes your copyright, please contact us with a detailed notice. We will respond promptly to valid claims.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>9. Changes</h2>
            <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>10. Governing Law</h2>
            <p>These terms are governed by applicable laws. Any disputes shall be resolved in the appropriate courts.</p>
          </section>
        </motion.div>
      </motion.div>
    </div>
  );
}
