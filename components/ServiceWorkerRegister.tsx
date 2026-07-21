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

    // Ask the service worker to check for an update. next.config.ts now sets
    // clientsClaim: true so a new worker actually takes over already-open
    // tabs/PWA windows (previously it could sit "waiting" forever and this
    // page would keep running old cached JS with no visible error — this is
    // what caused a shipped bug fix to silently not reach an already-open
    // phone/PWA). We also re-check whenever the app is reopened/foregrounded
    // and on a timer, since a PWA on a parent's phone may never be closed.
    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      });
    };

    checkForUpdate();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', checkForUpdate);

    const interval = setInterval(checkForUpdate, 15 * 60 * 1000); // every 15 min

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', checkForUpdate);
      clearInterval(interval);
    };
  }, []);
  return null;
}
