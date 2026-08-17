'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    q: "Is OpenJam completely free to use?",
    a: "Yes! OpenJam is 100% free with zero monthly subscription fees, paywalls, or hidden charges."
  },
  {
    q: "Can I use OpenJam as a free Watch2Gether or Spotify Jam alternative?",
    a: "Yes! OpenJam is the ideal free alternative to Watch2Gether, JQBX, and Spotify Jam. Unlike Spotify Jam which requires Spotify Premium subscriptions for all participants, OpenJam allows anyone to stream and sync YouTube music together for free with no subscriptions required."
  },
  {
    q: "Do I need a Spotify or YouTube account to listen?",
    a: "No! You can join any room as an anonymous guest or host your own session without logging into third-party accounts."
  },
  {
    q: "How does real-time music synchronization work?",
    a: "OpenJam uses NTP-style clock offset calculation over WebSockets to measure network round-trip time. It continuously adjusts playback positions so all listeners in a room hear the exact same audio beat at the same millisecond."
  },
  {
    q: "What is Stage Mode with synchronized karaoke lyrics?",
    a: "Stage Mode provides a full-screen, ambient visualizer featuring dynamic album artwork glow and real-time kinetic karaoke lyrics synchronized to the exact millisecond of playback."
  },
  {
    q: "Can I import playlists from Spotify or YouTube into OpenJam?",
    a: "Yes! OpenJam supports instant playlist importing from public Spotify and YouTube URLs, automatically loading all tracks directly into your live room queue or personal playlist."
  },
  {
    q: "How many friends can join a single jam room?",
    a: "There is no strict limit! Dozens of listeners can join a single room simultaneously, chat, send floating emoji reactions, and vote on track skips."
  },
  {
    q: "Can I use OpenJam on my mobile phone?",
    a: "Absolutely. OpenJam features a responsive mobile interface with bottom tabs, touch controls, and Progressive Web App (PWA) support so you can install it on iOS and Android."
  }
];

function FaqSection() {
  const [openIdx, setOpenIdx] = useState(null);

  const toggleFaq = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="faq-section" style={{
      maxWidth: '800px',
      margin: '64px auto',
      padding: '0 24px',
      fontFamily: 'var(--font-ui-next), sans-serif'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '20px',
          background: 'rgba(255, 159, 28, 0.1)',
          border: '1px solid rgba(255, 159, 28, 0.2)',
          color: 'var(--amber, #ff9f1c)',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px'
        }}>
          <HelpCircle size={15} /> FAQ
        </div>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 800,
          color: '#fff',
          fontFamily: 'var(--font-display-next), sans-serif',
          margin: '0 0 8px 0'
        }}>
          Frequently Asked Questions
        </h2>
        <p style={{ color: 'var(--text-3, #a1a1aa)', fontSize: '15px', margin: 0 }}>
          Everything you need to know about OpenJam real-time listening.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FAQS.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              style={{
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                overflow: 'hidden',
                transition: 'border-color 0.2s ease'
              }}
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                style={{
                  width: '100%',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  gap: '16px'
                }}
              >
                <span>{faq.q}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--amber, #ff9f1c)', flexShrink: 0 }}
                >
                  <ChevronDown size={20} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <div style={{
                      padding: '0 24px 20px 24px',
                      color: 'var(--text-3, #a1a1aa)',
                      fontSize: '14.5px',
                      lineHeight: 1.6,
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      paddingTop: '16px'
                    }}>
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default React.memo(FaqSection);
