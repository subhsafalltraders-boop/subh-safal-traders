'use client';

import { createClient } from '@/lib/supabase/client';
import type { Bill, Payment } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState({
    totalSalesToday: 0,
    totalCollectionToday: 0,
    todayOutstanding: 0,
    totalOutstandingGlobal: 0,
    activeVendorsCount: 0,
    recentBills: [] as Bill[],
    vendorList: [] as { name: string, outstanding: number }[]
  });

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const [
        { data: billsToday },
        { data: paymentsToday },
        { data: allPaymentsTotal },
        { count: activeVendorsCount },
        { data: recentBills },
        { data: allBills }
      ] = await Promise.all([
        supabase.from('bills').select('grand_total').eq('date', today),
        supabase.from('payments').select('total_received').eq('date', today),
        supabase.from('payments').select('vendor_id, total_received'),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('bills').select('*').eq('date', today).order('created_at', { ascending: false }),
        supabase.from('bills').select('vendor_id, vendor_name, grand_total')
      ]);

      const totalSalesToday = (billsToday as any[])?.reduce((sum, bill) => sum + (bill.grand_total || 0), 0) || 0;
      const totalCollectionToday = (paymentsToday as any[])?.reduce((sum, payment) => sum + (payment.total_received || 0), 0) || 0;
      const todayOutstanding = totalSalesToday - totalCollectionToday;

      // Vendor-wise outstanding calculation
      const vendorOutstanding = new Map<string, { name: string, outstanding: number }>();
      (allBills as any[] || [])?.forEach(b => {
        const v = vendorOutstanding.get(b.vendor_id) || { name: b.vendor_name, outstanding: 0 };
        v.outstanding += (b.grand_total || 0);
        vendorOutstanding.set(b.vendor_id, v);
      });
      (allPaymentsTotal as any[] || [])?.forEach(p => {
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

      setData({
        totalSalesToday,
        totalCollectionToday,
        todayOutstanding,
        totalOutstandingGlobal,
        activeVendorsCount: activeVendorsCount || 0,
        recentBills: (recentBills as any[]) || [],
        vendorList
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
          <div>
            <div className="h-8 w-48 bg-surface-variant rounded mb-2"></div>
            <div className="h-4 w-32 bg-surface-variant rounded"></div>
          </div>
          <div className="flex gap-sm">
            <div className="h-10 w-24 bg-surface-variant rounded"></div>
            <div className="h-10 w-36 bg-surface-variant rounded"></div>
            <div className="h-10 w-32 bg-surface-variant rounded"></div>
          </div>
        </div>

        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface border border-outline-variant rounded-lg p-md">
              <div className="flex justify-between items-start mb-sm">
                <div className="h-4 w-24 bg-surface-variant rounded"></div>
                <div className="h-10 w-10 bg-surface-variant rounded-full"></div>
              </div>
              <div className="h-8 w-32 bg-surface-variant rounded"></div>
            </div>
          ))}
        </div>

        {/* Tables Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md flex-1">
          <div className="lg:col-span-2 bg-surface border border-outline-variant rounded-lg p-md">
            <div className="h-6 w-32 bg-surface-variant rounded mb-md"></div>
            <div className="space-y-sm">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 w-full bg-surface-variant rounded"></div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-outline-variant rounded-lg p-md">
            <div className="h-6 w-40 bg-surface-variant rounded mb-md"></div>
            <div className="space-y-sm">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 w-full bg-surface-variant rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header & Controls */}
      <div className="px-md md:px-container-padding py-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md border-b border-outline-variant/30 bg-surface-container-lowest sticky top-16 md:top-0 z-30">
        <div>
          <h2 className="font-headline-lg text-headline-lg hidden md:block">Dashboard Overview</h2>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:hidden">Overview</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Summary for {new Date().toLocaleDateString()}</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-sm">
          <Link href="/billing" className="px-md py-sm bg-primary text-on-primary rounded-DEFAULT font-label-md flex items-center gap-xs hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span> New Bill
          </Link>
          <Link href="/payments" className="px-md py-sm bg-[#166534] text-white rounded-DEFAULT font-label-md flex items-center gap-xs hover:bg-[#14532d] transition-colors">
            <span className="material-symbols-outlined text-[18px]">payments</span> Record Payment
          </Link>
          <Link href="/settlements" className="px-md py-sm bg-[#9a3412] text-white rounded-DEFAULT font-label-md flex items-center gap-xs hover:bg-[#7c2d12] transition-colors">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span> Settlement
          </Link>
        </div>
      </div>

      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
          {/* Total Sales */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Aaj ki Sales</span>
              <div className="bg-primary-container/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-primary-container text-[20px]">receipt_long</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface table-lining-figures">
              ₹{data.totalSalesToday.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Collection */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Aaj ka Collection</span>
              <div className="bg-[#166534]/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-[#166534] text-[20px]">payments</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-[#166534] table-lining-figures">
              ₹{data.totalCollectionToday.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Aaj ka Outstanding */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Aaj ka Outstanding</span>
              <div className="bg-[#9a3412]/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-[#9a3412] text-[20px]">trending_down</span>
              </div>
            </div>
            <div className={`font-headline-lg text-headline-lg table-lining-figures ${data.todayOutstanding > 0 ? 'text-[#9a3412]' : 'text-[#166534]'}`}>
              {data.todayOutstanding > 0 ? '+' : ''}₹{data.todayOutstanding.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Global Outstanding */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Total Outstanding</span>
              <div className="bg-error/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-error text-[20px]">warning</span>
              </div>
            </div>
            <div className={`font-headline-lg text-headline-lg table-lining-figures ${data.totalOutstandingGlobal > 0 ? 'text-error' : 'text-[#166534]'}`}>
              ₹{data.totalOutstandingGlobal.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Active Vendors */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Active Vendors</span>
              <div className="bg-secondary-container/30 p-sm rounded-full">
                <span className="material-symbols-outlined text-on-secondary-container text-[20px]">group</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface table-lining-figures">
              {data.activeVendorsCount}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-md flex-1">
          {/* Detailed Report Table (2/3 width on large screens) */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col">
            <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Today's Bills</h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                    <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4">Bill No.</th>
                    <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4">Vendor</th>
                    <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4 text-right">Total</th>
                    <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4">Time</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
                  {data.recentBills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-md py-lg text-center text-on-surface-variant">
                        No bills recorded today yet.
                      </td>
                    </tr>
                  ) : (
                    data.recentBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-md py-sm font-medium text-primary">{bill.bill_number}</td>
                        <td className="px-md py-sm truncate max-w-[150px]">{bill.vendor_name}</td>
                        <td className="px-md py-sm text-right table-lining-figures font-medium">₹{bill.grand_total.toLocaleString('en-IN')}</td>
                        <td className="px-md py-sm text-on-surface-variant text-sm">
                          {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendor-wise Outstanding List (1/3 width) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col">
            <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Vendor Outstanding</h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px]">
              {data.vendorList.length === 0 ? (
                <div className="p-md text-center text-on-surface-variant">All accounts settled.</div>
              ) : (
                <ul className="divide-y divide-outline-variant/50">
                  {data.vendorList.map((v, i) => (
                    <li key={i} className="flex justify-between items-center px-md py-sm hover:bg-surface-container-low transition-colors">
                      <span className="font-body-md text-on-surface truncate max-w-[150px]">{v.name}</span>
                      <span className={`font-label-md table-lining-figures ${v.outstanding > 0 ? 'text-error' : 'text-[#166534]'}`}>
                        ₹{Math.abs(v.outstanding).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        {v.outstanding < 0 ? ' (Adv)' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
