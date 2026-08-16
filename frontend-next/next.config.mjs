/** @type {import('next').NextConfig} */
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/sitemap_index.xml',
        destination: '/sitemap.xml',
      },
      {
        source: '/static/:path*',
        destination: `${BACKEND_URL}/static/:path*`,
      },

      {
        source: '/rooms',
        destination: `${BACKEND_URL}/rooms`,
      },
      {
        source: '/rooms/:path*',
        destination: `${BACKEND_URL}/rooms/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${BACKEND_URL}/auth/:path*`,
      },
      {
        source: '/queue/:path*',
        destination: `${BACKEND_URL}/queue/:path*`,
      },
      {
        source: '/admin/:path*',
        destination: `${BACKEND_URL}/admin/:path*`,
      },
      {
        source: '/likes',
        destination: `${BACKEND_URL}/likes`,
      },
      {
        source: '/likes/:path*',
        destination: `${BACKEND_URL}/likes/:path*`,
      },
      {
        source: '/playlists',
        destination: `${BACKEND_URL}/playlists`,
      },
      {
        source: '/playlists/:path*',
        destination: `${BACKEND_URL}/playlists/:path*`,
      },
      {
        source: '/api/profile',
        destination: `${BACKEND_URL}/profile`,
      },
      {
        source: '/api/profile/:path*',
        destination: `${BACKEND_URL}/profile/:path*`,
      },
      {
        source: '/ping',
        destination: `${BACKEND_URL}/ping`,
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
      {
        source: '/search/:path*',
        destination: `${BACKEND_URL}/search/:path*`,
      },
      {
        source: '/stream/:path*',
        destination: `${BACKEND_URL}/stream/:path*`,
      },
    ];
  },
};

export default nextConfig;
