/* ============================================================
   OPEN JAM — Ambient Glow Canvas Lighting System
   Aesthetic fluid canvas blobs shifting dynamically with album art
   ============================================================ */

class FluidBlob {
  constructor(x, y, radius, color, speed) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = { ...color }; // {r, g, b}
    this.targetColor = { ...color };
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = (Math.random() - 0.5) * speed;
  }

  update(width, height) {
    // Move
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off edges with some padding
    const pad = -this.radius * 0.1;
    if (this.x < pad || this.x > width - pad) {
      this.vx *= -1;
      this.x = Math.max(pad, Math.min(this.x, width - pad));
    }
    if (this.y < pad || this.y > height - pad) {
      this.vy *= -1;
      this.y = Math.max(pad, Math.min(this.y, height - pad));
    }

    // Interpolate color slowly towards target
    this.color.r += (this.targetColor.r - this.color.r) * 0.03;
    this.color.g += (this.targetColor.g - this.color.g) * 0.03;
    this.color.b += (this.targetColor.b - this.color.b) * 0.03;
  }

  draw(ctx) {
    // Draw circular radial gradient for soft blob edges
    const grad = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius
    );
    const r = Math.round(this.color.r);
    const g = Math.round(this.color.g);
    const b = Math.round(this.color.b);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.75)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class AmbientGlowManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.blobs = [];
    this.animationFrameId = null;
    this.active = false;
    this.width = 0;
    this.height = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    // Set buffer size low (1/4 screen size) for performance optimization under heavy blur
    this.width = Math.ceil(window.innerWidth / 4);
    this.height = Math.ceil(window.innerHeight / 4);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  initBlobs(colors) {
    this.blobs = [];
    const baseRadius = Math.max(this.width, this.height) * 0.75;

    // Spawn 4 blobs at different regions of the canvas
    const positions = [
      { x: this.width * 0.2, y: this.height * 0.2 },
      { x: this.width * 0.8, y: this.height * 0.2 },
      { x: this.width * 0.2, y: this.height * 0.8 },
      { x: this.width * 0.8, y: this.height * 0.8 }
    ];

    for (let i = 0; i < 4; i++) {
      const color = colors[i % colors.length];
      const pos = positions[i];
      const radius = baseRadius * (0.8 + Math.random() * 0.4);
      this.blobs.push(new FluidBlob(pos.x, pos.y, radius, { ...color }, 0.5));
    }
  }

  updateColors(colors) {
    if (this.blobs.length === 0) {
      this.initBlobs(colors);
      return;
    }
    for (let i = 0; i < this.blobs.length; i++) {
      const color = colors[i % colors.length];
      this.blobs[i].targetColor = { ...color };
    }
  }

  start() {
    if (this.active) return;
    this.active = true;
    if (this.canvas) this.canvas.classList.add('active');
    
    const loop = () => {
      if (!this.active) return;
      this.tick();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.active = false;
    if (this.canvas) this.canvas.classList.remove('active');
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  tick() {
    // Semi-transparent background draw to create a soft color blending trail
    this.ctx.fillStyle = 'rgba(5, 5, 8, 0.08)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Screen blend mode to blend colored blobs together beautifully
    this.ctx.globalCompositeOperation = 'screen';
    for (const blob of this.blobs) {
      blob.update(this.width, this.height);
      blob.draw(this.ctx);
    }
    this.ctx.globalCompositeOperation = 'source-over';
  }

  updateArtwork(imgUrl) {
    if (!imgUrl || imgUrl.includes('data:image/svg+xml')) {
      this.stop();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const colors = this._extractPalette(img);
      this.updateColors(colors);
      this.start();
    };
    img.onerror = () => {
      // Fallback to deterministic palette extraction on load failure
      const colors = this._getDeterministicPalette(imgUrl);
      this.updateColors(colors);
      this.start();
    };
    img.src = imgUrl;
  }

  _extractPalette(img) {
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 5;
      tempCanvas.height = 5;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 5, 5);
      const imgData = ctx.getImageData(0, 0, 5, 5).data;

      const colors = [];
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        
        // Calculate brightness to filter out extreme darks/whites
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness > 20 && brightness < 230) {
          colors.push({ r, g, b });
        }
      }

      if (colors.length < 3) {
        return this._getDefaultPalette();
      }

      // Filter colors to get distinct ones
      const selected = [colors[0]];
      for (let i = 1; i < colors.length && selected.length < 4; i++) {
        const c = colors[i];
        const isDifferent = selected.every(s => {
          const dist = Math.sqrt((s.r - c.r) ** 2 + (s.g - c.g) ** 2 + (s.b - c.b) ** 2);
          return dist > 45;
        });
        if (isDifferent) {
          selected.push(c);
        }
      }

      while (selected.length < 3) {
        selected.push(colors[Math.floor(Math.random() * colors.length)] || { r: 255, g: 170, b: 0 });
      }

      return selected;
    } catch (e) {
      console.warn('[AmbientGlow] Canvas extract failed (CORS), using deterministic fallback');
      return this._getDeterministicPalette(img.src);
    }
  }

  _getDeterministicPalette(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [];
    for (let i = 0; i < 3; i++) {
      const r = (hash >> (i * 8)) & 0xFF;
      const g = (hash >> (i * 8 + 4)) & 0xFF;
      const b = (hash >> (i * 8 + 8)) & 0xFF;

      const hsv = this._rgbToHsv(r, g, b);
      // Ensure vibrant colors by forcing decent saturation/value
      const rgb = this._hsvToRgb(hsv.h, Math.max(hsv.s, 0.6), Math.max(hsv.v, 0.55));
      colors.push(rgb);
    }
    return colors;
  }

  _getDefaultPalette() {
    return [
      { r: 255, g: 170, b: 0 },   // cyber gold
      { r: 255, g: 23,  b: 68 },  // status red
      { r: 41,  g: 182, b: 246 }  // status blue
    ];
  }

  _rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, v };
  }

  _hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
}

// Make globally available
window.AmbientGlowManager = AmbientGlowManager;
