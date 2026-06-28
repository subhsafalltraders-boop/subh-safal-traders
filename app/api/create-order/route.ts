import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';



export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });

    // For Subh Safal Traders Membership, the amount is fixed at ₹1500 (150000 paise).
    const options = {
      amount: 150000, 
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json({ order }, { status: 200 });
  } catch (error: any) {
    console.error('Error creating razorpay order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
