import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const validTill = new Date();
    validTill.setDate(validTill.getDate() + 28);
    const validTillStr = validTill.toISOString().split('T')[0];

    // Some Supabase tables might need bypass RLS if user is not authenticated perfectly during callback, 
    // but the payment is done from client side so session should be present.
    const { error } = await supabase
      .from('membership')
      .insert([
        {
          valid_till: validTillStr,
          amount_paid: 1500,
          payment_id: razorpay_payment_id,
        },
      ]);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to update membership in DB' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
