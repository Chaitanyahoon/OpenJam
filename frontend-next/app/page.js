'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/contexts/SocketContext';
import HeroSection from '@/components/HeroSection';
import RoomCard from '@/components/RoomCard';
import YouTubePlayer from '@/utils/YouTubePlayer';
import dynamic from 'next/dynamic';
import PillNav from '@/components/PillNav';
import VolumeIcon from '@/components/VolumeIcon';
import { FALLBACK_DISCOVERY_TRACKS } from '@/constants/tracks';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';


const JoinModal = dynamic(() => import('@/components/modals/JoinModal'), { ssr: false });
const CreateRoomModal = dynamic(() => import('@/components/modals/CreateRoomModal'), { ssr: false });
const LeaveModal = dynamic(() => import('@/components/modals/LeaveModal'), { ssr: false });
const MusicPill = dynamic(() => import('@/components/MusicPill'), { ssr: false });



export default function HomePage() {
  const { isConnected } = useSocket();

  // Authentication & User States
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);

  // Preview Player States
  const [activePreview, setActivePreview] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(60);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewPositionMs, setPreviewPositionMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  const previewPlayerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenreFilter, setActiveGenreFilter] = useState(null);

  // Compute tracks for DomeGallery dynamically
  const computedDomeTracks = useMemo(() => {
    // 1. Extract tracks currently playing in active rooms
    const activeRoomTracks = rooms
      .filter((r) => r.current_track?.album_art_url)
      .map((r) => ({
        src: r.current_track.album_art_url,
        alt: `${r.current_track.track_name} playing in ${r.name}`,
        trackName: r.current_track.track_name,
        artist: r.current_track.artist,
        trackUri: r.current_track.track_uri,
        genre: r.genre_tags?.[0] || 'live',
        roomId: r.id,
        roomName: r.name
      }));

    // 2. Filter active tracks by activeGenreFilter if set
    let filteredActive = activeRoomTracks;
    if (activeGenreFilter) {
      filteredActive = activeRoomTracks.filter((t) => 
        t.genre.toLowerCase() === activeGenreFilter.toLowerCase()
      );
    }

    // 3. Filter fallback tracks by activeGenreFilter if set
    let filteredFallback = FALLBACK_DISCOVERY_TRACKS;
    if (activeGenreFilter) {
      filteredFallback = FALLBACK_DISCOVERY_TRACKS.filter((t) => 
        t.genre.toLowerCase() === activeGenreFilter.toLowerCase()
      );
    }

    // If no fallback tracks match the filter, use all fallback tracks
    if (filteredFallback.length === 0) {
      filteredFallback = FALLBACK_DISCOVERY_TRACKS;
    }

    // 4. Combine them (active room tracks take precedence)
    const combined = [...filteredActive, ...filteredFallback];

    // De-duplicate by trackUri
    const unique = [];
    const seen = new Set();
    for (const track of combined) {
      if (!seen.has(track.trackUri)) {
        seen.add(track.trackUri);
        unique.push(track);
      }
    }
    return unique;
  }, [rooms, activeGenreFilter]);

  // Modals Toggles
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [openCreateAfterJoin, setOpenCreateAfterJoin] = useState(false);

  // Form Inputs
  const [guestName, setGuestName] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createMode, setCreateMode] = useState('open');
  const [createPrivate, setCreatePrivate] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [selectedTags, setSelectedTags] = useState(new Set());

  // Shuffler & Submission states
  const [isShuffling, setIsShuffling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [currentYear, setCurrentYear] = useState(2026);
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Sync preview player volume
  useEffect(() => {
    if (previewPlayerRef.current) {
      previewPlayerRef.current.setVolume(previewMuted ? 0 : previewVolume);
    }
  }, [previewVolume, previewMuted]);

  // Clean up preview player on unmount
  useEffect(() => {
    return () => {
      if (previewPlayerRef.current) {
        previewPlayerRef.current.destroy();
        previewPlayerRef.current = null;
      }
    };
  }, []);

  const shufflerAudioCtxRef = useRef(null);

  // Ambient theme color (static amber)
  const amberColor = '#ffb03a';

  // Cursor glow follower
  const cursorGlowRef = useRef(null);
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

  // Filter & Search
  const filteredRooms = rooms.filter((r) => {
    const matchQuery =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.genre_tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGenre = !activeGenreFilter || (r.genre_tags || []).includes(activeGenreFilter);
    return matchQuery && matchGenre;
  });

  const dynamicFilterGenres = Array.from(
    new Set(rooms.reduce((acc, curr) => acc.concat(curr.genre_tags || []), []))
  ).sort();
  const publicRooms = rooms.filter((room) => !room.is_private).length;
  const privateRooms = rooms.length - publicRooms;
  const totalListeners = rooms.reduce((sum, room) => sum + (room.listener_count || 0), 0);

  // Helpers
  const triggerToast = (msg, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, text: msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const nameColor = (n) => {
    let h = 0;
    for (let i = 0; i < (n || '').length; i++) {
      h = n.charCodeAt(i) + ((h << 5) - h);
    }
    return `hsl(${Math.abs(h) % 360}, 60%, 55%)`;
  };

  const getInitials = (n) => (n || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const generateRandomName = () => {
    const prefixes = ['Vinyl', 'Acid', 'Neon', 'Strobe', 'Signal', 'Fader', 'Beat', 'Groove', 'Tempo', 'Decibel', 'Echo', 'Sonic', 'Analog', 'Synth'];
    const suffixes = ['Jammer', 'Listener', 'Drifter', 'Pulse', 'Wave', 'Mixer', 'Seeker', 'Beats', 'Vibe', 'Rhythm', 'Waveform'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${p}${s}${num}`;
  };

  // Dynamic Navigation Items for PillNav
  const navItems = useMemo(() => {
    const list = [
      { label: 'Home', href: '/' },
      { label: 'Rooms', href: '#active-rooms' }
    ];

    if (!me) {
      list.push({
        label: 'Join Jam',
        href: '#join',
        onClick: (e) => {
          e.preventDefault();
          setShowJoinModal(true);
        }
      });
    } else {
      // User Profile Pill (shows avatar and name)
      const userLabel = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {me.avatar_url ? (
            <img 
              src={me.avatar_url} 
              alt={me.display_name} 
              style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid var(--amber)' }} 
            />
          ) : (
            <span style={{ 
              width: '18px', 
              height: '18px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--amber)', 
              color: 'var(--bg-base)', 
              fontSize: '9px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 800
            }}>
              {getInitials(me.display_name)}
            </span>
          )}
          <span>{me.display_name}</span>
        </span>
      );

      list.push({
        label: userLabel,
        href: '#leave',
        ariaLabel: `Leave session for ${me.display_name}`,
        onClick: (e) => {
          e.preventDefault();
          setShowLeaveModal(true);
        }
      });

      list.push({
        label: 'Create Jam',
        href: '#create',
        onClick: (e) => {
          e.preventDefault();
          setShowCreateModal(true);
        }
      });
    }

    return list;
  }, [me]);



  // Auth
  const checkAuth = async () => {
    try {
      const r = await fetch('/auth/me', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setMe(data.user);
        if (data.user) {
          localStorage.setItem('openjam_display_name', data.user.display_name);
          if (data.user.avatar_url) {
            localStorage.setItem('openjam_avatar_url', data.user.avatar_url);
          }
        }
        return data.user;
      }
    } catch (e) {
      console.error('Error fetching auth:', e);
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('openjam_display_name') : null;
    if (stored) {
      try {
        const r2 = await fetch('/auth/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: stored }),
          credentials: 'include'
        });
        if (r2.ok) {
          const data = await r2.json();
          setMe(data.user);
          return data.user;
        }
      } catch (e) {
        console.error('Error joining as stored guest:', e);
      }
    }
    return null;
  };

  const loadRooms = async () => {
    try {
      const r = await fetch('/rooms', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Error loading rooms:', e);
    }
  };

  useEffect(() => {
    checkAuth();
    loadRooms();

    let intervalId = setInterval(loadRooms, 15000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        if (document.hidden) {
          clearInterval(intervalId);
        } else {
          loadRooms();
          intervalId = setInterval(loadRooms, 15000);
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (shufflerAudioCtxRef.current) {
        shufflerAudioCtxRef.current.close();
      }
    };
  }, []);

  // Discord error parsing on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const discordError = urlParams.get('error');
    if (discordError) {
      const errorMessages = {
        'discord_no_code': 'Discord login was cancelled.',
        'discord_not_configured': 'Discord login is not configured on this server.',
        'discord_token_failed': 'Failed to authenticate with Discord. Please try again.',
        'discord_no_token': 'Discord did not provide an access token.',
        'discord_user_failed': 'Failed to fetch Discord profile.',
        'discord_error': 'Discord login failed. Please try again.',
      };
      triggerToast(errorMessages[discordError] || 'Login failed.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Unregister any legacy service workers to prevent loading/caching conflicts
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
            .then((success) => {
              if (success) console.log('[serviceWorker] unregistered legacy SW');
            });
        }
      });
    }
  }, []);

  // Audio blip for name shuffler
  const playShufflerBlip = (pitch) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!shufflerAudioCtxRef.current) {
        shufflerAudioCtxRef.current = new AudioContextClass();
      }
      const ctx = shufflerAudioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, now + 0.06);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  };

  const handleRollGuestName = () => {
    if (isShuffling) return;
    setIsShuffling(true);
    let iterations = 0;
    const maxIterations = 8;
    const interval = setInterval(() => {
      setGuestName(generateRandomName());
      playShufflerBlip(250 + iterations * 60);
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        setGuestName(generateRandomName());
        setIsShuffling(false);
        playShufflerBlip(780);
      }
    }, 100);
  };

  // Action handlers
  const handleJoinGuest = async (e) => {
    e?.preventDefault();
    const name = guestName.trim();
    if (!name) return triggerToast('Name is required', 'error');
    setIsSubmitting(true);
    try {
      const r = await fetch('/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name }),
        credentials: 'include'
      });
      if (r.ok) {
        const data = await r.json();
        setMe(data.user);
        localStorage.setItem('openjam_display_name', data.user.display_name);
        setShowJoinModal(false);
        triggerToast(`Welcome, ${data.user.display_name}!`, 'success');
        if (openCreateAfterJoin) {
          setShowCreateModal(true);
          setOpenCreateAfterJoin(false);
        }
      } else {
        throw new Error('Failed to join guest session');
      }
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return triggerToast('Room name is required', 'error');
    if (createPrivate && !createPassword.trim()) {
      return triggerToast('Password is required for private room', 'error');
    }
    setIsSubmitting(true);
    try {
      const r = await fetch('/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: createDesc.trim(),
          genre_tags: Array.from(selectedTags),
          queue_mode: createMode,
          password: createPrivate ? createPassword.trim() : null
        }),
        credentials: 'include'
      });
      if (r.ok) {
        const data = await r.json();
        window.location.href = `/room/${data.room.id}?created=true`;
      } else {
        const err = await r.json();
        throw new Error(err.detail || 'Failed to create room');
      }
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('openjam_display_name');
    localStorage.removeItem('openjam_avatar_url');
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    window.location.reload();
  };

  const handleInstantJam = async () => {
    let currentUser = me;
    if (!currentUser) {
      const randomName = generateRandomName();
      triggerToast(`⚡ Instant Jam: Entering as ${randomName}...`, 'info');
      try {
        const r = await fetch('/auth/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: randomName }),
          credentials: 'include'
        });
        if (r.ok) {
          const data = await r.json();
          currentUser = data.user;
          setMe(data.user);
          localStorage.setItem('openjam_display_name', randomName);
        } else {
          triggerToast('Failed to join guest session', 'error');
          return;
        }
      } catch (err) {
        triggerToast('Failed to join guest session', 'error');
        return;
      }
    }
    if (rooms.length > 0) {
      const sorted = [...rooms].sort((a, b) => (b.listener_count || 0) - (a.listener_count || 0));
      const targetRoom = sorted.find(r => !r.is_private) || sorted[0];
      triggerToast(`⚡ Joining: ${targetRoom.name}`, 'success');
      setTimeout(() => { window.location.href = `/room/${targetRoom.id}`; }, 800);
    } else {
      triggerToast(`⚡ Creating a new Quick Jam room...`, 'info');
      const roomNames = ['Neon Lounge', 'Retro Beatcave', 'Analog Space', 'Echo Chamber', 'Decibel Oasis', 'Strobe Sanctuary'];
      const rName = roomNames[Math.floor(Math.random() * roomNames.length)] + ' #' + Math.floor(Math.random() * 90 + 10);
      try {
        const r = await fetch('/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: rName,
            description: '⚡ 1-Click Instant Jam. Welcome, come queue music and chill!',
            genre_tags: ['chill', 'lofi'],
            queue_mode: 'open',
            password: null
          }),
          credentials: 'include'
        });
        if (r.ok) {
          const data = await r.json();
          setTimeout(() => { window.location.href = `/room/${data.room.id}?created=true`; }, 800);
        } else {
          triggerToast('Failed to create quick room', 'error');
        }
      } catch (err) {
        triggerToast('Failed to create quick room', 'error');
      }
    }
  };

  const toggleTag = (tag) => {
    const updated = new Set(selectedTags);
    if (updated.has(tag)) {
      updated.delete(tag);
    } else {
      if (updated.size >= 3) return triggerToast('Max 3 tags allowed', 'error');
      updated.add(tag);
    }
    setSelectedTags(updated);
  };

  const handlePlayPreview = (track) => {
    if (activePreview && activePreview.trackUri === track.trackUri) {
      handleTogglePreviewPlay();
      return;
    }
    setActivePreview(track);
    setIsPlayingPreview(true);
    setPreviewPositionMs(0);
    setPreviewDurationMs(0);
    if (!previewPlayerRef.current) {
      previewPlayerRef.current = new YouTubePlayer({
        onProgressUpdate: (pos, dur, playing) => {
          setPreviewPositionMs(pos);
          setPreviewDurationMs(dur);
          setIsPlayingPreview(playing);
        },
        toast: (msg, type) => triggerToast(msg, type),
      });
    }
    previewPlayerRef.current.setTrack({
      track_uri: track.trackUri,
      track_name: track.trackName,
      artist: track.artist,
      album_art_url: track.src,
      is_playing: true,
      position_ms: 0,
      duration_ms: 240000
    });
    previewPlayerRef.current.setVolume(previewMuted ? 0 : previewVolume);
  };

  const handleTogglePreviewPlay = () => {
    if (!previewPlayerRef.current) return;
    const nextState = !isPlayingPreview;
    setIsPlayingPreview(nextState);
    previewPlayerRef.current.setPlayState(nextState);
  };

  const handlePrevPreviewJump = () => {
    if (previewPlayerRef.current) {
      const nextTime = Math.max(0, previewPositionMs - 5000);
      previewPlayerRef.current.syncPosition(nextTime, isPlayingPreview);
      setPreviewPositionMs(nextTime);
    }
  };

  const handleNextPreviewJump = () => {
    if (previewPlayerRef.current) {
      const nextTime = Math.min(previewDurationMs, previewPositionMs + 5000);
      previewPlayerRef.current.syncPosition(nextTime, isPlayingPreview);
      setPreviewPositionMs(nextTime);
    }
  };

  const handleSeekPreview = (e) => {
    if (!previewDurationMs || !previewPlayerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newPositionMs = Math.floor(percentage * previewDurationMs);
    previewPlayerRef.current.syncPosition(newPositionMs, isPlayingPreview);
    setPreviewPositionMs(newPositionMs);
  };

  const handleClosePreview = () => {
    if (previewPlayerRef.current) {
      previewPlayerRef.current.stop();
    }
    setActivePreview(null);
    setIsPlayingPreview(false);
    setPreviewPositionMs(0);
    setPreviewDurationMs(0);
  };

  const handleCreateRoomWithPreviewTrack = () => {
    if (!me) {
      setOpenCreateAfterJoin(true);
      setShowJoinModal(true);
      triggerToast('Please sign in or enter a guest name first', 'info');
    } else {
      setCreateName(`${activePreview.trackName} Jam`);
      setShowCreateModal(true);
    }
  };

  return (
    <div className="landing-wrapper">

      {/* Cursor follower ambient glow */}
      <div 
        ref={cursorGlowRef}
        className="cursor-glow" 
        style={{
          left: '-1000px',
          top: '-1000px',
          background: `radial-gradient(circle, ${amberColor}1c 0%, rgba(0,0,0,0) 65%)`
        }}
        aria-hidden="true"
      />

      {/* Toast */}
      <div className="toast-stack">
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
              {toast.type === 'success' && <CheckCircle size={18} className="toast-icon" />}
              {toast.type === 'error' && <AlertCircle size={18} className="toast-icon" />}
              {toast.type === 'warning' && <AlertTriangle size={18} className="toast-icon" />}
              {toast.type === 'info' && <Info size={18} className="toast-icon" />}
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Ambient background */}
      <div className="landing-bg-glows" aria-hidden="true">
        <div className="glow-1" style={{ background: `radial-gradient(circle, ${amberColor}1e 0%, rgba(0,0,0,0) 65%)` }} />
        <div className="glow-2" style={{ background: `radial-gradient(circle, ${amberColor}16 0%, rgba(0,0,0,0) 65%)` }} />
      </div>

      {/* NAVBAR */}
      <PillNav
        logo="/static/img/logo.png"
        logoAlt="OpenJam Logo"
        items={navItems}
      />

      {/* HERO */}
      <HeroSection
        me={me}
        onInstantJam={handleInstantJam}
        onDiscordLogin={() => { window.location.href = '/auth/discord'; }}
        onJoinGuest={() => setShowJoinModal(true)}
        onCreateRoom={() => setShowCreateModal(true)}
        rooms={rooms}
        onPlayPreview={handlePlayPreview}
        domeTracks={computedDomeTracks}
        activePreview={activePreview}
        isPlayingPreview={isPlayingPreview}
      />

      <motion.section
        id="active-rooms"
        className="rooms-section"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="rooms-section-header">
          <div className="rooms-section-heading-group">
            <h2 className="rooms-section-title">
              <span className="section-live-dot" aria-hidden="true" /> Active Listening Rooms
            </h2>
            <p className="rooms-section-subtitle">
              Filter by genre, scan who is hosting, and jump straight into a live queue.
            </p>
          </div>
          <div className="rooms-header-meta">
            <span className="rooms-count">
              {rooms.length} room{rooms.length !== 1 ? 's' : ''}
            </span>
            <span className={`connection-chip ${isConnected ? 'online' : 'offline'}`}>
              {isConnected ? 'Live updates on' : 'Offline fallback'}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="search-wrap">
          <div className="input-with-icon">
            <span className="icon-prefix">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </span>
            <input
              type="text"
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms or genres..."
              autoComplete="off"
            />
          </div>
          <div className="rooms-toolbar-meta">
            <span className="results-copy">
              Showing {filteredRooms.length} result{filteredRooms.length !== 1 ? 's' : ''}
              {activeGenreFilter ? ` in ${activeGenreFilter}` : ''}
              {searchQuery ? ` for "${searchQuery}"` : ''}
            </span>
            {(searchQuery || activeGenreFilter) && (
              <button
                type="button"
                className="btn btn-ghost btn-toolbar-clear"
                onClick={() => {
                  setSearchQuery('');
                  setActiveGenreFilter(null);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Genre filter chips */}
        {dynamicFilterGenres.length > 0 && (
          <div className="genre-filters">
            <motion.button
              className={`genre-chip ${!activeGenreFilter ? 'active' : ''}`}
              onClick={() => setActiveGenreFilter(null)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              All
            </motion.button>
            {dynamicFilterGenres.map((genre) => (
              <motion.button
                key={genre}
                className={`genre-chip ${activeGenreFilter === genre ? 'active' : ''}`}
                onClick={() => setActiveGenreFilter(genre)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                layout
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                {activeGenreFilter === genre && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    background: 'var(--amber)',
                    borderRadius: '50%',
                    marginRight: '6px',
                    display: 'inline-block',
                    boxShadow: '0 0 8px var(--amber)'
                  }} />
                )}
                {genre}
              </motion.button>
            ))}
          </div>
        )}

        {/* Room cards grid */}
        <AnimatePresence mode="popLayout">
          {filteredRooms.length > 0 ? (
            <motion.div className="rooms-grid" layout>
              {filteredRooms.map((r, i) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  nameColor={nameColor}
                  getInitials={getInitials}
                  href={`/room/${r.id}`}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="empty"
              style={{ display: 'flex' }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="empty-illustration">
                <div className="empty-vinyl">
                  <div className="vinyl-disc" />
                  <div className="vinyl-label" />
                </div>
              </div>
              <div className="empty-title">No active rooms right now</div>
              <div className="empty-sub">
                Be the first to start a listening session and invite your friends!
              </div>
              <motion.button
                className="btn btn-primary"
                onClick={() => {
                  if (me) setShowCreateModal(true);
                  else {
                    setOpenCreateAfterJoin(true);
                    setShowJoinModal(true);
                  }
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Create First Room
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>



      {/* FOOTER */}
      <footer className="footer footer-landing">
        <div className="footer-links-row">
          <Link href="/privacy" className="footer-link">Privacy Policy</Link>
          <span className="footer-sep" aria-hidden="true">&middot;</span>
          <Link href="/terms" className="footer-link">Terms of Service</Link>
        </div>
        <p className="footer-copy">&copy; {currentYear} OpenJam. All rights reserved.</p>
      </footer>

      {/* Floating Preview Control Bar */}
      <AnimatePresence>
        {activePreview && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              zIndex: 999,
              width: 'calc(100% - 32px)',
              maxWidth: '440px'
            }}
          >
            <MusicPill
              activePreview={activePreview}
              isPlaying={isPlayingPreview}
              positionMs={previewPositionMs}
              durationMs={previewDurationMs}
              onTogglePlay={handleTogglePreviewPlay}
              onPrev={handlePrevPreviewJump}
              onNext={handleNextPreviewJump}
              onSeek={handleSeekPreview}
              onClose={handleClosePreview}
              onCreateRoom={handleCreateRoomWithPreviewTrack}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      <JoinModal
        show={showJoinModal}
        onClose={() => { setShowJoinModal(false); setOpenCreateAfterJoin(false); }}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        onRoll={handleRollGuestName}
        isShuffling={isShuffling}
        onSubmit={handleJoinGuest}
        isSubmitting={isSubmitting}
        onDiscordLogin={() => { window.location.href = '/auth/discord'; }}
      />

      <CreateRoomModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        createName={createName} onCreateNameChange={setCreateName}
        createDesc={createDesc} onCreateDescChange={setCreateDesc}
        createMode={createMode} onCreateModeChange={setCreateMode}
        createPrivate={createPrivate} onCreatePrivateChange={setCreatePrivate}
        createPassword={createPassword} onCreatePasswordChange={setCreatePassword}
        selectedTags={selectedTags} onToggleTag={toggleTag}
        onSubmit={handleCreateRoom}
        isSubmitting={isSubmitting}
        triggerToast={triggerToast}
        prefilledTrack={activePreview}
      />

      <LeaveModal
        show={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
