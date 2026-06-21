'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Music, Heart, Plus, Trash2, Globe, Lock, Share2, 
  ArrowLeft, Edit2, Check, X, Disc, ExternalLink, Play 
} from 'lucide-react';

const THEMES = {
  amber: {
    primary: '#ff9f1c',
    secondary: '#ffd23f',
    glow: 'rgba(255, 159, 28, 0.15)',
    name: 'Warm Amber',
    shadow: '0 8px 32px rgba(255, 170, 0, 0.25), 0 0 0 1px rgba(255, 170, 0, 0.15)',
    hoverBg: 'linear-gradient(135deg, #ffb732, #ffe066)',
    hoverShadow: '0 12px 40px rgba(255,170,0,0.4)',
  },
  cobalt: {
    primary: '#38bdf8',
    secondary: '#60a5fa',
    glow: 'rgba(56, 189, 248, 0.15)',
    name: 'Cobalt Blue',
    shadow: '0 8px 32px rgba(56, 189, 248, 0.25), 0 0 0 1px rgba(56, 189, 248, 0.15)',
    hoverBg: 'linear-gradient(135deg, #60d2ff, #93c5fd)',
    hoverShadow: '0 12px 40px rgba(56, 189, 248, 0.4)',
  },
  rose: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.15)',
    name: 'Neon Rose',
    shadow: '0 8px 32px rgba(244, 63, 94, 0.25), 0 0 0 1px rgba(244, 63, 94, 0.15)',
    hoverBg: 'linear-gradient(135deg, #ff5b78, #fda4af)',
    hoverShadow: '0 12px 40px rgba(244, 63, 94, 0.4)',
  },
  emerald: {
    primary: '#10b981',
    secondary: '#34d399',
    glow: 'rgba(16, 185, 129, 0.15)',
    name: 'Emerald Green',
    shadow: '0 8px 32px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.15)',
    hoverBg: 'linear-gradient(135deg, #22d3ee, #6ee7b7)',
    hoverShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
  },
  violet: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    glow: 'rgba(139, 92, 246, 0.15)',
    name: 'Electric Violet',
    shadow: '0 8px 32px rgba(139, 92, 246, 0.25), 0 0 0 1px rgba(139, 92, 246, 0.15)',
    hoverBg: 'linear-gradient(135deg, #a78bfa, #c084fc)',
    hoverShadow: '0 12px 40px rgba(139, 92, 246, 0.4)',
  },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistPrivate, setNewPlaylistPrivate] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [toasts, setToasts] = useState([]);

  const addToast = (text, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchProfileData = async () => {
    try {
      const res = await fetch('/profile/me', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError('Authentication required');
        } else {
          setError('Failed to load profile');
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data.user);
      setPlaylists(data.playlists || []);
      setLikes(data.likes || []);
      setEditedName(data.user.display_name);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Connection error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleUpdateName = async () => {
    if (!editedName.trim()) return;
    try {
      const res = await fetch('/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editedName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setIsEditingName(false);
        addToast('Profile updated!', 'success');
      } else {
        addToast('Failed to update profile name', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleUpdateTheme = async (themeKey) => {
    if (!profile) return;
    try {
      const res = await fetch('/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          display_name: profile.display_name, 
          profile_theme: themeKey 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        addToast('Theme updated!', 'success');
      } else {
        addToast('Failed to update theme', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const res = await fetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          is_private: newPlaylistPrivate,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists([data.playlist, ...playlists]);
        setNewPlaylistName('');
        setShowCreateModal(false);
        setActivePlaylistId(data.playlist.id);
        addToast('Playlist created!', 'success');
      } else {
        addToast('Failed to create playlist', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleDeletePlaylist = async (id) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      const res = await fetch(`/playlists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylists(playlists.filter((p) => p.id !== id));
        if (activePlaylistId === id) setActivePlaylistId(null);
        addToast('Playlist deleted', 'success');
      } else {
        addToast('Failed to delete playlist', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleUnlike = async (uri) => {
    try {
      const res = await fetch(`/likes?track_uri=${encodeURIComponent(uri)}`, { method: 'DELETE' });
      if (res.ok) {
        setLikes(likes.filter((l) => l.track_uri !== uri));
        addToast('Removed from liked songs', 'success');
      } else {
        addToast('Failed to unlike track', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const [activePlaylistData, setActivePlaylistData] = useState(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  useEffect(() => {
    if (!activePlaylistId) {
      setActivePlaylistData(null);
      return;
    }
    const loadPlaylist = async () => {
      setLoadingPlaylist(true);
      try {
        const res = await fetch(`/playlists/${activePlaylistId}`);
        if (res.ok) {
          const data = await res.json();
          setActivePlaylistData(data.playlist);
        } else {
          addToast('Failed to load playlist tracks', 'error');
        }
      } catch (err) {
        addToast('Connection error', 'error');
      }
      setLoadingPlaylist(false);
    };
    loadPlaylist();
  }, [activePlaylistId]);

  const handleRemoveTrack = async (trackId) => {
    if (!activePlaylistId || !activePlaylistData) return;
    try {
      const res = await fetch(`/playlists/${activePlaylistId}/tracks/${trackId}`, { method: 'DELETE' });
      if (res.ok) {
        setActivePlaylistData({
          ...activePlaylistData,
          tracks: activePlaylistData.tracks.filter((t) => t.id !== trackId),
        });
        addToast('Removed track from playlist', 'success');
      } else {
        addToast('Failed to remove track', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

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

  if (error === 'Authentication required') {
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
        <Disc size={64} color="var(--amber, #ff9f1c)" style={{ marginBottom: '24px' }} />
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px' }}>Unlock Premium Music Sharing</h1>
        <p style={{ color: '#aaa', maxWidth: '450px', marginBottom: '32px', lineHeight: '1.6' }}>
          Connect with Discord to create personal playlists, save your favorite tracks, customize your profile, and share your playlists with friends.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> Back Home
          </Link>
          <a href="/auth/discord" className="btn btn-primary" style={{
            background: 'linear-gradient(135deg, #5865F2, #404eed)',
            border: 'none',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '30px',
            fontWeight: 700,
            textDecoration: 'none'
          }}>
            Sign in with Discord
          </a>
        </div>
      </div>
    );
  }

  const activeTheme = THEMES[profile?.profile_theme] || THEMES.amber;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #141318 0%, #08080a 70%)',
      color: '#fff',
      fontFamily: 'var(--font-sans), sans-serif',
      padding: '40px 24px',
      position: 'relative',
      '--amber': activeTheme.primary,
      '--amber-glow': activeTheme.glow,
      '--theme-accent': activeTheme.primary,
      '--theme-accent-glow': activeTheme.glow
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --theme-accent: ${activeTheme.primary};
          --theme-accent-glow: ${activeTheme.glow};
          --amber: ${activeTheme.primary};
          --amber-glow: ${activeTheme.glow};
          --gold: ${activeTheme.secondary};
          --shadow-amber: ${activeTheme.shadow};
        }
        .btn-primary:hover {
          background: ${activeTheme.hoverBg} !important;
          box-shadow: ${activeTheme.hoverShadow} !important;
        }
      `}} />
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
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                background: toast.type === 'success' ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                border: `1px solid ${toast.type === 'success' ? '#2ed573' : '#ff4757'}`,
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Navigation */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#aaa', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to OpenJam Rooms
          </Link>
        </div>

        {/* Profile Card */}
        <div className="glass-card" style={{
          padding: '32px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(30px)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          flexWrap: 'wrap',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.display_name} 
                style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--amber, #ff9f1c)' }} 
              />
            ) : (
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.1)'
              }}>
                <User size={36} color="#888" />
              </div>
            )}

            <div>
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--amber, #ff9f1c)',
                      color: '#fff',
                      fontSize: '24px',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '4px 12px',
                      outline: 'none',
                      maxWidth: '220px'
                    }}
                    autoFocus
                  />
                  <button onClick={handleUpdateName} style={{ background: 'none', border: 'none', color: '#2ed573', cursor: 'pointer' }}>
                    <Check size={20} />
                  </button>
                  <button onClick={() => { setIsEditingName(false); setEditedName(profile.display_name); }} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>{profile?.display_name}</h2>
                  <button 
                    onClick={() => setIsEditingName(true)} 
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--amber, #ff9f1c)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', color: '#888', fontSize: '13px' }}>
                {profile?.discord_username && <span>Discord: @{profile.discord_username}</span>}
                <span>Member since: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>Profile Theme:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {Object.entries(THEMES).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => handleUpdateTheme(key)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: val.primary,
                        border: profile?.profile_theme === key ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: profile?.profile_theme === key ? `0 0 10px ${val.primary}` : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        transform: profile?.profile_theme === key ? 'scale(1.2)' : 'none',
                      }}
                      title={val.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => {
                document.cookie = 'session_token=; Max-Age=0; path=/;';
                window.location.href = '/';
              }}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          {/* Sidebar (Playlists Navigation) */}
          <div className="glass-card" style={{
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(10, 9, 12, 0.4)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>
                My Library
              </h3>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="btn btn-primary"
                style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> New
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => setActivePlaylistId(null)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: activePlaylistId === null ? 'var(--amber, #ff9f1c)' : 'transparent',
                  background: activePlaylistId === null ? activeTheme.glow : 'rgba(255,255,255,0.02)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s'
                }}
              >
                <Heart size={16} color="var(--amber, #ff9f1c)" fill="var(--amber, #ff9f1c)" />
                Liked Songs
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>{likes.length}</span>
              </button>

              {playlists.map((pl) => (
                <div 
                  key={pl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: activePlaylistId === pl.id ? 'var(--amber, #ff9f1c)' : 'transparent',
                    background: activePlaylistId === pl.id ? activeTheme.glow : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onClick={() => setActivePlaylistId(pl.id)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: 'none',
                      background: 'none',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Music size={16} color="#aaa" />
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px'
                    }}>{pl.name}</span>
                    {pl.is_private ? (
                      <Lock size={12} color="#666" />
                    ) : (
                      <Globe size={12} color="#666" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleDeletePlaylist(pl.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff4757'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main Area */}
          <div className="glass-card" style={{
            padding: '32px',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(10, 9, 12, 0.4)',
            backdropFilter: 'blur(20px)',
            minHeight: '400px'
          }}>
            {activePlaylistId === null ? (
              // LIKED SONGS VIEW
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <Heart size={28} color="var(--amber, #ff9f1c)" fill="var(--amber, #ff9f1c)" />
                  <h3 style={{ fontSize: '22px', fontWeight: 800 }}>Liked Songs</h3>
                  <span style={{ color: '#666', fontSize: '14px' }}>({likes.length} track{likes.length !== 1 ? 's' : ''})</span>
                </div>

                {likes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
                    <Heart size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                    <p style={{ fontSize: '15px' }}>Tracks you like from search or rooms will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {likes.map((like) => (
                      <div
                        key={like.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.03)',
                          borderRadius: '12px',
                          gap: '12px'
                        }}
                      >
                        {like.album_art_url ? (
                          <img 
                            src={like.album_art_url} 
                            alt={like.track_name} 
                            style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '6px',
                            background: 'rgba(255,255,255,0.05)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Music size={16} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {like.track_name}
                          </h4>
                          <p style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                            {like.artist}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnlike(like.track_uri)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--amber, #ff9f1c)',
                            cursor: 'pointer',
                            padding: '8px'
                          }}
                          title="Remove from Liked"
                        >
                          <Heart size={16} fill="var(--amber, #ff9f1c)" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // PLAYLIST DETAILS VIEW
              <div>
                {loadingPlaylist ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                      <Disc size={32} color="var(--amber, #ff9f1c)" />
                    </motion.div>
                  </div>
                ) : activePlaylistData ? (
                  <div>
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '16px',
                      marginBottom: '24px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      paddingBottom: '20px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '24px', fontWeight: 800 }}>{activePlaylistData.name}</h3>
                          {activePlaylistData.is_private ? (
                            <Lock size={14} color="#888" />
                          ) : (
                            <Globe size={14} color="#888" />
                          )}
                        </div>
                        <p style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>
                          Created by you • {activePlaylistData.tracks?.length || 0} track{activePlaylistData.tracks?.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        {!activePlaylistData.is_private && (
                          <button
                            onClick={() => handleCopyPlaylistLink(activePlaylistData.id)}
                            className="btn btn-ghost"
                            style={{
                              padding: '8px 16px',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderRadius: '20px'
                            }}
                          >
                            <Share2 size={14} /> Share Link
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePlaylist(activePlaylistData.id)}
                          className="btn btn-ghost"
                          style={{
                            padding: '8px 16px',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#ff4757',
                            borderColor: 'rgba(255,71,87,0.2)',
                            borderRadius: '20px'
                          }}
                        >
                          <Trash2 size={14} /> Delete Playlist
                        </button>
                      </div>
                    </div>

                    {/* Track list */}
                    {!activePlaylistData.tracks || activePlaylistData.tracks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
                        <Music size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <p style={{ fontSize: '15px' }}>This playlist is empty.</p>
                        <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                          Add songs directly to this playlist while listening in rooms or from search.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {activePlaylistData.tracks.map((track) => (
                          <div
                            key={track.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.03)',
                              borderRadius: '12px',
                              gap: '12px'
                            }}
                          >
                            {track.album_art_url ? (
                              <img 
                                src={track.album_art_url} 
                                alt={track.track_name} 
                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} 
                              />
                            ) : (
                              <div style={{
                                width: '40px', height: '40px', borderRadius: '6px',
                                background: 'rgba(255,255,255,0.05)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                              }}>
                                <Music size={16} />
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {track.track_name}
                              </h4>
                              <p style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                                {track.artist}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveTrack(track.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                padding: '8px',
                                transition: 'color 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ff4757'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                              title="Remove from Playlist"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>Playlist not found.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE PLAYLIST MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#0e0e12',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
              padding: '32px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>Create New Playlist</h3>
            <form onSubmit={handleCreatePlaylist}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Late Night Vibes"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '15px'
                  }}
                  autoFocus
                  required
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                padding: '12px 16px',
                borderRadius: '12px',
                marginBottom: '28px',
                cursor: 'pointer'
              }} onClick={() => setNewPlaylistPrivate(!newPlaylistPrivate)}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700 }}>Private Playlist</h4>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Only you can view and use this playlist.
                  </p>
                </div>
                <div style={{
                  width: '40px',
                  height: '24px',
                  borderRadius: '12px',
                  background: newPlaylistPrivate ? 'var(--amber, #ff9f1c)' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                  transition: 'background 0.3s'
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: newPlaylistPrivate ? '19px' : '3px',
                    transition: 'left 0.3s'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => { setShowCreateModal(false); setNewPlaylistName(''); }}
                  style={{ padding: '10px 20px', borderRadius: '12px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', borderRadius: '12px' }}
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
