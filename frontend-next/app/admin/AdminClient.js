'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Shield, Users, Radio, ListMusic, Terminal, RefreshCw, 
  Trash2, Award, Zap, LogOut, LayoutDashboard, Database, 
  Globe, Lock, AlertTriangle, CheckCircle, AlertCircle
} from 'lucide-react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, rooms, users, playlists, logs
  
  // Data states
  const [stats, setStats] = useState({ total_users: 0, total_playlists: 0, active_rooms: 0, online_listeners: 0 });
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Search query states
  const [searchRoomsQuery, setSearchRoomsQuery] = useState('');
  const [searchUsersQuery, setSearchUsersQuery] = useState('');
  const [searchPlaylistsQuery, setSearchPlaylistsQuery] = useState('');
  const [searchLogsQuery, setSearchLogsQuery] = useState('');
  const [triggeringHealthcheck, setTriggeringHealthcheck] = useState(false);

  // Confirmations
  const [showCloseAllConfirm, setShowCloseAllConfirm] = useState(false);
  const [showDeleteRoomConfirm, setShowDeleteRoomConfirm] = useState(null); // room_id
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(null); // user_id
  const [showDeletePlaylistConfirm, setShowDeletePlaylistConfirm] = useState(null); // playlist_id

  // 1. Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // 2. Fetch data when activeTab changes (if authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
  }, [activeTab, isAuthenticated]);

  // 3. Auto-refresh loop
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  async function fetchStats() {
    try {
      const res = await fetch('/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    }
  }

  async function checkAuth() {
    try {
      const res = await fetch('/admin/stats');
      if (res.status === 200) {
        setIsAuthenticated(true);
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to verify admin state:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        setPassword('');
        fetchStats();
      } else {
        let errText = 'Invalid password.';
        try {
          const data = await res.json();
          if (data.error) errText = data.error;
        } catch (e) {}
        setErrorMsg(errText);
      }
    } catch (err) {
      setErrorMsg(`Connection Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  async function fetchData(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      fetchStats();
      if (activeTab === 'overview') {
        // fetchStats updates stats
      } else if (activeTab === 'rooms') {
        const res = await fetch('/admin/rooms');
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms || []);
        }
      } else if (activeTab === 'users') {
        const res = await fetch('/admin/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } else if (activeTab === 'playlists') {
        const res = await fetch('/admin/playlists');
        if (res.ok) {
          const data = await res.json();
          setPlaylists(data.playlists || []);
        }
      } else if (activeTab === 'logs') {
        const res = await fetch('/admin/logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${activeTab} data:`, err);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    setIsAuthenticated(false);
  };

  // Moderation Handlers
  const handleDeleteRoom = async (roomId) => {
    try {
      const res = await fetch(`/admin/rooms/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        setRooms(rooms.filter(r => r.id !== roomId));
      } else {
        alert('Failed to force close the room.');
      }
    } catch (err) {
      alert(`Error deleting room: ${err.message}`);
    } finally {
      setShowDeleteRoomConfirm(null);
    }
  };

  const handleCloseAllRooms = async () => {
    try {
      const res = await fetch('/admin/rooms', { method: 'DELETE' });
      if (res.ok) {
        setRooms([]);
      } else {
        alert('Failed to close all rooms.');
      }
    } catch (err) {
      alert(`Error closing all rooms: ${err.message}`);
    } finally {
      setShowCloseAllConfirm(false);
    }
  };

  const handleTogglePremium = async (userId) => {
    try {
      const res = await fetch(`/admin/users/${userId}/premium`, { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, is_premium: data.user.is_premium } : u));
      }
    } catch (err) {
      alert(`Failed to update premium status: ${err.message}`);
    }
  };

  const handleToggleAdmin = async (userId) => {
    try {
      const res = await fetch(`/admin/users/${userId}/admin`, { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, is_admin: data.user.is_admin } : u));
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to toggle admin status');
      }
    } catch (err) {
      alert(`Failed to update admin status: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete user.');
      }
    } catch (err) {
      alert(`Error deleting user: ${err.message}`);
    } finally {
      setShowDeleteUserConfirm(null);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    try {
      const res = await fetch(`/admin/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylists(playlists.filter(p => p.id !== playlistId));
      } else {
        alert('Failed to delete playlist.');
      }
    } catch (err) {
      alert(`Error deleting playlist: ${err.message}`);
    } finally {
      setShowDeletePlaylistConfirm(null);
    }
  };

  const handleTriggerHealthcheck = async () => {
    setTriggeringHealthcheck(true);
    try {
      const res = await fetch('/admin/healthcheck/resolve', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Background healthcheck task started.');
      } else {
        alert('Failed to trigger healthcheck.');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setTriggeringHealthcheck(false);
    }
  };

  if (loading && !isAuthenticated) {
    return (
      <div className="admin-page-wrap">
        <div className="admin-loading">
          <div className="spinner"></div>
          <span>Verifying Admin Authorization...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-wrap" style={{ fontFamily: 'var(--font-ui-next), sans-serif' }}>
      {/* Background ambient glows */}
      <div className="admin-ambient" aria-hidden="true">
        <div className="glow glow-1" style={{ background: 'rgba(255, 159, 28, 0.03)' }}></div>
        <div className="glow glow-2" style={{ background: 'rgba(244, 63, 94, 0.02)' }}></div>
      </div>

      <div className="admin-container" style={{ maxWidth: isAuthenticated ? '1440px' : '480px', width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
        {/* VIEW 1: Login Form */}
        {!isAuthenticated ? (
          <motion.div 
            className="admin-auth-card glass-card"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ width: '100%' }}
          >
            <div className="admin-auth-header">
              <span className="shield-icon" style={{ display: 'inline-block', fontSize: '48px', color: 'var(--amber, #ff9f1c)' }}>
                <Shield size={48} className="fill-current" />
              </span>
              <h2 style={{ marginTop: '16px', fontSize: '24px', fontWeight: 800 }}>OpenJam Administrator</h2>
              <p>Enter your administrative password to log in and maintain OpenJam.</p>
            </div>

            <form onSubmit={handleLogin} style={{ marginTop: '24px' }}>
              {errorMsg && (
                <div className="admin-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
                  <AlertTriangle size={16} /> {errorMsg}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="admin-pass" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-3, #64748b)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin Password</label>
                <input
                  type="password"
                  id="admin-pass"
                  className="input-field"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="admin-auth-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <Link href="/" className="btn btn-ghost" style={{ flex: 1, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>← Home</Link>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, background: 'var(--amber, #ff9f1c)', color: '#000', fontWeight: 700 }}>Authorize Access</button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* VIEW 2: Tabbed Dashboard Layout */
          <motion.div 
            className="admin-dashboard-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            {/* Header Deck */}
            <div className="admin-header-deck" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={28} className="text-amber-500 text-yellow-500" style={{ color: 'var(--amber, #ff9f1c)' }} />
                  <span>OpenJam Controls Panel</span>
                </h1>
                <p className="admin-subtitle" style={{ fontSize: '14px', color: 'var(--text-3, #64748b)' }}>Overview, moderation panel, user directories, and system diagnostics.</p>
              </div>
              <div className="admin-header-btns" style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className={`btn btn-secondary btn-refresh ${refreshing ? 'refreshing' : ''}`}
                  onClick={() => fetchData()}
                  disabled={refreshing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 16px', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: refreshing ? 'default' : 'pointer' }}
                >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
                <button className="btn btn-secondary" onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '10px 16px', background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', cursor: 'pointer' }}>
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* TWO-COLUMN LAYOUT: Left sidebar navigation + Right content */}
            <div className="admin-workspace" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Sidebar Navigation */}
              <div className="admin-sidebar glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(20px)' }}>
                <div style={{ padding: '0 8px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3, #64748b)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>System Operations</div>
                
                <button 
                  className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px', border: 'none', borderRadius: '12px', color: activeTab === 'overview' ? '#000' : '#aaa', background: activeTab === 'overview' ? 'var(--amber, #ff9f1c)' : 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'overview' ? 700 : 500, fontSize: '14px', transition: 'all 0.2s' }}
                >
                  <LayoutDashboard size={16} /> Overview
                </button>
                <button 
                  className={`admin-nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('rooms')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px', border: 'none', borderRadius: '12px', color: activeTab === 'rooms' ? '#000' : '#aaa', background: activeTab === 'rooms' ? 'var(--amber, #ff9f1c)' : 'none', cursor: 'pointer', fontWeight: activeTab === 'rooms' ? 700 : 500, fontSize: '14px', transition: 'all 0.2s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Radio size={16} /> <span>Live Jams</span>
                  </div>
                  <span style={{ fontSize: '11px', background: activeTab === 'rooms' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '8px', color: activeTab === 'rooms' ? '#000' : '#fff' }}>
                    {stats.active_rooms || 0}
                  </span>
                </button>
                <button 
                  className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px', border: 'none', borderRadius: '12px', color: activeTab === 'users' ? '#000' : '#aaa', background: activeTab === 'users' ? 'var(--amber, #ff9f1c)' : 'none', cursor: 'pointer', fontWeight: activeTab === 'users' ? 700 : 500, fontSize: '14px', transition: 'all 0.2s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Users size={16} /> <span>Users Directory</span>
                  </div>
                  <span style={{ fontSize: '11px', background: activeTab === 'users' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '8px', color: activeTab === 'users' ? '#000' : '#fff' }}>
                    {stats.total_users || 0}
                  </span>
                </button>
                <button 
                  className={`admin-nav-item ${activeTab === 'playlists' ? 'active' : ''}`}
                  onClick={() => setActiveTab('playlists')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px', border: 'none', borderRadius: '12px', color: activeTab === 'playlists' ? '#000' : '#aaa', background: activeTab === 'playlists' ? 'var(--amber, #ff9f1c)' : 'none', cursor: 'pointer', fontWeight: activeTab === 'playlists' ? 700 : 500, fontSize: '14px', transition: 'all 0.2s' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ListMusic size={16} /> <span>Saved Playlists</span>
                  </div>
                  <span style={{ fontSize: '11px', background: activeTab === 'playlists' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '8px', color: activeTab === 'playlists' ? '#000' : '#fff' }}>
                    {stats.total_playlists || 0}
                  </span>
                </button>
                <button 
                  className={`admin-nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px', border: 'none', borderRadius: '12px', color: activeTab === 'logs' ? '#000' : '#aaa', background: activeTab === 'logs' ? 'var(--amber, #ff9f1c)' : 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'logs' ? 700 : 500, fontSize: '14px', transition: 'all 0.2s' }}
                >
                  <Terminal size={16} /> System Diagnostics
                </button>
              </div>

              {/* Right Content Panel */}
              <div className="admin-content-deck glass-card" style={{ flex: 1, padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', backdropFilter: 'blur(20px)', minHeight: '450px' }}>
                <AnimatePresence mode="wait">
                  
                  {/* TAB 1: OVERVIEW */}
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>System Metrics Summary</h3>
                      
                      <div className="admin-metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div className="metric-box glass-card" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="metric-label" style={{ fontSize: '11px', color: 'var(--text-3, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Registered Users</span>
                          <span className="metric-val" style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>{stats.total_users}</span>
                        </div>
                        <div className="metric-box glass-card" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="metric-label" style={{ fontSize: '11px', color: 'var(--text-3, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Listening Rooms</span>
                          <span className="metric-val" style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>{stats.active_rooms}</span>
                        </div>
                        <div className="metric-box glass-card" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="metric-label" style={{ fontSize: '11px', color: 'var(--text-3, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online Room Listeners</span>
                          <span className="metric-val" style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>{stats.online_listeners}</span>
                        </div>
                        <div className="metric-box glass-card" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="metric-label" style={{ fontSize: '11px', color: 'var(--text-3, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved Playlists Library</span>
                          <span className="metric-val" style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>{stats.total_playlists}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: '24px', padding: '20px', borderRadius: '16px', background: 'rgba(255,159,28,0.02)', border: '1px solid rgba(255,159,28,0.08)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <Database size={24} style={{ color: 'var(--amber, #ff9f1c)', flexShrink: 0 }} />
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Connected State Cache</h4>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-3, #64748b)', marginTop: '2px', lineHeight: 1.5 }}>
                            Database state engine is active. User profile registries, tracks index collections, and active session rooms are fully synched with Redis backend cache storage.
                          </p>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px', padding: '20px', borderRadius: '16px', background: 'rgba(56,189,248,0.02)', border: '1px solid rgba(56,189,248,0.08)', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <Globe size={24} style={{ color: '#38bdf8', flexShrink: 0 }} />
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>YouTube Streaming Failover Engines</h4>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-3, #64748b)', marginTop: '2px', lineHeight: 1.5 }}>
                              Health-checks and latency tests on public Invidious and Piped fallback servers can be manually re-evaluated to update availability tables.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleTriggerHealthcheck}
                          disabled={triggeringHealthcheck}
                          style={{
                            padding: '10px 16px',
                            background: triggeringHealthcheck ? 'rgba(255,255,255,0.05)' : '#38bdf8',
                            color: triggeringHealthcheck ? '#666' : '#000',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: triggeringHealthcheck ? 'default' : 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.2s'
                          }}
                        >
                          {triggeringHealthcheck ? 'Running...' : 'Trigger Healthcheck'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: ROOMS */}
                  {activeTab === 'rooms' && (() => {
                    const filteredRooms = rooms.filter(room => 
                      room.name.toLowerCase().includes(searchRoomsQuery.toLowerCase()) ||
                      room.id.toLowerCase().includes(searchRoomsQuery.toLowerCase()) ||
                      room.host_name.toLowerCase().includes(searchRoomsQuery.toLowerCase())
                    );
                    return (
                      <motion.div
                        key="rooms"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>Active Live Jam Rooms</h3>
                          {rooms.length > 0 && (
                            <button 
                              className="btn btn-danger-flat" 
                              onClick={() => setShowCloseAllConfirm(true)}
                              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#f87171', cursor: 'pointer' }}
                            >
                              Close All Active Rooms
                            </button>
                          )}
                        </div>

                        {rooms.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <input
                              type="text"
                              placeholder="Search rooms by name, ID or host..."
                              value={searchRoomsQuery}
                              onChange={(e) => setSearchRoomsQuery(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#fff',
                                fontSize: '13.5px',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}

                        {filteredRooms.length > 0 ? (
                          <div className="admin-table-scroll">
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Status</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Room details</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Host</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Listeners</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Created</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Moderation</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredRooms.map((room) => (
                                  <tr key={room.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="admin-tr-hover">
                                    <td style={{ padding: '14px 8px' }}><span className="admin-status-badge badge-active" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>Live</span></td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{room.name}</div>
                                      <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>ID: {room.id}</div>
                                    </td>
                                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#ccc' }}>{room.host_name}</td>
                                    <td style={{ padding: '14px 8px' }}><span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '10px', color: '#fff' }}>👤 {room.listener_count}</span></td>
                                    <td style={{ padding: '14px 8px', fontSize: '12px', color: '#666' }}>{new Date(room.created_at).toLocaleString()}</td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <button 
                                        className="btn-danger-sm" 
                                        onClick={() => setShowDeleteRoomConfirm(room.id)}
                                        style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', background: 'none' }}
                                      >
                                        Force Close
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : rooms.length > 0 ? (
                          <div style={{ color: 'var(--text-3)', padding: '40px 0', textAlign: 'center', fontSize: '14px' }}>
                            No rooms match "{searchRoomsQuery}"
                          </div>
                        ) : (
                          <div className="admin-empty-state">
                            <div className="empty-globe">🌐</div>
                            <h4>No Active Jam Sessions</h4>
                            <p>There are currently no active public or private rooms online.</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}

                  {/* TAB 3: USERS */}
                  {activeTab === 'users' && (() => {
                    const filteredUsers = users.filter(user => 
                      user.display_name.toLowerCase().includes(searchUsersQuery.toLowerCase()) ||
                      user.id.toLowerCase().includes(searchUsersQuery.toLowerCase()) ||
                      (user.discord_username && user.discord_username.toLowerCase().includes(searchUsersQuery.toLowerCase())) ||
                      (user.discord_id && user.discord_id.toLowerCase().includes(searchUsersQuery.toLowerCase()))
                    );
                    return (
                      <motion.div
                        key="users"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>Registered Users Directory</h3>
                        
                        {users.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <input
                              type="text"
                              placeholder="Search users by name, ID or Discord..."
                              value={searchUsersQuery}
                              onChange={(e) => setSearchUsersQuery(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#fff',
                                fontSize: '13.5px',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}

                        {filteredUsers.length > 0 ? (
                          <div className="admin-table-scroll">
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>User Profile</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Discord ID / Tag</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Premium status</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Admin rights</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Created</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredUsers.map((user) => (
                                  <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="admin-tr-hover">
                                    <td style={{ padding: '14px 8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {user.avatar_url ? (
                                          <img src={user.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                        ) : (
                                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>
                                            {user.display_name.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <div>
                                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '13.5px' }}>{user.display_name}</div>
                                          <div style={{ fontSize: '10px', color: '#555' }}>ID: {user.id.substring(0, 8)}...</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#ccc' }}>
                                      {user.discord_username ? (
                                        <div>
                                          <div style={{ fontWeight: 500 }}>@{user.discord_username}</div>
                                          <div style={{ fontSize: '10px', color: '#666' }}>ID: {user.discord_id}</div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#555', fontStyle: 'italic', fontSize: '12.5px' }}>Not Linked</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <button
                                        onClick={() => handleTogglePremium(user.id)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                      >
                                        {user.is_premium ? (
                                          <span style={{ background: 'rgba(251,191,36,0.1)', color: '#f59e0b', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <Zap size={10} className="fill-current" /> Premium
                                          </span>
                                        ) : (
                                          <span style={{ background: 'rgba(255,255,255,0.03)', color: '#666', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                            Basic
                                          </span>
                                        )}
                                      </button>
                                    </td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <button
                                        onClick={() => handleToggleAdmin(user.id)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                      >
                                        {user.is_admin ? (
                                          <span style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <Shield size={10} className="fill-current" /> Admin
                                          </span>
                                        ) : (
                                          <span style={{ background: 'rgba(255,255,255,0.03)', color: '#666', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                            Member
                                          </span>
                                        )}
                                      </button>
                                    </td>
                                    <td style={{ padding: '14px 8px', fontSize: '12px', color: '#666' }}>
                                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <button 
                                        className="btn-danger-sm"
                                        onClick={() => setShowDeleteUserConfirm(user.id)}
                                        style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', background: 'none' }}
                                      >
                                        Delete Account
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : users.length > 0 ? (
                          <div style={{ color: 'var(--text-3)', padding: '40px 0', textAlign: 'center', fontSize: '14px' }}>
                            No users match "{searchUsersQuery}"
                          </div>
                        ) : (
                          <div className="admin-empty-state">
                            <div className="empty-globe" style={{ fontSize: '48px', opacity: 0.3 }}>👥</div>
                            <h4>No Users Registered</h4>
                            <p>Database shows zero registered users. Users are registered when they log in via Discord.</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}

                  {/* TAB 4: PLAYLISTS */}
                  {activeTab === 'playlists' && (() => {
                    const filteredPlaylists = playlists.filter(playlist => 
                      playlist.name.toLowerCase().includes(searchPlaylistsQuery.toLowerCase()) ||
                      playlist.id.toLowerCase().includes(searchPlaylistsQuery.toLowerCase()) ||
                      playlist.creator_name.toLowerCase().includes(searchPlaylistsQuery.toLowerCase())
                    );
                    return (
                      <motion.div
                        key="playlists"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>Saved Playlists Library</h3>
                        
                        {playlists.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <input
                              type="text"
                              placeholder="Search playlists by name, ID or creator..."
                              value={searchPlaylistsQuery}
                              onChange={(e) => setSearchPlaylistsQuery(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#fff',
                                fontSize: '13.5px',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}

                        {filteredPlaylists.length > 0 ? (
                          <div className="admin-table-scroll">
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Playlist Name</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Creator</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Tracks</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Visibility</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Created</th>
                                  <th style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-3)' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredPlaylists.map((playlist) => (
                                  <tr key={playlist.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="admin-tr-hover">
                                    <td style={{ padding: '14px 8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ListMusic size={16} style={{ color: 'var(--amber, #ff9f1c)', flexShrink: 0 }} />
                                        <div>
                                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{playlist.name}</div>
                                          <div style={{ fontSize: '10px', color: '#555' }}>ID: {playlist.id}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#ccc' }}>{playlist.creator_name}</td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: '8px', color: '#fff', fontWeight: 600 }}>
                                        {playlist.track_count} tracks
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 8px' }}>
                                      {playlist.is_private ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#e11d48' }}><Lock size={12} /> Private</span>
                                      ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#059669' }}><Globe size={12} /> Public</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '14px 8px', fontSize: '12px', color: '#666' }}>
                                      {playlist.created_at ? new Date(playlist.created_at).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td style={{ padding: '14px 8px' }}>
                                      <button 
                                        className="btn-danger-sm"
                                        onClick={() => setShowDeletePlaylistConfirm(playlist.id)}
                                        style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', background: 'none' }}
                                      >
                                        Delete Playlist
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : playlists.length > 0 ? (
                          <div style={{ color: 'var(--text-3)', padding: '40px 0', textAlign: 'center', fontSize: '14px' }}>
                            No playlists match "{searchPlaylistsQuery}"
                          </div>
                        ) : (
                          <div className="admin-empty-state">
                            <div className="empty-globe" style={{ fontSize: '48px', opacity: 0.3 }}>📂</div>
                            <h4>No Playlists Found</h4>
                            <p>Database shows zero user-created playlists.</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })()}

                  {/* TAB 5: DIAGNOSTICS LOGS */}
                  {activeTab === 'logs' && (() => {
                    const filteredLogs = logs.filter(log => 
                      log.toLowerCase().includes(searchLogsQuery.toLowerCase())
                    );
                    return (
                      <motion.div
                        key="logs"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>Authentication Diagnostics Logs</h3>
                          <button
                            onClick={() => fetchData()}
                            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <RefreshCw size={12} /> Sync Logs
                          </button>
                        </div>

                        {logs.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <input
                              type="text"
                              placeholder="Filter logs by keyword (e.g. error, auth, user)..."
                              value={searchLogsQuery}
                              onChange={(e) => setSearchLogsQuery(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#fff',
                                fontSize: '13.5px',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}

                        <div style={{ flex: 1, background: '#020204', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px', fontFamily: 'var(--font-mono-next), monospace', fontSize: '12.5px', lineHeight: '1.6', color: '#38bdf8', overflowY: 'auto', maxHeight: '420px', height: '420px', whiteSpace: 'pre-wrap', boxSizing: 'border-box' }}>
                          {filteredLogs.length > 0 ? (
                            filteredLogs.map((log, idx) => (
                              <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '4px', marginBottom: '4px' }}>
                                <span style={{ color: '#666', marginRight: '6px' }}>[{idx + 1}]</span>
                                <span>{log}</span>
                              </div>
                            ))
                          ) : logs.length > 0 ? (
                            <div style={{ color: '#555', textAlign: 'center', paddingTop: '40px' }}>
                              No logs match keyword "{searchLogsQuery}"
                            </div>
                          ) : (
                            <div style={{ color: '#555', textAlign: 'center', paddingTop: '40px' }}>
                              Diagnostics log buffer is empty.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </div>

      {/* ══ CONFIRM CLOSE ALL MODAL ════════════════════════════ */}
      <AnimatePresence>
        {showCloseAllConfirm && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 2000 }} onClick={() => setShowCloseAllConfirm(false)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Close All Rooms?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '13.5px', lineHeight: 1.5 }}>
                Are you absolutely sure you want to CLOSE ALL ACTIVE ROOMS? This will terminate all playback sessions and kick out all online listeners immediately.
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowCloseAllConfirm(false)}
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={handleCloseAllRooms} 
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, flex: 1 }}
                >
                  Close All Rooms
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ CONFIRM DELETE ROOM MODAL ══════════════════════════ */}
      <AnimatePresence>
        {showDeleteRoomConfirm && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 2000 }} onClick={() => setShowDeleteRoomConfirm(null)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Force Close Room?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '13.5px', lineHeight: 1.5 }}>
                Are you sure you want to forcefully close the room <strong>{showDeleteRoomConfirm}</strong>? The host and listeners will be disconnected and kicked out immediately.
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowDeleteRoomConfirm(null)}
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDeleteRoom(showDeleteRoomConfirm)} 
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, flex: 1 }}
                >
                  Force Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ CONFIRM DELETE USER MODAL ══════════════════════════ */}
      <AnimatePresence>
        {showDeleteUserConfirm && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 2000 }} onClick={() => setShowDeleteUserConfirm(null)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Delete User Account?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '13.5px', lineHeight: 1.5 }}>
                Are you absolutely sure you want to permanently delete the account <strong>{showDeleteUserConfirm}</strong>? This will delete all their saved playlists, likes, chat messages, and close any active rooms they are hosting. <strong>This action cannot be undone.</strong>
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowDeleteUserConfirm(null)}
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDeleteUser(showDeleteUserConfirm)} 
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, flex: 1 }}
                >
                  Delete Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ CONFIRM DELETE PLAYLIST MODAL ════════════════════════ */}
      <AnimatePresence>
        {showDeletePlaylistConfirm && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 2000 }} onClick={() => setShowDeletePlaylistConfirm(null)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Delete Playlist?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '13.5px', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this playlist from the system? The owner will no longer be able to access it.
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowDeletePlaylistConfirm(null)}
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDeletePlaylist(showDeletePlaylistConfirm)} 
                  style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer', background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, flex: 1 }}
                >
                  Delete Playlist
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
