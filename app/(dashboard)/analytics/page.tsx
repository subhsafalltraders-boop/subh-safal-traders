'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Product, Bill } from '@/lib/types';

export default function AnalyticsPage() {
  const supabase = createClient();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const [products, setProducts] = useState<any[]>([]);
  
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const isUnlocked = sessionStorage.getItem('analytics_unlocked') === 'true';
    if (isUnlocked) {
      setUnlocked(true);
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      sessionStorage.setItem('analytics_unlocked', 'true');
      setUnlocked(true);
      fetchAnalytics();
    } else {
      toast.error('Incorrect PIN');
      setPin('');
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const today = new Date();
      
      const startOfToday = today.toISOString().split('T')[0];
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

      // Fetch bills
      const { data: billsRaw, error: billsError } = await supabase
        .from('bills')
        .select('date, total_profit')
        .gte('date', startOfMonthStr)
        .eq('is_deleted', false);

      if (billsError) throw billsError;

      const bills = (billsRaw as any[]) || [];
      
      let todayProfit = 0;
      let weekProfit = 0;
      let monthProfit = 0;

      bills.forEach((b: any) => {
        const p = Number(b.total_profit || 0);
        if (b.date >= startOfMonthStr) monthProfit += p;
        if (b.date >= startOfWeekStr) weekProfit += p;
        if (b.date === startOfToday) todayProfit += p;
      });

      setStats({ today: todayProfit, week: weekProfit, month: monthProfit });

      // Fetch products
      const { data: productsRaw, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (prodError) throw prodError;

      const mappedProducts = ((productsRaw as any[]) || []).map((p: any) => {
        const cp = Number(p.cost_price || 0);
        const sp = Number(p.price_per_box || 0);
        const profit = sp - cp;
        const margin = sp > 0 ? (profit / sp) * 100 : 0;
        return { ...p, cp, sp, profit, margin };
      }).sort((a, b) => b.margin - a.margin);

      setProducts(mappedProducts);

    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const syncHistoricalBills = async () => {
    if (!confirm('This will retroactively calculate cost and profit for all past bills. Proceed?')) return;
    setSyncing(true);
    
    try {
      // 1. Fetch products as dictionary
      const { data: prodData } = await supabase.from('products').select('id, cost_price, pieces_per_box');
      const prodDict: Record<string, { cp: number, ppb: number }> = {};
      ((prodData as any[]) || []).forEach((p: any) => {
        prodDict[p.id] = { cp: Number(p.cost_price || 0), ppb: Number(p.pieces_per_box || 1) };
      });

      // 2. Fetch bills missing total_cost
      const { data: billsDataRaw, error: fetchErr } = await supabase
        .from('bills')
        .select('*')
        .or('total_cost.eq.0,total_cost.is.null');

      const billsData = billsDataRaw as any[];

      if (fetchErr) throw fetchErr;
      if (!billsData || billsData.length === 0) {
        toast.success("No historical bills need syncing!");
        setSyncing(false);
        return;
      }

      let updatedCount = 0;
      for (const bill of billsData) {
        let totalCost = 0;
        const items = bill.items || [];
        
        items.forEach((item: any) => {
          const dict = prodDict[item.product_id];
          if (dict) {
            const ppb = dict.ppb || 1;
            const cpPerPiece = dict.cp / ppb;
            const totalPieces = (Number(item.box_qty || 0) * ppb) + Number(item.piece_qty || 0);
            totalCost += (totalPieces * cpPerPiece);
          }
        });

        const totalProfit = Number(bill.grand_total) - totalCost;

        const { error: updateErr } = await (supabase as any)
          .from('bills')
          .update({
            total_cost: Math.round(totalCost),
            total_profit: Math.round(totalProfit)
          })
          .eq('id', bill.id);
          
        if (!updateErr) updatedCount++;
      }

      toast.success(`Successfully synced ${updatedCount} bills!`);
      fetchAnalytics();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSyncing(false);
  };

  if (!unlocked) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center bg-surface p-md min-h-screen">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-xl shadow-sm max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-lg text-primary">
            <span className="material-symbols-outlined text-[32px]">lock</span>
          </div>
          <h1 className="font-headline-sm text-on-surface mb-xs">Analytics Locked</h1>
          <p className="font-body-md text-on-surface-variant mb-xl">Enter PIN to access profit data.</p>
          
          <form onSubmit={handleUnlock} className="flex flex-col gap-md">
            <input 
              type="password" 
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="h-14 text-center text-2xl tracking-[0.5em] font-bold bg-surface border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="••••"
              autoFocus
            />
            <button 
              type="submit"
              disabled={pin.length !== 4}
              className="h-12 bg-primary text-on-primary font-label-lg font-bold rounded-xl disabled:opacity-50 transition-opacity"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen">Loading analytics...</div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen">
      {/* Header */}
      <div className="px-md py-lg border-b border-outline-variant/30 bg-surface-container-lowest sticky top-0 z-30 flex justify-between items-center">
        <h2 className="font-headline-lg text-headline-lg hidden md:block">Profit Analytics</h2>
        <h2 className="font-title-main text-[18px] md:hidden">Profit Analytics</h2>
        
        <button 
          onClick={syncHistoricalBills} 
          disabled={syncing}
          className="flex items-center gap-2 px-md py-sm bg-surface-variant/30 hover:bg-surface-variant/50 text-on-surface-variant text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">{syncing ? 'sync' : 'history'}</span>
          <span className="hidden md:inline">{syncing ? 'Syncing...' : 'Sync Historical Bills'}</span>
        </button>
      </div>

      <div className="p-md md:p-container-padding flex flex-col gap-lg pb-24">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
            <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Today's Net Profit</span>
            <div className="font-display-sm text-primary mt-sm table-lining-figures">
              ₹{stats.today.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
            <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">This Week's Net Profit</span>
            <div className="font-display-sm text-primary mt-sm table-lining-figures">
              ₹{stats.week.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-sm">
            <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">This Month's Net Profit</span>
            <div className="font-display-sm text-primary mt-sm table-lining-figures">
              ₹{stats.month.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Profit by Product Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant bg-surface">
            <h3 className="font-headline-sm text-on-surface">Profit Margins by Product</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-md py-sm font-label-md text-on-surface-variant">Product Name</th>
                  <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Cost (Box)</th>
                  <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Selling (Box)</th>
                  <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Profit (Box)</th>
                  <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {products.map((p, i) => {
                  let colorClass = 'text-error'; // < 10%
                  if (p.margin >= 20) colorClass = 'text-[#166534]'; // Green
                  else if (p.margin >= 10) colorClass = 'text-[#d97706]'; // Orange

                  return (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm font-medium text-on-surface">{p.name}</td>
                      <td className="px-md py-sm font-medium text-on-surface-variant text-right table-lining-figures">₹{p.cp.toLocaleString('en-IN')}</td>
                      <td className="px-md py-sm font-medium text-on-surface text-right table-lining-figures">₹{p.sp.toLocaleString('en-IN')}</td>
                      <td className={`px-md py-sm font-bold text-right table-lining-figures ${colorClass}`}>₹{p.profit.toLocaleString('en-IN')}</td>
                      <td className={`px-md py-sm font-bold text-right table-lining-figures ${colorClass}`}>
                        {p.margin.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-md py-xl text-center text-on-surface-variant">No products found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
