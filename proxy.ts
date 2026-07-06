import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const isLoginRoute = pathname === '/login';

  // Root path: send to dashboard if logged in, otherwise to login
  if (pathname === '/') {
    return NextResponse.redirect(new URL(session ? '/dashboard' : '/login', req.url));
  }

  // Authenticated users hitting /login get redirected to /dashboard
  if (isLoginRoute) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return res;
  }

  // Unauthenticated users hitting any other route get redirected to /login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};

