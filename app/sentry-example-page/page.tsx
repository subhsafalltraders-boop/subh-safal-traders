"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryExamplePage() {
  const [hasSentReport, setHasSentReport] = useState(false);

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Sentry Test Page</h1>
      <p style={{ color: "#555", marginBottom: 20 }}>
        Click the button below to trigger a real error and confirm it shows up in Sentry.
        Delete this page once you&apos;ve verified it works.
      </p>
      <button
        type="button"
        style={{
          padding: "10px 20px",
          background: "#362d59",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
        }}
        onClick={async () => {
          setHasSentReport(true);
          await Sentry.startSpan(
            { name: "Example Frontend/Backend Span", op: "test" },
            async () => {
              const res = await fetch("/api/sentry-example-api");
              if (!res.ok) {
                // Also throw client-side so both client and server errors are exercised.
                throw new Error("Sentry Example Frontend Error");
              }
            },
          );
        }}
      >
        Throw test error
      </button>
      {hasSentReport && (
        <p style={{ marginTop: 16, color: "#166534" }}>
          Error sent — check your Sentry Issues dashboard in ~30 seconds.
        </p>
      )}
    </div>
  );
}
