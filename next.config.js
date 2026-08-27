const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development' || process.env.NEXT_DISABLE_PWA === 'true',
  workboxOptions: {
    // Локальный обход нестабильного terser-хука в некоторых окружениях сборки.
    // Для диагностического локального прогона можно включить NEXT_PWA_SAFE_BUILD=true.
    mode: process.env.NEXT_PWA_SAFE_BUILD === 'true' ? 'development' : 'production',
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /\/api\/auth\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /\/_next\/data\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /\/\?_rsc=.*/i,
        handler: 'NetworkOnly',
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Оставшиеся некритичные ошибки (12):
    // - webkitdirectory: нестандартный HTML-атрибут (работает в браузерах)
    // - Buffer типы: внутренние несоответствия Node.js типов
    // - cornerstoneWADOImageLoader: динамически подключаемая библиотека
    // - docx/pdf-lib типы: внутренние несоответствия типов библиотек
    ignoreBuildErrors: process.env.NEXT_IGNORE_TS_ERRORS === 'true',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
    // transformers.js используется только в браузере: не бандлим его на сервере,
    // иначе webpack пытается разобрать нативные .node-бинарники onnxruntime-node.
    serverComponentsExternalPackages: ['@xenova/transformers'],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    // В браузере используется onnxruntime-web, нативный onnxruntime-node не нужен.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
    };
    // sharp — Node-only зависимость transformers.js, в клиентском бандле не нужна.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
              "img-src 'self' data: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' blob: data: https://openrouter.ai https://api.assemblyai.com https://api.cloud.yandex.net https://cdn.tailwindcss.com",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'self'",
            ].join('; ')
          },
        ],
      },
    ];
  },
}

module.exports = withPWA(nextConfig);
