'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const FlowingMenu = dynamic(() => import('./reactbits/FlowingMenu'), { ssr: false });

const GENRE_FALLBACKS = [
  { text: 'Lo-Fi', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=400&fit=crop' },
  { text: 'Synthwave', image: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=600&h=400&fit=crop' },
  { text: 'Techno', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop' },
  { text: 'Indie', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop' },
  { text: 'Jazz', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&h=400&fit=crop' },
  { text: 'Ambient', image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=400&fit=crop' },
];

const GENRE_IMAGES = {
  lofi: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=400&fit=crop',
  chill: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&h=400&fit=crop',
  synthwave: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=600&h=400&fit=crop',
  techno: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop',
  indie: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop',
  jazz: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&h=400&fit=crop',
  ambient: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=400&fit=crop',
  rock: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=600&h=400&fit=crop',
  hiphop: 'https://images.unsplash.com/photo-1571974599782-87624638275a?w=600&h=400&fit=crop',
};

function imageForGenre(genre) {
  const key = genre.toLowerCase().replace(/[^a-z0-9]/g, '');
  return GENRE_IMAGES[key] || GENRE_FALLBACKS[Math.abs(genre.length) % GENRE_FALLBACKS.length].image;
}

export default function GenreExplorer({ genres = [], activeGenre = null, onGenreSelect }) {
  const menuItems = useMemo(() => {
    const source = genres.length > 0 ? genres.slice(0, 8) : GENRE_FALLBACKS.map((item) => item.text);
    return source.map((genre) => ({
      text: genre,
      image: imageForGenre(genre),
      onClick: () => {
        onGenreSelect?.(activeGenre === genre ? null : genre);
        document.getElementById('active-rooms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));
  }, [genres, activeGenre, onGenreSelect]);

  return (
    <motion.section
      className="genre-explorer-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="genre-explorer-header">
        <motion.div
          className="genre-explorer-badge"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
        >
          <span className="genre-explorer-badge-dot" aria-hidden="true" />
          Browse by genre
        </motion.div>
        <h2 className="genre-explorer-title">
          Find your <span>vibe</span>
        </h2>
        <p className="genre-explorer-sub">
          Select a genre to filter the room list below. Hover to preview, click to jump straight to matching rooms.
        </p>
        {activeGenre && (
          <button
            type="button"
            className="genre-explorer-clear"
            onClick={() => onGenreSelect?.(null)}
          >
            Showing {activeGenre} — clear filter
          </button>
        )}
      </div>

      <div className="genre-explorer-menu-wrap">
        <FlowingMenu
          items={menuItems}
          speed={12}
          textColor="rgba(255, 255, 255, 0.85)"
          bgColor="transparent"
          marqueeBgColor="var(--amber)"
          marqueeTextColor="#08080a"
          borderColor="rgba(255, 255, 255, 0.06)"
        />
      </div>
    </motion.section>
  );
}
