import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    // Validate all required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET not configured');
      return NextResponse.json({ error: 'Payment verification not configured' }, { status: 500 });
    }

    // Verify signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', keySecret)
      .update(sign)
      .digest('hex');

    // Signature mismatch — do NOT mark as paid
    if (expectedSign !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Signature verified — insert membership record
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const validTill = new Date();
    validTill.setDate(validTill.getDate() + 28);

    await supabase.from('membership').insert({
      valid_till: validTill.toISOString().split('T')[0],
      amount_paid: 1500,
      payment_id: razorpay_payment_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify payment error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
