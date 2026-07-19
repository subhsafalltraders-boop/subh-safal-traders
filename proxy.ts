import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// TEMPORARY: No authentication required — all routes open, login removed.
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const hostname = req.headers.get('host') || '';

  // money.subhsafaltraders.in serves the cash calculator at its own root —
  // same deployment, same database, just rewritten under the hood to /money.
  if (hostname.startsWith('money.')) {
    if (!pathname.startsWith('/money')) {
      const url = req.nextUrl.clone();
      url.pathname = `/money${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Root and /login → redirect straight to /dashboard
  if (pathname === '/' || pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};

