'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Check, X, Sparkles, Share2, Smartphone, Square, Radio, Disc } from 'lucide-react';
import { drawQrCode } from '@/utils/qrGenerator';
import { extractColors } from '@/utils/colorExtractor';

export default function JamCardModal({
  isOpen,
  onClose,
  room,
  nowPlaying,
  listenerCount = 1,
  triggerToast = () => {},
}) {
  const [format, setFormat] = useState('story'); // 'story' (9:16) or 'square' (1:1)
  const [isRendering, setIsRendering] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const canvasRef = useRef(null);
  const previewImgRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const roomId = room?.id || 'openjam';
  const roomName = room?.name || 'OpenJam Listening Room';
  const trackName = nowPlaying?.track_name || 'Chill Vibes & Deep Grooves';
  const artist = nowPlaying?.artist || 'OpenJam Collective';
  const albumArtUrl = nowPlaying?.album_art_url || '';

  // Render the Jam Card whenever inputs or format changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const renderCard = async () => {
      setIsRendering(true);

      const canvas = canvasRef.current || document.createElement('canvas');
      const isStory = format === 'story';
      const width = 1080;
      const height = isStory ? 1920 : 1080;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Extract colors for dynamic gradient glow
      let primaryGlow = '#ff9f1c';
      let secondaryGlow = '#2ec4b6';
      if (albumArtUrl) {
        try {
          const colors = await extractColors(albumArtUrl);
          if (colors?.primary) primaryGlow = colors.primary;
          if (colors?.secondary) secondaryGlow = colors.secondary;
        } catch (e) {
          // Fallback to default neon colors
        }
      }

      // 1. Deep Obsidian Backdrop
      ctx.fillStyle = '#0a0c14';
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient Radial Glow Blobs
      const rad1 = ctx.createRadialGradient(width * 0.5, height * 0.35, 50, width * 0.5, height * 0.35, width * 0.65);
      rad1.addColorStop(0, `${primaryGlow}55`); // 33% opacity
      rad1.addColorStop(0.6, `${secondaryGlow}22`);
      rad1.addColorStop(1, 'transparent');
      ctx.fillStyle = rad1;
      ctx.fillRect(0, 0, width, height);

      const rad2 = ctx.createRadialGradient(width * 0.2, height * 0.8, 40, width * 0.2, height * 0.8, width * 0.5);
      rad2.addColorStop(0, `${secondaryGlow}40`);
      rad2.addColorStop(1, 'transparent');
      ctx.fillStyle = rad2;
      ctx.fillRect(0, 0, width, height);

      // 3. Load Artwork with Zero-Taint Strategy (crossOrigin -> proxy -> vector fallback)
      let artImage = null;
      if (albumArtUrl) {
        const loadImg = (src) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          });

        try {
          artImage = await loadImg(albumArtUrl);
        } catch (err) {
          try {
            // Tier 2: Backend Proxy Fallback
            const proxySrc = `/api/proxy/image?url=${encodeURIComponent(albumArtUrl)}`;
            artImage = await loadImg(proxySrc);
          } catch (proxyErr) {
            artImage = null;
          }
        }
      }

      // 4. Draw Stylized Vinyl Record & Album Artwork
      const centerX = width / 2;
      const centerY = isStory ? height * 0.38 : height * 0.44;
      const vinylRadius = isStory ? 340 : 250;
      const coverSize = isStory ? 380 : 280;

      // Draw Vinyl Outer Disc & Metallic Grooves
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 60;
      ctx.beginPath();
      ctx.arc(centerX, centerY, vinylRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#11131a';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Concentric Vinyl Grooves
      for (let r = coverSize / 2 + 20; r < vinylRadius - 10; r += 16) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Vinyl Metallic Sheen Reflection
      const sheenGrad = ctx.createLinearGradient(centerX - vinylRadius, centerY - vinylRadius, centerX + vinylRadius, centerY + vinylRadius);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      sheenGrad.addColorStop(0.5, 'transparent');
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
      ctx.fillStyle = sheenGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, vinylRadius, 0, Math.PI * 2);
      ctx.fill();

      // Center Artwork with Rounded Corners
      const coverX = centerX - coverSize / 2;
      const coverY = centerY - coverSize / 2;
      const coverRadius = 24;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
      } else {
        ctx.rect(coverX, coverY, coverSize, coverSize);
      }
      ctx.clip();

      if (artImage) {
        ctx.drawImage(artImage, coverX, coverY, coverSize, coverSize);
      } else {
        // Procedural Vector Album Fallback
        const artGrad = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
        artGrad.addColorStop(0, '#1e2230');
        artGrad.addColorStop(1, '#0e1018');
        ctx.fillStyle = artGrad;
        ctx.fillRect(coverX, coverY, coverSize, coverSize);

        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
        ctx.fill();
      }

      // Artwork Inner Shadow and Glass Sheen
      ctx.restore();

      // 5. Live Badges (Header / Top Status)
      const topBadgeY = isStory ? 140 : 80;

      // "LIVE ON OPENJAM" Pill
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      const pillW = 340;
      const pillH = 56;
      const pillX = centerX - pillW / 2;
      const pillY = topBadgeY;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(pillX, pillY, pillW, pillH, 28);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      // Green Live Dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pillX + 36, pillY + pillH / 2, 7, 0, Math.PI * 2);
      ctx.fill();

      // Live Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('LIVE ON OPENJAM', pillX + 54, pillY + 35);
      ctx.restore();

      // 6. Track Title & Artist Metadata
      const metaStartY = isStory ? height * 0.63 : height * 0.74;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 48px system-ui, -apple-system, sans-serif';
      // Truncate track name if too long
      const displayTitle = trackName.length > 28 ? trackName.slice(0, 26) + '…' : trackName;
      ctx.fillText(displayTitle, centerX, metaStartY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '600 30px system-ui, -apple-system, sans-serif';
      const displayArtist = artist.length > 34 ? artist.slice(0, 32) + '…' : artist;
      ctx.fillText(displayArtist, centerX, metaStartY + 50);

      // Room Name & Listener Count
      ctx.fillStyle = primaryGlow;
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      const displayRoom = `📻 ${roomName} • 👥 ${listenerCount} Jamming`;
      ctx.fillText(displayRoom, centerX, metaStartY + 96);

      // 7. Auto-Generated QR Code Box (Bottom Container)
      const qrSize = isStory ? 180 : 130;
      const qrBoxY = isStory ? height * 0.76 : height * 0.86;
      const qrBoxX = centerX - qrSize / 2;
      const inviteUrl = `https://www.openjam.fun/room/${roomId}`;

      drawQrCode(ctx, inviteUrl, qrBoxX, qrBoxY, qrSize, {
        bgColor: '#ffffff',
        fgColor: '#0a0c14',
        margin: 2,
        borderRadius: 16,
      });

      // 8. Brand Footer
      if (isStory) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '600 22px system-ui, -apple-system, sans-serif';
        ctx.fillText('Scan to join room • openjam.fun', centerX, height - 90);
      }

      if (isMounted) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          setPreviewUrl(dataUrl);
        } catch (e) {
          console.error('Failed to generate preview data URL:', e);
        }
        setIsRendering(false);
      }
    };

    renderCard();

    return () => {
      isMounted = false;
    };
  }, [isOpen, format, roomId, roomName, trackName, artist, albumArtUrl, listenerCount]);

  // 1-Click PNG Download
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        triggerToast('Failed to generate image file', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openjam-${roomId}-${format}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Jam Card downloaded successfully!', 'success');
    }, 'image/png');
  };

  // 1-Click Copy Image to Clipboard (Clipboard API)
  const handleCopyClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) {
        triggerToast('Failed to create clipboard image', 'error');
        return;
      }

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 3000);
          triggerToast('Jam Card copied to clipboard! Paste into Discord, Twitter, or Instagram.', 'success');
        } catch (err) {
          console.warn('Clipboard write permission denied, falling back to download:', err);
          handleDownloadPng();
        }
      } else {
        handleDownloadPng();
      }
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(6, 8, 14, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '560px',
            background: 'linear-gradient(180deg, #161824 0%, #0d0f18 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 159, 28, 0.12)',
            padding: '24px 28px',
            color: '#ffffff',
            fontFamily: 'var(--font-display-next), Outfit, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255, 159, 28, 0.15)',
                  border: '1px solid rgba(255, 159, 28, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ff9f1c',
                }}
              >
                <Share2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Export Shareable Jam Card</h3>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
                  Share real-time room vibes directly to socials
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Format Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '20px',
              gap: '6px',
            }}
          >
            <button
              onClick={() => setFormat('story')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: format === 'story' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: format === 'story' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <Smartphone size={16} /> 9:16 Story (Instagram / TikTok)
            </button>
            <button
              onClick={() => setFormat('square')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: format === 'square' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: format === 'square' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <Square size={16} /> 1:1 Square (Twitter / Feed)
            </button>
          </div>

          {/* Live Card Preview Area */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#07080d',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '16px',
              marginBottom: '20px',
              minHeight: '260px',
              maxHeight: '340px',
              overflow: 'hidden',
            }}
          >
            {previewUrl ? (
              <img
                ref={previewImgRef}
                src={previewUrl}
                alt="Jam Card Preview"
                style={{
                  maxHeight: '300px',
                  maxWidth: '100%',
                  borderRadius: '10px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Disc size={20} className="animate-spin" /> Rendering high-res card…
              </div>
            )}
            {/* Offscreen Canvas */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={handleCopyClipboard}
              disabled={isRendering}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
            >
              {isCopied ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
              <span>{isCopied ? 'Copied!' : 'Copy Image'}</span>
            </button>

            <button
              onClick={handleDownloadPng}
              disabled={isRendering}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ff9f1c 0%, #f26419 100%)',
                color: '#0e1018',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px rgba(255, 159, 28, 0.25)',
                transition: 'all 0.2s',
              }}
            >
              <Download size={18} />
              <span>Download PNG</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
