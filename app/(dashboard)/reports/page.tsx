'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Bill, Payment } from '@/lib/types';

export default function ReportsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Range
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Day Book
  const [dayBookDate, setDayBookDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    const [vendorsRes, billsRes, paymentsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type'),
      supabase.from('bills').select('*').gte('date', dateFrom).lte('date', dateTo),
      supabase.from('payments').select('*').gte('date', dateFrom).lte('date', dateTo)
    ]);

    if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);
    if ((billsRes as any).data) setBills((billsRes as any).data as Bill[]);
    if ((paymentsRes as any).data) setPayments((paymentsRes as any).data as Payment[]);
    setLoading(false);
  };

  // Aggregations
  const totalSales = useMemo(() => bills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [bills]);
  const totalCollection = useMemo(() => payments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [payments]);
  const totalOutstanding = useMemo(() => payments.reduce((acc, curr) => acc + (Number(curr.outstanding) || 0), 0), [payments]);
  const billsCount = bills.length;

  // Vendor Breakdown
  const vendorStats = useMemo(() => {
    return vendors.map(v => {
      const vBills = bills.filter(b => b.vendor_id === v.id);
      const vPayments = payments.filter(p => p.vendor_id === v.id);
      
      const billed = vBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0);
      const received = vPayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0);
      const outstanding = billed - received;

      return {
        id: v.id,
        name: v.name,
        billed,
        received,
        outstanding,
        billsCount: vBills.length
      };
    }).filter(vs => vs.billed > 0 || vs.received > 0);
  }, [vendors, bills, payments]);

  const bestVendor = useMemo(() => {
    if (vendorStats.length > 0) {
      return [...vendorStats].sort((a, b) => b.billed - a.billed)[0];
    }
    return null;
  }, [vendorStats]);

  const exportToText = () => {
    let content = `REPORTS FROM ${dateFrom} TO ${dateTo}\n`;
    content += `======================================\n`;
    content += `Total Sales: Rs.${totalSales.toLocaleString('en-IN')}\n`;
    content += `Total Collection: Rs.${totalCollection.toLocaleString('en-IN')}\n`;
    content += `Net Outstanding: Rs.${(totalSales - totalCollection).toLocaleString('en-IN')}\n`;
    content += `Total Bills: ${billsCount}\n\n`;
    
    if (bestVendor) {
      content += `Best Performing Vendor: ${bestVendor.name} (Billed: Rs.${bestVendor.billed.toLocaleString('en-IN')})\n\n`;
    }

    content += `--- VENDOR BREAKDOWN ---\n`;
    vendorStats.forEach(v => {
      content += `${v.name}:\n  Billed: Rs.${v.billed.toLocaleString('en-IN')}\n  Received: Rs.${v.received.toLocaleString('en-IN')}\n  Outstanding: Rs.${v.outstanding.toLocaleString('en-IN')}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Report_${dateFrom}_to_${dateTo}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Day Book Filter
  const dayBills = useMemo(() => bills.filter(b => b.date === dayBookDate), [bills, dayBookDate]);
  const dayPayments = useMemo(() => payments.filter(p => p.date === dayBookDate), [payments, dayBookDate]);
  const dayTotalSales = useMemo(() => dayBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0), [dayBills]);
  const dayTotalColl = useMemo(() => dayPayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0), [dayPayments]);

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Reports & Analytics</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Comprehensive business overview.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-sm">
          <button 
            onClick={exportToText}
            className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors font-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">download</span> Export Text
          </button>
          <div className="flex items-center gap-sm bg-surface p-sm rounded-lg border border-outline-variant shadow-sm">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent font-body-md focus:outline-none" />
            <span className="text-on-surface-variant">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent font-body-md focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col">
          <span className="font-body-sm text-on-surface-variant uppercase tracking-wider">Total Sales</span>
          <span className="font-display-sm text-on-surface mt-sm">₹{totalSales.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col">
          <span className="font-body-sm text-on-surface-variant uppercase tracking-wider">Total Collection</span>
          <span className="font-display-sm text-[#166534] mt-sm">₹{totalCollection.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col">
          <span className="font-body-sm text-on-surface-variant uppercase tracking-wider">Net Outstanding (Range)</span>
          <span className={`font-display-sm mt-sm ${(totalSales - totalCollection) > 0 ? 'text-error' : 'text-on-surface'}`}>
            ₹{(totalSales - totalCollection).toLocaleString('en-IN', {minimumFractionDigits: 2})}
          </span>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col">
          <span className="font-body-sm text-on-surface-variant uppercase tracking-wider">Total Bills</span>
          <span className="font-display-sm text-primary mt-sm">{billsCount}</span>
        </div>
        {bestVendor && (
          <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col md:col-span-2 lg:col-span-4 bg-gradient-to-r from-primary/10 to-transparent">
            <span className="font-body-sm text-primary uppercase tracking-wider font-bold">Best Performing Vendor</span>
            <div className="flex justify-between items-center mt-sm">
              <span className="font-display-sm text-on-surface">{bestVendor.name}</span>
              <span className="font-headline-sm text-primary">₹{bestVendor.billed.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Vendor Breakdown */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col lg:h-[500px]">
          <div className="p-md border-b border-outline-variant bg-surface rounded-t-2xl">
            <h3 className="font-headline-sm text-on-surface">Vendor Breakdown</h3>
          </div>
          
          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col divide-y divide-outline-variant/30 max-h-[400px] overflow-y-auto hide-scrollbar">
            {loading ? (
              <div className="p-md text-center text-on-surface-variant">Loading...</div>
            ) : vendorStats.map((vs) => (
              <div key={vs.id} className="p-md flex flex-col gap-sm">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-primary text-[16px]">{vs.name} <span className="text-xs text-on-surface-variant bg-surface-container px-1 rounded-sm ml-1">{vs.billsCount} bills</span></div>
                  <div className={`font-bold text-[16px] ${vs.outstanding > 0 ? 'text-error' : 'text-on-surface'}`}>
                    Bal: ₹{vs.outstanding.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-xs text-sm">
                  <div className="text-on-surface-variant">Billed: ₹{vs.billed.toLocaleString('en-IN')}</div>
                  <div className="text-[#166534]">Rec: ₹{vs.received.toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/Tablet Table Layout */}
          <div className="hidden md:block flex-1 overflow-y-auto hide-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#F1F5F9] border-b border-outline-variant z-10">
                <tr>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Vendor</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Billed</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Received</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {loading ? <tr><td colSpan={4} className="p-md text-center">Loading...</td></tr> : vendorStats.map(vs => (
                  <tr key={vs.id} className="hover:bg-surface-container-low">
                    <td className="px-md py-sm font-medium text-primary">{vs.name} <span className="text-xs text-on-surface-variant bg-surface-container px-1 rounded-sm ml-1">{vs.billsCount} bills</span></td>
                    <td className="px-md py-sm text-right">₹{vs.billed.toLocaleString('en-IN')}</td>
                    <td className="px-md py-sm text-right text-[#166534]">₹{vs.received.toLocaleString('en-IN')}</td>
                    <td className={`px-md py-sm text-right font-bold ${vs.outstanding > 0 ? 'text-error' : 'text-on-surface'}`}>
                      ₹{vs.outstanding.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Day Book */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col lg:h-[500px]">
          <div className="p-md border-b border-outline-variant bg-surface flex justify-between items-center rounded-t-2xl">
            <h3 className="font-headline-sm text-on-surface">Day Book</h3>
            <input type="date" value={dayBookDate} onChange={e => setDayBookDate(e.target.value)} className="bg-surface-container px-sm py-xs rounded-xl font-body-md border border-outline-variant focus:outline-none focus:border-primary" />
          </div>
          
          <div className="flex-1 overflow-y-auto hide-scrollbar p-md flex flex-col gap-md max-h-[400px] lg:max-h-none">
            <div>
              <h4 className="font-label-lg text-primary mb-xs">Bills Generated</h4>
              {dayBills.length === 0 ? <p className="text-sm text-on-surface-variant italic">No bills on this date.</p> : (
                <div className="border border-outline-variant rounded-xl overflow-hidden">
                  
                  {/* Mobile View */}
                  <div className="md:hidden flex flex-col divide-y divide-outline-variant/30">
                    {dayBills.map(b => (
                      <div key={b.id} className="p-sm flex justify-between items-center bg-surface">
                        <div>
                          <div className="font-medium text-[14px] text-primary">{b.bill_number}</div>
                          <div className="text-on-surface-variant text-xs truncate max-w-[150px]">{b.vendor_name}</div>
                        </div>
                        <div className="font-bold text-[14px] text-on-surface">₹{b.grand_total.toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                    <div className="p-sm flex justify-between items-center bg-surface-container-low font-bold">
                      <div className="text-sm">Total Bills:</div>
                      <div className="text-primary text-[14px]">₹{dayTotalSales.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {/* Desktop View */}
                  <table className="hidden md:table w-full text-sm text-left">
                    <thead className="bg-[#F1F5F9] border-b border-outline-variant">
                      <tr>
                        <th className="px-sm py-1 font-medium text-on-surface-variant">Bill No</th>
                        <th className="px-sm py-1 font-medium text-on-surface-variant">Vendor</th>
                        <th className="px-sm py-1 font-medium text-on-surface-variant text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 bg-surface">
                      {dayBills.map(b => (
                        <tr key={b.id}>
                          <td className="px-sm py-1">{b.bill_number}</td>
                          <td className="px-sm py-1 truncate max-w-[150px]">{b.vendor_name}</td>
                          <td className="px-sm py-1 text-right font-medium">₹{b.grand_total.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-container-low border-t border-outline-variant">
                      <tr>
                        <td colSpan={2} className="px-sm py-1 font-bold text-right">Total Bills:</td>
                        <td className="px-sm py-1 font-bold text-right text-primary">₹{dayTotalSales.toLocaleString('en-IN')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-label-lg text-[#166534] mb-xs">Payments Received</h4>
              {dayPayments.length === 0 ? <p className="text-sm text-on-surface-variant italic">No payments on this date.</p> : (
                <div className="border border-outline-variant rounded-xl overflow-hidden">
                  
                  {/* Mobile View */}
                  <div className="md:hidden flex flex-col divide-y divide-outline-variant/30">
                    {dayPayments.map(p => (
                      <div key={p.id} className="p-sm flex flex-col gap-xs bg-surface">
                        <div className="flex justify-between items-center">
                          <div className="font-medium text-[14px] text-primary truncate max-w-[150px]">{p.vendor_name}</div>
                          <div className="font-bold text-[14px] text-[#166534]">₹{p.total_received.toLocaleString('en-IN')}</div>
                        </div>
                        <div className="flex justify-between text-xs text-on-surface-variant">
                          <span>Cash: ₹{p.cash.toLocaleString('en-IN')}</span>
                          <span>UPI: ₹{p.upi.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                    <div className="p-sm flex justify-between items-center bg-surface-container-low font-bold">
                      <div className="text-sm">Total Collected:</div>
                      <div className="text-[#166534] text-[14px]">₹{dayTotalColl.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {/* Desktop View */}
                  <table className="hidden md:table w-full text-sm text-left">
                    <thead className="bg-[#F1F5F9] border-b border-outline-variant">
                      <tr>
                        <th className="px-sm py-1 font-medium text-on-surface-variant">Vendor</th>
                        <th className="px-sm py-1 font-medium text-on-surface-variant text-right">Cash</th>
                        <th className="px-sm py-1 font-medium text-on-surface-variant text-right">UPI</th>
                        <th className="px-sm py-1 font-medium text-on-surface-variant text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 bg-surface">
                      {dayPayments.map(p => (
                        <tr key={p.id}>
                          <td className="px-sm py-1 truncate max-w-[120px]">{p.vendor_name}</td>
                          <td className="px-sm py-1 text-right">₹{p.cash.toLocaleString('en-IN')}</td>
                          <td className="px-sm py-1 text-right">₹{p.upi.toLocaleString('en-IN')}</td>
                          <td className="px-sm py-1 text-right font-medium text-[#166534]">₹{p.total_received.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-container-low border-t border-outline-variant">
                      <tr>
                        <td colSpan={3} className="px-sm py-1 font-bold text-right">Total Collected:</td>
                        <td className="px-sm py-1 font-bold text-right text-[#166534]">₹{dayTotalColl.toLocaleString('en-IN')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
