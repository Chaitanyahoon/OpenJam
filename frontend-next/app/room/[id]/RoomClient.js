'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import YouTubePlayer from '@/utils/YouTubePlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicPlayer } from '@/components/ui/music-player';
import { Search, Plus, X, Music, Settings, Users, Send, Volume2, VolumeX, Play, Pause, Heart, CheckCircle, AlertCircle, AlertTriangle, Info, Download, Check } from 'lucide-react';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import { offlineDb } from '@/utils/offlineDb';

export default function RoomClient({ roomId }) {
  const { socket, isConnected, reconnect } = useSocket();
  const playerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // States
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [listeners, setListeners] = useState([]);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [playbackState, setPlaybackState] = useState({ positionMs: 0, durationMs: 0, isPlaying: false });

  const nowPlayingRef = useRef(null);
  const playbackStateRef = useRef({ positionMs: 0, durationMs: 0, isPlaying: false });
  const streamErrorMsgRef = useRef(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activeTab, setActiveTab] = useState('playing'); // playing, queue, chat, members
  const [activeQueueTab, setActiveQueueTab] = useState('queue'); // queue, history
  const [playerSize, setPlayerSize] = useState(280);
  
  // Volume & Settings
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [settingsSound, setSettingsSound] = useState(true);
  const [settingsVisuals, setSettingsVisuals] = useState(true);
  const [settingsHaptics, setSettingsHaptics] = useState(true);
  const [settingsNotifications, setSettingsNotifications] = useState(false);

  // Search & Inputs
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

  // Modals & Panels
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [nickname, setNickname] = useState('');
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [lyricsText, setLyricsText] = useState([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsActiveIdx, setLyricsActiveIdx] = useState(-1);
  const [streamErrorMsg, setStreamErrorMsg] = useState(null);
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 0, voted: false });
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [isDraggingOverNP, setIsDraggingOverNP] = useState(false);
  const [isDraggingOverQueue, setIsDraggingOverQueue] = useState(false);


  // Refs for scrolling and canvas
  const chatEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastReactionId = useRef(0);
  const isOverSuggestions = useRef(false);
  const isDraggingSuggestion = useRef(false);

  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  }, [nowPlaying]);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const settingsNotificationsRef = useRef(false);
  const roomRef = useRef(null);
  const activeTabRef = useRef('playing');
  const meRef = useRef(null);

  useEffect(() => {
    settingsNotificationsRef.current = settingsNotifications;
  }, [settingsNotifications]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    streamErrorMsgRef.current = streamErrorMsg;
  }, [streamErrorMsg]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('room-page');
      return () => {
        document.body.classList.remove('room-page');
      };
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (activeTab !== 'playing' && nowPlaying) {
        document.body.classList.add('mini-player-active');
      } else {
        document.body.classList.remove('mini-player-active');
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('mini-player-active');
      }
    };
  }, [activeTab, nowPlaying]);

  const isHost = me && room && room.host_user_id === me.id;

  const sendDesktopNotification = (title, options = {}) => {
    if (!settingsNotificationsRef.current) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        icon: '/logo.png',
        ...options,
      });
    } catch (e) {
      console.error('Failed to show notification:', e);
    }
  };

  const handleToggleNotifications = async (val) => {
    if (!val) {
      setSettingsNotifications(false);
      localStorage.setItem('openjam_setting_notifications', 'false');
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }

    if (Notification.permission === 'granted') {
      setSettingsNotifications(true);
      localStorage.setItem('openjam_setting_notifications', 'true');
      sendDesktopNotification('OpenJam Notifications Enabled', {
        body: 'You will receive notifications for new chat messages and alerts when not active.'
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettingsNotifications(true);
        localStorage.setItem('openjam_setting_notifications', 'true');
        sendDesktopNotification('OpenJam Notifications Enabled', {
          body: 'You will receive notifications for new chat messages and alerts when not active.'
        });
      } else {
        alert('Notification permission denied. Please allow notifications in your browser settings.');
      }
    } else {
      alert('Notification permission is denied. Please reset the site permissions in your browser address bar.');
    }
  };

  const [downloadingTracks, setDownloadingTracks] = useState({});
  const [downloadedTracks, setDownloadedTracks] = useState(new Set());

  // Load downloaded tracks on mount
  useEffect(() => {
    offlineDb.getAllTracks().then((tracks) => {
      const ids = new Set(tracks.map(t => t.id));
      setDownloadedTracks(ids);
    }).catch(err => {
      console.error('Failed to load local downloads:', err);
    });
  }, []);

  const handleDownloadTrack = async (track) => {
    const trackId = track.track_uri || track.id || track.uri;
    if (!trackId) return;

    if (downloadedTracks.has(trackId)) {
      triggerToast("Track already downloaded!", "info");
      return;
    }

    setDownloadingTracks(prev => ({ ...prev, [trackId]: 0 }));
    triggerToast(`Downloading "${track.track_name || 'Track'}"…`, "info");

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      let cleanBackendUrl = '';
      
      const isLocalHost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
      );

      if (isLocalHost) {
        cleanBackendUrl = `http://${window.location.hostname}:8000`;
      } else {
        cleanBackendUrl = backendUrl !== 'undefined' && backendUrl !== 'null' && backendUrl.trim() !== ''
          ? backendUrl.replace(/\/$/, '')
          : 'https://api.openjam.fun';
      }

      const response = await fetch(`${cleanBackendUrl}/stream/${trackId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stream: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const progress = Math.round((receivedBytes / totalBytes) * 100);
          setDownloadingTracks(prev => ({ ...prev, [trackId]: progress }));
        }
      }

      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/webm' });

      await offlineDb.saveTrack({
        id: trackId,
        track_name: track.track_name || track.name || 'Unknown Track',
        artist: track.artist || 'Unknown Artist',
        album_art_url: track.album_art_url || track.artwork || '/static/img/logo.png',
        duration_ms: track.duration_ms || track.duration || 0,
        blob: blob,
        playCount: 0,
        liked: 0,
        downloadedAt: Date.now()
      });

      setDownloadedTracks(prev => {
        const next = new Set(prev);
        next.add(trackId);
        return next;
      });

      triggerToast(`Downloaded "${track.track_name || 'Track'}" successfully!`, "success");
    } catch (e) {
      console.error('[Download] Failed:', e);
      triggerToast("Download failed. Please try again.", "error");
    } finally {
      setDownloadingTracks(prev => {
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
    }
  };

  // Notification helper
  const triggerToast = (text, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);

    if (settingsSound && typeof window !== 'undefined') {
      playAlertSound(type);
    }
    if (settingsHaptics && navigator.vibrate) {
      navigator.vibrate(50);
    }

    const isWindowBackground = typeof document !== 'undefined' && (document.visibilityState === 'hidden' || !document.hasFocus());
    if (isWindowBackground) {
      sendDesktopNotification('OpenJam Alert', {
        body: text,
        tag: 'room-alert',
        renotify: true
      });
    }
  };

  const playAlertSound = (type) => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtxClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'error') {
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start();
        osc.stop(now + 0.16);
      } else {
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start();
        osc.stop(now + 0.09);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) {}
  };

  // Helper functions
  const initials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const nameColor = (name) => {
    if (!name) return 'var(--amber)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (ms) => {
    if (isNaN(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const ambientBackgroundStyle = settingsVisuals && nowPlaying?.album_art_url 
    ? { backgroundImage: `url(${nowPlaying.album_art_url})`, filter: 'blur(100px) saturate(2) brightness(0.35)' }
    : {};

  const scrollToChatBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 1. Initial Load & Auth
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load favourites
    const storedFavs = localStorage.getItem('openjam_favourites');
    if (storedFavs) {
      try {
        setFavourites(JSON.parse(storedFavs));
      } catch (e) {}
    }
    
    // Load local settings
    const storedVol = localStorage.getItem('openjam_volume');
    if (storedVol !== null) setVolume(parseInt(storedVol));
    
    const storedSound = localStorage.getItem('openjam_setting_sound');
    if (storedSound !== null) setSettingsSound(storedSound === 'true');
    
    const storedVisuals = localStorage.getItem('openjam_setting_visuals');
    if (storedVisuals !== null) setSettingsVisuals(storedVisuals === 'true');
    
    const storedHaptics = localStorage.getItem('openjam_setting_haptics');
    if (storedHaptics !== null) setSettingsHaptics(storedHaptics === 'true');

    const storedNotifications = localStorage.getItem('openjam_setting_notifications');
    if (storedNotifications !== null) {
      const enabled = storedNotifications === 'true';
      if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setSettingsNotifications(true);
        } else {
          setSettingsNotifications(false);
          localStorage.setItem('openjam_setting_notifications', 'false');
        }
      }
    }

    const handleResize = () => {
      if (window.innerWidth < 480) {
        setPlayerSize(180);
      } else if (window.innerWidth < 768) {
        setPlayerSize(220);
      } else {
        setPlayerSize(280);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const fetchInitialData = async () => {
      try {
        let userResolved = false;
        const rMe = await fetch(`/auth/me?t=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
        if (rMe.ok) {
          const data = await rMe.json();
          if (data.user) {
            setMe(data.user);
            localStorage.setItem('openjam_display_name', data.user.display_name);
            if (data.user.avatar_url) {
              localStorage.setItem('openjam_avatar_url', data.user.avatar_url);
            }
            if (reconnect) reconnect();
            userResolved = true;
          } else {
            // No session exists — check if we have a stored display name
            const storedName = localStorage.getItem('openjam_display_name') || '';
            if (storedName) {
              const rJoin = await fetch('/auth/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_name: storedName }),
                credentials: 'include'
              });
              if (rJoin.ok) {
                const joinData = await rJoin.json();
                setMe(joinData.user);
                if (joinData.user) {
                  localStorage.setItem('openjam_display_name', joinData.user.display_name);
                }
                if (reconnect) reconnect();
                userResolved = true;
              }
            } else {
              // Defer join: show nickname prompt modal
              setShowNicknamePrompt(true);
            }
          }
        }

        const rRoom = await fetch(`/rooms/${roomId}`, { credentials: 'include' });
        if (rRoom.ok) {
          const data = await rRoom.json();
          setRoom(data.room);
          setQueue(data.queue || []);
          setListeners(data.listeners || []);
          
          if (data.password_required) {
            setShowPassword(true);
          }
          
          // Connect socket if user is successfully authenticated/resolved
          if (userResolved) {
            setIsReady(true);
          }
        } else {
          window.location.href = '/404';
        }
      } catch (err) {
        console.error('Initial fetch error:', err);
      }
    };
    fetchInitialData();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [roomId]);

  // Load database likes & playlists if registered user
  useEffect(() => {
    if (me && me.is_registered) {
      const loadDbLikes = async () => {
        try {
          const res = await fetch('/likes', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const mappedLikes = (data.likes || []).map((like) => ({
              track_uri: like.track_uri,
              track_name: like.track_name,
              artist: like.artist,
              album_art_url: like.album_art_url,
              duration_ms: like.duration_ms,
            }));
            setFavourites(mappedLikes);
          }
        } catch (err) {
          console.error("Failed to load likes from database:", err);
        }
      };

      const loadDbPlaylists = async () => {
        try {
          const res = await fetch('/playlists', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setPlaylists(data.playlists || []);
          }
        } catch (err) {
          console.error("Failed to load playlists from database:", err);
        }
      };

      loadDbLikes();
      loadDbPlaylists();
    }
  }, [me]);

  // Connection status observer
  useEffect(() => {
    if (!isConnected && isReady) {
      triggerToast('Connecting to live session server...', 'warning');
    }
  }, [isConnected, isReady]);

  // 2. WebSocket Listeners Setup
  useEffect(() => {
    if (!socket || !isReady) {
      return;
    }

    const joinRoom = () => {
      const password = sessionStorage.getItem(`room_password_${roomId}`) || roomPassword;
      const avatarUrl = localStorage.getItem('openjam_avatar_url');
      socket.emit('join_room', { room_id: roomId, password, avatar_url: avatarUrl });
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);

    socket.on('join_success', (data) => {
      if (data.room) setRoom(data.room);
      if (data.queue) setQueue(data.queue);
      if (data.listeners) setListeners(data.listeners);
      if (data.playback) {
        playbackStateRef.current = data.playback;
        setPlaybackState(data.playback);
      }
      if (data.now_playing) {
        nowPlayingRef.current = data.now_playing;
        setNowPlaying(data.now_playing);
      }
      setShowPassword(false);

      if (data.now_playing && playerRef.current) {
        const isBuffering = data.playback?.is_buffering || data.playback?.isBuffering || false;
        const position = data.playback?.positionMs ?? data.playback?.position_ms ?? 0;
        const duration = data.playback?.durationMs ?? data.playback?.duration_ms ?? 0;
        const playing = data.playback?.isPlaying ?? data.playback?.is_playing ?? false;

        playerRef.current.setTrack({
          track_uri: data.now_playing.track_uri,
          track_name: data.now_playing.track_name,
          artist: data.now_playing.artist,
          album_art_url: data.now_playing.album_art_url,
          position_ms: position,
          duration_ms: duration,
          is_playing: playing && !isBuffering
        });
      }

      // Check if there is a pre-queued track from homepage discovery dome or created flag
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const isCreated = urlParams.get('created') === 'true';
        if (isCreated) {
          triggerToast('Jam room created successfully!', 'success');
        } else {
          triggerToast('Connected to room!', 'success');
        }

        const preQueue = urlParams.get('preQueue');
        if (preQueue) {
          const trackName = urlParams.get('title');
          const artist = urlParams.get('artist');
          const albumArtUrl = urlParams.get('art');

          socket.emit('add_to_queue', {
            room_id: roomId,
            track_uri: preQueue,
            track_name: trackName || 'Pre-queued Track',
            artist: artist || 'Unknown',
            album_art_url: albumArtUrl || '/static/img/cover-banner.webp',
            duration_ms: 240000
          });
        }

        if (isCreated || preQueue) {
          // Clean URL parameters
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    });

    socket.on('join_error', (data) => {
      setPasswordError(data.message || 'Failed to join room');
      setShowPassword(true);
    });

    socket.on('chat_history', (data) => {
      setChatMsgs(data.messages || []);
      scrollToChatBottom();
    });

    socket.on('chat_message', (msg) => {
      setChatMsgs((prev) => [...prev, msg]);
      scrollToChatBottom();

      const isSelf = meRef.current && msg.user_id === meRef.current.id;
      if (!isSelf && msg.type !== 'system') {
        const isWindowBackground = typeof document !== 'undefined' && (document.visibilityState === 'hidden' || !document.hasFocus());
        const isChatNotVisible = activeTabRef.current !== 'chat';
        if (isWindowBackground || isChatNotVisible) {
          sendDesktopNotification(msg.user_name || 'New Message', {
            body: msg.content,
            tag: 'chat-message',
            renotify: true
          });
        }
      }
    });

    socket.on('reaction', (data) => {
      const id = ++lastReactionId.current;
      setFloatingReactions((prev) => [
        ...prev,
        { id, emoji: data.emoji, x: Math.random() * 60 + 20, y: 100 }
      ]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);

      // Append reaction system message to chat messages list
      setChatMsgs((prev) => [
        ...prev,
        {
          id: `reaction-${id}-${Date.now()}`,
          type: 'system',
          user_name: data.display_name,
          user_avatar: data.avatar_url,
          content: data.emoji,
          timestamp: new Date().toISOString()
        }
      ]);
      scrollToChatBottom();
    });

    socket.on('user_joined', (user) => {
      setListeners((prev) => {
        const uid = user.user_id || user.id;
        if (prev.some(u => (u.user_id || u.id) === uid)) return prev;
        return [...prev, user];
      });
      triggerToast(`@${user.display_name} joined the room`, 'info');
    });

    socket.on('user_left', (user) => {
      const uid = user.user_id || user.id;
      setListeners((prev) => prev.filter(u => (u.user_id || u.id) !== uid));
      triggerToast(`@${user.display_name} left the room`, 'info');
    });

    socket.on('listener_count', (data) => {
      setRoom((prev) => prev ? { ...prev, listener_count: data.count } : null);
      if (data.listeners) setListeners(data.listeners);
    });

    socket.on('host_changed', (data) => {
      setRoom((prev) => prev ? { ...prev, host_user_id: data.host_user_id } : null);
      triggerToast(`@${data.host_name} is now the host of the room`, 'info');
    });

    socket.on('queue_updated', (data) => {
      setQueue(data.queue || []);
    });

    socket.on('queue_error', (data) => {
      triggerToast(data.message || 'Queue error', 'error');
    });

    socket.on('playback_sync', (data) => {
      const isBuffering = data.is_buffering;
      const newPlayback = {
        positionMs: data.position_ms,
        durationMs: data.duration_ms,
        isPlaying: data.is_playing && !isBuffering,
        loop: data.loop || false
      };
      const newNowPlaying = data.track_uri ? {
        track_uri: data.track_uri,
        track_name: data.track_name,
        artist: data.artist,
        album_art_url: data.album_art_url
      } : null;

      playbackStateRef.current = newPlayback;
      nowPlayingRef.current = newNowPlaying;

      setPlaybackState(newPlayback);
      setNowPlaying(newNowPlaying);

      if (playerRef.current) {
        if (data.track_uri && playerRef.current.currentVideoId !== data.track_uri) {
          playerRef.current.setTrack({
            track_uri: data.track_uri,
            track_name: data.track_name,
            artist: data.artist,
            album_art_url: data.album_art_url,
            position_ms: data.position_ms,
            duration_ms: data.duration_ms,
            is_playing: data.is_playing && !isBuffering
          });
        } else if (!data.track_uri) {
          playerRef.current.stop();
        } else {
          playerRef.current.syncPosition(data.position_ms, data.is_playing && !isBuffering);
        }
      }
      if (!isHost) {
        if (isBuffering) {
          streamErrorMsgRef.current = "Buffering stream…";
          setStreamErrorMsg("Buffering stream…");
        } else {
          streamErrorMsgRef.current = null;
          setStreamErrorMsg(null);
        }
      }
    });

    socket.on('track_changed', (data) => {
      streamErrorMsgRef.current = null;
      setStreamErrorMsg(null);
      if (data) {
        nowPlayingRef.current = data;
        playbackStateRef.current = { positionMs: 0, durationMs: data.duration_ms || 0, isPlaying: true, loop: data.loop || false };
        setNowPlaying(data);
        setPlaybackState({ positionMs: 0, durationMs: data.duration_ms || 0, isPlaying: true, loop: data.loop || false });
        if (playerRef.current) {
          playerRef.current.setTrack(data);
        }
        fetchLyrics(data.artist, data.track_name);
      } else {
        nowPlayingRef.current = null;
        playbackStateRef.current = { positionMs: 0, durationMs: 0, isPlaying: false, loop: false };
        setNowPlaying(null);
        setPlaybackState({ positionMs: 0, durationMs: 0, isPlaying: false, loop: false });
        if (playerRef.current) {
          playerRef.current.stop();
        }
        setLyricsText([]);
      }
    });

    socket.on('skip_votes_updated', (data) => {
      setSkipVotes((prev) => ({ ...prev, votes: data.votes, required: data.required }));
    });

    socket.on('user_typing', (data) => {
      if (me && data.user_id !== me.id) {
        setTypingUsers((prev) => ({ ...prev, [data.user_id]: data.display_name }));
      }
    });

    socket.on('user_stop_typing', (data) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[data.user_id];
        return copy;
      });
    });

    socket.on('room_closed', () => {
      triggerToast('This room has been closed by the host.', 'warning');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('join_success');
      socket.off('join_error');
      socket.off('chat_history');
      socket.off('chat_message');
      socket.off('reaction');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('listener_count');
      socket.off('host_changed');
      socket.off('queue_updated');
      socket.off('queue_error');
      socket.off('playback_sync');
      socket.off('track_changed');
      socket.off('skip_votes_updated');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('room_closed');
      socket.emit('leave_room', { room_id: roomId });
    };
  }, [socket, isReady, roomId]);

  // 3. YouTube Player Initialization & Callback Updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const player = new YouTubePlayer({
      toast: (msg, type) => triggerToast(msg, type),
      onProgressUpdate: (pos, dur, playing) => {
        playbackStateRef.current = {
          ...playbackStateRef.current,
          positionMs: pos,
          durationMs: dur,
          isPlaying: playing
        };
        setPlaybackState((prev) => ({
          ...prev,
          positionMs: pos,
          durationMs: dur,
          isPlaying: playing
        }));
      },
      onStreamFailUpdate: (msg) => {
        streamErrorMsgRef.current = msg;
        setStreamErrorMsg(msg);
      }
    });

    playerRef.current = player;

    // Trigger initial sync if socket join_success already populated nowPlaying data
    if (nowPlayingRef.current) {
      const currentTrack = nowPlayingRef.current;
      const currentPlayback = playbackStateRef.current;
      const isBuffering = currentPlayback?.isBuffering || currentPlayback?.is_buffering || false;
      const position = currentPlayback?.positionMs ?? currentPlayback?.position_ms ?? 0;
      const duration = currentPlayback?.durationMs ?? currentPlayback?.duration_ms ?? 0;
      const playing = currentPlayback?.isPlaying ?? currentPlayback?.is_playing ?? false;
      
      player.setTrack({
        track_uri: currentTrack.track_uri,
        track_name: currentTrack.track_name,
        artist: currentTrack.artist,
        album_art_url: currentTrack.album_art_url,
        position_ms: position,
        duration_ms: duration,
        is_playing: playing && !isBuffering
      });
    }

    return () => {
      player.destroy();
    };
  }, []);

  useEffect(() => {
    if (!playerRef.current) return;
    
    playerRef.current.setControlCallback((action, extra) => {
      if (action === 'ended') {
        if (isHost && socket) {
          socket.emit('next_track', { room_id: roomId });
        }
      } else if (action === 'play') {
        if (isHost && socket) {
          const currentTrack = nowPlayingRef.current;
          const currentPlayback = playbackStateRef.current;
          socket.emit('playback_update', {
            room_id: roomId,
            track_uri: currentTrack?.track_uri,
            track_name: currentTrack?.track_name,
            artist: currentTrack?.artist,
            album_art_url: currentTrack?.album_art_url,
            position_ms: extra.position_ms,
            duration_ms: currentPlayback.durationMs,
            is_playing: true,
            loop: false,
            is_buffering: !!streamErrorMsgRef.current
          });
        }
      } else if (action === 'pause') {
        if (isHost && socket) {
          const currentTrack = nowPlayingRef.current;
          const currentPlayback = playbackStateRef.current;
          socket.emit('playback_update', {
            room_id: roomId,
            track_uri: currentTrack?.track_uri,
            track_name: currentTrack?.track_name,
            artist: currentTrack?.artist,
            album_art_url: currentTrack?.album_art_url,
            position_ms: extra.position_ms,
            duration_ms: currentPlayback.durationMs,
            is_playing: false,
            loop: false,
            is_buffering: false
          });
        }
      }
    });
  }, [roomId, socket, isHost]);

  // 3.5. Buffering Synchronization
  useEffect(() => {
    if (isHost && socket && nowPlayingRef.current) {
      const currentTrack = nowPlayingRef.current;
      const currentPlayback = playbackStateRef.current;
      socket.emit('playback_update', {
        room_id: roomId,
        track_uri: currentTrack.track_uri,
        track_name: currentTrack.track_name,
        artist: currentTrack.artist,
        album_art_url: currentTrack.album_art_url,
        position_ms: currentPlayback.positionMs,
        duration_ms: currentPlayback.durationMs,
        is_playing: currentPlayback.isPlaying,
        loop: false,
        is_buffering: !!streamErrorMsg
      });
    }
  }, [streamErrorMsg, isHost, socket, roomId]);

  // 4. Volume Synchronization
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume(isMuted ? 0 : volume);
      localStorage.setItem('openjam_volume', volume.toString());
    }
  }, [volume, isMuted]);

  // 5. Search Sugggestions Debouncer
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/search/tracks?q=${encodeURIComponent(searchQuery)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.tracks || []);
        } else {
          console.error('[search] fetch failed:', res.status);
        }
      } catch (err) {
        console.error('[search] error:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // 6. Lyrics Syncing and Scroller
  async function fetchLyrics(artist, track) {
    if (!artist || !track) {
      setLyricsText([]);
      return;
    }
    setLyricsLoading(true);
    setLyricsText([]);
    try {
      const cleanTrack = track.replace(/\[.*?\]|\(.*?\)/g, '').trim();
      const cleanArtist = artist.replace(/\[.*?\]|\(.*?\)/g, '').trim();
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          const lines = data.syncedLyrics.split('\n');
          const parsed = [];
          const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
          for (const line of lines) {
            const match = timeReg.exec(line);
            if (match) {
              const min = parseInt(match[1]);
              const sec = parseInt(match[2]);
              const ms = parseInt(match[3].padEnd(3, '0'));
              const timeMs = (min * 60 * 1000) + (sec * 1000) + ms;
              const text = line.replace(timeReg, '').trim();
              if (text) {
                parsed.push({ timeMs, text });
              }
            }
          }
          setLyricsText(parsed);
        } else {
          setLyricsText([]);
        }
      } else {
        setLyricsText([]);
      }
    } catch (err) {
      console.error('Lyrics error:', err);
      setLyricsText([]);
    } finally {
      setLyricsLoading(false);
    }
  };

  useEffect(() => {
    if (lyricsText.length === 0) return;
    const currentMs = playbackState.positionMs;
    let newIdx = -1;
    for (let i = 0; i < lyricsText.length; i++) {
      if (lyricsText[i].timeMs <= currentMs + 150) {
        newIdx = i;
      } else {
        break;
      }
    }
    if (newIdx !== lyricsActiveIdx && newIdx !== -1) {
      setLyricsActiveIdx(newIdx);
    }
  }, [playbackState.positionMs, lyricsText, lyricsActiveIdx]);


  // Typing Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Chat Auto-Scroll on Messages
  useEffect(() => {
    scrollToChatBottom();
  }, [chatMsgs]);

  // 7. Ambient Canvas Visualizer
  const animationFrameIdRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !settingsVisuals) return;

    const canvas = document.getElementById('ambient-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    // Optimize performance: render canvas at 1/4th screen resolution and let CSS handle upscaling
    let width = (canvas.width = Math.floor(window.innerWidth / 4));
    let height = (canvas.height = Math.floor(window.innerHeight / 4));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = Math.floor(window.innerWidth / 4);
      height = canvas.height = Math.floor(window.innerHeight / 4);
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 22 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      speed: (Math.random() * 0.35 + 0.1) / 4,
      offset: Math.random() * Math.PI * 2
    }));

    let phase = 0;
    // Scale amplitude down by 4 and multiply frequency by 4 to preserve visual wave proportions
    let amplitude = (playbackState.isPlaying ? 80 : 20) / 4;
    let frequency = (playbackState.isPlaying ? 0.008 : 0.003) * 4;

    const render = () => {
      if (!ctx) return;
      
      // Clear canvas with a solid black/dark base
      ctx.fillStyle = '#08080a';
      ctx.fillRect(0, 0, width, height);

      // Draw a slow-moving, large breathing central glow portal
      const glowRadius = Math.max(width, height) * (playbackState.isPlaying ? 0.45 : 0.35) + Math.sin(phase * 2) * 5;
      const centerGrad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, glowRadius
      );
      centerGrad.addColorStop(0, playbackState.isPlaying ? 'rgba(255, 176, 58, 0.035)' : 'rgba(255, 176, 58, 0.012)');
      centerGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.008)');
      centerGrad.addColorStop(0.8, 'rgba(99, 102, 241, 0.004)');
      centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, width, height);

      const speed = playbackState.isPlaying ? 0.008 : 0.0015;
      const targetAmplitude = (playbackState.isPlaying ? 90 : 25) / 4;
      const targetFrequency = (playbackState.isPlaying ? 0.006 : 0.0025) * 4;

      amplitude += (targetAmplitude - amplitude) * 0.05;
      frequency += (targetFrequency - frequency) * 0.05;
      phase += speed;

      // Draw flowing sine waves (amber, pink, indigo accents)
      const waves = [
        { color: 'rgba(255, 176, 58, 0.06)', freqMul: 1.0, speedMul: 1.0, phaseOffset: 0 },
        { color: 'rgba(236, 72, 153, 0.04)', freqMul: 0.6, speedMul: 0.7, phaseOffset: Math.PI / 3 },
        { color: 'rgba(99, 102, 241, 0.03)', freqMul: 1.4, speedMul: 1.2, phaseOffset: Math.PI / 1.5 }
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.fillStyle = wave.color;
        ctx.moveTo(0, height);
        // Smaller step size since width is divided by 4
        for (let x = 0; x <= width; x += 4) {
          const y = height * 0.85 + Math.sin(x * frequency * wave.freqMul + phase * wave.speedMul + wave.phaseOffset) * amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });

      // Draw floating glowing circles
      particles.forEach((p) => {
        p.y -= p.speed * (playbackState.isPlaying ? 2.2 : 0.6);
        p.x += Math.sin(phase * 0.5 + p.offset) * 0.15;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        radGrad.addColorStop(0, 'rgba(255, 176, 58, 0.08)');
        radGrad.addColorStop(0.5, 'rgba(255, 176, 58, 0.03)');
        radGrad.addColorStop(1, 'rgba(255, 176, 58, 0)');
        ctx.fillStyle = radGrad;
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [playbackState.isPlaying, settingsVisuals]);

  // UI Event Handlers
  const handleTogglePlay = () => {
    if (!isHost || !playerRef.current) return;
    const playing = !playbackState.isPlaying;
    playerRef.current.setPlayState(playing);
    if (socket) {
      socket.emit('playback_update', {
        room_id: roomId,
        track_uri: nowPlaying?.track_uri,
        track_name: nowPlaying?.track_name,
        artist: nowPlaying?.artist,
        album_art_url: nowPlaying?.album_art_url,
        position_ms: playbackState.positionMs,
        duration_ms: playbackState.durationMs,
        is_playing: playing,
        loop: playbackState.loop || false,
        is_buffering: playing ? !!streamErrorMsg : false
      });
    }
  };

  const handleShuffleClick = () => {
    if (!isHost || !socket) return;
    socket.emit('shuffle_queue', { room_id: roomId });
    triggerToast('Shuffling queue...', 'info');
  };

  const handleRepeatToggle = () => {
    if (!isHost || !socket) return;
    const nextLoop = !playbackState.loop;
    socket.emit('toggle_repeat', { room_id: roomId, loop: nextLoop });
  };

  const handleLikeToggle = async () => {
    if (!nowPlaying) return;
    const isLiked = favourites.some((f) => f.track_uri === nowPlaying.track_uri);
    
    if (me && me.is_registered) {
      try {
        if (isLiked) {
          const res = await fetch(`/likes?track_uri=${encodeURIComponent(nowPlaying.track_uri)}`, { method: 'DELETE' });
          if (res.ok) {
            setFavourites(favourites.filter((f) => f.track_uri !== nowPlaying.track_uri));
            triggerToast('Removed from liked songs', 'info');
          } else {
            triggerToast('Failed to unlike track', 'error');
          }
        } else {
          const res = await fetch('/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              track_uri: nowPlaying.track_uri,
              track_name: nowPlaying.track_name,
              artist: nowPlaying.artist,
              album_art_url: nowPlaying.album_art_url,
              duration_ms: nowPlaying.duration_ms || playbackState.durationMs || 240000,
            }),
          });
          if (res.ok) {
            setFavourites([
              ...favourites,
              {
                track_uri: nowPlaying.track_uri,
                track_name: nowPlaying.track_name,
                artist: nowPlaying.artist,
                album_art_url: nowPlaying.album_art_url,
                duration_ms: nowPlaying.duration_ms || playbackState.durationMs || 240000,
              }
            ]);
            triggerToast('Added to liked songs', 'success');
          } else {
            triggerToast('Failed to like track', 'error');
          }
        }
      } catch (err) {
        triggerToast('Connection error', 'error');
      }
    } else {
      let nextFavs;
      if (isLiked) {
        nextFavs = favourites.filter((f) => f.track_uri !== nowPlaying.track_uri);
        triggerToast('Removed from favourites', 'info');
      } else {
        nextFavs = [
          ...favourites,
          {
            track_uri: nowPlaying.track_uri,
            track_name: nowPlaying.track_name,
            artist: nowPlaying.artist,
            album_art_url: nowPlaying.album_art_url,
            duration_ms: nowPlaying.duration_ms || playbackState.durationMs || 240000,
          },
        ];
        triggerToast('Added to favourites', 'success');
      }
      setFavourites(nextFavs);
      localStorage.setItem('openjam_favourites', JSON.stringify(nextFavs));
    }
  };

  const handleSeek = (e) => {
    if (!isHost || !playbackState.durationMs || !socket || !playerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const newPositionMs = Math.floor(percentage * playbackState.durationMs);
    
    // Sync locally first
    setPlaybackState(prev => ({ ...prev, positionMs: newPositionMs }));
    playerRef.current.syncPosition(newPositionMs, playbackState.isPlaying);

    // Emit socket update
    socket.emit('playback_update', {
      room_id: roomId,
      track_uri: nowPlaying?.track_uri,
      track_name: nowPlaying?.track_name,
      artist: nowPlaying?.artist,
      album_art_url: nowPlaying?.album_art_url,
      position_ms: newPositionMs,
      duration_ms: playbackState.durationMs,
      is_playing: playbackState.isPlaying,
      loop: false,
      is_buffering: playbackState.isPlaying ? !!streamErrorMsg : false
    });
  };

  const handleNextTrack = () => {
    if (!isHost || !socket) return;
    socket.emit('next_track', { room_id: roomId });
  };

  const handleVoteSkip = () => {
    if (!socket) return;
    socket.emit('vote_skip', { room_id: roomId });
    setSkipVotes((prev) => ({ ...prev, voted: true }));
  };

  const handleVoteQueueTrack = (itemId) => {
    if (!socket) return;
    socket.emit('vote_track', { room_id: roomId, queue_item_id: itemId });
  };

  const handleRemoveQueueTrack = (itemId) => {
    if (!socket) return;
    socket.emit('remove_from_queue', { room_id: roomId, queue_item_id: itemId });
  };

  const handleAddTrack = (track) => {
    if (!socket) {
      console.error('[handleAddTrack] No socket available!');
      triggerToast('Connection lost. Please refresh.', 'error');
      return;
    }
    const payload = {
      room_id: roomId,
      track_uri: track.track_uri || track.uri,
      track_name: track.track_name || track.name,
      artist: track.artist,
      album_art_url: track.album_art_url,
      duration_ms: track.duration_ms
    };
    socket.emit('add_to_queue', payload);
    setSearchQuery('');
    setSearchResults([]);
    triggerToast(`Adding "${payload.track_name}"…`, 'info');
  };

  const handleSendReaction = (emoji) => {
    if (!socket) return;
    socket.emit('send_reaction', { room_id: roomId, emoji });
  };

  const handleTyping = (e) => {
    setChatInput(e.target.value);
    if (!socket) return;
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { room_id: roomId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('stop_typing', { room_id: roomId });
    }, 2000);
  };

  const handleStopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    if (socket) {
      socket.emit('stop_typing', { room_id: roomId });
    }
  };

  const handleSendChat = (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    
    const tempId = Math.random().toString(36).slice(2, 10);
    socket.emit('send_chat', {
      room_id: roomId,
      message: chatInput,
      temp_id: tempId
    });
    
    setChatInput('');
    handleStopTyping();
  };

  const handleImportBulk = async () => {
    if (!bulkImportText.trim() || !socket) return;
    const lines = bulkImportText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    triggerToast('Processing bulk import...', 'info');
    
    const tracksToAdd = [];
    const playlistPromises = [];

    lines.forEach((line) => {
      const lineClean = line.trim();
      const isSpotifyPlaylist = lineClean.includes('spotify.com/playlist/');
      const isYoutubePlaylist = lineClean.includes('youtube.com/playlist') || lineClean.includes('list=');
      
      if (isSpotifyPlaylist || isYoutubePlaylist) {
        const fetchPlaylist = async () => {
          try {
            const res = await fetch(`/search/playlist?url=${encodeURIComponent(lineClean)}`, { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              if (data.tracks && data.tracks.length > 0) {
                data.tracks.forEach((track) => {
                  tracksToAdd.push({
                    track_uri: track.uri,
                    track_name: track.name,
                    artist: track.artist,
                    album_art_url: track.album_art_url || '/static/img/logo.png',
                    duration_ms: track.duration_ms || 0
                  });
                });
                triggerToast(`Extracted ${data.tracks.length} tracks from playlist!`, 'success');
              } else {
                triggerToast('No tracks found in playlist', 'warning');
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              triggerToast(errData.detail || 'Failed to import playlist', 'error');
            }
          } catch (err) {
            console.error('Error importing playlist:', err);
            triggerToast('Error importing playlist', 'error');
          }
        };
        playlistPromises.push(fetchPlaylist());
      } else {
        let track_uri = '';
        if (lineClean.includes('youtube.com/') || lineClean.includes('youtu.be/')) {
          const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
          const m = lineClean.match(reg);
          if (m) track_uri = m[1];
        }
        
        if (track_uri) {
          tracksToAdd.push({
            track_uri: track_uri,
            track_name: 'YouTube Video',
            artist: 'YouTube',
            album_art_url: '/static/img/logo.png',
            duration_ms: 0
          });
        } else {
          tracksToAdd.push({
            track_uri: lineClean,
            track_name: lineClean,
            artist: 'Search Query',
            album_art_url: '/static/img/logo.png',
            duration_ms: 0
          });
        }
      }
    });

    if (playlistPromises.length > 0) {
      await Promise.all(playlistPromises);
    }

    if (tracksToAdd.length > 0) {
      socket.emit('add_multiple_to_queue', {
        room_id: roomId,
        tracks: tracksToAdd
      });
      triggerToast(`Adding ${tracksToAdd.length} tracks to queue…`, 'info');
    }

    setShowBulkAdd(false);
    setBulkImportText('');
  };

  const handleDragStart = (e, index) => {
    if (!isHost) return;
    
    // Defer state update so browser can establish the native drag operation before React re-renders the DOM
    setTimeout(() => {
      setDraggedIdx(index);
    }, 0);
    
    e.dataTransfer.effectAllowed = "move";
    
    // Serialize queue item track data for dropping onto the now playing player
    const trackItem = queue[index];
    if (trackItem) {
      const trackData = {
        uri: trackItem.track_uri || trackItem.id,
        name: trackItem.track_name || trackItem.title,
        artist: trackItem.artist || "",
        album_art_url: trackItem.album_art_url || trackItem.artwork || "",
        duration_ms: trackItem.duration_ms || trackItem.duration || 240000
      };
      e.dataTransfer.setData("text/plain", JSON.stringify(trackData));
    }
  };

  const handleDragOver = (e, index) => {
    if (!isHost) return;
    e.preventDefault();
    if (draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = (e, index) => {
    if (!isHost) return;
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;

    const newQueue = [...queue];
    const draggedItem = newQueue[draggedIdx];
    newQueue.splice(draggedIdx, 1);
    newQueue.splice(index, 0, draggedItem);

    setQueue(newQueue);

    const orderedIds = newQueue.map(item => item.id);
    if (socket) {
      socket.emit('reorder_queue', { ordered_ids: orderedIds });
    }

    setDraggedIdx(null);
    setDragOverIdx(null);
  };


  const handleCloseConfirm = () => {
    if (!socket || !isHost) return;
    fetch(`/rooms/${roomId}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          socket.emit('leave_room', { room_id: roomId });
          window.location.href = '/';
        }
      });
  };

  const handlePasswordSubmit = (e) => {
    if (e) e.preventDefault();
    if (!roomPassword.trim() || !socket) return;
    
    setPasswordError('');
    const avatarUrl = localStorage.getItem('openjam_avatar_url');
    socket.emit('join_room', { room_id: roomId, password: roomPassword, avatar_url: avatarUrl });
  };

  const handleNicknameSubmit = async (e, customName = null) => {
    if (e) e.preventDefault();
    const nameToSubmit = customName !== null ? customName : nickname;
    try {
      const rJoin = await fetch('/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: nameToSubmit.trim() }),
        credentials: 'include'
      });
      if (rJoin.ok) {
        const joinData = await rJoin.json();
        setMe(joinData.user);
        if (joinData.user) {
          localStorage.setItem('openjam_display_name', joinData.user.display_name);
        }
        setShowNicknamePrompt(false);
        if (reconnect) reconnect();
        if (room) {
          setIsReady(true);
        }
      }
    } catch (err) {
      console.error('Error setting nickname:', err);
    }
  };

  const handleCopyInvite = () => {
    if (typeof window === 'undefined') return;
    const inviteUrl = `${window.location.origin}/room/${roomId}`;
    
    const fallbackCopy = (text) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        triggerToast('Invite link copied!', 'success');
      } catch (e) {
        triggerToast('Failed to copy link', 'error');
      }
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(inviteUrl)
        .then(() => triggerToast('Invite link copied!', 'success'))
        .catch(() => fallbackCopy(inviteUrl));
    } else {
      fallbackCopy(inviteUrl);
    }
  };


  if (!room) {
    return (
      <div className="room-loading-screen" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-1)',
        fontFamily: 'var(--font-display)',
        gap: '16px'
      }}>
        <div className="search-loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        <p style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '0.05em' }}>Connecting to Jam Room...</p>
      </div>
    );
  }

  const currentSidebarTab = (activeTab === 'playing' || activeTab === 'queue') ? 'queue' : activeTab;

  return (
    <div className="room-page-layout">
      {/* Toast stack */}
      <div className="toast-stack" id="toasts" aria-live="assertive" aria-label="Notifications">
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

      {/* Dynamic Audio-Visual Backdrop */}
      <div className="dynamic-bg-wrapper">
        <canvas id="ambient-canvas"></canvas>
        {nowPlaying?.album_art_url && (
          <img decoding="async" loading="lazy" id="dynamic-bg" className="dynamic-bg active" src={nowPlaying.album_art_url} alt="Dynamic Ambient Background" />
        )}
      </div>

      {/* Ambient background blur */}
      <div className={`room-ambient ${nowPlaying?.album_art_url ? 'active' : ''}`} id="room-ambient" style={ambientBackgroundStyle}></div>

      {/* Floating Reactions Render */}
      <div className="reaction-container" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
        {floatingReactions.map((r) => {
          const swayDirection = Math.random() > 0.5 ? 1 : -1;
          const swayOffset = Math.random() * 8 + 4;
          const finalRotation = Math.random() * 90 - 45;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: '80vh', x: `${r.x}vw`, scale: 0.6, rotate: 0 }}
              animate={{ 
                opacity: [1, 1, 0.8, 0], 
                y: '15vh', 
                x: [
                  `${r.x}vw`, 
                  `${r.x + swayDirection * (swayOffset / 2)}vw`, 
                  `${r.x - swayDirection * (swayOffset / 4)}vw`,
                  `${r.x + swayDirection * (swayOffset)}vw`
                ],
                scale: [0.6, 1.4, 1.2],
                rotate: [0, finalRotation / 2, -finalRotation / 2, finalRotation]
              }}
              transition={{ duration: 2.8, ease: 'easeOut' }}
              style={{ position: 'absolute', fontSize: '32px' }}
            >
              {r.emoji}
            </motion.div>
          );
        })}
      </div>

      {/* ══ UNIFIED PREMIUM HEADER ═════════════════════════════════ */}
      <header className="unified-header">
        <div className="header-left">
          {/* Logo */}
          <a href="/" className="navbar-brand">
            <img decoding="async" className="navbar-icon" src="/static/img/logo.png" alt="OpenJam Logo" width="24" height="24" style={{ borderRadius: '6px' }} />
            <div className="navbar-logo">Open<span>Jam</span></div>
          </a>
          
          <div className="header-separator"></div>

          {/* Room name & live badge */}
          <div className="room-header-info">
            <div className="room-bar-name-row">
              <span className="badge badge-live">
                <span className="badge-live-dot"></span>LIVE
              </span>
              <span className="room-bar-name" title={room ? room.name : 'Loading...'}>
                {room ? room.name : 'Loading…'}
              </span>
            </div>
            
            <div className="room-sub-meta">
              <div className="room-bar-host">
                {room?.host_avatar_url ? (
                  <img decoding="async" loading="lazy" className="room-host-avatar" src={room.host_avatar_url} alt={room.host_name} style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="room-host-avatar-fallback" style={{ background: nameColor(room?.host_name || 'Host') }}>
                    {initials(room?.host_name || 'Host')}
                  </div>
                )}
                <span>Hosted by <strong>{room ? room.host_name : 'Unknown'}</strong></span>
              </div>

              <div className="room-listeners" id="bar-listener-count">
                <div className="room-listeners-dot"></div>
                <span id="bar-lc-num">{room ? room.listener_count : 0}</span>
                <span style={{ opacity: 0.8, marginLeft: '2px' }}>listening</span>
              </div>
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* Genre tags */}
          <div className="room-bar-tags">
            <span className="room-bar-tag">{room?.queue_mode === 'curated' ? 'DJ Only' : 'Open Party'}</span>
            {(room?.genre_tags || []).slice(0, 2).map((tag) => (
              <span key={tag} className="room-bar-tag">{tag}</span>
            ))}
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary room-bar-icon-btn" onClick={() => setShowSettings(true)} title="Room Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
            </button>
            <button className="btn btn-secondary room-bar-invite-btn" onClick={() => setShowInvite(true)} title="Copy room invite link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
              <span className="room-bar-btn-label" style={{ marginLeft: '4px' }}>Invite</span>
            </button>
            <a href="/" className="btn btn-ghost room-bar-link" title="Back to all rooms">← All Rooms</a>
            {isHost && (
              <button className="btn btn-danger room-bar-close-btn" onClick={() => setShowClose(true)} title="Close this room">
                <X className="h-4 w-4" />
                <span className="room-bar-close-label" style={{ marginLeft: '4px' }}>Close Room</span>
              </button>
            )}
          </div>

          <div className="header-user-separator"></div>

          {/* User profile */}
          <div className="navbar-right" style={{ display: me ? 'flex' : 'none' }}>
            {me?.is_registered ? (
              <a href="/profile" target="_blank" rel="noopener noreferrer" className="navbar-user" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }} title="View Profile Settings (Opens in new tab)">
                {me?.avatar_url ? (
                  <img decoding="async" loading="lazy" className="avatar avatar-sm" src={me.avatar_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div className="avatar avatar-sm" style={{ backgroundColor: nameColor(me?.display_name || '?'), width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                    {initials(me?.display_name || '?')}
                  </div>
                )}
                <span className="navbar-username" style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600 }}>{me?.display_name}</span>
              </a>
            ) : (
              <div className="navbar-user" style={{ cursor: 'default' }} title="Temporary Guest Session">
                <div className="avatar avatar-sm" style={{ backgroundColor: nameColor(me?.display_name || '?'), width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                  {initials(me?.display_name || '?')}
                </div>
                <span className="navbar-username" style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600 }}>{me?.display_name} (Guest)</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ ROOM CONTENT — Premium Tabbed 2-Column Layout ════════════ */}
      <div className="room-content" id="room-grid">
        
        <div 
          className={`room-now-playing ${activeTab === 'playing' ? 'tab-active' : ''}`} 
          id="panel-left" 
          style={{ position: 'relative' }}
          onDragEnter={(e) => {
            if (isHost) {
              e.preventDefault();
              setIsDraggingOverNP(true);
            }
          }}
          onDragOver={(e) => {
            if (isHost) e.preventDefault();
          }}
          onDragLeave={() => {
            setIsDraggingOverNP(false);
          }}
          onDrop={(e) => {
            setIsDraggingOverNP(false);
            if (!isHost || !socket) return;
            e.preventDefault();
            try {
              const dataStr = e.dataTransfer.getData("text/plain");
              if (!dataStr) return;
              
              let track = null;
              try {
                track = JSON.parse(dataStr);
              } catch (err) {
                return; // Not a JSON payload, ignore silently
              }
              
              if (track && (track.uri || track.track_uri)) {
                const trackUri = track.track_uri || track.uri;
                const trackName = track.track_name || track.name || track.title;
                const artist = track.artist || "";
                const albumArtUrl = track.album_art_url || track.artwork || "";
                const durationMs = track.duration_ms || (track.duration ? track.duration * 1000 : 240000);

                
                
                // Instantly update room playback and database state
                socket.emit('play_now', {
                  track_uri: trackUri,
                  track_name: trackName,
                  artist: artist,
                  album_art_url: albumArtUrl,
                  duration_ms: durationMs,
                });
                
                triggerToast(`Playing "${trackName}" instantly!`, "success");
              }
            } catch (err) {
              console.error("Drop-to-play error:", err);
            }
          }}
        >
          {isDraggingOverNP && (
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 159, 28, 0.12)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '2px dashed var(--theme-accent, #ff9f1c)',
                borderRadius: '24px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                pointerEvents: 'none',
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              <div 
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '50%',
                  width: '64px',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <Music className="h-8 w-8 text-amber animate-pulse" style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                Drop to Play Instantly
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                Only the host can change live music
              </span>
            </div>
          )}
          <MusicPlayer
            theme="openjam"
            currentTrack={nowPlaying ? {
              id: nowPlaying.id || nowPlaying.track_uri,
              title: nowPlaying.track_name || 'Unknown Track',
              artist: nowPlaying.artist || 'Unknown Artist',
              artwork: nowPlaying.album_art_url || '',
              duration: Math.floor((nowPlaying.duration_ms || playbackState.durationMs || 240000) / 1000)
            } : null}
            queue={queue.map((q, idx) => ({
              id: q.id || q.track_uri || String(idx),
              title: q.track_name || 'Unknown Track',
              artist: q.artist || 'Unknown Artist',
              artwork: q.album_art_url || '',
              duration: Math.floor((q.duration_ms || 240000) / 1000),
              votes: q.votes || 0,
              isOwn: me && q.added_by_id === me.id
            }))}
            history={history}
            currentIndex={queue.findIndex(q => q.track_uri === nowPlaying?.track_uri)}
            currentTime={Math.floor(playbackState.positionMs / 1000)}
            isPlaying={playbackState.isPlaying}
            volume={volume}
            isMuted={isMuted}
            isHost={isHost}
            showEqualizer={true}
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSearchQueryChange={setSearchQuery}
            onAddTrack={handleAddTrack}
            onVoteTrack={handleVoteQueueTrack}
            onRemoveTrack={handleRemoveQueueTrack}
            onBulkAddClick={() => setShowBulkAdd(true)}
            onPlayPause={handleTogglePlay}
            isLiked={nowPlaying && favourites.some(f => f.track_uri === nowPlaying.track_uri)}
            onLikeToggle={handleLikeToggle}
            isShuffled={false}
            onShuffleToggle={handleShuffleClick}
            repeatMode={playbackState.loop ? 'one' : 'off'}
            onRepeatModeChange={handleRepeatToggle}
            onSeek={(seconds) => {
              if (!isHost || !playbackState.durationMs || !socket || !playerRef.current) return;
              const newPositionMs = seconds * 1000;
              setPlaybackState(prev => ({ ...prev, positionMs: newPositionMs }));
              playerRef.current.syncPosition(newPositionMs, playbackState.isPlaying);
              socket.emit('playback_update', {
                room_id: roomId,
                track_uri: nowPlaying?.track_uri,
                track_name: nowPlaying?.track_name,
                artist: nowPlaying?.artist,
                album_art_url: nowPlaying?.album_art_url,
                position_ms: newPositionMs,
                duration_ms: playbackState.durationMs,
                is_playing: playbackState.isPlaying,
                loop: false,
                is_buffering: playbackState.isPlaying ? !!streamErrorMsg : false
              });
            }}
            onNext={isHost ? handleNextTrack : handleVoteSkip}
            onVolumeChange={(newVolume) => {
              setVolume(newVolume);
              if (newVolume > 0 && isMuted) {
                setIsMuted(false);
              }
            }}
            onMuteToggle={() => {
              setIsMuted(!isMuted);
            }}
            lyricsVisible={lyricsVisible}
            lyricsText={lyricsText}
            lyricsLoading={lyricsLoading}
            lyricsActiveIdx={lyricsActiveIdx}
            onLyricsToggle={() => setLyricsVisible(!lyricsVisible)}
            size={playerSize}
            isBuffering={!!streamErrorMsg}
            bufferingMsg={streamErrorMsg}
          />

          {/* Skip Vote count display */}
          {!isHost && skipVotes.required > 0 && (
            <div className="np-skip-votes" style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
              Skip Votes: <strong>{skipVotes.votes}</strong> / {skipVotes.required}
            </div>
          )}


        </div>

        <div className={`room-sidebar ${activeTab !== 'playing' ? 'tab-active' : ''}`} id="room-sidebar">
          {/* Tabs at the top */}
          <div className="sidebar-tabs">
            <button 
              className={`sidebar-tab ${currentSidebarTab === 'queue' ? 'active' : ''}`} 
              onClick={() => setActiveTab('queue')}
            >
              Queue ({queue.length})
            </button>
            <button 
              className={`sidebar-tab ${currentSidebarTab === 'chat' ? 'active' : ''}`} 
              onClick={() => setActiveTab('chat')}
            >
              Chat ({listeners.length})
            </button>
            <button 
              className={`sidebar-tab ${currentSidebarTab === 'members' ? 'active' : ''}`} 
              onClick={() => setActiveTab('members')}
            >
              People
            </button>
          </div>

          <div className="sidebar-tab-content">
            <AnimatePresence mode="wait">
              {currentSidebarTab === 'queue' && (
                <motion.div
                  key="queue"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                >
                {/* Search & suggestions */}
                <div className="queue-search-wrap">
                  <div className="input-with-icon" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (!isOverSuggestions.current && !isDraggingSuggestion.current) {
                              setSearchFocused(false);
                            }
                          }, 200);
                        }}
                        placeholder="Search for any track…" 
                        autoComplete="off" 
                        style={{ width: '100%', paddingLeft: '36px', boxSizing: 'border-box' }}
                      />
                      <Search className="h-4 w-4" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                      {searchQuery && (
                        <button type="button" className="clear-btn" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <button className="btn btn-secondary btn-import" onClick={() => setShowBulkAdd(true)} style={{ padding: '10px 14px', fontSize: '12px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                      Bulk Add
                    </button>
                  </div>

                  {/* Search suggestions autocomplete */}
                  <AnimatePresence>
                    {searchFocused && (searchResults.length > 0 || (searchQuery.trim() === '' && favourites.length > 0)) && (
                      <motion.div 
                        className="search-results"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        onMouseEnter={() => { isOverSuggestions.current = true; }}
                        onMouseLeave={() => { isOverSuggestions.current = false; }}
                        style={{
                          transformOrigin: 'top center',
                          overflow: 'hidden'
                        }}
                      >
                        {searchQuery.trim() ? (
                          searchResults.map((track, idx) => (
                            <div 
                              key={`${track.uri || track.track_uri || 'track'}-${idx}`} 
                              className="search-result-item" 
                              draggable={true}
                              onDragStart={(e) => {
                                isDraggingSuggestion.current = true;
                                e.dataTransfer.setData("text/plain", JSON.stringify(track));
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onDragEnd={() => {
                                isDraggingSuggestion.current = false;
                                setTimeout(() => {
                                  if (!isOverSuggestions.current) {
                                    setSearchFocused(false);
                                  }
                                }, 100);
                              }}
                              onClick={() => {
                                handleAddTrack(track);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', cursor: 'grab' }}
                            >
                              <img decoding="async" loading="lazy" draggable="false" src={track.album_art_url || '/placeholder.svg'} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.track_name || track.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</span>
                              </div>
                              {me && me.is_registered && playlists.length > 0 && (
                                <select
                                  style={{
                                    background: 'rgba(0,0,0,0.6)',
                                    border: '1px solid rgba(255, 159, 28, 0.2)',
                                    color: '#fff',
                                    fontSize: '11px',
                                    padding: '2px 4px',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    maxWidth: '80px'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    const playlistId = e.target.value;
                                    if (!playlistId) return;
                                    try {
                                      const res = await fetch(`/playlists/${playlistId}/tracks`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          track_uri: track.uri || track.track_uri,
                                          track_name: track.track_name || track.name,
                                          artist: track.artist,
                                          album_art_url: track.album_art_url || track.src,
                                          duration_ms: track.duration_ms || 240000
                                        })
                                      });
                                      if (res.ok) {
                                        triggerToast('Added to playlist!', 'success');
                                      } else {
                                        triggerToast('Failed to add track', 'error');
                                      }
                                    } catch (err) {
                                      triggerToast('Connection error', 'error');
                                    }
                                    e.target.value = '';
                                  }}
                                  defaultValue=""
                                >
                                  <option value="" disabled>+</option>
                                  {playlists.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              )}
                              <Plus className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                            </div>
                          ))
                        ) : (
                          <>
                            {favourites.length > 0 ? (
                              <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--amber)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Heart className="h-3.5 w-3.5 fill-current" /> Favourite Tracks
                              </div>
                            ) : null}
                            {favourites.map((track, idx) => (
                              <div 
                                key={`fav-${track.track_uri}-${idx}`} 
                                className="search-result-item" 
                                onClick={() => {
                                  const payload = {
                                    track_uri: track.track_uri,
                                    track_name: track.track_name,
                                    artist: track.artist,
                                    album_art_url: track.album_art_url,
                                    duration_ms: track.duration_ms
                                  };
                                  handleAddTrack(payload);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', cursor: 'pointer' }}
                              >
                                <img decoding="async" loading="lazy" draggable="false" src={track.album_art_url || '/placeholder.svg'} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.track_name}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</span>
                                </div>
                                <Plus className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                              </div>
                            ))}
                            {favourites.length === 0 && (
                              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-3)', lineHeight: 1.5 }}>
                                Search for tracks and tap the <Heart className="h-3 w-3 inline-block fill-current text-amber" style={{ margin: '0 2px' }} /> icon in the player to save favourites here!
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Queue / History List Container */}
                <div 
                  className={`queue-list ${isDraggingOverQueue ? 'dragging-over' : ''}`}
                  onDragEnter={(e) => {
                    if (draggedIdx === null) {
                      e.preventDefault();
                      setIsDraggingOverQueue(true);
                    }
                  }}
                  onDragOver={(e) => {
                    if (draggedIdx === null) e.preventDefault();
                  }}
                  onDragLeave={() => {
                    setIsDraggingOverQueue(false);
                  }}
                  onDrop={(e) => {
                    setIsDraggingOverQueue(false);
                    e.preventDefault();
                    if (draggedIdx !== null) return; // Reordering is handled by individual items, ignore here
                    try {
                      const dataStr = e.dataTransfer.getData("text/plain");
                      if (dataStr) {
                        let track = null;
                        try {
                          track = JSON.parse(dataStr);
                        } catch (parseErr) {
                          return; // Ignore invalid formats silently
                        }
                        if (track && (track.uri || track.track_uri)) {
                          handleAddTrack(track);
                        }
                      }
                    } catch (err) {
                      console.error("Drop error:", err);
                    }
                  }}
                  style={{
                    position: 'relative',
                    border: isDraggingOverQueue ? '2px dashed var(--theme-accent, #ff9f1c)' : '2px dashed transparent',
                    background: isDraggingOverQueue ? 'rgba(255, 159, 28, 0.05)' : 'none',
                    borderRadius: '16px',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxSizing: 'border-box'
                  }}
                >
                  <div className="queue-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="queue-tabs" style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={`queue-tab ${activeQueueTab === 'queue' ? 'active' : ''}`}
                        onClick={() => setActiveQueueTab('queue')}
                      >
                        Queue
                      </button>
                      <button 
                        className={`queue-tab ${activeQueueTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveQueueTab('history')}
                      >
                        History
                      </button>
                    </div>
                  </div>

                  {activeQueueTab === 'queue' ? (
                    queue.length > 0 ? (
                      queue.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className="queue-item"
                          draggable={isHost}
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, idx)}
                          style={{
                            cursor: isHost ? 'grab' : 'default',
                            borderTop: dragOverIdx === idx ? '2.5px solid var(--theme-accent, #ff9f1c)' : 'none',
                            opacity: draggedIdx === idx ? 0.4 : 1,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <img decoding="async" loading="lazy" draggable="false" className="q-track-art" src={item.album_art_url || '/placeholder.svg'} alt="" />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span className="q-track-title" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.track_name}</span>
                            <span className="q-track-artist" style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-4)', marginTop: '2px' }}>added by @{item.added_by_name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {downloadedTracks.has(item.track_uri || item.id) ? (
                              <button className="btn-vote" disabled title="Downloaded" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', cursor: 'default' }}>
                                <Check size={12} />
                              </button>
                            ) : downloadingTracks[item.track_uri || item.id] !== undefined ? (
                              <button className="btn-vote" disabled style={{ color: 'var(--amber)' }}>
                                {downloadingTracks[item.track_uri || item.id]}%
                              </button>
                            ) : (
                              <button 
                                className="btn-vote" 
                                onClick={() => handleDownloadTrack({
                                  track_uri: item.track_uri || item.id,
                                  track_name: item.track_name,
                                  artist: item.artist,
                                  album_art_url: item.album_art_url,
                                  duration_ms: item.duration_ms
                                })} 
                                title="Download Track"
                              >
                                <Download size={12} />
                              </button>
                            )}
                            {me && me.is_registered && playlists.length > 0 && (
                              <select
                                style={{
                                  background: 'rgba(0,0,0,0.4)',
                                  border: '1px solid rgba(255, 159, 28, 0.15)',
                                  color: 'var(--text-2)',
                                  padding: '4px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  maxWidth: '40px'
                                }}
                                onChange={async (e) => {
                                  const playlistId = e.target.value;
                                  if (!playlistId) return;
                                  try {
                                    const res = await fetch(`/playlists/${playlistId}/tracks`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        track_uri: item.track_uri,
                                        track_name: item.track_name,
                                        artist: item.artist,
                                        album_art_url: item.album_art_url,
                                        duration_ms: item.duration_ms || 240000
                                      })
                                    });
                                    if (res.ok) {
                                      triggerToast('Added to playlist!', 'success');
                                    } else {
                                      triggerToast('Failed to add track', 'error');
                                    }
                                  } catch (err) {
                                    triggerToast('Connection error', 'error');
                                  }
                                  e.target.value = '';
                                }}
                                defaultValue=""
                              >
                                <option value="" disabled>+</option>
                                {playlists.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            )}
                            <button 
                              className={`btn-vote ${item.voted ? 'voted' : ''}`}
                              onClick={() => handleVoteQueueTrack(item.id)}
                            >
                              ▲ {item.votes}
                            </button>
                            {(isHost || (me && item.added_by_id === me.id)) && (
                              <button className="btn-remove" onClick={() => handleRemoveQueueTrack(item.id)}>
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))

                    ) : (
                      <div className="empty">
                        <div className="empty-illustration">
                          <Music className="h-12 w-12" style={{ opacity: 0.2 }} />
                        </div>
                        <div className="empty-title">Queue is empty</div>
                        <div className="empty-sub">Search above to add tracks</div>
                      </div>
                    )
                  ) : (
                    history.length > 0 ? (
                      history.map((item, idx) => (
                        <div 
                          key={item.id || idx} 
                          className="queue-item history-item"
                          draggable={isHost}
                          onDragStart={(e) => {
                            if (!isHost) return;
                            const trackData = {
                              uri: item.track_uri || item.id,
                              name: item.track_name || item.title,
                              artist: item.artist,
                              album_art_url: item.album_art_url || item.artwork,
                              duration_ms: item.duration_ms || item.duration
                            };
                            e.dataTransfer.setData("text/plain", JSON.stringify(trackData));
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                        >
                          <img decoding="async" loading="lazy" draggable="false" className="q-track-art" src={item.album_art_url || '/placeholder.svg'} alt="" />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span className="q-track-title" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.track_name}</span>
                            <span className="q-track-artist" style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {downloadedTracks.has(item.track_uri || item.id) ? (
                              <button className="btn btn-secondary" disabled title="Downloaded" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '6px 8px', borderRadius: '8px' }}>
                                <Check size={12} />
                              </button>
                            ) : downloadingTracks[item.track_uri || item.id] !== undefined ? (
                              <button className="btn btn-secondary" disabled style={{ fontSize: '11px', padding: '6px 8px', borderRadius: '8px', color: 'var(--amber)' }}>
                                {downloadingTracks[item.track_uri || item.id]}%
                              </button>
                            ) : (
                              <button 
                                className="btn btn-secondary" 
                                onClick={() => handleDownloadTrack({
                                  track_uri: item.track_uri || item.id,
                                  track_name: item.track_name || item.title,
                                  artist: item.artist,
                                  album_art_url: item.album_art_url || item.artwork,
                                  duration_ms: item.duration_ms || item.duration
                                })} 
                                title="Download Track"
                                style={{ padding: '6px 8px', borderRadius: '8px' }}
                              >
                                <Download size={12} />
                              </button>
                            )}
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => handleAddTrack(item)} 
                              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '8px' }}
                            >
                              + Add Back
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        <div className="empty-title">History is empty</div>
                        <div className="empty-sub">Tracks played will appear here</div>
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            )}

            {currentSidebarTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="chat-panel"
                style={{ height: '100%' }}
              >
                <div className="chat-header">
                  <div className="chat-header-content">
                    <span>Room Chat</span>
                    <div className="chat-status">
                      <div className="chat-status-dot"></div>
                      <span>{listeners.length}</span> online
                    </div>
                  </div>
                </div>

                <div className="chat-messages" id="chat-msgs">
                  {chatMsgs.length > 0 ? (
                    chatMsgs.map((msg) => {
                      const isSelf = me && msg.user_id === me.id;
                      if (msg.type === 'system') {
                        return (
                          <div key={msg.id} className="chat-system-msg reaction-alert">
                            <div className="reaction-avatar-small">
                              {msg.user_avatar ? (
                                <img decoding="async" loading="lazy" className="avatar" src={msg.user_avatar} alt="" />
                              ) : (
                                <div className="avatar" style={{ backgroundColor: nameColor(msg.user_name) }}>
                                  {initials(msg.user_name)}
                                </div>
                              )}
                            </div>
                            <div className="reaction-alert-content">
                              <span className="reaction-user-name">{msg.user_name}</span> reacted with <span className="reaction-emoji">{msg.content}</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className={`chat-message ${isSelf ? 'self' : ''}`}>
                          {msg.user_avatar ? (
                            <img decoding="async" loading="lazy" className="avatar" src={msg.user_avatar} alt="" style={{ objectFit: 'cover' }} />
                          ) : (
                            <div 
                              className="avatar"
                              style={{ backgroundColor: nameColor(msg.user_name) }}
                            >
                              {initials(msg.user_name)}
                            </div>
                          )}
                          <div className="chat-msg-body">
                            <div className="chat-msg-bubble">
                              <div className="chat-msg-header">
                                <span className="chat-msg-name">{msg.user_name}</span>
                              </div>
                              <div className="chat-msg-text">{msg.content}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty">
                      <div className="empty-illustration">
                        <Music className="h-12 w-12" style={{ opacity: 0.2 }} />
                      </div>
                      <div className="empty-title">No messages yet</div>
                      <div className="empty-sub">Say hi to the room!</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Reactions floating dock */}
                <div className="reactions-bar">
                  {['🔥', '❤️', '😂', '🎵', '👏'].map((emoji) => (
                    <button 
                      key={emoji}
                      className="btn-react"
                      onClick={() => handleSendReaction(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Chat text input */}
                <div className="chat-input-wrap">
                  <div className="chat-input-main">
                    <textarea 
                      className="input-field" 
                      id="chat-input"
                      value={chatInput}
                      onChange={handleTyping}
                      onBlur={handleStopTyping}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat(e);
                        }
                      }}
                      placeholder="Say something…" 
                      maxLength="500" 
                      rows="1"
                      style={{ flex: 1, resize: 'none', height: '40px', boxSizing: 'border-box' }}
                    />
                    <button 
                      type="button" 
                      className="chat-send-btn" 
                      disabled={!chatInput.trim()}
                      onClick={handleSendChat}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="chat-input-hint">Enter = send · Shift+Enter = new line</div>
                </div>
              </motion.div>
            )}

            {currentSidebarTab === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="members-list"
                style={{ display: 'block', height: '100%' }}
              >
                {listeners.map((user, idx) => {
                  const uid = user.user_id || user.id || `user-${idx}`;
                  return (
                    <div key={uid} className="member-item">
                      {user.avatar_url ? (
                        <img decoding="async" loading="lazy" className="avatar avatar-sm" src={user.avatar_url} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div 
                          className="avatar avatar-sm"
                          style={{ backgroundColor: nameColor(user.display_name), width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          {initials(user.display_name)}
                        </div>
                      )}
                      <span className="member-name">
                        {user.display_name}
                        {me && uid === me.id && <span className="member-you"> (you)</span>}
                      </span>
                      {room && room.host_user_id === uid && (
                        <span className="badge badge-host">Host</span>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

            </div>{/* /room-content */}



      {/* ══ MOBILE MINI PLAYER ════════════════════════════════════ */}
      <div className={`mobile-mini-player ${activeTab !== 'playing' && nowPlaying ? 'is-visible' : ''}`} id="mobile-mini-player">
        <div className="mini-player-progress-track">
          <div className="mini-player-progress-fill" style={{ width: `${playbackState.durationMs > 0 ? (playbackState.positionMs / playbackState.durationMs) * 100 : 0}%` }}></div>
        </div>
        <button type="button" className="mini-player-main" onClick={() => setActiveTab('playing')}>
          <img decoding="async" className="mini-art" src={nowPlaying?.album_art_url || '/static/img/logo.png'} alt="" width="44" height="44" style={{ borderRadius: '6px', objectFit: 'cover' }} />
          <div className="mini-info">
            <div className="mini-title">{nowPlaying ? nowPlaying.track_name : 'Nothing playing'}</div>
            <div className="mini-artist">{nowPlaying ? nowPlaying.artist : 'Add a track to the queue'}</div>
          </div>
        </button>
        <button type="button" className="mini-play-btn" onClick={handleTogglePlay}>
          {playbackState.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>
      </div>

      {/* ══ MOBILE BOTTOM TABS ══════════════════════════════════ */}
      <nav className="mobile-bottom-tabs" id="mob-tabs">
        <button className={`mob-tab ${activeTab === 'playing' ? 'active' : ''}`} onClick={() => setActiveTab('playing')}>
          <Music className="h-5 w-5" />
          <span className="mob-tab-label">Playing</span>
        </button>
        <button className={`mob-tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
          <span className="mob-tab-label">Queue</span>
        </button>
        <button className={`mob-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <Send className="h-5 w-5" />
          <span className="mob-tab-label">Chat</span>
        </button>
        <button className={`mob-tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          <Users className="h-5 w-5" />
          <span className="mob-tab-label">People</span>
        </button>
      </nav>

      {/* ══ PASSWORD REQUIRED MODAL ════════════════════════════ */}
      <AnimatePresence>
        {showPassword && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 1100 }}>
            <motion.div 
              className="modal-box"
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}><span style={{ color: 'var(--amber)' }}>🔒</span> Private Room</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>This room is private and requires a password to join.</p>
              <form onSubmit={handlePasswordSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label className="modal-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-2)' }}>Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={roomPassword}
                    onChange={(e) => { setRoomPassword(e.target.value); setPasswordError(''); }}
                    placeholder="Enter room password"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    required
                  />
                  {passwordError && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>{passwordError}</div>
                  )}
                </div>
                <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <motion.button 
                    type="button" 
                    className="btn btn-secondary btn-bubble btn-guest-bubble" 
                    onClick={() => window.location.href = '/'}
                    whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(255, 255, 255, 0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px' }}
                  >
                    <div className="bubble-bg b1" />
                    <div className="bubble-bg b2" />
                    <div className="bubble-bg b3" />
                    <div className="bubble-bg b4" />
                    <span className="btn-bubble-content">Leave</span>
                  </motion.button>
                  <motion.button 
                    type="submit" 
                    className="btn btn-primary btn-bubble" 
                    whileHover={{ scale: 1.05, boxShadow: '0 8px 20px rgba(255, 176, 58, 0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px' }}
                  >
                    <div className="bubble-bg b1" />
                    <div className="bubble-bg b2" />
                    <div className="bubble-bg b3" />
                    <div className="bubble-bg b4" />
                    <span className="btn-bubble-content">Join Room</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ NICKNAME PROMPT MODAL ════════════════════════════ */}
      <AnimatePresence>
        {showNicknamePrompt && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 1200 }}>
            <motion.div 
              className="modal-box"
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                <span style={{ color: 'var(--amber)' }}>🎧</span> Choose a Nickname
              </div>
              <p style={{ color: 'var(--text-2)', marginBottom: '20px', fontSize: '13.5px', textAlign: 'center', lineHeight: '1.5' }}>
                Welcome to the Jam Room! Let the group know who you are.
              </p>
              <form onSubmit={handleNicknameSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label className="modal-label" style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. DJ Awesome"
                    maxLength={25}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
                <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <motion.button 
                    type="button" 
                    className="btn btn-secondary btn-bubble btn-guest-bubble" 
                    onClick={() => handleNicknameSubmit(null, '')}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ padding: '0 20px', borderRadius: '12px', height: '40px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="btn-bubble-content">Skip & Join</span>
                  </motion.button>
                  <motion.button 
                    type="submit" 
                    className="btn btn-primary btn-bubble" 
                    whileHover={{ scale: 1.03, boxShadow: '0 8px 20px rgba(255, 176, 58, 0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{ padding: '0 24px', borderRadius: '12px', height: '40px', fontSize: '13px', fontWeight: 700, background: 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #f26419 100%)', border: 'none', color: '#0c0c10' }}
                  >
                    <div className="bubble-bg b1" />
                    <div className="bubble-bg b2" />
                    <div className="bubble-bg b3" />
                    <div className="bubble-bg b4" />
                    <span className="btn-bubble-content">Join Room</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ SETTINGS MODAL ════════════════════════════════════════ */}
      <AnimatePresence>
        {showSettings && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 1200 }} onClick={() => setShowSettings(false)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', padding: '24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="modal-title" style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings className="h-5 w-5" style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
                  <span>Room Settings</span>
                </div>
                <motion.button 
                  className="btn btn-ghost" 
                  onClick={() => setShowSettings(false)} 
                  style={{ fontSize: '16px', padding: '4px 8px' }}
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              <div className="settings-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)' }}>Notification Sounds</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Play audio cues for chat messages & alerts</div>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={settingsSound} 
                      onChange={(e) => {
                        setSettingsSound(e.target.checked);
                        localStorage.setItem('openjam_setting_sound', e.target.checked);
                      }}
                    />
                    <span className="toggle-switch-slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)' }}>Visual Effects</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Enable dynamic color bleed and blurs</div>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={settingsVisuals} 
                      onChange={(e) => {
                        setSettingsVisuals(e.target.checked);
                        localStorage.setItem('openjam_setting_visuals', e.target.checked);
                      }}
                    />
                    <span className="toggle-switch-slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)' }}>Haptic Feedback</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Enable vibrations on interactions (mobile)</div>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={settingsHaptics} 
                      onChange={(e) => {
                        setSettingsHaptics(e.target.checked);
                        localStorage.setItem('openjam_setting_haptics', e.target.checked);
                      }}
                    />
                    <span className="toggle-switch-slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)' }}>Desktop Notifications</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Receive notifications for chat & room alerts</div>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={settingsNotifications} 
                      onChange={(e) => handleToggleNotifications(e.target.checked)}
                    />
                    <span className="toggle-switch-slider"></span>
                  </label>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ INVITE FRIEND MODAL ══════════════════════════════════ */}
      <AnimatePresence>
        {showInvite && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 1200 }} onClick={() => setShowInvite(false)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '440px', width: '90%', padding: '24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="modal-title" style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users className="h-5 w-5" style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
                  <span>Invite Friends</span>
                </div>
                <motion.button 
                  className="btn btn-ghost" 
                  onClick={() => setShowInvite(false)} 
                  style={{ fontSize: '16px', padding: '4px 8px' }}
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              {/* QR Code Section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '24px 16px', textAlign: 'center' }}>
                <div style={{ 
                  background: '#ffffff', 
                  padding: '12px', 
                  borderRadius: '16px', 
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 25px rgba(255, 159, 28, 0.15)',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img decoding="async" loading="lazy" 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : '')}`}
                    alt="Room QR Code" 
                    style={{ width: '140px', height: '140px', display: 'block', borderRadius: '8px' }}
                  />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)' }}>Scan to Join Instantly</span>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>Share your screen or scan with a phone camera</span>
              </div>

              {/* Link Copier */}
              <div style={{ marginBottom: '8px' }}>
                <label className="modal-label" style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Room URL Link</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : ''}
                    style={{ flex: 1, fontSize: '13px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '10px 14px', borderRadius: '10px', color: 'var(--text-1)' }}
                  />
                  <button className="btn btn-primary" onClick={handleCopyInvite} style={{ padding: '0 20px', fontSize: '13px', borderRadius: '10px', fontWeight: 600 }}>Copy Link</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ BULK IMPORT MODAL ══════════════════════════════════════ */}
      <AnimatePresence>
        {showBulkAdd && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 1000 }} onClick={() => setShowBulkAdd(false)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ 
                maxWidth: '520px', 
                width: '90%', 
                background: 'rgba(15, 15, 24, 0.75)', 
                backdropFilter: 'blur(30px) saturate(1.8)', 
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '28px',
                padding: '32px 28px',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(255, 255, 255, 0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                <div style={{ 
                  width: '46px', 
                  height: '46px', 
                  borderRadius: '14px', 
                  background: 'rgba(255, 159, 28, 0.1)', 
                  border: '1px solid rgba(255, 159, 28, 0.2)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--theme-accent, #ff9f1c)'
                }}>
                  <Music className="h-5 w-5" />
                </div>
                <div>
                  <div className="modal-title" style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px', color: '#ffffff', letterSpacing: '-0.3px' }}>Bulk Add Tracks</div>
                  <p style={{ color: 'var(--text-3)', fontSize: '12px', margin: 0 }}>Add multiple songs at once — one track per line.</p>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <textarea
                  className="input-field"
                  rows="7"
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder="e.g.&#10;Bohemian Rhapsody - Queen&#10;Blinding Lights - The Weeknd&#10;https://youtube.com/watch?v=..."
                  style={{ 
                    resize: 'vertical',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '16px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    width: '100%',
                    boxSizing: 'border-box',
                    lineHeight: '1.6',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.3)'
                  }}
                />
                
                {/* Detected count indicators */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: '8px', 
                  padding: '0 4px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  <span style={{ color: 'var(--text-3)' }}>Separate lines by pressing Enter</span>
                  <span style={{ 
                    color: bulkImportText.trim() ? 'var(--theme-accent, #ff9f1c)' : 'var(--text-4)',
                    background: bulkImportText.trim() ? 'rgba(255, 159, 28, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: bulkImportText.trim() ? '1px solid rgba(255, 159, 28, 0.15)' : '1px solid rgba(255, 255, 255, 0.04)'
                  }}>
                    {(() => {
                      const count = bulkImportText.trim() ? bulkImportText.split('\n').map(l => l.trim()).filter(l => l.length > 0).length : 0;
                      return count > 0 ? `${count} track${count > 1 ? 's' : ''} detected` : '0 tracks';
                    })()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <motion.button 
                  className="btn btn-secondary" 
                  onClick={() => setShowBulkAdd(false)}
                  whileHover={{ scale: 1.02, background: 'rgba(255, 255, 255, 0.06)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{ padding: '0 20px', borderRadius: '14px', height: '40px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Cancel
                </motion.button>
                <motion.button 
                  className="btn btn-primary" 
                  onClick={handleImportBulk} 
                  disabled={!bulkImportText.trim()}
                  whileHover={!bulkImportText.trim() ? undefined : { scale: 1.02, boxShadow: '0 8px 20px rgba(255, 159, 28, 0.25)' }}
                  whileTap={!bulkImportText.trim() ? undefined : { scale: 0.98 }}
                  style={{ 
                    padding: '0 22px', 
                    borderRadius: '14px', 
                    height: '40px', 
                    fontSize: '13px',
                    fontWeight: 700,
                    background: bulkImportText.trim() ? 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #f26419 100%)' : 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: bulkImportText.trim() ? '#0c0c10' : 'rgba(255,255,255,0.25)'
                  }}
                >
                  Import Tracks
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ══ CLOSE ROOM CONFIRMATION MODAL ════════════════════════════ */}
      <AnimatePresence>
        {showClose && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 1000 }} onClick={() => setShowClose(false)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '32px 24px' }}
            >
              <motion.div
                style={{ fontSize: '48px', marginBottom: '16px', display: 'inline-block', transformOrigin: 'center center' }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 1.2, ease: 'easeInOut', times: [0, 0.2, 0.4, 0.6, 0.8, 1], delay: 0.15 }}
              >
                ⚠️
              </motion.div>
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#ffffff' }}>Close Jam Room?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '28px', fontSize: '13.5px', lineHeight: 1.5 }}>
                This will permanently close the session for everyone currently inside. All listeners will be disconnected.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' }}>
                <motion.button 
                  className="btn btn-secondary" 
                  onClick={() => setShowClose(false)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ padding: '0 24px', borderRadius: '12px', height: '40px', fontSize: '13px', flex: 1, fontWeight: 600 }}
                >
                  Cancel
                </motion.button>
                <motion.button 
                  className="btn btn-danger" 
                  onClick={handleCloseConfirm} 
                  whileHover={{ scale: 1.03, boxShadow: '0 0 16px rgba(239, 68, 68, 0.3)' }}
                  whileTap={{ scale: 0.97 }}
                  style={{ padding: '0 24px', borderRadius: '12px', height: '40px', fontSize: '13px', flex: 1, fontWeight: 600, background: 'var(--red, #ef4444)', border: 'none', color: '#ffffff' }}
                >
                  Close Room
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic YouTube Fallback Iframe Container */}
      <div id="yt-fallback-container" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}></div>
      <PwaInstallPrompt />
    </div>
  );
}
