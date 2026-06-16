'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Trash2, Plus, Music, FolderHeart, ListMusic, RefreshCw, AlertTriangle, Volume2, SkipBack, SkipForward } from 'lucide-react';
import { offlineDb } from '@/utils/offlineDb';
import YouTubePlayer from '@/utils/YouTubePlayer';

export default function OfflinePage() {
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Player states
  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(80);
  
  // Modals / Helpers
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [toasts, setToasts] = useState([]);
  
  const playerRef = useRef(null);

  // Toast Helper
  const triggerToast = (msg, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, text: msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadOfflineData = async () => {
    try {
      const allTracks = await offlineDb.getAllTracks();
      const allPlaylists = await offlineDb.getAllPlaylists();
      setTracks(allTracks);
      setPlaylists(allPlaylists);
    } catch (err) {
      console.error('Failed to load offline data', err);
    }
  };

  useEffect(() => {
    loadOfflineData();
  }, []);

  // Initialize and clean up YouTubePlayer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    playerRef.current = new YouTubePlayer({
      onProgressUpdate: (pos, dur, playing) => {
        setPositionMs(pos);
        setDurationMs(dur);
        setIsPlaying(playing);
      },
      toast: (msg, type) => triggerToast(msg, type),
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  // Sync Player volume
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  // Filtered tracks memo
  const filteredTracks = useMemo(() => {
    let list = tracks;
    
    if (activePlaylistId) {
      const playlist = playlists.find(p => p.id === activePlaylistId);
      if (playlist) {
        list = tracks.filter(t => playlist.trackIds.includes(t.id));
      } else {
        list = [];
      }
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.track_name.toLowerCase().includes(query) ||
        t.artist.toLowerCase().includes(query)
      );
    }
    
    return list;
  }, [tracks, playlists, activePlaylistId, searchQuery]);

  // Play controls
  const handlePlayTrack = (track) => {
    if (activeTrack && activeTrack.id === track.id) {
      const nextPlayState = !isPlaying;
      setIsPlaying(nextPlayState);
      playerRef.current.setPlayState(nextPlayState);
      return;
    }
    
    setActiveTrack(track);
    setIsPlaying(true);
    setPositionMs(0);
    setDurationMs(0);
    
    playerRef.current.setTrack({
      track_uri: track.id,
      track_name: track.track_name,
      artist: track.artist,
      album_art_url: track.album_art_url,
      is_playing: true,
      position_ms: 0,
      duration_ms: track.duration_ms || 240000
    });
  };

  const handleTogglePlay = () => {
    if (!activeTrack) {
      if (filteredTracks.length > 0) {
        handlePlayTrack(filteredTracks[0]);
      }
      return;
    }
    const nextPlayState = !isPlaying;
    setIsPlaying(nextPlayState);
    playerRef.current.setPlayState(nextPlayState);
  };

  const handleSeek = (e) => {
    if (!durationMs || !playerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newPositionMs = Math.floor(percentage * durationMs);
    playerRef.current.syncPosition(newPositionMs, isPlaying);
    setPositionMs(newPositionMs);
  };

  const handleNext = () => {
    if (filteredTracks.length <= 1 || !activeTrack) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % filteredTracks.length;
    handlePlayTrack(filteredTracks[nextIndex]);
  };

  const handlePrev = () => {
    if (filteredTracks.length <= 1 || !activeTrack) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + filteredTracks.length) % filteredTracks.length;
    handlePlayTrack(filteredTracks[prevIndex]);
  };

  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Database mutations
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const playlist = {
      id: 'pl_' + Math.random().toString(36).substr(2, 9),
      name: newPlaylistName.trim(),
      trackIds: [],
      createdAt: Date.now()
    };
    try {
      await offlineDb.savePlaylist(playlist);
      setNewPlaylistName('');
      setShowCreatePlaylistModal(false);
      triggerToast('Playlist created!', 'success');
      loadOfflineData();
    } catch (err) {
      triggerToast('Failed to create playlist', 'error');
    }
  };

  const handleAddTrackToPlaylist = async (trackId, playlistId) => {
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return;
      if (playlist.trackIds.includes(trackId)) {
        triggerToast('Track already in playlist', 'warning');
        return;
      }
      playlist.trackIds.push(trackId);
      await offlineDb.savePlaylist(playlist);
      triggerToast(`Added to ${playlist.name}`, 'success');
      loadOfflineData();
    } catch (err) {
      triggerToast('Failed to add track to playlist', 'error');
    }
  };

  const handleRemoveTrackFromPlaylist = async (trackId, playlistId) => {
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return;
      playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
      await offlineDb.savePlaylist(playlist);
      triggerToast('Removed from playlist', 'success');
      loadOfflineData();
    } catch (err) {
      triggerToast('Failed to remove track', 'error');
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await offlineDb.deletePlaylist(playlistId);
      triggerToast('Playlist deleted', 'success');
      loadOfflineData();
      if (activePlaylistId === playlistId) {
        setActivePlaylistId(null);
      }
    } catch (err) {
      triggerToast('Failed to delete playlist', 'error');
    }
  };

  const handleDeleteTrack = async (trackId) => {
    if (!confirm('Delete this downloaded track from offline storage?')) return;
    try {
      await offlineDb.deleteTrack(trackId);
      triggerToast('Track deleted from offline storage', 'success');
      
      if (activeTrack && activeTrack.id === trackId) {
        if (playerRef.current) playerRef.current.stop();
        setActiveTrack(null);
        setIsPlaying(false);
      }
      
      // clean from playlists
      const updatedPlaylists = await Promise.all(playlists.map(async (playlist) => {
        if (playlist.trackIds.includes(trackId)) {
          playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
          await offlineDb.savePlaylist(playlist);
        }
        return playlist;
      }));
      
      loadOfflineData();
    } catch (err) {
      triggerToast('Failed to delete track', 'error');
    }
  };

  const formatTime = (ms) => {
    if (isNaN(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#08080a',
      color: '#fff',
      fontFamily: 'var(--font-ui), sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Background ambient glows */}
      <div className="landing-bg-glows" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '15%', left: '15%', width: '400px', height: '400px', background: 'rgba(255, 159, 28, 0.05)', filter: 'blur(120px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '400px', height: '400px', background: 'rgba(255, 85, 0, 0.04)', filter: 'blur(120px)', borderRadius: '50%' }} />
      </div>

      {/* Toast Stack */}
      <div className="toast-stack" style={{ zIndex: 10001 }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`toast ${toast.type}`}
              initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(4px)', transition: { duration: 0.2 } }}
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Warning Top Sticky Banner */}
      <div style={{
        background: 'linear-gradient(90deg, #ff9f1c, #ff5500)',
        color: '#08080a',
        padding: '12px 24px',
        textAlign: 'center',
        fontWeight: '700',
        fontSize: '13px',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 20px rgba(255, 159, 28, 0.25)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <AlertTriangle size={16} />
        <span>CONNECTION DROPPED. STANDALONE OFFLINE PLAYER RUNNING.</span>
      </div>

      {/* Content wrapper */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 16px 120px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        flex: 1
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          paddingBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900, background: 'linear-gradient(135deg, var(--amber), #ff5500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-display)' }}>
              OpenJam
            </span>
            <span style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', color: 'var(--text-3)' }}>
              OFFLINE MODE
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            onClick={handleRetry}
          >
            <RefreshCw size={14} /> Retry Connection
          </button>
        </div>

        {/* Main Columns Grid */}
        <div className="offline-library-grid">
          {/* Playlists Left Panel */}
          <div className="glass-card" style={{
            padding: '24px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 159, 28, 0.15)',
            background: 'rgba(10, 9, 12, 0.5)',
            backdropFilter: 'blur(20px)',
            height: 'fit-content'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ListMusic size={20} color="var(--amber)" /> Playlists
              </h3>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setShowCreatePlaylistModal(true)}
              >
                <Plus size={14} style={{ marginRight: '4px' }} /> Create
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                className={`playlist-item ${!activePlaylistId ? 'active' : ''}`}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: !activePlaylistId ? 'rgba(255, 159, 28, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: !activePlaylistId ? '1px solid var(--amber)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setActivePlaylistId(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Music size={16} color="var(--amber)" />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>All Downloaded</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{tracks.length}</span>
              </div>

              {playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className={`playlist-item ${activePlaylistId === playlist.id ? 'active' : ''}`}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: activePlaylistId === playlist.id ? 'rgba(255, 159, 28, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: activePlaylistId === playlist.id ? '1px solid var(--amber)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActivePlaylistId(playlist.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <ListMusic size={16} color="var(--amber)" />
                    <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {playlist.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{playlist.trackIds?.length || 0}</span>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlaylist(playlist.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tracks List Right Panel */}
          <div className="glass-card" style={{
            padding: '24px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 159, 28, 0.15)',
            background: 'rgba(10, 9, 12, 0.5)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0
              }}>
                <Music size={20} color="var(--amber)" />
                {activePlaylistId 
                  ? `${playlists.find(p => p.id === activePlaylistId)?.name || 'Playlist'} Tracks`
                  : 'Downloaded Tracks'}
              </h3>

              {/* Search Bar */}
              <input
                type="text"
                className="input-field"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: '#111015', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            {filteredTracks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredTracks.map((track) => {
                  const isCurrent = activeTrack && activeTrack.id === track.id;
                  const isTrackPlaying = isCurrent && isPlaying;
                  
                  return (
                    <div
                      key={track.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.2s ease',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                          <img decoding="async" loading="lazy"
                            src={track.album_art_url || '/static/img/default_art.png'}
                            alt={track.track_name}
                            style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.5)',
                              border: 'none',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              opacity: isCurrent ? 1 : 0,
                              transition: 'opacity 0.2s ease',
                              color: '#fff'
                            }}
                            className="play-hover-btn"
                            onClick={() => handlePlayTrack(track)}
                          >
                            {isTrackPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" />}
                          </button>
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: isCurrent ? 'var(--amber)' : '#fff',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden'
                          }}>
                            {track.track_name}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-3)',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden'
                          }}>
                            {track.artist}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Add to Playlist select */}
                        {playlists.length > 0 && (
                          <select
                            style={{
                              background: '#151419',
                              border: '1px solid rgba(255, 159, 28, 0.15)',
                              color: 'var(--text-2)',
                              padding: '6px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              maxWidth: '120px'
                            }}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddTrackToPlaylist(track.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Add to playlist...</option>
                            {playlists.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}

                        {activePlaylistId && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{
                              padding: '6px 10px',
                              fontSize: '12px',
                              borderRadius: '12px',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'rgba(255,255,255,0.6)'
                            }}
                            onClick={() => handleRemoveTrackFromPlaylist(track.id, activePlaylistId)}
                          >
                            Remove
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            padding: '8px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            color: 'var(--red)'
                          }}
                          onClick={() => handleDeleteTrack(track.id)}
                          title="Delete from device storage"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--text-3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '32px' }}>🎵</div>
                <div style={{ fontWeight: 600 }}>No tracks here yet</div>
                <div style={{ fontSize: '13px', maxWidth: '320px', lineHeight: 1.5 }}>
                  {activePlaylistId 
                    ? 'Add downloaded tracks to this playlist using the dropdown next to any track.'
                    : 'No tracks downloaded or match search criteria.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Offline Music Player Bottom Bar */}
      {activeTrack && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(10, 9, 12, 0.9)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 159, 28, 0.2)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          zIndex: 9999,
          boxShadow: '0 -8px 42px rgba(0,0,0,0.5)'
        }}>
          {/* Left: Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px', maxWidth: '300px', overflow: 'hidden' }}>
            <img decoding="async" loading="lazy"
              src={activeTrack.album_art_url || '/static/img/default_art.png'}
              alt={activeTrack.track_name}
              style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {activeTrack.track_name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {activeTrack.artist}
              </div>
            </div>
          </div>

          {/* Center: Controls & Seek */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: filteredTracks.length <= 1 ? 0.3 : 1 }}
                onClick={handlePrev}
                disabled={filteredTracks.length <= 1}
              >
                <SkipBack size={18} fill="#fff" />
              </button>
              
              <button
                type="button"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--amber)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#08080a'
                }}
                onClick={handleTogglePlay}
              >
                {isPlaying ? <Pause size={18} fill="#08080a" /> : <Play size={18} fill="#08080a" style={{ marginLeft: '2px' }} />}
              </button>

              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: filteredTracks.length <= 1 ? 0.3 : 1 }}
                onClick={handleNext}
                disabled={filteredTracks.length <= 1}
              >
                <SkipForward size={18} fill="#fff" />
              </button>
            </div>

            {/* Seek Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', minWidth: '32px', textAlign: 'right' }}>
                {formatTime(positionMs)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={handleSeek}
              >
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${durationMs > 0 ? (positionMs / durationMs) * 100 : 0}%`,
                  background: 'var(--amber)',
                  borderRadius: '2px'
                }} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', minWidth: '32px' }}>
                {formatTime(durationMs || activeTrack.duration_ms)}
              </span>
            </div>
          </div>

          {/* Right: Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px', justifyContent: 'flex-end' }}>
            <Volume2 size={16} color="var(--text-3)" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{
                width: '80px',
                accentColor: 'var(--amber)',
                cursor: 'pointer',
                height: '4px'
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Dialog for Playlist Creation */}
      {showCreatePlaylistModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 9, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setShowCreatePlaylistModal(false)}>
          <div style={{
            background: 'var(--bg-base, #111015)',
            border: '1px solid rgba(255, 159, 28, 0.2)',
            borderRadius: '24px',
            padding: '32px',
            width: 'calc(100% - 32px)',
            maxWidth: '400px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '16px'
            }}>Create Playlist</h3>
            
            <input
              type="text"
              className="input-field"
              style={{
                width: '100%',
                marginBottom: '24px',
                background: '#151419',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '12px 16px',
                borderRadius: '12px',
                color: '#fff'
              }}
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePlaylist();
              }}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCreatePlaylistModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
