'use client';

import React from 'react';
import { 
  BarChart2, Clock, Music, MessageSquare, ThumbsUp, RefreshCw, 
  Disc, Award, Play, Globe
} from 'lucide-react';

export default function ProfileStats({
  stats,
  loading,
  onRefresh,
  isOwnProfile
}) {
  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: '#888', gap: '16px' }}>
        <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '15px', fontWeight: 500 }}>Calculating musical footprint...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="profile-empty-state">
        <BarChart2 size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>No stats available.</p>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>Queue songs and participate in rooms to build your footprint!</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              marginTop: '16px',
              background: 'rgba(255, 159, 28, 0.1)',
              border: '1px solid rgba(255, 159, 28, 0.2)',
              color: 'var(--theme-accent, #ff9f1c)',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Generate Stats
          </button>
        )}
      </div>
    );
  }

  // Calculate max values for bar relative widths
  const maxArtistCount = stats.top_artists?.length > 0 ? stats.top_artists[0].count : 1;
  const maxGenreCount = stats.top_genres?.length > 0 ? stats.top_genres[0].count : 1;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <BarChart2 size={28} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
          <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Listening Statistics</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="profile-btn-stats-refresh"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 159, 28, 0.1)',
              border: '1px solid rgba(255, 159, 28, 0.2)',
              color: 'var(--theme-accent, #ff9f1c)',
              padding: '8px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        )}
      </div>

      {/* Primary Music Footprint Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="profile-stat-card">
          <Clock size={20} style={{ color: 'var(--theme-accent, #ff9f1c)', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Listening Time</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.listening_time_mins > 60 
              ? `${Math.floor(stats.listening_time_mins / 60)}h ${stats.listening_time_mins % 60}m` 
              : `${stats.listening_time_mins}m`}
          </div>
        </div>

        <div className="profile-stat-card">
          <Music size={20} style={{ color: '#3b82f6', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Songs Queued</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.total_queued}
          </div>
        </div>

        <div className="profile-stat-card">
          <ThumbsUp size={20} style={{ color: '#ec4899', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Likes Received</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.total_likes}
          </div>
        </div>
      </div>

      {/* Secondary Engagement Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '24px', 
        background: 'rgba(255,255,255,0.01)', 
        border: '1px solid rgba(255,255,255,0.03)', 
        borderRadius: '16px', 
        padding: '12px 24px', 
        marginBottom: '32px',
        fontSize: '12px',
        color: '#888',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', color: '#555', letterSpacing: '0.05em' }}>Activity Engagement:</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MessageSquare size={13} style={{ color: '#8b5cf6' }} />
          <strong>{stats.total_chats}</strong> chat messages sent
        </span>
        <span style={{ color: '#333' }}>|</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ThumbsUp size={13} style={{ color: '#10b981' }} />
          <strong>{stats.total_votes}</strong> skip votes cast
        </span>
        <span style={{ color: '#333' }}>|</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={13} style={{ color: '#3b82f6' }} />
          <strong>{stats.rooms_hosted || 0}</strong> rooms hosted
        </span>
      </div>

      {/* Grid for charts & lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginBottom: '32px' }}>
        
        {/* Top Tracks */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={16} style={{ color: '#ffd700' }} />
            Top Queued Tracks
          </h4>
          {(!stats.top_tracks || stats.top_tracks.length === 0) ? (
            <p style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Queue tracks to populate.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.top_tracks.map((track, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`profile-rank-badge rank-${i+1 <= 3 ? i+1 : 'other'}`}>
                    {i + 1}
                  </span>
                  
                  {track.album_art_url ? (
                    <img 
                      src={track.album_art_url} 
                      alt="" 
                      style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Disc size={18} color="#555" />
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {track.track_name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {track.artist}
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '8px', fontWeight: 700, color: '#aaa' }}>
                    {track.count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Artists */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Music size={16} style={{ color: '#3b82f6' }} />
            Top Artists
          </h4>
          {(!stats.top_artists || stats.top_artists.length === 0) ? (
            <p style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Play more music to populate.</p>
          ) : (
            <div className="profile-bar-chart-container">
              {stats.top_artists.map((artist, i) => {
                const percentage = (artist.count / maxArtistCount) * 100;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#ddd' }}>{artist.artist}</span>
                      <span style={{ color: '#888', fontWeight: 600 }}>{artist.count} times</span>
                    </div>
                    <div className="profile-bar-chart-bar-bg">
                      <div 
                        className="profile-bar-chart-bar-fill" 
                        style={{ width: `${percentage}%`, background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)' }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Favorite Genres */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Play size={16} style={{ color: '#10b981' }} />
            Favorite Genres
          </h4>
          {(!stats.top_genres || stats.top_genres.length === 0) ? (
            <p style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Join genres/rooms to populate.</p>
          ) : (
            <div className="profile-bar-chart-container">
              {stats.top_genres.map((genre, i) => {
                const percentage = (genre.count / maxGenreCount) * 100;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#ddd', textTransform: 'capitalize' }}>{genre.genre}</span>
                      <span style={{ color: '#888', fontWeight: 600 }}>{genre.count} songs</span>
                    </div>
                    <div className="profile-bar-chart-bar-bg">
                      <div 
                        className="profile-bar-chart-bar-fill" 
                        style={{ width: `${percentage}%`, background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recently Played Section */}
      {stats.recently_played && stats.recently_played.length > 0 && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: '#a855f7' }} />
            Recently Played Tracks
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats.recently_played.map((track, i) => {
              const playedDate = track.played_at ? new Date(track.played_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A';
              return (
                <div 
                  key={track.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    {track.album_art_url ? (
                      <img 
                        src={track.album_art_url} 
                        alt="" 
                        style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Disc size={16} color="#444" />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.track_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                        {track.artist}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#555', fontSize: '12px', fontWeight: 600 }}>
                    {playedDate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
