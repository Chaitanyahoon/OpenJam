'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCloseAllConfirm, setShowCloseAllConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // room_id to delete

  // 1. Check if already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // 2. Auto-refresh loop every 8 seconds if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      fetchRooms(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  async function checkAuth() {
    try {
      const res = await fetch('/admin/rooms');
      if (res.status === 200) {
        const data = await res.json();
        if (data.rooms) {
          setRooms(data.rooms);
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error('Failed to check admin authentication:', err);
    } finally {
      setLoading(false);
    }
  };

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
        fetchRooms();
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

  async function fetchRooms(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/admin/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms) {
          setRooms(data.rooms);
        } else if (data.error) {
          setErrorMsg(data.error);
        }
      } else if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    setIsAuthenticated(false);
    setRooms([]);
  };

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
      setShowDeleteConfirm(null);
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

  const activeListenerCount = rooms.reduce((sum, r) => sum + (r.listener_count || 0), 0);

  // Loading Screen
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
    <div className="admin-page-wrap">
      {/* Background ambient glows */}
      <div className="admin-ambient" aria-hidden="true">
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
      </div>

      <div className="admin-container">
        {/* VIEW 1: Login Form */}
        {!isAuthenticated ? (
          <motion.div 
            className="admin-auth-card glass-card"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="admin-auth-header">
              <span className="shield-icon">🛡️</span>
              <h2>OpenJam Admin</h2>
              <p>Enter the administrative password to gain moderation access.</p>
            </div>

            <form onSubmit={handleLogin}>
              {errorMsg && (
                <div className="admin-error-banner">
                  <span>⚠️</span> {errorMsg}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="admin-pass">Admin Password</label>
                <input
                  type="password"
                  id="admin-pass"
                  className="input-field"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                  required
                  autoFocus
                />
              </div>

              <div className="admin-auth-actions">
                <Link href="/" className="btn btn-ghost">← Homepage</Link>
                <button type="submit" className="btn btn-primary">Authorize Access</button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* VIEW 2: Dashboard */
          <motion.div 
            className="admin-dashboard-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header section */}
            <div className="admin-header-deck">
              <div>
                <h1><span>OpenJam</span> Moderation Panel</h1>
                <p className="admin-subtitle">Real-time room supervision and service management.</p>
              </div>
              <div className="admin-header-btns">
                <button 
                  className={`btn btn-secondary btn-refresh ${refreshing ? 'refreshing' : ''}`}
                  onClick={() => fetchRooms()}
                  disabled={refreshing}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
                <button className="btn btn-secondary btn-logout" onClick={handleLogout}>Logout</button>
              </div>
            </div>

            {/* Metrics overview */}
            <div className="admin-metrics-row">
              <div className="metric-box glass-card">
                <span className="metric-label">Active Jams</span>
                <span className="metric-val">{rooms.length}</span>
              </div>
              <div className="metric-box glass-card">
                <span className="metric-label">Online Listeners</span>
                <span className="metric-val">{activeListenerCount}</span>
              </div>
              <div className="metric-box glass-card">
                <span className="metric-label">Moderation Authorization</span>
                <span className="metric-val text-green">Elevated</span>
              </div>
            </div>

            {/* Content Card */}
            <div className="admin-content-deck glass-card">
              <div className="admin-deck-header">
                <h3>Live Session Rooms</h3>
                {rooms.length > 0 && (
                  <button 
                    className="btn btn-danger-flat" 
                    onClick={() => setShowCloseAllConfirm(true)}
                  >
                    Close All Active Rooms
                  </button>
                )}
              </div>

              {rooms.length > 0 ? (
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Room Details</th>
                        <th>Host</th>
                        <th>Listeners</th>
                        <th>Created At</th>
                        <th>Moderation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {rooms.map((room) => {
                          const dateString = new Date(room.created_at).toLocaleString();
                          return (
                            <motion.tr 
                              key={room.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              className="admin-tr-hover"
                            >
                              <td>
                                <span className="admin-status-badge badge-active">Live</span>
                              </td>
                              <td>
                                <div className="admin-room-title">{room.name}</div>
                                <div className="admin-room-id">{room.id}</div>
                              </td>
                              <td className="admin-td-host">{room.host_name}</td>
                              <td className="admin-td-listeners">
                                <span className="listeners-bubble">👤 {room.listener_count}</span>
                              </td>
                              <td className="admin-td-date">{dateString}</td>
                              <td>
                                <button 
                                  className="btn btn-danger-sm"
                                  onClick={() => setShowDeleteConfirm(room.id)}
                                >
                                  Force Close
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty-state">
                  <div className="empty-globe">🌐</div>
                  <h4>No Active Jam Sessions</h4>
                  <p>There are currently no active public or private rooms online.</p>
                  <Link href="/" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to Homepage</Link>
                </div>
              )}
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
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}
            >
              <motion.div
                style={{ fontSize: '48px', marginBottom: '16px', display: 'inline-block' }}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                🚨
              </motion.div>
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Close All Rooms?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
                Are you absolutely sure you want to CLOSE ALL ACTIVE ROOMS? This will terminate all playback sessions and kick out all online listeners immediately.
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <motion.button 
                  className="btn btn-secondary btn-bubble btn-guest-bubble" 
                  onClick={() => setShowCloseAllConfirm(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px' }}
                >
                  <div className="bubble-bg b1" />
                  <div className="bubble-bg b2" />
                  <div className="bubble-bg b3" />
                  <div className="bubble-bg b4" />
                  <span className="btn-bubble-content">Cancel</span>
                </motion.button>
                <motion.button 
                  className="btn btn-danger btn-bubble btn-danger-bubble" 
                  onClick={handleCloseAllRooms} 
                  whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px' }}
                >
                  <div className="bubble-bg b1" />
                  <div className="bubble-bg b2" />
                  <div className="bubble-bg b3" />
                  <div className="bubble-bg b4" />
                  <span className="btn-bubble-content" style={{ color: 'var(--red)' }}>Close All Rooms</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ CONFIRM DELETE ROOM MODAL ══════════════════════════ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="modal-bg open" style={{ display: 'flex', zIndex: 2000 }} onClick={() => setShowDeleteConfirm(null)}>
            <motion.div 
              className="modal-box"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}
            >
              <div className="modal-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Force Close Room?</div>
              <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
                Are you sure you want to forcefully close the room <strong>{showDeleteConfirm}</strong>? The host and listeners will be disconnected and kicked out immediately.
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <motion.button 
                  className="btn btn-secondary btn-bubble btn-guest-bubble" 
                  onClick={() => setShowDeleteConfirm(null)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px' }}
                >
                  <div className="bubble-bg b1" />
                  <div className="bubble-bg b2" />
                  <div className="bubble-bg b3" />
                  <div className="bubble-bg b4" />
                  <span className="btn-bubble-content">Cancel</span>
                </motion.button>
                <motion.button 
                  className="btn btn-danger btn-bubble btn-danger-bubble" 
                  onClick={() => handleDeleteRoom(showDeleteConfirm)} 
                  whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{ padding: '10px 22px', borderRadius: '12px', fontSize: '14px' }}
                >
                  <div className="bubble-bg b1" />
                  <div className="bubble-bg b2" />
                  <div className="bubble-bg b3" />
                  <div className="bubble-bg b4" />
                  <span className="btn-bubble-content" style={{ color: 'var(--red)' }}>Force Close</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
