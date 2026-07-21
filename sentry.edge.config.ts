import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "https://086939f1e8415e9816606df3a92059dd@o4511774735597569.ingest.us.sentry.io/4511774745034752",

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  debug: false,
});
