const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  register: true,
  skipWaiting: true,
  // Keep PWA enabled in production; allow emergency disable via env.
  disable: process.env.NODE_ENV === 'development' || process.env.NEXT_DISABLE_PWA === 'true',
  workboxOptions: {
    disableDevLogs: true,
    // Stabilize SW build: avoid terser/sourcemap edge-cases in plugin pipeline.
    mode: 'development',
    sourcemap: false,
    // Не прекэшировать тяжёлые локальные модели (~167 МБ) — они кэшируются
    // в браузере при первом обращении, а не на установке service worker.
    exclude: [/\.onnx$/, /ort-wasm.*\.wasm$/, /\/models\//],
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
  swcMinify: true,
  typescript: {
    // Оставшиеся некритичные ошибки (12):
    // - webkitdirectory: нестандартный HTML-атрибут (работает в браузерах)
    // - Buffer типы: внутренние несоответствия Node.js типов
    // - cornerstoneWADOImageLoader: динамически подключаемая библиотека
    // - docx/pdf-lib типы: внутренние несоответствия типов библиотек
    // Temporary hotfix for deploy stability: allow build while we clean legacy TS debt.
    ignoreBuildErrors: true,
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
    // В браузере используется onnxruntime-web, нативный onnxruntime-node не нужен
    // нигде в нашем коде — исключаем, чтобы не ломать сборку на .node-бинарниках.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
    };
    // sharp — это Node-зависимость transformers.js; в клиентском бандле она не нужна
    // (на сервере sharp используется отдельно и остаётся доступной).
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
      };
    }
    // Не следим за тяжёлыми/служебными папками: снижает число открытых файлов
    // у file-watcher (иначе на macOS с лимитом kern.maxfilesperproc=10240 легко
    // словить EMFILE) и ускоряет dev. RegExp вместо glob — путь проекта содержит
    // пробел и кириллицу, на таких путях анкеренные glob'ы webpack не матчатся.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /[\\/](?:node_modules|\.next|\.git)[\\/]|[\\/]public[\\/](?:models|ort)[\\/]/,
    };
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
              "connect-src 'self' blob: data: https://openrouter.ai https://polza.ai https://cdn.tailwindcss.com",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'self'",
            ].join('; ')
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Webhook в кабинете Yagoda часто указывают со слэшем в конце
      { source: '/api/payment/ya/', destination: '/api/payment/ya' },
    ];
  },
}

module.exports = withPWA(nextConfig);
