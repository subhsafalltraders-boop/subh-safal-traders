'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Script from 'next/script';

export default function MembershipPage() {
  const [membership, setMembership] = useState<{valid_till: string, amount_paid: number, created_at: string, payment_id?: string}[]>([]);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

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
    setPaying(true);
    setError('');
    try {
      // Step 1: Create order on backend
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 150000 })
      });

      if (!orderRes.ok) {
        throw new Error('Failed to create order. Please try again.');
      }

      const order = await orderRes.json();

      if (!order.order_id) {
        throw new Error('Invalid order response. Please try again.');
      }
      
      // Step 2: Open Razorpay checkout modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'Subh Safal Traders',
        description: '28 Days Membership',
        order_id: order.order_id,
        handler: async (response: {razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string}) => {
          // Step 3: Verify payment signature on backend
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response)
            });
            const result = await verifyRes.json();
            if (result.success) {
              window.location.href = '/dashboard';
            } else {
              setError('Payment verification failed. Contact support.');
            }
          } catch {
            setError('Payment verification failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            // User cancelled — no error, just reset
          }
        },
        prefill: { name: 'Subh Safal Traders' },
        theme: { color: '#1d4ed8' }
      };
      
      const rzp = new (window as any).Razorpay(options);

      // Handle payment failure event
      rzp.on('payment.failed', function (response: any) {
        setError(response.error?.description || 'Payment failed. Please try again.');
        setPaying(false);
      });

      rzp.open();

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setPaying(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">storefront</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Subh Safal Traders</h1>
          </div>
          {isActive && (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              Go to Dashboard <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* Left Column: Features & Info */}
        <div className="flex-1 lg:max-w-3xl">
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
              Unlock the Full Potential of Your POS System
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Upgrade to the Pro tier and gain uninterrupted access to our industry-leading billing software. Designed specifically for distribution agencies, it gives you everything you need to manage your business efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              { icon: 'speed', title: 'Lightning Fast Billing', desc: 'Generate bills in seconds with our optimized interface.' },
              { icon: 'analytics', title: 'Advanced Analytics', desc: 'Track daily profits, sales trends, and vendor performance.' },
              { icon: 'inventory_2', title: 'Unlimited Inventory', desc: 'Add and manage unlimited products without restrictions.' },
              { icon: 'payments', title: 'Settlement Tracking', desc: 'Keep track of vendor payments and pending dues easily.' },
              { icon: 'cloud_sync', title: 'Cloud Sync', desc: 'Your data is securely backed up and accessible from anywhere.' },
              { icon: 'support_agent', title: 'Priority Support', desc: 'Get fast responses to your queries and issues.' }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">{feature.icon}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
          
          {membership.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8 lg:mb-0">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-gray-900 text-lg">Payment History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-100 text-sm">
                      <th className="px-6 py-4 font-medium text-gray-500">Date Paid</th>
                      <th className="px-6 py-4 font-medium text-gray-500">Valid Until</th>
                      <th className="px-6 py-4 font-medium text-gray-500 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {membership.map((m) => (
                      <tr key={m.created_at} className="hover:bg-gray-50 transition-colors text-sm">
                        <td className="px-6 py-4 text-gray-900">{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-4 text-green-700 font-medium">{new Date(m.valid_till).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-4 text-gray-900 font-bold text-right">₹{m.amount_paid.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Checkout Card */}
        <div className="w-full lg:w-[400px]">
          <div className="sticky top-24 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
            {/* Status Banner */}
            {isActive ? (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white text-center">
                <div className="flex items-center justify-center gap-2 font-bold mb-1">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Membership Active
                </div>
                <div className="text-green-50 text-sm">
                  {daysLeft} days remaining • Valid till {new Date(membership[0]?.valid_till).toLocaleDateString('en-IN')}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-red-500 to-rose-600 p-4 text-white text-center">
                <div className="flex items-center justify-center gap-2 font-bold mb-1">
                  <span className="material-symbols-outlined text-lg">error</span>
                  Membership Expired
                </div>
                <div className="text-red-50 text-sm">Renew immediately to restore access</div>
              </div>
            )}

            <div className="p-6 md:p-8 flex-1">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                  <p className="text-red-700 text-sm flex items-start gap-2">
                    <span className="material-symbols-outlined text-base">info</span>
                    {error}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full mb-4 tracking-wide uppercase">Pro Plan</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-gray-900">₹1,500</span>
                  <span className="text-gray-500 font-medium">/ 28 days</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-green-500 shrink-0">check_circle</span>
                  <span className="text-gray-600 text-sm">Access to all dashboard features</span>
                </div>
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-green-500 shrink-0">check_circle</span>
                  <span className="text-gray-600 text-sm">Secure Razorpay Checkout</span>
                </div>
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-green-500 shrink-0">check_circle</span>
                  <span className="text-gray-600 text-sm">Instant activation upon payment</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={paying}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mb-4"
              >
                {paying ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">lock</span>
                    Pay ₹1,500 Securely
                  </>
                )}
              </button>
              
              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                Secured by Razorpay
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
