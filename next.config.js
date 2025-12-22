/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Убеждаемся, что используем встроенный fetch из Node.js
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    
    // Для serverless функций используем встроенный fetch
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig

