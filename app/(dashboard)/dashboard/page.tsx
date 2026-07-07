'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type VendorBilling = {
  name: string;
  total: number;
};

type DayTrend = {
  date: string;
  label: string;
  total: number;
};

type AlertVendor = {
  id: string;
  name: string;
};

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState({
    totalSalesToday: 0,
    billsCountToday: 0,
    activeVendorsCount: 0,
    vendorBillingThisMonth: [] as VendorBilling[],
    cashToday: 0,
    upiToday: 0,
    advanceToday: 0,
    outstandingToday: 0,
    purchasesThisMonth: 0,
    trend: [] as DayTrend[],
    noBillVendors: [] as AlertVendor[],
    highOutstandingVendors: [] as (AlertVendor & { amount: number })[],
  });

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const [
        { data: billsToday, count: billsCountToday },
        { data: vendorsActive, count: activeVendorsCount },
        { data: billsThisMonth },
        { data: paymentsToday },
        { data: advancesToday },
        { data: last7DaysBills },
        { data: purchasesThisMonthData },
      ] = await Promise.all([
        supabase.from('bills').select('grand_total, vendor_id, vendor_name').eq('date', todayStr).eq('is_deleted', false),
        supabase.from('vendors').select('id, name').eq('active', true),
        supabase.from('bills').select('vendor_id, vendor_name, grand_total').gte('date', firstDayStr).eq('is_deleted', false),
        supabase.from('payments').select('cash_amount, upi_amount, vendor_id').eq('date', todayStr).eq('is_deleted', false),
        (supabase as any).from('vendor_advances').select('amount').eq('date', todayStr),
        supabase.from('bills').select('date, grand_total').gte('date', sevenDaysAgoStr).eq('is_deleted', false),
        (supabase as any).from('purchases').select('total_amount').gte('date', firstDayStr).eq('is_deleted', false),
      ]);

      let vendorRows = vendorsActive as any[] | null;
      let finalActiveCount = activeVendorsCount || 0;
      if (activeVendorsCount === null) {
        const fallback = await supabase.from('vendors').select('id, name').eq('is_active', true);
        vendorRows = fallback.data as any[] | null;
        finalActiveCount = fallback.data?.length || 0;
      }

      const totalSalesToday = (billsToday as any[])?.reduce((sum, bill) => sum + (Number(bill.grand_total) || 0), 0) || 0;

      // Vendor-wise billing this month
      const vendorBillingMap = new Map<string, VendorBilling>();
      (billsThisMonth as any[] || [])?.forEach(b => {
        const v = vendorBillingMap.get(b.vendor_id) || { name: b.vendor_name, total: 0 };
        v.total += (Number(b.grand_total) || 0);
        vendorBillingMap.set(b.vendor_id, v);
      });
      const vendorBillingThisMonth = Array.from(vendorBillingMap.values()).sort((a, b) => b.total - a.total);

      // Cash / UPI split today
      const cashToday = (paymentsToday as any[] || []).reduce((s, p) => s + (Number(p.cash_amount) || 0), 0);
      const upiToday = (paymentsToday as any[] || []).reduce((s, p) => s + (Number(p.upi_amount) || 0), 0);
      const advanceToday = (advancesToday as any[] || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
      const outstandingToday = Math.max(0, totalSalesToday - (cashToday + upiToday));
      const purchasesThisMonth = (purchasesThisMonthData as any[] || []).reduce((s, p) => s + (Number(p.total_amount) || 0), 0);

      // 7-day trend
      const trendMap = new Map<string, number>();
      (last7DaysBills as any[] || []).forEach(b => {
        trendMap.set(b.date, (trendMap.get(b.date) || 0) + (Number(b.grand_total) || 0));
      });
      const trend: DayTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        trend.push({
          date: dStr,
          label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          total: trendMap.get(dStr) || 0,
        });
      }

      // Alerts: vendors with no bill today
      const billedVendorIds = new Set((billsToday as any[] || []).map(b => b.vendor_id));
      const noBillVendors: AlertVendor[] = (vendorRows || [])
        .filter(v => !billedVendorIds.has(v.id))
        .map(v => ({ id: v.id, name: v.name }));

      // Alerts: high outstanding vendors this month (billed - paid, per vendor)
      const paidMap = new Map<string, number>();
      const { data: paymentsThisMonth } = await supabase
        .from('payments')
        .select('vendor_id, cash_amount, upi_amount')
        .gte('date', firstDayStr)
        .eq('is_deleted', false);
      (paymentsThisMonth as any[] || []).forEach(p => {
        paidMap.set(p.vendor_id, (paidMap.get(p.vendor_id) || 0) + (Number(p.cash_amount) || 0) + (Number(p.upi_amount) || 0));
      });
      const billedMap = new Map<string, { name: string; total: number }>();
      (billsThisMonth as any[] || []).forEach(b => {
        const cur = billedMap.get(b.vendor_id) || { name: b.vendor_name, total: 0 };
        cur.total += Number(b.grand_total) || 0;
        billedMap.set(b.vendor_id, cur);
      });
      const highOutstandingVendors = Array.from(billedMap.entries())
        .map(([id, v]) => ({ id, name: v.name, amount: v.total - (paidMap.get(id) || 0) }))
        .filter(v => v.amount > 2000)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setData({
        totalSalesToday,
        billsCountToday: billsCountToday || 0,
        activeVendorsCount: finalActiveCount,
        vendorBillingThisMonth,
        cashToday,
        upiToday,
        advanceToday,
        outstandingToday,
        purchasesThisMonth,
        trend,
        noBillVendors,
        highOutstandingVendors,
      });

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-lg animate-pulse">
        <div className="flex justify-between items-center border-b border-outline-variant/30 pb-space-lg mt-space-md">
          <div className="h-8 w-48 bg-surface-variant rounded mb-2"></div>
        </div>
        <div className="flex gap-space-md">
           <div className="h-16 w-1/2 bg-surface-variant rounded-2xl"></div>
           <div className="h-16 w-1/2 bg-surface-variant rounded-2xl"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-outline-variant rounded-2xl p-space-md">
              <div className="h-4 w-24 bg-surface-variant rounded mb-space-sm"></div>
              <div className="h-8 w-32 bg-surface-variant rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-surface border border-outline-variant rounded-2xl p-space-md">
          <div className="h-6 w-40 bg-surface-variant rounded mb-space-md"></div>
          <div className="space-y-space-sm">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-surface-variant rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const maxTrend = Math.max(...data.trend.map(t => t.total), 1);
  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block">
        <div className="px-space-md md:px-container-padding py-space-lg border-b border-outline-variant/30 bg-surface-container-lowest sticky top-0 z-30">
          <h2 className="font-headline-lg text-headline-lg hidden md:block">Dashboard</h2>
        </div>

        <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-lg">

          {/* Quick Actions */}
          <div className="flex gap-space-md justify-center">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Today's Total Sales</span>
              <div className="font-display-sm text-primary mt-space-sm table-lining-figures">
                ₹{data.totalSalesToday.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Bills Cut Today</span>
              <div className="font-display-sm text-on-surface mt-space-sm table-lining-figures">
                {data.billsCountToday}
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Total Active Vendors</span>
              <div className="font-display-sm text-on-surface mt-space-sm table-lining-figures">
                {data.activeVendorsCount}
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Outstanding Today</span>
              <div className={`font-display-sm mt-space-sm table-lining-figures ${data.outstandingToday > 0 ? 'text-error' : 'text-[#166534]'}`}>
                ₹{data.outstandingToday.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Money Flow Today */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-space-md py-space-sm border-b border-outline-variant bg-surface">
              <h3 className="font-headline-sm text-on-surface">Money Flow Today</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-outline-variant/30">
              <div className="p-space-md">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">Cash Collected</span>
                <div className="font-headline-sm font-bold text-on-surface mt-1 table-lining-figures">₹{data.cashToday.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-space-md">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">UPI Collected</span>
                <div className="font-headline-sm font-bold text-on-surface mt-1 table-lining-figures">₹{data.upiToday.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-space-md">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">Advance Given</span>
                <div className="font-headline-sm font-bold text-error mt-1 table-lining-figures">₹{data.advanceToday.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-space-md">
                <span className="text-xs text-on-surface-variant uppercase tracking-wider">Purchases (Month)</span>
                <div className="font-headline-sm font-bold text-on-surface mt-1 table-lining-figures">₹{data.purchasesThisMonth.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* 7-Day Sales Trend */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-space-md py-space-sm border-b border-outline-variant bg-surface">
              <h3 className="font-headline-sm text-on-surface">Last 7 Days Sales</h3>
            </div>
            <div className="p-space-md flex items-end gap-space-sm h-[140px]">
              {data.trend.map((t, i) => (
                <div key={t.date} className="flex-1 flex flex-col items-center justify-end h-full gap-space-xs">
                  <span className="text-[11px] text-on-surface-variant table-lining-figures">
                    {t.total > 0 ? `₹${(t.total / 1000).toFixed(1)}k` : ''}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${i === data.trend.length - 1 ? 'bg-primary' : 'bg-primary/30'}`}
                    style={{ height: `${Math.max(4, (t.total / maxTrend) * 90)}px` }}
                  ></div>
                  <span className="text-[11px] text-on-surface-variant font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vendor Comparison (Billing This Month) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-space-md py-space-sm border-b border-outline-variant bg-surface">
              <h3 className="font-headline-sm text-on-surface">Top 5 Vendors (This Month)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-space-md py-space-sm font-label-md text-on-surface-variant w-[60%]">Vendor Name</th>
                    <th className="px-space-md py-space-sm font-label-md text-on-surface-variant w-[40%] text-right">Total Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {data.vendorBillingThisMonth.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-space-md py-space-xl text-center text-on-surface-variant">No bills cut this month yet.</td>
                    </tr>
                  ) : (
                    data.vendorBillingThisMonth.slice(0, 5).map((v, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-space-md py-space-sm font-medium text-on-surface">{v.name}</td>
                        <td className="px-space-md py-space-sm font-bold text-primary text-right table-lining-figures">₹{v.total.toLocaleString('en-IN')}</td>
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

            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-3 flex flex-col justify-between">
              <span className="font-label-caption text-[14px] text-on-surface-variant mb-2">Bills Cut Today</span>
              <div className="font-value-display text-[18px] text-on-surface font-bold">{data.billsCountToday}</div>
            </div>

            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-3 flex flex-col justify-between">
              <span className="font-label-caption text-[14px] text-on-surface-variant mb-2">Active Vendors</span>
              <div className="font-value-display text-[18px] text-on-surface font-bold">{data.activeVendorsCount}</div>
            </div>

            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-3 flex flex-col justify-between">
              <span className="font-label-caption text-[14px] text-on-surface-variant mb-2">Cash / UPI Today</span>
              <div className="font-value-display text-[15px] text-on-surface font-bold">₹{data.cashToday.toLocaleString('en-IN')} / ₹{data.upiToday.toLocaleString('en-IN')}</div>
            </div>

            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-3 flex flex-col justify-between">
              <span className="font-label-caption text-[14px] text-on-surface-variant mb-2">Outstanding Today</span>
              <div className={`font-value-display text-[18px] font-bold ${data.outstandingToday > 0 ? 'text-error' : 'text-[#166534]'}`}>₹{data.outstandingToday.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* 7-Day Trend */}
          <div className="mb-2">
            <h2 className="font-title-main text-[16px] font-bold text-on-surface mb-2">Last 7 Days</h2>
            <div className="bg-surface shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] rounded-xl p-4 flex items-end gap-2 h-[120px]">
              {data.trend.map((t, i) => (
                <div key={t.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <div
                    className={`w-full rounded-t-md transition-all ${i === data.trend.length - 1 ? 'bg-primary' : 'bg-primary/30'}`}
                    style={{ height: `${Math.max(4, (t.total / maxTrend) * 70)}px` }}
                  ></div>
                  <span className="text-[10px] text-on-surface-variant font-medium">{t.label}</span>
                </div>
              ))}
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
