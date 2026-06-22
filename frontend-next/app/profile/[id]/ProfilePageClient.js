'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  User, Music, ArrowLeft, Disc, Share2, 
  ExternalLink, Globe, Lock, BarChart2, Heart
} from 'lucide-react';

export default function ProfilePageClient() {
  const params = useParams();
  const userId = params?.id;

  const [profile, setProfile] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const cursorGlowRef = useRef(null);

  // Mouse move handler for interactive background glow
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (cursorGlowRef.current) {
        cursorGlowRef.current.style.left = `${e.clientX}px`;
        cursorGlowRef.current.style.top = `${e.clientY}px`;
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, []);

  const addToast = (text, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    if (!userId) return;

    const fetchPublicProfile = async () => {
      try {
        // Fetch profile
        const res = await fetch(`/profile/${userId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('User profile not found');
          } else {
            setError('Failed to load profile');
          }
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProfile(data.user);
        setPlaylists(data.playlists || []);
        setLoading(false);

        // Fetch stats
        setStatsLoading(true);
        try {
          const statsRes = await fetch(`/profile/${userId}/stats`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData.stats);
          }
        } catch (e) {
          console.warn('Could not load public profile stats:', e);
        } finally {
          setStatsLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Connection error');
        setLoading(false);
      }
    };

    fetchPublicProfile();
  }, [userId]);

  const handleCopyPlaylistLink = (id) => {
    const link = `${window.location.origin}/playlist/${id}`;
    navigator.clipboard.writeText(link);
    addToast('Shareable link copied to clipboard!', 'success');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08080a',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        >
          <Disc size={48} color="var(--amber, #ff9f1c)" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#08080a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'sans-serif'
      }}>
        <Disc size={64} color="#ff4757" style={{ marginBottom: '24px' }} />
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>{error}</h1>
        <Link href="/" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #141318 0%, #08080a 70%)',
      color: '#fff',
      fontFamily: 'var(--font-ui), sans-serif',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Interactive Cursor Glow */}
      <div 
        ref={cursorGlowRef} 
        style={{
          position: 'fixed',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 159, 28, 0.04) 0%, rgba(255, 159, 28, 0) 70%)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 0,
          mixBlendMode: 'screen'
        }}
      />

      {/* Toast notifications */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: 'rgba(46, 213, 115, 0.15)',
              border: '1px solid #2ed573',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {toast.text}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Navigation */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#888', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = '#888'}>
            <ArrowLeft size={16} /> Back to OpenJam Rooms
          </Link>
        </div>

        {/* Profile Header */}
        <div className="glass-card" style={{
          padding: '32px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          backdropFilter: 'blur(30px)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'wrap',
          marginBottom: '40px'
        }}>
          <div style={{ position: 'relative', width: '84px', height: '84px' }}>
            <div style={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--amber, #ff9f1c) 0%, var(--gold, #ffd23f) 100%)',
              zIndex: 0, opacity: 0.8
            }} />
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.display_name} 
                style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0e0e12', position: 'relative', zIndex: 1 }} 
              />
            ) : (
              <div style={{
                width: '84px', height: '84px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                border: '3px solid #0e0e12', position: 'relative', zIndex: 1
              }}>
                <User size={36} color="#888" />
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #fff 0%, #ccc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {profile?.display_name}
            </h2>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', color: '#888', fontSize: '13px' }}>
              <span>Member since: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Musical Stats */}
        {stats && (
          <div className="glass-card" style={{
            padding: '32px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            marginBottom: '40px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <BarChart2 size={24} color="var(--amber, #ff9f1c)" />
              <h3 style={{ fontSize: '22px', fontWeight: 800 }}>Musical Footprint</h3>
            </div>

            {/* Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Listening Time</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--amber)', marginTop: '6px' }}>
                  {stats.listening_time_mins > 60 
                    ? `${Math.floor(stats.listening_time_mins / 60)}h ${stats.listening_time_mins % 60}m` 
                    : `${stats.listening_time_mins}m`}
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Songs Shared</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginTop: '6px' }}>{stats.total_queued}</div>
              </div>

              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved Songs</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff4757', marginTop: '6px' }}>{stats.total_likes}</div>
              </div>

              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ color: '#555', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interactions</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffd23f', marginTop: '6px' }}>{stats.total_chats + stats.total_votes}</div>
              </div>
            </div>

            {/* Top Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              
              {/* Top Tracks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Top Songs</h4>
                {stats.top_tracks.length === 0 ? (
                  <div style={{ color: '#444', fontSize: '13px', padding: '10px 0' }}>No history.</div>
                ) : (
                  stats.top_tracks.map((track, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--amber)', width: '16px', textAlign: 'center' }}>{i + 1}</div>
                      {track.album_art_url ? (
                        <img src={track.album_art_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={12} color="#888" /></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.track_name}</div>
                        <div style={{ fontSize: '11px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Top Artists */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Top Artists</h4>
                {stats.top_artists.length === 0 ? (
                  <div style={{ color: '#444', fontSize: '13px', padding: '10px 0' }}>No artist data.</div>
                ) : (
                  stats.top_artists.map((art, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', height: '44px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--amber)', width: '16px', textAlign: 'center' }}>{i + 1}</div>
                      <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.artist}</span>
                      <span style={{ fontSize: '11px', color: '#666', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '6px' }}>{art.count}x</span>
                    </div>
                  ))
                )}
              </div>

              {/* Top Genres */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Top Genres</h4>
                {stats.top_genres.length === 0 ? (
                  <div style={{ color: '#444', fontSize: '13px', padding: '10px 0' }}>No genre data.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {stats.top_genres.map((g, i) => {
                      const maxVal = stats.top_genres[0]?.count || 1;
                      const pct = Math.max(10, Math.floor((g.count / maxVal) * 100));
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                            <span style={{ textTransform: 'capitalize' }}>{g.genre}</span>
                            <span style={{ color: '#555' }}>{g.count} shared</span>
                          </div>
                          <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: 'linear-gradient(90deg, var(--amber) 0%, var(--gold) 100%)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Public Playlists */}
        <div className="glass-card" style={{
          padding: '32px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.04)',
          background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
          backdropFilter: 'blur(20px)',
          minHeight: '400px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
            <Music size={24} color="var(--amber, #ff9f1c)" />
            <h3 style={{ fontSize: '22px', fontWeight: 800 }}>Public Playlists</h3>
            <span style={{ color: '#666', fontSize: '14px', marginLeft: '6px' }}>({playlists.length})</span>
          </div>

          {playlists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
              <Music size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
              <p style={{ fontSize: '16px', fontWeight: 500 }}>No public playlists yet.</p>
              <p style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>Playlists created by this user will show up here if set to public.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {playlists.map((pl) => (
                <div 
                  key={pl.id}
                  style={{
                    padding: '20px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255, 159, 28, 0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '16px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {pl.name}
                      </h4>
                      <Globe size={14} color="#666" title="Public Playlist" />
                    </div>
                    <p style={{ color: '#666', fontSize: '12px' }}>
                      {pl.tracks?.length || 0} track{pl.tracks?.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleCopyPlaylistLink(pl.id)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#bbb',
                        cursor: 'pointer'
                      }}
                    >
                      <Share2 size={12} /> Share
                    </button>
                    <Link
                      href={`/playlist/${pl.id}`}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--amber, #ff9f1c) 0%, var(--gold, #ffd23f) 100%)',
                        border: 'none',
                        color: '#000',
                        fontWeight: 700,
                        textDecoration: 'none',
                        textAlign: 'center'
                      }}
                    >
                      View <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
