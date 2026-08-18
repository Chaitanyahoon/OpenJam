'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/contexts/SocketContext';
import HeroSection from '@/components/HeroSection';
import RoomCard from '@/components/RoomCard';
import YouTubePlayer from '@/utils/YouTubePlayer';
import dynamic from 'next/dynamic';
import PillNav from '@/components/PillNav';
import VolumeIcon from '@/components/VolumeIcon';
import { FALLBACK_DISCOVERY_TRACKS } from '@/constants/tracks';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Play, Pause, Trash2, Plus, Music, FolderHeart, ListMusic } from 'lucide-react';
import { offlineDb } from '@/utils/offlineDb';
import FaqSection from '@/components/FaqSection';


const JoinModal = dynamic(() => import('@/components/modals/JoinModal'), { ssr: false });
const CreateRoomModal = dynamic(() => import('@/components/modals/CreateRoomModal'), { ssr: false });
const LeaveModal = dynamic(() => import('@/components/modals/LeaveModal'), { ssr: false });
const MusicPill = dynamic(() => import('@/components/MusicPill'), { ssr: false });



export default function HomePage() {
  const { isConnected, reconnect } = useSocket();
  const router = useRouter();

  // Authentication & User States
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Offline PWA States
  const [isOffline, setIsOffline] = useState(false);
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [offlinePlaylists, setOfflinePlaylists] = useState([]);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activeOfflinePlaylistId, setActiveOfflinePlaylistId] = useState(null);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [trackToDelete, setTrackToDelete] = useState(null);
  const [activeDropdownTrackId, setActiveDropdownTrackId] = useState(null);

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
  const [allowGuestControls, setAllowGuestControls] = useState(false);
  const [selectedTags, setSelectedTags] = useState(new Set());

  // Shuffler & Submission states
  const [isShuffling, setIsShuffling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [currentYear, setCurrentYear] = useState(2026);
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeRoomPath');
    }
  }, []);

  const loadOfflineData = async () => {
    try {
      const tracks = await offlineDb.getAllTracks();
      const playlists = await offlineDb.getAllPlaylists();
      setOfflineTracks(tracks);
      setOfflinePlaylists(playlists);
    } catch (err) {
      console.error('Failed to load offline data', err);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnlineStatus = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      if (offline) {
        loadOfflineData();
      }
    };

    updateOnlineStatus();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    loadOfflineData();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

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
      const updated = await offlineDb.getAllPlaylists();
      setOfflinePlaylists(updated);
    } catch (err) {
      triggerToast('Failed to create playlist', 'error');
    }
  };

  const handleAddTrackToPlaylist = async (trackId, playlistId) => {
    try {
      const playlist = offlinePlaylists.find(p => p.id === playlistId);
      if (!playlist) return;
      if (playlist.trackIds.includes(trackId)) {
        triggerToast('Track already in playlist', 'warning');
        return;
      }
      playlist.trackIds.push(trackId);
      await offlineDb.savePlaylist(playlist);
      triggerToast(`Added to ${playlist.name}`, 'success');
      const updated = await offlineDb.getAllPlaylists();
      setOfflinePlaylists(updated);
    } catch (err) {
      triggerToast('Failed to add track to playlist', 'error');
    }
  };

  const handleRemoveTrackFromPlaylist = async (trackId, playlistId) => {
    try {
      const playlist = offlinePlaylists.find(p => p.id === playlistId);
      if (!playlist) return;
      playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
      await offlineDb.savePlaylist(playlist);
      triggerToast('Removed from playlist', 'success');
      const updated = await offlineDb.getAllPlaylists();
      setOfflinePlaylists(updated);
    } catch (err) {
      triggerToast('Failed to remove track', 'error');
    }
  };

  const handleDeletePlaylist = (playlistId) => {
    setPlaylistToDelete(playlistId);
  };

  const executeDeletePlaylist = async (playlistId) => {
    try {
      await offlineDb.deletePlaylist(playlistId);
      triggerToast('Playlist deleted', 'success');
      const updated = await offlineDb.getAllPlaylists();
      setOfflinePlaylists(updated);
      if (activeOfflinePlaylistId === playlistId) {
        setActiveOfflinePlaylistId(null);
      }
    } catch (err) {
      triggerToast('Failed to delete playlist', 'error');
    }
  };

  const handleDeleteTrack = (trackId) => {
    setTrackToDelete(trackId);
  };

  const executeDeleteTrack = async (trackId) => {
    try {
      await offlineDb.deleteTrack(trackId);
      triggerToast('Track deleted from offline storage', 'success');
      
      const updatedTracks = await offlineDb.getAllTracks();
      setOfflineTracks(updatedTracks);
      
      let playlistsModified = false;
      const updatedPlaylists = await Promise.all(offlinePlaylists.map(async (playlist) => {
        if (playlist.trackIds.includes(trackId)) {
          playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
          await offlineDb.savePlaylist(playlist);
          playlistsModified = true;
        }
        return playlist;
      }));
      if (playlistsModified) {
        const freshPlaylists = await offlineDb.getAllPlaylists();
        setOfflinePlaylists(freshPlaylists);
      }
    } catch (err) {
      triggerToast('Failed to delete track', 'error');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches || 
             (window.navigator.standalone === true);
    };

    if (checkStandalone()) return;

    // Always enable install action so user can click to trigger instruction tooltip or prompt
    setShowInstallBtn(true);

    const handleInstallReady = () => {
      setShowInstallBtn(true);
    };
    window.addEventListener('pwa-install-ready', handleInstallReady);
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-install-ready'));
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('pwa-install-ready', handleInstallReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
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
  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rooms.filter((r) => {
      const matchQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.genre_tags || []).some((t) => t.toLowerCase().includes(q));
      const matchGenre = !activeGenreFilter || (r.genre_tags || []).includes(activeGenreFilter);
      return matchQuery && matchGenre;
    });
  }, [rooms, searchQuery, activeGenreFilter]);

  const dynamicFilterGenres = useMemo(() => Array.from(
    new Set(rooms.reduce((acc, curr) => acc.concat(curr.genre_tags || []), []))
  ).sort(), [rooms]);

  const publicRooms = useMemo(() => rooms.filter((room) => !room.is_private).length, [rooms]);
  const privateRooms = useMemo(() => rooms.length - publicRooms, [rooms, publicRooms]);
  const totalListeners = useMemo(() => rooms.reduce((sum, room) => sum + (room.listener_count || 0), 0), [rooms]);

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
      { label: 'Rooms', href: '#active-rooms' },
      { label: 'FAQ', href: '#faq' }
    ];

    if (showInstallBtn) {
      list.push({
        label: 'Install App',
        href: '#install',
        onClick: (e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('show-pwa-install-prompt'));
        }
      });
    }

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
            <img decoding="async" loading="lazy" 
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
          <span>{me.display_name} ▾</span>
        </span>
      );

      if (me.is_registered) {
        const userLabelHover = (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--amber)' }}>
            <span>My Profile 👤</span>
          </span>
        );

        list.push({
          label: userLabel,
          labelHover: userLabelHover,
          href: '/profile',
          ariaLabel: `View profile of ${me.display_name}`
        });

        list.push({
          label: 'Logout ⎋',
          href: '#logout',
          onClick: (e) => {
            e.preventDefault();
            setShowLeaveModal(true);
          }
        });
      } else {
        const userLabelHover = (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
            <span>Logout ⎋</span>
          </span>
        );

        list.push({
          label: userLabel,
          labelHover: userLabelHover,
          href: '#leave',
          ariaLabel: `Leave session for ${me.display_name}`,
          onClick: (e) => {
            e.preventDefault();
            setShowLeaveModal(true);
          }
        });
      }

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
  }, [me, showInstallBtn]);



  // Auth
  const checkAuth = async () => {
    try {
      const r = await fetch(`/auth/me?t=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        if (data.user) {
          setMe(data.user);
          localStorage.setItem('openjam_display_name', data.user.display_name);
          if (data.user.avatar_url) {
            localStorage.setItem('openjam_avatar_url', data.user.avatar_url);
          }
          return data.user;
        }
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      let token = params.get('token');
      
      // Fallback/Prefer hash fragment for enhanced security
      const hash = window.location.hash;
      if (!token && hash.startsWith('#token=')) {
        token = hash.substring(7);
      }

      if (token) {
        const maxAge = 86400 * 30; // 30 days
        const isSecure = window.location.protocol === 'https:';
        document.cookie = `session_token=${token}; max-age=${maxAge}; path=/; samesite=lax${isSecure ? '; secure' : ''}`;
        
        if (reconnect) {
          reconnect(token);
        }

        // Clean the token parameter from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }

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
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
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
      let currentUser = me;
      if (!currentUser) {
        const randomName = generateRandomName();
        try {
          const joinRes = await fetch('/auth/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: randomName }),
            credentials: 'include'
          });
          if (joinRes.ok) {
            const joinData = await joinRes.json();
            currentUser = joinData.user;
            setMe(joinData.user);
            localStorage.setItem('openjam_display_name', randomName);
          }
        } catch (authErr) {
          console.warn('Guest auto-join before create room error:', authErr);
        }
      }

      const r = await fetch('/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: createDesc.trim(),
          genre_tags: Array.from(selectedTags),
          queue_mode: createMode,
          password: createPrivate ? createPassword.trim() : null,
          allow_guest_controls: allowGuestControls
        }),
        credentials: 'include'
      });
      if (r.ok) {
        const data = await r.json();
        setShowCreateModal(false);
        if (activePreview) {
          try {
            localStorage.setItem(`auto_play_track_${data.room.id}`, JSON.stringify(activePreview));
          } catch (e) {}
        }
        triggerToast('Jam Room created! Entering room...', 'success');
        setTimeout(() => {
          router.push(`/room/${data.room.id}?created=true`);
        }, 150);
      } else {
        const err = await r.json().catch(() => ({}));
        const errMsg = typeof err.detail === 'string' 
          ? err.detail 
          : Array.isArray(err.detail) 
            ? err.detail.map(d => d.msg).join(', ') 
            : (err.message || 'Failed to create room');
        throw new Error(errMsg);
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
    document.cookie = "session_token=; max-age=0; path=/;";
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
      setTimeout(() => { router.push(`/room/${targetRoom.id}`); }, 800);
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
          setTimeout(() => { router.push(`/room/${data.room.id}?created=true`); }, 800);
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

  const filteredOfflineTracks = useMemo(() => {
    let list = offlineTracks;
    if (activeOfflinePlaylistId) {
      const playlist = offlinePlaylists.find(p => p.id === activeOfflinePlaylistId);
      if (playlist) {
        list = offlineTracks.filter(track => playlist.trackIds.includes(track.id));
      } else {
        list = [];
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(track => 
        track.track_name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
      );
    }
    return list;
  }, [offlineTracks, offlinePlaylists, activeOfflinePlaylistId, searchQuery]);

  return (
    <main className="landing-wrapper">

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

      {isOffline && (
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
          <span>YOU ARE CURRENTLY OFFLINE. PLAYING CACHED OFFLINE LIBRARY.</span>
        </div>
      )}

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
        me={me}
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
        showInstallBtn={showInstallBtn}
        onInstallClick={() => window.dispatchEvent(new CustomEvent('show-pwa-install-prompt'))}
      />

      {isOffline ? (
        <motion.section
          id="offline-library"
          className="rooms-section"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="rooms-section-header">
            <div className="rooms-section-heading-group">
              <h2 className="rooms-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderHeart size={24} style={{ color: 'var(--amber)' }} />
                <span>My Offline Library</span>
              </h2>
              <p className="rooms-section-subtitle">
                Play your locally cached tracks and manage your playlists.
              </p>
            </div>
            <div className="rooms-header-meta">
              <span className="rooms-count font-mono">
                {offlineTracks.length} track{offlineTracks.length !== 1 ? 's' : ''}
              </span>
              <span className="connection-chip offline">
                Offline Mode
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
                id="search-offline-tracks-input"
                aria-label="Search offline tracks"
                type="text"
                className="input-field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search offline tracks..."
                autoComplete="off"
              />
            </div>
            <div className="rooms-toolbar-meta">
              <span className="results-copy">
                Showing {filteredOfflineTracks.length} track{filteredOfflineTracks.length !== 1 ? 's' : ''}
                {searchQuery ? ` for "${searchQuery}"` : ''}
              </span>
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-ghost btn-toolbar-clear"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          <div className="offline-library-grid">
            {/* Playlists Column */}
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
                  <ListMusic size={20} color="var(--amber)" /> Custom Playlists
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
                  className={`playlist-item ${!activeOfflinePlaylistId ? 'active' : ''}`}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: !activeOfflinePlaylistId ? 'rgba(255, 159, 28, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: !activeOfflinePlaylistId ? '1px solid var(--amber)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setActiveOfflinePlaylistId(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Music size={16} color="var(--amber)" />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>All Downloaded</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{offlineTracks.length}</span>
                </div>

                {offlinePlaylists.map(playlist => (
                  <div
                    key={playlist.id}
                    className={`playlist-item ${activeOfflinePlaylistId === playlist.id ? 'active' : ''}`}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: activeOfflinePlaylistId === playlist.id ? 'rgba(255, 159, 28, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                      border: activeOfflinePlaylistId === playlist.id ? '1px solid var(--amber)' : '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setActiveOfflinePlaylistId(playlist.id)}
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

            {/* Tracks List Column */}
            <div className="glass-card" style={{
              padding: '24px',
              borderRadius: '24px',
              border: '1px solid rgba(255, 159, 28, 0.15)',
              background: 'rgba(10, 9, 12, 0.5)',
              backdropFilter: 'blur(20px)'
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Music size={20} color="var(--amber)" />
                {activeOfflinePlaylistId 
                  ? `${offlinePlaylists.find(p => p.id === activeOfflinePlaylistId)?.name || 'Playlist'} Tracks`
                  : 'Downloaded Tracks'}
              </h3>

              {filteredOfflineTracks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredOfflineTracks.map((track) => {
                    const isCurrent = activePreview && activePreview.trackUri === track.id;
                    const isPlaying = isCurrent && isPlayingPreview;
                    
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
                              onClick={() => handlePlayPreview({
                                trackUri: track.id,
                                trackName: track.track_name,
                                artist: track.artist,
                                src: track.album_art_url,
                                duration_ms: track.duration_ms
                              })}
                            >
                              {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" />}
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
                          {offlinePlaylists.length > 0 && (
                            <div 
                              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownTrackId(activeDropdownTrackId === track.id ? null : track.id);
                                }}
                                style={{
                                  background: 'rgba(0,0,0,0.6)',
                                  border: '1px solid rgba(255, 159, 28, 0.2)',
                                  color: activeDropdownTrackId === track.id ? 'var(--amber)' : 'var(--text-2)',
                                  fontSize: '12px',
                                  padding: '6px 12px',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px'
                                }}
                              >
                                Playlist +
                              </button>

                              {activeDropdownTrackId === track.id && (
                                <>
                                  <div 
                                    style={{
                                      position: 'fixed',
                                      inset: 0,
                                      zIndex: 990,
                                      cursor: 'default'
                                    }} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownTrackId(null);
                                    }}
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
                                      {offlinePlaylists.map(p => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdownTrackId(null);
                                            handleAddTrackToPlaylist(track.id, p.id);
                                          }}
                                          style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-1)',
                                            padding: '8px 12px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 159, 28, 0.1)'}
                                          onMouseLeave={(e) => e.target.style.background = 'none'}
                                        >
                                          {p.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {activeOfflinePlaylistId && (
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
                              onClick={() => handleRemoveTrackFromPlaylist(track.id, activeOfflinePlaylistId)}
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
                    {activeOfflinePlaylistId 
                      ? 'Add downloaded tracks to this playlist using the "Add to playlist..." dropdown on any track.'
                      : 'Search or join rooms while online, and download tracks to build your offline library!'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      ) : (
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
              id="search-rooms-input"
              aria-label="Search rooms or genres"
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
      )}



      <FaqSection />

      {/* FOOTER */}
      <footer className="footer footer-landing">
        <div className="footer-links-row">
          <Link href="/privacy" className="footer-link">Privacy Policy</Link>
          <span className="footer-sep" aria-hidden="true">&middot;</span>
          <Link href="/terms" className="footer-link">Terms of Service</Link>
        </div>
        <p className="footer-copy">
          &copy; {currentYear} OpenJam. Created by <a href="https://discord.com/users/964173378896400425" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-accent, #ff9f1c)'} onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}>Chaitanya</a>. All rights reserved.
        </p>
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
              zIndex: (showJoinModal || showCreateModal || showLeaveModal) ? 800 : 999,
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
        allowGuestControls={allowGuestControls} onAllowGuestControlsChange={setAllowGuestControls}
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
            }}>Create Offline Playlist</h3>
            
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

      {/* DELETE CONFIRMATION MODALS */}
      {playlistToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 9, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setPlaylistToDelete(null)}>
          <div style={{
            background: 'var(--bg-base, #111015)',
            border: '1px solid rgba(255, 71, 87, 0.2)',
            borderRadius: '24px',
            padding: '32px',
            width: 'calc(100% - 32px)',
            maxWidth: '400px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            position: 'relative',
            textAlign: 'center'
          }} onClick={(e) => e.stopPropagation()}>
            <Trash2 size={48} color="#ff4757" style={{ marginBottom: '16px', margin: '0 auto 16px' }} />
            <h3 style={{
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '12px'
            }}>Delete Playlist</h3>
            <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              Are you sure you want to delete this playlist? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPlaylistToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const id = playlistToDelete;
                  setPlaylistToDelete(null);
                  await executeDeletePlaylist(id);
                }}
                style={{
                  background: '#ff4757',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(255, 71, 87, 0.25)'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {trackToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 9, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setTrackToDelete(null)}>
          <div style={{
            background: 'var(--bg-base, #111015)',
            border: '1px solid rgba(255, 71, 87, 0.2)',
            borderRadius: '24px',
            padding: '32px',
            width: 'calc(100% - 32px)',
            maxWidth: '400px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            position: 'relative',
            textAlign: 'center'
          }} onClick={(e) => e.stopPropagation()}>
            <Trash2 size={48} color="#ff4757" style={{ marginBottom: '16px', margin: '0 auto 16px' }} />
            <h3 style={{
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '12px'
            }}>Delete Track</h3>
            <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              Delete this downloaded track from offline storage?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTrackToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const id = trackToDelete;
                  setTrackToDelete(null);
                  await executeDeleteTrack(id);
                }}
                style={{
                  background: '#ff4757',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(255, 71, 87, 0.25)'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
