'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSocket } from '@/contexts/SocketContext';
import StatsTicker from '@/components/StatsTicker';

// Import VinylPlayer dynamically to avoid server-side AudioContext and window errors
const VinylPlayer = dynamic(() => import('@/components/VinylPlayer'), { ssr: false });

export default function HomePage() {
  const { isConnected } = useSocket();

  // Authentication & User States
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenreFilter, setActiveGenreFilter] = useState(null);

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
  const [toastMsg, setToastMsg] = useState(null);

  const shufflerAudioCtxRef = useRef(null);

  const availableTags = [
    'indie', 'rock', 'pop', 'hip-hop', 'electronic', 'r&b',
    'jazz', 'classical', 'lofi', 'metal', 'latin', 'chill'
  ];

  // Show dynamic toast helper
  const triggerToast = (msg, type = 'info') => {
    setToastMsg({ text: msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const nameColor = (n) => {
    let h = 0;
    for (let i = 0; i < (n || '').length; i++) {
      h = n.charCodeAt(i) + ((h << 5) - h);
    }
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 60%, 55%)`;
  };

  const getInitials = (n) => {
    return (n || '?')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Random Name Generator List
  const generateRandomName = () => {
    const prefixes = ['Vinyl', 'Acid', 'Neon', 'Strobe', 'Signal', 'Fader', 'Beat', 'Groove', 'Tempo', 'Decibel', 'Echo', 'Sonic', 'Analog', 'Synth'];
    const suffixes = ['Jammer', 'Listener', 'Drifter', 'Pulse', 'Wave', 'Mixer', 'Seeker', 'Beats', 'Vibe', 'Rhythm', 'Waveform'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${p}${s}${num}`;
  };

  // 1. Initial Authentication Checks
  const checkAuth = async () => {
    try {
      const r = await fetch('/auth/me', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setMe(data.user);
        return data.user;
      }
    } catch (e) {
      console.error('Error fetching auth:', e);
    }

    // Fallback: Check if guest name is stored locally
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

  // 2. Fetch Active Rooms List
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

    // Start 15s rooms list polling loop
    let intervalId = setInterval(loadRooms, 15000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        loadRooms();
        intervalId = setInterval(loadRooms, 15000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (shufflerAudioCtxRef.current) {
        shufflerAudioCtxRef.current.close();
      }
    };
  }, []);

  // Retro Web Audio sound effect for name shuffler
  const playShufflerBlip = (pitch) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!shufflerAudioCtxRef.current) {
        shufflerAudioCtxRef.current = new AudioContextClass();
      }
      const ctx = shufflerAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

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
    } catch (e) {
      console.warn('Audio Context blip failed:', e);
    }
  };

  const handleRollGuestName = () => {
    if (isShuffling) return;
    setIsShuffling(true);

    let iterations = 0;
    const maxIterations = 8;
    const intervalTime = 100;

    const interval = setInterval(() => {
      const tempName = generateRandomName();
      setGuestName(tempName);

      const pitch = 250 + iterations * 60;
      playShufflerBlip(pitch);

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        const finalName = generateRandomName();
        setGuestName(finalName);
        setIsShuffling(false);
        playShufflerBlip(780);
      }
    }, intervalTime);
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
        window.location.href = `/room/${data.room.id}`;
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

  const toggleTag = (tag) => {
    const updated = new Set(selectedTags);
    if (updated.has(tag)) {
      updated.delete(tag);
    } else {
      if (updated.size >= 3) {
        return triggerToast('Max 3 tags allowed', 'error');
      }
      updated.add(tag);
    }
    setSelectedTags(updated);
  };

  // Filter & Search computation
  const filteredRooms = rooms.filter((r) => {
    const matchQuery =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.genre_tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchGenre = !activeGenreFilter || (r.genre_tags || []).includes(activeGenreFilter);

    return matchQuery && matchGenre;
  });

  // Extract dynamically unique tags for filtering chips
  const dynamicFilterGenres = Array.from(
    new Set(rooms.reduce((acc, curr) => acc.concat(curr.genre_tags || []), []))
  ).sort();

  return (
    <>
      {/* Dynamic Toast System */}
      {toastMsg && (
        <div className="toast-stack">
          <div className={`toast ${toastMsg.type}`}>{toastMsg.text}</div>
        </div>
      )}

      {/* Global Jam Statistics Ticker */}
      <StatsTicker rooms={rooms} />

      {/* Ambient background mesh */}
      <div className="landing-bg-glows" aria-hidden="true">
        <div className="glow-1"></div>
        <div className="glow-2"></div>
      </div>

      {/* NAVBAR */}
      <nav className="navbar" id="navbar">
        <a href="/" className="navbar-brand">
          <img className="navbar-icon" src="/static/img/logo.png" alt="OpenJam Logo" width="24" height="24" />
          <div className="navbar-logo">
            Open<span>Jam</span>
          </div>
        </a>
        <div className="navbar-right">
          {!me ? (
            <button className="btn btn-ghost" onClick={() => setShowJoinModal(true)}>
              Join Jam
            </button>
          ) : (
            <div className="navbar-user">
              {me.avatar_url ? (
                <div className="avatar avatar-sm" style={{ border: '2px solid #5865F2' }}>
                  <img src={me.avatar_url} alt={me.display_name} />
                </div>
              ) : (
                <div className="avatar avatar-sm">{getInitials(me.display_name)}</div>
              )}
              <span>{me.display_name}</span>
              <button className="btn btn-ghost" onClick={() => setShowLeaveModal(true)} title="Leave session">
                ✕
              </button>
            </div>
          )}
          {me && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              Create Jam
            </button>
          )}
        </div>
      </nav>

      {/* SPLIT HERO SECTION */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content-left">
            <div className="hero-badge">
              🎵 OPEN JAM V2
            </div>
            <h1 className="hero-title">
              Listen Together.
              <br />
              <span>In Sync.</span>
            </h1>

            <p className="hero-sub" id="hero-description">
              {me ? (
                me.avatar_url ? (
                  <>Welcome back! Logged in as <strong style={{ color: '#a5b4fc' }}>@{me.display_name}</strong> via Discord. Create a room below or join an active jam!</>
                ) : (
                  <>Welcome back! Logged in as <strong style={{ color: 'var(--amber)' }}>{me.display_name}</strong>. Create a room below or join an active jam!</>
                )
              ) : (
                "Social Listening, but make it classy. Create a listening room, queue tracks from YouTube, and discover music with friends in real-time."
              )}
            </p>

            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (me) {
                    setShowCreateModal(true);
                  } else {
                    setOpenCreateAfterJoin(true);
                    setShowJoinModal(true);
                  }
                }}
                id="btn-instant-jam"
              >
                ⚡ Instant Jam
              </button>

              {!me && (
                <>
                  <button
                    className="btn btn-discord btn-discord-cta"
                    onClick={() => { window.location.href = '/auth/discord'; }}
                  >
                    <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.1v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1 58.7 58.7 0 0018-9.1v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1-.1zM23.7 37c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7z" />
                    </svg>
                    Sign in with Discord
                  </button>
                  <button
                    className="btn btn-secondary btn-open-join-trigger"
                    onClick={() => setShowJoinModal(true)}
                  >
                    👋 Join as Guest
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Interactive Vinyl Showcase on Right */}
          <VinylPlayer />
        </div>
      </section>

      {/* ACTIVE ROOMS SECTION */}
      <section className="rooms-section">
        <div className="rooms-section-header">
          <h2 className="rooms-section-title">
            <span className="section-live-dot" aria-hidden="true"></span> Active Listening Rooms
          </h2>
          <span className="rooms-count">{rooms.length} room{rooms.length !== 1 ? 's' : ''}</span>
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
        </div>

        {/* Filter chips */}
        {dynamicFilterGenres.length > 0 && (
          <div className="genre-filters">
            <button
              className={`genre-chip ${!activeGenreFilter ? 'active' : ''}`}
              onClick={() => setActiveGenreFilter(null)}
            >
              All
            </button>
            {dynamicFilterGenres.map((genre) => (
              <button
                key={genre}
                className={`genre-chip ${activeGenreFilter === genre ? 'active' : ''}`}
                onClick={() => setActiveGenreFilter(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        )}

        {/* Room grid */}
        {filteredRooms.length > 0 ? (
          <div className="rooms-grid">
            {filteredRooms.map((r) => {
              const t = r.current_track;
              const coverUrl = t?.album_art_url || '/static/img/cover-banner.png';
              const trackName = t ? t.track_name : 'No track playing';
              const artistName = t ? t.artist : 'Idle Room';

              return (
                <div key={r.id} className="room-card" onClick={() => { window.location.href = `/room/${r.id}`; }}>
                  <div className="room-card-cover-wrap">
                    <img
                      className="room-card-cover-img"
                      src={coverUrl}
                      onError={(e) => { e.target.src = '/static/img/cover-banner.png'; }}
                      alt="Cover"
                    />
                    <div className="room-card-cover-overlay">
                      <div className={`room-card-badge ${r.is_private ? 'private' : 'live'}`}>
                        {r.is_private ? '🔒 Private' : '● Live'}
                      </div>
                      <div className="room-card-listeners">
                        <div className="listeners-dot"></div>
                        <span>{r.listener_count ?? 0}</span>
                      </div>
                      {t && (
                        <div className="room-card-eq-pill">
                          <div className="card-now-playing-equalizer">
                            <span></span><span></span><span></span><span></span>
                          </div>
                        </div>
                      )}
                      <div className="room-card-play-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="room-card-details">
                    <div className="room-card-tags">
                      {(r.genre_tags || []).slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-chip">{tag}</span>
                      ))}
                    </div>
                    <h3 className="room-card-title">{r.name}</h3>
                    <div className="room-card-host">
                      {r.host_avatar_url ? (
                        <img className="room-card-host-avatar" src={r.host_avatar_url} alt={r.host_name} />
                      ) : (
                        <div className="room-card-host-avatar-fallback" style={{ background: nameColor(r.host_name || 'Unknown') }}>
                          {getInitials(r.host_name || 'Unknown')}
                        </div>
                      )}
                      <span>Hosted by <strong>{r.host_name || 'Unknown'}</strong></span>
                    </div>
                  </div>

                  <div className="room-card-now-playing-banner">
                    <div className="banner-music-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                    <div className="banner-track-info">
                      <span className="banner-track-name">{trackName}</span>
                      <span className="banner-artist-name">{artistName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" id="empty-state" style={{ display: 'flex' }}>
            <div className="empty-illustration">
              <div className="empty-vinyl">
                <div className="vinyl-disc"></div>
                <div className="vinyl-label"></div>
              </div>
            </div>
            <div className="empty-title">No active rooms right now</div>
            <div className="empty-sub">Be the first to start a listening session and invite your friends!</div>
            <button className="btn btn-primary" onClick={() => {
              if (me) setShowCreateModal(true);
              else {
                setOpenCreateAfterJoin(true);
                setShowJoinModal(true);
              }
            }}>
              Create First Room
            </button>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="footer" style={{ textAlign: 'center', padding: '40px 24px', fontSize: '12px', color: 'var(--text-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
          <a href="/privacy" className="footer-link">Privacy Policy</a>
          <span className="footer-sep">&middot;</span>
          <a href="/terms" className="footer-link">Terms of Service</a>
        </div>
        <p>&copy; {new Date().getFullYear()} OpenJam. All rights reserved.</p>
      </footer>

      {/* JOIN / AUTH MODAL */}
      <div className={`modal-bg ${showJoinModal ? 'open' : ''}`}>
        <div className="modal-box">
          <div className="modal-header">
            <h2 className="modal-title">👋 Join OpenJam</h2>
            <button type="button" className="btn btn-ghost modal-close-btn" onClick={() => { setShowJoinModal(false); setOpenCreateAfterJoin(false); }}>✕</button>
          </div>
          
          {/* Discord Authentication */}
          <button
            type="button"
            className="btn btn-discord"
            style={{ width: '100%', marginBottom: '18px' }}
            onClick={() => { window.location.href = '/auth/discord'; }}
          >
            <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
              <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.1v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1 58.7 58.7 0 0018-9.1v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1-.1zM23.7 37c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7z" />
            </svg>
            Sign in with Discord
          </button>

          <div className="join-divider" style={{ marginBottom: '18px' }}>
            <span>or continue as guest</span>
          </div>

          <p className="modal-text-muted" style={{ marginBottom: '14px' }}>Pick a nickname to represent you, or roll a random one.</p>

          <form onSubmit={handleJoinGuest}>
            <div className="modal-field name-shuffler-field" style={{ marginBottom: '20px' }}>
              <input
                type="text"
                className="input-field"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. DJSpin, BassHead"
                maxLength="30"
                autoComplete="off"
                required
              />
              <button
                type="button"
                className="btn btn-secondary btn-shuffler"
                onClick={handleRollGuestName}
                disabled={isShuffling}
                style={{ height: '45px', padding: '0 16px' }}
              >
                {isShuffling ? '🎲 ...' : '🎲 Roll'}
              </button>
            </div>
            <div className="modal-actions-grid">
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
                {isSubmitting ? 'Joining...' : 'Enter Jam'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CREATE ROOM MODAL */}
      <div className={`modal-bg ${showCreateModal ? 'open' : ''}`}>
        <div className="modal-box">
          <div className="modal-header">
            <h2 className="modal-title">⚡ Start a New Jam</h2>
            <button type="button" className="btn btn-ghost modal-close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
          </div>
          <form onSubmit={handleCreateRoom}>
            <div className="modal-field">
              <label className="modal-label">Room Name *</label>
              <input
                type="text"
                className="input-field"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Late Night Lofi Lounge"
                maxLength="60"
                required
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Description</label>
              <input
                type="text"
                className="input-field"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What kind of vibe are we playing?"
                maxLength="200"
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Queue Mode</label>
              <select className="input-field" value={createMode} onChange={(e) => setCreateMode(e.target.value)}>
                <option value="open">Open Party (Anyone can add tracks)</option>
                <option value="curated">DJ Only (Only host can add tracks)</option>
              </select>
            </div>
            <div className="modal-field modal-checkbox-row">
              <input
                type="checkbox"
                id="create-private"
                checked={createPrivate}
                onChange={(e) => setCreatePrivate(e.target.checked)}
              />
              <label htmlFor="create-private" className="modal-label modal-label-checkbox">
                Private Room (requires password)
              </label>
            </div>
            {createPrivate && (
              <div className="modal-field">
                <label className="modal-label">Room Password</label>
                <input
                  type="password"
                  className="input-field"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Enter password to join this room"
                  maxLength="32"
                  required
                />
              </div>
            )}
            <div className="modal-field">
              <label className="modal-label">Genre Tags (Max 3)</label>
              <div className="tag-grid">
                {availableTags.map((tag) => (
                  <div
                    key={tag}
                    className={`tag ${selectedTags.has(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Start Jamming'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* LEAVE SESSION MODAL */}
      <div className={`modal-bg ${showLeaveModal ? 'open' : ''}`}>
        <div className="modal-box text-center" style={{ textAlign: 'center' }}>
          <div className="modal-title-small" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Leave Session?</div>
          <p className="modal-text-desc" style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
            You will be seamlessly removed from any active rooms. Are you sure you want to log out?
          </p>
          <div className="modal-actions-centered" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setShowLeaveModal(false)}>Stay</button>
            <button className="btn btn-primary" onClick={handleLogout}>Yes, Leave</button>
          </div>
        </div>
      </div>
    </>
  );
}
