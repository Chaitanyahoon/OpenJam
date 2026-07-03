/**
 * Safely extracts dominant colors from any image URL using client-side canvas downsampling.
 * Uses a two-pass approach:
 * 1. For same-origin or known CORS-friendly CDNs, uses crossOrigin='Anonymous'.
 * 2. For external URLs (Pinterest, etc.), loads without CORS and catches tainted canvas gracefully.
 * Falls back to default values if extraction fails for any reason.
 */

const CORS_FRIENDLY_HOSTS = [
  'cdn.discordapp.com',
  'i.scdn.co',
  'mosaic.scdn.co',
  'seed-mix-image.spotifycdn.com',
  'image-cdn-ak.spotifycdn.com',
  'image-cdn-fa.spotifycdn.com',
  'img.youtube.com',
  'i.ytimg.com',
  'lh3.googleusercontent.com',
];

const DEFAULT_COLORS = ['#ff9f1c', '#8b5cf6', '#ec4899'];

const rgbToHex = (r, g, b) => {
  // If the sampled color is too dark, boost brightness slightly to keep visualizer glows vibrant
  const max = Math.max(r, g, b);
  if (max < 40) {
    r = Math.min(255, r + 40);
    g = Math.min(255, g + 30);
    b = Math.min(255, b + 60);
  }
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

const extractFromCanvas = (img) => {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, 10, 10);
  const data = ctx.getImageData(0, 0, 10, 10).data;

  // Sample distinct coordinates
  const c1 = rgbToHex(data[220], data[221], data[222]); // Center
  const c2 = rgbToHex(data[88], data[89], data[90]);     // Top-Left
  const c3 = rgbToHex(data[308], data[309], data[310]);   // Bottom-Right
  return [c1, c2, c3];
};

export const extractColors = (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.includes('logo.png')) {
      resolve(DEFAULT_COLORS);
      return;
    }

    // Resolve absolute path if relative
    let srcUrl = imageUrl;
    if (srcUrl.startsWith('/')) {
      if (typeof window !== 'undefined') {
        srcUrl = window.location.origin + srcUrl;
      }
    }

    let urlObj;
    try {
      urlObj = new URL(srcUrl);
    } catch {
      resolve(DEFAULT_COLORS);
      return;
    }

    const isSameOrigin = typeof window !== 'undefined' && urlObj.origin === window.location.origin;
    const isCorsFriendly = CORS_FRIENDLY_HOSTS.some(h => urlObj.hostname === h || urlObj.hostname.endsWith('.' + h));
    const useCors = isSameOrigin || isCorsFriendly;

    const img = new Image();
    
    if (useCors) {
      img.crossOrigin = 'Anonymous';
    }

    img.onload = () => {
      try {
        const colors = extractFromCanvas(img);
        resolve(colors || DEFAULT_COLORS);
      } catch {
        // Tainted canvas (cross-origin without CORS) — return defaults silently
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => {
      // If CORS mode failed, retry without CORS (image will display but canvas will be tainted)
      if (useCors && !isSameOrigin) {
        const retryImg = new Image();
        retryImg.onload = () => {
          // Can't extract colors without CORS, but at least the image loads
          resolve(DEFAULT_COLORS);
        };
        retryImg.onerror = () => resolve(DEFAULT_COLORS);
        retryImg.src = srcUrl;
      } else {
        resolve(DEFAULT_COLORS);
      }
    };

    img.src = srcUrl;
  });
};

