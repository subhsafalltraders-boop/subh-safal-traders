'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Vendor, Bill, Payment, Product } from '@/lib/types';

export default function ReportsPage() {
  const supabase = createClient();
  
  // State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'summary' | 'range' | 'daily' | 'profit'>('summary');

  // Filters
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [dayBookDate, setDayBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [vendorsRes, billsRes, paymentsRes, productsRes, purchasesRes] = await Promise.all([
      supabase.from('vendors').select('*'),
      supabase.from('bills').select('*').eq('is_deleted', false),
      supabase.from('payments').select('*').eq('is_deleted', false),
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('purchases').select('*')
    ]);

    if (vendorsRes.data) {
      // Normalize vendor active status
      const vData = vendorsRes.data.map((v: any) => ({...v, active: v.active !== undefined ? v.active : v.is_active }));
      setVendors(vData as Vendor[]);
    }
    if (billsRes.data) setBills(billsRes.data as Bill[]);
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    if (purchasesRes.data) setPurchases(purchasesRes.data);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    setLoading(false);
  };

  // ---- PERIOD QUICK STATS ----
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const aajKiBikri = useMemo(() => bills.filter(b => b.date === todayStr).reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [bills, todayStr]);
  const isMahineBikri = useMemo(() => bills.filter(b => b.date >= monthStart && b.date <= todayStr).reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [bills, monthStart, todayStr]);
  const isSaalBikri = useMemo(() => bills.filter(b => b.date >= yearStart && b.date <= yearEnd).reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [bills, yearStart, yearEnd]);

  const todayProfit = useMemo(() => bills.filter(b => b.date === todayStr).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, todayStr]);
  const monthProfit = useMemo(() => bills.filter(b => b.date >= monthStart && b.date <= todayStr).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, monthStart, todayStr]);
  const yearProfit = useMemo(() => bills.filter(b => b.date >= yearStart && b.date <= yearEnd).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, yearStart, yearEnd]);
  
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekProfit = useMemo(() => bills.filter(b => b.date >= weekStartStr && b.date <= todayStr).reduce((acc, curr) => acc + (Number(curr.total_profit) || 0), 0), [bills, weekStartStr, todayStr]);

  const profitRangeBills = useMemo(() => bills.filter(b => b.date >= dateFrom && b.date <= dateTo), [bills, dateFrom, dateTo]);

  const vendorProfitSummary = useMemo(() => {
    const summary: Record<string, { name: string; billed: number; profit: number }> = {};
    profitRangeBills.forEach(b => {
      const vId = b.vendor_id || 'unknown';
      if (!summary[vId]) summary[vId] = { name: b.vendor_name || 'Unknown', billed: 0, profit: 0 };
      summary[vId].billed += Number(b.grand_total) || 0;
      summary[vId].profit += Number(b.total_profit) || 0;
    });
    return Object.values(summary).sort((a, b) => b.profit - a.profit);
  }, [profitRangeBills]);

  const productProfitSummary = useMemo(() => {
    const summary: Record<string, { name: string; box_qty: number; revenue: number; profit: number }> = {};
    profitRangeBills.forEach(b => {
      (b.items as any[])?.forEach((item: any) => {
        const pId = item.product_id;
        if (!pId) return;
        if (!summary[pId]) summary[pId] = { name: item.product_name, box_qty: 0, revenue: 0, profit: 0 };
        
        const boxQ = Number(item.box_qty) || 0;
        const pieceQ = Number(item.piece_qty) || 0;
        summary[pId].box_qty += boxQ;
        
        const amount = Number(item.amount) || item.total || 0;
        summary[pId].revenue += amount;
        
        const product = products.find(p => p.id === pId);
        const cost_per_box = product?.cost_per_box || 0;
        const pieces_per_box = product?.pieces_per_box || 1;
        const item_cost = (boxQ * cost_per_box) + (pieceQ * (cost_per_box / pieces_per_box));
        const item_profit = amount - item_cost;
        
        summary[pId].profit += item_profit;
      });
    });
    return Object.values(summary).sort((a, b) => b.profit - a.profit);
  }, [profitRangeBills, products]);

  const todayCollectionAmt = useMemo(() => payments.filter(p => p.date === todayStr).reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [payments, todayStr]);
  const monthCollectionAmt = useMemo(() => payments.filter(p => p.date >= monthStart && p.date <= todayStr).reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [payments, monthStart, todayStr]);
  const totalPendingDues = useMemo(() => {
    const totalBilled = bills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0);
    const totalPaid = payments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0);
    return totalBilled - totalPaid;
  }, [bills, payments]);

  const handleMonthSelect = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    const year = new Date().getFullYear();
    const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setDateFrom(start);
    setDateTo(end);
    setActiveTab('range');
  };

  // ---- SUMMARY VIEW DATA (All Time) ----
  const allTotalSales = useMemo(() => bills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [bills]);
  const allTotalCollection = useMemo(() => payments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [payments]);
  const allOutstanding = allTotalSales - allTotalCollection;
  
  const lowStockProducts = useMemo(() => products.filter(p => (p.stock_boxes || 0) < 5), [products]);

  const vendorOutstandingList = useMemo(() => {
    return vendors.map(v => {
      const vBills = bills.filter(b => b.vendor_id === v.id);
      const vPayments = payments.filter(p => p.vendor_id === v.id);
      const billed = vBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0);
      const received = vPayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0);
      return { ...v, outstanding: billed - received };
    }).filter(v => v.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  }, [vendors, bills, payments]);


  // ---- RANGE FILTER DATA ----
  const rangeBills = useMemo(() => bills.filter(b => b.date >= dateFrom && b.date <= dateTo), [bills, dateFrom, dateTo]);
  const rangePayments = useMemo(() => payments.filter(p => p.date >= dateFrom && p.date <= dateTo), [payments, dateFrom, dateTo]);
  const rangePurchases = useMemo(() => purchases.filter(p => p.date >= dateFrom && p.date <= dateTo), [purchases, dateFrom, dateTo]);
  
  const rangeTotalSales = useMemo(() => rangeBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [rangeBills]);
  const rangeTotalCollection = useMemo(() => rangePayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [rangePayments]);
  const rangeTotalPurchasePayment = useMemo(() => rangePurchases.reduce((acc, curr) => acc + (Number(curr.total_paid) || 0), 0), [rangePurchases]);
  const netCashPosition = rangeTotalCollection - rangeTotalPurchasePayment;


  // ---- DAILY REPORT DATA ----
  const dayBills = useMemo(() => bills.filter(b => b.date === dayBookDate), [bills, dayBookDate]);
  const dayPayments = useMemo(() => payments.filter(p => p.date === dayBookDate), [payments, dayBookDate]);
  const dayTotalSales = useMemo(() => dayBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [dayBills]);
  const dayTotalColl = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [dayPayments]);
  const dayCash = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.cash) || 0), 0), [dayPayments]);
  const dayUPI = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.upi) || 0), 0), [dayPayments]);

  const vendorDailySummary = useMemo(() => {
    const summary: Record<string, { name: string; billed: number; received: number }> = {};
    
    dayBills.forEach(b => {
      const vId = b.vendor_id || 'unknown';
      if (!summary[vId]) summary[vId] = { name: b.vendor_name || 'Unknown', billed: 0, received: 0 };
      summary[vId].billed += Number(b.grand_total) || 0;
    });

    dayPayments.forEach(p => {
      const vId = p.vendor_id || 'unknown';
      if (!summary[vId]) summary[vId] = { name: p.vendor_name || 'Unknown', billed: 0, received: 0 };
      summary[vId].received += Number(p.total_received) || 0;
    });

    return Object.values(summary).sort((a, b) => b.billed - a.billed || b.received - a.received);
  }, [dayBills, dayPayments]);

  const shareWhatsApp = () => {
    const taxAmount = dayTotalSales * 0.18;
    const netBilled = dayTotalSales - taxAmount;
    const remainingDues = netBilled - dayTotalColl;

    let text = `*Daily Report: ${new Date(dayBookDate).toLocaleDateString('en-IN')}*\n`;
    text += `------------------------\n`;
    text += `*Total Billed:* ₹${Math.round(dayTotalSales).toLocaleString('en-IN')}\n`;
    text += `*Less 18%:* ₹${Math.round(taxAmount).toLocaleString('en-IN')}\n`;
    text += `*Bacha Hua (Net):* ₹${Math.round(netBilled).toLocaleString('en-IN')}\n`;
    text += `*Payment Received:* ₹${Math.round(dayTotalColl).toLocaleString('en-IN')}\n`;
    text += `*Remaining Dues:* ₹${Math.round(remainingDues).toLocaleString('en-IN')}\n`;
    
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank');
  };

  if (loading) {
     return <div className="p-xl flex justify-center items-center h-full text-on-surface-variant">Loading reports...</div>;
  }

  return (
    <>
      <div className="hidden md:flex p-md md:p-container-padding flex-1 flex-col gap-lg overflow-y-auto h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Reports & Analytics</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Business insights and summaries.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-container-low p-xs rounded-xl self-start overflow-x-auto whitespace-nowrap max-w-full hide-scrollbar">
           <button onClick={() => setActiveTab('summary')} className={`min-w-max px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'summary' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              Summary (All Time)
           </button>
           <button onClick={() => setActiveTab('range')} className={`min-w-max px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'range' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              Range Filter
           </button>
           <button onClick={() => setActiveTab('daily')} className={`min-w-max px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'daily' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              Daily Report
           </button>
           <button onClick={() => setActiveTab('profit')} className={`min-w-max px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'profit' ? 'bg-[#dcfce7] shadow-sm text-[#166534]' : 'text-on-surface-variant hover:text-[#166534]'}`}>
              Profit
           </button>
        </div>

        {/* CONTENT: SUMMARY */}
        {activeTab === 'summary' && (
           <div className="flex flex-col gap-lg animate-fade-in">
              {/* Period Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                 <div className="bg-primary/5 border border-primary/20 p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="material-symbols-outlined text-primary mb-2 text-[24px]">today</span>
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Today's Sale</span>
                    <span className="font-display-sm text-primary mt-sm font-bold">₹{aajKiBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                    <span className="text-xs text-on-surface-variant mt-1">{bills.filter(b => b.date === todayStr).length} bills today</span>
                 </div>
                 <div className="bg-[#166534]/5 border border-[#166534]/20 p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="material-symbols-outlined text-[#166534] mb-2 text-[24px]">calendar_month</span>
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Monthly Sale</span>
                    <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{isMahineBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                    <span className="text-xs text-on-surface-variant mt-1">{new Date().toLocaleString('default', {month: 'long', year: 'numeric'})}</span>
                 </div>
                 <div className="bg-error/5 border border-error/20 p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="material-symbols-outlined text-error mb-2 text-[24px]">bar_chart</span>
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Yearly Sale</span>
                    <span className="font-display-sm text-error mt-sm font-bold">₹{isSaalBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                    <span className="text-xs text-on-surface-variant mt-1">{currentYear}</span>
                 </div>
              </div>

              {/* Collection & Dues Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                 <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="material-symbols-outlined text-[#166534] mb-2 text-[24px]">payments</span>
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Today's Collection</span>
                    <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{todayCollectionAmt.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                 </div>
                 <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="material-symbols-outlined text-[#166534] mb-2 text-[24px]">account_balance_wallet</span>
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">This Month's Collection</span>
                    <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{monthCollectionAmt.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                 </div>
                 <div className="bg-error/5 border border-error/20 p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="material-symbols-outlined text-error mb-2 text-[24px]">warning</span>
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Pending Dues</span>
                    <span className="font-display-sm text-error mt-sm font-bold">₹{totalPendingDues.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                 </div>
              </div>

              {/* All-time Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                 <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Sales (All Time)</span>
                    <span className="font-display-sm text-on-surface mt-sm font-bold">₹{allTotalSales.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                 </div>
                 <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Collection (All Time)</span>
                    <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{allTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
                 {/* Outstanding Vendors */}
                 <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col max-h-[500px]">
                    <div className="p-md border-b border-outline-variant bg-surface rounded-t-2xl">
                       <h3 className="font-headline-sm text-on-surface">Top Outstanding Vendors</h3>
                    </div>
                    <div className="overflow-y-auto p-md flex flex-col gap-sm">
                       {vendorOutstandingList.length === 0 ? (
                          <p className="text-on-surface-variant italic text-center p-md">No outstanding balances.</p>
                       ) : (
                          vendorOutstandingList.slice(0, 15).map(v => (
                             <div key={v.id} className="flex justify-between items-center p-sm bg-surface-container-low rounded-xl border border-outline-variant/30">
                                <span className="font-medium text-primary">{v.name}</span>
                                <span className="font-bold text-error">₹{v.outstanding.toLocaleString('en-IN')}</span>
                             </div>
                          ))
                       )}
                    </div>
                 </div>

                 {/* Low Stock Warnings */}
                 <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col max-h-[500px]">
                    <div className="p-md border-b border-error/20 bg-error/5 rounded-t-2xl flex items-center gap-xs">
                       <span className="material-symbols-outlined text-error">warning</span>
                       <h3 className="font-headline-sm text-error">Low Stock Warnings (&lt; 5 Boxes)</h3>
                    </div>
                    <div className="overflow-y-auto p-md flex flex-col gap-sm">
                       {lowStockProducts.length === 0 ? (
                          <p className="text-[#166534] italic text-center p-md font-medium">All products are adequately stocked.</p>
                       ) : (
                          lowStockProducts.map(p => (
                             <div key={p.id} className="flex justify-between items-center p-sm bg-surface rounded-xl border border-error/20">
                                <span className="font-medium text-on-surface">{p.name}</span>
                                <div className="flex gap-md">
                                   <span className="text-error font-bold">{p.stock_boxes || 0} Boxes</span>
                                   <span className="text-on-surface-variant text-sm">{p.stock_pieces || 0} Pcs</span>
                                </div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* CONTENT: RANGE FILTER */}
        {activeTab === 'range' && (
           <div className="flex flex-col gap-lg animate-fade-in max-w-4xl">
              <div className="bg-surface-container-lowest p-md rounded-2xl border border-outline-variant shadow-sm flex flex-col gap-md w-fit">
               {/* Month Quick Select */}
               <div>
                 <label className="text-xs text-on-surface-variant uppercase font-medium mb-2 block">Quick Select Month:</label>
                 <div className="grid grid-cols-6 gap-1">
                   {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                     <button
                       key={i}
                       onClick={() => handleMonthSelect(i)}
                       className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${selectedMonth === i ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface hover:bg-primary/10'}`}
                     >
                       {m}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="flex flex-col sm:flex-row gap-md items-center">
                  <div className="flex flex-col">
                     <label className="text-xs text-on-surface-variant uppercase font-medium mb-1">Date From</label>
                     <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedMonth(null); }} className="bg-surface px-sm py-xs rounded-lg border border-outline-variant focus:outline-none focus:border-primary" />
                  </div>
                  <span className="text-on-surface-variant font-medium mt-4 sm:block hidden">TO</span>
                  <div className="flex flex-col">
                     <label className="text-xs text-on-surface-variant uppercase font-medium mb-1">Date To</label>
                     <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedMonth(null); }} className="bg-surface px-sm py-xs rounded-lg border border-outline-variant focus:outline-none focus:border-primary" />
                  </div>
               </div>
            </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                 <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm flex flex-col">
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider mb-2">Total Sales in Range</span>
                    <span className="font-display-md text-primary font-bold">₹{rangeTotalSales.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                    <span className="text-sm text-on-surface-variant mt-2">{rangeBills.length} Bills Generated</span>
                 </div>
                 <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm flex flex-col">
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider mb-2">Total Received in Range</span>
                    <span className="font-display-md text-[#166534] font-bold">₹{rangeTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                    <span className="text-sm text-on-surface-variant mt-2">{rangePayments.length} Payments Recorded</span>
                 </div>
                 <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm flex flex-col">
                    <span className="font-label-lg text-on-surface-variant uppercase tracking-wider mb-2">Due Amount in this Period</span>
                    <span className={`font-display-md font-bold ${(rangeTotalSales - rangeTotalCollection) > 0 ? 'text-error' : 'text-[#166534]'}`}>
                      ₹{Math.abs(rangeTotalSales - rangeTotalCollection).toLocaleString('en-IN', {minimumFractionDigits: 0})}
                    </span>
                    <span className="text-sm text-on-surface-variant mt-2">{(rangeTotalSales - rangeTotalCollection) > 0 ? 'Pending' : 'Overpaid'}</span>
                 </div>
              </div>

              {/* CASH FLOW SUMMARY */}
              <div className="mt-md">
                 <h3 className="font-headline-sm text-on-surface mb-sm border-b border-outline-variant pb-2">Cash Flow Summary</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                    <div className="bg-[#dcfce7]/40 border border-[#166534]/20 p-xl rounded-2xl shadow-sm flex flex-col">
                       <span className="font-label-lg text-[#166534] uppercase tracking-wider mb-2">Total Collection (IN)</span>
                       <span className="font-display-md text-[#166534] font-bold">₹{rangeTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                       <span className="text-sm text-on-surface-variant mt-2">Money from vendors</span>
                    </div>
                    <div className="bg-[#fee2e2]/40 border border-error/20 p-xl rounded-2xl shadow-sm flex flex-col">
                       <span className="font-label-lg text-error uppercase tracking-wider mb-2">Total Purchase Payment (OUT)</span>
                       <span className="font-display-md text-error font-bold">₹{rangeTotalPurchasePayment.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                       <span className="text-sm text-on-surface-variant mt-2">Money paid to company</span>
                    </div>
                    <div className="bg-[#e0f2fe]/40 border border-[#0284c7]/20 p-xl rounded-2xl shadow-sm flex flex-col">
                       <span className="font-label-lg text-[#0284c7] uppercase tracking-wider mb-2">Net Cash Position</span>
                       <span className={`font-display-md font-bold ${netCashPosition >= 0 ? 'text-[#0284c7]' : 'text-error'}`}>
                         ₹{netCashPosition.toLocaleString('en-IN', {minimumFractionDigits: 0})}
                       </span>
                       <span className="text-sm text-on-surface-variant mt-2">Collection - Purchase Payment</span>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* CONTENT: DAILY REPORT */}
        {activeTab === 'daily' && (
           <div className="flex flex-col gap-lg animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md bg-surface-container-lowest p-md rounded-2xl border border-outline-variant shadow-sm">
                 <div className="flex items-center gap-md">
                    <div className="flex flex-col">
                       <label className="text-xs text-on-surface-variant uppercase font-medium mb-1">Select Date</label>
                       <input type="date" value={dayBookDate} onChange={e => setDayBookDate(e.target.value)} className="bg-surface px-md py-sm rounded-xl border border-outline-variant focus:outline-none focus:border-primary font-medium" />
                    </div>
                 </div>
                 <button 
                    onClick={shareWhatsApp}
                    className="flex items-center gap-xs px-lg py-sm bg-[#25D366] text-white font-label-md rounded-xl hover:bg-[#20bd5a] transition-all shadow-sm w-full sm:w-auto justify-center"
                 >
                    <span className="material-symbols-outlined text-[20px]">send</span> Open WhatsApp
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                 <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm">
                    <div className="text-sm text-on-surface-variant uppercase tracking-wider mb-1">Today's Sales</div>
                    <div className="font-headline-lg text-primary font-bold">₹{dayTotalSales.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-on-surface-variant mt-1">{dayBills.length} Bills</div>
                 </div>
                 <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm">
                    <div className="text-sm text-on-surface-variant uppercase tracking-wider mb-1">Today's Collections</div>
                    <div className="font-headline-lg text-[#166534] font-bold">₹{dayTotalColl.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-on-surface-variant mt-1">{dayPayments.length} Receipts</div>
                 </div>
                 <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm">
                    <div className="text-sm text-on-surface-variant uppercase tracking-wider mb-1">Aaj ka Due Amount</div>
                    <div className={`font-headline-lg font-bold ${(dayTotalSales - dayTotalColl) > 0 ? 'text-error' : 'text-[#166534]'}`}>
                      ₹{Math.abs(dayTotalSales - dayTotalColl).toLocaleString('en-IN')}
                    </div>
                    <div className="text-sm text-on-surface-variant mt-1">{(dayTotalSales - dayTotalColl) > 0 ? 'Pending' : 'Overpaid/Settled'}</div>
                 </div>
              </div>

              {/* Vendor Daily Summary */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col mt-2">
                 <div className="p-md border-b border-outline-variant bg-surface rounded-t-2xl">
                    <h3 className="font-headline-sm text-on-surface">Vendor Summary (Bill vs Collection)</h3>
                 </div>
                 <div className="overflow-y-auto p-sm">
                    {vendorDailySummary.length === 0 ? <p className="text-on-surface-variant italic p-md text-center">No activity today.</p> : (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                          {vendorDailySummary.map((v, i) => (
                             <div key={i} className="flex justify-between items-center p-md bg-surface-container-low border border-outline-variant/30 rounded-xl">
                                <div className="font-medium text-primary text-base truncate mr-2" style={{maxWidth: '180px'}}>{v.name}</div>
                                <div className="flex gap-lg text-sm shrink-0">
                                   <div className="flex flex-col items-end">
                                      <span className="text-on-surface-variant text-[10px] uppercase tracking-wider">Bill Banaya</span>
                                      <span className="font-bold text-on-surface text-base">₹{v.billed.toLocaleString('en-IN')}</span>
                                   </div>
                                   <div className="flex flex-col items-end">
                                      <span className="text-on-surface-variant text-[10px] uppercase tracking-wider">Paisa Diya</span>
                                      <span className="font-bold text-[#166534] text-base">₹{v.received.toLocaleString('en-IN')}</span>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>

              {/* Daily Calculation Summary */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col p-lg mt-2">
                 <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-sm mb-md">Daily Calculation</h3>
                 <div className="flex flex-col gap-sm max-w-sm">
                    <div className="flex justify-between font-medium">
                       <span className="text-on-surface-variant">Total Billed:</span>
                       <span className="text-on-surface">₹{Math.round(dayTotalSales).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-medium text-error">
                       <span className="text-error/80">Less 18%:</span>
                       <span>- ₹{Math.round(dayTotalSales * 0.18).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-outline-variant/50 pt-sm">
                       <span className="text-on-surface">Bacha Hua (Net):</span>
                       <span className="text-on-surface">₹{Math.round(dayTotalSales * 0.82).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-medium text-[#166534] mt-sm">
                       <span>Payment Received:</span>
                       <span>- ₹{Math.round(dayTotalColl).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-outline-variant pt-sm mt-sm text-lg">
                       <span>Remaining Dues:</span>
                       <span className={Math.round((dayTotalSales * 0.82) - dayTotalColl) > 0 ? "text-error" : "text-[#166534]"}>
                          ₹{Math.round((dayTotalSales * 0.82) - dayTotalColl).toLocaleString('en-IN')}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* MOBILE UI */}
      <div className="md:hidden flex-1 overflow-y-auto pb-[80px] bg-surface flex flex-col min-h-[100dvh]">
        <header className="flex justify-between items-center h-[56px] px-[16px] w-full z-50 bg-surface top-0 sticky border-b border-outline-variant shadow-sm transition-colors duration-200">
          <button onClick={() => window.history.back()} className="text-primary active:bg-surface-container-high p-2 rounded-full flex items-center justify-center min-w-[48px] min-h-[48px] -ml-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </button>
          <h1 className="font-title-main text-[20px] font-bold text-primary tracking-tight">SST</h1>
          <button className="text-primary active:bg-surface-container-high p-2 rounded-full flex items-center justify-center min-w-[48px] min-h-[48px] -mr-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>notifications</span>
          </button>
        </header>

        <div className="px-[16px] py-4 flex flex-col gap-4">
          <h2 className="font-title-main text-[20px] font-semibold text-on-surface mb-2">Reports</h2>
          
          <div className="flex overflow-x-auto hide-scrollbar gap-2 -mx-[16px] px-[16px] pb-1">
            <button onClick={() => setActiveTab('summary')} className={`whitespace-nowrap px-5 h-[40px] rounded-full font-label-caption text-[14px] flex items-center justify-center transition-colors ${activeTab === 'summary' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant active:bg-surface-container-high'}`}>Summary</button>
            <button onClick={() => setActiveTab('range')} className={`whitespace-nowrap px-5 h-[40px] rounded-full font-label-caption text-[14px] flex items-center justify-center transition-colors ${activeTab === 'range' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant active:bg-surface-container-high'}`}>Range</button>
            <button onClick={() => setActiveTab('daily')} className={`whitespace-nowrap px-5 h-[40px] rounded-full font-label-caption text-[14px] flex items-center justify-center transition-colors ${activeTab === 'daily' ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant active:bg-surface-container-high'}`}>Day Book</button>
            <button onClick={() => setActiveTab('profit')} className={`whitespace-nowrap px-5 h-[40px] rounded-full font-label-caption text-[14px] flex items-center justify-center transition-colors ${activeTab === 'profit' ? 'bg-[#166534] text-white shadow-sm' : 'border border-[#166534]/30 bg-[#dcfce7]/30 text-[#166534] active:bg-[#dcfce7]'}`}>Profit</button>
          </div>

          {activeTab === 'summary' && (
             <div className="flex flex-col gap-[12px] animate-fade-in mt-2">
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-surface-container-highest rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Today's Sale</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-primary">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-primary">{aajKiBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-surface-container-highest rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Monthly Sale</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-primary">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-primary">{isMahineBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-surface-container-highest rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="material-symbols-outlined text-primary text-[20px]">insert_chart</span>
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Yearly Sale</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-primary">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-primary">{isSaalBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>
                
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden mt-4">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-[#166534]/10 rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="material-symbols-outlined text-[#166534] text-[20px]">payments</span>
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Today's Collection</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-[#166534]">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-[#166534]">{todayCollectionAmt.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>
                
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-error/10 rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Total Pending Dues</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-error">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-error">{totalPendingDues.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'range' && (
             <div className="flex flex-col gap-[12px] animate-fade-in mt-2">
                <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col gap-3">
                   <label className="text-[14px] text-on-surface-variant uppercase font-medium">Quick Select Month:</label>
                   <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                     {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                       <button
                         key={i}
                         onClick={() => handleMonthSelect(i)}
                         className={`px-4 py-1.5 rounded-lg text-[14px] font-semibold transition-colors shrink-0 ${selectedMonth === i ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-primary/10'}`}
                       >
                         {m}
                       </button>
                     ))}
                   </div>
                   <div className="flex flex-col gap-3 mt-2">
                      <div className="flex flex-col">
                         <label className="text-[12px] text-on-surface-variant uppercase font-medium mb-1">Date From</label>
                         <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSelectedMonth(null); }} className="bg-surface px-3 py-2 rounded-lg border border-outline-variant focus:outline-none focus:border-primary w-full text-[16px]" />
                      </div>
                      <div className="flex flex-col">
                         <label className="text-[12px] text-on-surface-variant uppercase font-medium mb-1">Date To</label>
                         <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSelectedMonth(null); }} className="bg-surface px-3 py-2 rounded-lg border border-outline-variant focus:outline-none focus:border-primary w-full text-[16px]" />
                      </div>
                   </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden mt-2">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-surface-container-highest rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Sales in Range</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-primary">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-primary">{rangeTotalSales.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>
                
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-24 h-24 bg-[#166534]/10 rounded-bl-[100px] opacity-50 pointer-events-none"></div>
                   <div className="flex items-center gap-2 mb-2 z-10">
                      <span className="font-label-caption text-[14px] text-on-surface-variant uppercase tracking-wider">Received in Range</span>
                   </div>
                   <div className="flex items-baseline gap-1 z-10 mt-1">
                      <span className="font-rupee-currency text-[18px] text-[#166534]">₹</span>
                      <span className="font-value-display text-[24px] font-bold text-[#166534]">{rangeTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'daily' && (
             <div className="flex flex-col gap-[12px] animate-fade-in mt-2">
                <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col gap-3">
                   <div className="flex flex-col">
                      <label className="text-[12px] text-on-surface-variant uppercase font-medium mb-1">Select Date</label>
                      <input type="date" value={dayBookDate} onChange={e => setDayBookDate(e.target.value)} className="bg-surface px-3 py-2 rounded-lg border border-outline-variant focus:outline-none focus:border-primary w-full text-[16px] font-medium" />
                   </div>
                   <button 
                      onClick={shareWhatsApp}
                      className="flex items-center gap-2 px-4 py-2 mt-2 bg-[#25D366] text-white font-label-md rounded-xl hover:bg-[#20bd5a] transition-all shadow-sm justify-center w-full"
                   >
                      <span className="material-symbols-outlined text-[20px]">send</span> Share on WhatsApp
                   </button>
                </div>

                {/* Daily Calc Block */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col mt-2">
                   <h3 className="font-title-main text-[16px] text-on-surface border-b border-outline-variant pb-2 mb-3">Daily Calculation</h3>
                   <div className="flex flex-col gap-2">
                      <div className="flex justify-between font-medium text-[14px]">
                         <span className="text-on-surface-variant">Total Billed:</span>
                         <span className="text-on-surface">₹{Math.round(dayTotalSales).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-medium text-error text-[14px]">
                         <span className="text-error/80">Less 18%:</span>
                         <span>- ₹{Math.round(dayTotalSales * 0.18).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-outline-variant/50 pt-2 text-[14px]">
                         <span className="text-on-surface">Bacha Hua (Net):</span>
                         <span className="text-on-surface">₹{Math.round(dayTotalSales * 0.82).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-medium text-[#166534] mt-2 text-[14px]">
                         <span>Payment Received:</span>
                         <span>- ₹{Math.round(dayTotalColl).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-outline-variant pt-2 mt-2 text-[16px]">
                         <span>Remaining Dues:</span>
                         <span className={Math.round((dayTotalSales * 0.82) - dayTotalColl) > 0 ? "text-error" : "text-[#166534]"}>
                            ₹{Math.round((dayTotalSales * 0.82) - dayTotalColl).toLocaleString('en-IN')}
                         </span>
                      </div>
                   </div>
                </div>
             </div>
          )}
           {activeTab === 'profit' && (
             <div className="flex flex-col gap-[12px] animate-fade-in mt-2">
                <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col gap-3">
                   <div className="flex flex-col">
                      <label className="text-[12px] text-on-surface-variant uppercase font-medium mb-1">Date From</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface px-3 py-2 rounded-lg border border-outline-variant focus:outline-none focus:border-[#166534] w-full text-[16px] font-medium" />
                   </div>
                   <div className="flex flex-col mt-1">
                      <label className="text-[12px] text-on-surface-variant uppercase font-medium mb-1">Date To</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface px-3 py-2 rounded-lg border border-outline-variant focus:outline-none focus:border-[#166534] w-full text-[16px] font-medium" />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                   <div className="bg-[#dcfce7]/30 border border-[#166534]/20 p-3 rounded-xl shadow-sm flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Today's Profit</span>
                      <span className="text-[18px] text-[#166534] font-bold">₹{Math.round(todayProfit).toLocaleString('en-IN')}</span>
                   </div>
                   <div className="bg-[#dcfce7]/30 border border-[#166534]/20 p-3 rounded-xl shadow-sm flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">This Week's Profit</span>
                      <span className="text-[18px] text-[#166534] font-bold">₹{Math.round(weekProfit).toLocaleString('en-IN')}</span>
                   </div>
                   <div className="bg-[#dcfce7]/30 border border-[#166534]/20 p-3 rounded-xl shadow-sm flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">This Month's Profit</span>
                      <span className="text-[18px] text-[#166534] font-bold">₹{Math.round(monthProfit).toLocaleString('en-IN')}</span>
                   </div>
                   <div className="bg-[#dcfce7]/30 border border-[#166534]/20 p-3 rounded-xl shadow-sm flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">This Year's Profit</span>
                      <span className="text-[18px] text-[#166534] font-bold">₹{Math.round(yearProfit).toLocaleString('en-IN')}</span>
                   </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm flex flex-col mt-2">
                    <div className="p-3 border-b border-outline-variant bg-surface rounded-t-xl">
                        <h3 className="font-title-main text-[16px] text-on-surface">Product wise Profit</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[300px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 font-medium text-on-surface-variant text-[12px]">Product</th>
                                    <th className="px-3 py-2 font-medium text-on-surface-variant text-[12px] text-right">Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/50">
                                {productProfitSummary.map(p => (
                                    <tr key={p.name} className="active:bg-surface-container-low">
                                        <td className="px-3 py-2 font-medium text-on-surface text-[14px]">
                                           <div className="line-clamp-1">{p.name}</div>
                                           <div className="text-[10px] text-on-surface-variant font-normal">Qty: {Math.round(p.box_qty)} box | {p.revenue > 0 ? (p.profit / p.revenue * 100).toFixed(1) : 0}%</div>
                                        </td>
                                        <td className="px-3 py-2 text-right text-[#166534] font-bold text-[14px]">₹{Math.round(p.profit).toLocaleString('en-IN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
           )}
        </div>
      </div>
    </>
  );

}
