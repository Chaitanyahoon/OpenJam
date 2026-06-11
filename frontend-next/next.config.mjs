/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/static/:path*',
        destination: 'http://localhost:8000/static/:path*',
      },
      {
        source: '/sw.js',
        destination: 'http://localhost:8000/sw.js',
      },
      {
        source: '/room/:path*',
        destination: 'http://localhost:8000/room/:path*',
      },
      {
        source: '/rooms/:path*',
        destination: 'http://localhost:8000/rooms/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8000/auth/:path*',
      },
      {
        source: '/queue/:path*',
        destination: 'http://localhost:8000/queue/:path*',
      },
      {
        source: '/admin/:path*',
        destination: 'http://localhost:8000/admin/:path*',
      },
      {
        source: '/ping',
        destination: 'http://localhost:8000/ping',
      },
      {
        source: '/health',
        destination: 'http://localhost:8000/health',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:8000/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;
