import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;
  const isLoginPage = pathname.startsWith('/login');
  const isPublicPage = pathname === '/';
  const isApiRoute = pathname.startsWith('/api');
  const isMembershipPage = pathname.startsWith('/membership');

  // Allow public routes
  if (!session && !isLoginPage && !isPublicPage && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Redirect authenticated users away from login and public landing page
  if (session && (isLoginPage || isPublicPage)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Membership check for protected dashboard routes
  if (session && !isApiRoute && !isMembershipPage && !isLoginPage && !isPublicPage) {
    const { data: membership } = await supabase
      .from('membership')
      .select('valid_till')
      .order('valid_till', { ascending: false })
      .limit(1)
      .single();

    let isActive = false;
    if (membership?.valid_till) {
      const validTill = new Date(membership.valid_till);
      const today = new Date();
      validTill.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (validTill.getTime() >= today.getTime()) {
        isActive = true;
      }
    }

    if (!isActive) {
      return NextResponse.redirect(new URL('/membership', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};
