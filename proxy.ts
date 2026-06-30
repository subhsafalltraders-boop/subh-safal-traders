import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// TEMPORARY: No authentication required — all routes open
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Root and /login → redirect to /dashboard
  if (pathname === '/' || pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};

