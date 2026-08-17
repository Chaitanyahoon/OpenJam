'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart2, Clock, Music, MessageSquare, ThumbsUp, RefreshCw, 
  Disc, Award, Play, Globe, Share2, Download, Copy, X,
  Compass, Heart, Radio, Crown, CheckCircle2, Lock, Sparkles, Headphones
} from 'lucide-react';

export default function ProfileStats({
  stats,
  loading,
  onRefresh,
  isOwnProfile,
  profile
}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [hoveredDayIdx, setHoveredDayIdx] = useState(null);

  const handleCopyLink = () => {
    const link = profile?.username 
      ? `${window.location.origin}/profile/@${profile.username}` 
      : `${window.location.origin}/profile/${profile?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCard = () => {
    const svgElement = document.getElementById('musical-footprint-card');
    if (!svgElement) return;

    // Serialize the SVG XML source
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const DOMURL = window.URL || window.webkitURL || window;
    const blobURL = DOMURL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800; // Double size for high DPI crispness
      canvas.height = 960;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(image, 0, 0, 800, 960);
        const pngURL = canvas.toDataURL('image/png');
        
        const downloadLink = document.createElement('a');
        downloadLink.href = pngURL;
        downloadLink.download = `${profile?.display_name || 'My'}_OpenJam_Wrapped.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      DOMURL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

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

  const activityChartData = stats.activity_chart || [];
  const maxActivityMinutes = Math.max(1, ...activityChartData.map(d => d.minutes || 0));

  const getTierStyles = (tier) => {
    switch (tier) {
      case 'diamond':
        return {
          border: '1px solid rgba(168, 85, 247, 0.4)',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
          glow: '0 0 20px rgba(168, 85, 247, 0.25)',
          tagBg: 'rgba(168, 85, 247, 0.2)',
          tagColor: '#c084fc',
          accent: '#a855f7'
        };
      case 'gold':
        return {
          border: '1px solid rgba(234, 179, 8, 0.4)',
          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(249, 115, 22, 0.08) 100%)',
          glow: '0 0 20px rgba(234, 179, 8, 0.25)',
          tagBg: 'rgba(234, 179, 8, 0.2)',
          tagColor: '#fde047',
          accent: '#eab308'
        };
      case 'silver':
        return {
          border: '1px solid rgba(148, 163, 184, 0.35)',
          background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(100, 116, 139, 0.05) 100%)',
          glow: '0 0 16px rgba(148, 163, 184, 0.2)',
          tagBg: 'rgba(148, 163, 184, 0.15)',
          tagColor: '#e2e8f0',
          accent: '#94a3b8'
        };
      case 'bronze':
      default:
        return {
          border: '1px solid rgba(217, 119, 6, 0.35)',
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(180, 83, 9, 0.05) 100%)',
          glow: '0 0 16px rgba(217, 119, 6, 0.2)',
          tagBg: 'rgba(217, 119, 6, 0.15)',
          tagColor: '#fdba74',
          accent: '#d97706'
        };
    }
  };

  const getBadgeIcon = (iconName, accent) => {
    const props = { size: 22, color: accent || '#ff9f1c' };
    switch (iconName) {
      case 'Headphones':
        return <Headphones {...props} />;
      case 'Radio':
        return <Radio {...props} />;
      case 'Compass':
        return <Compass {...props} />;
      case 'Disc':
        return <Disc {...props} />;
      case 'Crown':
        return <Crown {...props} />;
      case 'MessageSquare':
        return <MessageSquare {...props} />;
      case 'Award':
      default:
        return <Award {...props} />;
    }
  };

  const genreColors = [
    { bg: 'rgba(255, 159, 28, 0.15)', border: 'rgba(255, 159, 28, 0.3)', text: '#ff9f1c' },
    { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)', text: '#a855f7' },
    { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
    { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)', text: '#f43f5e' }
  ];

  return (
    <div>
      {/* Header */}
      <div className="profile-stats-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <div className="profile-stats-title-group" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <BarChart2 size={28} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
          <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Listening Statistics</h3>
        </div>
        <div className="profile-stats-actions-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              color: '#a855f7',
              padding: '8px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'; }}
          >
            <Share2 size={14} />
            Share Card
          </button>
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
      </div>

      {/* Primary Music Footprint Grid (4 Cards: Listening Time, Rooms Visited, Songs Queued, Favorites) */}
      <div className="profile-stats-primary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="profile-stat-card">
          <Clock size={20} style={{ color: 'var(--theme-accent, #ff9f1c)', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Listening Time</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.listening_time_mins > 60 
              ? `${Math.floor(stats.listening_time_mins / 60)}h ${stats.listening_time_mins % 60}m` 
              : `${stats.listening_time_mins || 0}m`}
          </div>
        </div>

        <div className="profile-stat-card">
          <Compass size={20} style={{ color: '#10b981', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Rooms Visited</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.total_rooms_visited || 0}
          </div>
        </div>

        <div className="profile-stat-card">
          <Music size={20} style={{ color: '#3b82f6', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Songs Queued</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.total_queued || 0}
          </div>
        </div>

        <div className="profile-stat-card">
          <Heart size={20} style={{ color: '#ec4899', marginBottom: '12px' }} />
          <div style={{ color: '#666', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Favorites & Likes</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {stats.total_likes || 0}
          </div>
        </div>
      </div>

      {/* Secondary Engagement Bar */}
      <div className="profile-stats-engagement-bar" style={{ 
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
          <strong>{stats.total_chats || 0}</strong> chat messages sent
        </span>
        <span className="divider-pipe" style={{ color: '#333' }}>|</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ThumbsUp size={13} style={{ color: '#10b981' }} />
          <strong>{stats.total_votes || 0}</strong> skip votes cast
        </span>
        <span className="divider-pipe" style={{ color: '#333' }}>|</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={13} style={{ color: '#3b82f6' }} />
          <strong>{stats.rooms_hosted || 0}</strong> rooms hosted
        </span>
      </div>

      {/* 7-Day Activity & Genre Distribution Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* 7-Day Activity Rhythm Bar Chart */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
              7-Day Listening Activity
            </h4>
            <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>Daily Minutes</span>
          </div>

          <div style={{ position: 'relative', height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', padding: '0 8px 8px' }}>
            {activityChartData.length === 0 ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '13px' }}>
                No recent activity recorded
              </div>
            ) : (
              activityChartData.map((d, idx) => {
                const heightPct = maxActivityMinutes > 0 ? Math.max(8, (d.minutes / maxActivityMinutes) * 100) : 8;
                const isHovered = hoveredDayIdx === idx;

                return (
                  <div
                    key={d.date || idx}
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Tooltip on Hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: 'absolute',
                            bottom: `${heightPct + 12}%`,
                            background: '#1a1a24',
                            border: '1px solid rgba(255, 159, 28, 0.4)',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                          }}
                        >
                          <span style={{ color: 'var(--theme-accent, #ff9f1c)' }}>{d.minutes}m</span> ({d.day})
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bar */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '32px',
                        height: `${heightPct}%`,
                        borderRadius: '6px 6px 2px 2px',
                        background: isHovered
                          ? 'linear-gradient(180deg, #ffb703 0%, #ff9f1c 100%)'
                          : 'linear-gradient(180deg, rgba(255, 159, 28, 0.7) 0%, rgba(255, 159, 28, 0.2) 100%)',
                        boxShadow: isHovered ? '0 0 16px rgba(255, 159, 28, 0.4)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />

                    {/* Day label */}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: isHovered ? '#fff' : '#666', marginTop: '8px', transition: 'color 0.2s' }}>
                      {d.day}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Visual Genre Breakdown */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Disc size={16} style={{ color: '#ec4899' }} />
            Top Genre Footprint
          </h4>

          {(!stats.top_genres || stats.top_genres.length === 0) ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '13px' }}>
              Explore genres to build your musical taste profile
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
              {stats.top_genres.map((g, i) => {
                const color = genreColors[i % genreColors.length];
                const pct = g.percentage !== undefined ? g.percentage : 0;

                return (
                  <div key={g.genre || i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#e5e5e5', textTransform: 'capitalize' }}>
                        {g.genre}
                      </span>
                      <span style={{ fontWeight: 800, color: color.text, fontFamily: 'var(--font-mono, monospace)' }}>
                        {pct}% <span style={{ color: '#555', fontWeight: 500, fontSize: '11px' }}>({g.count} tracks)</span>
                      </span>
                    </div>
                    {/* Distribution Bar */}
                    <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${pct}%`, 
                          height: '100%', 
                          borderRadius: '3px', 
                          background: color.text,
                          boxShadow: `0 0 8px ${color.text}44`,
                          transition: 'width 0.5s ease'
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Milestone Badges Achievement Showcase */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: '#ffd700' }} />
            Milestone Badges & Achievements
          </h4>
          <span style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>
            {stats.milestone_badges?.filter(b => b.unlocked).length || 0} of {stats.milestone_badges?.length || 0} Unlocked
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {(stats.milestone_badges || []).map((badge) => {
            const styles = getTierStyles(badge.tier);
            const isUnlocked = !!badge.unlocked;
            const progress = badge.progress !== undefined ? badge.progress : 0;
            const target = badge.target || 1;
            const progressPct = Math.min(100, Math.round((progress / target) * 100));

            return (
              <div
                key={badge.id}
                style={{
                  background: styles.background,
                  border: styles.border,
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: isUnlocked ? styles.glow : 'none',
                  opacity: isUnlocked ? 1 : 0.75,
                  transition: 'all 0.25s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: isUnlocked ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
                        border: `1px solid ${styles.accent}44`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {getBadgeIcon(badge.icon, styles.accent)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                        {badge.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                        {badge.description}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: styles.tagBg,
                      color: styles.tagColor,
                      letterSpacing: '0.05em'
                    }}
                  >
                    {badge.tier}
                  </span>
                </div>

                {/* Progress bar or Unlocked indicator */}
                {isUnlocked ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
                    <CheckCircle2 size={14} />
                    <span>Unlocked ({progress} / {target})</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#777', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={11} /> In Progress
                      </span>
                      <span>{progress} / {target}</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          background: styles.accent,
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid for top tracks & recently played lists */}
      <div className="profile-stats-secondary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginBottom: '32px' }}>
        
        {/* Top Tracks */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={16} style={{ color: '#ffd700' }} />
            Top Listened Tracks
          </h4>
          {(!stats.top_tracks || stats.top_tracks.length === 0) ? (
            <p style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Queue tracks to populate.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.top_tracks.slice(0, 5).map((track, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`profile-rank-badge rank-${i+1 <= 3 ? i+1 : 'other'}`}>
                    {i + 1}
                  </span>
                  
                  {track.album_art_url ? (
                    <img decoding="async" loading="lazy"
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

        {/* Recently Played Section */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.1)' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: '#a855f7' }} />
            Recently Played Tracks
          </h4>
          {(!stats.recently_played || stats.recently_played.length === 0) ? (
            <p style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Queue tracks to populate history.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(showAllHistory ? stats.recently_played : stats.recently_played.slice(0, 3)).map((track, i) => {
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
                          <img decoding="async" loading="lazy"
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

              {stats.recently_played.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '10px',
                    color: 'var(--theme-accent, #ff9f1c)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 159, 28, 0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                >
                  {showAllHistory ? 'Show Less History' : `View Full History (${stats.recently_played.length} tracks)`}
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* Shareable Music Footprint Card Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div 
            className="profile-modal-backdrop"
            onClick={() => setShowShareModal(false)}
            style={{ zIndex: 99999 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#0d0d12',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '24px',
                padding: '24px',
                width: '100%',
                maxWidth: '380px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} style={{ color: '#ff9f1c' }} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>Share Footprint</span>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* The SVG Share Card Viewport */}
              <div style={{ display: 'flex', justifyContent: 'center', background: '#050507', padding: '12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <svg 
                  id="musical-footprint-card" 
                  width="280" 
                  height="336" 
                  viewBox="0 0 400 480" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ borderRadius: '16px' }}
                >
                  <defs>
                    <linearGradient id="cardBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#08080c"/>
                      <stop offset="50%" stopColor="#0f0e15"/>
                      <stop offset="100%" stopColor="#050507"/>
                    </linearGradient>
                    <radialGradient id="goldGlow" cx="0%" cy="0%" r="60%">
                      <stop offset="0%" stopColor="#ff9f1c" stopOpacity="0.16"/>
                      <stop offset="100%" stopColor="#ff9f1c" stopOpacity="0"/>
                    </radialGradient>
                    <radialGradient id="purpleGlow" cx="100%" cy="100%" r="50%">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.14"/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                    </radialGradient>
                    <radialGradient id="pinkGlow" cx="100%" cy="40%" r="50%">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity="0.12"/>
                      <stop offset="100%" stopColor="#ec4899" stopOpacity="0"/>
                    </radialGradient>
                    <linearGradient id="vinylCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffd700"/>
                      <stop offset="50%" stopColor="#f5b041"/>
                      <stop offset="100%" stopColor="#a04000"/>
                    </linearGradient>
                    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="8" stdDeviation="15" floodColor="#000000" floodOpacity="0.6"/>
                    </filter>
                  </defs>

                  <style>
                    {`
                      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
                      .outfit-font { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; }
                    `}
                  </style>

                  {/* Base Card Background */}
                  <rect width="400" height="480" rx="30" fill="url(#cardBgGradient)" />
                  <rect width="400" height="480" rx="30" fill="url(#goldGlow)" />
                  <rect width="400" height="480" rx="30" fill="url(#purpleGlow)" />
                  <rect width="400" height="480" rx="30" fill="url(#pinkGlow)" />

                  {/* Decorative Geometric Lines */}
                  <path d="M 0 100 L 400 180" stroke="rgba(255,255,255,0.015)" strokeWidth="1" />
                  <path d="M 0 240 L 400 320" stroke="rgba(255,255,255,0.01)" strokeWidth="1.5" />
                  
                  {/* Subtle Grid Dots */}
                  <circle cx="50" cy="50" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="100" cy="50" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="150" cy="50" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="200" cy="50" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="50" cy="100" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="100" cy="100" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="150" cy="100" r="1" fill="rgba(255,255,255,0.05)" />
                  <circle cx="200" cy="100" r="1" fill="rgba(255,255,255,0.05)" />

                  {/* Card Borders */}
                  <rect x="12" y="12" width="376" height="456" rx="22" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
                  <rect x="18" y="18" width="364" height="444" rx="18" stroke="rgba(255,255,255,0.04)" strokeDasharray="6 6" strokeWidth="1" />

                  {/* Cosmic Vinyl Record on the right edge */}
                  <g transform="translate(360, 240)">
                    {/* Vinyl Record body */}
                    <circle cx="0" cy="0" r="150" fill="#111116" stroke="rgba(255,255,255,0.06)" strokeWidth="2" filter="url(#cardShadow)" />
                    
                    {/* Concentric Groove Lines */}
                    <circle cx="0" cy="0" r="135" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" fill="none" />
                    <circle cx="0" cy="0" r="120" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />
                    <circle cx="0" cy="0" r="105" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" fill="none" />
                    <circle cx="0" cy="0" r="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />
                    <circle cx="0" cy="0" r="75" stroke="rgba(255,255,255,0.04)" strokeWidth="2" fill="none" />
                    
                    {/* Shiny sheen reflection overlays */}
                    <path d="M -150 0 A 150 150 0 0 1 150 0 Z" fill="rgba(255,255,255,0.015)" />
                    <path d="M 0 -150 A 150 150 0 0 1 0 150 Z" fill="rgba(255,255,255,0.01)" />

                    {/* Vinyl Center Sticker */}
                    <circle cx="0" cy="0" r="48" fill="url(#vinylCenter)" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                    <circle cx="0" cy="0" r="40" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1.5" strokeDasharray="3 3" />
                    
                    {/* Inner glowing vinyl ring */}
                    <circle cx="0" cy="0" r="14" fill="#000" />
                    <circle cx="0" cy="0" r="6" fill="#050507" />

                    {/* Headphone brand graphic in center */}
                    <path d="M -18,0 A 18,18 0 0,1 18,0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
                    <rect x="-21" y="-3" width="6" height="11" rx="3" fill="#ff9f1c" opacity="0.9" />
                    <rect x="15" y="-3" width="6" height="11" rx="3" fill="#ff9f1c" opacity="0.9" />
                  </g>
                  
                  {/* OpenJam Logo Brand Text */}
                  <text x="40" y="60" fill="#fff" className="outfit-font" fontSize="22" fontWeight="900" letterSpacing="-0.5">OpenJam</text>
                  <text x="40" y="78" fill="rgba(255,255,255,0.3)" className="outfit-font" fontSize="10" fontWeight="800" letterSpacing="1.5">MY MUSICAL FOOTPRINT</text>

                  {/* WRAPPED Badge */}
                  <rect x="265" y="42" width="95" height="22" rx="11" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" />
                  <text x="312.5" y="56" fill="var(--theme-accent, #ff9f1c)" className="outfit-font" fontSize="9" fontWeight="800" textAnchor="middle" letterSpacing="1">V2 STATS</text>

                  {/* User Profile Info */}
                  <text x="40" y="145" fill="#fff" className="outfit-font" fontSize="28" fontWeight="900" letterSpacing="-0.8">{profile?.display_name || 'Jammer'}</text>
                  <text x="40" y="168" fill="rgba(255,255,255,0.4)" className="outfit-font" fontSize="12" fontWeight="600">@{profile?.username || 'user'}</text>
                  
                  <line x1="40" y1="195" x2="360" y2="195" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

                  {/* Stats Block 1: LISTENING TIME */}
                  <text x="40" y="235" fill="rgba(255,255,255,0.3)" className="outfit-font" fontSize="10" fontWeight="800" letterSpacing="0.8">LISTENING TIME</text>
                  <text x="40" y="262" fill="#ff9f1c" className="outfit-font" fontSize="24" fontWeight="900">
                    {stats.listening_time_mins > 60 
                      ? `${Math.floor(stats.listening_time_mins / 60)}h ${stats.listening_time_mins % 60}m` 
                      : `${stats.listening_time_mins || 0}m`}
                  </text>

                  {/* Stats Block 2: SONGS QUEUED */}
                  <text x="210" y="235" fill="rgba(255,255,255,0.3)" className="outfit-font" fontSize="10" fontWeight="800" letterSpacing="0.8">SONGS QUEUED</text>
                  <text x="210" y="262" fill="#3b82f6" className="outfit-font" fontSize="24" fontWeight="900">{stats.total_queued || 0}</text>

                  <line x1="40" y1="295" x2="360" y2="295" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

                  {/* Stats Block 3: TOP LISTENED SONG */}
                  <text x="40" y="335" fill="rgba(255,255,255,0.3)" className="outfit-font" fontSize="10" fontWeight="800" letterSpacing="0.8">TOP LISTENED SONG</text>
                  <text x="40" y="362" fill="#ec4899" className="outfit-font" fontSize="18" fontWeight="900">
                    {stats.top_tracks?.length > 0 ? stats.top_tracks[0].track_name.substring(0, 30) : 'None'}
                  </text>
                  <text x="40" y="380" fill="rgba(255,255,255,0.4)" className="outfit-font" fontSize="11" fontWeight="600">
                    {stats.top_tracks?.length > 0 ? `by ${stats.top_tracks[0].artist.substring(0, 30)}` : ''}
                  </text>

                  {/* Footer Wave Pattern */}
                  <g opacity="0.15" transform="translate(40, 440)">
                    <rect x="0" y="10" width="3" height="8" rx="1.5" fill="#fff" />
                    <rect x="6" y="5" width="3" height="13" rx="1.5" fill="#fff" />
                    <rect x="12" y="8" width="3" height="10" rx="1.5" fill="#fff" />
                    <rect x="18" y="2" width="3" height="16" rx="1.5" fill="#fff" />
                    <rect x="24" y="6" width="3" height="12" rx="1.5" fill="#fff" />
                    <rect x="30" y="11" width="3" height="7" rx="1.5" fill="#fff" />
                    <rect x="36" y="7" width="3" height="11" rx="1.5" fill="#fff" />
                    <rect x="42" y="3" width="3" height="15" rx="1.5" fill="#fff" />
                  </g>
                  <text x="360" y="452" fill="rgba(255,255,255,0.2)" className="outfit-font" fontSize="9" fontWeight="800" textAnchor="end" letterSpacing="0.5">openjam.fun</text>
                </svg>
              </div>

              {/* Share Card Modal Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleDownloadCard}
                  style={{
                    flex: 1,
                    background: 'var(--theme-accent, #ff9f1c)',
                    border: 'none',
                    color: '#000',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(255, 159, 28, 0.2)'
                  }}
                >
                  <Download size={14} />
                  Download PNG
                </button>
                <button
                  onClick={handleCopyLink}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Copy size={14} />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
