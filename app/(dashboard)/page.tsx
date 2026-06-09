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
    billsCountToday: 0,
    activeVendorsCount: 0,
    vendorBillingThisMonth: [] as VendorBilling[]
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
        supabase.from('bills').select('grand_total', { count: 'exact' }).eq('date', todayStr),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('bills').select('vendor_id, vendor_name, grand_total').gte('date', firstDayStr)
      ]);

      const totalSalesToday = (billsToday as any[])?.reduce((sum, bill) => sum + (Number(bill.grand_total) || 0), 0) || 0;

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
        billsCountToday: billsCountToday || 0,
        activeVendorsCount: finalActiveCount,
        vendorBillingThisMonth
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

  const maxBilling = data.vendorBillingThisMonth[0]?.total || 1; // for relative bar width

  return (
    <>
      <div className="px-md md:px-container-padding py-lg border-b border-outline-variant/30 bg-surface-container-lowest sticky top-16 md:top-0 z-30">
        <h2 className="font-headline-lg text-headline-lg hidden md:block">Dashboard</h2>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:hidden">Dashboard</h2>
      </div>

      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
        
        {/* Quick Actions (Large, Prominent) */}
        <div className="grid grid-cols-2 gap-md">
          <Link href="/billing" className="p-lg bg-primary text-on-primary rounded-2xl flex flex-col items-center justify-center gap-sm hover:bg-primary/90 transition-colors shadow-sm text-center">
            <span className="material-symbols-outlined text-[32px]">add_circle</span>
            <span className="font-headline-sm text-[16px] md:text-[20px]">New Bill</span>
          </Link>
          <Link href="/payments" className="p-lg bg-[#166534] text-white rounded-2xl flex flex-col items-center justify-center gap-sm hover:bg-[#14532d] transition-colors shadow-sm text-center">
            <span className="material-symbols-outlined text-[32px]">payments</span>
            <span className="font-headline-sm text-[16px] md:text-[20px]">Record Payment</span>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {/* Total Sales Today */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
            <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Today's Total Sales</span>
            <div className="font-display-sm text-primary mt-sm table-lining-figures">
              ₹{data.totalSalesToday.toLocaleString('en-IN')}
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
            <h3 className="font-headline-sm text-on-surface">Top Vendors (This Month)</h3>
          </div>
          <div className="p-md flex flex-col gap-md">
            {data.vendorBillingThisMonth.length === 0 ? (
              <p className="text-on-surface-variant text-center py-md">No bills cut this month yet.</p>
            ) : (
              data.vendorBillingThisMonth.map((v, i) => {
                const percentage = Math.max(5, (v.total / maxBilling) * 100);
                return (
                  <div key={i} className="flex flex-col gap-xs">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-on-surface">{v.name}</span>
                      <span className="font-bold text-primary table-lining-figures">₹{v.total.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
      </div>
    </>
  );
}
