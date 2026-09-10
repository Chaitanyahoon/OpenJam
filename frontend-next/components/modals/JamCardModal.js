'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Check, X, Share2, Smartphone, Square, Disc, Link2 } from 'lucide-react';
import { drawQrCode } from '@/utils/qrGenerator';
import { extractColors } from '@/utils/colorExtractor';

// SVG Brand Icons for WhatsApp & Instagram
const WhatsAppIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.477-.15-.678.15-.2.301-.778.98-.954 1.18-.175.2-.351.226-.652.076-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.784-1.676-2.085-.175-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.176.201-.301.301-.502.101-.2.05-.376-.025-.526-.075-.15-.678-1.635-.929-2.241-.244-.59-.492-.51-.678-.52l-.578-.01c-.2 0-.527.075-.803.376s-1.054 1.03-1.054 2.51 1.079 2.912 1.23 3.113c.15.2 2.123 3.242 5.143 4.545.718.31 1.279.495 1.716.634.721.23 1.377.197 1.896.12.578-.087 1.78-.728 2.031-1.431.251-.703.251-1.305.176-1.431-.076-.125-.276-.2-.577-.35z" />
    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.05 21.95l4.908-1.353A9.957 9.957 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.63 0-3.15-.49-4.42-1.33l-.32-.21-2.92.8.81-2.84-.23-.33A8.17 8.17 0 0 1 3.8 12c0-4.52 3.68-8.2 8.2-8.2s8.2 3.68 8.2 8.2-3.68 8.2-8.2 8.2z" />
  </svg>
);

const InstagramIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

// Formats long track titles into balanced lines for high-impact display
function formatTrackTitle(title) {
  if (!title) return { line1: 'Chill Vibes &', line2: 'Deep Grooves' };

  if (title.includes(' & ')) {
    const parts = title.split(' & ');
    return { line1: parts[0].trim() + ' &', line2: parts.slice(1).join(' & ').trim() };
  }
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    return { line1: parts[0].trim(), line2: parts.slice(1).join(' - ').trim() };
  }

  const words = title.split(' ');
  if (words.length >= 4 || title.length > 24) {
    const mid = Math.ceil(words.length / 2);
    return {
      line1: words.slice(0, mid).join(' '),
      line2: words.slice(mid).join(' ')
    };
  }

  return { line1: title, line2: '' };
}

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
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const canvasRef = useRef(null);
  const previewImgRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const roomId = room?.id || 'openjam';
  const roomName = room?.name || 'Analog Space #53';
  const trackName = nowPlaying?.track_name || nowPlaying?.title || 'Chill Vibes & Deep Grooves';
  const artist = nowPlaying?.artist || 'OpenJam Collective';
  const albumArtUrl = nowPlaying?.album_art_url || nowPlaying?.cover || nowPlaying?.thumbnail || '';
  const currentListeners = listenerCount || room?.listener_count || 1;
  const inviteUrl = `https://www.openjam.fun/room/${roomId}`;

  // Render the high-fidelity Jam Card canvas
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const renderCard = async () => {
      setIsRendering(true);

      // Ensure custom fonts are ready before drawing to canvas
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await document.fonts.ready;
        } catch (e) {
          // Continue if font API fails
        }
      }

      const canvas = canvasRef.current || document.createElement('canvas');
      const isStory = format === 'story';
      const width = 1080;
      const height = isStory ? 1920 : 1080;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // ── Color Extraction ─────────────────────────────────────────
      let primaryGlow = '#ff9f1c'; // Warm Honey Amber
      let secondaryGlow = '#00e5ff'; // Electric Cyan / Mint
      if (albumArtUrl) {
        try {
          const colors = await extractColors(albumArtUrl);
          if (Array.isArray(colors) && colors.length > 0) {
            primaryGlow = colors[0] || '#ff9f1c';
            secondaryGlow = colors[1] || '#00e5ff';
          } else if (colors?.primary) {
            primaryGlow = colors.primary;
            secondaryGlow = colors.secondary || '#00e5ff';
          }
        } catch (e) {
          // Safe fallback
        }
      }

      // ── Layer 1: Cosmic Background Void ──────────────────────────
      ctx.fillStyle = '#060810';
      ctx.fillRect(0, 0, width, height);

      // Top-Left Warm Nebula
      const radTL = ctx.createRadialGradient(
        width * 0.15,
        isStory ? height * 0.16 : height * 0.12,
        40,
        width * 0.15,
        isStory ? height * 0.16 : height * 0.12,
        width * 0.6
      );
      radTL.addColorStop(0, '#ff6b0035');
      radTL.addColorStop(0.5, '#ff9f1c16');
      radTL.addColorStop(1, 'transparent');
      ctx.fillStyle = radTL;
      ctx.fillRect(0, 0, width, height);

      // Top-Right Orange Nebula
      const radTR = ctx.createRadialGradient(
        width * 0.88,
        isStory ? height * 0.1 : height * 0.08,
        30,
        width * 0.88,
        isStory ? height * 0.1 : height * 0.08,
        width * 0.45
      );
      radTR.addColorStop(0, '#ff450030');
      radTR.addColorStop(0.5, '#f2641914');
      radTR.addColorStop(1, 'transparent');
      ctx.fillStyle = radTR;
      ctx.fillRect(0, 0, width, height);

      // Mid-Right Electric Cyan Nebula
      const radMR = ctx.createRadialGradient(
        width * 0.9,
        isStory ? height * 0.45 : height * 0.42,
        40,
        width * 0.9,
        isStory ? height * 0.45 : height * 0.42,
        width * 0.52
      );
      radMR.addColorStop(0, '#00e5ff28');
      radMR.addColorStop(0.5, '#2ec4b614');
      radMR.addColorStop(1, 'transparent');
      ctx.fillStyle = radMR;
      ctx.fillRect(0, 0, width, height);

      // Bottom-Left Cyan/Mint Nebula
      const radBL = ctx.createRadialGradient(
        width * 0.12,
        isStory ? height * 0.86 : height * 0.82,
        40,
        width * 0.12,
        isStory ? height * 0.86 : height * 0.82,
        width * 0.48
      );
      radBL.addColorStop(0, '#00c9a724');
      radBL.addColorStop(0.5, '#00e5ff12');
      radBL.addColorStop(1, 'transparent');
      ctx.fillStyle = radBL;
      ctx.fillRect(0, 0, width, height);

      // ── Layer 2: Floating Rounded Glass Card Container ───────────
      const cardMarginX = isStory ? 48 : 36;
      const cardMarginY = isStory ? 56 : 36;
      const cardW = width - cardMarginX * 2;
      const cardH = height - cardMarginY * 2;
      const cardRadius = isStory ? 44 : 36;

      ctx.save();
      // Drop Shadow for Card Depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 24;

      // Card Background Gradient
      const cardGrad = ctx.createLinearGradient(0, cardMarginY, 0, cardMarginY + cardH);
      cardGrad.addColorStop(0, 'rgba(16, 20, 32, 0.82)');
      cardGrad.addColorStop(1, 'rgba(8, 10, 18, 0.92)');
      ctx.fillStyle = cardGrad;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardMarginX, cardMarginY, cardW, cardH, cardRadius);
      } else {
        ctx.rect(cardMarginX, cardMarginY, cardW, cardH);
      }
      ctx.fill();
      ctx.restore();

      // Card Ambient Gradient Rim Lighting (2px border)
      ctx.save();
      const rimGrad = ctx.createLinearGradient(cardMarginX, cardMarginY, cardMarginX + cardW, cardMarginY + cardH);
      rimGrad.addColorStop(0, 'rgba(255, 170, 80, 0.45)'); // Top-left amber glow
      rimGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.22)');
      rimGrad.addColorStop(0.65, 'rgba(0, 229, 255, 0.38)'); // Mid-right cyan glow
      rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cardMarginX, cardMarginY, cardW, cardH, cardRadius);
      } else {
        ctx.rect(cardMarginX, cardMarginY, cardW, cardH);
      }
      ctx.stroke();
      ctx.restore();

      // ── Layer 3: Top Header Bar ──────────────────────────────────
      const headerY = cardMarginY + (isStory ? 60 : 44);

      // Left: OpenJam Concentric Rings Icon
      const iconCenterX = cardMarginX + 64;
      const iconCenterY = headerY + 28;

      ctx.save();
      const iconGrad = ctx.createLinearGradient(iconCenterX - 24, iconCenterY, iconCenterX + 24, iconCenterY);
      iconGrad.addColorStop(0, '#ff9f1c');
      iconGrad.addColorStop(1, '#ff5400');

      // Inner dot
      ctx.fillStyle = iconGrad;
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Middle soundwave arc
      ctx.strokeStyle = iconGrad;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY, 15, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();

      // Outer soundwave arc
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY, 23, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();
      ctx.restore();

      // Brand Title
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 36px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('OpenJam', iconCenterX + 38, iconCenterY + 5);

      // Brand Tagline
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.font = '500 19px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('People. Music. Same Vibe.', iconCenterX + 38, iconCenterY + 34);
      ctx.restore();

      // Right: "● LIVE NOW" Pill Badge
      const pillW = 164;
      const pillH = 44;
      const pillX = cardMarginX + cardW - pillW - 44;
      const pillY = headerY + 6;

      ctx.save();
      ctx.fillStyle = 'rgba(16, 26, 24, 0.75)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(pillX, pillY, pillW, pillH, 22);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      // Glowing Green Indicator Dot
      const dotX = pillX + 24;
      const dotY = pillY + 22;

      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // "LIVE NOW" Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('LIVE NOW', dotX + 16, dotY + 6);
      ctx.restore();

      // ── Layer 4: Load Artwork (Zero-Taint Strategy) ──────────────
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
            const proxySrc = `/api/proxy/image?url=${encodeURIComponent(albumArtUrl)}`;
            artImage = await loadImg(proxySrc);
          } catch (proxyErr) {
            artImage = null;
          }
        }
      }

      // ── Layer 5: Hero Vinyl Record with Dual Glow Aura ───────────
      const centerX = width / 2;
      const centerY = isStory ? cardMarginY + 540 : height * 0.42;
      const vinylRadius = isStory ? 275 : 205;
      const coverSize = isStory ? 270 : 200;

      // 1. Dual Ambient Halo behind the record
      // Left Crescent Aura (Warm Amber)
      ctx.save();
      ctx.beginPath();
      ctx.rect(cardMarginX, centerY - vinylRadius - 120, centerX - cardMarginX, (vinylRadius + 120) * 2);
      ctx.clip();
      const leftAura = ctx.createRadialGradient(centerX - 20, centerY, coverSize * 0.35, centerX - 20, centerY, vinylRadius + 85);
      leftAura.addColorStop(0, `${primaryGlow}bb`);
      leftAura.addColorStop(0.55, `${primaryGlow}38`);
      leftAura.addColorStop(1, 'transparent');
      ctx.fillStyle = leftAura;
      ctx.beginPath();
      ctx.arc(centerX - 20, centerY, vinylRadius + 85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right Crescent Aura (Electric Cyan)
      ctx.save();
      ctx.beginPath();
      ctx.rect(centerX, centerY - vinylRadius - 120, cardMarginX + cardW - centerX, (vinylRadius + 120) * 2);
      ctx.clip();
      const rightAura = ctx.createRadialGradient(centerX + 20, centerY, coverSize * 0.35, centerX + 20, centerY, vinylRadius + 85);
      rightAura.addColorStop(0, `${secondaryGlow}bb`);
      rightAura.addColorStop(0.55, `${secondaryGlow}38`);
      rightAura.addColorStop(1, 'transparent');
      ctx.fillStyle = rightAura;
      ctx.beginPath();
      ctx.arc(centerX + 20, centerY, vinylRadius + 85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Vinyl Outer Disc
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 55;
      ctx.shadowOffsetY = 16;
      ctx.beginPath();
      ctx.arc(centerX, centerY, vinylRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0e1017';
      ctx.fill();
      ctx.restore();

      // 3. Realistic Concentric Grooves
      for (let r = coverSize / 2 + 14; r < vinylRadius - 8; r += 12) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.038)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 4. Specular Diagonal Light Reflection Sheen
      ctx.save();
      const sheen = ctx.createLinearGradient(
        centerX - vinylRadius,
        centerY - vinylRadius,
        centerX + vinylRadius,
        centerY + vinylRadius
      );
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
      sheen.addColorStop(0.35, 'transparent');
      sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      sheen.addColorStop(0.65, 'transparent');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(centerX, centerY, vinylRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 5. Center Album Artwork with Rounded Corners
      const coverX = centerX - coverSize / 2;
      const coverY = centerY - coverSize / 2;
      const coverRadius = 26;

      ctx.save();
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
        // Procedural Artwork Gradient
        const artGrad = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
        artGrad.addColorStop(0, '#1c1f2d');
        artGrad.addColorStop(1, '#0b0d14');
        ctx.fillStyle = artGrad;
        ctx.fillRect(coverX, coverY, coverSize, coverSize);
      }
      ctx.restore();

      // Subtle Outer Stroke on Artwork
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
      } else {
        ctx.rect(coverX, coverY, coverSize, coverSize);
      }
      ctx.stroke();
      ctx.restore();

      // Center Spindle Label & Hole
      ctx.save();
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
      ctx.fill();

      // Center spindle center dark hole
      ctx.fillStyle = '#060810';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // ── Layer 6: Playful Handwritten Chalk Annotation ────────────
      if (isStory) {
        ctx.save();
        const handX = centerX + vinylRadius * 0.72;
        const handY = centerY - vinylRadius * 0.65;
        ctx.translate(handX, handY);
        ctx.rotate(-0.13); // -7.5 degrees

        ctx.fillStyle = '#7ce8ff';
        ctx.font = '700 32px var(--font-hand), "Caveat", "Kalam", "Segoe Print", "Chalkboard", cursive';
        ctx.textAlign = 'left';
        ctx.fillText('Come', 0, 0);
        ctx.fillText('Jam', 4, 34);
        ctx.fillText('With Us!', 0, 68);

        // Fluid Curved Chalk Arrow pointing to the vinyl
        ctx.strokeStyle = '#7ce8ff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(35, 88);
        ctx.bezierCurveTo(45, 125, 20, 155, -22, 168);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(-22, 168);
        ctx.lineTo(-12, 155);
        ctx.moveTo(-22, 168);
        ctx.lineTo(-12, 178);
        ctx.stroke();
        ctx.restore();
      }

      // ── Layer 7: Track Title & Metadata Typography ───────────────
      const titleStartY = isStory ? centerY + vinylRadius + 85 : height * 0.66;
      const { line1, line2 } = formatTrackTitle(trackName);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '800 52px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';

      if (line2) {
        // Line 1 in warm white
        ctx.fillStyle = '#ffffff';
        ctx.fillText(line1, centerX, titleStartY);

        // Line 2 in vibrant peach-to-cyan gradient
        const textGrad = ctx.createLinearGradient(centerX - 240, titleStartY + 64, centerX + 240, titleStartY + 64);
        textGrad.addColorStop(0, '#fbb040');
        textGrad.addColorStop(1, '#00f2fe');
        ctx.fillStyle = textGrad;
        ctx.fillText(line2, centerX, titleStartY + 64);
      } else {
        const textGrad = ctx.createLinearGradient(centerX - 220, titleStartY, centerX + 220, titleStartY);
        textGrad.addColorStop(0, '#ffffff');
        textGrad.addColorStop(1, '#00f2fe');
        ctx.fillStyle = textGrad;
        ctx.fillText(line1, centerX, titleStartY);
      }

      // Artist Subtitle
      const artistY = titleStartY + (line2 ? 118 : 64);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '600 28px "Plus Jakarta Sans", system-ui, sans-serif';
      const displayArtist = artist.length > 38 ? artist.slice(0, 36) + '…' : artist;
      ctx.fillText(displayArtist, centerX, artistY);
      ctx.restore();

      // ── Layer 8: Badges Row & Audio Visualizer ────────────────────
      const badgesY = artistY + 54;

      // 1. Room Name Pill
      ctx.save();
      ctx.font = '700 20px "Plus Jakarta Sans", system-ui, sans-serif';
      const roomText = `📻 ${roomName.length > 22 ? roomName.slice(0, 20) + '…' : roomName}`;
      const roomTextW = ctx.measureText(roomText).width;
      const roomPillW = roomTextW + 36;
      const roomPillH = 46;

      // 2. Listeners Pill
      const listenersText = `👥 ${currentListeners} Jamming`;
      const listenersTextW = ctx.measureText(listenersText).width;
      const listenersPillW = listenersTextW + 36;
      const listenersPillH = 46;

      // Visualizer width: 4 bars * 5px + 3 gaps * 5px = 35px
      const visualizerW = 35;
      const badgesGap = 16;
      const totalRowW = roomPillW + badgesGap + listenersPillW + badgesGap + visualizerW;
      const rowStartX = centerX - totalRowW / 2;

      // Draw Room Pill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(rowStartX, badgesY - roomPillH / 2, roomPillW, roomPillH, 23);
      } else {
        ctx.rect(rowStartX, badgesY - roomPillH / 2, roomPillW, roomPillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(roomText, rowStartX + roomPillW / 2, badgesY + 7);

      // Draw Listeners Pill
      const listenersX = rowStartX + roomPillW + badgesGap;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(listenersX, badgesY - listenersPillH / 2, listenersPillW, listenersPillH, 23);
      } else {
        ctx.rect(listenersX, badgesY - listenersPillH / 2, listenersPillW, listenersPillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(listenersText, listenersX + listenersPillW / 2, badgesY + 7);

      // Draw 4 Equalizer Bars
      const vizStartX = listenersX + listenersPillW + badgesGap;
      const barHeights = [18, 32, 42, 24];
      ctx.fillStyle = '#7ce8ff';
      barHeights.forEach((bH, idx) => {
        const bx = vizStartX + idx * 10;
        const by = badgesY - bH / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, 5, bH, 2.5);
        } else {
          ctx.rect(bx, by, 5, bH);
        }
        ctx.fill();
      });
      ctx.restore();

      // ── Layer 9: Scan to Join Container Card ─────────────────────
      const boxW = isStory ? 760 : 700;
      const boxH = isStory ? 210 : 180;
      const boxX = centerX - boxW / 2;
      const boxY = isStory ? height * 0.655 : height * 0.77;
      const boxRadius = 26;

      ctx.save();
      // Translucent Box Container
      ctx.fillStyle = 'rgba(16, 20, 32, 0.72)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, boxRadius);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      // Left: Rounded White QR Code
      const qrSize = isStory ? 154 : 130;
      const qrX = boxX + 28;
      const qrY = boxY + (boxH - qrSize) / 2;

      drawQrCode(ctx, inviteUrl, qrX, qrY, qrSize, {
        bgColor: '#ffffff',
        fgColor: '#0a0c14',
        margin: 2,
        borderRadius: 18,
      });

      // Vertical Dividing Line
      const divX = qrX + qrSize + 28;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(divX, boxY + 28);
      ctx.lineTo(divX, boxY + boxH - 28);
      ctx.stroke();

      // Right Text Column
      const textX = divX + 32;

      // SCAN TO JOIN ROOM
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '700 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SCAN TO JOIN ROOM', textX, boxY + 62);

      // openjam.fun (Glowing Brand Domain)
      ctx.fillStyle = '#ff9f1c';
      ctx.font = '800 42px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('openjam.fun', textX, boxY + 115);

      // No account needed • Just vibes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '500 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('No account needed • Just vibes', textX, boxY + 155);
      ctx.restore();

      // ── Layer 10: Quick Share Action Icons Row (Canvas) ──────────
      if (isStory) {
        const actionsY = height * 0.825;
        const btnRadius = 38;
        const btnSpacing = 175;
        const startX = centerX - btnSpacing * 1.5;

        const actions = [
          { label: 'Copy Link', type: 'link' },
          { label: 'WhatsApp', type: 'whatsapp' },
          { label: 'Share', type: 'share' },
          { label: 'Instagram', type: 'instagram' },
        ];

        actions.forEach((act, idx) => {
          const ax = startX + idx * btnSpacing;
          const ay = actionsY;

          // Draw Circular Button
          ctx.save();
          if (act.type === 'whatsapp') {
            ctx.shadowColor = 'rgba(37, 211, 102, 0.4)';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#25D366';
            ctx.beginPath();
            ctx.arc(ax, ay, btnRadius, 0, Math.PI * 2);
            ctx.fill();
          } else if (act.type === 'instagram') {
            ctx.shadowColor = 'rgba(225, 48, 108, 0.4)';
            ctx.shadowBlur = 18;
            const igGrad = ctx.createLinearGradient(ax - btnRadius, ay + btnRadius, ax + btnRadius, ay - btnRadius);
            igGrad.addColorStop(0, '#f09433');
            igGrad.addColorStop(0.3, '#e6683c');
            igGrad.addColorStop(0.6, '#dc2743');
            igGrad.addColorStop(0.8, '#cc2366');
            igGrad.addColorStop(1, '#bc1888');
            ctx.fillStyle = igGrad;
            ctx.beginPath();
            ctx.arc(ax, ay, btnRadius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ax, ay, btnRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();

          // Draw Vector Icon Inside Circle
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.fillStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (act.type === 'link') {
            // Chain link icon
            ctx.beginPath();
            ctx.arc(ax - 5, ay - 5, 8, Math.PI * 0.25, Math.PI * 1.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ax + 5, ay + 5, 8, -Math.PI * 0.75, Math.PI * 0.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ax - 4, ay + 4);
            ctx.lineTo(ax + 4, ay - 4);
            ctx.stroke();
          } else if (act.type === 'whatsapp') {
            // WhatsApp speech bubble + phone outline
            ctx.beginPath();
            ctx.arc(ax, ay, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ax - 7, ay + 14);
            ctx.lineTo(ax - 13, ay + 17);
            ctx.lineTo(ax - 11, ay + 11);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ax + 1, ay - 1, 6, 0, Math.PI * 1.3);
            ctx.stroke();
          } else if (act.type === 'share') {
            // Tray box
            ctx.beginPath();
            ctx.moveTo(ax - 13, ay + 4);
            ctx.lineTo(ax - 13, ay + 13);
            ctx.lineTo(ax + 13, ay + 13);
            ctx.lineTo(ax + 13, ay + 4);
            ctx.stroke();
            // Arrow
            ctx.beginPath();
            ctx.moveTo(ax, ay + 7);
            ctx.lineTo(ax, ay - 13);
            ctx.lineTo(ax - 7, ay - 6);
            ctx.moveTo(ax, ay - 13);
            ctx.lineTo(ax + 7, ay - 6);
            ctx.stroke();
          } else if (act.type === 'instagram') {
            // Camera rounded box
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(ax - 13, ay - 13, 26, 26, 7);
            } else {
              ctx.rect(ax - 13, ay - 13, 26, 26);
            }
            ctx.stroke();
            // Lens
            ctx.beginPath();
            ctx.arc(ax, ay, 6, 0, Math.PI * 2);
            ctx.stroke();
            // Flash dot
            ctx.beginPath();
            ctx.arc(ax + 7, ay - 7, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Button Label Below
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(act.label, ax, ay + btnRadius + 28);
          ctx.restore();
        });

        // ── Layer 11: Brand Footer Microcopy ───────────────────────
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '700 15px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MUSIC BRINGS BETTER PEOPLE ♥', centerX, cardMarginY + cardH - 36);
        ctx.restore();
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
  }, [isOpen, format, roomId, roomName, trackName, artist, albumArtUrl, currentListeners]);

  // ── 1-Click PNG Download ────────────────────────────────────────
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

  // ── 1-Click Copy Image to Clipboard ─────────────────────────────
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
          triggerToast('Jam Card copied to clipboard! Paste directly into Discord, Twitter, or Instagram.', 'success');
        } catch (err) {
          console.warn('Clipboard write permission denied, downloading PNG instead:', err);
          handleDownloadPng();
        }
      } else {
        handleDownloadPng();
      }
    }, 'image/png');
  };

  // ── 1-Tap Copy Invite Link ──────────────────────────────────────
  const handleCopyLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 3000);
      triggerToast('Room invite link copied to clipboard!', 'success');
    }
  };

  // ── 1-Tap WhatsApp Share ────────────────────────────────────────
  const handleWhatsAppShare = () => {
    const text = `Come jam with us in ${roomName}! 🎵\nNow Playing: ${trackName} by ${artist}\n\nJoin room: ${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // ── Native System Web Share with PNG file attachment ───────────
  const handleNativeShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `openjam-${roomId}-${format}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${roomName} on OpenJam`,
            text: `Come jam with us on OpenJam! 🎵 ${trackName} by ${artist}`,
            url: inviteUrl,
          });
          triggerToast('Shared successfully!', 'success');
          return;
        } catch (err) {
          if (err.name !== 'AbortError') console.warn('Native share failed:', err);
        }
      } else if (navigator.share) {
        try {
          await navigator.share({
            title: `${roomName} on OpenJam`,
            text: `Come jam with us on OpenJam! 🎵 ${trackName} by ${artist}`,
            url: inviteUrl,
          });
          return;
        } catch (err) {
          if (err.name !== 'AbortError') console.warn(err);
        }
      }
      handleDownloadPng();
    }, 'image/png');
  };

  // ── 1-Tap Instagram Stories (Copy Card to Clipboard) ────────────
  const handleInstagramShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          triggerToast('Jam Card copied! Open Instagram Stories and tap "Paste" to share.', 'success');
          return;
        } catch (e) {
          // Fallback to download
        }
      }
      handleDownloadPng();
      triggerToast('Jam Card downloaded! Ready to upload to Instagram Stories.', 'info');
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
          background: 'rgba(4, 6, 12, 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          overflowY: 'auto',
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
            maxWidth: '520px',
            maxHeight: 'min(94dvh, 780px)',
            overflowY: 'auto',
            margin: 'auto',
            background: 'linear-gradient(180deg, #131622 0%, #090b12 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '28px',
            boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(255, 159, 28, 0.1)',
            padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
            color: '#ffffff',
            fontFamily: 'var(--font-display), var(--font-ui), sans-serif',
            boxSizing: 'border-box',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
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
              background: 'rgba(0, 0, 0, 0.35)',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '16px',
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
              <Smartphone size={16} /> 9:16 Story
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
              <Square size={16} /> 1:1 Square
            </button>
          </div>

          {/* Live Card Preview Area */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle at 50% 30%, #161b2c 0%, #07080f 100%)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '16px',
              marginBottom: '16px',
              minHeight: '220px',
              maxHeight: 'min(440px, 48vh)',
              overflow: 'hidden',
            }}
          >
            {previewUrl ? (
              <img
                ref={previewImgRef}
                src={previewUrl}
                alt="Jam Card Preview"
                style={{
                  maxHeight: 'min(410px, 44vh)',
                  maxWidth: '100%',
                  borderRadius: '14px',
                  boxShadow: '0 16px 45px rgba(0, 0, 0, 0.75)',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Disc size={20} className="animate-spin" /> Rendering high-res Jam Card…
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Quick Share Buttons Row (Matching Reference) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              title="Copy Room Link"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.75)',
                padding: '6px 0',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  transition: 'transform 0.15s, background 0.15s',
                }}
              >
                {isLinkCopied ? <Check size={20} color="#10b981" /> : <Link2 size={20} />}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{isLinkCopied ? 'Copied' : 'Copy Link'}</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              title="Share on WhatsApp"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.75)',
                padding: '6px 0',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#25D366',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                  transition: 'transform 0.15s',
                }}
              >
                <WhatsAppIcon size={22} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>WhatsApp</span>
            </button>

            {/* Share */}
            <button
              onClick={handleNativeShare}
              title="System Share"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.75)',
                padding: '6px 0',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  transition: 'transform 0.15s',
                }}
              >
                <Share2 size={20} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Share</span>
            </button>

            {/* Instagram */}
            <button
              onClick={handleInstagramShare}
              title="Copy for Instagram Stories"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.75)',
                padding: '6px 0',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(220, 39, 67, 0.35)',
                  transition: 'transform 0.15s',
                }}
              >
                <InstagramIcon size={22} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Instagram</span>
            </button>
          </div>

          {/* Download & Copy Action Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
            <button
              onClick={handleCopyClipboard}
              disabled={isRendering}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
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
              {isCopied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              <span>{isCopied ? 'Copied!' : 'Copy Image'}</span>
            </button>

            <button
              onClick={handleDownloadPng}
              disabled={isRendering}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ff9f1c 0%, #f26419 100%)',
                color: '#0e1018',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px rgba(255, 159, 28, 0.25)',
                transition: 'all 0.2s',
              }}
            >
              <Download size={16} />
              <span>Download High-Res</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
