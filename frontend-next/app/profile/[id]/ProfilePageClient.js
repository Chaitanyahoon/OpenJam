'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc, ArrowLeft, Music, Share2, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { ProfileSkeleton } from '@/components/SkeletonLoaders';

import ProfileHero from '@/components/profile/ProfileHero';
import ProfileStats from '@/components/profile/ProfileStats';

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

        // Fetch public stats
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
    return <ProfileSkeleton />;
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
        <Link href="/" className="profile-back-link">
          <ArrowLeft size={16} /> Back Home
        </Link>
      </div>
    );
  }

  // Cover image / mosaic generator for playlists
  const renderCover = (playlist) => {
    const tracks = playlist.tracks || [];
    if (tracks.length >= 4) {
      return (
        <div className="profile-playlist-mosaic">
          {tracks.slice(0, 4).map((track, i) => (
            track.album_art_url ? (
              <img key={i} src={track.album_art_url} alt="" className="profile-playlist-mosaic-img" />
            ) : (
              <div key={i} className="profile-playlist-mosaic-fallback"><Disc size={12} /></div>
            )
          ))}
        </div>
      );
    }
    
    if (tracks.length > 0 && tracks[0].album_art_url) {
      return (
        <img 
          src={tracks[0].album_art_url} 
          alt={playlist.name} 
          style={{ width: '100%', aspectRatio: 1, borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.04)' }} 
        />
      );
    }

    return (
      <div style={{ width: '100%', aspectRatio: 1, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Disc size={32} color="#333" />
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #141318 0%, #08080a 70%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      padding: '40px 24px',
      fontFamily: 'sans-serif'
    }}>
      {/* Interactive Cursor Glow */}
      <div 
        ref={cursorGlowRef}
        style={{
          position: 'fixed',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(255, 159, 28, 0.04) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
          zIndex: 1
        }}
      />

      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 99999 }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              style={{
                background: 'rgba(46, 213, 115, 0.95)',
                color: '#fff',
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 700,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* Back navigation */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/" className="profile-back-link">
            <ArrowLeft size={16} />
            <span>Back to OpenJam Rooms</span>
          </Link>
        </div>

        {/* Public Profile Hero Card */}
        <ProfileHero 
          profile={profile}
          isOwnProfile={false}
          onUpdateProfile={null}
          onLogout={null}
          playlistsCount={playlists.length}
          likesCount={stats?.total_likes || 0}
          roomsHostedCount={stats?.rooms_hosted || 0}
        />

        {/* Stats Section */}
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
            <ProfileStats 
              stats={stats}
              loading={statsLoading}
              onRefresh={null}
              isOwnProfile={false}
            />
          </div>
        )}

        {/* Public Playlists */}
        <div className="glass-card" style={{
          padding: '32px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.04)',
          background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
          backdropFilter: 'blur(20px)',
          minHeight: '300px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
            <Music size={24} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
            <h3 style={{ fontSize: '22px', fontWeight: 800 }}>Public Playlists</h3>
            <span style={{ color: '#666', fontSize: '14px', marginLeft: '6px' }}>({playlists.length})</span>
          </div>

          {playlists.length === 0 ? (
            <div className="profile-empty-state" style={{ padding: '60px 0' }}>
              <Music size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>No public playlists yet.</p>
              <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>Playlists created by this user will show up here if set to public.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {playlists.map((pl) => (
                <div 
                  key={pl.id}
                  className="profile-card-hover"
                  style={{
                    padding: '20px',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '70px', flexShrink: 0 }}>
                      {renderCover(pl)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <h4 style={{ fontWeight: 800, fontSize: '16px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pl.name}
                        </h4>
                        <Globe size={12} color="#10b981" title="Public Playlist" />
                      </div>
                      <p style={{ color: '#555', fontSize: '12px', fontWeight: 600 }}>
                        {pl.tracks?.length || 0} track{pl.tracks?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
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
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
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
                        background: 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #ff8c00 100%)',
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
