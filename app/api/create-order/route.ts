import Razorpay from 'razorpay';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials not configured');
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Fixed amount for membership: ₹1500 = 150000 paise
    const amount = 150000;

    // Validate minimum amount (100 paise)
    if (amount < 100) {
      return NextResponse.json({ error: 'Amount must be at least ₹1' }, { status: 400 });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `membership_${Date.now()}`,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error('Create order error:', error);

    // Handle Razorpay auth failures
    if (error.statusCode === 401) {
      return NextResponse.json({ error: 'Payment authentication failed' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
