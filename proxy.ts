import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isPublicPage = req.nextUrl.pathname === '/';

  if (!session && !isLoginPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (session && (isLoginPage || isPublicPage)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};
