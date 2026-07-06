'use client';

import React, { useState, useEffect } from 'react';
import { 
  Music, Lock, Globe, RefreshCw, Trash2, Share2, 
  Disc, Clock, ArrowLeft, Play
} from 'lucide-react';

export default function ProfilePlaylistDetail({
  playlist,
  loading,
  isOwnProfile,
  onBackToLibrary,
  onCopyPlaylistLink,
  onSyncPlaylist,
  onRemoveTrack,
  syncingPlaylistId
}) {
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(playlist?.auto_sync ?? true);
  
  useEffect(() => {
    if (playlist) {
      setIsAutoSyncEnabled(playlist.auto_sync ?? true);
    }
  }, [playlist]);

  const handleToggleAutoSync = async () => {
    const nextVal = !isAutoSyncEnabled;
    setIsAutoSyncEnabled(nextVal);
    try {
      const res = await fetch(`/playlists/${playlist.id}/auto-sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal })
      });
      if (!res.ok) {
        setIsAutoSyncEnabled(!nextVal);
      }
    } catch (e) {
      setIsAutoSyncEnabled(!nextVal);
    }
  };
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: '#888', gap: '16px' }}>
        <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '15px', fontWeight: 500 }}>Loading playlist tracks...</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="profile-empty-state">
        <Music size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>Playlist not found</p>
        <button
          onClick={onBackToLibrary}
          className="profile-back-to-library"
          style={{
            marginTop: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--theme-accent, #ff9f1c)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ArrowLeft size={16} /> Back to Library
        </button>
      </div>
    );
  }

  const tracks = playlist.tracks || [];
  const isSyncing = syncingPlaylistId === playlist.id;

  // Cover image / mosaic generator
  const renderCover = () => {
    if (tracks.length >= 4) {
      return (
        <div className="profile-playlist-mosaic">
          {tracks.slice(0, 4).map((track, i) => (
            track.album_art_url ? (
              <img key={i} src={track.album_art_url} alt="" className="profile-playlist-mosaic-img" />
            ) : (
              <div key={i} className="profile-playlist-mosaic-fallback"><Disc size={16} /></div>
            )
          ))}
        </div>
      );
    }
    
    if (tracks.length > 0 && tracks[0].album_art_url) {
      return (
        <img 
          src={tracks[0].album_art_url} 
          alt={playlist.name} 
          style={{ width: '100%', aspectRatio: 1, borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.04)' }} 
        />
      );
    }

    return (
      <div style={{ width: '100%', aspectRatio: 1, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Disc size={48} color="#333" />
      </div>
    );
  };

  const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBackToLibrary}
        className="profile-back-to-library"
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '20px'
        }}
      >
        <ArrowLeft size={14} /> Back to Library
      </button>

      {/* Playlist Header card */}
      <div className="profile-playlist-header" style={{ display: 'flex', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {/* Cover Art container */}
        <div className="profile-playlist-cover" style={{ width: '130px', flexShrink: 0 }}>
          {renderCover()}
        </div>

        {/* Text details */}
        <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {playlist.is_private ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'rgba(255, 71, 87, 0.12)', color: '#ff4757', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                <Lock size={10} /> Private
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                <Globe size={10} /> Public
              </span>
            )}
            {playlist.import_url && (
              <span style={{ fontSize: '11px', background: 'rgba(255, 159, 28, 0.12)', color: 'var(--theme-accent, #ff9f1c)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                Imported
              </span>
            )}
          </div>

          <h3 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            {playlist.name}
          </h3>

          <p style={{ color: '#666', fontSize: '13px', marginTop: '6px', fontWeight: 500 }}>
            {tracks.length} songs • Created by {playlist.creator_name || 'you'}
            {playlist.import_url && ` • Last synced: ${playlist.last_synced_at ? new Date(playlist.last_synced_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}`}
          </p>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onCopyPlaylistLink(playlist.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <Share2 size={13} />
              Share Link
            </button>

            {isOwnProfile && playlist.import_url && onSyncPlaylist && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={() => onSyncPlaylist(playlist.id)}
                  disabled={isSyncing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: isSyncing ? 'rgba(0,0,0,0.2)' : 'rgba(255, 159, 28, 0.08)',
                    border: '1px solid rgba(255, 159, 28, 0.15)',
                    color: 'var(--theme-accent, #ff9f1c)',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <RefreshCw size={13} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
                  {isSyncing ? 'Syncing...' : 'Sync Source'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '6px 14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Auto-Sync</span>
                  <button
                    onClick={handleToggleAutoSync}
                    style={{
                      position: 'relative',
                      width: '34px',
                      height: '20px',
                      borderRadius: '20px',
                      background: isAutoSyncEnabled ? 'var(--theme-accent, #ff9f1c)' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      padding: 0
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      left: isAutoSyncEnabled ? '16px' : '2px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: '#000',
                      transition: 'all 0.2s'
                    }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracks list */}
      {tracks.length === 0 ? (
        <div className="profile-empty-state" style={{ padding: '40px' }}>
          <Music size={32} style={{ marginBottom: '12px', opacity: 0.15 }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>This playlist is empty</p>
          {isOwnProfile && (
            <p style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>Add songs from your Liked Songs library.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Tracks list headers */}
          <div className="profile-playlist-track-header" style={{ display: 'flex', padding: '8px 16px', fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ width: '30px' }}>#</span>
            <span style={{ flex: 1 }}>Title</span>
            <span style={{ width: '60px', textAlign: 'right', paddingRight: isOwnProfile ? '36px' : '0px' }}>Time</span>
          </div>

          {/* Track items */}
          {tracks.map((track, i) => (
            <div
              key={track.id || i}
              className="profile-playlist-track-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: '14px',
                gap: '12px'
              }}
            >
              <span style={{ width: '30px', color: '#555', fontSize: '13px', fontWeight: 700 }}>{i + 1}</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                {track.album_art_url ? (
                  <img 
                    src={track.album_art_url} 
                    alt="" 
                    style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Disc size={16} color="#444" />
                  </div>
                )}
                
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.track_name}
                  </h4>
                  <p style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                    {track.artist}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#555', fontWeight: 600 }}>{formatDuration(track.duration_ms)}</span>

                {isOwnProfile && (
                  <button
                    onClick={() => onRemoveTrack(track.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      borderRadius: '50%',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff4757'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#444'}
                    title="Remove from playlist"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
