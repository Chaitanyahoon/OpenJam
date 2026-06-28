'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Lock, Music, Import, Info } from 'lucide-react';

export default function CreatePlaylistModal({
  isOpen,
  onClose,
  onCreatePlaylist,
  onImportPlaylist,
  isImporting
}) {
  const [activeTab, setActiveTab] = useState('scratch'); // 'scratch' | 'import'
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importName, setImportName] = useState('');

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreatePlaylist(name.trim(), isPrivate);
    setName('');
    setIsPrivate(false);
  };

  const handleImport = () => {
    if (!importUrl.trim()) return;
    onImportPlaylist(importUrl.trim(), importName.trim() || null, isPrivate);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#0d0d12',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Music size={18} color="var(--theme-accent, #ff9f1c)" />
            Add Playlist
          </h3>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <button
            onClick={() => setActiveTab('scratch')}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'scratch' ? '2px solid var(--theme-accent, #ff9f1c)' : '2px solid transparent',
              color: activeTab === 'scratch' ? '#fff' : '#555',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Music size={13} />
            Create Playlist
          </button>
          <button
            onClick={() => setActiveTab('import')}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'import' ? '2px solid var(--theme-accent, #ff9f1c)' : '2px solid transparent',
              color: activeTab === 'import' ? '#fff' : '#555',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Import size={13} />
            Import Playlist
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '24px' }}>
          {activeTab === 'scratch' ? (
            // Create New form
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#555', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>Playlist Name</label>
                <input
                  type="text"
                  placeholder="My awesome playlist..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                  autoFocus
                />
              </div>
            </div>
          ) : (
            // Import Playlist form
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#555', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>Playlist Link (Spotify / YouTube)</label>
                <input
                  type="text"
                  placeholder="https://open.spotify.com/playlist/... or YouTube link"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#555', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>Optional Custom Name</label>
                <input
                  type="text"
                  placeholder="Leave empty to use source name..."
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: 'rgba(255, 159, 28, 0.05)', border: '1px solid rgba(255, 159, 28, 0.1)', borderRadius: '12px', alignItems: 'center' }}>
                <Info size={16} color="var(--theme-accent, #ff9f1c)" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '11px', color: '#aaa', lineHeight: 1.4 }}>
                  Tracks from the playlist will be fetched and saved. You can sync it anytime to fetch new changes.
                </p>
              </div>
            </div>
          )}

          {/* Privacy Toggle (shared) */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isPrivate ? <Lock size={16} color="#ff4757" /> : <Globe size={16} color="#10b981" />}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Private Playlist</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>Only you can view this playlist</div>
              </div>
            </div>
            
            {/* Toggle switch */}
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: isPrivate ? 'var(--theme-accent, #ff9f1c)' : '#222',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isPrivate ? '#000' : '#888',
                  position: 'absolute',
                  top: '3px',
                  left: isPrivate ? '21px' : '3px',
                  transition: 'all 0.2s'
                }}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#aaa',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              Cancel
            </button>

            {activeTab === 'scratch' ? (
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                style={{
                  flex: 1,
                  background: name.trim() ? 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #ff8c00 100%)' : '#222',
                  border: 'none',
                  color: name.trim() ? '#000' : '#444',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: name.trim() ? 'pointer' : 'default',
                  boxShadow: name.trim() ? '0 4px 12px rgba(255, 159, 28, 0.2)' : 'none'
                }}
              >
                Create Playlist
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={!importUrl.trim() || isImporting}
                style={{
                  flex: 1,
                  background: (importUrl.trim() && !isImporting) ? 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #ff8c00 100%)' : '#222',
                  border: 'none',
                  color: (importUrl.trim() && !isImporting) ? '#000' : '#444',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: (importUrl.trim() && !isImporting) ? 'pointer' : 'default',
                  boxShadow: (importUrl.trim() && !isImporting) ? '0 4px 12px rgba(255, 159, 28, 0.2)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isImporting && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {isImporting ? 'Importing...' : 'Import Playlist'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
