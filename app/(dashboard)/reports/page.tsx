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
  const [activeTab, setActiveTab] = useState<'summary' | 'range' | 'daily'>('summary');

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
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
        <div>
          <h2 className="text-2xl md:text-headline-lg font-bold text-on-surface">Reports & Analytics</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Business insights and summaries.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-xs rounded-xl self-start overflow-x-auto whitespace-nowrap max-w-full scroll-smooth hide-scrollbar">
         <button onClick={() => setActiveTab('summary')} className={`px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors flex-shrink-0 min-w-[120px] ${activeTab === 'summary' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Summary (All Time)
         </button>
         <button onClick={() => setActiveTab('range')} className={`px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors flex-shrink-0 min-w-[120px] ${activeTab === 'range' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Range Filter
         </button>
         <button onClick={() => setActiveTab('daily')} className={`px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors flex-shrink-0 min-w-[120px] ${activeTab === 'daily' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Daily Report
         </button>
      </div>

      {/* CONTENT: SUMMARY */}
      {activeTab === 'summary' && (
         <div className="flex flex-col gap-lg animate-fade-in">
            {/* Period Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
               <div className="bg-primary/5 border border-primary/20 p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="material-symbols-outlined text-primary mb-2 text-[24px]">today</span>
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Today's Sale</span>
                  <span className="font-display-sm text-primary mt-sm font-bold">₹{aajKiBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                  <span className="text-xs text-on-surface-variant mt-1">{bills.filter(b => b.date === todayStr).length} bills today</span>
               </div>
               <div className="bg-[#166534]/5 border border-[#166534]/20 p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="material-symbols-outlined text-[#166534] mb-2 text-[24px]">calendar_month</span>
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Monthly Sale</span>
                  <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{isMahineBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                  <span className="text-xs text-on-surface-variant mt-1">{new Date().toLocaleString('default', {month: 'long', year: 'numeric'})}</span>
               </div>
               <div className="bg-error/5 border border-error/20 p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="material-symbols-outlined text-error mb-2 text-[24px]">bar_chart</span>
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Yearly Sale</span>
                  <span className="font-display-sm text-error mt-sm font-bold">₹{isSaalBikri.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                  <span className="text-xs text-on-surface-variant mt-1">{currentYear}</span>
               </div>
            </div>

            {/* Collection & Dues Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="material-symbols-outlined text-[#166534] mb-2 text-[24px]">payments</span>
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Today's Collection</span>
                  <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{todayCollectionAmt.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="material-symbols-outlined text-[#166534] mb-2 text-[24px]">account_balance_wallet</span>
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">This Month's Collection</span>
                  <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{monthCollectionAmt.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
               </div>
               <div className="bg-error/5 border border-error/20 p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="material-symbols-outlined text-error mb-2 text-[24px]">warning</span>
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Pending Dues</span>
                  <span className="font-display-sm text-error mt-sm font-bold">₹{totalPendingDues.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
               </div>
            </div>

            {/* All-time Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Sales (All Time)</span>
                  <span className="font-display-sm text-on-surface mt-sm font-bold">₹{allTotalSales.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-6 rounded-2xl shadow-sm flex flex-col">
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
               <div className="grid grid-cols-6 gap-1 md:gap-2">
                 {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                   <button
                     key={i}
                     onClick={() => handleMonthSelect(i)}
                     className={`px-2 py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors min-h-[44px] md:min-h-0 ${selectedMonth === i ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface hover:bg-primary/10'}`}
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
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-xl rounded-2xl shadow-sm flex flex-col">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider mb-2">Total Sales in Range</span>
                  <span className="font-display-md text-primary font-bold">₹{rangeTotalSales.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                  <span className="text-sm text-on-surface-variant mt-2">{rangeBills.length} Bills Generated</span>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-xl rounded-2xl shadow-sm flex flex-col">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider mb-2">Total Received in Range</span>
                  <span className="font-display-md text-[#166534] font-bold">₹{rangeTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                  <span className="text-sm text-on-surface-variant mt-2">{rangePayments.length} Payments Recorded</span>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-xl rounded-2xl shadow-sm flex flex-col">
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
                  <div className="bg-[#dcfce7]/40 border border-[#166534]/20 p-3 md:p-xl rounded-2xl shadow-sm flex flex-col">
                     <span className="font-label-lg text-[#166534] uppercase tracking-wider mb-2">Total Collection (IN)</span>
                     <span className="font-display-md text-[#166534] font-bold">₹{rangeTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                     <span className="text-sm text-on-surface-variant mt-2">Money from vendors</span>
                  </div>
                  <div className="bg-[#fee2e2]/40 border border-error/20 p-3 md:p-xl rounded-2xl shadow-sm flex flex-col">
                     <span className="font-label-lg text-error uppercase tracking-wider mb-2">Total Purchase Payment (OUT)</span>
                     <span className="font-display-md text-error font-bold">₹{rangeTotalPurchasePayment.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
                     <span className="text-sm text-on-surface-variant mt-2">Money paid to company</span>
                  </div>
                  <div className="bg-[#e0f2fe]/40 border border-[#0284c7]/20 p-3 md:p-xl rounded-2xl shadow-sm flex flex-col">
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
                  className="flex items-center gap-xs px-lg py-sm bg-[#25D366] text-white font-label-md rounded-xl hover:bg-[#20bd5a] transition-all shadow-sm w-full sm:w-auto justify-center min-h-[44px]"
               >
                  <span className="material-symbols-outlined text-[20px]">send</span> Open WhatsApp
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-md rounded-2xl shadow-sm">
                  <div className="text-sm text-on-surface-variant uppercase tracking-wider mb-1">Today's Sales</div>
                  <div className="font-headline-lg text-primary font-bold">₹{dayTotalSales.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-on-surface-variant mt-1">{dayBills.length} Bills</div>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-md rounded-2xl shadow-sm">
                  <div className="text-sm text-on-surface-variant uppercase tracking-wider mb-1">Today's Collections</div>
                  <div className="font-headline-lg text-[#166534] font-bold">₹{dayTotalColl.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-on-surface-variant mt-1">{dayPayments.length} Receipts</div>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-3 md:p-md rounded-2xl shadow-sm">
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
  );
}
