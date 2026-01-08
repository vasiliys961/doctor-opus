const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: true, // ВРЕМЕННО ОТКЛЮЧАЕМ PWA, чтобы вернуть сайт к жизни
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
}

module.exports = withPWA(nextConfig);

