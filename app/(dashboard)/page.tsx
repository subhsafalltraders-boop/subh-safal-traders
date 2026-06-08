import { createServerClient } from '@/lib/supabase/server';
import type { Bill, Payment } from '@/lib/types';
import Link from 'next/link';
import { Suspense, cache } from 'react';

export const dynamic = 'force-dynamic';

// Cached data fetching to prevent duplicate DB calls across components
const getOutstandingData = cache(async () => {
  const supabase = createServerClient();
  const [billsRes, paymentsRes] = await Promise.all([
    supabase.from('bills').select('vendor_id, vendor_name, grand_total'),
    supabase.from('payments').select('vendor_id, total_received')
  ]);
  
  const vendorOutstanding = new Map<string, { name: string, outstanding: number }>();
  
  (billsRes.data as any[] || []).forEach(b => {
    const v = vendorOutstanding.get(b.vendor_id) || { name: b.vendor_name, outstanding: 0 };
    v.outstanding += (b.grand_total || 0);
    vendorOutstanding.set(b.vendor_id, v);
  });
  
  (paymentsRes.data as any[] || []).forEach(p => {
    if (vendorOutstanding.has(p.vendor_id)) {
      const v = vendorOutstanding.get(p.vendor_id)!;
      v.outstanding -= (p.total_received || 0);
      vendorOutstanding.set(p.vendor_id, v);
    }
  });

  const vendorList = Array.from(vendorOutstanding.values())
    .filter(v => Math.round(v.outstanding) !== 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const totalOutstandingGlobal = vendorList.reduce((sum, v) => sum + v.outstanding, 0);

  return { vendorList, totalOutstandingGlobal };
});

async function TotalOutstandingCard() {
  const { totalOutstandingGlobal } = await getOutstandingData();
  
  return (
    <div className="bg-surface border border-outline-variant/50 rounded-2xl p-lg shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 bg-error/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
      <div className="flex justify-between items-start mb-sm relative z-10">
        <span className="font-label-lg text-on-surface-variant">Total Outstanding</span>
        <div className="bg-error/10 p-sm rounded-xl">
          <span className="material-symbols-outlined text-error text-[20px]">warning</span>
        </div>
      </div>
      <div className={`font-headline-lg table-lining-figures relative z-10 ${totalOutstandingGlobal > 0 ? 'text-error' : 'text-[#166534]'}`}>
        ₹{totalOutstandingGlobal.toLocaleString('en-IN')}
      </div>
    </div>
  );
}

function TotalOutstandingSkeleton() {
  return (
    <div className="bg-surface border border-outline-variant/50 rounded-2xl p-lg shadow-sm animate-pulse">
      <div className="flex justify-between items-start mb-sm">
        <div className="h-6 w-32 bg-surface-variant/50 rounded"></div>
        <div className="h-10 w-10 bg-surface-variant/50 rounded-xl"></div>
      </div>
      <div className="h-10 w-40 bg-surface-variant/50 rounded mt-sm"></div>
    </div>
  );
}

async function VendorOutstandingList() {
  const { vendorList } = await getOutstandingData();
  
  return (
    <div className="bg-surface border border-outline-variant/50 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300">
      <div className="px-lg py-md border-b border-outline-variant/30 bg-surface/50 backdrop-blur-sm flex justify-between items-center">
        <h3 className="font-headline-sm text-on-surface flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">account_balance</span>
          Vendor Outstanding
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {vendorList.length === 0 ? (
          <div className="p-xl text-center text-on-surface-variant flex flex-col items-center gap-sm">
            <span className="material-symbols-outlined text-[48px] opacity-20">check_circle</span>
            All accounts settled.
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/30">
            {vendorList.map((v, i) => (
              <li key={i} className="flex justify-between items-center px-lg py-md hover:bg-surface-container-low transition-colors group">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:bg-primary group-hover:text-white transition-colors">
                    {v.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-body-md text-on-surface font-medium truncate max-w-[150px]">{v.name}</span>
                </div>
                <span className={`font-label-lg table-lining-figures px-md py-xs rounded-full ${v.outstanding > 0 ? 'bg-error/10 text-error' : 'bg-[#166534]/10 text-[#166534]'}`}>
                  ₹{Math.abs(v.outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  {v.outstanding < 0 ? ' (Adv)' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VendorListSkeleton() {
  return (
    <div className="bg-surface border border-outline-variant/50 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full animate-pulse">
      <div className="px-lg py-md border-b border-outline-variant/30 flex justify-between items-center">
        <div className="h-6 w-48 bg-surface-variant/50 rounded"></div>
      </div>
      <div className="p-md space-y-md">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between items-center px-sm">
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 rounded-full bg-surface-variant/50"></div>
              <div className="h-5 w-32 bg-surface-variant/50 rounded"></div>
            </div>
            <div className="h-8 w-24 bg-surface-variant/50 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const quickNavItems = [
  { name: 'Billing', href: '/billing', icon: 'receipt_long', desc: 'Create new invoices', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
  { name: 'Payments', href: '/payments', icon: 'payments', desc: 'Record collections', color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
  { name: 'Settlements', href: '/settlements', icon: 'account_balance_wallet', desc: 'Settle van stock', color: 'from-orange-500 to-red-600', shadow: 'shadow-orange-500/20' },
  { name: 'Vendors', href: '/vendors', icon: 'storefront', desc: 'Manage shopkeepers', color: 'from-purple-500 to-fuchsia-600', shadow: 'shadow-purple-500/20' },
  { name: 'Products', href: '/products', icon: 'inventory_2', desc: 'Stock inventory', color: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/20' },
  { name: 'Reports', href: '/reports', icon: 'assessment', desc: 'View analytics', color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20' },
];

export default async function DashboardPage() {
  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  const [
    { data: billsToday },
    { data: paymentsToday },
    { count: activeVendorsCount },
    { data: recentBills }
  ] = await Promise.all([
    supabase.from('bills').select('grand_total').eq('date', today),
    supabase.from('payments').select('total_received').eq('date', today),
    supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('bills').select('*').eq('date', today).order('created_at', { ascending: false })
  ]);

  const totalSalesToday = (billsToday as unknown as Bill[] | null)?.reduce((sum, bill) => sum + (bill.grand_total || 0), 0) || 0;
  const totalCollectionToday = (paymentsToday as unknown as Payment[] | null)?.reduce((sum, payment) => sum + (payment.total_received || 0), 0) || 0;
  const todayOutstanding = totalSalesToday - totalCollectionToday;

  return (
    <div className="bg-background min-h-full">
      {/* Page Header */}
      <div className="px-md md:px-container-padding py-xl bg-gradient-to-r from-primary/5 to-transparent border-b border-outline-variant/30 sticky top-16 md:top-0 z-30 backdrop-blur-md">
        <div>
          <h2 className="font-headline-lg hidden md:block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container font-bold">Dashboard Overview</h2>
          <h2 className="font-headline-lg-mobile md:hidden text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container font-bold">Overview</h2>
          <p className="font-body-lg text-on-surface-variant mt-sm">Welcome back. Here is your summary for {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="p-md md:p-container-padding flex flex-col gap-xl">
        
        {/* Quick Navigation Cards */}
        <div>
          <h3 className="font-headline-sm text-on-surface mb-md">Quick Navigation</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md">
            {quickNavItems.map((item) => (
              <Link key={item.name} href={item.href} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.color} p-lg text-white shadow-lg ${item.shadow} hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}>
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                <div className="relative z-10 flex flex-col items-center text-center gap-sm">
                  <span className="material-symbols-outlined text-[40px] drop-shadow-md group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                  <span className="font-label-lg font-bold tracking-wide">{item.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
          {/* Total Sales */}
          <div className="bg-surface border border-outline-variant/50 rounded-2xl p-lg shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 bg-primary/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-sm relative z-10">
              <span className="font-label-lg text-on-surface-variant">Aaj ki Sales</span>
              <div className="bg-primary/10 p-sm rounded-xl text-primary">
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              </div>
            </div>
            <div className="font-headline-lg text-on-surface table-lining-figures relative z-10">
              ₹{totalSalesToday.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Collection */}
          <div className="bg-surface border border-outline-variant/50 rounded-2xl p-lg shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 bg-[#166534]/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-sm relative z-10">
              <span className="font-label-lg text-on-surface-variant">Aaj ka Collection</span>
              <div className="bg-[#166534]/10 p-sm rounded-xl text-[#166534]">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
            </div>
            <div className="font-headline-lg text-[#166534] table-lining-figures relative z-10">
              ₹{totalCollectionToday.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Aaj ka Outstanding */}
          <div className="bg-surface border border-outline-variant/50 rounded-2xl p-lg shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 bg-[#9a3412]/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-sm relative z-10">
              <span className="font-label-lg text-on-surface-variant">Aaj ka Outstanding</span>
              <div className="bg-[#9a3412]/10 p-sm rounded-xl text-[#9a3412]">
                <span className="material-symbols-outlined text-[20px]">trending_down</span>
              </div>
            </div>
            <div className={`font-headline-lg table-lining-figures relative z-10 ${todayOutstanding > 0 ? 'text-[#9a3412]' : 'text-[#166534]'}`}>
              {todayOutstanding > 0 ? '+' : ''}₹{todayOutstanding.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Active Vendors */}
          <div className="bg-surface border border-outline-variant/50 rounded-2xl p-lg shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 bg-secondary/5 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-sm relative z-10">
              <span className="font-label-lg text-on-surface-variant">Active Vendors</span>
              <div className="bg-secondary/10 p-sm rounded-xl text-secondary">
                <span className="material-symbols-outlined text-[20px]">group</span>
              </div>
            </div>
            <div className="font-headline-lg text-on-surface table-lining-figures relative z-10">
              {activeVendorsCount || 0}
            </div>
          </div>

          {/* Total Global Outstanding - Suspense */}
          <Suspense fallback={<TotalOutstandingSkeleton />}>
            <TotalOutstandingCard />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg flex-1">
          {/* Detailed Report Table (2/3 width on large screens) */}
          <div className="lg:col-span-2 bg-surface border border-outline-variant/50 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-300">
            <div className="px-lg py-md border-b border-outline-variant/30 bg-surface/50 backdrop-blur-sm flex justify-between items-center">
              <h3 className="font-headline-sm text-on-surface flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                Today's Bills
              </h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-outline-variant/30">
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">Bill No.</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">Vendor</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider text-right">Total</th>
                    <th className="px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-on-surface divide-y divide-outline-variant/30">
                  {!recentBills || recentBills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-lg py-2xl text-center text-on-surface-variant">
                        <div className="flex flex-col items-center gap-sm">
                          <span className="material-symbols-outlined text-[48px] opacity-20">inventory_2</span>
                          No bills recorded today yet.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (recentBills as unknown as Bill[] | null)?.map((bill) => (
                      <tr key={bill.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-lg py-md font-medium text-primary">{bill.bill_number}</td>
                        <td className="px-lg py-md truncate max-w-[150px] font-medium">{bill.vendor_name}</td>
                        <td className="px-lg py-md text-right table-lining-figures font-bold text-on-surface">₹{bill.grand_total.toLocaleString('en-IN')}</td>
                        <td className="px-lg py-md text-on-surface-variant text-sm">
                          {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendor-wise Outstanding List - Suspense */}
          <Suspense fallback={<VendorListSkeleton />}>
            <VendorOutstandingList />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
