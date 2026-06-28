'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Bill, Product } from '@/lib/types';

export default function ProfitPage() {
  const supabase = createClient();
  
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [recalculating, setRecalculating] = useState(false);

  const recalculateProfits = async () => {
    if (!confirm('This will recalculate profit for ALL bills based on current product cost. Proceed?')) return;
    setRecalculating(true);
    try {
      let updatedCount = 0;
      for (const bill of bills) {
        let total_profit = 0;
        const items = (bill.items as any[]) || [];
        
        items.forEach(item => {
          const product = products.find(p => p.id === item.product_id);
          const cp_box = product?.cost_per_box || 0;
          const p_box = Number(item.price_per_box) || 0;
          
          if (product && cp_box > 0) {
            const profit_box = p_box - cp_box;
            total_profit += (Number(item.box_qty) || 0) * profit_box;
          }
        });

        // if (total_profit !== Number(bill.total_profit)) {
        // Just update it to be safe
        await supabase.from('bills').update({ total_profit: Math.round(total_profit) }).eq('id', bill.id);
        updatedCount++;
        // }
      }
      toast.success(`Recalculated profits for ${updatedCount} bills.`);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to recalculate: ' + e.message);
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [billsRes, productsRes] = await Promise.all([
      supabase.from('bills').select('*').eq('is_deleted', false),
      supabase.from('products').select('*').eq('is_active', true)
    ]);

    if (billsRes.data) setBills(billsRes.data as Bill[]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    setLoading(false);
  };

  // ---- DATE CALCULATIONS ----
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // ---- STATS ----
  const todayProfit = useMemo(() => bills.filter(b => b.date === todayStr).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, todayStr]);
  const weekProfit = useMemo(() => bills.filter(b => b.date >= weekStartStr && b.date <= todayStr).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, weekStartStr, todayStr]);
  const monthProfit = useMemo(() => bills.filter(b => b.date >= monthStart && b.date <= todayStr).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, monthStart, todayStr]);
  const yearProfit = useMemo(() => bills.filter(b => b.date >= yearStart && b.date <= yearEnd).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, yearStart, yearEnd]);

  // ---- FILTERED DATA ----
  const rangeBills = useMemo(() => bills.filter(b => b.date >= dateFrom && b.date <= dateTo), [bills, dateFrom, dateTo]);

  const productProfitSummary = useMemo(() => {
    const summary: Record<string, { name: string; box_qty: number; revenue: number; profit: number }> = {};
    
    rangeBills.forEach(b => {
      (b.items as any[])?.forEach((item: any) => {
        const pId = item.product_id;
        if (!pId) return;
        
        const product = products.find(p => p.id === pId);
        const cp_box = product?.cost_per_box || 0;
        
        // Skip if cost is 0 or null
        if (!cp_box) return;

        if (!summary[pId]) summary[pId] = { name: item.product_name, box_qty: 0, revenue: 0, profit: 0 };
        
        const boxQ = Number(item.box_qty) || 0;
        const p_box = Number(item.price_per_box) || 0;
        
        summary[pId].box_qty += boxQ;
        summary[pId].revenue += (boxQ * p_box);
        summary[pId].profit += (boxQ * (p_box - cp_box));
      });
    });
    
    return Object.values(summary).sort((a, b) => b.profit - a.profit);
  }, [rangeBills, products]);

  if (loading) {
     return <div className="p-4 flex justify-center items-center h-full text-on-surface-variant">Loading profit data...</div>;
  }

  return (
    <div className="p-4 md:p-8 flex-1 flex-col gap-6 overflow-y-auto h-full pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="font-title-main text-[24px] font-bold text-on-surface">Profit Tracking</h2>
          <p className="font-body-standard text-on-surface-variant mt-1">Real-time profit analysis</p>
        </div>
        <div>
          <button onClick={recalculateProfits} disabled={recalculating} className="text-xs px-3 py-1 bg-surface-container-high rounded border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface-variant disabled:opacity-50">
            {recalculating ? 'Recalculating...' : 'Recalculate All Profits'}
          </button>
        </div>
      </div>

      {/* TOP SECTION: SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div className="bg-[#dcfce7]/30 border border-[#166534]/20 p-4 rounded-xl shadow-sm flex flex-col">
          <span className="font-label-caption text-[#166534]/80 uppercase tracking-wider mb-2">Aaj ka Profit</span>
          <span className="font-value-display text-[24px] text-[#166534] font-bold">₹{todayProfit.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm flex flex-col">
          <span className="font-label-caption text-blue-700/80 uppercase tracking-wider mb-2">Is Hafte ka Profit</span>
          <span className="font-value-display text-[24px] text-blue-700 font-bold">₹{weekProfit.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl shadow-sm flex flex-col">
          <span className="font-label-caption text-purple-700/80 uppercase tracking-wider mb-2">Is Mahine ka Profit</span>
          <span className="font-value-display text-[24px] text-purple-700 font-bold">₹{monthProfit.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm flex flex-col">
          <span className="font-label-caption text-orange-700/80 uppercase tracking-wider mb-2">Is Saal ka Profit</span>
          <span className="font-value-display text-[24px] text-orange-700 font-bold">₹{yearProfit.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4 items-end bg-surface-container-low p-4 rounded-xl">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1 uppercase tracking-wider">From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 bg-surface border border-outline-variant rounded-lg font-body-sm text-[14px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1 uppercase tracking-wider">To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 bg-surface border border-outline-variant rounded-lg font-body-sm text-[14px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none" />
        </div>
      </div>

      {/* MIDDLE SECTION: BILLS TABLE */}
      <div className="mt-8">
        <h3 className="font-title-main text-[18px] font-bold text-on-surface mb-4">Bills Profit</h3>
        <div className="bg-surface shadow-sm border border-outline-variant/30 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-[14px]">
                <th className="px-4 py-3 font-medium text-on-surface-variant">Bill Number</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant">Vendor Name</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Grand Total</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Profit (₹)</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Profit %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {rangeBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">No bills found for this period.</td>
                </tr>
              ) : (
                rangeBills.map((bill) => {
                  const profit = Number(bill.total_profit) || 0;
                  const total = Number(bill.grand_total) || 0;
                  const margin = (profit > 0 && total > 0) ? ((profit / total) * 100).toFixed(1) : 0;
                  return (
                    <tr key={bill.id} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="px-4 py-3 font-medium text-on-surface">{bill.bill_number}</td>
                      <td className="px-4 py-3 text-on-surface">{bill.vendor_name}</td>
                      <td className="px-4 py-3 text-right text-on-surface">₹{total.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">
                        {profit > 0 ? (
                          <span className="font-bold text-[#166534]">₹{profit.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant text-[14px]">
                        {profit > 0 ? `${margin}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM SECTION: PRODUCT WISE SUMMARY */}
      <div className="mt-8">
        <h3 className="font-title-main text-[18px] font-bold text-on-surface mb-4">Product-wise Profit</h3>
        <div className="bg-surface shadow-sm border border-outline-variant/30 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-[14px]">
                <th className="px-4 py-3 font-medium text-on-surface-variant">Product Name</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Boxes Sold</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Revenue (₹)</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Profit (₹)</th>
                <th className="px-4 py-3 font-medium text-on-surface-variant text-right">Profit %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {productProfitSummary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">No profit data for this period (make sure products have a cost price set).</td>
                </tr>
              ) : (
                productProfitSummary.map((item, idx) => {
                  const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="px-4 py-3 font-medium text-on-surface">{item.name}</td>
                      <td className="px-4 py-3 text-right text-on-surface">{item.box_qty}</td>
                      <td className="px-4 py-3 text-right text-on-surface">₹{item.revenue.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-[#166534]">₹{item.profit.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant text-[14px]">
                        {margin}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
