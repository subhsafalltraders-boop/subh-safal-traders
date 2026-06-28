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
  
  // 1. Allow these routes without any check
  const publicPaths = ['/', '/login', '/membership', '/favicon.ico', '/sw.js', '/manifest.json'];
  const isPublicRoute = publicPaths.includes(pathname) || 
                        pathname.startsWith('/api') || 
                        pathname.startsWith('/_next') || 
                        pathname.startsWith('/icon');

  // If authenticated and trying to access login or root, send to dashboard
  if (session && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (isPublicRoute) {
    return res;
  }

  // 2. If no auth session -> redirect to /login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3. If authenticated -> check membership (except for /membership which is allowed)
  // We already excluded /membership in publicRoutes, but just to be sure it never blocks it.
  try {
    const { data: membership, error } = await supabase
      .from('membership')
      .select('valid_till')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && membership?.valid_till) {
      const validTill = new Date(membership.valid_till);
      const today = new Date();
      validTill.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      // If valid_till < today -> redirect to /membership
      if (validTill.getTime() < today.getTime()) {
        return NextResponse.redirect(new URL('/membership', req.url));
      }
    } else if (error && error.code === 'PGRST116') {
      // No rows found -> no membership -> redirect to /membership
      return NextResponse.redirect(new URL('/membership', req.url));
    }
  } catch (err) {
    // Fail open: don't block if query fails entirely
    console.error('Membership check failed in middleware:', err);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};
