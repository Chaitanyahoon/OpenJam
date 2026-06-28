'use client';

import React, { useState } from 'react';
import { 
  Heart, Search, Plus, Trash2, Disc, Play, ListPlus, 
  ChevronDown, Globe, Lock, ArrowUpDown
} from 'lucide-react';

export default function ProfileLikes({
  likes,
  playlists,
  isOwnProfile,
  onUnlikeTrack,
  onAddTrackToPlaylist,
  activeDropdownTrackUri,
  setActiveDropdownTrackUri
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'name' | 'artist'

  // Filter likes
  const filteredLikes = likes.filter(like => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      like.track_name.toLowerCase().includes(q) ||
      like.artist.toLowerCase().includes(q)
    );
  });

  // Sort likes
  const sortedLikes = [...filteredLikes].sort((a, b) => {
    if (sortBy === 'name') {
      return a.track_name.localeCompare(b.track_name);
    }
    if (sortBy === 'artist') {
      return a.artist.localeCompare(b.artist);
    }
    // Default: date added (newest first)
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
    return dateB - dateA;
  });

  return (
    <div>
      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Heart size={28} style={{ color: '#ff4757' }} />
          <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Liked Songs</h3>
        </div>

        {/* Sort & Search Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Sort selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '12px' }}>
            <ArrowUpDown size={13} color="#888" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ddd',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="date" style={{ background: '#0e0e12', color: '#fff' }}>Recently Added</option>
              <option value="name" style={{ background: '#0e0e12', color: '#fff' }}>Song Name</option>
              <option value="artist" style={{ background: '#0e0e12', color: '#fff' }}>Artist Name</option>
            </select>
          </div>

          {/* Search bar */}
          <div className="profile-search-wrapper" style={{ width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '14px', color: '#666' }} />
            <input
              type="text"
              placeholder="Search liked songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="profile-search-input"
              style={{ padding: '8px 12px 8px 36px', borderRadius: '12px' }}
            />
          </div>
        </div>
      </div>

      {/* Grid of Liked Songs */}
      {sortedLikes.length === 0 ? (
        <div className="profile-empty-state">
          <Heart size={48} style={{ marginBottom: '16px', opacity: 0.15, color: '#ff4757' }} />
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>
            {searchQuery ? "No matching songs found" : "Your liked songs library is empty"}
          </p>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
            {searchQuery ? "Try adjusting your search query." : "Heart tracks in rooms to save them to your profile!"}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedLikes.map((track) => (
            <div
              key={track.id}
              className="profile-playlist-track-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: '16px',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                {track.album_art_url ? (
                  <img 
                    src={track.album_art_url} 
                    alt="" 
                    style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ width: '46px', height: '46px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Disc size={20} color="#555" />
                  </div>
                )}
                
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.track_name}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {track.artist}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                {isOwnProfile && (
                  <>
                    {/* Add to Playlist button & dropdown */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownTrackUri(activeDropdownTrackUri === track.track_uri ? null : track.track_uri);
                      }}
                      className="profile-track-dropdown-trigger"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: activeDropdownTrackUri === track.track_uri ? 'var(--theme-accent, #ff9f1c)' : '#888',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      <ListPlus size={14} />
                      <span>Add to Playlist</span>
                      <ChevronDown size={12} />
                    </button>

                    {/* Playlist drop menu */}
                    {activeDropdownTrackUri === track.track_uri && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '36px',
                          top: '32px',
                          background: '#12121a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          padding: '6px',
                          width: '180px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 200,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                        }}
                      >
                        <div style={{ fontSize: '10px', color: '#555', fontWeight: 700, textTransform: 'uppercase', padding: '6px 8px 4px 8px', letterSpacing: '0.05em' }}>Select Playlist</div>
                        {playlists.length === 0 ? (
                          <div style={{ padding: '8px 10px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No playlists yet.</div>
                        ) : (
                          playlists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => {
                                onAddTrackToPlaylist(pl.id, track);
                                setActiveDropdownTrackUri(null);
                              }}
                              className="profile-dropdown-item"
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 10px',
                                background: 'none',
                                border: 'none',
                                color: '#ddd',
                                fontSize: '12px',
                                fontWeight: 500,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {pl.is_private ? <Lock size={10} color="#ff4757" /> : <Globe size={10} color="#10b981" />}
                              <span>{pl.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Unlike (Heart) button */}
                    <button
                      onClick={() => onUnlikeTrack(track.track_uri)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff4757',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Remove from Liked Songs"
                    >
                      <Heart size={16} fill="#ff4757" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
