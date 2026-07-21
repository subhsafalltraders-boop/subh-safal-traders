"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// This only renders if something crashes so badly that even the root layout
// fails (very rare). It intentionally does NOT use NextError's generic blank
// page — the app's only users are non-technical, so this must always show a
// plain message and one obvious, big button to recover, never a dead end.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#faf8ff",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px" }}>😕</div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#00236f", margin: 0 }}>
          Kuch gadbad ho gaya
        </h1>
        <p style={{ fontSize: "15px", color: "#444651", margin: 0, maxWidth: "320px" }}>
          Something went wrong. Please tap the button below to try again.
        </p>
        <button
          onClick={() => {
            try {
              reset();
            } finally {
              window.location.href = "/dashboard";
            }
          }}
          style={{
            marginTop: "8px",
            padding: "14px 28px",
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            background: "#00236f",
            border: "none",
            borderRadius: "12px",
            minHeight: "48px",
            cursor: "pointer",
          }}
        >
          Dashboard par jaayein
        </button>
      </body>
    </html>
  );
}
