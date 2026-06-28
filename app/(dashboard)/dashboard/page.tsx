'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type VendorBilling = {
  name: string;
  total: number;
};

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  

  
  const [data, setData] = useState({
    totalSalesToday: 0,
    profitToday: 0,
    billsCountToday: 0,
    activeVendorsCount: 0,
    vendorBillingThisMonth: [] as VendorBilling[],
    membership: null as any
  });

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];

      const [
        { data: billsToday, count: billsCountToday },
        { count: activeVendorsCount },
        { data: billsThisMonth }
      ] = await Promise.all([
        supabase.from('bills').select('grand_total, total_profit', { count: 'exact' }).eq('date', todayStr).eq('is_deleted', false),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('bills').select('vendor_id, vendor_name, grand_total').gte('date', firstDayStr).eq('is_deleted', false)
      ]);

      // Membership fetch — wrapped in try/catch, fail open
      let membershipData = null;
      try {
        const { data: mData } = await (supabase as any)
          .from('membership')
          .select('valid_till')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (mData?.valid_till) {
          const validTill = new Date(mData.valid_till);
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const diff = Math.ceil((validTill.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          membershipData = { valid_till: mData.valid_till, days_remaining: diff };
        }
      } catch { /* fail open — don't show card */ }

      const totalSalesToday = (billsToday as any[])?.reduce((sum, bill) => sum + (Number(bill.grand_total) || 0), 0) || 0;
      const profitToday = (billsToday as any[])?.reduce((sum, bill) => sum + (Number(bill.total_profit) || 0), 0) || 0;

      // Vendor-wise billing this month
      const vendorBillingMap = new Map<string, VendorBilling>();
      (billsThisMonth as any[] || [])?.forEach(b => {
        const v = vendorBillingMap.get(b.vendor_id) || { name: b.vendor_name, total: 0 };
        v.total += (Number(b.grand_total) || 0);
        vendorBillingMap.set(b.vendor_id, v);
      });

      const vendorBillingThisMonth = Array.from(vendorBillingMap.values())
        .sort((a, b) => b.total - a.total);

      // Fallback for activeVendorsCount if 'active' column wasn't created yet and it fails
      let finalActiveCount = activeVendorsCount || 0;
      if (activeVendorsCount === null) {
        const { count: fallbackCount } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true);
        finalActiveCount = fallbackCount || 0;
      }

      setData({
        totalSalesToday,
        profitToday,
        billsCountToday: billsCountToday || 0,
        activeVendorsCount: finalActiveCount,
        vendorBillingThisMonth,
        membership: membershipData
      });

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg animate-pulse">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center border-b border-outline-variant/30 pb-lg mt-md">
          <div className="h-8 w-48 bg-surface-variant rounded mb-2"></div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex gap-md">
           <div className="h-16 w-1/2 bg-surface-variant rounded-2xl"></div>
           <div className="h-16 w-1/2 bg-surface-variant rounded-2xl"></div>
        </div>

        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-outline-variant rounded-2xl p-md">
              <div className="h-4 w-24 bg-surface-variant rounded mb-sm"></div>
              <div className="h-8 w-32 bg-surface-variant rounded"></div>
            </div>
          ))}
        </div>

        {/* List Skeleton */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-md">
          <div className="h-6 w-40 bg-surface-variant rounded mb-md"></div>
          <div className="space-y-sm">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-surface-variant rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }



  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block">
        <div className="px-md md:px-container-padding py-lg border-b border-outline-variant/30 bg-surface-container-lowest sticky top-0 z-30">
          <h2 className="font-headline-lg text-headline-lg hidden md:block">Dashboard</h2>
        </div>

        <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
          
          {/* Quick Actions (Lighter Colors, Square Cards) */}
          <div className="flex gap-md justify-center">
            <Link href="/billing" className="w-[140px] h-[100px] bg-[#E3F2FD] border-[1.5px] border-[#1565C0] rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#BBDEFB] transition-all shadow-sm">
              <span className="material-symbols-outlined text-[28px] text-[#1565C0]">add_circle</span>
              <span className="text-[13px] text-[#1565C0] font-medium">New Bill</span>
            </Link>
            <Link href="/payments" className="w-[140px] h-[100px] bg-[#E8F5E9] border-[1.5px] border-[#2E7D32] rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#C8E6C9] transition-all shadow-sm">
              <span className="material-symbols-outlined text-[28px] text-[#2E7D32]">payments</span>
              <span className="text-[13px] text-[#2E7D32] font-medium">Record Payment</span>
            </Link>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
            {/* Membership — only show if data loaded */}
            {data.membership && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
                <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Membership</span>
                <div className={`font-display-sm mt-sm table-lining-figures font-bold ${data.membership.days_remaining < 3 ? 'text-red-600' : data.membership.days_remaining <= 7 ? 'text-orange-600' : 'text-green-600'}`}>
                  {data.membership.days_remaining} Days Left
                </div>
                <div className="text-xs text-on-surface-variant mt-1">
                  Valid till: {new Date(data.membership.valid_till).toLocaleDateString('en-IN')}
                </div>
              </div>
            )}
            {/* Total Sales Today */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Today's Total Sales</span>
              <div className="font-display-sm text-primary mt-sm table-lining-figures">
                ₹{data.totalSalesToday.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Aaj ka Profit */}
            <div className="bg-[#dcfce7]/30 border border-[#166534]/20 rounded-2xl p-md shadow-sm flex flex-col justify-center">
              <span className="font-label-lg text-[#166534]/80 uppercase tracking-wider text-xs">Aaj ka Profit</span>
              <div className="font-display-sm text-[#166534] mt-sm table-lining-figures font-bold">
                ₹{data.profitToday.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Total Bills Cut Today */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Bills Cut Today</span>
              <div className="font-display-sm text-on-surface mt-sm table-lining-figures">
                {data.billsCountToday}
              </div>
            </div>

            {/* Active Vendors */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Total Active Vendors</span>
              <div className="font-display-sm text-on-surface mt-sm table-lining-figures">
                {data.activeVendorsCount}
              </div>
            </div>
          </div>

          {/* Vendor Comparison (Billing This Month) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-md py-sm border-b border-outline-variant bg-surface">
              <h3 className="font-headline-sm text-on-surface">Top 5 Vendors (This Month)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-md py-sm font-label-md text-on-surface-variant w-[60%]">Vendor Name</th>
                    <th className="px-md py-sm font-label-md text-on-surface-variant w-[40%] text-right">Total Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {data.vendorBillingThisMonth.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-md py-xl text-center text-on-surface-variant">No bills cut this month yet.</td>
                    </tr>
                  ) : (
                    data.vendorBillingThisMonth.slice(0, 5).map((v, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-md py-sm font-medium text-on-surface">{v.name}</td>
                        <td className="px-md py-sm font-bold text-primary text-right table-lining-figures">₹{v.total.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden">
        <main className="flex-1 px-[16px] py-[12px] flex flex-col gap-[12px]">
          {/* Primary Actions Grid */}
          <div className="grid grid-cols-2 gap-[12px] mb-2">
            <Link href="/billing" className="h-[48px] bg-primary text-on-primary rounded-lg font-bold flex flex-col items-center justify-center gap-1 active:opacity-90 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                <span className="text-[14px]">New Bill</span>
              </div>
            </Link>
            <Link href="/payments" className="h-[48px] bg-surface text-primary border border-primary rounded-lg font-bold flex flex-col items-center justify-center gap-1 active:bg-surface-container-low shadow-sm">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                <span className="text-[14px]">Record Pay</span>
              </div>
            </Link>
          </div>
          
          {/* Stats Cards Bento Layout */}
          <div className="grid grid-cols-2 gap-[12px] mb-2">
            {/* Large Stat */}
            <div className="col-span-2 bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-container opacity-10 rounded-full"></div>
              <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="font-label-caption text-[14px] text-on-surface-variant">Today's Sales</span>
                <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
              </div>
              <div className="font-rupee-currency text-[28px] leading-[36px] font-bold text-primary relative z-10">
                ₹{data.totalSalesToday.toLocaleString('en-IN')}
              </div>
            </div>
            
            {/* Aaj ka Profit */}
            <div className="col-span-2 bg-[#dcfce7]/30 border border-[#166534]/20 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#166534] opacity-5 rounded-full"></div>
              <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="font-label-caption text-[14px] text-[#166534]/80">Aaj ka Profit</span>
                <span className="material-symbols-outlined text-[#166534] text-[20px]">account_balance_wallet</span>
              </div>
              <div className="font-rupee-currency text-[28px] leading-[36px] font-bold text-[#166534] relative z-10">
                ₹{data.profitToday.toLocaleString('en-IN')}
              </div>
            </div>
            
            {/* Small Stat 1 */}
            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-3 flex flex-col justify-between">
              <span className="font-label-caption text-[14px] text-on-surface-variant mb-2">Bills Cut Today</span>
              <div className="font-value-display text-[18px] text-on-surface font-bold">{data.billsCountToday}</div>
            </div>
            
            {/* Small Stat 2 */}
            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-3 flex flex-col justify-between">
              <span className="font-label-caption text-[14px] text-on-surface-variant mb-2">Active Vendors</span>
              <div className="font-value-display text-[18px] text-on-surface font-bold">{data.activeVendorsCount}</div>
            </div>
          </div>
          
          {/* Top Vendors List */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-title-main text-[16px] font-bold text-on-surface">Top Vendors (This Month)</h2>
              <Link href="/reports" className="text-primary font-label-caption text-[14px] active:opacity-70">View All</Link>
            </div>
            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden flex flex-col">
              {data.vendorBillingThisMonth.length === 0 ? (
                <div className="p-4 text-center text-on-surface-variant text-[14px]">No bills cut this month yet.</div>
              ) : (
                data.vendorBillingThisMonth.slice(0, 5).map((v, index) => {
                  const initials = v.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  const colors = ['bg-secondary-container text-on-secondary-container', 'bg-primary-container text-on-primary-container', 'bg-surface-container-highest text-on-surface', 'bg-tertiary-container text-on-tertiary-container', 'bg-surface-variant text-on-surface-variant'];
                  const colorClass = colors[index % colors.length];
                  
                  return (
                    <div key={index} className={`flex justify-between items-center p-3 ${index < data.vendorBillingThisMonth.slice(0, 5).length - 1 ? 'border-b border-outline-variant/30' : ''} active:bg-surface-container-low`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] ${colorClass}`}>
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-body-standard text-[14px] font-semibold text-on-surface">{v.name}</span>
                        </div>
                      </div>
                      <span className="font-rupee-currency text-[16px] font-bold text-on-surface">₹{v.total.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
