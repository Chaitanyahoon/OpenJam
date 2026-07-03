/**
 * Safely extracts dominant colors from any image URL using client-side canvas downsampling.
 * Falls back to default values if cross-origin image loading fails.
 */
export const extractColors = (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.includes('logo.png')) {
      resolve(['#ff9f1c', '#8b5cf6', '#ec4899']); // default fallback colors
      return;
    }
    
    // Resolve absolute path if relative
    let srcUrl = imageUrl;
    if (srcUrl.startsWith('/')) {
      if (typeof window !== 'undefined') {
        srcUrl = window.location.origin + srcUrl;
      }
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(['#ff9f1c', '#8b5cf6', '#ec4899']);
          return;
        }
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        
        // Helper to normalize and hexify colors
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
        
        // Sample distinct coordinates
        // 1. Center (row 5, col 5) -> index 220
        const c1 = rgbToHex(data[220], data[221], data[222]);
        // 2. Top-Left (row 2, col 2) -> index 88
        const c2 = rgbToHex(data[88], data[89], data[90]);
        // 3. Bottom-Right (row 7, col 7) -> index 308
        const c3 = rgbToHex(data[308], data[309], data[310]);
        
        resolve([c1, c2, c3]);
      } catch (err) {
        // Fallback for tainted canvas / CORS issues
        resolve(['#ff9f1c', '#8b5cf6', '#ec4899']);
      }
    };
    
    img.onerror = () => {
      resolve(['#ff9f1c', '#8b5cf6', '#ec4899']);
    };
    
    img.src = srcUrl;
  });
};
