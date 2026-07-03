'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Radio, Disc, Play, ArrowRight, RefreshCw } from 'lucide-react';

export default function ProfileSocialActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const res = await fetch(`/api/profile/following/activity?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load friends activity:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    // Poll every 30 seconds for live updates
    const interval = setInterval(() => {
      fetchActivity(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ width: '150px', height: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }} className="skeleton-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            style={{ 
              height: '110px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.03)', 
              borderRadius: '18px',
              padding: '20px'
            }} 
            className="skeleton-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Radio size={28} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
          <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Friends Live Activity</h3>
        </div>
        <button
          onClick={() => fetchActivity(false)}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 159, 28, 0.1)',
            border: '1px solid rgba(255, 159, 28, 0.2)',
            color: 'var(--theme-accent, #ff9f1c)',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Activities Feed */}
      {activities.length === 0 ? (
        <div className="profile-empty-state" style={{ padding: '80px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.005)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '20px' }}>
          <Users size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Silence is golden, but music is better.</p>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '4px', maxWidth: '380px', marginInline: 'auto' }}>
            None of the users you follow are currently active in a listening room. Search for friends in "Discover Users" to follow them!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activities.map((act, index) => {
            const { friend, room_id, room_name, current_track } = act;
            const themeAccent = friend.profile_theme ? `var(--theme-${friend.profile_theme})` : 'var(--theme-accent, #ff9f1c)';
            
            return (
              <motion.div
                key={friend.id + '-' + index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card"
                style={{
                  padding: '16px 20px',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.04)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  flexWrap: 'wrap',
                  transition: 'border-color 0.2s, transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Left side: Avatar & info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                  {/* Avatar wrapper with live pulsing badge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {friend.avatar_url ? (
                      <img 
                        src={friend.avatar_url} 
                        alt={friend.display_name} 
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${themeAccent}` }}
                      />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justify_content: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Users size={20} color="#666" />
                      </div>
                    )}
                    <span 
                      style={{ 
                        position: 'absolute', 
                        bottom: '0', 
                        right: '0', 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        background: '#10b981', 
                        border: '2px solid #0d0d12',
                        boxShadow: '0 0 8px #10b981'
                      }} 
                    />
                  </div>

                  {/* Name and live status */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{friend.display_name}</span>
                      <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>@{friend.username}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Listening in</span>
                      <Link 
                        href={`/room/${room_id}`}
                        style={{ 
                          color: themeAccent, 
                          fontWeight: 700, 
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          borderBottom: '1px dashed transparent',
                          transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = 'currentColor'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                      >
                        {room_name} <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Right side: Current Song Info */}
                {current_track ? (
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid rgba(255,255,255,0.04)',
                      padding: '8px 16px 8px 12px',
                      borderRadius: '12px',
                      maxWidth: '300px',
                      width: '100%',
                      minWidth: '220px'
                    }}
                  >
                    {current_track.album_art_url ? (
                      <img 
                        src={current_track.album_art_url} 
                        alt="" 
                        style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Disc size={16} color="#444" />
                      </div>
                    )}
                    
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {current_track.track_name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                        {current_track.artist}
                      </div>
                    </div>

                    {/* Animated Equalizer Wave */}
                    {current_track.is_playing && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '12px', flexShrink: 0 }}>
                        <span className="equalizer-bar" style={{ width: '2px', height: '8px', background: themeAccent, borderRadius: '1px', animation: 'eq-pulse 0.8s ease-in-out infinite alternate' }} />
                        <span className="equalizer-bar" style={{ width: '2px', height: '12px', background: themeAccent, borderRadius: '1px', animation: 'eq-pulse 0.6s ease-in-out infinite alternate 0.1s' }} />
                        <span className="equalizer-bar" style={{ width: '2px', height: '5px', background: themeAccent, borderRadius: '1px', animation: 'eq-pulse 0.7s ease-in-out infinite alternate 0.2s' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
                    Idle (no track playing)
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
