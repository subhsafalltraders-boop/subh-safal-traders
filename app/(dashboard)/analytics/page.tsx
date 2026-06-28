'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Product, Bill, Payment } from '@/lib/types';

export default function AnalyticsPage() {
  const supabase = createClient();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ today: 0, month: 0, year: 0 });
  
  const [todayBills, setTodayBills] = useState<any[]>([]);
  
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ cost_price: 0, price_per_box: 0 });
  const [savingProduct, setSavingProduct] = useState(false);

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

  const handleLock = () => {
    sessionStorage.removeItem('analytics_unlocked');
    setUnlocked(false);
    setPin('');
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startOfToday = today.toISOString().split('T')[0];
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];

      // Fetch all bills for KPIs
      const { data: billsRaw, error: billsError } = await supabase
        .from('bills')
        .select('id, date, vendor_id, vendor_name, bill_number, grand_total, total_profit')
        .gte('date', startOfYear)
        .eq('is_deleted', false);

      if (billsError) throw billsError;
      const bills = (billsRaw as any[]) || [];
      
      let todayProfit = 0;
      let monthProfit = 0;
      let yearProfit = 0;
      
      const todaysBillsRaw: any[] = [];

      bills.forEach((b: any) => {
        const p = Number(b.total_profit || 0);
        if (b.date >= startOfYear) yearProfit += p;
        if (b.date >= startOfMonth) monthProfit += p;
        if (b.date === startOfToday) {
          todayProfit += p;
          todaysBillsRaw.push(b);
        }
      });

      setStats({ today: todayProfit, month: monthProfit, year: yearProfit });

      // Fetch Today's Payments to match with Bills
      const { data: paymentsRaw, error: paymentsError } = await supabase
        .from('payments')
        .select('vendor_id, total_received, outstanding')
        .eq('date', startOfToday);
      
      if (paymentsError) throw paymentsError;
      
      const payments = (paymentsRaw as any[]) || [];
      const paymentMap = new Map();
      payments.forEach(pay => {
        paymentMap.set(pay.vendor_id, pay);
      });

      // Calculate Realized vs Unrealized Profit per Bill
      const mappedBills = todaysBillsRaw.map(bill => {
        const grandTotal = Number(bill.grand_total || 0);
        const bookedProfit = Number(bill.total_profit || 0);
        const marginPct = grandTotal > 0 ? bookedProfit / grandTotal : 0;
        
        const payment = paymentMap.get(bill.vendor_id);
        // Estimate Received for this specific bill (Assuming payment is directly for this bill on the same day)
        // If they received more than the bill, cap at bill amount.
        const receivedAmount = payment ? Math.min(Number(payment.total_received || 0), grandTotal) : 0;
        const outstandingAmount = grandTotal - receivedAmount;

        const receivedProfit = receivedAmount * marginPct;
        const pendingProfit = outstandingAmount * marginPct;

        return {
          ...bill,
          marginPct,
          receivedAmount,
          outstandingAmount,
          receivedProfit,
          pendingProfit
        };
      });

      setTodayBills(mappedBills);

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

  const handleEditProduct = (product: any) => {
    setEditingProductId(product.id);
    setEditForm({ cost_price: product.cp, price_per_box: product.sp });
  };

  const saveProductMargin = async (productId: string) => {
    setSavingProduct(true);
    try {
      const { error } = await (supabase as any)
        .from('products')
        .update({
          cost_price: Number(editForm.cost_price),
          price_per_box: Number(editForm.price_per_box)
        })
        .eq('id', productId);

      if (error) throw error;
      toast.success('Product margins updated!');
      setEditingProductId(null);
      // Re-fetch products quietly
      const { data } = await supabase.from('products').select('*').eq('is_active', true);
      const mappedProducts = ((data as any[]) || []).map((p: any) => {
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
    setSavingProduct(false);
  };

  const syncHistoricalBills = async () => {
    if (!confirm('This will retroactively calculate cost and profit for all past bills based on current product costs. Proceed?')) return;
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

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // =========================================
  // STATE 1: PIN LOCK SCREEN
  // =========================================
  if (!unlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 w-full p-4">
        <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-800">
            <span className="material-symbols-outlined text-[32px]">shield_lock</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Executive Analytics</h1>
          <p className="text-sm text-slate-500 mb-8">Enter PIN to access</p>
          
          <form onSubmit={handleUnlock} className="flex flex-col gap-6">
            <input 
              type="password" 
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="h-14 text-center text-2xl tracking-[0.75em] font-bold bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none transition-all"
              placeholder="••••"
              autoFocus
            />
            <button 
              type="submit"
              disabled={pin.length !== 4}
              className="h-12 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50 transition-opacity hover:bg-slate-800"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex-1 flex w-full items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  }

  // =========================================
  // STATE 2: UNLOCKED MAIN DASHBOARD
  // =========================================
  return (
    <div className="flex-1 w-full flex flex-col bg-slate-50 min-h-screen pb-24">
      {/* HEADER */}
      <div className="px-4 md:px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Profit Analytics</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Executive Overview</p>
        </div>
        <button 
          onClick={handleLock} 
          className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
          title="Lock Dashboard"
        >
          <span className="material-symbols-outlined text-[20px]">lock_open</span>
        </button>
      </div>

      <div className="p-4 md:p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full">
        
        {/* SECTION A: OVERALL PROFIT KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Profit</span>
            <div className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
              ₹{stats.today.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month's Profit</span>
            <div className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
              ₹{stats.month.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Year's Profit</span>
            <div className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
              ₹{stats.year.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* SECTION B: TODAY'S BILL-WISE PROFIT BREAKDOWN */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-white">
            <h3 className="text-lg font-bold text-slate-900">Today's Profit Breakdown</h3>
            <p className="text-sm text-slate-500 mt-1">Realized vs Unrealized profits based on payments received today.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Bill & Vendor</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Grand Total</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Profit (Booked)</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Received Profit</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Pending Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {todayBills.map((bill, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{bill.vendor_name}</div>
                      <div className="text-xs text-slate-500">{bill.bill_number}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 text-right">₹{Number(bill.grand_total || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 text-right">
                      ₹{Number(bill.total_profit || 0).toLocaleString('en-IN')}
                      <div className="text-[10px] font-normal text-slate-400 mt-0.5">({(bill.marginPct * 100).toFixed(1)}% Margin)</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-green-600 text-right">
                      ₹{Math.round(bill.receivedProfit).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 font-bold text-orange-600 text-right">
                      ₹{Math.round(bill.pendingProfit).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                {todayBills.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No bills generated today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION C: PRODUCT MARGIN MANAGEMENT */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <button 
            onClick={() => setShowProducts(!showProducts)}
            className="w-full px-6 py-5 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⚙️</span>
              <h3 className="text-lg font-bold text-slate-900">View & Manage Per-Product Profit</h3>
            </div>
            <span className="material-symbols-outlined text-slate-400 transition-transform duration-300" style={{ transform: showProducts ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              expand_more
            </span>
          </button>
          
          {showProducts && (
            <div className="border-t border-slate-200">
              <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-200">
                <input 
                  type="text" 
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-12 bg-white border border-slate-300 rounded-xl px-4 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all shadow-sm"
                />
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Product Name</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Cost Price (Box)</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Selling Price (Box)</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Profit (₹)</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Margin (%)</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => {
                      const isEditing = editingProductId === p.id;
                      const hasCost = p.cp > 0;
                      let badgeClass = 'bg-red-100 text-red-700'; // < 10% or missing
                      if (hasCost) {
                        if (p.margin >= 20) badgeClass = 'bg-green-100 text-green-700';
                        else if (p.margin >= 10) badgeClass = 'bg-orange-100 text-orange-700';
                      }

                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-900">{p.name}</td>
                          <td className="px-6 py-4 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.cost_price} onChange={e => setEditForm({...editForm, cost_price: Number(e.target.value)})} className="w-24 border rounded p-1 text-right" />
                            ) : (
                              <span className="text-slate-700">₹{p.cp.toLocaleString('en-IN')}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isEditing ? (
                              <input type="number" value={editForm.price_per_box} onChange={e => setEditForm({...editForm, price_per_box: Number(e.target.value)})} className="w-24 border rounded p-1 text-right" />
                            ) : (
                              <span className="text-slate-700">₹{p.sp.toLocaleString('en-IN')}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            {isEditing ? '-' : `₹${p.profit.toLocaleString('en-IN')}`}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isEditing ? '-' : (
                              hasCost ? (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}`}>
                                  {p.margin.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Cost Missing</span>
                              )
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <button onClick={() => saveProductMargin(p.id)} disabled={savingProduct} className="text-green-600 font-bold text-sm hover:underline">Save</button>
                            ) : (
                              <button onClick={() => handleEditProduct(p)} className="text-slate-400 hover:text-slate-900 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">edit</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col p-4 gap-4 bg-slate-50">
                {filteredProducts.map((p) => {
                  const isEditing = editingProductId === p.id;
                  const hasCost = p.cp > 0;
                  let badgeClass = 'bg-red-100 text-red-700';
                  if (hasCost) {
                    if (p.margin >= 20) badgeClass = 'bg-green-100 text-green-700';
                    else if (p.margin >= 10) badgeClass = 'bg-orange-100 text-orange-700';
                  }

                  return (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-slate-900 leading-tight pr-4">{p.name}</div>
                        {!isEditing && (
                          <button onClick={() => handleEditProduct(p)} className="text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Cost (₹)</label>
                            <input type="number" value={editForm.cost_price} onChange={e => setEditForm({...editForm, cost_price: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm bg-slate-50" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Selling (₹)</label>
                            <input type="number" value={editForm.price_per_box} onChange={e => setEditForm({...editForm, price_per_box: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm bg-slate-50" />
                          </div>
                          <button onClick={() => saveProductMargin(p.id)} disabled={savingProduct} className="col-span-2 mt-2 bg-slate-900 text-white h-10 rounded-lg font-semibold">
                            {savingProduct ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Cost / Selling:</span>
                            <span className="font-medium text-slate-700">₹{p.cp} / ₹{p.sp}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-t border-slate-100 pt-2">
                            <span className="text-slate-500">Profit & Margin:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">₹{p.profit}</span>
                              {hasCost ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>{p.margin.toFixed(1)}%</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Missing</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SECTION D: ADMIN ACTION ZONE */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Admin Tools</h3>
            <p className="text-sm text-slate-500 mt-1">Retroactively sync cost data to historical bills.</p>
          </div>
          <button 
            onClick={syncHistoricalBills} 
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm w-full md:w-auto"
          >
            <span className="material-symbols-outlined text-[20px]">{syncing ? 'sync' : 'history'}</span>
            <span>{syncing ? 'Syncing...' : 'Sync Historical Bills'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
