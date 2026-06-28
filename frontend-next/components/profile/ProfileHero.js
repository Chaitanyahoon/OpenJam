'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Edit2, Check, X, LogOut, Disc, 
  Heart, ListMusic, Globe, Calendar, KeyRound, Sparkles, PlusCircle, Users
} from 'lucide-react';

const THEME_COLORS = {
  amber: { name: 'Amber', color: '#ff9f1c', accent: 'var(--theme-accent, #ff9f1c)' },
  cobalt: { name: 'Cobalt', color: '#3b82f6', accent: '#3b82f6' },
  rose: { name: 'Rose', color: '#ec4899', accent: '#ec4899' },
  emerald: { name: 'Emerald', color: '#10b981', accent: '#10b981' },
  violet: { name: 'Violet', color: '#8b5cf6', accent: '#8b5cf6' }
};

const BANNER_GRADIENTS = {
  default: { name: 'Theme Match', style: (theme) => {
    switch (theme) {
      case 'cobalt': return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1d4ed8 100%)';
      case 'rose': return 'linear-gradient(135deg, #581c87 0%, #ec4899 50%, #be185d 100%)';
      case 'emerald': return 'linear-gradient(135deg, #064e3b 0%, #10b981 50%, #047857 100%)';
      case 'violet': return 'linear-gradient(135deg, #2e1065 0%, #8b5cf6 50%, #6d28d9 100%)';
      case 'amber':
      default: return 'linear-gradient(135deg, #78350f 0%, #ff9f1c 50%, #d97706 100%)';
    }
  }},
  vinyl: { name: 'Retro Vinyl', style: () => 'radial-gradient(circle, #22222b 20%, #111116 80%)' },
  synth: { name: 'Synthwave Neon', style: () => 'linear-gradient(180deg, #db2777 0%, #4c1d95 60%, #1e1b4b 100%)' },
  cosmic: { name: 'Cosmic Nebula', style: () => 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #db2777 100%)' },
  sunset: { name: 'Sunset Glow', style: () => 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #eab308 100%)' }
};

export default function ProfileHero({
  profile,
  isOwnProfile,
  onUpdateProfile,
  onLogout,
  playlistsCount,
  likesCount,
  roomsHostedCount = 0,
  social = { followers_count: 0, following_count: 0, is_following: false },
  onFollowClick,
  onUnfollowClick,
  onOpenSocialModal
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile?.display_name || '');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(profile?.bio || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customBannerUrl, setCustomBannerUrl] = useState(profile?.banner_url || '');

  const theme = profile?.profile_theme || 'amber';
  const bannerPreset = profile?.banner_color || 'default';
  
  // Choose banner style: custom URL or preset gradient
  const bannerBackground = profile?.banner_url 
    ? `url(${profile.banner_url})` 
    : (BANNER_GRADIENTS[bannerPreset]?.style(theme) || BANNER_GRADIENTS.default.style(theme));

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    await onUpdateProfile({ display_name: editedName.trim(), bio: editedBio, profile_theme: theme, banner_color: bannerPreset, banner_url: customBannerUrl || null });
    setIsEditingName(false);
  };

  const handleSaveBio = async () => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: bannerPreset, banner_url: customBannerUrl || null });
    setIsEditingBio(false);
  };

  const handleThemeChange = async (newTheme) => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: newTheme, banner_color: bannerPreset, banner_url: customBannerUrl || null });
  };

  const handleBannerPresetChange = async (preset) => {
    setCustomBannerUrl('');
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: preset, banner_url: null });
  };

  const handleCustomBannerSave = async () => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: 'custom', banner_url: customBannerUrl.trim() || null });
  };

  const formattedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  return (
    <div className="profile-hero">
      {/* Banner */}
      <div 
        className="profile-hero-banner" 
        style={{ 
          backgroundImage: profile?.banner_url ? bannerBackground : 'none',
          background: !profile?.banner_url ? bannerBackground : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
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
            background: 'rgba(15, 15, 22, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            width: '290px',
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
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Theme Accent</div>
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

          {/* Banner selection presets */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Banner Presets</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {Object.entries(BANNER_GRADIENTS).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleBannerPresetChange(key)}
                  style={{
                    background: (bannerPreset === key && !customBannerUrl) ? 'rgba(255, 159, 28, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: (bannerPreset === key && !customBannerUrl) ? '1px solid var(--theme-accent, #ff9f1c)' : '1px solid rgba(255,255,255,0.05)',
                    color: (bannerPreset === key && !customBannerUrl) ? 'var(--theme-accent, #ff9f1c)' : '#aaa',
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

          {/* Custom Banner Image URL */}
          <div>
            <div style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Custom Banner Image URL</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="https://example.com/banner.png"
                value={customBannerUrl}
                onChange={(e) => setCustomBannerUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '11px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleCustomBannerSave}
                style={{
                  background: 'var(--theme-accent, #ff9f1c)',
                  border: 'none',
                  color: '#000',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Body Info (Avatar, Name, Bio, Stats, Actions Layout Reworked) */}
      <div className="profile-hero-body">
        {/* Top Row: Avatar on left, Follow/Actions on right */}
        <div className="profile-hero-top-row">
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

          {/* Right Action buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {!isOwnProfile && onFollowClick && onUnfollowClick && (
              <button
                onClick={social.is_following ? onUnfollowClick : onFollowClick}
                style={{
                  background: social.is_following ? 'rgba(255,255,255,0.05)' : 'var(--theme-accent, #ff9f1c)',
                  border: social.is_following ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  color: social.is_following ? '#fff' : '#000',
                  padding: '10px 24px',
                  borderRadius: '30px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Users size={14} />
                <span>{social.is_following ? 'Following' : 'Follow'}</span>
              </button>
            )}
            
            {isOwnProfile && onLogout && (
              <button
                onClick={onLogout}
                className="btn-signout"
                style={{ alignSelf: 'center' }}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Lower Row: Profile Name, Bio, Stats details sits clearly in background card */}
        <div style={{ width: '100%' }}>
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

            {/* Admin/Premium Badges */}
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

          {/* Bio text */}
          <div style={{ marginTop: '8px', maxWidth: '650px' }}>
            {isEditingBio ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  placeholder="Tell us about your music taste..."
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

          {/* Details & Social Stats row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '20px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px' }}>
            
            {/* Meta details */}
            <div style={{ display: 'flex', gap: '16px', color: '#666', fontSize: '12px', flexWrap: 'wrap' }}>
              {profile?.discord_username && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5865F2' }} />
                  Discord: @{profile.discord_username}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} />
                Joined: {formattedDate}
              </span>
            </div>

            {/* Clickable Social Followers count and standard badges */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Followers counts */}
              <button
                onClick={onOpenSocialModal}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <Users size={12} color="var(--theme-accent, #ff9f1c)" />
                <span>{social.followers_count} Followers</span>
                <span style={{ color: '#555' }}>•</span>
                <span>{social.following_count} Following</span>
              </button>

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
    </div>
  );
}
