'use client';
import { useEffect } from 'react';

// next-pwa (configured in next.config.ts) auto-generates and registers the
// actual service worker at build time — it owns /public/sw.js and overwrites
// it on every build. This component does NOT register a second one (that
// used to conflict with next-pwa's own registration and caused stale/old
// pages to keep being served after a new deploy). It only makes sure that
// whenever a new service worker takes control (i.e. a fresh deploy just
// went live), the page reloads once so the user actually sees the update.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.update().catch(() => {});
    });
  }, []);
  return null;
}
