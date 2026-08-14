'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, Play, Pause, ArrowLeft, Disc, Share2, 
  Plus, Users, Volume2, VolumeX, ListMusic, Globe, Lock, Heart, X
} from 'lucide-react';
import { PlaylistSkeleton } from '@/components/SkeletonLoaders';

export default function PlaylistClient() {
  const params = useParams();
  const playlistId = params?.id;

  const [playlist, setPlaylist] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [likes, setLikes] = useState([]);
  const [isPlaylistLiked, setIsPlaylistLiked] = useState(false);

  // Preview player states
  const [activePreview, setActivePreview] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [volume, setVolume] = useState(60);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef(null);

  // Dropdown states
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (text, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const loadData = async () => {
    try {
      // Fetch user profile
      const meRes = await fetch('/auth/me', { credentials: 'include' });
      let isRegistered = false;
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setMe(meData.user);
          isRegistered = meData.user.is_registered;
        }
      }

      // Fetch likes if registered
      if (isRegistered) {
        const likesRes = await fetch('/likes', { credentials: 'include' });
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          setLikes(likesData.likes || []);
        }

        try {
          const likedPlaylistsRes = await fetch('/playlists/liked', { credentials: 'include' });
          if (likedPlaylistsRes.ok) {
            const likedPlaylistsData = await likedPlaylistsRes.json();
            const likedList = likedPlaylistsData.playlists || [];
            setIsPlaylistLiked(likedList.some((p) => p.id === playlistId));
          }
        } catch (err) {
          console.warn("Failed to load liked playlists:", err);
        }
      }

      // Fetch playlist
      const playRes = await fetch(`/playlists/${playlistId}`, { credentials: 'include' });
      if (!playRes.ok) {
        if (playRes.status === 403) {
          setError('This playlist is private');
        } else {
          setError('Playlist not found');
        }
        setLoading(false);
        return;
      }
      const playData = await playRes.json();
      setPlaylist(playData.playlist);

      // Fetch active rooms
      const roomsRes = await fetch('/rooms');
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData.rooms || []);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Connection error');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playlistId && playlistId !== 'loading') {
      loadData();
    }
  }, [playlistId]);

  const handleLikeToggle = async (track) => {
    if (!me || !me.is_registered) {
      addToast('Please sign in with Discord to save liked songs!', 'warning');
      return;
    }

    const isLiked = likes.some((l) => l.track_uri === track.track_uri);

    try {
      if (isLiked) {
        const res = await fetch(`/likes?track_uri=${encodeURIComponent(track.track_uri)}`, { method: 'DELETE' });
        if (res.ok) {
          setLikes(likes.filter((l) => l.track_uri !== track.track_uri));
          addToast('Removed from liked songs', 'success');
        } else {
          addToast('Failed to unlike song', 'error');
        }
      } else {
        const res = await fetch('/likes', {
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
          const data = await res.json();
          setLikes([...likes, data.like]);
          addToast('Added to liked songs!', 'success');
        } else {
          addToast('Failed to like song', 'error');
        }
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handlePlaylistLikeToggle = async () => {
    if (!me || !me.is_registered) {
      addToast('Please sign in with Discord to save playlists!', 'warning');
      return;
    }
    
    try {
      if (isPlaylistLiked) {
        const res = await fetch(`/playlists/${playlistId}/like`, { method: 'DELETE' });
        if (res.ok) {
          setIsPlaylistLiked(false);
          addToast('Removed playlist from library', 'success');
        } else {
          addToast('Failed to unlike playlist', 'error');
        }
      } else {
        const res = await fetch(`/playlists/${playlistId}/like`, { method: 'POST' });
        if (res.ok) {
          setIsPlaylistLiked(true);
          addToast('Saved playlist to library!', 'success');
        } else {
          addToast('Failed to save playlist', 'error');
        }
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handlePlayPreview = async (track) => {
    if (activePreview?.id === track.id) {
      if (isPlayingPreview) {
        audioRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlayingPreview(true);
      }
      return;
    }

    setActivePreview(track);
    setIsPlayingPreview(true);

    let videoId = track.track_uri;

    // Check if the track_uri is a valid 11-character YouTube video ID
    const isVideoId = /^[a-zA-Z0-9_-]{11}$/.test(videoId);
    if (!isVideoId) {
      try {
        const resolveRes = await fetch(`/search/resolve?q=${encodeURIComponent(videoId)}`);
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.video_id) {
            videoId = resolveData.video_id;
          }
        }
      } catch (err) {
        console.error("Failed to resolve track URI:", err);
      }
    }

    // Stream URL from our backend stream proxy
    const streamUrl = `/stream/${videoId}`;

    if (audioRef.current) {
      audioRef.current.src = streamUrl;
      audioRef.current.load();
      audioRef.current.play().catch((err) => {
        console.error("Audio playback error:", err);
        addToast("Preview playback failed. Upstream stream resolution error.", "error");
        setIsPlayingPreview(false);
      });
    }
  };

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  const handleQueueInRoom = async (roomId, roomName) => {
    if (!playlist?.tracks || playlist.tracks.length === 0) return;
    try {
      const tracksPayload = playlist.tracks.map((t) => ({
        track_uri: t.track_uri,
        track_name: t.track_name,
        artist: t.artist,
        album_art_url: t.album_art_url,
        duration_ms: t.duration_ms
      }));

      const res = await fetch(`/rooms/${roomId}/queue/multiple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracksPayload)
      });

      if (res.ok) {
        const data = await res.json();
        addToast(`Successfully queued ${data.added_count} tracks in room: ${roomName}`, 'success');
        setShowRoomDropdown(false);
      } else {
        const data = await res.json();
        addToast(data.detail || 'Failed to queue tracks', 'error');
      }
    } catch (err) {
      addToast('Connection error', 'error');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast('Playlist share link copied!', 'success');
  };

  if (loading) {
    return <PlaylistSkeleton />;
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
        <Disc size={64} color="#555" style={{ marginBottom: '24px' }} />
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px' }}>{error}</h1>
        <p style={{ color: '#666', maxWidth: '400px', marginBottom: '32px', lineHeight: '1.6' }}>
          This link might be incorrect or the creator has made the playlist private.
        </p>
        <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #16151c 0%, #08080a 70%)',
      color: '#fff',
      fontFamily: 'var(--font-sans), sans-serif',
      padding: '40px 24px',
      position: 'relative'
    }}>
      {/* Hidden audio tag for preview player */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlayingPreview(false)}
        style={{ display: 'none' }}
      />

      {/* Toasts */}
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
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Navigation */}
        <div style={{ marginBottom: '32px' }}>
          <Link href="/" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#aaa', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to OpenJam Rooms
          </Link>
        </div>

        {/* Playlist Banner */}
        <div className="glass-card playlist-header-card" style={{
          padding: '32px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(30px)',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '40px'
        }}>
          <div className="playlist-header-cover" style={{
            width: '120px',
            height: '120px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--amber, #ff9f1c) 0%, #ff5500 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(255, 159, 28, 0.25)'
          }}>
            <ListMusic size={60} color="#fff" />
          </div>

          <div className="playlist-header-info" style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={14} color="#888" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared Playlist
              </span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', letterSpacing: '-0.02em' }}>{playlist?.name}</h1>
            <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
              Created by <span style={{ color: '#fff', fontWeight: 600 }}>{playlist?.creator_name}</span> • {playlist?.tracks?.length || 0} track{playlist?.tracks?.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="playlist-header-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {me && me.is_registered && playlist && playlist.creator_id !== me.id && (
              <button 
                className="btn btn-ghost" 
                onClick={handlePlaylistLikeToggle}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '12px 20px', 
                  borderRadius: '30px',
                  color: isPlaylistLiked ? 'var(--theme-accent, #ff9f1c)' : '#aaa',
                  border: isPlaylistLiked ? '1px solid rgba(255, 159, 28, 0.3)' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <Heart size={16} fill={isPlaylistLiked ? 'var(--theme-accent, #ff9f1c)' : 'none'} />
                {isPlaylistLiked ? 'Saved' : 'Save to Library'}
              </button>
            )}

            <button 
              className="btn btn-ghost" 
              onClick={handleCopyLink}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '30px' }}
            >
              <Share2 size={16} /> Copy Link
            </button>

            {/* Room Queue Trigger */}
            <div style={{ position: 'relative' }}>
              <button 
                className="btn btn-primary"
                onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '30px' }}
              >
                <Plus size={16} /> Play in Jam Room
              </button>

              <AnimatePresence>
                {showRoomDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      background: '#121216',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      padding: '12px',
                      width: '280px',
                      zIndex: 1000,
                      boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <h4 style={{ fontSize: '13px', color: '#666', fontWeight: 600, padding: '4px 8px 8px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      Select Active Jam Room
                    </h4>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                      {rooms.length === 0 ? (
                        <div style={{ padding: '16px 8px', color: '#555', fontSize: '13px', textAlign: 'center' }}>
                          No active rooms. Go back and create one first!
                        </div>
                      ) : (
                        rooms.map((room) => (
                          <button
                            key={room.id}
                            onClick={() => handleQueueInRoom(room.id, room.name)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'rgba(255,255,255,0.02)',
                              border: 'none',
                              color: '#fff',
                              textAlign: 'left',
                              fontSize: '13px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          >
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                              {room.name}
                            </span>
                            <span style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={12} /> {room.listener_count}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tracks List */}
        <div className="glass-card playlist-tracks-container" style={{
          padding: '24px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10, 9, 12, 0.4)',
          backdropFilter: 'blur(20px)'
        }}>
          {!playlist?.tracks || playlist.tracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
              <Music size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p style={{ fontSize: '15px' }}>This playlist has no tracks.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {playlist.tracks.map((track) => (
                <div
                  key={track.id}
                  className="playlist-track-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: activePreview?.id === track.id ? 'rgba(255, 159, 28, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: activePreview?.id === track.id ? 'rgba(255, 159, 28, 0.2)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    gap: '12px',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Play preview trigger */}
                  <button
                    onClick={() => handlePlayPreview(track)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: activePreview?.id === track.id && isPlayingPreview ? 'var(--amber, #ff9f1c)' : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {activePreview?.id === track.id && isPlayingPreview ? (
                      <Pause size={14} fill="#08080a" stroke="none" />
                    ) : (
                      <Play size={14} fill="#fff" stroke="none" style={{ marginLeft: '2px' }} />
                    )}
                  </button>

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

                  {/* Heart/Like Toggle */}
                  <button
                    onClick={() => handleLikeToggle(track)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: likes.some((l) => l.track_uri === track.track_uri) ? 'var(--amber, #ff9f1c)' : '#555',
                      cursor: 'pointer',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s ease'
                    }}
                    title={likes.some((l) => l.track_uri === track.track_uri) ? 'Unlike Track' : 'Like Track'}
                  >
                    <Heart 
                      size={16} 
                      fill={likes.some((l) => l.track_uri === track.track_uri) ? 'var(--amber, #ff9f1c)' : 'none'} 
                    />
                  </button>

                  <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                    {track.duration_ms ? (
                      `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`
                    ) : (
                      '--:--'
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mini Preview Player Bar (Stays on bottom if active) */}
      <AnimatePresence>
        {activePreview && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="playlist-preview-pill"
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '24px',
              right: '24px',
              zIndex: 1000,
              background: 'rgba(14, 14, 18, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '24px',
              padding: '16px 24px',
              backdropFilter: 'blur(30px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
              <button
                onClick={() => handlePlayPreview(activePreview)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--amber, #ff9f1c)',
                  border: 'none',
                  color: '#08080a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                {isPlayingPreview ? (
                  <Pause size={18} fill="#08080a" stroke="none" />
                ) : (
                  <Play size={18} fill="#08080a" stroke="none" style={{ marginLeft: '2px' }} />
                )}
              </button>

              <div style={{ minWidth: 0 }}>
                <h5 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Previewing: {activePreview.track_name}
                </h5>
                <p style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                  {activePreview.artist}
                </p>
              </div>
            </div>

            {/* Volume control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => setMuted(!muted)} 
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseInt(e.target.value));
                  setMuted(false);
                }}
                style={{
                  width: '100px',
                  accentColor: 'var(--amber, #ff9f1c)',
                  background: 'rgba(255,255,255,0.1)',
                  height: '4px',
                  borderRadius: '2px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              />
              <button
                onClick={() => {
                  setActivePreview(null);
                  setIsPlayingPreview(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: '#aaa',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa'; }}
                title="Dismiss Player"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
