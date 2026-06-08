'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Bill, Vendor, AppSetting } from '@/lib/types';
import PrintBill from '@/components/PrintBill';
import toast from 'react-hot-toast';

export default function BillsListPage() {
  const supabase = createClient();
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [billToPrint, setBillToPrint] = useState<Bill | null>(null);

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().split('T')[0]);
  const [customTo, setCustomTo] = useState(new Date().toISOString().split('T')[0]);
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [dateFilter, customFrom, customTo, vendorFilter]);

  const fetchInitialData = async () => {
    const [vendorsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').order('name'),
      supabase.from('app_settings').select('*').limit(1).single()
    ]);
    if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);
    if ((settingsRes as any).data) setAppSetting((settingsRes as any).data as AppSetting);
  };

  const fetchBills = async () => {
    setLoading(true);
    let query = supabase.from('bills').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });

    // Date Filtering
    const today = new Date();
    if (dateFilter === 'today') {
      const dStr = today.toISOString().split('T')[0];
      query = query.eq('date', dStr);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      query = query.gte('date', weekAgo.toISOString().split('T')[0]).lte('date', today.toISOString().split('T')[0]);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(today.getMonth() - 1);
      query = query.gte('date', monthAgo.toISOString().split('T')[0]).lte('date', today.toISOString().split('T')[0]);
    } else if (dateFilter === 'custom') {
      query = query.gte('date', customFrom).lte('date', customTo);
    }

    // Vendor Filtering
    if (vendorFilter !== 'all') {
      query = query.eq('vendor_id', vendorFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setBills(data as Bill[]);
    }
    setLoading(false);
  };

  const handlePrint = (bill: Bill) => {
    setBillToPrint(bill);
    setTimeout(() => {
      window.print();
      setTimeout(() => setBillToPrint(null), 1000);
    }, 500);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill? This cannot be undone.')) return;
    
    // Deleting the bill doesn't revert stock automatically in this app, typically you'd want to write a trigger.
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete bill');
    } else {
      toast.success('Bill deleted successfully');
      fetchBills();
    }
  };

  return (
    <>
      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Saved Bills</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">View, print, and manage past bills.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md flex flex-col sm:flex-row flex-wrap gap-md items-end">
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md focus:border-primary focus:outline-none transition-all"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="w-full sm:w-auto flex gap-sm">
              <div className="flex-1 w-[140px]">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md focus:border-primary focus:outline-none transition-all"
                />
              </div>
              <div className="flex-1 w-[140px]">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md focus:border-primary focus:outline-none transition-all"
            >
              <option value="all">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bills List */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col divide-y divide-outline-variant/30">
            {loading ? (
              <div className="p-md text-center text-on-surface-variant">Loading bills...</div>
            ) : bills.length === 0 ? (
              <div className="p-md text-center text-on-surface-variant">No bills found for the selected filters.</div>
            ) : (
              bills.map((bill) => {
                const itemCount = Array.isArray(bill.items) ? bill.items.length : 0;
                return (
                  <div key={bill.id} className="p-md flex flex-col gap-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-primary text-[16px]">{bill.bill_number}</div>
                        <div className="text-on-surface-variant text-sm mt-xs">{new Date(bill.date).toLocaleDateString('en-GB')}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[16px] text-on-surface">₹{Number(bill.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className="text-on-surface-variant text-xs mt-xs">{itemCount} items</div>
                      </div>
                    </div>
                    <div className="font-body-md text-on-surface">{bill.vendor_name}</div>
                    <div className="flex justify-end gap-md mt-xs">
                      <button onClick={() => handlePrint(bill)} className="text-secondary hover:text-secondary-container transition-colors flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[18px]">print</span> <span className="text-sm">Print</span>
                      </button>
                      <button onClick={() => handleDelete(bill.id)} className="text-error hover:text-error-container transition-colors flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[18px]">delete</span> <span className="text-sm">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop/Tablet Table Layout */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/6">Bill No.</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/6">Date</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-2/6">Vendor</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/6">Items</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/6 text-right">Total</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-[100px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-md py-lg text-center text-on-surface-variant">Loading bills...</td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-md py-lg text-center text-on-surface-variant">No bills found for the selected filters.</td>
                  </tr>
                ) : (
                  bills.map((bill) => {
                    const itemCount = Array.isArray(bill.items) ? bill.items.length : 0;
                    return (
                      <tr key={bill.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-md py-sm font-medium text-primary">{bill.bill_number}</td>
                        <td className="px-md py-sm text-on-surface-variant">
                          {new Date(bill.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-md py-sm">{bill.vendor_name}</td>
                        <td className="px-md py-sm text-on-surface-variant text-sm">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </td>
                        <td className="px-md py-sm text-right font-medium text-on-surface">
                          ₹{Number(bill.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-md py-sm text-center">
                          <button onClick={() => handlePrint(bill)} className="text-secondary hover:text-secondary-container transition-colors mr-sm" title="Print Bill">
                            <span className="material-symbols-outlined text-[20px]">print</span>
                          </button>
                          <button onClick={() => handleDelete(bill.id)} className="text-error hover:text-error-container transition-colors" title="Delete Bill">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
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

      <PrintBill bill={billToPrint} appSetting={appSetting} />
    </>
  );
}
