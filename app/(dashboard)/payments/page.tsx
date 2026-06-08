'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Payment } from '@/lib/types';

export default function PaymentsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
    cash: '',
    upi: '',
  });

  const [totalBilled, setTotalBilled] = useState<number>(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.vendor_id && formData.date) {
      fetchBilledAmount(formData.vendor_id, formData.date);
    } else {
      setTotalBilled(0);
    }
  }, [formData.vendor_id, formData.date]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [vendorsRes, paymentsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('is_active', true),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);
    if ((paymentsRes as any).data) setPayments((paymentsRes as any).data as Payment[]);
    setLoading(false);
  };

  const fetchBilledAmount = async (vendor_id: string, date: string) => {
    const { data } = await supabase
      .from('bills')
      .select('grand_total')
      .eq('vendor_id', vendor_id)
      .eq('date', date);
    
    if (data) {
      const sum = data.reduce((acc: number, curr: any) => acc + (Number(curr.grand_total) || 0), 0);
      setTotalBilled(sum);
    } else {
      setTotalBilled(0);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }

    const cashAmount = Number(formData.cash) || 0;
    const upiAmount = Number(formData.upi) || 0;
    
    if (cashAmount === 0 && upiAmount === 0) {
      toast.error("Please enter a payment amount (Cash or UPI).");
      return;
    }

    setSaving(true);
    const totalReceived = cashAmount + upiAmount;
    const outstanding = totalBilled - totalReceived;

    const vendor = vendors.find(v => v.id === formData.vendor_id);

    const payload = {
      vendor_id: formData.vendor_id,
      vendor_name: vendor?.name || '',
      date: formData.date,
      total_billed: totalBilled,
      cash: cashAmount,
      upi: upiAmount,
      total_received: totalReceived,
      outstanding: outstanding
    };

    const { error } = await (supabase as any).from('payments').insert([payload]);

    setSaving(false);

    if (error) {
      toast.error("Error saving payment: " + error.message);
      return;
    }

    toast.success("Payment saved successfully!");
    setFormData({ ...formData, vendor_id: '', cash: '', upi: '' });
    setTotalBilled(0);
    fetchInitialData();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this payment?")) {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete payment');
      } else {
        toast.success('Payment deleted successfully');
        fetchInitialData();
      }
    }
  };

  const cashNum = Number(formData.cash) || 0;
  const upiNum = Number(formData.upi) || 0;
  const currentTotalReceived = cashNum + upiNum;
  const currentOutstanding = totalBilled - currentTotalReceived;

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Payments</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage payments and collections.</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow p-xl flex flex-col gap-lg">
        <form onSubmit={handleSave} className="flex flex-col gap-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-md items-end bg-surface-container-low p-md rounded-lg border border-outline-variant">
            <div className="md:col-span-3">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Today's Billing Status</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant">Total Billed</span>
              <span className="font-headline-md text-on-surface font-bold mt-xs">₹{totalBilled.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant">Total Received</span>
              <span className="font-headline-md text-primary font-bold mt-xs">₹{currentTotalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant">Outstanding</span>
              <span className={`font-headline-md font-bold mt-xs ${currentOutstanding > 0 ? 'text-error' : 'text-[#166534]'}`}>
                ₹{currentOutstanding.toLocaleString('en-IN', {minimumFractionDigits: 2})}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Cash Received (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cash}
                onChange={(e) => setFormData({...formData, cash: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">UPI Received (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.upi}
                onChange={(e) => setFormData({...formData, upi: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end mt-sm">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col mt-md">
        <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface">Today's Payments</h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Vendor</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Total Billed</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Cash</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">UPI</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Total Received</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Outstanding</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={7} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-md py-lg text-center text-on-surface-variant">No payments recorded yet.</td></tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm font-medium text-primary">{payment.vendor_name}</td>
                    <td className="px-md py-sm text-right text-on-surface-variant">₹{payment.total_billed.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="px-md py-sm text-right text-on-surface-variant">₹{payment.cash.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="px-md py-sm text-right text-on-surface-variant">₹{payment.upi.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="px-md py-sm text-right font-bold text-[#166534]">₹{payment.total_received.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="px-md py-sm text-right">
                      <span className={`font-bold ${payment.outstanding > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                        ₹{payment.outstanding.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                      </span>
                    </td>
                    <td className="px-md py-sm text-center">
                      <button onClick={() => handleDelete(payment.id)} className="text-error hover:text-error-container transition-colors">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
