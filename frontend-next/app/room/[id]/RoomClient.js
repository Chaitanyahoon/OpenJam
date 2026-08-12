'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'next/navigation';
import YouTubePlayer from '@/utils/YouTubePlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicPlayer } from '@/components/ui/music-player';
import { Search, Plus, X, Music, Settings, Users, Send, Volume2, VolumeX, Play, Pause, Heart, CheckCircle, AlertCircle, AlertTriangle, Info, Download, Check, Flame, Smile, Save, RefreshCw, ListPlus } from 'lucide-react';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import { offlineDb } from '@/utils/offlineDb';
import EmojiPicker from '@/components/EmojiPicker';
import { extractColors } from '@/utils/colorExtractor';

import DiscordRPC from '@/utils/DiscordRPC';

export default function RoomClient({ roomId }) {
  const { socket, isConnected, isReconnecting, isConnectionFailed, reconnect } = useSocket();
  const router = useRouter();
  const playerRef = useRef(null);
  const discordRpcRef = useRef(null);
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
  const [activeQueueTab, setActiveQueueTab] = useState('queue'); // queue, history, playlists
  const [playerSize, setPlayerSize] = useState(280);
  const [activeRoomPlaylist, setActiveRoomPlaylist] = useState(null);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  
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
  const [recommendations, setRecommendations] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

  // Modals & Panels
  const [activeDropdownTrackUri, setActiveDropdownTrackUri] = useState(null);
  const [activeQueueDropdownId, setActiveQueueDropdownId] = useState(null);
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);
  const [showReactionEmojiPicker, setShowReactionEmojiPicker] = useState(false);
  const [syncLatency, setSyncLatency] = useState(null);
  const clockStatsRef = useRef({ offset: 0, rtt: 0, history: [] });
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
  const [isReady, setIsReady] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [isDraggingOverNP, setIsDraggingOverNP] = useState(false);
  const [isDraggingOverSidebarNP, setIsDraggingOverSidebarNP] = useState(false);
  const [isDraggingOverQueue, setIsDraggingOverQueue] = useState(false);


  // Refs for scrolling and canvas
  const chatEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastReactionId = useRef(0);
  const isOverSuggestions = useRef(false);
  const isDraggingSuggestion = useRef(false);
  const reactionContainerRef = useRef(null);
  const lastReactionSentRef = useRef(0);
  const colorsRef = useRef(['#ff9f1c', '#8b5cf6', '#ec4899']);

  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
    if (!nowPlaying?.album_art_url) {
      colorsRef.current = ['#ff9f1c', '#8b5cf6', '#ec4899'];
    } else {
      extractColors(nowPlaying.album_art_url).then((colors) => {
        colorsRef.current = colors;
      });
    }
  }, [nowPlaying]);

  // Discord Rich Presence (RPC) Integration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rpc = new DiscordRPC();
    discordRpcRef.current = rpc;
    rpc.connect();
    return () => {
      rpc.destroy();
      discordRpcRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (discordRpcRef.current && nowPlaying) {
      discordRpcRef.current.setActivity({
        details: nowPlaying.track_name || 'Listening to music',
        state: `by ${nowPlaying.artist || 'Unknown Artist'}`,
        timestamps: {
          start: Date.now() - (playbackState.positionMs || 0)
        },
        buttons: [
          { label: 'Listen Along', url: typeof window !== 'undefined' ? window.location.href : 'https://www.openjam.fun' }
        ]
      });
    } else if (discordRpcRef.current && !nowPlaying) {
      discordRpcRef.current.clearActivity();
    }
  }, [nowPlaying, playbackState.positionMs]);

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
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeRoomPath', window.location.pathname);
    }
    const fetchRecommendations = async () => {
      try {
        const res = await fetch('/search/recommendations');
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.tracks || []);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      }
    };
    fetchRecommendations();
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('room-page');
      }
    };
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

      osc.type = 'sine';
      if (type === 'error') {
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } else {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
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
          router.push('/404');
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

  // Clock synchronization loop
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Initial burst to get quick convergence
    syncClock();
    const interval1 = setInterval(syncClock, 1000);
    const timeout = setTimeout(() => clearInterval(interval1), 5000);
    
    // Regular keep-alive sync every 15 seconds
    const interval15 = setInterval(syncClock, 15000);
    
    return () => {
      clearInterval(interval1);
      clearTimeout(timeout);
      clearInterval(interval15);
    };
  }, [socket, isConnected]);

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

    socket.on('sync_pong', (data) => {
      if (!data) return;
      const t3 = Date.now();
      const t0 = data.t0;
      const t1 = data.t1;
      const t2 = data.t2;
      
      const rtt = (t3 - t0) - (t2 - t1);
      const offset = ((t1 - t0) + (t2 - t3)) / 2;
      
      const newHistory = [...clockStatsRef.current.history, { rtt, offset }].slice(-10);
      const avgOffset = newHistory.reduce((sum, item) => sum + item.offset, 0) / newHistory.length;
      const avgRtt = newHistory.reduce((sum, item) => sum + item.rtt, 0) / newHistory.length;
      
      clockStatsRef.current = {
        offset: avgOffset,
        rtt: avgRtt,
        history: newHistory
      };
      
      setSyncLatency(Math.round(avgRtt / 2));
    });

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

        const isHostUser = meRef.current && data.room && data.room.host_user_id === meRef.current.id;
        let adjustedPosition = position;
        if (!isHostUser && data.playback?.server_timestamp) {
          const offset = clockStatsRef.current.offset || 0;
          const latency = (Date.now() + offset) - data.playback.server_timestamp;
          if (latency > 0 && latency < 5000) {
            adjustedPosition = position + latency;
            console.log(`[Sync join_success] Latency corrected: ${latency}ms (offset: ${offset}ms), adjusted from ${position} to ${adjustedPosition}`);
          } else {
            console.log(`[Sync join_success] Latency correction skipped. Latency: ${latency}ms (offset: ${offset}ms)`);
          }
        }

        playerRef.current.setTrack({
          track_uri: data.now_playing.track_uri,
          track_name: data.now_playing.track_name,
          artist: data.now_playing.artist,
          album_art_url: data.now_playing.album_art_url,
          position_ms: adjustedPosition,
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
      setChatMsgs((prev) => [...prev, msg].slice(-150));
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
      
      if (reactionContainerRef.current) {
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.textContent = data.emoji;
        
        const x = Math.random() * 60 + 20;
        const swayDirection = Math.random() > 0.5 ? 1 : -1;
        const swayOffset = Math.random() * 8 + 4;
        const finalRotation = Math.random() * 90 - 45;
        
        el.style.position = 'absolute';
        el.style.left = `${x}vw`;
        el.style.bottom = '-50px';
        el.style.pointerEvents = 'none';
        el.style.fontSize = '32px';
        el.style.zIndex = '1000';
        el.style.setProperty('--sway-offset', `${swayDirection * swayOffset}vw`);
        el.style.setProperty('--final-rotation', `${finalRotation}deg`);
        
        reactionContainerRef.current.appendChild(el);
        
        setTimeout(() => {
          el.remove();
        }, 3000);
      }

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
      ].slice(-150));
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
        loop: data.loop || false,
        server_timestamp: data.server_timestamp
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

      const isHostUser = meRef.current && roomRef.current && roomRef.current.host_user_id === meRef.current.id;

      if (playerRef.current) {
        let adjustedPosition = data.position_ms;
        if (!isHostUser && data.server_timestamp) {
          const offset = clockStatsRef.current.offset || 0;
          const latency = (Date.now() + offset) - data.server_timestamp;
          if (latency > 0 && latency < 5000) {
            adjustedPosition = data.position_ms + latency;
            console.log(`[Sync playback_sync] Latency corrected: ${latency}ms (offset: ${offset}ms), adjusted from ${data.position_ms} to ${adjustedPosition}`);
          } else {
            console.log(`[Sync playback_sync] Latency correction skipped. Latency: ${latency}ms (offset: ${offset}ms)`);
          }
        }

        if (data.track_uri && playerRef.current.currentVideoId !== data.track_uri) {
          playerRef.current.setTrack({
            track_uri: data.track_uri,
            track_name: data.track_name,
            artist: data.artist,
            album_art_url: data.album_art_url,
            position_ms: adjustedPosition,
            duration_ms: data.duration_ms,
            is_playing: data.is_playing && !isBuffering
          });
        } else if (!data.track_uri) {
          playerRef.current.stop();
        } else {
          playerRef.current.syncPosition(adjustedPosition, data.is_playing && !isBuffering);
        }
      }
      if (!isHostUser) {
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
        router.push('/');
      }, 2000);
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.off('sync_pong');
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
      
      const isHostUser = meRef.current && roomRef.current && roomRef.current.host_user_id === meRef.current.id;
      let adjustedPosition = position;
      if (!isHostUser && currentPlayback?.server_timestamp) {
        const offset = clockStatsRef.current.offset || 0;
        const latency = (Date.now() + offset) - currentPlayback.server_timestamp;
        if (latency > 0 && latency < 5000) {
          adjustedPosition = position + latency;
          console.log(`[Sync player init] Latency corrected: ${latency}ms (offset: ${offset}ms), adjusted from ${position} to ${adjustedPosition}`);
        } else {
          console.log(`[Sync player init] Latency correction skipped. Latency: ${latency}ms (offset: ${offset}ms)`);
        }
      }

      player.setTrack({
        track_uri: currentTrack.track_uri,
        track_name: currentTrack.track_name,
        artist: currentTrack.artist,
        album_art_url: currentTrack.album_art_url,
        position_ms: adjustedPosition,
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

  // 4.5. AudioContext Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.error('Failed to close AudioContext:', e);
        }
        audioContextRef.current = null;
      }
    };
  }, []);

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
      let res = await fetch(url);
      let data = null;
      if (res.ok) {
        data = await res.json();
      } else {
        // Strict match failed, try fuzzy search
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTrack)}`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData) && searchData.length > 0) {
            // Find the first result that has synced or plain lyrics
            data = searchData.find(item => item.syncedLyrics || item.plainLyrics) || searchData[0];
          }
        }
      }

      if (data) {
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
        } else if (data.plainLyrics) {
          const lines = data.plainLyrics.split('\n');
          const parsed = lines.map(line => ({ timeMs: -1, text: line.trim() }));
          setLyricsText(parsed.filter(p => p.text));
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
  }

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

    const hexToRgba = (hex, opacity = 1) => {
      if (!hex || !hex.startsWith('#')) return `rgba(255, 176, 58, ${opacity})`;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    const render = () => {
      if (!ctx) return;
      
      // Clear canvas with a solid black/dark base
      ctx.fillStyle = '#08080a';
      ctx.fillRect(0, 0, width, height);

      // Access extracted colors from ref dynamically
      const colors = colorsRef.current;
      const c1 = colors[0] || '#ff9f1c';
      const c2 = colors[1] || '#8b5cf6';
      const c3 = colors[2] || '#ec4899';

      // Draw a slow-moving, large breathing central glow portal
      const glowRadius = Math.max(width, height) * (playbackState.isPlaying ? 0.45 : 0.35) + Math.sin(phase * 2) * 5;
      const centerGrad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, glowRadius
      );
      centerGrad.addColorStop(0, playbackState.isPlaying ? hexToRgba(c1, 0.04) : hexToRgba(c1, 0.015));
      centerGrad.addColorStop(0.4, hexToRgba(c2, 0.01));
      centerGrad.addColorStop(0.8, hexToRgba(c3, 0.005));
      centerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, width, height);

      const speed = playbackState.isPlaying ? 0.008 : 0.0015;
      const targetAmplitude = (playbackState.isPlaying ? 90 : 25) / 4;
      const targetFrequency = (playbackState.isPlaying ? 0.006 : 0.0025) * 4;

      amplitude += (targetAmplitude - amplitude) * 0.05;
      frequency += (targetFrequency - frequency) * 0.05;
      phase += speed;

      // Draw flowing sine waves (dynamic album art accents)
      const waves = [
        { color: hexToRgba(c1, 0.06), freqMul: 1.0, speedMul: 1.0, phaseOffset: 0 },
        { color: hexToRgba(c2, 0.04), freqMul: 0.6, speedMul: 0.7, phaseOffset: Math.PI / 3 },
        { color: hexToRgba(c3, 0.03), freqMul: 1.4, speedMul: 1.2, phaseOffset: Math.PI / 1.5 }
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
      particles.forEach((p, idx) => {
        p.y -= p.speed * (playbackState.isPlaying ? 2.2 : 0.6);
        p.x += Math.sin(phase * 0.5 + p.offset) * 0.15;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        const particleColor = idx % 3 === 0 ? c1 : (idx % 3 === 1 ? c2 : c3);

        ctx.beginPath();
        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        radGrad.addColorStop(0, hexToRgba(particleColor, 0.09));
        radGrad.addColorStop(0.5, hexToRgba(particleColor, 0.03));
        radGrad.addColorStop(1, hexToRgba(particleColor, 0));
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

  const handleExportQueue = async () => {
    if (!queue || queue.length === 0) {
      triggerToast("Queue is empty, nothing to export!", "error");
      return;
    }

    const defaultName = `Room Queue - ${new Date().toLocaleDateString()}`;
    const playlistName = window.prompt("Enter a name for the exported playlist:", defaultName);
    if (playlistName === null) {
      return; // Cancelled
    }

    const finalName = playlistName.trim() || defaultName;

    try {
      const createRes = await fetch('/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: finalName,
          is_private: false,
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create playlist: ${createRes.statusText}`);
      }

      const createData = await createRes.json();
      const playlistId = createData.playlist.id;

      const tracks = queue.map(item => ({
        track_uri: item.track_uri || item.uri,
        track_name: item.track_name || item.name || 'Unknown Track',
        artist: item.artist || 'Unknown Artist',
        album_art_url: item.album_art_url || item.artwork || '',
        duration_ms: item.duration_ms || item.duration || 0,
      }));

      const bulkRes = await fetch(`/playlists/${playlistId}/tracks/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tracks }),
      });

      if (!bulkRes.ok) {
        throw new Error(`Failed to add tracks: ${bulkRes.statusText}`);
      }

      triggerToast(`Successfully exported ${tracks.length} tracks to playlist "${finalName}"!`, "success");
    } catch (error) {
      console.error('[Export Queue] Error:', error);
      triggerToast("Failed to export queue. Are you logged in?", "error");
    }
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
    const now = Date.now();
    if (now - lastReactionSentRef.current < 500) return;
    lastReactionSentRef.current = now;
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

  const handleInsertChatEmoji = (emoji) => {
    const textarea = document.getElementById('chat-input');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = chatInput;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      setChatInput(before + emoji + after);
      
      // Reset cursor position after React re-renders
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setChatInput(chatInput + emoji);
    }
  };

  const syncClock = () => {
    if (socket && socket.connected) {
      socket.emit('sync_ping', { t0: Date.now() });
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
    e.preventDefault();
    if (draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = (e, index) => {
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
          router.push('/');
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
        <canvas id="ambient-canvas" className={nowPlaying && settingsVisuals ? 'active' : ''}></canvas>
        {nowPlaying?.album_art_url && (
          <img decoding="async" loading="lazy" id="dynamic-bg" className="dynamic-bg active" src={nowPlaying.album_art_url} alt="Dynamic Ambient Background" />
        )}
      </div>

      {/* Ambient background blur */}
      <div className={`room-ambient ${nowPlaying?.album_art_url ? 'active' : ''}`} id="room-ambient" style={ambientBackgroundStyle}></div>

      {/* Floating Reactions Render */}
      <div ref={reactionContainerRef} className="reaction-container" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }} />

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
                  <img 
                    decoding="async" 
                    loading="lazy" 
                    className="room-host-avatar" 
                    src={room.host_avatar_url} 
                    alt={room.host_name} 
                    style={{ objectFit: 'cover' }} 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement.querySelector('.room-host-avatar-fallback');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="room-host-avatar-fallback" 
                  style={{ 
                    background: nameColor(room?.host_name || 'Host'),
                    display: room?.host_avatar_url ? 'none' : 'flex' 
                  }}
                >
                  {initials(room?.host_name || 'Host')}
                </div>
                <span>Hosted by <strong>{room ? room.host_name : 'Unknown'}</strong></span>
              </div>

              <div className="room-listeners" id="bar-listener-count">
                <div className="room-listeners-dot"></div>
                <span id="bar-lc-num">{room ? room.listener_count : 0}</span>
                <span style={{ opacity: 0.8, marginLeft: '2px' }}>listening</span>
              </div>

              {syncLatency !== null && (
                <div className="room-sync-status" title={`Clock synchronization RTT: ${syncLatency * 2}ms`}>
                  <div className="room-sync-dot"></div>
                  <span className="room-sync-text">⚡ Synced ({syncLatency}ms)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="header-actions">
            <button className="btn btn-secondary room-bar-icon-btn" onClick={() => setShowSettings(true)} title="Room Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
            </button>
            <button className="btn btn-secondary room-bar-invite-btn" onClick={() => setShowInvite(true)} title="Copy room invite link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
              <span className="room-bar-btn-label" style={{ marginLeft: '4px' }}>Invite</span>
            </button>
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
                  <img 
                    decoding="async" 
                    loading="lazy" 
                    className="avatar avatar-sm" 
                    src={me.avatar_url} 
                    alt="" 
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement.querySelector('.my-avatar-fallback');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="avatar avatar-sm my-avatar-fallback" 
                  style={{ 
                    backgroundColor: nameColor(me?.display_name || '?'), 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '50%', 
                    display: me?.avatar_url ? 'none' : 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '12px', 
                    fontWeight: 'bold' 
                  }}
                >
                  {initials(me?.display_name || '?')}
                </div>
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

      {/* Connection Warning Banner */}
      {(!isConnected || isConnectionFailed) && (
        <div 
          style={{
            background: isConnectionFailed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            borderBottom: isConnectionFailed ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fff',
            padding: '10px 24px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            top: '64px',
            zIndex: 150,
            width: '100%',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <AlertCircle size={16} style={{ color: isConnectionFailed ? '#ef4444' : '#f59e0b' }} />
          <span>
            {isConnectionFailed 
              ? 'Real-time synchronization lost. Reconnection attempts failed.' 
              : isReconnecting 
                ? 'Reconnecting to OpenJam server...' 
                : 'Connecting to real-time sync server...'}
          </span>
          <button 
            onClick={() => {
              reconnect();
            }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            Retry Now
          </button>
        </div>
      )}

      {/* ══ ROOM CONTENT — Premium Tabbed 2-Column Layout ════════════ */}
      <div className={`room-content ${activeTab !== 'playing' && nowPlaying ? 'has-mini-player' : ''}`} id="room-grid">
        
        <div 
          className={`room-now-playing ${activeTab === 'playing' ? 'tab-active' : ''}`} 
          id="panel-left" 
          style={{ position: 'relative' }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDraggingOverNP(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDragLeave={() => {
            setIsDraggingOverNP(false);
          }}
          onDrop={(e) => {
            setIsDraggingOverNP(false);
            if (!socket) return;
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
                Drop to override live playback
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
              isOwn: me && q.added_by_user_id === me.id
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
                    {searchFocused && (searchResults.length > 0 || (searchQuery.trim() === '' && (favourites.length > 0 || recommendations.length > 0))) && (
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
                                <div 
                                  style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const trackUri = track.uri || track.track_uri;
                                      setActiveDropdownTrackUri(activeDropdownTrackUri === trackUri ? null : trackUri);
                                    }}
                                    title="Add to Playlist"
                                    style={{
                                      background: activeDropdownTrackUri === (track.uri || track.track_uri) ? 'rgba(255, 159, 28, 0.15)' : 'rgba(255,255,255,0.03)',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      color: activeDropdownTrackUri === (track.uri || track.track_uri) ? 'var(--theme-accent, #ff9f1c)' : '#aaa',
                                      padding: '6px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                      e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      const trackUri = track.uri || track.track_uri;
                                      const isActive = activeDropdownTrackUri === trackUri;
                                      e.currentTarget.style.background = isActive ? 'rgba(255, 159, 28, 0.15)' : 'rgba(255,255,255,0.03)';
                                      e.currentTarget.style.color = isActive ? 'var(--theme-accent, #ff9f1c)' : '#aaa';
                                    }}
                                  >
                                    <ListPlus size={14} />
                                  </button>

                                  {activeDropdownTrackUri === (track.uri || track.track_uri) && (
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
                                          setActiveDropdownTrackUri(null);
                                        }}
                                      />
                                      <div 
                                        className="glass-card"
                                        style={{
                                          position: 'absolute',
                                          right: 0,
                                          top: '100%',
                                          marginTop: '6px',
                                          background: 'rgba(15, 15, 22, 0.98)',
                                          backdropFilter: 'blur(12px)',
                                          WebkitBackdropFilter: 'blur(12px)',
                                          border: '1px solid rgba(255, 255, 255, 0.08)',
                                          borderRadius: '12px',
                                          padding: '6px 0',
                                          minWidth: '170px',
                                          zIndex: 991,
                                          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                                          display: 'flex',
                                          flexDirection: 'column'
                                        }}
                                      >
                                        <div style={{
                                          fontSize: '10px',
                                          color: 'rgba(255,255,255,0.4)',
                                          padding: '6px 12px 6px 12px',
                                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.08em'
                                        }}>Add to Playlist</div>
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '4px 0' }}>
                                          {playlists.map(p => (
                                            <button
                                              key={p.id}
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                setActiveDropdownTrackUri(null);
                                                try {
                                                  const res = await fetch(`/playlists/${p.id}/tracks`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                      track_uri: track.uri || track.track_uri,
                                                      track_name: track.track_name || track.name,
                                                      artist: track.artist,
                                                      album_art_url: track.album_art_url || track.src,
                                                      duration_ms: track.duration_ms || 240000
                                                    }),
                                                    credentials: 'include'
                                                  });
                                                  if (res.ok) {
                                                    triggerToast('Added to playlist!', 'success');
                                                  } else {
                                                    triggerToast('Failed to add track', 'error');
                                                  }
                                                } catch (err) {
                                                  triggerToast('Connection error', 'error');
                                                }
                                              }}
                                              style={{
                                                width: '100%',
                                                background: 'none',
                                                border: 'none',
                                                color: 'rgba(255,255,255,0.8)',
                                                textAlign: 'left',
                                                padding: '8px 16px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255, 159, 28, 0.1)';
                                                e.currentTarget.style.color = 'var(--theme-accent, #ff9f1c)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'none';
                                                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                                              }}
                                            >
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                              <Plus className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                            </div>
                          ))
                        ) : (
                          <>
                            {favourites.length > 0 && (
                              <>
                                <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--amber)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Heart className="h-3.5 w-3.5 fill-current" /> Favourite Tracks
                                </div>
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
                              </>
                            )}

                            {recommendations.length > 0 && (
                              <>
                                <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--amber)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: favourites.length > 0 ? '12px' : '0' }}>
                                  <Flame className="h-3.5 w-3.5 fill-current" /> Trending Recommendations
                                </div>
                                {recommendations.map((track, idx) => (
                                  <div 
                                    key={`reco-${track.track_uri || track.uri}-${idx}`} 
                                    className="search-result-item" 
                                    onClick={() => {
                                      const payload = {
                                        track_uri: track.track_uri || track.uri,
                                        track_name: track.track_name || track.name,
                                        artist: track.artist,
                                        album_art_url: track.album_art_url,
                                        duration_ms: track.duration_ms || 240000
                                      };
                                      handleAddTrack(payload);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', cursor: 'pointer' }}
                                  >
                                    <img decoding="async" loading="lazy" src={track.album_art_url || '/placeholder.svg'} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.track_name || track.name}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</span>
                                    </div>
                                    <Plus className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                                  </div>
                                ))}
                              </>
                            )}

                            {favourites.length === 0 && recommendations.length === 0 && (
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
                      {me && me.is_registered && (
                        <button 
                          className={`queue-tab ${activeQueueTab === 'playlists' ? 'active' : ''}`}
                          onClick={() => {
                            setActiveQueueTab('playlists');
                            setActiveRoomPlaylist(null);
                          }}
                        >
                          Playlists
                        </button>
                      )}
                    </div>
                  </div>

                  {activeQueueTab === 'queue' ? (
                    queue.length > 0 ? (
                      queue.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className={`queue-item ${item.status === 'playing' ? 'playing' : ''}`}
                          draggable={item.status !== 'playing'}
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, idx)}
                          style={{
                            cursor: item.status !== 'playing' ? 'grab' : 'default',
                            borderTop: dragOverIdx === idx ? '2.5px solid var(--theme-accent, #ff9f1c)' : 'none',
                            opacity: draggedIdx === idx ? 0.4 : 1,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {/* Premium Artwork Container with onError fallback */}
                          <div style={{ width: '46px', height: '46px', position: 'relative', flexShrink: 0 }}>
                            {item.album_art_url ? (
                              <img 
                                decoding="async" 
                                loading="lazy" 
                                draggable="false" 
                                className="q-track-art" 
                                src={item.album_art_url} 
                                alt="" 
                                style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover', display: 'block' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const placeholder = e.target.parentElement.querySelector('.q-track-art-placeholder');
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="q-track-art-placeholder" 
                              style={{ 
                                display: item.album_art_url ? 'none' : 'flex', 
                                width: '100%', 
                                height: '100%', 
                                borderRadius: '10px', 
                                background: 'rgba(255,255,255,0.05)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.08)'
                              }}
                            >
                              <Music size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                            </div>
                          </div>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                            {item.status === 'playing' && (
                              <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--amber)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                                Now Playing
                              </span>
                            )}
                            <div className="q-track-title" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>{item.track_name}</div>
                            {item.artist && (
                              <div className="q-track-artist" style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>{item.artist}</div>
                            )}
                            <div style={{ fontSize: '10px', color: 'var(--text-4)', lineHeight: '1.2' }}>added by @{item.added_by_name}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {item.status === 'playing' ? (
                              playbackState.isPlaying && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingRight: '6px' }}>
                                  <div className="queue-wave" style={{ height: '12px', width: '3px', animationDelay: '0s' }}></div>
                                  <div className="queue-wave" style={{ height: '12px', width: '3px', animationDelay: '0.15s' }}></div>
                                  <div className="queue-wave" style={{ height: '12px', width: '3px', animationDelay: '0.3s' }}></div>
                                </div>
                              )
                            ) : (
                              <>
                                {me && me.is_registered && playlists.length > 0 && (
                                  <div 
                                    style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveQueueDropdownId(activeQueueDropdownId === item.id ? null : item.id);
                                      }}
                                      title="Add to Playlist"
                                      style={{
                                        background: activeQueueDropdownId === item.id ? 'rgba(255, 159, 28, 0.15)' : 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        color: activeQueueDropdownId === item.id ? 'var(--theme-accent, #ff9f1c)' : '#aaa',
                                        padding: '6px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                        e.currentTarget.style.color = '#fff';
                                      }}
                                      onMouseLeave={(e) => {
                                        const isActive = activeQueueDropdownId === item.id;
                                        e.currentTarget.style.background = isActive ? 'rgba(255, 159, 28, 0.15)' : 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.color = isActive ? 'var(--theme-accent, #ff9f1c)' : '#aaa';
                                      }}
                                    >
                                      <ListPlus size={14} />
                                    </button>

                                    {activeQueueDropdownId === item.id && (
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
                                            setActiveQueueDropdownId(null);
                                          }}
                                        />
                                        <div 
                                          className="glass-card"
                                          style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: '100%',
                                            marginTop: '6px',
                                            background: 'rgba(15, 15, 22, 0.98)',
                                            backdropFilter: 'blur(12px)',
                                            WebkitBackdropFilter: 'blur(12px)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '12px',
                                            padding: '6px 0',
                                            minWidth: '170px',
                                            zIndex: 991,
                                            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                                            display: 'flex',
                                            flexDirection: 'column'
                                          }}
                                        >
                                          <div style={{
                                            fontSize: '10px',
                                            color: 'rgba(255,255,255,0.4)',
                                            padding: '6px 12px 6px 12px',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.08em'
                                          }}>Add to Playlist</div>
                                          <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '4px 0' }}>
                                            {playlists.map(p => (
                                              <button
                                                key={p.id}
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  setActiveQueueDropdownId(null);
                                                  try {
                                                    const res = await fetch(`/playlists/${p.id}/tracks`, {
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
                                                }}
                                                style={{
                                                  width: '100%',
                                                  background: 'none',
                                                  border: 'none',
                                                  color: 'rgba(255,255,255,0.8)',
                                                  textAlign: 'left',
                                                  padding: '8px 16px',
                                                  fontSize: '12px',
                                                  fontWeight: 500,
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '8px',
                                                  transition: 'all 0.2s',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.background = 'rgba(255, 159, 28, 0.1)';
                                                  e.currentTarget.style.color = 'var(--theme-accent, #ff9f1c)';
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.background = 'none';
                                                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                                                }}
                                              >
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                                {(isHost || (me && item.added_by_user_id === me.id)) && (
                                  <button className="btn-remove" onClick={() => handleRemoveQueueTrack(item.id)}>
                                    ✕
                                  </button>
                                )}
                              </>
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
                  ) : activeQueueTab === 'history' ? (
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
                          {/* Premium Artwork Container with onError fallback */}
                          <div style={{ width: '46px', height: '46px', position: 'relative', flexShrink: 0 }}>
                            {item.album_art_url ? (
                              <img 
                                decoding="async" 
                                loading="lazy" 
                                draggable="false" 
                                className="q-track-art" 
                                src={item.album_art_url} 
                                alt="" 
                                style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover', display: 'block' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const placeholder = e.target.parentElement.querySelector('.q-track-art-placeholder');
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="q-track-art-placeholder" 
                              style={{ 
                                display: item.album_art_url ? 'none' : 'flex', 
                                width: '100%', 
                                height: '100%', 
                                borderRadius: '10px', 
                                background: 'rgba(255,255,255,0.05)', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.08)'
                              }}
                            >
                              <Music size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                            </div>
                          </div>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                            <div className="q-track-title" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>{item.track_name}</div>
                            {item.artist && (
                              <div className="q-track-artist" style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>{item.artist}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

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
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {activeRoomPlaylist === null ? (
                        playlists.length > 0 ? (
                          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
                            {playlists.map((pl) => (
                              <div 
                                key={pl.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  background: 'rgba(255, 255, 255, 0.015)',
                                  border: '1px solid rgba(255, 255, 255, 0.03)',
                                  borderRadius: '16px',
                                  padding: '12px 16px',
                                  marginBottom: '8px',
                                  gap: '10px',
                                  justifyContent: 'space-between',
                                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 159, 28, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.03)';
                                }}
                                onClick={async () => {
                                  setIsLoadingPlaylist(true);
                                  try {
                                    const res = await fetch(`/playlists/${pl.id}`, { credentials: 'include' });
                                    if (res.ok) {
                                      const data = await res.json();
                                      setActiveRoomPlaylist(data.playlist);
                                    } else {
                                      triggerToast('Failed to load playlist', 'error');
                                    }
                                  } catch (err) {
                                    triggerToast('Connection error', 'error');
                                  } finally {
                                    setIsLoadingPlaylist(false);
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                  <Music size={14} color="#888" style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {pl.name}
                                  </span>
                                </div>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    triggerToast('Adding playlist tracks to queue...', 'info');
                                    try {
                                      const resPl = await fetch(`/playlists/${pl.id}`, { credentials: 'include' });
                                      if (!resPl.ok) {
                                        triggerToast('Failed to fetch playlist tracks', 'error');
                                        return;
                                      }
                                      const plData = await resPl.json();
                                      const tracks = plData.playlist.tracks || [];
                                      if (tracks.length === 0) {
                                        triggerToast('Playlist is empty', 'warning');
                                        return;
                                      }
                                      
                                      const resQueue = await fetch(`/rooms/${roomId}/queue/multiple`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(tracks.map(t => ({
                                          track_uri: t.track_uri,
                                          track_name: t.track_name,
                                          artist: t.artist,
                                          album_art_url: t.album_art_url,
                                          duration_ms: t.duration_ms
                                        })))
                                      });
                                      
                                      if (resQueue.ok) {
                                        triggerToast(`Added ${tracks.length} tracks to queue!`, 'success');
                                      } else {
                                        const data = await resQueue.json();
                                        triggerToast(data.detail || 'Failed to queue tracks', 'error');
                                      }
                                    } catch (err) {
                                      triggerToast('Connection error', 'error');
                                    }
                                  }}
                                  style={{
                                    background: 'rgba(255, 159, 28, 0.1)',
                                    border: '1px solid rgba(255, 159, 28, 0.2)',
                                    color: 'var(--amber)',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 159, 28, 0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 159, 28, 0.1)';
                                  }}
                                >
                                  Queue All
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="empty" style={{ padding: '24px 0' }}>
                            <div className="empty-title">No playlists found</div>
                            <div className="empty-sub">Create one on your profile dashboard!</div>
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px 16px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', flexShrink: 0 }}>
                            <button
                              onClick={() => setActiveRoomPlaylist(null)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-3)',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                padding: '4px 0'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}
                            >
                              ← Back
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                              {activeRoomPlaylist.name}
                            </span>
                            <button
                              onClick={async () => {
                                const tracks = activeRoomPlaylist.tracks || [];
                                if (tracks.length === 0) {
                                  triggerToast('Playlist is empty', 'warning');
                                  return;
                                }
                                triggerToast('Adding playlist tracks to queue...', 'info');
                                try {
                                  const resQueue = await fetch(`/rooms/${roomId}/queue/multiple`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(tracks.map(t => ({
                                      track_uri: t.track_uri,
                                      track_name: t.track_name,
                                      artist: t.artist,
                                      album_art_url: t.album_art_url,
                                      duration_ms: t.duration_ms
                                    }))),
                                    credentials: 'include'
                                  });
                                  if (resQueue.ok) {
                                    triggerToast(`Added ${tracks.length} tracks to queue!`, 'success');
                                  } else {
                                    const data = await resQueue.json();
                                    triggerToast(data.detail || 'Failed to queue tracks', 'error');
                                  }
                                } catch (err) {
                                  triggerToast('Connection error', 'error');
                                }
                              }}
                              style={{
                                background: 'rgba(255, 159, 28, 0.1)',
                                border: '1px solid rgba(255, 159, 28, 0.2)',
                                color: 'var(--amber)',
                                fontSize: '11px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 159, 28, 0.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 159, 28, 0.1)';
                              }}
                            >
                              Queue All
                            </button>
                          </div>
                          
                          <div style={{ flex: 1, overflowY: 'auto' }}>
                            {activeRoomPlaylist.tracks && activeRoomPlaylist.tracks.length > 0 ? (
                              activeRoomPlaylist.tracks.map((t, idx) => (
                                <div
                                  key={`${t.id || t.track_uri}-${idx}`}
                                  className="search-result-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 10px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.01)',
                                    marginBottom: '6px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => {
                                    handleAddTrack({
                                      track_uri: t.track_uri,
                                      track_name: t.track_name,
                                      artist: t.artist,
                                      album_art_url: t.album_art_url,
                                      duration_ms: t.duration_ms
                                    });
                                  }}
                                >
                                  {/* Premium Artwork Container with onError fallback */}
                                  <div style={{ width: '32px', height: '32px', position: 'relative', flexShrink: 0 }}>
                                    {t.album_art_url ? (
                                      <img 
                                        decoding="async" 
                                        loading="lazy" 
                                        draggable="false" 
                                        src={t.album_art_url} 
                                        alt="" 
                                        style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'cover', display: 'block' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          const placeholder = e.target.parentElement.querySelector('.pl-track-art-placeholder');
                                          if (placeholder) placeholder.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div 
                                      className="pl-track-art-placeholder" 
                                      style={{ 
                                        display: t.album_art_url ? 'none' : 'flex', 
                                        width: '100%', 
                                        height: '100%', 
                                        borderRadius: '6px', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        border: '1px solid rgba(255,255,255,0.08)'
                                      }}
                                    >
                                      <Music size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '1px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>{t.track_name}</div>
                                    {t.artist && (
                                      <div style={{ fontSize: '10px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.2' }}>{t.artist}</div>
                                    )}
                                  </div>
                                  <Plus className="h-4 w-4" style={{ color: 'var(--amber)' }} />
                                </div>
                              ))
                            ) : (
                              <div className="empty" style={{ padding: '24px 0' }}>
                                <div className="empty-title">Playlist is empty</div>
                                <div className="empty-sub">Add tracks in other views first!</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
                    chatMsgs.filter(msg => msg.type !== 'system').map((msg) => {
                      const isSelf = me && msg.user_id === me.id;
                      return (
                        <div key={msg.id} className={`chat-message ${isSelf ? 'self' : ''}`}>
                          {msg.user_avatar ? (
                            <img 
                              decoding="async" 
                              loading="lazy" 
                              className="avatar" 
                              src={msg.user_avatar} 
                              alt="" 
                              style={{ objectFit: 'cover' }} 
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement.querySelector('.avatar-fallback');
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="avatar avatar-fallback"
                            style={{ 
                              backgroundColor: nameColor(msg.user_name),
                              display: msg.user_avatar ? 'none' : 'flex' 
                            }}
                          >
                            {initials(msg.user_name)}
                          </div>
                          <div className="chat-msg-body">
                            <div className="chat-msg-bubble">
                              <div className="chat-msg-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="chat-msg-name">{msg.user_name}</span>
                                {room && room.host_user_id === msg.user_id && (
                                  <span className="badge-host">Host</span>
                                )}
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
                <div className="reactions-bar" style={{ position: 'relative' }}>
                  {['🔥', '❤️', '😂', '🎵', '👏'].map((emoji) => (
                    <button 
                      key={emoji}
                      className="btn-react"
                      onClick={() => handleSendReaction(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button 
                    type="button"
                    className="btn-react"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionEmojiPicker(!showReactionEmojiPicker);
                      setShowChatEmojiPicker(false);
                    }}
                    style={{
                      background: showReactionEmojiPicker ? 'rgba(255, 159, 28, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--amber)',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    +
                  </button>

                  {showReactionEmojiPicker && (
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
                          setShowReactionEmojiPicker(false);
                        }}
                      />
                      <EmojiPicker 
                        onSelect={(emoji) => {
                          handleSendReaction(emoji);
                          setShowReactionEmojiPicker(false);
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: '0',
                          marginBottom: '10px'
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Chat text input */}
                <div className="chat-input-wrap" style={{ position: 'relative' }}>
                  {showChatEmojiPicker && (
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
                          setShowChatEmojiPicker(false);
                        }}
                      />
                      <EmojiPicker 
                        onSelect={(emoji) => {
                          handleInsertChatEmoji(emoji);
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: '0',
                          marginBottom: '10px'
                        }}
                      />
                    </>
                  )}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowChatEmojiPicker(!showChatEmojiPicker);
                        setShowReactionEmojiPicker(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: showChatEmojiPicker ? 'var(--amber)' : 'var(--text-3)',
                        cursor: 'pointer',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s',
                        outline: 'none'
                      }}
                    >
                      <Smile size={18} />
                    </button>
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
                    <div 
                      key={uid} 
                      className={`member-item ${user.is_registered ? 'is-registered' : ''}`}
                      onClick={() => {
                        if (user.is_registered) {
                          window.open(`/profile/${uid}`, '_blank');
                        }
                      }}
                    >
                      {user.avatar_url ? (
                        <img 
                          decoding="async" 
                          loading="lazy" 
                          className="avatar avatar-sm" 
                          src={user.avatar_url} 
                          alt="" 
                          style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: room && room.host_user_id === uid ? '1.5px solid var(--amber, #ff9f1c)' : 'none',
                            boxShadow: room && room.host_user_id === uid ? '0 0 6px rgba(255, 159, 28, 0.4)' : 'none'
                          }} 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement.querySelector('.listener-avatar-fallback');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="avatar avatar-sm listener-avatar-fallback"
                        style={{ 
                          backgroundColor: nameColor(user.display_name), 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          display: user.avatar_url ? 'none' : 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          border: room && room.host_user_id === uid ? '1.5px solid var(--amber, #ff9f1c)' : 'none',
                          boxShadow: room && room.host_user_id === uid ? '0 0 6px rgba(255, 159, 28, 0.4)' : 'none'
                        }}
                      >
                        {initials(user.display_name)}
                      </div>
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
                    onClick={() => router.push('/')}
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
