import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A test API route to verify Sentry error monitoring on the server side.
// Unhandled errors here are automatically captured via instrumentation.ts's
// onRequestError hook — no try/catch needed for this to reach Sentry.
export function GET() {
  throw new SentryExampleAPIError("This error is raised on the backend called by the example page.");
  // eslint-disable-next-line no-unreachable
  return NextResponse.json({ data: "Testing Sentry Error..." });
}
