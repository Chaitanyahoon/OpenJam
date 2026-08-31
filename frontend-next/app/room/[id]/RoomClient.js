'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSocket } from '@/contexts/SocketContext';
import { useRouter } from 'next/navigation';
import YouTubePlayer from '@/utils/YouTubePlayer';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { MusicPlayer } from '@/components/ui/music-player';
import { Search, Plus, X, Music, Settings, Users, Send, Volume2, VolumeX, Play, Pause, Heart, CheckCircle, AlertCircle, AlertTriangle, Info, Download, Check, Flame, Smile, Save, RefreshCw, ListPlus, Maximize2, Minimize2, SkipForward, SkipBack, Shuffle, Repeat, List, Disc, Clock, Sliders, GripVertical, HelpCircle, Bookmark, Crown, Trophy, Share2 } from 'lucide-react';
import { offlineDb } from '@/utils/offlineDb';
import { extractColors } from '@/utils/colorExtractor';
import SyncPrecisionBadge from '@/components/ui/SyncPrecisionBadge';
import { audioPrecache } from '@/utils/audioPrecache';
import DiscordRPC from '@/utils/DiscordRPC';

// Dynamically code-split secondary modals and pickers for fast initial room load
const JamCardModal = dynamic(() => import('@/components/modals/JamCardModal'), { ssr: false });
const EmojiPicker = dynamic(() => import('@/components/EmojiPicker'), { ssr: false });
const MentionPopover = dynamic(() => import('@/components/chat/MentionPopover'), { ssr: false });
const TenorGifPicker = dynamic(() => import('@/components/chat/TenorGifPicker'), { ssr: false });
const PwaInstallPrompt = dynamic(() => import('@/components/PwaInstallPrompt'), { ssr: false });

export default function RoomClient({ roomId }) {
  const { socket, isConnected, isReconnecting, isConnectionFailed, reconnect } = useSocket();
  const router = useRouter();
  const playerRef = useRef(null);
  const discordRpcRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const handleSeekRelativeRef = useRef(null);

  // States
  const [room, setRoom] = useState(null);
  const [allowGuestControls, setAllowGuestControls] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);
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

  // Jam Card State
  const [showJamCardModal, setShowJamCardModal] = useState(false);

  // Rich Chat & Mention Suite States
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  
  // Volume & Settings
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [lyricsActiveIdx, setLyricsActiveIdx] = useState(-1);
  const [lyricsText, setLyricsText] = useState([]);
  const [lyricsAvailable, setLyricsAvailable] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [isDraggingOverNP, setIsDraggingOverNP] = useState(false);
  const [isDraggingOverSidebarNP, setIsDraggingOverSidebarNP] = useState(false);
  const [isDraggingOverQueue, setIsDraggingOverQueue] = useState(false);
  const [isStageMode, setIsStageMode] = useState(false);
  const [stageControlsVisible, setStageControlsVisible] = useState(false);
  const [stageVolHovered, setStageVolHovered] = useState(false);
  const [stageSeekHovered, setStageSeekHovered] = useState(false);
  const [showStageQueue, setShowStageQueue] = useState(false);
  const [showTimeRemaining, setShowTimeRemaining] = useState(false);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);
  const [showLyricsSyncPanel, setShowLyricsSyncPanel] = useState(false);
  const [showKeyboardHUD, setShowKeyboardHUD] = useState(false);
  const [stageMouseActive, setStageMouseActive] = useState(true);
  const [seekHoverTimeMs, setSeekHoverTimeMs] = useState(null);
  const [seekHoverXRatio, setSeekHoverXRatio] = useState(0);
  const [artHovered, setArtHovered] = useState(false);
  const isDraggingStageVolRef = useRef(false);
  const isDraggingStageSeekRef = useRef(false);
  const stageVolPillRef = useRef(null);
  const stageSeekBarRef = useRef(null);
  const stageControlsTimerRef = useRef(null);
  const stageMouseTimerRef = useRef(null);
  const [settingsSound, setSettingsSound] = useState(true);
  const [settingsVisuals, setSettingsVisuals] = useState(true);
  const [settingsHaptics, setSettingsHaptics] = useState(true);
  const [settingsNotifications, setSettingsNotifications] = useState(false);
  const [eqPreset, setEqPreset] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('openjam_eq_preset')) || 'normal');

  // Search & Inputs
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

  // Modals & Panels
  const [activeDropdownTrackUri, setActiveDropdownTrackUri] = useState(null);
  const [activeQueueDropdownId, setActiveQueueDropdownId] = useState(null);
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);
  const [showReactionEmojiPicker, setShowReactionEmojiPicker] = useState(false);
  const [syncLatency, setSyncLatency] = useState(null);
  const [clockStats, setClockStats] = useState({ offset: 0, rtt: 0 });
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
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [streamErrorMsg, setStreamErrorMsg] = useState(null);
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 0, voted: false });
  const [isReady, setIsReady] = useState(false);

  // Refs for scrolling and canvas
  const chatEndRef = useRef(null);
  const stageLyricsScrollRef = useRef(null);
  const stageLyricsActiveRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastReactionId = useRef(0);
  const isOverSuggestions = useRef(false);
  const isDraggingSuggestion = useRef(false);
  const reactionContainerRef = useRef(null);
  const lastReactionSentRef = useRef(0);
  const colorsRef = useRef(['#ff9f1c', '#8b5cf6', '#ec4899']);

  const userScrolledLyricsRef = useRef(false);
  const userScrollTimerRef = useRef(null);

  // Sync Stage Mode lyrics auto-scrolling into the middle focal region
  useEffect(() => {
    if (!isStageMode || lyricsActiveIdx === -1 || !stageLyricsScrollRef.current) return;
    if (userScrolledLyricsRef.current) return; // User is manually browsing lyrics

    const activeEl = document.getElementById(`stage-lyr-${lyricsActiveIdx}`);
    if (activeEl && stageLyricsScrollRef.current) {
      const container = stageLyricsScrollRef.current;
      // Center the active singing line at ~38% from the top (golden reading focus)
      const targetScroll = activeEl.offsetTop - (container.clientHeight * 0.38) + (activeEl.clientHeight / 2);
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [isStageMode, lyricsActiveIdx]);

  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
    if (!nowPlaying?.album_art_url) {
      colorsRef.current = ['#ff9f1c', '#8b5cf6', '#ec4899'];
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--dynamic-accent-1', '#ff9f1c');
        document.documentElement.style.setProperty('--dynamic-accent-2', '#8b5cf6');
        document.documentElement.style.setProperty('--dynamic-accent-3', '#ec4899');
      }
    } else {
      extractColors(nowPlaying.album_art_url).then((colors) => {
        colorsRef.current = colors;
        if (typeof document !== 'undefined' && colors && colors.length >= 3) {
          document.documentElement.style.setProperty('--dynamic-accent-1', colors[0]);
          document.documentElement.style.setProperty('--dynamic-accent-2', colors[1]);
          document.documentElement.style.setProperty('--dynamic-accent-3', colors[2]);
        }
      });
    }
  }, [nowPlaying?.album_art_url]);

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
  }, [nowPlaying, playbackState.isPlaying]);

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

  const roomPasswordRef = useRef('');
  useEffect(() => {
    roomPasswordRef.current = roomPassword;
  }, [roomPassword]);

  // Background pre-caching of upcoming tracks into IndexedDB for sub-50ms cutover
  useEffect(() => {
    if (queue && queue.length > 0) {
      const currentIdx = queue.findIndex(q => (q.track_uri || q.id) === (nowPlaying?.track_uri || nowPlaying?.id));
      audioPrecache.precacheQueue(queue, currentIdx, 3);
    }
  }, [queue, nowPlaying]);

  // Clear unread chat count when chat tab becomes active
  useEffect(() => {
    if (activeTab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [activeTab]);

  const handleTogglePlayRef = useRef(null);
  const handleNextTrackRef = useRef(null);

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
  const canControl = isHost || allowGuestControls;

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

  const playReactionSound = (emoji) => {
    if (!settingsSound) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtxClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (emoji === '🔥') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (emoji === '👏') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (emoji === '🎵' || emoji === '❤️' || emoji === '⚡') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
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
      if (!roomId || roomId === 'loading') return;
      try {
        let userResolved = false;
        let token = null;
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          token = params.get('token');
          const hash = window.location.hash;
          if (!token && hash.startsWith('#token=')) {
            token = hash.substring(7);
          }
          if (token) {
            const maxAge = 86400 * 30;
            const isSecure = window.location.protocol === 'https:';
            document.cookie = `session_token=${token}; max-age=${maxAge}; path=/; samesite=lax${isSecure ? '; secure' : ''}`;
            localStorage.setItem('openjam_token', token);
          } else {
            token = localStorage.getItem('openjam_token');
          }
        }

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const rMe = await fetch(`/auth/me?t=${Date.now()}`, { 
          headers, 
          credentials: 'include', 
          cache: 'no-store' 
        });
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
          setRoomNotFound(true);
        }
      } catch (err) {
        console.error('Initial fetch error:', err);
        setRoomNotFound(true);
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

  // Clock synchronization loop with rapid convergence burst
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Quick burst of pings in the first 2 seconds for instant NTP convergence
    syncClock();
    const t1 = setTimeout(syncClock, 200);
    const t2 = setTimeout(syncClock, 600);
    const t3 = setTimeout(syncClock, 1200);
    const t4 = setTimeout(syncClock, 2400);
    
    // Regular keep-alive sync every 12 seconds
    const interval12 = setInterval(syncClock, 12000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearInterval(interval12);
    };
  }, [socket, isConnected]);

  // Global Desktop Media Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;
      
      if (isInputFocused || showPassword || showNicknamePrompt || showSettings || showInvite || showClose || showBulkAdd) {
        return;
      }

      if (e.key === 'Escape' && isStageMode) {
        setIsStageMode(false);
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsStageMode((prev) => !prev);
      } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleTogglePlayRef.current?.();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      } else if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleNextTrackRef.current?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPassword, showNicknamePrompt, showSettings, showInvite, showClose, showBulkAdd, isHost, playbackState.isPlaying]);

  // 2. WebSocket Listeners Setup
  useEffect(() => {
    if (!socket || !isReady) {
      return;
    }

    const joinRoom = () => {
      const password = sessionStorage.getItem(`room_password_${roomId}`) || roomPasswordRef.current || roomPassword;
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
      
      // Filter out extreme cold-start / sleep outliers
      if (rtt < 0 || rtt > 1800) return;
      
      const newHistory = [...clockStatsRef.current.history, { rtt, offset }].slice(-12);
      // Cristian's NTP algorithm: Sort by RTT and average top 50% lowest-latency measurements
      const sorted = [...newHistory].sort((a, b) => a.rtt - b.rtt);
      const bestSamples = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
      const avgOffset = bestSamples.reduce((sum, item) => sum + item.offset, 0) / bestSamples.length;
      const avgRtt = bestSamples.reduce((sum, item) => sum + item.rtt, 0) / bestSamples.length;
      
      clockStatsRef.current = {
        offset: avgOffset,
        rtt: avgRtt,
        history: newHistory
      };
      
      setClockStats({ offset: avgOffset, rtt: avgRtt });
      setSyncLatency(Math.max(4, Math.round(avgRtt / 2)));
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
      setAllowGuestControls(data.allow_guest_controls || false);

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
            album_art_url: albumArtUrl || null,
            duration_ms: 240000
          });
        } else {
          // Check if a starting track was stored during room creation from homepage preview
          const autoTrackRaw = localStorage.getItem(`auto_play_track_${roomId}`);
          if (autoTrackRaw) {
            try {
              const autoTrack = JSON.parse(autoTrackRaw);
              localStorage.removeItem(`auto_play_track_${roomId}`);
              if (autoTrack && (autoTrack.trackUri || autoTrack.track_uri)) {
                socket.emit('add_to_queue', {
                  room_id: roomId,
                  track_uri: autoTrack.trackUri || autoTrack.track_uri,
                  track_name: autoTrack.trackName || autoTrack.track_name || 'Jam Track',
                  artist: autoTrack.artist || 'Unknown Artist',
                  album_art_url: autoTrack.src || autoTrack.album_art_url || null,
                  duration_ms: autoTrack.duration_ms || 240000
                });
              }
            } catch (e) {
              console.error('Error auto-queuing room creation track:', e);
            }
          }
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
        
        if (isChatNotVisible) {
          setUnreadChatCount((prev) => prev + 1);
        }

        const myDisplayName = meRef.current?.display_name || '';
        const isMentioned = myDisplayName && msg.content && msg.content.toLowerCase().includes(`@${myDisplayName.toLowerCase()}`);

        if (isMentioned && isWindowBackground) {
          sendDesktopNotification(`@${msg.user_name || 'Someone'} mentioned you in ${roomRef.current?.name || 'OpenJam'}!`, {
            body: msg.content,
            tag: 'chat-mention',
            renotify: true
          });
          playAlertSound('info');
        } else if (isWindowBackground || isChatNotVisible) {
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
      playReactionSound(data.emoji);
      
      if (reactionContainerRef.current) {
        const el = document.createElement('div');
        el.className = 'floating-emoji';
        el.textContent = data.emoji;
        
        const x = Math.random() * 65 + 15;
        const swayDirection = Math.random() > 0.5 ? 1 : -1;
        const swayOffset = Math.random() * 50 + 20;
        const finalRotation = Math.random() * 50 - 25;
        
        el.style.position = 'absolute';
        el.style.left = `${x}vw`;
        el.style.bottom = '80px';
        el.style.pointerEvents = 'none';
        el.style.fontSize = '38px';
        el.style.zIndex = '10000';
        el.style.setProperty('--wobble-x', `${swayDirection * swayOffset}px`);
        el.style.setProperty('--final-rotation', `${finalRotation}deg`);
        
        reactionContainerRef.current.appendChild(el);
        
        setTimeout(() => {
          el.remove();
        }, 2500);
      }

      // Append reaction message to chat messages list
      setChatMsgs((prev) => [
        ...prev,
        {
          id: `reaction-${id}-${Date.now()}`,
          type: 'reaction',
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
            is_playing: data.is_playing
          });
        } else if (!data.track_uri) {
          playerRef.current.stop();
        } else {
          playerRef.current.syncPosition(adjustedPosition, data.is_playing);
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

    socket.on('guest_controls_updated', (data) => {
      setAllowGuestControls(data.allow_guest_controls || false);
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
      socket.off('guest_controls_updated');
      socket.emit('leave_room', { room_id: roomId });
    };
  }, [socket, isReady, roomId]);

  // 3. YouTube Player Initialization & Callback Updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const player = new YouTubePlayer({
      toast: (msg, type) => triggerToast(msg, type),
      onProgressUpdate: (pos, dur, playing) => {
        if (playing && streamErrorMsgRef.current) {
          streamErrorMsgRef.current = null;
          setStreamErrorMsg(null);
        }
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
      onStateChange: (state) => {
        const playing = state === 'play';
        if (playing) {
          streamErrorMsgRef.current = null;
          setStreamErrorMsg(null);
        }
        playbackStateRef.current = {
          ...playbackStateRef.current,
          isPlaying: playing
        };
        setPlaybackState((prev) => ({
          ...prev,
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
        is_playing: playing
      });
    }

    return () => {
      player.destroy();
    };
  }, []);

  // Global user gesture listener for instant browser audio unlocking
  useEffect(() => {
    const handleUserGesture = () => {
      if (playerRef.current) {
        playerRef.current.unlockAudioContext();
      }
    };
    window.addEventListener('click', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('pointerdown', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserGesture, { capture: true, passive: true });

    return () => {
      window.removeEventListener('click', handleUserGesture, { capture: true });
      window.removeEventListener('touchstart', handleUserGesture, { capture: true });
      window.removeEventListener('pointerdown', handleUserGesture, { capture: true });
      window.removeEventListener('keydown', handleUserGesture, { capture: true });
    };
  }, []);

  // 3. Media Controls Synchronization (Broadcast on user interaction)
  useEffect(() => {
    if (!playerRef.current) return;
    
    const controlHandler = (action, extra = {}) => {
      if (action === 'ended' || action === 'nexttrack') {
        if (canControl && socket) {
          socket.emit('next_track', { room_id: roomId });
        }
      } else if (action === 'previoustrack') {
        if (canControl && socket) {
          socket.emit('previous_track', { room_id: roomId });
        }
      } else if (action === 'seek') {
        if (canControl && socket && extra?.position_ms !== undefined) {
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
            is_playing: currentPlayback.isPlaying,
            loop: false,
            is_buffering: false
          });
        }
      } else if (action === 'play') {
        if (canControl && socket) {
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
            is_buffering: false
          });
        }
      } else if (action === 'pause') {
        if (canControl && socket) {
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
    };

    if (typeof playerRef.current.onControlEvent === 'function') {
      playerRef.current.onControlEvent(controlHandler);
    } else if (typeof playerRef.current.setControlCallback === 'function') {
      playerRef.current.setControlCallback(controlHandler);
    }
  }, [roomId, socket, canControl]);

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

  // 5. Fast, Resilient Search Suggestions Engine with In-Flight Cancellation & Cache
  const searchClientCacheRef = useRef(new Map());
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    // Instant local cache hit
    if (searchClientCacheRef.current.has(trimmed.toLowerCase())) {
      setSearchResults(searchClientCacheRef.current.get(trimmed.toLowerCase()));
      setSearchLoading(false);
    }

    const controller = new AbortController();
    setSearchLoading(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/search/tracks?q=${encodeURIComponent(trimmed)}`, {
          credentials: 'include',
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          const tracks = data.tracks || [];
          searchClientCacheRef.current.set(trimmed.toLowerCase(), tracks);
          setSearchResults(tracks);
        } else {
          console.debug('[search] fetch status:', res.status);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.debug('[search] error:', err);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 160);

    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
  }, [searchQuery]);

  // 6. Lyrics Syncing, Multi-Tier Fetcher & Auto-Scroller
  async function fetchLyrics(artist, track) {
    if (!track) {
      setLyricsText([]);
      return;
    }
    setLyricsLoading(true);
    setLyricsText([]);
    try {
      // 1. Clean track name & artist from common YouTube fluff
      let cleanTrack = track
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/\|.*$/g, '')
        .replace(/ft\..*|feat\..*|prod\..*/i, '')
        .replace(/official music video|official video|official audio|lyric video|lyrics|visualizer|audio|video|hd|4k|remastered|remix|explicit/gi, '')
        .trim();
        
      let cleanArtist = (artist || '')
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/ - topic/i, '')
        .replace(/vevo/i, '')
        .replace(/official/i, '')
        .trim();

      // If track has "Artist - Song Title", parse it out
      if (cleanTrack.includes(' - ')) {
        const parts = cleanTrack.split(' - ');
        if (!cleanArtist || cleanArtist === 'Unknown' || cleanArtist === 'Topic') {
          cleanArtist = parts[0].trim();
        }
        cleanTrack = parts[1].trim();
      }

      const targetDurSec = (nowPlayingRef.current?.duration_ms || playbackStateRef.current?.durationMs || 0) / 1000;

      // Tier 1: Direct LRCLIB get with optional duration fallback
      let data = null;
      if (cleanTrack && cleanArtist) {
        if (targetDurSec > 10) {
          try {
            const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}&duration=${Math.round(targetDurSec)}`;
            const res = await fetch(url);
            if (res.ok) data = await res.json();
          } catch (e) {}
        }
        if (!data) {
          try {
            const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}&artist_name=${encodeURIComponent(cleanArtist)}`;
            const res = await fetch(url);
            if (res.ok) data = await res.json();
          } catch (e) {}
        }
      }

      // Tier 2: Combined query search with closest duration matching
      if (!data && (cleanTrack || cleanArtist)) {
        const query = `${cleanArtist} ${cleanTrack}`.trim();
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        try {
          const searchRes = await fetch(searchUrl);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (Array.isArray(searchData) && searchData.length > 0) {
              const syncedItems = searchData.filter(item => item.syncedLyrics);
              if (syncedItems.length > 0) {
                if (targetDurSec > 10) {
                  syncedItems.sort((a, b) => Math.abs((a.duration || 0) - targetDurSec) - Math.abs((b.duration || 0) - targetDurSec));
                }
                data = syncedItems[0];
              } else {
                data = searchData.find(item => item.plainLyrics) || searchData[0];
              }
            }
          }
        } catch (e) {}
      }

      // Tier 3: Search by track name alone with duration match
      if (!data && cleanTrack) {
        const trackOnlyUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTrack)}`;
        try {
          const trackOnlyRes = await fetch(trackOnlyUrl);
          if (trackOnlyRes.ok) {
            const trackDataList = await trackOnlyRes.json();
            if (Array.isArray(trackDataList) && trackDataList.length > 0) {
              const syncedItems = trackDataList.filter(item => item.syncedLyrics);
              if (syncedItems.length > 0) {
                if (targetDurSec > 10) {
                  syncedItems.sort((a, b) => Math.abs((a.duration || 0) - targetDurSec) - Math.abs((b.duration || 0) - targetDurSec));
                }
                data = syncedItems[0];
              } else {
                data = trackDataList.find(item => item.plainLyrics) || trackDataList[0];
              }
            }
          }
        } catch (e) {}
      }

      if (data) {
        if (data.syncedLyrics) {
          // Parse optional LRC [offset: +/-ms] tag
          let lrcFileOffset = 0;
          const offsetMatch = /\[offset:\s*([+-]?\d+)\]/i.exec(data.syncedLyrics);
          if (offsetMatch) {
            lrcFileOffset = parseInt(offsetMatch[1], 10) || 0;
          }

          const lines = data.syncedLyrics.split('\n');
          const parsed = [];
          const timeReg = /\[(\d{1,2}):(\d{2})[.:](\d{1,3})\]/g;

          for (const line of lines) {
            // Check if line is metadata header (e.g. [ar:...], [ti:...], [offset:...])
            if (/^\[(ar|ti|al|by|offset|length|re|ve):/i.test(line.trim())) continue;

            const matches = [...line.matchAll(timeReg)];
            if (matches.length > 0) {
              const text = line.replace(timeReg, '').trim();
              if (text) {
                for (const match of matches) {
                  const min = parseInt(match[1], 10);
                  const sec = parseInt(match[2], 10);
                  const rawMs = match[3];
                  const ms = rawMs.length === 2 
                    ? parseInt(rawMs, 10) * 10 
                    : (rawMs.length === 1 ? parseInt(rawMs, 10) * 100 : parseInt(rawMs.slice(0, 3), 10));
                  const timeMs = (min * 60 * 1000) + (sec * 1000) + ms + lrcFileOffset;
                  parsed.push({ timeMs, text });
                }
              }
            }
          }
          parsed.sort((a, b) => a.timeMs - b.timeMs);
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

  // Auto-fetch lyrics whenever nowPlaying track changes
  useEffect(() => {
    setLyricsOffsetMs(0);
    if (nowPlaying?.track_name) {
      fetchLyrics(nowPlaying.artist, nowPlaying.track_name);
    } else {
      setLyricsText([]);
    }
  }, [nowPlaying?.track_name, nowPlaying?.artist, nowPlaying?.track_uri]);

  // Auto pre-buffer next track in queue for 0ms gapless cutovers
  useEffect(() => {
    if (!queue || queue.length === 0 || !playerRef.current) return;
    const nextItem = queue.find(item => item.status === 'pending' || item.status === 'queued');
    if (nextItem && nextItem.track_uri && nextItem.track_uri.length === 11) {
      playerRef.current.prebufferNextTrack(nextItem.track_uri);
    }
  }, [queue]);

  // Native Browser Fullscreen trigger for Stage Mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStageMode) {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isStageMode]);

  useEffect(() => {
    if (!lyricsText || lyricsText.length === 0) {
      setLyricsActiveIdx(-1);
      return;
    }
    const updateActiveIndex = () => {
      let currentPos = 0;
      if (playerRef.current) {
        if (typeof playerRef.current.positionMs === 'number' && playerRef.current.positionMs > 0) {
          currentPos = playerRef.current.positionMs;
        } else if (playerRef.current.player && !isNaN(playerRef.current.player.currentTime)) {
          currentPos = Math.round(playerRef.current.player.currentTime * 1000);
        }
      }
      if (currentPos <= 0) {
        currentPos = playbackState.positionMs || 0;
      }

      const vocalOnsetLeadMs = 80;
      const effectiveMs = currentPos + lyricsOffsetMs + vocalOnsetLeadMs;
      let newIdx = -1;
      for (let i = 0; i < lyricsText.length; i++) {
        if (lyricsText[i].timeMs !== undefined && lyricsText[i].timeMs >= 0) {
          if (lyricsText[i].timeMs <= effectiveMs) {
            newIdx = i;
          } else {
            break;
          }
        }
      }
      setLyricsActiveIdx((prev) => (prev !== newIdx ? newIdx : prev));
    };

    updateActiveIndex();

    let ticker = null;
    if (playbackState.isPlaying) {
      ticker = setInterval(updateActiveIndex, 50);
    }
    return () => {
      if (ticker) clearInterval(ticker);
    };
  }, [playbackState.positionMs, playbackState.isPlaying, lyricsText, lyricsOffsetMs]);


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
    if (!canControl || !playerRef.current) return;
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
  handleTogglePlayRef.current = handleTogglePlay;

  const handleShuffleClick = () => {
    if (!isHost || !socket) return;
    socket.emit('shuffle_queue', { room_id: roomId });
    triggerToast('Shuffling queue...', 'info');
  };

  const handleRepeatToggle = () => {
    if (!canControl || !socket) return;
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
    if (!canControl || !playbackState.durationMs || !socket || !playerRef.current) return;
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

  const handleSeekRelative = (deltaMs) => {
    if (!playbackState.durationMs) return;
    const currentPos = playerRef.current?.player?.currentTime 
      ? Math.round(playerRef.current.player.currentTime * 1000)
      : (playerRef.current?.positionMs || playbackState.positionMs || 0);
    const targetPos = Math.max(0, Math.min(playbackState.durationMs, currentPos + deltaMs));
    
    setPlaybackState(prev => ({ ...prev, positionMs: targetPos }));
    if (playerRef.current) {
      if (typeof playerRef.current.seek === 'function') {
        playerRef.current.seek(targetPos / 1000);
      } else {
        playerRef.current.syncPosition(targetPos, playbackState.isPlaying);
      }
    }

    if (canControl && socket) {
      socket.emit('playback_update', {
        room_id: roomId,
        track_uri: nowPlaying?.track_uri,
        track_name: nowPlaying?.track_name,
        artist: nowPlaying?.artist,
        album_art_url: nowPlaying?.album_art_url,
        position_ms: targetPos,
        duration_ms: playbackState.durationMs,
        is_playing: playbackState.isPlaying,
        loop: false,
        is_buffering: playbackState.isPlaying ? !!streamErrorMsg : false
      });
    }
    triggerToast(`${deltaMs > 0 ? '+5s Forward' : '-5s Rewind'} (${formatTime(targetPos)})`, 'info');
  };
  handleSeekRelativeRef.current = handleSeekRelative;

  const handlePreviousTrack = () => {
    if (!canControl || !socket) return;
    socket.emit('previous_track', { room_id: roomId });
  };

  const handleNextTrack = () => {
    if (!canControl || !socket) return;
    socket.emit('next_track', { room_id: roomId });
  };
  handleNextTrackRef.current = handleNextTrack;

  const handleVoteSkip = () => {
    if (!socket) return;
    socket.emit('vote_skip', { room_id: roomId });
    setSkipVotes((prev) => ({ ...prev, voted: true }));
  };

  // ── Stage Mode: Draggable Volume Slider ──
  const calcVolumeFromY = (clientY, rect) => {
    const clickY = clientY - rect.top;
    return Math.max(0, Math.min(100, Math.round(((rect.height - clickY) / rect.height) * 100)));
  };

  const handleStageVolDown = (e) => {
    e.preventDefault();
    isDraggingStageVolRef.current = true;
    const rect = stageVolPillRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newVol = calcVolumeFromY(clientY, rect);
    setVolume(newVol);
    if (newVol > 0 && isMuted) setIsMuted(false);

    const handleMove = (ev) => {
      if (!isDraggingStageVolRef.current) return;
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const r = stageVolPillRef.current?.getBoundingClientRect();
      if (!r) return;
      const v = calcVolumeFromY(y, r);
      setVolume(v);
      if (v > 0 && isMuted) setIsMuted(false);
    };

    const handleUp = () => {
      isDraggingStageVolRef.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
  };

  // ── Stage Mode: Draggable Seekbar ──
  const calcSeekFromX = (clientX, rect) => {
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.floor(pct * playbackState.durationMs);
  };

  const handleStageSeekDown = (e) => {
    if (!canControl || !playbackState.durationMs || !playerRef.current) return;
    e.preventDefault();
    isDraggingStageSeekRef.current = true;
    const rect = stageSeekBarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const posMs = calcSeekFromX(clientX, rect);
    setPlaybackState(prev => ({ ...prev, positionMs: posMs }));

    const handleMove = (ev) => {
      if (!isDraggingStageSeekRef.current) return;
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const r = stageSeekBarRef.current?.getBoundingClientRect();
      if (!r) return;
      const p = calcSeekFromX(x, r);
      setPlaybackState(prev => ({ ...prev, positionMs: p }));
    };

    const handleUp = (ev) => {
      isDraggingStageSeekRef.current = false;
      const x = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
      const r = stageSeekBarRef.current?.getBoundingClientRect();
      if (r && playerRef.current && socket) {
        const finalPos = calcSeekFromX(x, r);
        setPlaybackState(prev => ({ ...prev, positionMs: finalPos }));
        playerRef.current.syncPosition(finalPos, playbackState.isPlaying);
        socket.emit('playback_update', {
          room_id: roomId,
          track_uri: nowPlaying?.track_uri,
          track_name: nowPlaying?.track_name,
          artist: nowPlaying?.artist,
          album_art_url: nowPlaying?.album_art_url,
          position_ms: finalPos,
          duration_ms: playbackState.durationMs,
          is_playing: playbackState.isPlaying,
          loop: playbackState.loop || false,
          is_buffering: playbackState.isPlaying ? !!streamErrorMsg : false,
        });
      }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
  };

  // ── Stage Mode: Hover-to-reveal controls & Keyboard HUD auto-hide ──
  const showStageControls = () => {
    setStageControlsVisible(true);
    setStageMouseActive(true);
    if (stageControlsTimerRef.current) clearTimeout(stageControlsTimerRef.current);
    stageControlsTimerRef.current = setTimeout(() => {
      if (!isDraggingStageVolRef.current && !isDraggingStageSeekRef.current) {
        setStageControlsVisible(false);
        setStageMouseActive(false);
      }
    }, 3500);
  };

  const handleStageMouseMove = () => {
    showStageControls();
  };

  // 🔊 Exponential / Logarithmic Volume Curve Scrolling
  const handleExpVolumeScroll = (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY);
    setVolume(prev => {
      const current = prev !== undefined ? prev : 80;
      // Perceived loudness curve: subtle changes at low volume, larger changes at high volume
      const step = Math.max(1, Math.round(Math.pow(Math.max(current, 8) / 100, 0.55) * 6));
      const next = Math.max(0, Math.min(100, current + delta * step));
      if (next > 0 && isMuted) setIsMuted(false);
      return next;
    });
  };

  // 💾 Save Current Room Queue as User Playlist
  const handleSaveQueueToPlaylist = async () => {
    if (!queue || queue.length === 0) {
      triggerToast('Queue is empty', 'warning');
      return;
    }
    if (!me || !me.is_registered) {
      triggerToast('Please sign in to save playlists', 'warning');
      return;
    }

    triggerToast('Saving queue to your playlists…', 'info');
    try {
      const plName = `${room?.name || 'Jam Room'} Queue (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      const res = await fetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: plName,
          is_private: false
        })
      });

      if (!res.ok) {
        triggerToast('Failed to create playlist', 'error');
        return;
      }

      const resData = await res.json();
      const plId = resData.playlist.id;

      const tracksPayload = queue.map(t => ({
        track_uri: t.track_uri || t.id,
        track_name: t.track_name || t.title,
        artist: t.artist || '',
        album_art_url: t.album_art_url || t.artwork || '',
        duration_ms: t.duration_ms || 240000
      }));

      const addTracksRes = await fetch(`/playlists/${plId}/tracks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(tracksPayload)
      });

      if (addTracksRes.ok) {
        triggerToast(`Saved ${tracksPayload.length} tracks to playlist!`, 'success');
        if (typeof fetchPlaylists === 'function') fetchPlaylists();
      } else {
        triggerToast('Playlist created!', 'success');
      }
    } catch (e) {
      triggerToast('Connection error while saving playlist', 'error');
    }
  };

  // ↕️ Drag-to-Reorder Queue Tracks with Framer Motion
  const handleReorderQueue = (newOrder) => {
    if (!isHost) return;
    setQueue(newOrder);
    const pendingIds = newOrder.filter(item => item.status !== 'played').map(item => item.id);
    if (socket && pendingIds.length > 0) {
      socket.emit('reorder_queue', { room_id: roomId, ordered_ids: pendingIds });
    }
  };

  // ⌨️ Stage Mode Fullscreen Keyboard Shortcuts Listener
  useEffect(() => {
    if (!isStageMode) return;

    const handleStageKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handleTogglePlayRef.current?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeekRelativeRef.current?.(-5000);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeekRelativeRef.current?.(5000);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => {
            const current = prev !== undefined ? prev : 80;
            const step = Math.max(1, Math.round(Math.pow(Math.max(current, 8) / 100, 0.55) * 6));
            const next = Math.min(100, current + step);
            if (next > 0 && isMuted) setIsMuted(false);
            return next;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => {
            const current = prev !== undefined ? prev : 80;
            const step = Math.max(1, Math.round(Math.pow(Math.max(current, 8) / 100, 0.55) * 6));
            const next = Math.max(0, current - step);
            return next;
          });
          break;
        case 'KeyL':
          e.preventDefault();
          handleLikeToggle();
          break;
        case 'KeyS':
          e.preventDefault();
          if (isHost) handleShuffleClick();
          break;
        case 'KeyR':
          e.preventDefault();
          if (canControl) handleRepeatToggle();
          break;
        case 'KeyQ':
          e.preventDefault();
          setShowStageQueue(prev => !prev);
          break;
        case 'KeyC':
          e.preventDefault();
          setShowLyricsSyncPanel(prev => !prev);
          break;
        case 'KeyM':
          e.preventDefault();
          setIsMuted(prev => !prev);
          break;
        case 'Slash':
          if (e.shiftKey || e.key === '?') {
            e.preventDefault();
            setShowKeyboardHUD(prev => !prev);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsStageMode(false);
          setShowKeyboardHUD(false);
          break;
        default:
          if (e.key === '?') {
            e.preventDefault();
            setShowKeyboardHUD(prev => !prev);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleStageKeyDown);
    return () => {
      window.removeEventListener('keydown', handleStageKeyDown);
    };
  }, [isStageMode, isHost, canControl, playbackState.isPlaying, playbackState.positionMs, playbackState.durationMs, isMuted]);


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
    const value = e.target.value;
    setChatInput(value);

    // Detect @mention trigger from cursor position
    const cursor = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursor);
    const mentionMatch = /(?:^|\s)@([a-zA-Z0-9_\s]{0,20})$/.exec(textBeforeCursor);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1] || '');
      setShowMentionPopover(true);
    } else {
      setShowMentionPopover(false);
    }

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

  const handleSelectMention = (user) => {
    const textarea = document.getElementById('chat-input');
    const cursor = textarea?.selectionStart || chatInput.length;
    const textBefore = chatInput.slice(0, cursor);
    const textAfter = chatInput.slice(cursor);
    
    const replacedBefore = textBefore.replace(/(?:^|\s)@([a-zA-Z0-9_\s]{0,20})$/, (match) => {
      const prefix = match.startsWith(' ') ? ' ' : '';
      return `${prefix}@${user.display_name} `;
    });
    
    const nextInput = replacedBefore + textAfter;
    setChatInput(nextInput);
    setShowMentionPopover(false);
    setMentionQuery('');
    
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = replacedBefore.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
      }
    }, 0);
  };

  const handleSelectGif = (gifUrl) => {
    if (!gifUrl || !socket) return;
    const tempId = Math.random().toString(36).slice(2, 10);
    socket.emit('send_chat', {
      room_id: roomId,
      message: gifUrl,
      type: 'gif',
      temp_id: tempId
    });
    setShowGifPicker(false);
  };

  const renderMessageContent = (content = '') => {
    if (!content) return null;

    const isGifUrl = /(https?:\/\/[^\s]+\.(?:gif|webp|png|jpg|jpeg)(?:\?[^\s]*)?|https?:\/\/(?:media\.tenor\.com|c\.tenor\.com|media\.giphy\.com)[^\s]+)/i.test(content.trim());
    
    if (isGifUrl && content.trim().startsWith('http')) {
      return (
        <img
          src={content.trim()}
          alt="GIF"
          className="chat-gif-media"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }

    const myName = me?.display_name || '';
    const parts = content.split(/(@[a-zA-Z0-9_\s]{1,25})/g);

    return (
      <span>
        {parts.map((part, idx) => {
          if (part.startsWith('@')) {
            const mentionedName = part.slice(1).trim();
            const isMe = myName && mentionedName.toLowerCase() === myName.toLowerCase();
            return (
              <span
                key={idx}
                className={`chat-mention ${isMe ? 'chat-mention-me' : ''}`}
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </span>
    );
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
    setShowMentionPopover(false);
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



  if (roomNotFound) {
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
        gap: '20px'
      }}>
        <div style={{ fontSize: '48px' }}>📻</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Room Not Found</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '15px', maxWidth: '400px', textAlign: 'center', margin: 0 }}>
          This listening room does not exist or has been closed by the host.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '9999px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px'
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

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
              <h1 className="room-bar-name" title={room ? room.name : 'Loading...'}>
                {room ? room.name : 'Loading…'}
              </h1>
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

              {isConnected && (
                <SyncPrecisionBadge
                  offset={clockStats.offset}
                  rtt={clockStats.rtt}
                  isSynced={isConnected}
                  compact={true}
                />
              )}
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="header-actions">
            <button 
              className="btn btn-secondary room-bar-icon-btn" 
              onClick={() => setIsStageMode(true)} 
              title="Enter Stage Mode (Press F)"
            >
              <Maximize2 size={16} />
            </button>
            <button 
              className="btn btn-secondary room-bar-icon-btn" 
              onClick={() => setShowJamCardModal(true)} 
              title="Export Shareable Jam Card"
            >
              <Share2 size={16} />
            </button>
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
            isHost={canControl}
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
              if (!canControl || !playbackState.durationMs || !socket || !playerRef.current) return;
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
            onNext={canControl ? handleNextTrack : handleVoteSkip}
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
            ntpOffset={clockStats.offset}
            ntpRtt={clockStats.rtt}
            isSynced={isConnected}
            showSyncBadge={true}
          />

          {/* Skip Vote count display (only shown for guests when direct controls are disabled) */}
          {!canControl && skipVotes.required > 0 && (
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
              onClick={() => {
                setActiveTab('chat');
                setUnreadChatCount(0);
              }}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span>Chat ({listeners.length})</span>
              {unreadChatCount > 0 && (
                <span className="chat-unread-badge">{unreadChatCount}</span>
              )}
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
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && searchQuery.trim()) {
                            e.preventDefault();
                            setSearchLoading(true);
                            try {
                              const res = await fetch(`/search/tracks?q=${encodeURIComponent(searchQuery.trim())}`, { credentials: 'include' });
                              if (res.ok) {
                                const data = await res.json();
                                setSearchResults(data.tracks || []);
                              }
                            } catch (err) {}
                            setSearchLoading(false);
                          }
                        }}
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
                      {searchLoading ? (
                        <div className="search-loading-spinner" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', borderWidth: '2px' }} />
                      ) : (
                        <Search className="h-4 w-4" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                      )}
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
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (isHost && socket) {
                                  socket.emit('play_now', {
                                    track_uri: track.uri || track.track_uri,
                                    track_name: track.track_name || track.name,
                                    artist: track.artist || '',
                                    album_art_url: track.album_art_url || '',
                                    duration_ms: track.duration_ms || 240000,
                                  });
                                  triggerToast(`Playing "${track.track_name || track.name}" instantly!`, 'success');
                                }
                              }}
                              title={isHost ? 'Click to add to queue, Double click or Drag onto player to Play Now' : 'Click or Drag to add to queue'}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', cursor: 'grab' }}
                            >
                              <img decoding="async" loading="lazy" draggable="false" src={track.album_art_url || '/placeholder.svg'} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.track_name || track.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</span>
                              </div>
                              {isHost && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (socket) {
                                      socket.emit('play_now', {
                                        track_uri: track.uri || track.track_uri,
                                        track_name: track.track_name || track.name,
                                        artist: track.artist || '',
                                        album_art_url: track.album_art_url || '',
                                        duration_ms: track.duration_ms || 240000,
                                      });
                                      triggerToast(`Playing "${track.track_name || track.name}"!`, 'success');
                                    }
                                  }}
                                  title="Play Now"
                                  style={{
                                    background: 'rgba(255, 159, 28, 0.15)',
                                    border: '1px solid rgba(255, 159, 28, 0.3)',
                                    color: 'var(--theme-accent, #ff9f1c)',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-accent, #ff9f1c)';
                                    e.currentTarget.style.color = '#000';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 159, 28, 0.15)';
                                    e.currentTarget.style.color = 'var(--theme-accent, #ff9f1c)';
                                  }}
                                >
                                  <Play size={11} fill="currentColor" /> Play
                                </button>
                              )}
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
                    {activeQueueTab === 'queue' && queue.length > 0 && me && me.is_registered && (
                      <button
                        type="button"
                        onClick={handleSaveQueueToPlaylist}
                        className="queue-action-btn"
                        title="Save active queue as a new playlist on your profile"
                      >
                        <Bookmark size={13} style={{ color: 'var(--amber, #ff9f1c)' }} />
                        <span>Save Playlist</span>
                      </button>
                    )}
                  </div>

                  {activeQueueTab === 'queue' ? (
                    queue.length > 0 ? (
                      <Reorder.Group
                        axis="y"
                        values={queue}
                        onReorder={handleReorderQueue}
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, margin: 0, listStyle: 'none' }}
                      >
                        {queue.map((item, idx) => (
                          <Reorder.Item 
                            key={item.id}
                            value={item}
                            dragListener={isHost && item.status !== 'playing'}
                            whileDrag={{
                              scale: 1.025,
                              boxShadow: '0 16px 36px rgba(0,0,0,0.8), 0 0 20px rgba(255, 159, 28, 0.35)',
                              zIndex: 100,
                              cursor: 'grabbing'
                            }}
                            transition={{ duration: 0.2 }}
                            className={`queue-item reorder-item-card ${item.status === 'playing' ? 'playing' : ''}`}
                            onDoubleClick={() => {
                              if (isHost && socket && item.status !== 'playing') {
                                socket.emit('play_now', {
                                  track_uri: item.track_uri || item.id,
                                  track_name: item.track_name,
                                  artist: item.artist,
                                  album_art_url: item.album_art_url,
                                  duration_ms: item.duration_ms || 240000
                                });
                                triggerToast(`Playing "${item.track_name}"!`, 'success');
                              }
                            }}
                            title={item.status !== 'playing' ? (isHost ? 'Drag to reorder • Double click to Play Now' : 'Track in queue') : 'Currently playing'}
                            style={{
                              cursor: item.status !== 'playing' && isHost ? 'grab' : 'default',
                              position: 'relative'
                            }}
                          >
                            {/* Reorder drag handle indicator for host on pending tracks */}
                            {isHost && item.status !== 'playing' && (
                              <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.3)', paddingRight: '2px', cursor: 'grab' }} title="Drag to reorder">
                                <GripVertical size={15} />
                              </div>
                            )}

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
                                  {/* Host Play Now Button */}
                                  {isHost && (
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.15 }}
                                      whileTap={{ scale: 0.88 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (socket) {
                                          socket.emit('play_now', {
                                            track_uri: item.track_uri || item.id,
                                            track_name: item.track_name,
                                            artist: item.artist,
                                            album_art_url: item.album_art_url,
                                            duration_ms: item.duration_ms || 240000
                                          });
                                          triggerToast(`Playing "${item.track_name}"!`, 'success');
                                        }
                                      }}
                                      title="Play Now"
                                      style={{
                                        background: 'rgba(255, 159, 28, 0.15)',
                                        border: '1px solid rgba(255, 159, 28, 0.3)',
                                        color: 'var(--theme-accent, #ff9f1c)',
                                        padding: '6px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <Play size={13} fill="currentColor" />
                                    </motion.button>
                                  )}
                                  {me && me.is_registered && playlists.length > 0 && (
                                    <div 
                                      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.88 }}
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
                                        }}
                                      >
                                        <ListPlus size={14} />
                                      </motion.button>

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
                                              top: idx >= Math.max(1, queue.length - 2) ? 'auto' : '100%',
                                              bottom: idx >= Math.max(1, queue.length - 2) ? '100%' : 'auto',
                                              marginTop: idx >= Math.max(1, queue.length - 2) ? 0 : '6px',
                                              marginBottom: idx >= Math.max(1, queue.length - 2) ? '6px' : 0,
                                              background: 'rgba(15, 15, 22, 0.98)',
                                              backdropFilter: 'blur(16px)',
                                              WebkitBackdropFilter: 'blur(16px)',
                                              border: '1px solid rgba(255, 255, 255, 0.12)',
                                              borderRadius: '12px',
                                              padding: '6px 0',
                                              minWidth: '180px',
                                              zIndex: 991,
                                              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                                              display: 'flex',
                                              flexDirection: 'column'
                                            }}
                                          >
                                            <div style={{
                                              fontSize: '10px',
                                              color: 'rgba(255,255,255,0.45)',
                                              padding: '6px 14px',
                                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                                              fontWeight: 700,
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.08em'
                                            }}>Add to Playlist</div>
                                            <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '4px 0', scrollbarWidth: 'none' }}>
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
                                                          track_uri: item.track_uri || item.id,
                                                          track_name: item.track_name,
                                                          artist: item.artist,
                                                          album_art_url: item.album_art_url,
                                                          duration_ms: item.duration_ms || 240000
                                                        }),
                                                        credentials: 'include'
                                                      });
                                                      if (res.ok) {
                                                        triggerToast(`Added to "${p.name}"!`, 'success');
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
                                                    color: 'rgba(255,255,255,0.85)',
                                                    textAlign: 'left',
                                                    padding: '7px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.15s',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                                    e.currentTarget.style.color = '#fff';
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'none';
                                                    e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                                                  }}
                                                >
                                                  <Bookmark size={12} style={{ color: 'var(--amber, #ff9f1c)', flexShrink: 0 }} />
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
                                    <motion.button
                                      whileHover={{ scale: 1.2, color: '#ff4d4d' }}
                                      whileTap={{ scale: 0.85 }}
                                      className="btn-remove"
                                      onClick={() => handleRemoveQueueTrack(item.id)}
                                      style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '4px' }}
                                    >
                                      ✕
                                    </motion.button>
                                  )}
                                </>
                              )}
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
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
                    chatMsgs.map((msg) => {
                      if (msg.type === 'reaction') {
                        return (
                          <div key={msg.id} className="chat-reaction-item">
                            <div className="chat-reaction-pill">
                              <span className="chat-reaction-user">{msg.user_name}</span> reacted with <span className="chat-reaction-emoji">{msg.content}</span>
                            </div>
                          </div>
                        );
                      }
                      if (msg.type === 'system') return null;
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
                              <div className="chat-msg-text">{renderMessageContent(msg.content)}</div>
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
                  {/* Mention Autocomplete Popover */}
                  {showMentionPopover && (
                    <MentionPopover
                      listeners={listeners}
                      query={mentionQuery}
                      me={me}
                      hostId={room?.host_user_id}
                      onSelect={handleSelectMention}
                      onClose={() => setShowMentionPopover(false)}
                    />
                  )}

                  {/* Emoji Picker Popover */}
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

                  {/* Tenor GIF Picker Modal */}
                  {showGifPicker && (
                    <TenorGifPicker
                      isModal={true}
                      onSelectGif={handleSelectGif}
                      onClose={() => setShowGifPicker(false)}
                    />
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
                      placeholder="Say something… (type @ to mention)" 
                      maxLength="500" 
                      rows="1"
                      style={{ flex: 1, resize: 'none', height: '40px', boxSizing: 'border-box' }}
                    />
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowGifPicker(!showGifPicker);
                        setShowChatEmojiPicker(false);
                        setShowReactionEmojiPicker(false);
                      }}
                      style={{
                        background: showGifPicker ? 'rgba(255, 159, 28, 0.15)' : 'none',
                        border: showGifPicker ? '1px solid rgba(255, 159, 28, 0.3)' : 'none',
                        borderRadius: '8px',
                        color: showGifPicker ? 'var(--amber)' : 'var(--text-3)',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      title="Add GIF from Tenor"
                    >
                      GIF
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowChatEmojiPicker(!showChatEmojiPicker);
                        setShowGifPicker(false);
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
                  <div className="chat-input-hint">Enter = send · Shift+Enter = new line · @ to mention</div>
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
                style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', padding: '4px 2px' }}
              >
                {/* Header counter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                    In Room — {listeners.length}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#10b981' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                    Live
                  </div>
                </div>

                {/* Host Section */}
                {(() => {
                  const hostUser = listeners.find(u => {
                    const uid = u.user_id || u.id;
                    return room && room.host_user_id === uid;
                  }) || (room ? { display_name: room.host_display_name || 'Room Host', user_id: room.host_user_id, is_host: true } : null);

                  if (!hostUser) return null;
                  const hostUid = hostUser.user_id || hostUser.id;
                  const isSelf = me && hostUid === me.id;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber)', paddingLeft: '8px' }}>
                        👑 Room Host
                      </span>
                      <div 
                        className={`member-item is-host-card ${hostUser.is_registered ? 'is-registered' : ''}`}
                        style={{
                          background: 'rgba(255, 159, 28, 0.08)',
                          border: '1px solid rgba(255, 159, 28, 0.28)',
                          borderRadius: '14px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: hostUser.is_registered ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                          if (hostUser.is_registered && hostUid) {
                            window.open(`/profile/${hostUid}`, '_blank');
                          }
                        }}
                      >
                        {hostUser.avatar_url ? (
                          <img 
                            decoding="async" 
                            loading="lazy" 
                            className="avatar" 
                            src={hostUser.avatar_url} 
                            alt="" 
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%', 
                              objectFit: 'cover',
                              border: '2px solid var(--amber, #ff9f1c)',
                              boxShadow: '0 0 10px rgba(255, 159, 28, 0.4)'
                            }} 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement.querySelector('.host-avatar-fallback');
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="avatar host-avatar-fallback"
                          style={{ 
                            backgroundColor: nameColor(hostUser.display_name), 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            display: hostUser.avatar_url ? 'none' : 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            border: '2px solid var(--amber, #ff9f1c)',
                            boxShadow: '0 0 10px rgba(255, 159, 28, 0.4)'
                          }}
                        >
                          {initials(hostUser.display_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {hostUser.display_name}
                            {isSelf && <span style={{ color: 'var(--amber)', fontSize: '11px', fontWeight: 600 }}> (you)</span>}
                          </div>
                          <div style={{ fontSize: '10px', color: 'rgba(255, 159, 28, 0.85)', fontWeight: 600 }}>DJ & Session Host</div>
                        </div>
                        <span className="badge badge-host" style={{ padding: '3px 8px', fontSize: '10px' }}>Host</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Other Listeners Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', paddingLeft: '8px' }}>
                    Listeners ({listeners.filter(u => !room || (u.user_id || u.id) !== room.host_user_id).length})
                  </span>
                  {listeners.filter(u => !room || (u.user_id || u.id) !== room.host_user_id).length > 0 ? (
                    listeners
                      .filter(u => !room || (u.user_id || u.id) !== room.host_user_id)
                      .map((user, idx) => {
                        const uid = user.user_id || user.id || `user-${idx}`;
                        const isSelf = me && uid === me.id;
                        return (
                          <div 
                            key={uid} 
                            className={`member-item ${user.is_registered ? 'is-registered' : ''}`}
                            style={{
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.04)',
                              borderRadius: '12px',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: user.is_registered ? 'pointer' : 'default',
                              transition: 'all 0.2s ease'
                            }}
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
                                  width: '26px', 
                                  height: '26px', 
                                  borderRadius: '50%', 
                                  objectFit: 'cover'
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
                                width: '26px', 
                                height: '26px', 
                                borderRadius: '50%', 
                                display: user.avatar_url ? 'none' : 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '11px', 
                                fontWeight: 'bold'
                              }}
                            >
                              {initials(user.display_name)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span className="member-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)' }}>
                                {user.display_name}
                                {isSelf && <span className="member-you" style={{ color: 'var(--amber)', fontSize: '11px' }}> (you)</span>}
                              </span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-3)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '6px' }}>
                              {user.is_registered ? 'Member' : 'Guest'}
                            </span>
                          </div>
                        );
                      })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '11px', color: 'var(--text-3)' }}>
                      No other listeners yet. Invite friends to jam!
                    </div>
                  )}
                </div>
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
        <button 
          className={`mob-tab ${activeTab === 'chat' ? 'active' : ''}`} 
          onClick={() => {
            setActiveTab('chat');
            setUnreadChatCount(0);
          }}
          style={{ position: 'relative' }}
        >
          <Send className="h-5 w-5" />
          <span className="mob-tab-label">Chat</span>
          {unreadChatCount > 0 && (
            <span className="mob-unread-badge">{unreadChatCount}</span>
          )}
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

                {/* ══ Equalizer & Sound Profile ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)' }}>Audio Equalizer & FX</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Choose acoustic sound profile</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {[
                      { id: 'normal', name: 'Studio Flat' },
                      { id: 'bass_boost', name: '🔥 Bass Boost' },
                      { id: 'vocal', name: '🎤 Vocal Clarity' },
                      { id: 'club', name: '⚡ Club / EDM' },
                      { id: 'vinyl', name: '📻 Warm Vinyl' },
                    ].map((preset) => {
                      const isSelected = (eqPreset || 'normal') === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setEqPreset(preset.id);
                            if (playerRef.current) {
                              playerRef.current.setEqPreset(preset.id);
                            }
                            triggerToast(`Equalizer: ${preset.name}`, 'info');
                          }}
                          style={{
                            background: isSelected ? 'var(--theme-accent, #ff9f1c)' : 'rgba(255,255,255,0.05)',
                            color: isSelected ? '#000000' : '#ffffff',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '11.5px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
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

                {/* Host-only toggle for live collaborative playback controls */}
                {isHost && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)' }}>Collaborative Controls</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Allow listeners to play, pause, seek, and skip tracks</div>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={allowGuestControls} 
                        onChange={(e) => {
                          const newVal = e.target.checked;
                          setAllowGuestControls(newVal);
                          if (socket) {
                            socket.emit('toggle_guest_controls', { allow: newVal });
                          }
                          triggerToast(newVal ? 'Collaborative playback enabled' : 'Collaborative playback disabled (Host Only)', 'info');
                        }}
                      />
                      <span className="toggle-switch-slider"></span>
                    </label>
                  </div>
                )}
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
      {/* ══ STAGE MODE FULLSCREEN VISUALIZER (Apple Music & Vinyl Kinetic Stage) ══ */}
      <AnimatePresence>
        {isStageMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onMouseMove={handleStageMouseMove}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: '#070504',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '36px 48px',
              fontFamily: 'var(--font-ui-next), sans-serif',
              overflow: 'hidden',
              color: '#ffffff',
            }}
          >
            {/* Full-Bleed Blurred Cover Art Background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: nowPlaying?.album_art_url ? `url(${nowPlaying.album_art_url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(110px) brightness(0.28) saturate(2.0)',
                transform: 'scale(1.3)',
                pointerEvents: 'none',
                transition: 'background-image 1.2s ease',
              }}
            />

            {/* ✨ Dynamic Ambient Color Bleed & Drifting Bokeh */}
            <div className="ambient-bokeh-layer">
              <div
                className="ambient-blob ambient-blob-1"
                style={{
                  background: `radial-gradient(circle, ${colorsRef.current[0] || '#ff9f1c'} 0%, transparent 70%)`
                }}
              />
              <div
                className="ambient-blob ambient-blob-2"
                style={{
                  background: `radial-gradient(circle, ${colorsRef.current[1] || '#8b5cf6'} 0%, transparent 70%)`
                }}
              />
              <div
                className="ambient-blob ambient-blob-3"
                style={{
                  background: `radial-gradient(circle, ${colorsRef.current[2] || '#ec4899'} 0%, transparent 70%)`
                }}
              />
            </div>

            {/* Dark Vignette Radial Overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 30% 50%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* Top Left NTP Sync Precision Badge */}
            <div style={{ position: 'absolute', top: '28px', left: '36px', zIndex: 100, display: 'flex', alignItems: 'center' }}>
              <SyncPrecisionBadge
                offset={clockStats.offset}
                rtt={clockStats.rtt}
                isSynced={isConnected}
                compact={false}
                showDetails={true}
              />
            </div>

            {/* Top Right Exit Fullscreen Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.08, background: 'rgba(255, 255, 255, 0.15)', transition: { type: 'spring', stiffness: 420, damping: 16 } }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsStageMode(false)}
              style={{
                position: 'absolute',
                top: '28px',
                right: '36px',
                padding: '8px 16px',
                borderRadius: '99px',
                background: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                fontSize: '13px',
                fontWeight: 600,
              }}
              aria-label="Exit Fullscreen (Esc)"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 size={16} />
              <span>Exit Stage</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '2px' }}>Esc</span>
            </motion.button>

            {/* Main Split Grid Stage — Always Split 2 Columns */}
            <div
              className="stage-view-grid"
              style={{
                display: 'grid',
                gap: '56px',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                zIndex: 10,
                width: '100%',
                height: '100%',
                padding: '40px 64px',
                boxSizing: 'border-box',
              }}
            >
              {/* Left Column: Clean Artwork Card, Track Meta, Timeline, Controls & Utility Toolbar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                
                {/* Clean, Pristine Square Album Artwork Card with Play/Pause Hover Overlay */}
                <motion.div
                  className="stage-art-card"
                  onMouseEnter={() => setArtHovered(true)}
                  onMouseLeave={() => setArtHovered(false)}
                  onClick={handleTogglePlay}
                  onWheel={handleExpVolumeScroll}
                  animate={{
                    scale: artHovered ? 1.025 : 1,
                  }}
                  transition={{
                    scale: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                  }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '400px',
                    aspectRatio: '1/1',
                    borderRadius: '26px',
                    overflow: 'hidden',
                    cursor: canControl ? 'pointer' : 'default',
                    boxShadow: artHovered
                      ? '0 32px 80px rgba(0, 0, 0, 0.95), 0 0 36px rgba(255, 159, 28, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                      : '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                    background: '#121218',
                  }}
                  title={canControl ? `Click to ${playbackState.isPlaying ? 'Pause' : 'Play'} • Scroll for volume` : 'Scroll for volume'}
                >
                  {/* Background Cover Image or Clean Placeholder */}
                  {nowPlaying?.album_art_url ? (
                    <img
                      src={nowPlaying.album_art_url}
                      alt={nowPlaying?.track_name || 'Album Art'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.4s ease',
                        transform: artHovered ? 'scale(1.04)' : 'scale(1)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'radial-gradient(circle at center, #1e1e28 0%, #0a0a10 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                      }}
                    >
                      <Music size={64} style={{ opacity: 0.3, color: '#ffffff' }} />
                    </div>
                  )}

                  {/* Clean Glass Sheen Highlight */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, transparent 100%)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Play/Pause Hover Overlay Icon */}
                  {canControl && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.32)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: artHovered ? 1 : 0,
                        transition: 'opacity 0.25s ease',
                        pointerEvents: 'none',
                      }}
                    >
                      <motion.div
                        animate={{ scale: artHovered ? 1 : 0.85 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.95)',
                          color: '#08080c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        }}
                      >
                        {playbackState.isPlaying
                          ? <Pause size={28} fill="currentColor" />
                          : <Play size={28} fill="currentColor" style={{ marginLeft: '4px' }} />}
                      </motion.div>
                    </div>
                  )}
                </motion.div>

                {/* Track Title & Artist Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '4px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
                    <h2 style={{
                      fontFamily: 'var(--font-display-next), Outfit, system-ui, sans-serif',
                      fontSize: '26px',
                      fontWeight: 800,
                      color: '#ffffff',
                      margin: 0,
                      letterSpacing: '-0.025em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '92%',
                    }}>
                      {nowPlaying?.track_name || 'No Track Playing'}
                    </h2>
                    {playbackState.isPlaying && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                        <div className="queue-wave" style={{ height: '14px', width: '3px', animationDelay: '0s', background: '#ffffff' }}></div>
                        <div className="queue-wave" style={{ height: '14px', width: '3px', animationDelay: '0.15s', background: '#ffffff' }}></div>
                        <div className="queue-wave" style={{ height: '14px', width: '3px', animationDelay: '0.3s', background: '#ffffff' }}></div>
                        <div className="queue-wave" style={{ height: '14px', width: '3px', animationDelay: '0.45s', background: '#ffffff' }}></div>
                      </div>
                    )}
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui-next), sans-serif',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.7)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '92%',
                  }}>
                    {nowPlaying?.artist || 'Idle Room'}
                    {streamErrorMsg && (
                      <span style={{ color: 'var(--amber, #ff9f1c)', marginLeft: '8px', fontSize: '12px', fontWeight: 700 }}>
                        • {streamErrorMsg}
                      </span>
                    )}
                  </p>
                </div>

                {/* Progress Bar Timeline with Side Timestamps */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  {/* Elapsed Time */}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatTime(playbackState.positionMs)}
                  </span>

                  {/* Progress Seekbar */}
                  <div
                    ref={stageSeekBarRef}
                    onMouseDown={handleStageSeekDown}
                    onTouchStart={handleStageSeekDown}
                    onMouseEnter={() => setStageSeekHovered(true)}
                    onMouseLeave={() => { setStageSeekHovered(false); setSeekHoverTimeMs(null); }}
                    onMouseMove={(e) => {
                      const rect = stageSeekBarRef.current?.getBoundingClientRect();
                      if (!rect || !playbackState.durationMs) return;
                      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                      const ratio = x / rect.width;
                      setSeekHoverXRatio(ratio);
                      setSeekHoverTimeMs(Math.round(ratio * playbackState.durationMs));
                    }}
                    style={{
                      flex: 1,
                      height: stageSeekHovered || isDraggingStageSeekRef.current ? '8px' : '5px',
                      borderRadius: '99px',
                      background: 'rgba(255, 255, 255, 0.22)',
                      position: 'relative',
                      cursor: canControl ? 'pointer' : 'default',
                      overflow: 'visible',
                      touchAction: 'none',
                      userSelect: 'none',
                      transition: 'height 0.15s ease',
                    }}
                    role="slider"
                    aria-label="Seek"
                    aria-valuemin={0}
                    aria-valuemax={playbackState.durationMs || 0}
                    aria-valuenow={playbackState.positionMs || 0}
                  >
                    {/* Hover timestamp tooltip */}
                    {stageSeekHovered && seekHoverTimeMs !== null && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '14px',
                          left: `${seekHoverXRatio * 100}%`,
                          transform: 'translateX(-50%)',
                          background: 'rgba(10, 10, 15, 0.92)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '3px 7px',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: '#ffffff',
                          pointerEvents: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          whiteSpace: 'nowrap',
                          zIndex: 20,
                        }}
                      >
                        {formatTime(seekHoverTimeMs)}
                      </div>
                    )}

                    {/* Filled progress */}
                    <div
                      style={{
                        width: `${playbackState.durationMs ? Math.min(100, (playbackState.positionMs / playbackState.durationMs) * 100) : 0}%`,
                        height: '100%',
                        background: '#ffffff',
                        borderRadius: '99px',
                        position: 'relative',
                        transition: isDraggingStageSeekRef.current ? 'none' : 'width 0.1s linear',
                        boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      {/* Scrub thumb */}
                      {canControl && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '-6px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: stageSeekHovered || isDraggingStageSeekRef.current ? '14px' : '11px',
                            height: stageSeekHovered || isDraggingStageSeekRef.current ? '14px' : '11px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 0 8px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.5)',
                            pointerEvents: 'none',
                            transition: 'width 0.15s ease, height 0.15s ease',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Total Duration */}
                  <span
                    onClick={() => setShowTimeRemaining(prev => !prev)}
                    style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
                    title="Click to toggle total duration / time remaining"
                  >
                    {showTimeRemaining && playbackState.durationMs
                      ? `-${formatTime(Math.max(0, playbackState.durationMs - playbackState.positionMs))}`
                      : formatTime(playbackState.durationMs)}
                  </span>
                </div>

                {/* Main Transport Controls Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', width: '100%', marginTop: '2px' }}>
                  {/* Shuffle Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: isHost ? 1.15 : 1, transition: { type: 'spring', stiffness: 420, damping: 16 } }}
                    whileTap={{ scale: isHost ? 0.88 : 1 }}
                    onClick={() => {
                      if (isHost) handleShuffleClick();
                      else triggerToast('Only the host can shuffle', 'info');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isHost ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)',
                      cursor: isHost ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                    }}
                    aria-label="Shuffle Queue"
                    title={isHost ? 'Shuffle Queue' : 'Only the host can shuffle'}
                  >
                    <Shuffle size={20} />
                  </motion.button>

                  {/* Previous Track Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: canControl ? 1.15 : 1, x: canControl ? -2 : 0, transition: { type: 'spring', stiffness: 420, damping: 16 } }}
                    whileTap={{ scale: canControl ? 0.88 : 1 }}
                    onClick={() => {
                      if (canControl) handlePreviousTrack();
                      else triggerToast('Playback control is host-only in this room', 'info');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      cursor: canControl ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                    }}
                    aria-label="Previous Track"
                    title={canControl ? 'Previous Track' : 'Playback control is host-only in this room'}
                  >
                    <SkipBack size={24} fill="#ffffff" />
                  </motion.button>

                  {/* Hero Play/Pause Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: canControl ? 1.1 : 1, transition: { type: 'spring', stiffness: 420, damping: 16 } }}
                    whileTap={{ scale: canControl ? 0.9 : 1 }}
                    onClick={() => {
                      if (canControl) handleTogglePlay();
                      else triggerToast('Playback control is host-only in this room', 'info');
                    }}
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: 'none',
                      color: '#08080c',
                      cursor: canControl ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(255,255,255,0.25), 0 4px 12px rgba(0,0,0,0.5)',
                    }}
                    aria-label={playbackState.isPlaying ? 'Pause' : 'Play'}
                    title={canControl ? (playbackState.isPlaying ? 'Pause' : 'Play') : 'Playback control is host-only in this room'}
                  >
                    {playbackState.isPlaying
                      ? <Pause size={24} fill="#08080c" />
                      : <Play size={24} fill="#08080c" style={{ marginLeft: '3px' }} />}
                  </motion.button>

                  {/* Next Track Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.15, x: 2, transition: { type: 'spring', stiffness: 420, damping: 16 } }}
                    whileTap={{ scale: 0.88 }}
                    onClick={canControl ? handleNextTrack : handleVoteSkip}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                    }}
                    aria-label={canControl ? 'Next Track' : 'Vote to Skip'}
                    title={canControl ? 'Next Track' : 'Vote to Skip'}
                  >
                    <SkipForward size={24} fill="#ffffff" />
                  </motion.button>

                  {/* Repeat Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: canControl ? 1.15 : 1, transition: { type: 'spring', stiffness: 420, damping: 16 } }}
                    whileTap={{ scale: canControl ? 0.88 : 1 }}
                    onClick={() => {
                      if (canControl) handleRepeatToggle();
                      else triggerToast('Only the host can toggle repeat', 'info');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: canControl
                        ? (playbackState.loop ? 'var(--theme-accent, #ff9f1c)' : 'rgba(255,255,255,0.8)')
                        : 'rgba(255,255,255,0.25)',
                      cursor: canControl ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                    }}
                    aria-label="Toggle Repeat"
                    title={canControl ? 'Toggle Repeat' : 'Only the host can toggle repeat'}
                  >
                    <Repeat size={20} />
                  </motion.button>
                </div>

                {/* Sleek Auxiliary Glass Utility Toolbar (Heart + Volume + Lyrics Offset + Queue + Settings) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 18px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '99px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: '4px',
                    position: 'relative',
                  }}
                >
                  {/* Heart / Like Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.2, transition: { type: 'spring', stiffness: 420, damping: 16 } }}
                    whileTap={{ scale: 0.82 }}
                    onClick={handleLikeToggle}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: favourites.some(f => f.track_uri === nowPlaying?.track_uri) ? '#ff2a5f' : 'rgba(255, 255, 255, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: '4px',
                      filter: favourites.some(f => f.track_uri === nowPlaying?.track_uri) ? 'drop-shadow(0 0 8px rgba(255, 42, 95, 0.6))' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                    title={favourites.some(f => f.track_uri === nowPlaying?.track_uri) ? 'Unlike track' : 'Add to Favorites (L)'}
                  >
                    <Heart
                      size={18}
                      fill={favourites.some(f => f.track_uri === nowPlaying?.track_uri) ? '#ff2a5f' : 'none'}
                    />
                  </motion.button>

                  {/* Horizontal Volume Bar with Exponential Loudness */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '140px', margin: '0 4px' }}>
                    <button
                      type="button"
                      onClick={() => setIsMuted(prev => !prev)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.85)', cursor: 'pointer', padding: 0, display: 'flex' }}
                      title={isMuted ? "Unmute" : "Mute (M)"}
                    >
                      {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="stage-vol-slider"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const newVol = parseInt(e.target.value);
                        setVolume(newVol);
                        if (newVol > 0 && isMuted) setIsMuted(false);
                      }}
                      style={{
                        background: `linear-gradient(to right, #ffffff ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.18) ${isMuted ? 0 : volume}%)`,
                      }}
                      title={`Volume: ${isMuted ? 0 : volume}%`}
                    />
                  </div>

                  {/* Lyrics Sync Calibrator Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowLyricsSyncPanel(prev => !prev)}
                    style={{
                      background: showLyricsSyncPanel || lyricsOffsetMs !== 0 ? 'rgba(255, 159, 28, 0.25)' : 'transparent',
                      border: 'none',
                      color: showLyricsSyncPanel || lyricsOffsetMs !== 0 ? 'var(--theme-accent, #ff9f1c)' : 'rgba(255, 255, 255, 0.85)',
                      borderRadius: '8px',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    title={`Lyrics Sync Calibration (${lyricsOffsetMs > 0 ? `+${lyricsOffsetMs}ms` : `${lyricsOffsetMs}ms`})`}
                  >
                    <Clock size={17} />
                  </motion.button>

                  {/* Up Next Queue Toggle Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowStageQueue(prev => !prev)}
                    style={{
                      background: showStageQueue ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                      border: 'none',
                      color: showStageQueue ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                      borderRadius: '8px',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    title="Toggle Queue Drawer (Q)"
                  >
                    <List size={17} />
                  </motion.button>

                  {/* Room Settings Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowSettings(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.85)',
                      borderRadius: '8px',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    title="Room Settings"
                  >
                    <Settings size={17} />
                  </motion.button>

                  {/* Floating Lyrics Timing Calibrator Sub-Panel */}
                  <AnimatePresence>
                    {showLyricsSyncPanel && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        style={{
                          position: 'absolute',
                          bottom: '120%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(18, 18, 24, 0.95)',
                          backdropFilter: 'blur(24px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '16px',
                          padding: '14px 18px',
                          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          width: '280px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                          <span>Lyrics Timing Offset</span>
                          <span style={{ color: 'var(--theme-accent, #ff9f1c)', fontFamily: 'monospace', fontWeight: 800 }}>
                            {lyricsOffsetMs > 0 ? `+${(lyricsOffsetMs/1000).toFixed(2)}s` : `${(lyricsOffsetMs/1000).toFixed(2)}s`}
                          </span>
                        </div>
                        {/* Fine Tuning */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setLyricsOffsetMs(prev => prev - 100);
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '5px 0',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Shift lyrics 0.1s earlier"
                          >
                            -0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLyricsOffsetMs(prev => prev - 250);
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '5px 0',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Shift lyrics 0.25s earlier"
                          >
                            -0.25s
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLyricsOffsetMs(0);
                              triggerToast('Lyrics sync reset to default', 'info');
                            }}
                            style={{
                              flex: 1.2,
                              background: 'rgba(255, 159, 28, 0.15)',
                              border: '1px solid rgba(255, 159, 28, 0.3)',
                              color: 'var(--theme-accent, #ff9f1c)',
                              borderRadius: '6px',
                              padding: '5px 0',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLyricsOffsetMs(prev => prev + 250);
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '5px 0',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Shift lyrics 0.25s later"
                          >
                            +0.25s
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLyricsOffsetMs(prev => prev + 100);
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '5px 0',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Shift lyrics 0.1s later"
                          >
                            +0.1s
                          </button>
                        </div>
                        {/* Coarse Jumps */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setLyricsOffsetMs(prev => prev - 1000)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.7)',
                              borderRadius: '6px',
                              padding: '4px 0',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            -1.0s
                          </button>
                          <button
                            type="button"
                            onClick={() => setLyricsOffsetMs(prev => prev - 500)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.7)',
                              borderRadius: '6px',
                              padding: '4px 0',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() => setLyricsOffsetMs(prev => prev + 500)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.7)',
                              borderRadius: '6px',
                              padding: '4px 0',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            +0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() => setLyricsOffsetMs(prev => prev + 1000)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.7)',
                              borderRadius: '6px',
                              padding: '4px 0',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            +1.0s
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Column: Apple Music Style Kinetic Lyrics Display OR Up Next Queue Drawer */}
              {showStageQueue ? (
                /* Stage Mode Queue Drawer */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    height: '100%',
                    maxHeight: 'calc(100vh - 90px)',
                    overflowY: 'auto',
                    paddingRight: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>Up Next</h3>
                    <button
                      onClick={() => setShowStageQueue(false)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      Close
                    </button>
                  </div>
                  <div className="stage-queue-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {queue.length > 0 ? (
                      <Reorder.Group
                        axis="y"
                        values={queue}
                        onReorder={handleReorderQueue}
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, margin: 0, listStyle: 'none' }}
                      >
                        {queue.map((track) => (
                          <Reorder.Item
                            key={track.id}
                            value={track}
                            dragListener={isHost && track.status !== 'playing'}
                            className={`stage-queue-card ${track.status === 'playing' ? 'playing' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 14px',
                              background: track.status === 'playing' ? 'rgba(255, 159, 28, 0.15)' : 'rgba(255,255,255,0.04)',
                              border: track.status === 'playing' ? '1px solid rgba(255, 159, 28, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '12px',
                              cursor: isHost && track.status !== 'playing' ? 'grab' : 'default',
                            }}
                          >
                            {isHost && track.status !== 'playing' && (
                              <GripVertical size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                            )}
                            <img
                              src={track.album_art_url || '/static/img/logo.png'}
                              alt=""
                              style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {track.track_name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {track.artist}
                              </div>
                            </div>
                            {track.status === 'playing' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span className="playing-wave-bar" style={{ height: '14px' }} />
                                <span className="playing-wave-bar" style={{ height: '8px', animationDelay: '0.2s' }} />
                                <span className="playing-wave-bar" style={{ height: '12px', animationDelay: '0.4s' }} />
                              </div>
                            )}
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Queue empty</div>
                    )}
                  </div>
                </motion.div>
              ) : lyricsText.length > 0 ? (
                /* Kinetic Multi-Language Karaoke Lyrics Display */
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <div
                    ref={stageLyricsScrollRef}
                    onWheel={() => {
                      userScrolledLyricsRef.current = true;
                      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
                      userScrollTimerRef.current = setTimeout(() => {
                        userScrolledLyricsRef.current = false;
                      }, 3400);
                    }}
                    onTouchMove={() => {
                      userScrolledLyricsRef.current = true;
                      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
                      userScrollTimerRef.current = setTimeout(() => {
                        userScrolledLyricsRef.current = false;
                      }, 3400);
                    }}
                    style={{
                      height: '100%',
                      maxHeight: 'calc(100vh - 90px)',
                      overflowY: 'auto',
                      paddingRight: '28px',
                      paddingTop: '35vh',
                      paddingBottom: '50vh',
                      maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 85%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 85%, transparent 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '36px',
                      scrollbarWidth: 'none',
                      fontFamily: 'var(--font-display-next), var(--font-ui-next), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif',
                      scrollBehavior: 'smooth',
                    }}
                  >
                    {/* Clean Apple Music Style Intro Rhythm Dots */}
                    {lyricsActiveIdx === -1 && playbackState.isPlaying && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '16px 0 28px 0' }}
                      >
                        <div className="stage-rhythm-dots">
                          <span className="stage-rhythm-dot" />
                          <span className="stage-rhythm-dot" />
                          <span className="stage-rhythm-dot" />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.65)' }}>
                          Intro
                        </span>
                      </motion.div>
                    )}

                    {lyricsText.map((item, idx) => {
                      const isActive = idx === lyricsActiveIdx;

                      // Word-by-word natural singing cadence calculation for active line
                      let words = (item.text || '').split(' ');
                      let activeWordIdx = -1;
                      if (isActive && item.timeMs !== undefined && item.timeMs >= 0) {
                        const nextTime = (lyricsText[idx + 1] && lyricsText[idx + 1].timeMs > 0)
                          ? lyricsText[idx + 1].timeMs
                          : item.timeMs + 4000;
                        const rawGap = Math.max(800, nextTime - item.timeMs);
                        const estimatedSingTime = Math.min(rawGap, Math.max(900, words.length * 360 + 300));
                        const effectivePos = (playbackState.positionMs || 0) + lyricsOffsetMs + 80;
                        const elapsed = Math.max(0, effectivePos - item.timeMs);
                        const ratio = Math.min(1, elapsed / estimatedSingTime);
                        activeWordIdx = Math.floor(ratio * words.length);
                        if (elapsed >= estimatedSingTime) {
                          activeWordIdx = words.length - 1;
                        }
                      }

                      return (
                        <motion.div
                          key={idx}
                          id={`stage-lyr-${idx}`}
                          animate={{
                            scale: isActive ? 1.05 : 1,
                            opacity: isActive ? 1 : (idx < lyricsActiveIdx ? 0.5 : 0.22),
                            x: isActive ? 16 : 0,
                          }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          style={{
                            fontSize: isActive ? 'clamp(32px, 4.2vw, 54px)' : 'clamp(20px, 2.6vw, 34px)',
                            fontWeight: isActive ? 800 : 600,
                            margin: 0,
                            cursor: canControl ? 'pointer' : 'default',
                            color: isActive ? '#ffffff' : (idx < lyricsActiveIdx ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'),
                            lineHeight: 1.32,
                            transformOrigin: 'left center',
                            letterSpacing: '-0.025em',
                            wordBreak: 'break-word',
                            filter: isActive ? 'none' : 'blur(0.35px)',
                            textShadow: isActive ? '0 0 28px rgba(255, 255, 255, 0.45), 0 0 50px var(--theme-accent, #ff9f1c)' : 'none',
                            transition: 'filter 0.3s ease, font-size 0.3s ease',
                          }}
                          onClick={() => {
                            if (item.timeMs >= 0 && canControl && playerRef.current) {
                              setPlaybackState(prev => ({ ...prev, positionMs: item.timeMs }));
                              playerRef.current.seek(item.timeMs / 1000);
                              if (socket) {
                                socket.emit('playback_update', {
                                  room_id: roomId,
                                  track_uri: nowPlaying?.track_uri,
                                  track_name: nowPlaying?.track_name,
                                  artist: nowPlaying?.artist,
                                  album_art_url: nowPlaying?.album_art_url,
                                  position_ms: item.timeMs,
                                  duration_ms: playbackState.durationMs,
                                  is_playing: playbackState.isPlaying,
                                  loop: false,
                                  is_buffering: playbackState.isPlaying ? !!streamErrorMsg : false
                                });
                              }
                              triggerToast(`Jumped to ${formatTime(item.timeMs)}`, 'info');
                            }
                          }}
                        >
                          {isActive && words.length > 1 ? (
                            words.map((word, wIdx) => {
                              const isWordSung = wIdx <= activeWordIdx;
                              const isCurrentWord = wIdx === activeWordIdx;
                              return (
                                <span
                                  key={wIdx}
                                  style={{
                                    display: 'inline-block',
                                    marginRight: '14px',
                                    color: isWordSung ? '#ffffff' : 'rgba(255, 255, 255, 0.38)',
                                    fontWeight: isCurrentWord ? 900 : (isWordSung ? 800 : 700),
                                    textShadow: isCurrentWord
                                      ? '0 0 32px #ffffff, 0 0 60px var(--theme-accent, #ff9f1c)'
                                      : (isWordSung ? '0 0 16px rgba(255,255,255,0.6)' : 'none'),
                                    transform: isCurrentWord ? 'scale(1.06)' : 'scale(1)',
                                    transition: 'all 0.12s ease-out',
                                  }}
                                >
                                  {word}
                                </span>
                              );
                            })
                          ) : (
                            item.text
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Enhanced lyrics empty state */
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: '16px',
                  textAlign: 'center',
                }}>
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ color: 'var(--dynamic-accent-1, rgba(255,255,255,0.4))' }}
                  >
                    <Music size={48} strokeWidth={1.2} />
                  </motion.div>
                  <div>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.55)', margin: '0 0 6px 0' }}>
                      {lyricsLoading ? 'Fetching lyrics…' : 'No synchronized lyrics'}
                    </p>
                    {!lyricsLoading && (
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.3)', margin: 0 }}>
                        Lyrics will appear here when available for this track
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ⌨️ Sleek Stage Mode Keyboard Shortcuts HUD (All buttons fully interactive) */}
            <AnimatePresence>
              {(showKeyboardHUD || (stageMouseActive && !showStageQueue)) && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  transition={{ duration: 0.25 }}
                  className="stage-hud-container"
                >
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={handleTogglePlay}
                    title="Toggle Play / Pause (Space)"
                  >
                    <span className="stage-hud-key">Space</span> Play
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={() => handleSeekRelative(-5000)}
                    title="Rewind 5s (←)"
                  >
                    <span className="stage-hud-key">←</span> -5s
                  </button>
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={() => handleSeekRelative(5000)}
                    title="Forward 5s (→)"
                  >
                    <span className="stage-hud-key">→</span> +5s
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={() => {
                      setVolume(prev => Math.min(100, (prev || 80) + 10));
                      if (isMuted) setIsMuted(false);
                    }}
                    title="Volume Up / Down (↑ / ↓)"
                  >
                    <span className="stage-hud-key">↑</span><span className="stage-hud-key">↓</span> Vol
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={handleLikeToggle}
                    title="Favorite Track (L)"
                  >
                    <span className="stage-hud-key">L</span> Like
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={handleShuffleClick}
                    title="Shuffle Queue (S)"
                  >
                    <span className="stage-hud-key">S</span> Shuffle
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={handleRepeatToggle}
                    title="Toggle Repeat (R)"
                  >
                    <span className="stage-hud-key">R</span> Repeat
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={() => setShowStageQueue(prev => !prev)}
                    title="Toggle Queue (Q)"
                  >
                    <span className="stage-hud-key">Q</span> Queue
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={() => setShowKeyboardHUD(prev => !prev)}
                    title="Toggle Shortcuts (?)"
                  >
                    <span className="stage-hud-key">?</span> Keys
                  </button>
                  <div className="stage-hud-divider" />
                  <button
                    type="button"
                    className="stage-hud-badge"
                    onClick={() => setIsStageMode(false)}
                    title="Exit Stage Mode (Esc)"
                  >
                    <span className="stage-hud-key">Esc</span> Exit
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ SHAREABLE JAM CARD MODAL ═════════════════════════════ */}
      {showJamCardModal && (
        <JamCardModal
          isOpen={showJamCardModal}
          onClose={() => setShowJamCardModal(false)}
          room={room}
          nowPlaying={nowPlaying}
          listenerCount={listeners.length || (room?.listener_count || 1)}
          triggerToast={triggerToast}
        />
      )}

      <PwaInstallPrompt />
    </div>
  );
}
