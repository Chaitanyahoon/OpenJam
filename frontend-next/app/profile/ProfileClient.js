'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc, ArrowLeft, Trash2, X, AlertTriangle, Plus, Heart, Music, Lock, Globe, ListMusic } from 'lucide-react';
import { ProfileSkeleton } from '@/components/SkeletonLoaders';
import { extractColors } from '@/utils/colorExtractor';

// Import our new sub-components
import ProfileHero from '@/components/profile/ProfileHero';
import ProfileSidebar from '@/components/profile/ProfileSidebar';
import ProfileStats from '@/components/profile/ProfileStats';
import ProfileLikes from '@/components/profile/ProfileLikes';
import ProfilePlaylistDetail from '@/components/profile/ProfilePlaylistDetail';
import ProfileDiscover from '@/components/profile/ProfileDiscover';
import CreatePlaylistModal from '@/components/profile/CreatePlaylistModal';
import SocialListModal from '@/components/profile/SocialListModal';
import ProfileSocialActivity from '@/components/profile/ProfileSocialActivity';

export default function ProfileClient() {
  // Core data states
  const [profile, setProfile] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extractedColors, setExtractedColors] = useState(['#141318', '#08080a']);

  // Tab & playlist selection states
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'discover' | 'stats'
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [activePlaylistData, setActivePlaylistData] = useState(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  // Mobile library layout states
  const [showLikesOnMobile, setShowLikesOnMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setShowLikesOnMobile(false);
  }, [activeTab]);

  // Modals & overlay states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [syncingPlaylistId, setSyncingPlaylistId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // Search & stats states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Dropdown trigger state (liked songs adding to playlist)
  const [activeDropdownTrackUri, setActiveDropdownTrackUri] = useState(null);

  // Toast notifications state
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

  // Social stats state
  const [socialStats, setSocialStats] = useState({ followers_count: 0, following_count: 0, followers: [], following: [] });
  const [socialModalOpen, setSocialModalOpen] = useState(false);

  // Fetch initial profile data
  const fetchProfileData = async () => {
    try {
      const res = await fetch(`/api/profile/me?t=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
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
      setSavedPlaylists(data.saved_playlists || []);
      setLikes(data.likes || []);
      setLoading(false);

      // Fetch social details for own profile
      try {
        const socialRes = await fetch(`/api/profile/${data.user.id}/social?t=${Date.now()}`, { cache: 'no-store' });
        if (socialRes.ok) {
          const socialData = await socialRes.json();
          setSocialStats(socialData);
        }
      } catch (err) {
        console.warn('Failed to load social stats:', err);
      }
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
    if (!profile) return;
    const targetUrl = profile.banner_url || profile.avatar_url;
    if (!targetUrl) return;
    
    extractColors(targetUrl).then((colors) => {
      if (colors && colors.length > 0) {
        setExtractedColors(colors);
      }
    });
  }, [profile]);

  // Fetch stats data
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/profile/me/stats?t=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      } else {
        addToast('Failed to load listening stats', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection error loading stats', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats' && !stats) {
      fetchStats();
    }
  }, [activeTab, stats]);

  // Debounced search for discovering other users
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
        const res = await fetch(`/api/profile/search?q=${encodeURIComponent(queryClean)}`);
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

  // Load selected playlist tracks
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

  // Toast handlers
  const addToast = (text, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Profile actions
  const handleUpdateProfile = async (updatedFields) => {
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        addToast('Profile updated successfully!', 'success');
      } else {
        addToast('Failed to update profile details', 'error');
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

  // Playlist actions
  const handleCreatePlaylist = async (name, isPrivate) => {
    try {
      const res = await fetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_private: isPrivate }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists([data.playlist, ...playlists]);
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

  const handleImportPlaylist = async (url, customName, isPrivate) => {
    setIsImporting(true);
    addToast('Importing tracks from external playlist...', 'info');
    try {
      const searchRes = await fetch(`/search/playlist?url=${encodeURIComponent(url)}`);
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

      const defaultName = url.includes('spotify.com') ? 'Spotify Import' : 'YouTube Import';
      const playlistName = customName || defaultName;
      
      const createRes = await fetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          is_private: isPrivate,
          import_url: url
        })
      });

      if (!createRes.ok) {
        addToast('Failed to create playlist wrapper', 'error');
        setIsImporting(false);
        return;
      }

      const createData = await createRes.json();
      const newPlaylist = createData.playlist;

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
        setPlaylists([newPlaylist, ...playlists]);
        setShowCreateModal(false);
        setActivePlaylistId(newPlaylist.id);
        addToast(`Successfully imported ${tracks.length} tracks!`, 'success');
      } else {
        addToast('Failed to import tracks into playlist', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection error during import', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncPlaylist = async (id) => {
    setSyncingPlaylistId(id);
    addToast('Syncing playlist with source...', 'info');
    try {
      const res = await fetch(`/playlists/${id}/sync`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setActivePlaylistData(data.playlist);
        const profileRes = await fetch('/api/profile/me', { credentials: 'include' });
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
    } finally {
      setSyncingPlaylistId(null);
    }
  };

  const executeDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    try {
      const res = await fetch(`/playlists/${playlistToDelete.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setPlaylists(playlists.filter((p) => p.id !== playlistToDelete.id));
        if (activePlaylistId === playlistToDelete.id) {
          setActivePlaylistId(null);
          setActivePlaylistData(null);
        }
        addToast('Playlist deleted successfully!', 'success');
      } else {
        addToast('Failed to delete playlist', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    } finally {
      setPlaylistToDelete(null);
    }
  };

  const handleUnlikeTrack = async (uri) => {
    try {
      const res = await fetch(`/likes?track_uri=${encodeURIComponent(uri)}`, { method: 'DELETE' });
      if (res.ok) {
        setLikes(likes.filter((l) => l.track_uri !== uri));
        addToast('Removed from Liked Songs', 'success');
      } else {
        addToast('Failed to unlike track', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleAddTrackToPlaylist = async (playlistId, track) => {
    try {
      const res = await fetch(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_uri: track.track_uri,
          track_name: track.track_name,
          artist: track.artist,
          album_art_url: track.album_art_url,
          duration_ms: track.duration_ms || 240000
        })
      });
      if (res.ok) {
        addToast('Added song to playlist!', 'success');
        // If we are currently viewing the playlist we added the track to, we reload it
        if (activePlaylistId === playlistId) {
          const reloadRes = await fetch(`/playlists/${playlistId}`, { credentials: 'include' });
          if (reloadRes.ok) {
            const reloadData = await reloadRes.json();
            setActivePlaylistData(reloadData.playlist);
          }
        }
      } else {
        addToast('Failed to add track to playlist', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleRemoveTrackFromPlaylist = async (trackId) => {
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

  if (loading) {
    return <ProfileSkeleton />;
  }

  // Auth Required Guard page
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
        <Disc size={64} style={{ color: 'var(--theme-accent, #ff9f1c)', marginBottom: '24px' }} />
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
    <div className="profile-page-wrapper" style={{
      minHeight: '100vh',
      background: `radial-gradient(circle at top, ${extractedColors[0]}1f 0%, #08080a 75%)`,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
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
          transition: 'width 0.2s, height 0.2s',
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
                background: t.type === 'error' ? 'rgba(255, 71, 87, 0.95)' : t.type === 'info' ? 'rgba(59, 130, 246, 0.95)' : 'rgba(46, 213, 115, 0.95)',
                color: '#fff',
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 700,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)'
              }}
            >
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 2 }}>


        {/* Profile Hero Card */}
        <ProfileHero 
          profile={profile}
          isOwnProfile={true}
          onUpdateProfile={handleUpdateProfile}
          onLogout={handleLogout}
          playlistsCount={playlists.length}
          likesCount={likes.length}
          roomsHostedCount={stats?.rooms_hosted || 0}
          social={socialStats}
          onFollowClick={null}
          onUnfollowClick={null}
          onOpenSocialModal={() => setSocialModalOpen(true)}
          addToast={addToast}
        />


        {/* Grid Area */}
        <div className="profile-dashboard-grid">
          {/* Left Sidebar */}
          <ProfileSidebar 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            playlists={playlists}
            savedPlaylists={savedPlaylists}
            likesCount={likes.length}
            activePlaylistId={activePlaylistId}
            setActivePlaylistId={setActivePlaylistId}
            isOwnProfile={true}
            onCreatePlaylistClick={() => setShowCreateModal(true)}
            onDeletePlaylistClick={(pl) => setPlaylistToDelete(pl)}
            syncingPlaylistId={syncingPlaylistId}
            onSyncPlaylistClick={handleSyncPlaylist}
          />

          {/* Right main workspace card */}
          <div className="glass-card profile-workspace-container" style={{
            padding: '32px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
            backdropFilter: 'blur(20px)',
            minHeight: '500px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            <AnimatePresence mode="wait">
              {activeTab === 'discover' && (
                <motion.div
                  key="discover"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProfileDiscover 
                    searchQuery={userSearchQuery}
                    setSearchQuery={setUserSearchQuery}
                    results={userSearchResults}
                  />
                </motion.div>
              )}

              {activeTab === 'social' && (
                <motion.div
                  key="social"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProfileSocialActivity />
                </motion.div>
              )}

              {activeTab === 'stats' && (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProfileStats 
                    stats={stats}
                    loading={statsLoading}
                    onRefresh={fetchStats}
                    isOwnProfile={true}
                    profile={profile}
                  />
                </motion.div>
              )}

              {activeTab === 'library' && (
                <motion.div
                  key="library"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  style={{ width: '100%' }}
                >
                  {isMobile ? (
                    <AnimatePresence mode="wait">
                      {activePlaylistId !== null ? (
                        <motion.div
                          key={`playlist-${activePlaylistId}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                          <ProfilePlaylistDetail 
                            playlist={activePlaylistData}
                            loading={loadingPlaylist}
                            isOwnProfile={activePlaylistData?.creator_id === profile?.id}
                            onBackToLibrary={() => setActivePlaylistId(null)}
                            onCopyPlaylistLink={handleCopyPlaylistLink}
                            onSyncPlaylist={handleSyncPlaylist}
                            onRemoveTrack={handleRemoveTrackFromPlaylist}
                            syncingPlaylistId={syncingPlaylistId}
                          />
                        </motion.div>
                      ) : showLikesOnMobile ? (
                        <motion.div
                          key="likes"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                          <ProfileLikes 
                            likes={likes}
                            playlists={playlists}
                            isOwnProfile={true}
                            onUnlikeTrack={handleUnlikeTrack}
                            onAddTrackToPlaylist={handleAddTrackToPlaylist}
                            activeDropdownTrackUri={activeDropdownTrackUri}
                            setActiveDropdownTrackUri={setActiveDropdownTrackUri}
                            onBackToLibrary={() => setShowLikesOnMobile(false)}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="library-menu"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                          <div className="mobile-library-menu">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>My Library</h3>
                              <button
                                onClick={() => setShowCreateModal(true)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #ff8c00 100%)',
                                  border: 'none',
                                  color: '#000',
                                  padding: '6px 12px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                <Plus size={14} /> Create
                              </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                              <div 
                                onClick={() => setShowLikesOnMobile(true)}
                                className="profile-card-hover"
                                style={{
                                  padding: '16px',
                                  borderRadius: '16px',
                                  background: 'rgba(255,255,255,0.02)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'rgba(255, 71, 87, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <Heart size={18} style={{ color: '#ff4757' }} />
                                  </div>
                                  <div>
                                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>Liked Songs</h4>
                                    <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0 0' }}>{likes.length} songs</p>
                                  </div>
                                </div>
                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: '#888', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                  Default
                                </span>
                              </div>

                              {playlists.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                  <h4 style={{ fontSize: '12px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Playlists</h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {playlists.map((pl) => (
                                      <div
                                        key={pl.id}
                                        onClick={() => setActivePlaylistId(pl.id)}
                                        className="profile-card-hover"
                                        style={{
                                          padding: '16px',
                                          borderRadius: '16px',
                                          background: 'rgba(255,255,255,0.02)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                          <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            background: 'rgba(255, 159, 28, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                          }}>
                                            <Music size={18} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</h4>
                                            <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0 0' }}>Playlist</p>
                                          </div>
                                        </div>
                                        
                                        <div>
                                          {pl.is_private ? (
                                            <Lock size={12} color="#ff4757" />
                                          ) : (
                                            <Globe size={12} color="#10b981" />
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {savedPlaylists && savedPlaylists.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                  <h4 style={{ fontSize: '12px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Saved Playlists</h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {savedPlaylists.map((pl) => (
                                      <div
                                        key={pl.id}
                                        onClick={() => setActivePlaylistId(pl.id)}
                                        className="profile-card-hover"
                                        style={{
                                          padding: '16px',
                                          borderRadius: '16px',
                                          background: 'rgba(255,255,255,0.02)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                          <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '10px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                          }}>
                                            <ListMusic size={18} style={{ color: '#10b981' }} />
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</h4>
                                            <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0 0' }}>By {pl.creator_name}</p>
                                          </div>
                                        </div>
                                        
                                        <div>
                                          <Globe size={12} color="#10b981" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {playlists.length === 0 && savedPlaylists.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#444' }}>
                                  <Music size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
                                  <p style={{ fontSize: '13px', margin: 0 }}>No playlists in your library yet.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    <AnimatePresence mode="wait">
                      {activePlaylistId !== null ? (
                        <motion.div
                          key={`playlist-desk-${activePlaylistId}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ProfilePlaylistDetail 
                            playlist={activePlaylistData}
                            loading={loadingPlaylist}
                            isOwnProfile={activePlaylistData?.creator_id === profile?.id}
                            onBackToLibrary={() => setActivePlaylistId(null)}
                            onCopyPlaylistLink={handleCopyPlaylistLink}
                            onSyncPlaylist={handleSyncPlaylist}
                            onRemoveTrack={handleRemoveTrackFromPlaylist}
                            syncingPlaylistId={syncingPlaylistId}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="likes-desk"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ProfileLikes 
                            likes={likes}
                            playlists={playlists}
                            isOwnProfile={true}
                            onUnlikeTrack={handleUnlikeTrack}
                            onAddTrackToPlaylist={handleAddTrackToPlaylist}
                            activeDropdownTrackUri={activeDropdownTrackUri}
                            setActiveDropdownTrackUri={setActiveDropdownTrackUri}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Playlist Creation Modal */}
      <CreatePlaylistModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreatePlaylist={handleCreatePlaylist}
        onImportPlaylist={handleImportPlaylist}
        isImporting={isImporting}
      />

      {/* Social Listing Modal */}
      {socialModalOpen && (
        <SocialListModal 
          isOpen={socialModalOpen}
          onClose={() => setSocialModalOpen(false)}
          followers={socialStats.followers || []}
          following={socialStats.following || []}
          onUnfollow={async (unfollowedUserId) => {
            try {
              const res = await fetch(`/api/profile/${unfollowedUserId}/follow`, { method: 'DELETE' });
              if (res.ok) {
                addToast('Unfollowed user', 'success');
                // Refresh social status
                const socialRes = await fetch(`/api/profile/${profile.id}/social`);
                if (socialRes.ok) {
                  const socialData = await socialRes.json();
                  setSocialStats(socialData);
                }
              } else {
                addToast('Failed to unfollow user', 'error');
              }
            } catch (err) {
              addToast('Connection error', 'error');
            }
          }}
        />
      )}

      {/* Confirmation Modal for Playlist Delete */}
      <AnimatePresence>
        {playlistToDelete && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '20px'
            }}
            onClick={() => setPlaylistToDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '400px',
                background: '#0d0d12',
                border: '1px solid rgba(255, 71, 87, 0.2)',
                borderRadius: '24px',
                padding: '28px',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(255, 71, 87, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto'
              }}>
                <AlertTriangle size={28} color="#ff4757" />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Delete Playlist?</h3>
              <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.5, marginBottom: '24px' }}>
                Are you sure you want to delete <strong style={{ color: '#fff' }}>{playlistToDelete.name}</strong>? This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setPlaylistToDelete(null)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#aaa',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeletePlaylist}
                  style={{
                    flex: 1,
                    background: '#ff4757',
                    border: 'none',
                    color: '#fff',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255, 71, 87, 0.2)'
                  }}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
