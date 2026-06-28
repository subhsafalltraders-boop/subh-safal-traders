'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MembershipPage() {
  const [membership, setMembership] = useState<{valid_till: string, amount_paid: number, created_at: string}[]>([]);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembership = async () => {
      try {
        const supabase = createClient();
        const { data } = await (supabase as any)
          .from('membership')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (data && data.length > 0) {
          setMembership(data);
          const validTill = new Date(data[0].valid_till);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diff = Math.ceil((validTill.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          setDaysLeft(diff);
          setIsActive(diff > 0);
        }
      } catch (err) {
        console.error('Failed to fetch membership:', err);
      }
      setLoading(false);
    };
    fetchMembership();
  }, []);

  const handlePayment = async () => {
    try {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
      
      script.onload = async () => {
        const orderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 150000 })
        });
        const order = await orderRes.json();
        
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: 150000,
          currency: 'INR',
          name: 'Subh Safal Traders',
          description: '28 Days Membership',
          order_id: order.order_id,
          handler: async (response: {razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string}) => {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response)
            });
            const result = await verifyRes.json();
            if (result.success) {
              window.location.href = '/dashboard';
            }
          },
          prefill: { name: 'Subh Safal Traders' },
          theme: { color: '#1d4ed8' }
        };
        
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
    } catch (err) {
      console.error('Payment error:', err);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-blue-900 mb-2">Subh Safal Traders</h1>
        <p className="text-center text-gray-500 mb-6">Billing App Membership</p>
        
        {isActive ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-green-700 font-semibold">✅ Membership Active</p>
            <p className="text-green-600 text-sm mt-1">{daysLeft} days remaining</p>
            <p className="text-gray-500 text-sm">Valid till: {new Date(membership[0]?.valid_till).toLocaleDateString('en-IN')}</p>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-700 font-semibold">❌ Membership Expired</p>
            <p className="text-red-600 text-sm mt-1">Renew to continue using the app</p>
          </div>
        )}

        <div className="border border-blue-100 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-lg">28 Days Access</span>
            <span className="text-2xl font-bold text-blue-700">₹1,500</span>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Full billing access</li>
            <li>✓ All reports & analytics</li>
            <li>✓ Unlimited bills</li>
            <li>✓ Payment tracking</li>
            <li>✓ Settlement management</li>
          </ul>
        </div>

        <button
          onClick={handlePayment}
          className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-800 transition mb-3"
        >
          Pay ₹1,500
        </button>

        {isActive && (
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full border border-blue-700 text-blue-700 py-3 rounded-xl font-semibold hover:bg-blue-50 transition"
          >
            Go to Dashboard
          </button>
        )}

        {membership.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-gray-700 mb-3">Payment History</h3>
            <div className="space-y-2">
              {membership.map((m) => (
                <div key={m.created_at} className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">{new Date(m.created_at).toLocaleDateString('en-IN')}</span>
                  <span className="text-gray-600">Valid till: {new Date(m.valid_till).toLocaleDateString('en-IN')}</span>
                  <span className="font-medium">₹{m.amount_paid}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
