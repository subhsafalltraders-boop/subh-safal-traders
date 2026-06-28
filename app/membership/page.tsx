'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Script from 'next/script';

export default function MembershipPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch membership status
    const statusRes = await fetch('/api/membership/status');
    if (statusRes.ok) {
      const data = await statusRes.json();
      setStatus(data);
    }

    // Fetch history
    const { data: history } = await supabase
      .from('membership')
      .select('*')
      .order('created_at', { ascending: false });
    if (history) setPayments(history);
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Create order
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
      });
      const orderData = await orderRes.json();
      
      if (!orderData.order) {
        throw new Error('Failed to create order');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Subh Safal Traders',
        description: '28 Days Membership Access',
        order_id: orderData.order.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            
            if (verifyData.success) {
              toast.success('Membership renewed successfully!');
              router.push('/dashboard');
              router.refresh();
            } else {
              toast.error('Payment verification failed');
            }
          } catch (e) {
            toast.error('Error verifying payment');
          }
        },
        theme: {
          color: '#1565C0',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error('Payment failed: ' + response.error.description);
      });
      rzp.open();

    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col p-4 md:p-8">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="font-headline-lg text-4xl font-bold text-primary mb-2">Subh Safal Traders</h1>
          <p className="font-body-lg text-on-surface-variant text-lg">
            {status?.is_active ? (
              <span className="text-green-600 font-medium">Status: Active (Valid till {new Date(status.valid_till).toLocaleDateString()})</span>
            ) : (
              <span className="text-red-600 font-medium">Membership expired. Please renew to access the dashboard.</span>
            )}
          </p>
        </div>

        <div className="bg-surface-container-low p-8 rounded-3xl shadow-lg border border-outline-variant/30 text-center mb-12">
          <h2 className="text-2xl font-bold text-on-surface mb-2">28 Days Access</h2>
          <div className="text-5xl font-bold text-primary mb-6">₹1,500</div>
          
          <ul className="text-left max-w-sm mx-auto mb-8 space-y-3">
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              Full billing functionality
            </li>
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              All analytics and reports
            </li>
            <li className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              Unlimited bills and inventory management
            </li>
          </ul>

          {status?.is_active ? (
            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto px-12 py-4 bg-green-600 text-white rounded-full font-label-lg text-lg shadow-md hover:shadow-lg hover:bg-green-700 transition-all active:scale-95"
            >
              Go to Dashboard
            </button>
          ) : (
            <button 
              onClick={handlePayment} 
              disabled={loading}
              className="w-full sm:w-auto px-12 py-4 bg-primary text-on-primary rounded-full font-label-lg text-lg shadow-md hover:shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Pay ₹1,500'}
            </button>
          )}
        </div>

        <div>
          <h3 className="font-title-main text-xl font-bold text-on-surface mb-4">Payment History</h3>
          <div className="bg-surface shadow-sm border border-outline-variant/30 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-sm">
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Date</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Payment ID</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Amount</th>
                  <th className="px-4 py-3 font-medium text-on-surface-variant">Valid Till</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant">No payment history found.</td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-lowest transition-colors text-sm">
                      <td className="px-4 py-3 text-on-surface">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-mono">{p.payment_id || 'N/A'}</td>
                      <td className="px-4 py-3 text-on-surface font-medium">₹{p.amount_paid}</td>
                      <td className="px-4 py-3 text-[#166534] font-medium">{new Date(p.valid_till).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
