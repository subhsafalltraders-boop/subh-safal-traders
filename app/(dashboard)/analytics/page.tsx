"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Lock, LogOut, Settings, Search, Edit, Save, RefreshCw, TrendingUp } from 'lucide-react';

const supabase = createClient();

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const toLocalISO = (d: Date) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const getStartDateStr = (period: string) => {
  const d = new Date();
  if (period === 'today') return toLocalISO(d);
  if (period === 'week') {
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1));
    return toLocalISO(d);
  }
  if (period === 'month') {
    d.setDate(1);
    return toLocalISO(d);
  }
  if (period === 'year') {
    d.setMonth(0, 1);
    return toLocalISO(d);
  }
  return toLocalISO(d);
};

export default function AnalyticsDashboard() {
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showProductManager, setShowProductManager] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ cost_price: 0, price_per_box: 0 });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const unlocked = sessionStorage.getItem('executive_unlocked') === 'true';
    if (unlocked) {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      setIsUnlocked(true);
      sessionStorage.setItem('executive_unlocked', 'true');
    } else {
      alert('Invalid PIN');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setPin('');
    sessionStorage.removeItem('executive_unlocked');
  };

  const fetchData = async () => {
    setLoading(true);
    const startDate = getStartDateStr(selectedPeriod);
    const today = toLocalISO(new Date());

    const { data: bData } = await supabase.from('bills')
      .select('*')
      .gte('date', startDate)
      .lte('date', today)
      .eq('is_deleted', false);
      
    const { data: pData } = await supabase.from('payments')
      .select('*')
      .gte('date', startDate)
      .lte('date', today)
      .eq('is_deleted', false);

    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true);

    setBills(bData || []);
    setPayments(pData || []);
    if (prodData) {
      // Sort products by name
      prodData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setProducts(prodData);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchData();
    }
  }, [isUnlocked, selectedPeriod]);

  const breakdownList = useMemo(() => {
    return bills.map(bill => {
      const grandTotal = bill.grand_total || 0;
      const totalProfit = bill.total_profit || 0;
      const profitMargin = grandTotal > 0 ? totalProfit / grandTotal : 0;
      
      const matchedPayments = payments.filter(p => p.vendor_id === bill.vendor_id && p.date === bill.date);
      let amountPaid = matchedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      if (amountPaid > grandTotal) amountPaid = grandTotal;
      let amountPending = grandTotal - amountPaid;
      if (amountPending < 0) amountPending = 0;
      
      const realizedProfit = amountPaid * profitMargin;
      const unrealizedProfit = amountPending * profitMargin;
      
      return {
        ...bill,
        grandTotal,
        totalProfit,
        profitMargin,
        amountPaid,
        amountPending,
        realizedProfit,
        unrealizedProfit
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, payments]);

  const totalBookedProfit = breakdownList.reduce((sum, b) => sum + b.totalProfit, 0);

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const startEditProduct = (p: any) => {
    setEditingProduct(p.id);
    setEditForm({ cost_price: p.cost_price || 0, price_per_box: p.price_per_box || 0 });
  };

  const saveProduct = async (id: string) => {
    const { error } = await supabase.from('products').update({
      cost_price: editForm.cost_price,
      price_per_box: editForm.price_per_box
    }).eq('id', id);

    if (!error) {
      setProducts(products.map(p => p.id === id ? { ...p, ...editForm } : p));
      setEditingProduct(null);
    } else {
      alert('Failed to update product');
    }
  };

  const calculateMargin = (cost: number, price: number) => {
    if (!price || price <= 0) return 0;
    return ((price - cost) / price) * 100;
  };
  
  const getMarginBadge = (cost: number, margin: number) => {
    if (!cost || cost === 0) return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">Cost Missing</span>;
    if (margin > 20) return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">&gt; 20%</span>;
    if (margin >= 10) return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">10 - 20%</span>;
    return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">&lt; 10%</span>;
  };

  const syncHistoricalBills = async () => {
    setIsSyncing(true);
    setSyncMessage('Fetching all bills...');
    
    const { data: allBills, error: fetchErr } = await supabase.from('bills').select('*').eq('is_deleted', false);
    if (fetchErr || !allBills) {
      setSyncMessage('Error fetching bills');
      setIsSyncing(false);
      return;
    }
    
    setSyncMessage(`Recalculating ${allBills.length} bills...`);
    let count = 0;
    
    for (const bill of allBills) {
      try {
        let total_cost = 0;
        let total_profit = 0;
        let items = [];
        if (typeof bill.items === 'string') {
          items = JSON.parse(bill.items);
        } else if (Array.isArray(bill.items)) {
          items = bill.items;
        }
        
        for (const item of items) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            const costPrice = prod.cost_price || 0;
            const piecesPerBox = prod.pieces_per_box || 1;
            const totalPiecesSold = item.total_pieces || ((item.boxes || 0) * piecesPerBox + (item.pieces || 0));
            const itemCost = (costPrice / piecesPerBox) * totalPiecesSold;
            total_cost += itemCost;
          }
        }
        
        total_profit = (bill.grand_total || 0) - total_cost;
        
        await supabase.from('bills').update({
          total_cost,
          total_profit
        }).eq('id', bill.id);
        
        count++;
        if (count % 10 === 0) {
          setSyncMessage(`Updated ${count} of ${allBills.length}...`);
        }
      } catch (err) {
        console.error('Error processing bill', bill.id, err);
      }
    }
    
    setSyncMessage(`Successfully synced ${count} bills!`);
    setTimeout(() => {
      setSyncMessage('');
      fetchData();
    }, 3000);
    setIsSyncing(false);
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 w-full p-4">
        <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-xl text-center">
          <div className="mx-auto bg-slate-100 p-4 rounded-full inline-flex mb-6">
            <Lock className="w-8 h-8 text-slate-700" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Executive Access</h2>
          <p className="text-slate-500 mb-6 text-sm">Enter your PIN to access profit analytics.</p>
          <form onSubmit={handleUnlock}>
            <input
              type="password"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-3xl tracking-widest p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-colors"
              placeholder="••••"
              autoFocus
            />
            <button
              type="submit"
              className="mt-6 w-full bg-slate-900 text-white font-semibold py-4 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h1 className="font-bold text-lg md:text-xl">Executive Profit Center</h1>
          </div>
          <button 
            onClick={handleLock}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
            title="Lock Dashboard"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        
        {/* Time-Period Tabs */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto hide-scrollbar">
          {['today', 'week', 'month', 'year'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`flex-1 min-w-[80px] py-2.5 px-4 rounded-lg text-sm font-medium capitalize transition-all ${
                selectedPeriod === period 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {period === 'today' ? 'Today' : `This ${period}`}
            </button>
          ))}
        </div>

        {/* Massive KPI */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-10 text-center">
          <h2 className="text-slate-500 font-medium mb-2 text-sm uppercase tracking-wider">Total Booked Profit</h2>
          {loading ? (
            <div className="h-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
          ) : (
            <div className="text-4xl md:text-6xl font-black text-green-600 tracking-tight">
              {formatCurrency(totalBookedProfit)}
            </div>
          )}
        </div>

        {/* Breakdown List */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Bill-wise Breakdown</h3>
          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading bills...</div>
          ) : breakdownList.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 shadow-sm">
              No bills found for this period.
            </div>
          ) : (
            <div className="space-y-4">
              {breakdownList.map((bill) => (
                <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 md:items-center justify-between">
                  
                  {/* Left Side: Bill Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        #{bill.bill_number}
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="font-bold text-slate-800 text-lg leading-tight mb-1">
                      {bill.vendor_name || 'Walk-in Customer'}
                    </div>
                    <div className="text-sm text-slate-500">
                      Bill Total: <span className="font-semibold text-slate-700">{formatCurrency(bill.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Right Side: Profit Logic */}
                  <div className="bg-slate-50 p-4 rounded-xl flex-1 max-w-md w-full border border-slate-100">
                    <div className="flex justify-between items-end mb-4">
                      <div className="text-sm text-slate-500">Booked Profit</div>
                      <div className="text-xl font-bold text-green-600">{formatCurrency(bill.totalProfit)}</div>
                    </div>
                    
                    <div className="space-y-2 text-sm border-t border-slate-200 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Realized (In Pocket)</span>
                        <span className="font-bold text-green-600">{formatCurrency(bill.realizedProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unrealized (In Market)</span>
                        <span className="font-bold text-orange-500">{formatCurrency(bill.unrealizedProfit)}</span>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Margin Manager Toggle */}
        <div className="pt-8">
          <button
            onClick={() => setShowProductManager(!showProductManager)}
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Settings className="w-5 h-5" />
            Manage Product Margins & Costs
          </button>
        </div>

        {/* Product Margin Manager Section */}
        {showProductManager && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Product Manager</h3>
              <div className="relative w-full md:w-72">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-slate-500 text-sm">
                    <th className="pb-3 px-2">Product Name</th>
                    <th className="pb-3 px-2">Cost Price (Box)</th>
                    <th className="pb-3 px-2">Selling Price (Box)</th>
                    <th className="pb-3 px-2">Profit (₹)</th>
                    <th className="pb-3 px-2">Margin</th>
                    <th className="pb-3 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map(p => {
                    const margin = calculateMargin(p.cost_price, p.price_per_box);
                    const profit = (p.price_per_box || 0) - (p.cost_price || 0);
                    const isEditing = editingProduct === p.id;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 group">
                        <td className="py-3 px-2 font-medium text-slate-800">{p.name}</td>
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.cost_price}
                              onChange={(e) => setEditForm({...editForm, cost_price: parseFloat(e.target.value) || 0})}
                              className="w-24 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span>{formatCurrency(p.cost_price)}</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.price_per_box}
                              onChange={(e) => setEditForm({...editForm, price_per_box: parseFloat(e.target.value) || 0})}
                              className="w-24 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span>{formatCurrency(p.price_per_box)}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 font-semibold text-green-600">{formatCurrency(profit)}</td>
                        <td className="py-3 px-2">
                          {getMarginBadge(p.cost_price, margin)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {isEditing ? (
                            <button onClick={() => saveProduct(p.id)} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                              <Save className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => startEditProduct(p)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Products */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map(p => {
                const margin = calculateMargin(p.cost_price, p.price_per_box);
                const profit = (p.price_per_box || 0) - (p.cost_price || 0);
                const isEditing = editingProduct === p.id;
                
                return (
                  <div key={p.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-slate-800">{p.name}</div>
                      {getMarginBadge(p.cost_price, margin)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-slate-500 mb-1">Cost Price</div>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.cost_price}
                            onChange={(e) => setEditForm({...editForm, cost_price: parseFloat(e.target.value) || 0})}
                            className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none"
                          />
                        ) : (
                          <div className="font-semibold">{formatCurrency(p.cost_price)}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Selling Price</div>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.price_per_box}
                            onChange={(e) => setEditForm({...editForm, price_per_box: parseFloat(e.target.value) || 0})}
                            className="w-full px-2 py-1.5 border border-blue-300 rounded focus:outline-none"
                          />
                        ) : (
                          <div className="font-semibold">{formatCurrency(p.price_per_box)}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
                      <div>
                        <span className="text-slate-500 text-xs">Profit (₹)</span>
                        <div className="font-bold text-green-600">{formatCurrency(profit)}</div>
                      </div>
                      <div>
                        {isEditing ? (
                          <button onClick={() => saveProduct(p.id)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
                            <Save className="w-4 h-4" /> Save
                          </button>
                        ) : (
                          <button onClick={() => startEditProduct(p)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                            <Edit className="w-4 h-4" /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-slate-500">No products found.</div>
            )}
          </div>
        )}

        {/* Sync Historical Data Action */}
        <div className="pt-10 pb-6 border-t border-slate-200 mt-10 text-center flex flex-col items-center">
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
            If you recently updated product costs, you can sync historical bills to recalculate all past profits based on current cost values.
          </p>
          <button
            onClick={syncHistoricalBills}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              isSyncing 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync & Recalculate Historical Bills'}
          </button>
          
          {syncMessage && (
            <div className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg animate-in fade-in">
              {syncMessage}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
