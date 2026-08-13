/**
 * Safely extracts vibrant dominant colors from any image URL using client-side canvas downsampling and color scoring.
 * Filters out extreme blacks, whites, and dull greys to produce harmonious accent palettes.
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
  // If sampled color is too dark, boost brightness to keep glows vibrant
  const max = Math.max(r, g, b);
  if (max < 40) {
    r = Math.min(255, r + 40);
    g = Math.min(255, g + 30);
    b = Math.min(255, b + 60);
  }
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

const extractFromCanvas = (img) => {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_COLORS;

  ctx.drawImage(img, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;

  const colorScores = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue; // Skip transparent

    // Calculate saturation & lightness (HSL)
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);

    // Skip extreme darks, extreme lights, or desaturated dull greys
    if (l < 0.12 || l > 0.88 || s < 0.15) continue;

    // Vibrance score favoring saturated midtones
    const score = s * (1 - Math.abs(l - 0.5));
    colorScores.push({ r, g, b, score });
  }

  if (colorScores.length === 0) {
    return DEFAULT_COLORS;
  }

  // Sort colors by vibrance score descending
  colorScores.sort((a, b) => b.score - a.score);

  // Pick top 3 visually distinct colors (minimum RGB Euclidean distance)
  const selected = [colorScores[0]];
  for (let i = 1; i < colorScores.length && selected.length < 3; i++) {
    const candidate = colorScores[i];
    const isDistinct = selected.every(prev => {
      const dist = Math.hypot(candidate.r - prev.r, candidate.g - prev.g, candidate.b - prev.b);
      return dist > 55;
    });
    if (isDistinct) {
      selected.push(candidate);
    }
  }

  while (selected.length < 3) {
    selected.push(selected[0] || { r: 255, g: 159, b: 28 });
  }

  return selected.map(c => rgbToHex(c.r, c.g, c.b));
};

const colorCache = new Map();

export const extractColors = (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.includes('logo.png')) {
      resolve(DEFAULT_COLORS);
      return;
    }

    if (colorCache.has(imageUrl)) {
      resolve(colorCache.get(imageUrl));
      return;
    }

    // Resolve absolute path if relative
    let srcUrl = imageUrl;
    if (srcUrl.startsWith('/') && typeof window !== 'undefined') {
      srcUrl = window.location.origin + srcUrl;
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
        const resolvedColors = colors || DEFAULT_COLORS;
        colorCache.set(imageUrl, resolvedColors);
        resolve(resolvedColors);
      } catch {
        colorCache.set(imageUrl, DEFAULT_COLORS);
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => {
      if (useCors && !isSameOrigin) {
        const retryImg = new Image();
        retryImg.onload = () => {
          colorCache.set(imageUrl, DEFAULT_COLORS);
          resolve(DEFAULT_COLORS);
        };
        retryImg.onerror = () => {
          colorCache.set(imageUrl, DEFAULT_COLORS);
          resolve(DEFAULT_COLORS);
        };
        retryImg.src = srcUrl;
      } else {
        colorCache.set(imageUrl, DEFAULT_COLORS);
        resolve(DEFAULT_COLORS);
      }
    };

    img.src = srcUrl;
  });
};
