'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Edit2, Check, X, LogOut, Disc, 
  Heart, ListMusic, Globe, Calendar, KeyRound, Sparkles
} from 'lucide-react';

const THEME_COLORS = {
  amber: { name: 'Amber', color: '#ff9f1c', accent: 'var(--theme-accent, #ff9f1c)' },
  cobalt: { name: 'Cobalt', color: '#3b82f6', accent: '#3b82f6' },
  rose: { name: 'Rose', color: '#ec4899', accent: '#rose' },
  emerald: { name: 'Emerald', color: '#10b981', accent: '#emerald' },
  violet: { name: 'Violet', color: '#8b5cf6', accent: '#violet' }
};

const BANNER_GRADIENTS = {
  default: { name: 'Theme Match', class: '', style: (theme) => {
    switch (theme) {
      case 'cobalt': return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1d4ed8 100%)';
      case 'rose': return 'linear-gradient(135deg, #581c87 0%, #ec4899 50%, #be185d 100%)';
      case 'emerald': return 'linear-gradient(135deg, #064e3b 0%, #10b981 50%, #047857 100%)';
      case 'violet': return 'linear-gradient(135deg, #2e1065 0%, #8b5cf6 50%, #6d28d9 100%)';
      case 'amber':
      default: return 'linear-gradient(135deg, #78350f 0%, #ff9f1c 50%, #d97706 100%)';
    }
  }},
  cosmic: { name: 'Cosmic Nebula', style: () => 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #db2777 100%)' },
  sunset: { name: 'Sunset Glow', style: () => 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #eab308 100%)' },
  oceanic: { name: 'Deep Oceanic', style: () => 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #0d9488 100%)' },
  neon: { name: 'Cyber Neon', style: () => 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #06b6d4 100%)' }
};

export default function ProfileHero({
  profile,
  isOwnProfile,
  onUpdateProfile,
  onLogout,
  playlistsCount,
  likesCount,
  roomsHostedCount = 0
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile?.display_name || '');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(profile?.bio || '');
  const [showSettings, setShowSettings] = useState(false);

  const theme = profile?.profile_theme || 'amber';
  const bannerPreset = profile?.banner_color || 'default';
  const bannerStyle = BANNER_GRADIENTS[bannerPreset]?.style(theme) || BANNER_GRADIENTS.default.style(theme);

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: bannerPreset });
    setIsEditingName(false);
  };

  const handleSaveBio = async () => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: bannerPreset });
    setIsEditingBio(false);
  };

  const handleThemeChange = async (newTheme) => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: newTheme, banner_color: bannerPreset });
  };

  const handleBannerChange = async (newBanner) => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: newBanner });
  };

  const formattedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  return (
    <div className="profile-hero">
      {/* Banner */}
      <div 
        className="profile-hero-banner" 
        style={{ background: bannerStyle }}
      >
        {isOwnProfile && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              zIndex: 10
            }}
          >
            <Sparkles size={13} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
            Customize Profile
          </button>
        )}
      </div>

      {/* Hero Settings overlay */}
      {isOwnProfile && showSettings && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            position: 'absolute',
            top: '55px',
            right: '16px',
            background: 'rgba(15, 15, 22, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            width: '280px',
            backdropFilter: 'blur(20px)',
            zIndex: 15,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#aaa' }}>Customization Panel</span>
            <X size={16} style={{ cursor: 'pointer', color: '#888' }} onClick={() => setShowSettings(false)} />
          </div>

          {/* Theme selection */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Theme Accent</div>
            <div className="profile-theme-selector">
              {Object.entries(THEME_COLORS).map(([key, value]) => (
                <div
                  key={key}
                  className={`profile-theme-dot ${theme === key ? 'active' : ''}`}
                  style={{ backgroundColor: value.color, color: value.color }}
                  title={value.name}
                  onClick={() => handleThemeChange(key)}
                />
              ))}
            </div>
          </div>

          {/* Banner selection */}
          <div>
            <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Banner Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {Object.entries(BANNER_GRADIENTS).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleBannerChange(key)}
                  style={{
                    background: bannerPreset === key ? 'rgba(255, 159, 28, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: bannerPreset === key ? '1px solid var(--theme-accent, #ff9f1c)' : '1px solid rgba(255,255,255,0.05)',
                    color: bannerPreset === key ? 'var(--theme-accent, #ff9f1c)' : '#aaa',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {value.name}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Body Info */}
      <div className="profile-hero-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', flex: 1 }}>
          {/* Avatar */}
          <div className="profile-hero-avatar-wrapper">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.display_name} 
                className="profile-hero-avatar"
              />
            ) : (
              <div className="profile-hero-avatar-placeholder">
                <User size={48} color="#666" />
              </div>
            )}
          </div>

          {/* Info Details */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--theme-accent, #ff9f1c)',
                      color: '#fff',
                      fontSize: '24px',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '4px 12px',
                      outline: 'none',
                      maxWidth: '220px'
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveName} style={{ background: 'none', border: 'none', color: '#2ed573', cursor: 'pointer' }}>
                    <Check size={20} />
                  </button>
                  <button onClick={() => { setIsEditingName(false); setEditedName(profile?.display_name || ''); }} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #fff 0%, #ccc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {profile?.display_name}
                  </h2>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsEditingName(true)} 
                      className="profile-edit-name-btn"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Roles / Badges */}
              {profile?.is_admin && (
                <span style={{ fontSize: '11px', background: 'rgba(255, 71, 87, 0.15)', border: '1px solid rgba(255, 71, 87, 0.3)', color: '#ff4757', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Admin
                </span>
              )}
              {profile?.is_premium && (
                <span style={{ fontSize: '11px', background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2))', border: '1px solid rgba(255, 215, 0, 0.4)', color: '#ffd700', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={10} /> Premium
                </span>
              )}
            </div>

            {/* Bio section */}
            <div style={{ marginTop: '12px', maxWidth: '600px' }}>
              {isEditingBio ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                  <textarea
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    placeholder="Tell us about your music taste... (max 200 chars)"
                    maxLength={200}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid var(--theme-accent, #ff9f1c)',
                      color: '#fff',
                      fontSize: '13px',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      outline: 'none',
                      flex: 1,
                      height: '60px',
                      resize: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={handleSaveBio} style={{ background: 'none', border: 'none', color: '#2ed573', cursor: 'pointer' }}>
                      <Check size={18} />
                    </button>
                    <button onClick={() => { setIsEditingBio(false); setEditedBio(profile?.bio || ''); }} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <p style={{ fontSize: '14px', color: '#aaa', fontStyle: profile?.bio ? 'normal' : 'italic', lineHeight: 1.4 }}>
                    {profile?.bio || (isOwnProfile ? "Add a bio to express your musical identity..." : "No bio added yet.")}
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditingBio(true)}
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignSelf: 'center' }}
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Meta Items */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', color: '#666', fontSize: '12px', flexWrap: 'wrap' }}>
              {profile?.discord_username && (
                <span style={{ display: 'flex', alignSelf: 'center', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5865F2' }} />
                  Discord: @{profile.discord_username}
                </span>
              )}
              <span style={{ display: 'flex', alignSelf: 'center', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} />
                Joined: {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Action button & Stats summary pills */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          {isOwnProfile && onLogout && (
            <button
              onClick={onLogout}
              className="btn-signout"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          )}

          {/* Quick Stats Summary */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="profile-hero-badge" title="Saved Tracks">
              <Heart size={12} style={{ color: '#ff4757' }} />
              <span>{likesCount} Likes</span>
            </div>
            <div className="profile-hero-badge" title="Created Playlists">
              <ListMusic size={12} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
              <span>{playlistsCount} Playlists</span>
            </div>
            {roomsHostedCount > 0 && (
              <div className="profile-hero-badge" title="Rooms Hosted">
                <Globe size={12} style={{ color: '#10b981' }} />
                <span>{roomsHostedCount} Hosted</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
