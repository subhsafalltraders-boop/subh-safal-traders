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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'summary' | 'range' | 'daily'>('summary');

  // Filters
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [dayBookDate, setDayBookDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [vendorsRes, billsRes, paymentsRes, productsRes] = await Promise.all([
      supabase.from('vendors').select('*'),
      supabase.from('bills').select('*').eq('is_deleted', false),
      supabase.from('payments').select('*').eq('is_deleted', false),
      supabase.from('products').select('*').eq('is_active', true)
    ]);

    if (vendorsRes.data) {
      // Normalize vendor active status
      const vData = vendorsRes.data.map((v: any) => ({...v, active: v.active !== undefined ? v.active : v.is_active }));
      setVendors(vData as Vendor[]);
    }
    if (billsRes.data) setBills(billsRes.data as Bill[]);
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    setLoading(false);
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
  
  const rangeTotalSales = useMemo(() => rangeBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [rangeBills]);
  const rangeTotalCollection = useMemo(() => rangePayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [rangePayments]);


  // ---- DAILY REPORT DATA ----
  const dayBills = useMemo(() => bills.filter(b => b.date === dayBookDate), [bills, dayBookDate]);
  const dayPayments = useMemo(() => payments.filter(p => p.date === dayBookDate), [payments, dayBookDate]);
  const dayTotalSales = useMemo(() => dayBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [dayBills]);
  const dayTotalColl = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [dayPayments]);
  const dayCash = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.cash) || 0), 0), [dayPayments]);
  const dayUPI = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.upi) || 0), 0), [dayPayments]);


  // Actions
  const shareWhatsApp = () => {
    let text = `*Daily Report: ${new Date(dayBookDate).toLocaleDateString('en-IN')}*\n`;
    text += `------------------------\n`;
    text += `*Bills Cut Today:* ${dayBills.length}\n`;
    text += `*Total Sales:* ₹${dayTotalSales.toLocaleString('en-IN')}\n\n`;
    
    text += `*Collections Received:* ${dayPayments.length}\n`;
    text += `*Total Collection:* ₹${dayTotalColl.toLocaleString('en-IN')}\n`;
    text += ` (Cash: ₹${dayCash.toLocaleString('en-IN')} | UPI: ₹${dayUPI.toLocaleString('en-IN')})\n\n`;

    if (dayPayments.length > 0) {
       text += `*Payment Details:*\n`;
       dayPayments.forEach(p => {
          text += `- ${p.vendor_name || 'Vendor'}: ₹${p.total_received}\n`;
       });
       text += `\n`;
    }

    text += `*Net Cash in Hand:* ₹${dayCash.toLocaleString('en-IN')}\n`;
    
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Report copied to clipboard! Paste in WhatsApp.");
    }).catch(() => {
      toast.error("Failed to copy report.");
    });
  };

  if (loading) {
     return <div className="p-xl flex justify-center items-center h-full text-on-surface-variant">Loading reports...</div>;
  }

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Reports & Analytics</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Business insights and summaries.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-xs rounded-xl self-start overflow-x-auto max-w-full">
         <button onClick={() => setActiveTab('summary')} className={`px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'summary' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Summary (All Time)
         </button>
         <button onClick={() => setActiveTab('range')} className={`px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'range' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Range Filter
         </button>
         <button onClick={() => setActiveTab('daily')} className={`px-lg py-sm font-label-md rounded-lg whitespace-nowrap transition-colors ${activeTab === 'daily' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
            Daily Report
         </button>
      </div>

      {/* CONTENT: SUMMARY */}
      {activeTab === 'summary' && (
         <div className="flex flex-col gap-lg animate-fade-in">
            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
               <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Sales (All Time)</span>
                  <span className="font-display-sm text-on-surface mt-sm font-bold">₹{allTotalSales.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Total Collection</span>
                  <span className="font-display-sm text-[#166534] mt-sm font-bold">₹{allTotalCollection.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span>
               </div>
               <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-2xl shadow-sm flex flex-col">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Market Outstanding</span>
                  <span className={`font-display-sm mt-sm font-bold ${allOutstanding > 0 ? 'text-error' : 'text-on-surface'}`}>
                  ₹{allOutstanding.toLocaleString('en-IN', {minimumFractionDigits: 0})}
                  </span>
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
            <div className="bg-surface-container-lowest p-md rounded-2xl border border-outline-variant shadow-sm flex flex-col sm:flex-row gap-md items-center w-fit">
               <div className="flex flex-col">
                  <label className="text-xs text-on-surface-variant uppercase font-medium mb-1">Date From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface px-sm py-xs rounded-lg border border-outline-variant focus:outline-none focus:border-primary" />
               </div>
               <span className="text-on-surface-variant font-medium mt-4 sm:block hidden">TO</span>
               <div className="flex flex-col">
                  <label className="text-xs text-on-surface-variant uppercase font-medium mb-1">Date To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface px-sm py-xs rounded-lg border border-outline-variant focus:outline-none focus:border-primary" />
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
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
                  <span className="material-symbols-outlined text-[20px]">share</span> Copy to WhatsApp
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
               <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm bg-surface-container-low">
                  <div className="text-sm text-on-surface-variant uppercase tracking-wider mb-1">Cash in Hand (Today)</div>
                  <div className="font-headline-lg text-on-surface font-bold">₹{dayCash.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-on-surface-variant mt-1">UPI: ₹{dayUPI.toLocaleString('en-IN')}</div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
               {/* Day Bills */}
               <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col">
                  <div className="p-md border-b border-outline-variant bg-surface rounded-t-2xl">
                     <h3 className="font-headline-sm text-on-surface">Bills Cut ({dayBills.length})</h3>
                  </div>
                  <div className="overflow-y-auto p-sm max-h-[400px]">
                     {dayBills.length === 0 ? <p className="text-on-surface-variant italic p-md text-center">No bills cut.</p> : (
                        <div className="flex flex-col gap-xs">
                           {dayBills.map(b => (
                              <div key={b.id} className="flex justify-between items-center p-sm bg-surface-container-lowest border border-outline-variant/50 rounded-xl">
                                 <div>
                                    <div className="font-medium text-primary text-sm">{b.bill_number}</div>
                                    <div className="text-on-surface-variant text-sm">{b.vendor_name}</div>
                                 </div>
                                 <div className="font-bold text-on-surface">₹{b.grand_total.toLocaleString('en-IN')}</div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>

               {/* Day Payments */}
               <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col">
                  <div className="p-md border-b border-outline-variant bg-surface rounded-t-2xl">
                     <h3 className="font-headline-sm text-on-surface">Payments Received ({dayPayments.length})</h3>
                  </div>
                  <div className="overflow-y-auto p-sm max-h-[400px]">
                     {dayPayments.length === 0 ? <p className="text-on-surface-variant italic p-md text-center">No payments received.</p> : (
                        <div className="flex flex-col gap-xs">
                           {dayPayments.map(p => (
                              <div key={p.id} className="flex flex-col gap-1 p-sm bg-surface-container-lowest border border-outline-variant/50 rounded-xl">
                                 <div className="flex justify-between items-center">
                                    <div className="font-medium text-primary text-sm">{p.vendor_name}</div>
                                    <div className="font-bold text-[#166534]">₹{p.total_received.toLocaleString('en-IN')}</div>
                                 </div>
                                 <div className="flex justify-between text-xs text-on-surface-variant">
                                    <span>Cash: ₹{p.cash.toLocaleString('en-IN')}</span>
                                    <span>UPI: ₹{p.upi.toLocaleString('en-IN')}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
