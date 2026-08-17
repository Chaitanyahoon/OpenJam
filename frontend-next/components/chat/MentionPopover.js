'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Crown, User, AtSign, Users } from 'lucide-react';

/**
 * Deterministic color palette for user avatar fallback backgrounds
 */
const AVATAR_COLORS = [
  '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', 
  '#10b981', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#d946ef'
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * MentionPopover component for chat @autocomplete
 * 
 * @param {Array} listeners - Array of active room listeners
 * @param {string} query - Text typed after '@'
 * @param {object} me - Current authenticated user
 * @param {string} hostId - User ID of the room host
 * @param {function} onSelect - Callback when a user is selected: (user) => void
 * @param {function} onClose - Callback when popover is dismissed: () => void
 * @param {object} style - Optional CSS style overrides
 */
export default function MentionPopover({
  listeners = [],
  query = '',
  me = null,
  hostId = null,
  onSelect,
  onClose,
  style = {}
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);
  const myId = me?.id || me?.user_id || null;

  // Filter and rank matching listeners
  const matchingUsers = useMemo(() => {
    if (!Array.isArray(listeners)) return [];

    const q = (query || '').trim().toLowerCase();
    
    // Normalize and deduplicate by user ID
    const seen = new Set();
    const normalized = [];

    for (const item of listeners) {
      if (!item) continue;
      const id = String(item.id || item.user_id || item._id || '');
      if (!id || seen.has(id)) continue;
      // Exclude self from mention suggestions
      if (myId && String(myId) === id) continue;
      seen.add(id);

      const name = item.display_name || item.user_name || item.name || item.username || 'Anonymous';
      const isHost = Boolean(item.is_host || (hostId && String(hostId) === id));
      const avatarUrl = item.avatar_url || item.avatar || item.user_avatar || null;

      normalized.push({
        id,
        display_name: name,
        avatar_url: avatarUrl,
        is_host: isHost,
        raw: item
      });
    }

    if (!q) {
      // If no query typed, show all listeners (hosts first, then alphabetical)
      return normalized.sort((a, b) => {
        if (a.is_host && !b.is_host) return -1;
        if (!a.is_host && b.is_host) return 1;
        return a.display_name.localeCompare(b.display_name);
      });
    }

    // Filter by query and rank: prefix matches > substring matches > hosts
    const filtered = normalized.filter(u => u.display_name.toLowerCase().includes(q));

    return filtered.sort((a, b) => {
      const aName = a.display_name.toLowerCase();
      const bName = b.display_name.toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      if (a.is_host && !b.is_host) return -1;
      if (!a.is_host && b.is_host) return 1;
      return aName.localeCompare(bName);
    });
  }, [listeners, query, myId, hostId]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [matchingUsers.length, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.children[selectedIndex];
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (matchingUsers.length === 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose?.();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % matchingUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + matchingUsers.length) % matchingUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const selected = matchingUsers[selectedIndex];
        if (selected) {
          onSelect?.(selected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [matchingUsers, selectedIndex, onSelect, onClose]);

  return (
    <div
      role="listbox"
      aria-label="Room members to mention"
      className="mention-popover-card"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: '10px',
        width: '100%',
        maxWidth: '320px',
        background: 'rgba(15, 15, 22, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 159, 28, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(255, 159, 28, 0.12)',
        zIndex: 1002,
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'var(--font-ui, sans-serif)',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        animation: 'popover-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px 8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--amber, #ff9f1c)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <AtSign size={13} />
          <span>Mention Listener</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
          {matchingUsers.length} online
        </span>
      </div>

      {/* User list */}
      <div
        ref={listRef}
        className="custom-scrollbar"
        style={{
          maxHeight: '190px',
          overflowY: 'auto',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        {matchingUsers.length > 0 ? (
          matchingUsers.map((user, idx) => {
            const isSelected = idx === selectedIndex;
            const nameColor = getAvatarColor(user.display_name);

            return (
              <div
                key={user.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect?.(user)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(255, 159, 28, 0.16)' : 'transparent',
                  border: isSelected ? '1px solid rgba(255, 159, 28, 0.35)' : '1px solid transparent',
                  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
                  transform: isSelected ? 'translateX(2px)' : 'none'
                }}
              >
                {/* Avatar with fallback */}
                <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: isSelected ? '1px solid var(--amber, #ff9f1c)' : '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.mention-avatar-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}

                  <div
                    className="mention-avatar-fallback"
                    style={{
                      display: user.avatar_url ? 'none' : 'flex',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: nameColor,
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isSelected ? '1px solid var(--amber, #ff9f1c)' : '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    {getInitials(user.display_name)}
                  </div>

                  {/* Online indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-1px',
                      right: '-1px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      border: '1.5px solid #0f0f16'
                    }}
                  />
                </div>

                {/* User info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#ffffff' : '#e2e8f0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {user.display_name}
                  </span>

                  {user.is_host && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: 'linear-gradient(135deg, rgba(255, 159, 28, 0.3), rgba(255, 210, 63, 0.2))',
                        border: '1px solid rgba(255, 159, 28, 0.4)',
                        color: '#ffd23f',
                        flexShrink: 0
                      }}
                    >
                      <Crown size={10} />
                      Host
                    </span>
                  )}
                </div>

                {/* Hint tag */}
                {isSelected && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--amber, #ff9f1c)',
                      opacity: 0.85,
                      fontWeight: 500,
                      flexShrink: 0
                    }}
                  >
                    ↵ Tab
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={20} style={{ opacity: 0.4 }} />
            <span>No listeners found matching &quot;{query}&quot;</span>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(0, 0, 0, 0.25)',
          fontSize: '10px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc cancel</span>
      </div>
    </div>
  );
}
