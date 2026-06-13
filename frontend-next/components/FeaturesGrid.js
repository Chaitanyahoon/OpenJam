'use client';

import React from 'react';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    badge: 'Playback',
    title: 'Synced listening',
    description: 'Hosts control playback while every listener stays on the same timestamp through live room updates.',
    visual: 'sync',
  },
  {
    badge: 'Queue',
    title: 'Shared queue',
    description: 'Anyone in the room can add tracks, vote on what plays next, and see the order update instantly.',
    visual: 'queue',
  },
  {
    badge: 'Social',
    title: 'Room chat',
    description: 'React in real time while the music plays — no tab switching, no separate chat app.',
    visual: 'chat',
  },
  {
    badge: 'Access',
    title: 'Guest or Discord',
    description: 'Drop in with a nickname or sign in with Discord to keep your profile across sessions.',
    visual: 'auth',
  },
];

function FeatureVisual({ type }) {
  if (type === 'sync') {
    return (
      <div className="feature-visual feature-visual-sync" aria-hidden="true">
        <div className="sync-node sync-node-host">Host</div>
        <div className="sync-node sync-node-peer">You</div>
        <div className="sync-node sync-node-peer">Room</div>
        <div className="sync-line sync-line-a" />
        <div className="sync-line sync-line-b" />
      </div>
    );
  }

  if (type === 'queue') {
    return (
      <div className="feature-visual feature-visual-queue" aria-hidden="true">
        <div className="feature-queue-row is-active">
          <span className="feature-queue-dot" />
          <div>
            <strong>Now playing</strong>
            <span>Midnight City — M83</span>
          </div>
        </div>
        <div className="feature-queue-row">
          <span className="feature-queue-vote">+8</span>
          <div>
            <strong>Up next</strong>
            <span>Resonance — Home</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'chat') {
    return (
      <div className="feature-visual feature-visual-chat" aria-hidden="true">
        <div className="feature-chat-bubble is-them">This drop hits different</div>
        <div className="feature-chat-bubble is-you">Queue the next one</div>
        <div className="feature-chat-bubble is-them">Already added</div>
      </div>
    );
  }

  return (
    <div className="feature-visual feature-visual-auth" aria-hidden="true">
      <div className="feature-auth-pill">Guest nickname</div>
      <div className="feature-auth-divider">or</div>
      <div className="feature-auth-pill is-discord">Discord profile</div>
    </div>
  );
}

export default function FeaturesGrid() {
  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div className="bento-container">
      <div className="bento-header">
        <div className="bento-section-badge">Built for listening rooms</div>
        <h3 className="bento-section-title">Everything you need in one session</h3>
        <p className="bento-section-sub">
          OpenJam focuses on the listening experience: shared playback, queue control, chat, and quick entry for guests or Discord users.
        </p>
      </div>

      <div className="bento-grid bento-grid-balanced">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            className={`bento-tile bento-tile-glow ${index === 0 ? 'bento-wide' : ''}`}
            onMouseMove={handleMouseMove}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
          >
            <div className="tile-content">
              <div className="tile-badge">{feature.badge}</div>
              <h4 className="tile-title">{feature.title}</h4>
              <p className="tile-description">{feature.description}</p>
              <FeatureVisual type={feature.visual} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
