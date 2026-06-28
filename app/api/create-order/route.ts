import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: 150000,
      currency: 'INR',
      receipt: `membership_${Date.now()}`,
    });

    return NextResponse.json({ order_id: order.id, amount: order.amount });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
