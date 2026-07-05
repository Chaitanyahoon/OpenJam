'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Edit2, Check, X, LogOut, Disc, 
  Heart, ListMusic, Globe, Calendar, KeyRound, Sparkles, PlusCircle, Users, Move, Trash2, Share2
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
    const accent = THEME_COLORS[theme]?.color || '#ff9f1c';
    return `linear-gradient(135deg, ${accent}cc 0%, #121216 100%)`;
  }},
  synth: { name: 'Synthwave Neon', style: () => 'linear-gradient(135deg, #ec4899 0%, #7c3aed 50%, #1e1b4b 100%)' },
  cosmic: { name: 'Cosmic Nebula', style: () => 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #0f0b29 100%)' },
  sunset: { name: 'Sunset Glow', style: () => 'linear-gradient(135deg, #f97316 0%, #eab308 50%, #1c0a02 100%)' },
  aurora: { name: 'Northern Lights', style: () => 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #030712 100%)' },
  vinyl: { name: 'Retro Vinyl', style: () => 'linear-gradient(135deg, #1f2937 0%, #111827 50%, #030712 100%)' }
};

const isValidImageUrl = (url) => {
  if (!url) return false;
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return false;
  }
  try {
    new URL(u);
    return true;
  } catch (_) {
    return false;
  }
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
  onOpenSocialModal,
  addToast
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile?.display_name || '');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(profile?.bio || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customBannerUrl, setCustomBannerUrl] = useState(profile?.banner_url || '');
  const [bannerPosition, setBannerPosition] = useState(profile?.banner_position || '50%');
  const [bannerScale, setBannerScale] = useState(profile?.banner_scale || '100%');

  // Discord-style Cropper Modal states
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempPosition, setTempPosition] = useState(50); // 0 to 100
  const [tempScale, setTempScale] = useState(100);       // 100 to 300
  const [isCropperDragging, setIsCropperDragging] = useState(false);
  const [cropperDragStartY, setCropperDragStartY] = useState(0);
  const [cropperDragStartPercent, setCropperDragStartPercent] = useState(50);

  const theme = profile?.profile_theme || 'amber';
  const bannerPreset = profile?.banner_color || 'default';

  const [editedUsername, setEditedUsername] = useState(profile?.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Local settings preview states (for real-time preview before saving)
  const [previewTheme, setPreviewTheme] = useState(theme);
  const [previewBannerPreset, setPreviewBannerPreset] = useState(bannerPreset);
  const [previewBannerUrl, setPreviewBannerUrl] = useState(profile?.banner_url || '');
  const [previewBannerScale, setPreviewBannerScale] = useState(profile?.banner_scale || '100%');
  const [previewBannerPosition, setPreviewBannerPosition] = useState(profile?.banner_position || '50%');

  // Sync local customization states when profile prop changes
  useEffect(() => {
    setEditedName(profile?.display_name || '');
    setEditedBio(profile?.bio || '');
    setCustomBannerUrl(profile?.banner_url || '');
    setBannerPosition(profile?.banner_position || '50%');
    setBannerScale(profile?.banner_scale || '100%');
    setEditedUsername(profile?.username || '');
  }, [profile]);

  // Sync preview states when settings modal is opened
  useEffect(() => {
    if (showSettings) {
      setPreviewTheme(profile?.profile_theme || 'amber');
      setPreviewBannerPreset(profile?.banner_color || 'default');
      setPreviewBannerUrl(profile?.banner_url || '');
      setPreviewBannerScale(profile?.banner_scale || '100%');
      setPreviewBannerPosition(profile?.banner_position || '50%');
      setCustomBannerUrl(profile?.banner_url || '');
    }
  }, [showSettings, profile]);

  // Automatically switch preview to custom image when a valid URL is typed/pasted
  useEffect(() => {
    const url = customBannerUrl.trim();
    if (url && isValidImageUrl(url)) {
      setPreviewBannerPreset('custom');
      setPreviewBannerUrl(url);
    }
  }, [customBannerUrl]);

  // Debounced username checker
  useEffect(() => {
    if (!showSettings) return;
    const q = editedUsername.trim().toLowerCase();
    if (q === (profile?.username || '').toLowerCase()) {
      setUsernameAvailable(null);
      setUsernameError('');
      return;
    }
    if (q.length < 3 || q.length > 20) {
      setUsernameAvailable(false);
      setUsernameError('Must be 3-20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(q)) {
      setUsernameAvailable(false);
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }

    setUsernameError('');
    setIsCheckingUsername(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/check-username?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setUsernameAvailable(data.available);
          if (!data.available) {
            setUsernameError('Username is already taken');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [editedUsername, showSettings, profile]);
  
  // Choose banner style: custom URL or preset gradient
  const bannerBackground = (profile?.banner_url)
    ? `url(${profile.banner_url})` 
    : (BANNER_GRADIENTS[bannerPreset]?.style(theme) || BANNER_GRADIENTS.default.style(theme));

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    await onUpdateProfile({ display_name: editedName.trim(), bio: editedBio, profile_theme: theme, banner_color: bannerPreset, banner_url: profile?.banner_url || null, banner_position: bannerPosition, banner_scale: bannerScale, username: profile?.username || null });
    setIsEditingName(false);
  };

  const handleSaveBio = async () => {
    await onUpdateProfile({ display_name: editedName, bio: editedBio, profile_theme: theme, banner_color: bannerPreset, banner_url: profile?.banner_url || null, banner_position: bannerPosition, banner_scale: bannerScale, username: profile?.username || null });
    setIsEditingBio(false);
  };

  const handleThemeChange = (newTheme) => {
    setPreviewTheme(newTheme);
  };

  const handleBannerPresetChange = (preset) => {
    setPreviewBannerPreset(preset);
    setPreviewBannerUrl('');
    setPreviewBannerPosition('50%');
    setPreviewBannerScale('100%');
    setCustomBannerUrl('');
  };

  const handleSaveUsername = async () => {
    if (usernameError || usernameAvailable === false) return;
    const clean = editedUsername.trim().toLowerCase();
    await onUpdateProfile({
      display_name: editedName,
      bio: editedBio,
      profile_theme: previewTheme,
      banner_color: previewBannerPreset,
      banner_url: previewBannerUrl || null,
      banner_position: previewBannerPosition,
      banner_scale: previewBannerScale,
      username: clean || null
    });
    if (addToast) {
      addToast('Username updated successfully!', 'success');
    }
  };

  const handleCustomBannerSave = () => {
    if (!customBannerUrl.trim()) return;
    
    // Parse existing position/scale if matching the current custom URL
    let initPos = 50;
    let initScale = 100;
    if (profile?.banner_url === customBannerUrl.trim()) {
      initPos = parseInt(profile?.banner_position) || 50;
      initScale = parseInt(profile?.banner_scale) || 100;
    }
    setTempPosition(initPos);
    setTempScale(initScale);
    setShowCropModal(true);
    setShowSettings(false);
  };

  const handleOpenCropperForExisting = () => {
    const url = (previewBannerUrl || customBannerUrl || '').trim();
    if (!url) return;
    
    let initPos = 50;
    let initScale = 100;
    if (previewBannerPosition) {
      initPos = parseInt(previewBannerPosition) || 50;
    }
    if (previewBannerScale) {
      initScale = parseInt(previewBannerScale) || 100;
    }
    
    setTempPosition(initPos);
    setTempScale(initScale);
    setShowCropModal(true);
    setShowSettings(false);
  };

  const handleRemoveBanner = () => {
    setCustomBannerUrl('');
    setPreviewBannerUrl('');
    setPreviewBannerPreset('default');
    setPreviewBannerPosition('50%');
    setPreviewBannerScale('100%');
  };

  // Cropper drag-to-pan start handler
  const handleCropperDragStart = (e) => {
    e.preventDefault();
    setIsCropperDragging(true);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    setCropperDragStartY(clientY);
    setCropperDragStartPercent(tempPosition);
  };

  // Smooth window drag listeners
  useEffect(() => {
    if (!isCropperDragging) return;

    const handleWindowMove = (e) => {
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      const deltaY = clientY - cropperDragStartY;
      const percentDiff = (deltaY / 100) * 100;
      // Subtracting is correct for y background-position dragging logic
      let newPercent = Math.round(cropperDragStartPercent - percentDiff);
      newPercent = Math.max(0, Math.min(100, newPercent));
      setTempPosition(newPercent);
    };

    const handleWindowEnd = () => {
      setIsCropperDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchmove', handleWindowMove);
    window.addEventListener('touchend', handleWindowEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [isCropperDragging, cropperDragStartY, cropperDragStartPercent]);

  const handleCropperReset = () => {
    setTempPosition(50);
    setTempScale(100);
  };

  const handleCropperCancel = () => {
    setShowCropModal(false);
    setShowSettings(true);
  };

  const handleCropperApply = () => {
    setShowCropModal(false);
    setPreviewBannerPreset('custom');
    setPreviewBannerUrl(customBannerUrl.trim() || previewBannerUrl.trim());
    setPreviewBannerPosition(`${tempPosition}%`);
    setPreviewBannerScale(`${tempScale}%`);
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    await onUpdateProfile({
      display_name: editedName,
      bio: editedBio,
      profile_theme: previewTheme,
      banner_color: previewBannerPreset,
      banner_url: previewBannerUrl || null,
      banner_position: previewBannerPosition,
      banner_scale: previewBannerScale,
      username: profile?.username || null
    });
    setShowSettings(false);
    if (addToast) {
      addToast('Profile customization saved successfully!', 'success');
    }
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
          background: bannerBackground,
          backgroundColor: '#18191c',
          backgroundSize: profile?.banner_url ? (bannerScale || 'cover') : 'cover',
          backgroundPosition: `center ${bannerPosition}`,
          backgroundRepeat: 'no-repeat'
        }}
      >
        {isOwnProfile && (
          <button
            onClick={() => setShowSettings(true)}
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

      {/* Centered Customize Profile Modal */}
      {isOwnProfile && showSettings && (
        <div className="profile-modal-backdrop" onClick={handleSaveSettings}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="image-editor-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: `1px solid ${THEME_COLORS[theme]?.color}22`,
              maxWidth: '480px',
              background: '#131316',
              overflow: 'hidden',
            }}
          >
            {/* Full-bleed Banner Preview (no padding, no label) */}
            <div style={{ 
              position: 'relative', 
              width: '100%', 
              height: '140px', 
              overflow: 'hidden',
              cursor: (previewBannerPreset === 'custom' && previewBannerUrl) ? 'pointer' : 'default',
              flexShrink: 0
            }}
              onClick={() => {
                if (previewBannerUrl) {
                  setTempPosition(parseInt(previewBannerPosition) || 50);
                  setTempScale(parseInt(previewBannerScale) || 100);
                  setShowCropModal(true);
                  setShowSettings(false);
                }
              }}
            >
              {/* Banner image or gradient */}
              {(previewBannerUrl) ? (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${previewBannerUrl})`,
                  backgroundSize: previewBannerScale || 'cover',
                  backgroundPosition: `center ${previewBannerPosition || '50%'}`,
                  backgroundRepeat: 'no-repeat',
                  transition: 'all 0.2s ease-out'
                }} />
              ) : (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: BANNER_GRADIENTS[previewBannerPreset]?.style(previewTheme) || BANNER_GRADIENTS.default.style(previewTheme),
                  transition: 'all 0.2s ease-out'
                }} />
              )}
              {/* Bottom vignette */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(19,19,22,0) 50%, rgba(19,19,22,0.95) 100%)'
              }} />
              {/* Close button on top right */}
              <div 
                onClick={(e) => { e.stopPropagation(); handleSaveSettings(); }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.55)'}
              >
                <X size={14} style={{ color: '#ccc' }} />
              </div>
              {/* Avatar + Name overlapping bottom of banner */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <img 
                  src={profile?.avatar_url || "/default-avatar.png"} 
                  alt="" 
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    border: '3px solid #131316',
                    background: '#131316',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                  }} 
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{profile?.display_name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>@{profile?.discord_username || 'user'}</div>
                </div>
              </div>
              {/* Click-to-edit hint for banner */}
              {profile?.banner_url && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  pointerEvents: 'none'
                }}>
                  <Move size={10} />
                  Click to adjust
                </div>
              )}
            </div>

            {/* Body Content */}
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Vanity Username Input */}
              <div>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vanity Username</div>
                <div style={{ display: 'flex', gap: '8px', position: 'relative', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#666', fontSize: '13px', fontWeight: 600 }}>@</span>
                  <input
                    type="text"
                    placeholder="username"
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.03)',
                      border: usernameError ? '1px solid rgba(255,71,87,0.5)' : (usernameAvailable ? '1px solid rgba(46,213,115,0.5)' : '1px solid rgba(255,255,255,0.06)'),
                      borderRadius: '10px',
                      padding: '10px 14px 10px 26px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                  />
                  <button
                    disabled={isCheckingUsername || !!usernameError || usernameAvailable === null || editedUsername.trim().toLowerCase() === (profile?.username || '').toLowerCase()}
                    onClick={handleSaveUsername}
                    style={{
                      background: (isCheckingUsername || !!usernameError || usernameAvailable === null || editedUsername.trim().toLowerCase() === (profile?.username || '').toLowerCase()) ? 'rgba(255,255,255,0.03)' : 'var(--theme-accent, #ff9f1c)',
                      border: 'none',
                      color: (isCheckingUsername || !!usernameError || usernameAvailable === null || editedUsername.trim().toLowerCase() === (profile?.username || '').toLowerCase()) ? '#444' : '#000',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: (isCheckingUsername || !!usernameError || usernameAvailable === null || editedUsername.trim().toLowerCase() === (profile?.username || '').toLowerCase()) ? 'not-allowed' : 'pointer',
                      opacity: (isCheckingUsername || !!usernameError || usernameAvailable === null || editedUsername.trim().toLowerCase() === (profile?.username || '').toLowerCase()) ? 0.5 : 1,
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Save
                  </button>
                </div>
                {isCheckingUsername && (
                  <div style={{ color: '#aaa', fontSize: '10px', marginTop: '6px', fontWeight: 600 }}>Checking availability...</div>
                )}
                {usernameError && (
                  <div style={{ color: '#ff4757', fontSize: '10px', marginTop: '6px', fontWeight: 600 }}>{usernameError}</div>
                )}
                {usernameAvailable && !usernameError && editedUsername.trim().toLowerCase() !== (profile?.username || '').toLowerCase() && (
                  <div style={{ color: '#2ed573', fontSize: '10px', marginTop: '6px', fontWeight: 600 }}>✓ Username is available!</div>
                )}
                <div style={{ color: '#555', fontSize: '10px', marginTop: '6px', lineHeight: 1.3 }}>
                  This creates your personal vanity link: openjam.fun/profile/@{editedUsername || 'username'}
                </div>
              </div>

              {/* Theme Color Selection */}
              <div>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Profile Theme Accent</div>
                <div style={{ display: 'flex', gap: '12px', padding: '4px 0' }}>
                  {Object.entries(THEME_COLORS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleThemeChange(key)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: item.color,
                        border: previewTheme === key ? '3px solid #fff' : '2px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        transform: previewTheme === key ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.2s, border-color 0.2s',
                        boxShadow: previewTheme === key ? `0 0 12px ${item.color}88` : 'none'
                      }}
                      title={item.name}
                    />
                  ))}
                </div>
              </div>

              {/* Banner Preset Selection */}
              <div>
                <div style={{ fontSize: '11px', color: '#666', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preset Banner Gradients</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(BANNER_GRADIENTS).map(([key, item]) => (
                    <button
                      key={key}
                      disabled={!!previewBannerUrl}
                      onClick={() => handleBannerPresetChange(key)}
                      style={{
                        background: item.style(previewTheme),
                        border: (previewBannerPreset === key && !previewBannerUrl) ? '2px solid #fff' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: !!previewBannerUrl ? 'not-allowed' : 'pointer',
                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        opacity: !!previewBannerUrl ? 0.2 : ((previewBannerPreset === key) ? 1 : 0.7),
                        transition: 'all 0.2s',
                        transform: (previewBannerPreset === key && !previewBannerUrl) ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: (previewBannerPreset === key && !previewBannerUrl) ? '0 0 10px rgba(255,255,255,0.2)' : 'none'
                      }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Banner URL Input */}
              {(() => {
                const isUrlInvalid = customBannerUrl.trim().length > 0 && !isValidImageUrl(customBannerUrl);
                return (
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom Banner Image URL</div>
                    <div className="profile-banner-input-row" style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Paste an image or GIF URL..."
                        value={customBannerUrl}
                        onChange={(e) => setCustomBannerUrl(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(255,255,255,0.03)',
                          border: isUrlInvalid ? '1px solid rgba(255,71,87,0.5)' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          color: '#fff',
                          fontSize: '13px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                      />
                      <button
                        disabled={isUrlInvalid || !customBannerUrl.trim()}
                        onClick={handleCustomBannerSave}
                        style={{
                          background: (isUrlInvalid || !customBannerUrl.trim()) ? 'rgba(255,255,255,0.03)' : 'var(--theme-accent, #ff9f1c)',
                          border: 'none',
                          color: (isUrlInvalid || !customBannerUrl.trim()) ? '#444' : '#000',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: (isUrlInvalid || !customBannerUrl.trim()) ? 'not-allowed' : 'pointer',
                          opacity: (isUrlInvalid || !customBannerUrl.trim()) ? 0.5 : 1,
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Apply Image
                      </button>
                    </div>
                    {isUrlInvalid ? (
                      <div style={{ color: '#ff4757', fontSize: '10px', marginTop: '6px', fontWeight: 600 }}>
                        Enter a valid direct image URL (e.g. .png, .jpg, .gif, or from Pinterest/Discord).
                      </div>
                    ) : (
                      <div style={{ color: '#555', fontSize: '10px', marginTop: '6px', lineHeight: 1.3 }}>
                        Supports direct image links (.png, .jpg, .gif, .webp) and animated GIFs.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Adjust/Remove Custom Image - only if banner exists */}
              {(previewBannerUrl || customBannerUrl.trim()) && (
                <div className="profile-banner-actions-row" style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <button
                    onClick={handleOpenCropperForExisting}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff',
                      padding: '8px 0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  >
                    <Move size={13} />
                    Adjust Position
                  </button>
                  <button
                    onClick={handleRemoveBanner}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: '1px solid rgba(255,71,87,0.12)',
                      color: '#ff4757',
                      padding: '8px 0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,71,87,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,71,87,0.25)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'rgba(255,71,87,0.12)'; }}
                  >
                    <Trash2 size={13} />
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveSettings}
                style={{
                  background: 'var(--theme-accent, #ff9f1c)',
                  border: 'none',
                  color: '#000',
                  padding: '8px 28px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 2px 12px rgba(255,159,28,0.2)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,159,28,0.35)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(255,159,28,0.2)'; }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Centered Discord-Style Edit Image Modal */}
      {isOwnProfile && showCropModal && (
        <div className="profile-modal-backdrop">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="image-editor-container"
          >
            <div className="image-editor-header">
              Edit Image
            </div>

            <div className="image-editor-viewport-wrapper">
              {/* Crop Box Frame Overlay */}
              <div className="image-editor-crop-viewport" />
              
              {/* Draggable preview background */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '440px',
                  height: '100px',
                  backgroundImage: `url(${customBannerUrl})`,
                  backgroundSize: `${tempScale}%`,
                  backgroundPosition: `center ${tempPosition}%`,
                  backgroundRepeat: 'no-repeat',
                  backgroundColor: '#18191c',
                  cursor: isCropperDragging ? 'grabbing' : 'grab',
                  borderRadius: '4px',
                  zIndex: 5
                }}
                onMouseDown={handleCropperDragStart}
                onTouchStart={handleCropperDragStart}
              />
            </div>

            <div className="image-editor-controls">
              <div className="image-editor-zoom-bar">
                <span style={{ fontSize: '12px', color: '#888' }}>Zoom</span>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={tempScale}
                  onChange={(e) => setTempScale(parseInt(e.target.value))}
                  className="image-editor-zoom-slider"
                />
                <span style={{ fontSize: '11px', color: 'var(--theme-accent, #ff9f1c)', fontWeight: 800, minWidth: '32px' }}>
                  {tempScale}%
                </span>
              </div>
            </div>

            <div className="image-editor-footer">
              <button
                onClick={handleCropperReset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'underline'
                }}
              >
                Reset
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCropperCancel}
                  className="image-editor-btn-cancel"
                  style={{
                    border: 'none',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropperApply}
                  className="image-editor-btn-apply"
                  style={{
                    border: 'none',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </div>
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
            <button
              onClick={() => {
                const link = profile?.username 
                  ? `${window.location.origin}/profile/@${profile.username}` 
                  : `${window.location.origin}/profile/${profile?.id}`;
                navigator.clipboard.writeText(link);
                if (addToast) {
                  addToast('Profile link copied to clipboard!', 'success');
                } else {
                  alert('Profile link copied to clipboard!');
                }
              }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '30px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.2s, border-color 0.2s',
                alignSelf: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              <Share2 size={14} />
              Share
            </button>

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
        <div className="profile-hero-info-container" style={{ width: '100%' }}>
          <div className="profile-hero-name-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    maxLength={50}
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
                  <span style={{ fontSize: '10px', color: '#555', alignSelf: 'flex-end', fontWeight: 600, marginRight: '4px' }}>
                    {editedName.length}/50
                  </span>
                </div>
                <button onClick={handleSaveName} style={{ background: 'none', border: 'none', color: '#2ed573', cursor: 'pointer', alignSelf: 'center' }}>
                  <Check size={20} />
                </button>
                <button onClick={() => { setIsEditingName(false); setEditedName(profile?.display_name || ''); }} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', alignSelf: 'center' }}>
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
          <div className="profile-hero-bio" style={{ marginTop: '8px', maxWidth: '650px', width: '100%' }}>
            {isEditingBio ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
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
                <span style={{ fontSize: '10px', color: '#555', alignSelf: 'flex-start', marginLeft: '4px', fontWeight: 600 }}>
                  {editedBio.length}/200
                </span>
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
          <div className="profile-hero-meta-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '20px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px', width: '100%' }}>
            
            {/* Meta details */}
            <div className="profile-hero-details-list" style={{ display: 'flex', gap: '16px', color: '#666', fontSize: '12px', flexWrap: 'wrap' }}>
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

            {/* Clickable Social Followers count and standard stats list */}
            <div className={`profile-hero-social-list ${roomsHostedCount > 0 ? 'has-hosted' : ''}`} style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={onOpenSocialModal}
                className="profile-hero-stat-btn"
                title="View Followers"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '4px 8px',
                  transition: 'opacity 0.2s'
                }}
              >
                <span className="profile-hero-stat-value" style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{social.followers_count}</span>
                <span className="profile-hero-stat-label" style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Followers</span>
              </button>

              <button
                onClick={onOpenSocialModal}
                className="profile-hero-stat-btn"
                title="View Following"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '4px 8px',
                  transition: 'opacity 0.2s'
                }}
              >
                <span className="profile-hero-stat-value" style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{social.following_count}</span>
                <span className="profile-hero-stat-label" style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Following</span>
              </button>

              <div className="profile-hero-stat-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 8px' }}>
                <span className="profile-hero-stat-value" style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{likesCount}</span>
                <span className="profile-hero-stat-label" style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Likes</span>
              </div>

              <div className="profile-hero-stat-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 8px' }}>
                <span className="profile-hero-stat-value" style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{playlistsCount}</span>
                <span className="profile-hero-stat-label" style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Playlists</span>
              </div>

              {roomsHostedCount > 0 && (
                <div className="profile-hero-stat-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 8px' }}>
                  <span className="profile-hero-stat-value" style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{roomsHostedCount}</span>
                  <span className="profile-hero-stat-label" style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Hosted</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
