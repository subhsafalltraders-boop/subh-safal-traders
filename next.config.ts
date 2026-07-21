import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// @ts-expect-error - next-pwa does not have standard types
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  // Pages/HTML must always be fetched fresh from the network (NetworkFirst),
  // falling back to cache only if the device is offline. Without this,
  // next-pwa's default caching can keep serving an old build after a new
  // deploy — which is exactly what caused the login page fix to not show up
  // for users even though the new code was already live on the server.
  runtimeCaching: [
    {
      urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'sst-pages',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 }, // 1 hour max, always re-validated when online
      },
    },
    {
      urlPattern: /\.(?:js|css)$/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'sst-static-resources' },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'sst-images',
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  turbopack: {},
  compress: true,
  experimental: {
    optimizeCss: true,
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' }
        ]
      },
      {
        source: '/money-manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' }
        ]
      },
      {
        // Belt-and-suspenders: tell Vercel's CDN and the browser to never
        // cache HTML page responses, so a fresh deploy is always visible
        // immediately, even before the service worker layer kicks in.
        source: '/((?!_next/static|_next/image|favicon.ico|manifest.json|money-manifest.json|sw.js|workbox-.*|icon-.*\\.png|money-icon-.*\\.png|apple-touch-icon\\.png|money-apple-touch-icon\\.png).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map upload auth token — set SENTRY_AUTH_TOKEN in Vercel's env vars
  // (a build-time secret, separate from the DSN) to enable this.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Proxies Sentry's client requests through our own domain so ad-blockers
  // (which commonly block *.sentry.io) don't silently drop error reports.
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,

  // Note: this project builds with Turbopack (see `turbopack: {}` above).
  // Sentry's webpack tree-shaking options aren't compatible with Turbopack,
  // so they're intentionally omitted here. Source map upload via Turbopack
  // is still experimental in the Sentry Next.js SDK — if stack traces show
  // minified code in production, that's the likely reason; the fallback is
  // running `next build` with webpack instead of Turbopack for that step.
});

