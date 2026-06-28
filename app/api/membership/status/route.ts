import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership, error } = await supabase
      .from('membership')
      .select('valid_till')
      .order('valid_till', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase membership error:', error);
      return NextResponse.json({ error: 'Failed to fetch membership' }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({
        valid_till: null,
        days_remaining: 0,
        is_active: false
      });
    }

    const validTill = new Date(membership.valid_till);
    const today = new Date();
    
    // Normalize both to start of day for accurate day difference
    validTill.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const timeDiff = validTill.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    
    const isActive = daysRemaining > 0 || timeDiff === 0;

    return NextResponse.json({
      valid_till: membership.valid_till,
      days_remaining: daysRemaining,
      is_active: isActive
    });

  } catch (error: any) {
    console.error('Error in membership status API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
