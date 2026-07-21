"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Catches any crash inside a dashboard page (billing, payments, settlements,
// etc.) WITHOUT taking down the rest of the app. Previously there was no
// error.tsx here at all, so any uncaught render error fell through to
// global-error.tsx, which replaced the ENTIRE page (including navigation) —
// a dead end for a non-technical user with no way back except force-closing
// the app. This shows a friendly message with two clear, big buttons instead.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-space-md p-space-lg text-center min-h-[60vh]">
      <div className="text-[48px]">😕</div>
      <h1 className="font-headline-sm text-on-surface font-bold">Kuch gadbad ho gaya</h1>
      <p className="font-body-md text-on-surface-variant max-w-[320px]">
        Is page mein ek problem aa gayi. Neeche button dabaakar dobara try karein.
      </p>
      <div className="flex flex-col sm:flex-row gap-space-sm mt-space-sm w-full max-w-[320px]">
        <button
          onClick={() => reset()}
          className="flex-1 min-h-[48px] px-space-lg py-space-sm bg-primary text-on-primary rounded-xl font-bold"
        >
          Dobara Try Karein
        </button>
        <button
          onClick={() => { window.location.href = '/dashboard'; }}
          className="flex-1 min-h-[48px] px-space-lg py-space-sm border border-outline-variant rounded-xl font-bold text-on-surface"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
