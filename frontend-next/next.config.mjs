/** @type {import('next').NextConfig} */
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig = {
  cacheComponents: true,
  experimental: {
    instantNavigationDevToolsToggle: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
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
