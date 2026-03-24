/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  onDemandEntries: {
    maxInactiveAge: 60000,
    pagesBufferLength: 5,
  },
  // Ensure API URLs are set from environment
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'production',
  },
  // Environment validation
  ...(process.env.NODE_ENV === 'production' && {
    onBuildComplete: () => {
      if (!process.env.NEXT_PUBLIC_API_URL) {
        console.warn('⚠️  NEXT_PUBLIC_API_URL not set - API calls may fail');
      }
      if (!process.env.NEXT_PUBLIC_WS_URL) {
        console.warn('⚠️  NEXT_PUBLIC_WS_URL not set - Real-time updates may fail');
      }
    },
  }),
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
        ]
      }
    ]
  },
  // Rewrites for API calls
  async rewrites() {
    if (!process.env.NEXT_PUBLIC_API_URL) {
      return [];
    }
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
        }
      ]
    };
  },
};

module.exports = nextConfig;
