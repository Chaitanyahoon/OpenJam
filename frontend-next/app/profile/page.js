'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Music, Heart, Plus, Trash2, Globe, Lock, Share2, 
  ArrowLeft, Edit2, Check, X, Disc, ExternalLink, Play, LogOut,
  ListMusic, FolderHeart, RefreshCw
} from 'lucide-react';

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
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [syncingPlaylistId, setSyncingPlaylistId] = useState(null);

  // Discovery / search states
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'discover'
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);

  // Playlist import states
  const [playlistCreateMode, setPlaylistCreateMode] = useState('scratch'); // 'scratch' | 'import'
  const [importPlaylistUrl, setImportPlaylistUrl] = useState('');
  const [importPlaylistName, setImportPlaylistName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [activeDropdownTrackUri, setActiveDropdownTrackUri] = useState(null);

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

  useEffect(() => {
    if (activeTab !== 'discover' || !userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    const queryClean = userSearchQuery.trim();
    if (queryClean.length < 2) {
      setUserSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/profile/search?q=${encodeURIComponent(queryClean)}`);
        if (res.ok) {
          const data = await res.json();
          setUserSearchResults(data.users || []);
        }
      } catch (err) {
        console.error('Error searching profiles:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [userSearchQuery, activeTab]);

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

  const handleLogout = async () => {
    localStorage.removeItem('openjam_display_name');
    localStorage.removeItem('openjam_avatar_url');
    document.cookie = "session_token=; Max-Age=0; path=/;";
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    window.location.href = '/';
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

  const handleImportPlaylist = async (e) => {
    e.preventDefault();
    if (!importPlaylistUrl.trim()) return;
    
    setIsImporting(true);
    try {
      // 1. Fetch tracks from external playlist
      const searchRes = await fetch(`/search/playlist?url=${encodeURIComponent(importPlaylistUrl.trim())}`);
      if (!searchRes.ok) {
        const errData = await searchRes.json();
        addToast(errData.detail || 'Failed to parse external playlist', 'error');
        setIsImporting(false);
        return;
      }
      const searchData = await searchRes.json();
      const tracks = searchData.tracks || [];
      if (tracks.length === 0) {
        addToast('No tracks found in this playlist', 'error');
        setIsImporting(false);
        return;
      }

      // 2. Create local playlist
      const defaultName = importPlaylistUrl.includes('spotify.com') ? 'Spotify Import' : 'YouTube Import';
      const playlistName = importPlaylistName.trim() || defaultName;
      
      const createRes = await fetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          is_private: newPlaylistPrivate,
          import_url: importPlaylistUrl
        })
      });

      if (!createRes.ok) {
        addToast('Failed to create playlist wrapper', 'error');
        setIsImporting(false);
        return;
      }

      const createData = await createRes.json();
      const newPlaylist = createData.playlist;

      // 3. Bulk insert tracks into the new playlist
      const bulkRes = await fetch(`/playlists/${newPlaylist.id}/tracks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: tracks.map(t => ({
            track_uri: t.uri || t.track_uri,
            track_name: t.name || t.track_name,
            artist: t.artist || 'Unknown Artist',
            album_art_url: t.album_art_url || t.src || null,
            duration_ms: t.duration_ms || 240000
          }))
        })
      });

      if (bulkRes.ok) {
        // Refresh local playlist state
        setPlaylists([newPlaylist, ...playlists]);
        setImportPlaylistUrl('');
        setImportPlaylistName('');
        setShowCreateModal(false);
        setActivePlaylistId(newPlaylist.id);
        addToast(`Successfully imported ${tracks.length} tracks!`, 'success');
      } else {
        addToast('Failed to import tracks into playlist', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection error during import', 'error');
    }
    setIsImporting(false);
  };

  const executeDeletePlaylist = async (id) => {
    try {
      const res = await fetch(`/playlists/${id}`, { method: 'DELETE', credentials: 'include' });
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

  const handleDeletePlaylist = (id) => {
    setPlaylistToDelete(id);
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

  const handleSyncPlaylist = async (id) => {
    setSyncingPlaylistId(id);
    addToast('Syncing playlist...', 'info');
    try {
      const res = await fetch(`/playlists/${id}/sync`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setActivePlaylistData(data.playlist);
        const profileRes = await fetch('/profile/me', { credentials: 'include' });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setPlaylists(profileData.playlists || []);
        }
        addToast(data.message || 'Playlist synced successfully!', 'success');
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to sync playlist', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection error during sync', 'error');
    }
    setSyncingPlaylistId(null);
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
        const res = await fetch(`/playlists/${activePlaylistId}`, { credentials: 'include' });
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
      const res = await fetch(`/playlists/${activePlaylistId}/tracks/${trackId}`, { method: 'DELETE', credentials: 'include' });
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.slice(0, 2).toUpperCase();
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
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>Unlock Premium Music Sharing</h1>
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
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(88, 101, 242, 0.35)'
          }}>
            Sign in with Discord
          </a>
        </div>
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

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Navigation */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#888', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = '#888'}>
            <ArrowLeft size={16} /> Back to OpenJam Rooms
          </Link>
        </div>

        {/* Profile Card */}
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
          justifyContent: 'space-between',
          gap: '24px',
          flexWrap: 'wrap',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
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
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--amber, #ff9f1c)',
                      color: '#fff',
                      fontSize: '24px',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '4px 12px',
                      outline: 'none',
                      maxWidth: '220px',
                      boxShadow: '0 0 12px rgba(255, 159, 28, 0.2)'
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
                  <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #fff 0%, #ccc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {profile?.display_name}
                  </h2>
                  <button 
                    onClick={() => setIsEditingName(true)} 
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#aaa', padding: '6px', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber, #ff9f1c)'; e.currentTarget.style.background = 'rgba(255, 159, 28, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', color: '#888', fontSize: '13px' }}>
                {profile?.discord_username && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5865F2' }} />
                    Discord: @{profile.discord_username}
                  </span>
                )}
                <span>Member since: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-ghost" 
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                borderRadius: '30px',
                background: 'rgba(255, 71, 87, 0.04)',
                border: '1px solid rgba(255, 71, 87, 0.15)',
                color: '#ff4757',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 71, 87, 0.12)'; e.currentTarget.style.borderColor = 'rgba(255, 71, 87, 0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 71, 87, 0.04)'; e.currentTarget.style.borderColor = 'rgba(255, 71, 87, 0.15)'; }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          {/* Sidebar (Playlists Navigation) */}
          <div className="glass-card" style={{
            padding: '24px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            {/* Sidebar Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('library')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: activeTab === 'library' ? 'rgba(255, 159, 28, 0.15)' : 'transparent',
                  color: activeTab === 'library' ? 'var(--amber, #ff9f1c)' : '#888',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Music size={14} /> Library
              </button>
              <button
                onClick={() => setActiveTab('discover')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: activeTab === 'discover' ? 'rgba(255, 159, 28, 0.15)' : 'transparent',
                  color: activeTab === 'discover' ? 'var(--amber, #ff9f1c)' : '#888',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <User size={14} /> Discover
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888' }}>
                My Library
              </h3>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="btn btn-primary"
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--amber, #ff9f1c) 0%, var(--gold, #ffd23f) 100%)',
                  border: 'none',
                  color: '#000',
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} /> New Playlist
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => { setActiveTab('library'); setActivePlaylistId(null); }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: (activeTab === 'library' && activePlaylistId === null) ? 'var(--amber, #ff9f1c)' : 'rgba(255,255,255,0.03)',
                  background: (activeTab === 'library' && activePlaylistId === null) ? 'rgba(255, 159, 28, 0.08)' : 'rgba(255,255,255,0.02)',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { if (activeTab !== 'library' || activePlaylistId !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { if (activeTab !== 'library' || activePlaylistId !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <Heart size={16} color="var(--amber, #ff9f1c)" fill="var(--amber, #ff9f1c)" />
                Liked Songs
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>{likes.length}</span>
              </button>

              {playlists.map((pl) => (
                <div 
                  key={pl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: (activeTab === 'library' && activePlaylistId === pl.id) ? 'var(--amber, #ff9f1c)' : 'rgba(255,255,255,0.03)',
                    background: (activeTab === 'library' && activePlaylistId === pl.id) ? 'rgba(255, 159, 28, 0.08)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => { if (activeTab !== 'library' || activePlaylistId !== pl.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { if (activeTab !== 'library' || activePlaylistId !== pl.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  <button
                    onClick={() => { setActiveTab('library'); setActivePlaylistId(pl.id); }}
                    style={{
                      flex: 1,
                      padding: '14px 18px',
                      border: 'none',
                      background: 'none',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <Music size={16} color="#aaa" />
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '150px'
                    }}>{pl.name}</span>
                    {pl.is_private ? (
                      <Lock size={12} color="#666" style={{ marginLeft: '6px' }} />
                    ) : (
                      <Globe size={12} color="#666" style={{ marginLeft: '6px' }} />
                    )}
                  </button>
                  {pl.import_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSyncPlaylist(pl.id);
                      }}
                      disabled={syncingPlaylistId === pl.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: syncingPlaylistId === pl.id ? 'var(--amber, #ff9f1c)' : '#555',
                        padding: '14px 8px',
                        cursor: syncingPlaylistId === pl.id ? 'default' : 'pointer',
                        transition: 'color 0.2s',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => { if (syncingPlaylistId !== pl.id) e.currentTarget.style.color = 'var(--amber, #ff9f1c)'; }}
                      onMouseLeave={(e) => { if (syncingPlaylistId !== pl.id) e.currentTarget.style.color = '#555'; }}
                      title="Sync external playlist"
                    >
                      <motion.div
                        animate={syncingPlaylistId === pl.id ? { rotate: 360 } : {}}
                        transition={syncingPlaylistId === pl.id ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <RefreshCw size={14} />
                      </motion.div>
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeletePlaylist(pl.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#555',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff4757'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
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
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
            backdropFilter: 'blur(20px)',
            minHeight: '500px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            {activeTab === 'discover' ? (
              // DISCOVER USERS VIEW
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                  <User size={28} color="var(--amber, #ff9f1c)" />
                  <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Discover Users</h3>
                </div>

                <div style={{ marginBottom: '24px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search users by display name or Discord tag..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255, 159, 28, 0.15)',
                      borderRadius: '16px',
                      padding: '14px 20px',
                      color: '#fff',
                      outline: 'none',
                      fontSize: '15px',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--amber)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,159,28,0.15)'}
                  />
                </div>

                {userSearchResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                    <User size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>{userSearchQuery.trim().length >= 2 ? "No users found" : "Search for other music lovers"}</p>
                    <p style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>
                      {userSearchQuery.trim().length >= 2 
                        ? "Try adjusting your search query." 
                        : "Type at least 2 characters to search OpenJam profiles."}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                    {userSearchResults.map((user) => (
                      <Link
                        key={user.id}
                        href={`/profile/${user.id}`}
                        target="_blank"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '16px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '16px',
                          textDecoration: 'none',
                          color: '#fff',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,159,28,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name}
                            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={20} color="#888" />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.display_name}
                          </h4>
                          {user.discord_username && (
                            <p style={{ color: '#666', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                              @{user.discord_username}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : activePlaylistId === null ? (
              // LIKED SONGS VIEW
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                  <Heart size={28} color="var(--amber, #ff9f1c)" fill="var(--amber, #ff9f1c)" />
                  <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Liked Songs</h3>
                  <span style={{ color: '#666', fontSize: '14px', marginLeft: '6px' }}>({likes.length} track{likes.length !== 1 ? 's' : ''})</span>
                </div>

                {likes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                    <Heart size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>No liked songs yet.</p>
                    <p style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>Tracks you like inside listening rooms will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {likes.map((like) => (
                      <div
                        key={like.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '14px 20px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '16px',
                          gap: '16px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255, 159, 28, 0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                      >
                        {like.album_art_url ? (
                          <img 
                            src={like.album_art_url} 
                            alt={like.track_name} 
                            style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{
                            width: '46px', height: '46px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.05)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Music size={18} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {like.track_name}
                          </h4>
                          <p style={{ color: '#888', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '3px' }}>
                            {like.artist}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {playlists.length > 0 && (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <button
                                onClick={() => setActiveDropdownTrackUri(activeDropdownTrackUri === like.track_uri ? null : like.track_uri)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: activeDropdownTrackUri === like.track_uri ? 'var(--amber, #ff9f1c)' : '#888',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  transition: 'color 0.2s',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => { if (activeDropdownTrackUri !== like.track_uri) e.currentTarget.style.color = 'var(--amber, #ff9f1c)'; }}
                                onMouseLeave={(e) => { if (activeDropdownTrackUri !== like.track_uri) e.currentTarget.style.color = '#888'; }}
                                title="Add to Playlist"
                              >
                                <Plus size={16} />
                              </button>

                              {activeDropdownTrackUri === like.track_uri && (
                                <>
                                  <div 
                                    style={{
                                      position: 'fixed',
                                      inset: 0,
                                      zIndex: 990,
                                      cursor: 'default'
                                    }} 
                                    onClick={() => setActiveDropdownTrackUri(null)}
                                  />
                                  <div 
                                    style={{
                                      position: 'absolute',
                                      right: 0,
                                      top: '100%',
                                      background: '#0e0e12',
                                      border: '1px solid rgba(255, 159, 28, 0.2)',
                                      borderRadius: '12px',
                                      padding: '8px 0',
                                      minWidth: '160px',
                                      zIndex: 991,
                                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                      display: 'flex',
                                      flexDirection: 'column'
                                    }}
                                  >
                                    <div style={{
                                      fontSize: '11px',
                                      color: '#666',
                                      padding: '4px 12px 8px 12px',
                                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em'
                                    }}>Add to Playlist</div>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '4px 0' }}>
                                      {playlists.map(p => (
                                        <button
                                          key={p.id}
                                          onClick={async () => {
                                            setActiveDropdownTrackUri(null);
                                            try {
                                              const res = await fetch(`/playlists/${p.id}/tracks`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  track_uri: like.track_uri,
                                                  track_name: like.track_name,
                                                  artist: like.artist,
                                                  album_art_url: like.album_art_url,
                                                  duration_ms: like.duration_ms || 240000
                                                })
                                              });
                                              if (res.ok) {
                                                addToast('Added to playlist!', 'success');
                                              } else {
                                                addToast('Failed to add track', 'error');
                                              }
                                            } catch (err) {
                                              addToast('Connection error', 'error');
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            background: 'none',
                                            border: 'none',
                                            color: '#fff',
                                            textAlign: 'left',
                                            padding: '8px 16px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'background 0.2s'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 159, 28, 0.1)'}
                                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                        >
                                          <Music size={12} color="#aaa" />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => handleUnlike(like.track_uri)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--amber, #ff9f1c)',
                              cursor: 'pointer',
                              padding: '10px',
                              transition: 'transform 0.2s',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            title="Remove from Liked"
                          >
                            <Heart size={18} fill="var(--amber, #ff9f1c)" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // PLAYLIST DETAILS VIEW
              <div>
                {loadingPlaylist ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                      <Disc size={40} color="var(--amber, #ff9f1c)" />
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
                      marginBottom: '28px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      paddingBottom: '20px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ fontSize: '26px', fontWeight: 800 }}>{activePlaylistData.name}</h3>
                          {activePlaylistData.is_private ? (
                            <Lock size={16} color="#888" title="Private Playlist" />
                          ) : (
                            <Globe size={16} color="#888" title="Public Playlist" />
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
                              padding: '8px 18px',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              borderRadius: '20px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.08)'
                            }}
                          >
                            <Share2 size={14} /> Share Link
                          </button>
                        )}
                        {activePlaylistData.import_url && (
                          <button
                            onClick={() => handleSyncPlaylist(activePlaylistData.id)}
                            disabled={syncingPlaylistId === activePlaylistData.id}
                            className="btn btn-ghost"
                            style={{
                              padding: '8px 18px',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              borderRadius: '20px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              cursor: syncingPlaylistId === activePlaylistData.id ? 'default' : 'pointer'
                            }}
                          >
                            <motion.div
                              animate={syncingPlaylistId === activePlaylistData.id ? { rotate: 360 } : {}}
                              transition={syncingPlaylistId === activePlaylistData.id ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <RefreshCw size={14} />
                            </motion.div>
                            {syncingPlaylistId === activePlaylistData.id ? 'Syncing...' : 'Sync Playlist'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePlaylist(activePlaylistData.id)}
                          className="btn btn-ghost"
                          style={{
                            padding: '8px 18px',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#ff4757',
                            borderColor: 'rgba(255,71,87,0.2)',
                            borderRadius: '20px',
                            background: 'rgba(255,71,87,0.02)',
                            border: '1px solid rgba(255,71,87,0.15)'
                          }}
                        >
                          <Trash2 size={14} /> Delete Playlist
                        </button>
                      </div>
                    </div>

                    {/* Track list */}
                    {!activePlaylistData.tracks || activePlaylistData.tracks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
                        <Music size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
                        <p style={{ fontSize: '16px', fontWeight: 500 }}>This playlist is empty.</p>
                        <p style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>
                          Add songs directly to this playlist while listening in rooms or from search.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {activePlaylistData.tracks.map((track) => (
                          <div
                            key={track.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '14px 20px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '16px',
                              gap: '16px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                          >
                            {track.album_art_url ? (
                              <img 
                                src={track.album_art_url} 
                                alt={track.track_name} 
                                style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover' }} 
                              />
                            ) : (
                              <div style={{
                                width: '46px', height: '46px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.05)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                              }}>
                                <Music size={18} />
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {track.track_name}
                              </h4>
                              <p style={{ color: '#888', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '3px' }}>
                                {track.artist}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveTrack(track.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#555',
                                cursor: 'pointer',
                                padding: '10px',
                                transition: 'color 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ff4757'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
                              title="Remove from Playlist"
                            >
                              <Trash2 size={18} />
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
          background: 'rgba(0,0,0,0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
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
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)'
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', letterSpacing: '-0.01em' }}>Create New Playlist</h3>
            
            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setPlaylistCreateMode('scratch')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: playlistCreateMode === 'scratch' ? 'rgba(255, 159, 28, 0.15)' : 'transparent',
                  color: playlistCreateMode === 'scratch' ? 'var(--amber, #ff9f1c)' : '#888',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Create New
              </button>
              <button
                type="button"
                onClick={() => setPlaylistCreateMode('import')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: playlistCreateMode === 'import' ? 'rgba(255, 159, 28, 0.15)' : 'transparent',
                  color: playlistCreateMode === 'import' ? 'var(--amber, #ff9f1c)' : '#888',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Import Playlist
              </button>
            </div>

            {playlistCreateMode === 'scratch' ? (
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
                    style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--amber, #ff9f1c) 0%, var(--gold, #ffd23f) 100%)', border: 'none', color: '#000', fontWeight: 700 }}
                  >
                    Create Playlist
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleImportPlaylist}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
                    Playlist URL
                  </label>
                  <input
                    type="url"
                    value={importPlaylistUrl}
                    onChange={(e) => setImportPlaylistUrl(e.target.value)}
                    placeholder="Spotify or YouTube playlist link..."
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

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
                    Playlist Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={importPlaylistName}
                    onChange={(e) => setImportPlaylistName(e.target.value)}
                    placeholder="Leave empty to use default name"
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
                    onClick={() => { setShowCreateModal(false); setImportPlaylistUrl(''); setImportPlaylistName(''); }}
                    style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
                    disabled={isImporting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, var(--amber, #ff9f1c) 0%, var(--gold, #ffd23f) 100%)', 
                      border: 'none', 
                      color: '#000', 
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {playlistToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
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
              maxWidth: '400px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
              textAlign: 'center'
            }}
          >
            <Trash2 size={48} color="#ff4757" style={{ marginBottom: '16px', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.01em' }}>Delete Playlist</h3>
            <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              Are you sure you want to delete this playlist? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => setPlaylistToDelete(null)}
                style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={async () => {
                  const id = playlistToDelete;
                  setPlaylistToDelete(null);
                  await executeDeletePlaylist(id);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  background: '#ff4757',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(255, 71, 87, 0.25)'
                }}
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
