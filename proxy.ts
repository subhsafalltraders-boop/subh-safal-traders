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

  // 1. Allow these routes without any check:
  //    /, /login, /membership, /api/*, /_next/*, /favicon.ico, /sw.js, /manifest.json, /icon*
  const publicPaths = ['/', '/login', '/membership', '/favicon.ico', '/sw.js', '/manifest.json'];
  const isPublicRoute = publicPaths.includes(pathname) ||
                        pathname.startsWith('/api') ||
                        pathname.startsWith('/_next') ||
                        pathname.startsWith('/icon');

  // If authenticated and on login or root → send to dashboard
  if (session && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Public routes → allow through immediately
  if (isPublicRoute) {
    return res;
  }

  // 2. If no auth session → redirect to /login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3. If authenticated → check membership via direct REST fetch (fail open)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/membership?select=valid_till&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const validTill = new Date(data[0].valid_till);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (validTill < today) {
          return NextResponse.redirect(new URL('/membership', req.url));
        }
      }
      // If no membership record found — allow through
    }
    // If fetch fails — allow through (fail open)
  } catch {
    // Any error — allow through, never block
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*).*)'],
};
