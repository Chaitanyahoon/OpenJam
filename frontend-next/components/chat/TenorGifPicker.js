'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

const CATEGORIES = [
  { id: 'trending', label: 'Trending', icon: '🔥', query: '' },
  { id: 'dance', label: 'Dance', icon: '💃', query: 'dance' },
  { id: 'vibe', label: 'Vibe', icon: '🎧', query: 'music vibe' },
  { id: 'party', label: 'Party', icon: '🎉', query: 'party' },
  { id: 'hyped', label: 'Hyped', icon: '🚀', query: 'hyped' },
  { id: 'laugh', label: 'Laugh', icon: '😂', query: 'laugh' },
  { id: 'cat', label: 'Cat', icon: '🐱', query: 'cat music' },
  { id: 'sad', label: 'Sad', icon: '🥺', query: 'sad' },
];

/**
 * Tenor GIF Picker Component
 * 
 * @param {function} onSelectGif - Callback invoked with selected GIF URL: (gifUrl, gifData) => void
 * @param {function} onClose - Callback invoked when the picker is closed: () => void
 * @param {boolean} isModal - If true, renders as centered backdrop modal; if false, renders as anchored popover
 * @param {object} style - Additional styling overrides
 */
export default function TenorGifPicker({
  onSelectGif,
  onClose,
  isModal = true,
  style = {}
}) {
  const [activeCategory, setActiveCategory] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredGifId, setHoveredGifId] = useState(null);

  const searchInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch GIFs from Next.js /api/tenor route
  const fetchGifs = useCallback(async (query, categoryId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      let url = '/api/tenor?limit=24';
      if (query) {
        url += `&type=search&q=${encodeURIComponent(query)}`;
      } else if (categoryId && categoryId !== 'trending') {
        const cat = CATEGORIES.find(c => c.id === categoryId);
        if (cat?.query) {
          url += `&type=search&q=${encodeURIComponent(cat.query)}`;
        } else {
          url += '&type=trending';
        }
      } else {
        url += '&type=trending';
      }

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Failed to load GIFs (${res.status})`);
      }

      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching GIFs:', err);
        setError(err.message || 'Could not load GIFs');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch whenever debouncedQuery or activeCategory changes
  useEffect(() => {
    fetchGifs(debouncedQuery, activeCategory);
  }, [debouncedQuery, activeCategory, fetchGifs]);

  const handleCategoryClick = (category) => {
    setActiveCategory(category.id);
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const handleSelect = (gif) => {
    if (!gif || !gif.url) return;
    onSelectGif?.(gif.url, gif);
    onClose?.();
  };

  const content = (
    <div
      role="dialog"
      aria-label="Tenor GIF Picker"
      className="tenor-gif-picker-box"
      style={{
        width: '100%',
        maxWidth: '420px',
        height: '460px',
        maxHeight: '85vh',
        background: 'rgba(13, 13, 20, 0.96)',
        backdropFilter: 'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border: '1px solid rgba(255, 159, 28, 0.25)',
        borderRadius: '20px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(255, 159, 28, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'var(--font-ui, sans-serif)',
        userSelect: 'none',
        animation: 'tenor-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        zIndex: 1002,
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header & Search Bar */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--amber, #ff9f1c)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Sparkles size={14} />
              Tenor GIFs
            </span>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
              Powered by Tenor
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close GIF Picker"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search Input Field */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              color: '#94a3b8',
              pointerEvents: 'none'
            }}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search GIFs on Tenor..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeCategory !== 'custom') {
                setActiveCategory('custom');
              }
            }}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '9px 34px 9px 36px',
              fontSize: '13px',
              color: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease, background 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(255, 159, 28, 0.5)';
              e.target.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.target.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setActiveCategory('trending');
              }}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Chips */}
        <div
          className="custom-scrollbar"
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id && !debouncedQuery;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isActive ? '1px solid rgba(255, 159, 28, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isActive ? 'rgba(255, 159, 28, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ffd23f' : '#cbd5e1',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main GIF Grid Container */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          alignContent: 'start'
        }}
      >
        {isLoading ? (
          // Loading Skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skel_${i}`}
              style={{
                height: i % 2 === 0 ? '130px' : '110px',
                borderRadius: '12px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.5s infinite linear',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            />
          ))
        ) : error ? (
          <div
            style={{
              gridColumn: 'span 2',
              padding: '40px 16px',
              textAlign: 'center',
              color: '#f43f5e',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AlertCircle size={28} />
            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{error}</span>
            <button
              type="button"
              onClick={() => fetchGifs(debouncedQuery, activeCategory)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 159, 28, 0.2)',
                border: '1px solid rgba(255, 159, 28, 0.4)',
                color: 'var(--amber, #ff9f1c)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '6px'
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : gifs.length > 0 ? (
          gifs.map((gif) => {
            const isHovered = hoveredGifId === gif.id;
            return (
              <div
                key={gif.id}
                role="button"
                tabIndex={0}
                aria-label={gif.title || 'Animated GIF'}
                onClick={() => handleSelect(gif)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(gif);
                  }
                }}
                onMouseEnter={() => setHoveredGifId(gif.id)}
                onMouseLeave={() => setHoveredGifId(null)}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: gif.dims ? `${gif.dims[0]}/${gif.dims[1]}` : '4/3',
                  minHeight: '90px',
                  maxHeight: '160px',
                  background: '#09090d',
                  border: isHovered ? '2px solid var(--amber, #ff9f1c)' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isHovered ? '0 8px 24px rgba(255, 159, 28, 0.25)' : 'none',
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                  transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease'
                }}
              >
                <img
                  src={gif.preview_url || gif.url}
                  alt={gif.title || 'GIF'}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e) => {
                    // Fallback to full url if preview url fails
                    if (gif.url && e.currentTarget.src !== gif.url) {
                      e.currentTarget.src = gif.url;
                    }
                  }}
                />

                {/* Hover gradient overlay & title */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 50%)',
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '8px',
                    pointerEvents: 'none'
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#ffffff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {gif.title || 'Send GIF'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              gridColumn: 'span 2',
              padding: '48px 16px',
              textAlign: 'center',
              color: '#64748b',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={24} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
              No GIFs found for &quot;{debouncedQuery || activeCategory}&quot;
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Try another search term or pick a category above
            </span>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div
        style={{
          padding: '6px 14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#64748b'
        }}
      >
        <span>Click GIF to send</span>
        <span>Esc to close</span>
      </div>
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 8, 0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 1000,
          cursor: 'default'
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '16px',
          pointerEvents: 'none'
        }}
      >
        <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '420px' }}>
          {content}
        </div>
      </div>
    </>
  );
}
