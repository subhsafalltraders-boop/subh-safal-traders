import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://086939f1e8415e9816606df3a92059dd@o4511774735597569.ingest.us.sentry.io/4511774745034752",

  // 100% in dev, 10% in production — keeps volume/cost reasonable while still
  // giving useful tracing data on a low-traffic business app like this one.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  // Keep debug logging off by default — flip to true only when troubleshooting
  // why an event isn't showing up in Sentry.
  debug: false,
});

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
