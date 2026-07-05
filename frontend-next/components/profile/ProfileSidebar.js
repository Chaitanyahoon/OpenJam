'use client';

import React from 'react';
import { 
  Music, Heart, Plus, Lock, Globe, RefreshCw, Trash2, 
  BarChart2, Users, FolderHeart, Activity, ListMusic
} from 'lucide-react';

export default function ProfileSidebar({
  activeTab,
  setActiveTab,
  playlists,
  savedPlaylists = [],
  likesCount,
  activePlaylistId,
  setActivePlaylistId,
  isOwnProfile,
  onCreatePlaylistClick,
  onDeletePlaylistClick,
  syncingPlaylistId,
  onSyncPlaylistClick
}) {
  return (
    <div className="glass-card profile-sidebar-container" style={{
      padding: '24px',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.04)',
      background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.4) 0%, rgba(10, 10, 14, 0.6) 100%)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
    }}>
      {/* Sidebar Tabs */}
      <div className="profile-sidebar-tabs-container">
        <button
          onClick={() => { setActiveTab('library'); setActivePlaylistId(null); }}
          className={`profile-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
        >
          <FolderHeart size={16} />
          <span>Library</span>
        </button>

        <button
          onClick={() => { setActiveTab('discover'); setActivePlaylistId(null); }}
          className={`profile-tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>Discover</span>
        </button>

        <button
          onClick={() => { setActiveTab('stats'); setActivePlaylistId(null); }}
          className={`profile-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
        >
          <BarChart2 size={16} />
          <span>Stats</span>
        </button>

        <button
          onClick={() => { setActiveTab('social'); setActivePlaylistId(null); }}
          className={`profile-tab-btn ${activeTab === 'social' ? 'active' : ''}`}
        >
          <Activity size={16} />
          <span>Social</span>
        </button>
      </div>

      {/* Playlists Navigation (Only visible when library is active or just generally shown as part of the library navigation) */}
      {activeTab === 'library' && (
        <div className="desktop-only">
          <div className="profile-sidebar-playlists-header">
            <h4 style={{ fontSize: '12px', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Playlists</h4>
            {isOwnProfile && (
              <button
                onClick={onCreatePlaylistClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'linear-gradient(135deg, var(--theme-accent, #ff9f1c) 0%, #ff8c00 100%)',
                  border: 'none',
                  color: '#000',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} />
                Create
              </button>
            )}
          </div>

          {/* Liked Songs List Item */}
          <div
            onClick={() => setActivePlaylistId(null)}
            className={`profile-sidebar-item ${activePlaylistId === null ? 'active' : ''}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Heart size={15} style={{ color: '#ff4757' }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Liked Songs</span>
            </div>
            <span style={{
              fontSize: '11px',
              background: activePlaylistId === null ? 'rgba(255,71,87,0.15)' : 'rgba(255,255,255,0.05)',
              color: activePlaylistId === null ? '#ff4757' : '#888',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 700
            }}>
              {likesCount}
            </span>
          </div>

          {/* User Playlists List */}
          <div className="profile-sidebar-playlists-list">
            {playlists.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#444', fontSize: '13px' }}>
                No playlists created yet.
              </div>
            ) : (
              playlists.map((pl) => {
                const isSelected = activePlaylistId === pl.id;
                const isSyncing = syncingPlaylistId === pl.id;
                
                return (
                  <div
                    key={pl.id}
                    onClick={() => setActivePlaylistId(pl.id)}
                    className={`profile-sidebar-item ${isSelected ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <Music size={15} style={{ color: isSelected ? 'var(--theme-accent, #ff9f1c)' : '#888', flexShrink: 0 }} />
                      <span style={{
                        fontSize: '14px',
                        fontWeight: isSelected ? 700 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {pl.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {/* Privacy indicator */}
                      {pl.is_private ? (
                        <Lock size={12} color="#ff4757" title="Private" />
                      ) : (
                        <Globe size={12} color="#10b981" title="Public" />
                      )}

                      {/* Sync button for imported playlists */}
                      {isOwnProfile && pl.import_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSyncPlaylistClick(pl.id);
                          }}
                          className={`profile-sync-btn ${isSyncing ? 'syncing' : ''}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}
                          disabled={isSyncing}
                        >
                          <RefreshCw 
                            size={12} 
                            style={{ 
                              animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                              color: isSyncing ? 'var(--theme-accent, #ff9f1c)' : 'inherit'
                            }} 
                          />
                        </button>
                      )}

                      {/* Delete button */}
                      {isOwnProfile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePlaylistClick(pl);
                          }}
                          className="profile-delete-btn"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Saved Playlists list */}
            {savedPlaylists && savedPlaylists.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
                <div style={{ padding: '0 14px 8px 14px', fontSize: '11px', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Saved Playlists
                </div>
                {savedPlaylists.map((pl) => {
                  const isSelected = activePlaylistId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      onClick={() => setActivePlaylistId(pl.id)}
                      className={`profile-sidebar-item ${isSelected ? 'active' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <ListMusic size={15} style={{ color: isSelected ? '#10b981' : '#888', flexShrink: 0 }} />
                        <span style={{
                          fontSize: '14px',
                          fontWeight: isSelected ? 700 : 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {pl.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#555', marginLeft: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>
                        By {pl.creator_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
