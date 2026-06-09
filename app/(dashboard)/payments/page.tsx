'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Payment } from '@/lib/types';

export default function PaymentsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPassword, setMasterPassword] = useState('1234');

  // Payments State
  const [todayPayments, setTodayPayments] = useState<Payment[]>([]);
  const [historyPayments, setHistoryPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Form State
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
    cash: '',
    upi: '',
  });
  const [totalBilled, setTotalBilled] = useState<number>(0);

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  useEffect(() => {
    if (showHistory && historyPage === 0 && historyPayments.length === 0) {
      fetchHistory(0, true);
    }
  }, [showHistory, historyPage]);

  const fetchInitialData = async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const [vendorsRes, todayRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('active', true),
      supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value')
    ]);

    if ((vendorsRes as any).error && (vendorsRes as any).error.message.includes('active')) {
       const fallbackRes = await supabase.from('vendors').select('id, name, type').eq('is_active', true);
       if (fallbackRes.data) setVendors(fallbackRes.data as Vendor[]);
    } else if ((vendorsRes as any).data) {
       setVendors((vendorsRes as any).data as Vendor[]);
    }

    if ((todayRes as any).data) setTodayPayments((todayRes as any).data as Payment[]);
    
    let pwd = '1234';
    if ((settingsRes as any).data) {
      const allSettings = (settingsRes as any).data;
      const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = pwdSetting.value;
    }
    setMasterPassword(pwd);
    setLoading(false);
  };

  const fetchHistory = async (pageIndex: number, reset: boolean = false) => {
    setHistoryLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data } = await supabase
      .from('payments')
      .select('*, vendors(name)')
      .neq('date', todayStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) {
      if (reset) {
        setHistoryPayments(data as Payment[]);
      } else {
        setHistoryPayments(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPayments = data.filter(p => !existingIds.has(p.id));
          return [...prev, ...(newPayments as Payment[])];
        });
      }
      setHasMoreHistory(data.length === ITEMS_PER_PAGE);
    }
    setHistoryLoading(false);
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

  const loadMoreHistory = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    fetchHistory(nextPage);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id) return toast.error("Please select a vendor.");

    const cashAmount = Number(formData.cash) || 0;
    const upiAmount = Number(formData.upi) || 0;
    
    if (cashAmount === 0 && upiAmount === 0) {
      return toast.error("Please enter a payment amount (Cash or UPI).");
    }

    setSaving(true);
    const totalReceived = cashAmount + upiAmount;

    const payload = {
      vendor_id: formData.vendor_id,
      date: formData.date,
      cash_amount: cashAmount,
      upi_amount: upiAmount,
      total_received: totalReceived
    };

    let error;
    if (editingPaymentId) {
      const res = await (supabase as any).from('payments').update(payload).eq('id', editingPaymentId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('payments').insert([payload]);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      return toast.error("Error saving payment: " + error.message);
    }

    toast.success(editingPaymentId ? "Payment updated successfully!" : "Payment saved successfully!");
    handleClear();
    
    // Refresh Today's payments
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
    if (data) setTodayPayments(data as Payment[]);

    // If viewing history, reset and refetch
    if (showHistory) {
      setHistoryPage(0);
      fetchHistory(0, true);
    }
  };

  const handleClear = () => {
    setFormData({ vendor_id: '', date: new Date().toISOString().split('T')[0], cash: '', upi: '' });
    setTotalBilled(0);
    setEditingPaymentId(null);
  };

  const startEdit = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    setFormData({
      vendor_id: payment.vendor_id,
      date: payment.date,
      cash: payment.cash_amount > 0 ? String(payment.cash_amount) : '',
      upi: payment.upi_amount > 0 ? String(payment.upi_amount) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Editing Payment', { icon: '✏️' });
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
    setPasswordInput('');
    setShowPasswordModal(true);
  };

  const confirmDelete = async () => {
    if (passwordInput !== masterPassword) {
      toast.error("Incorrect password");
      return;
    }
    setShowPasswordModal(false);
    if (pendingDeleteId) {
      const { error } = await supabase.from('payments').delete().eq('id', pendingDeleteId);
      if (error) {
        toast.error('Failed to delete payment');
      } else {
        toast.success('Payment deleted successfully');
        
        // Refresh Today
        const todayStr = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
        if (data) setTodayPayments(data as Payment[]);

        // Refresh History
        if (showHistory) {
          setHistoryPage(0);
          fetchHistory(0, true);
        }
      }
      setPendingDeleteId(null);
    }
  };

  const cashNum = Number(formData.cash) || 0;
  const upiNum = Number(formData.upi) || 0;
  const currentTotalReceived = cashNum + upiNum;
  const currentOutstanding = totalBilled - currentTotalReceived;

  const todaysTotalReceived = todayPayments.reduce((acc, curr) => acc + curr.total_received, 0);

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md pb-xs">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Payments</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Record and manage vendor collections.</p>
        </div>
      </div>

      {/* Top Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-md flex items-center justify-between animate-fade-in">
        <div>
          <h3 className="font-label-lg text-primary uppercase tracking-wider">Today's Total Received</h3>
          <p className="font-headline-lg text-on-surface font-bold mt-1">₹{todaysTotalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg animate-fade-in">
        {editingPaymentId && (
          <div className="bg-primary/10 text-primary p-sm rounded-xl font-medium flex items-center justify-between">
            <span>Editing Payment</span>
            <button onClick={handleClear} className="text-primary hover:underline text-sm">Cancel Edit</button>
          </div>
        )}
        <form onSubmit={handleSave} className="flex flex-col gap-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
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
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-md items-end bg-surface-container-low p-md rounded-2xl border border-outline-variant">
            <div className="md:col-span-3">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Billing Status on {formData.date}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant">Total Billed</span>
              <span className="font-headline-md text-on-surface font-bold mt-xs">₹{totalBilled.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant">Being Received</span>
              <span className="font-headline-md text-primary font-bold mt-xs">₹{currentTotalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant">Bill Outstanding</span>
              <span className={`font-headline-md font-bold mt-xs ${currentOutstanding > 0 ? 'text-error' : 'text-[#166534]'}`}>
                ₹{currentOutstanding.toLocaleString('en-IN', {minimumFractionDigits: 2})}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Cash Received (₹)</label>
              <input
                type="number" min="0" step="0.01" value={formData.cash}
                onChange={(e) => setFormData({...formData, cash: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">UPI Received (₹)</label>
              <input
                type="number" min="0" step="0.01" value={formData.upi}
                onChange={(e) => setFormData({...formData, upi: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end mt-sm gap-md">
            <button type="button" onClick={handleClear} disabled={saving} className="px-xl py-sm border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-variant/20 transition-colors">
              Clear
            </button>
            <button type="submit" disabled={saving} className="flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
              <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>

      {/* Today's Payments List */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col animate-fade-in">
        <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface">Today's Payments</h3>
        </div>
        <div className="flex flex-col divide-y divide-outline-variant/30 p-sm md:p-0">
          {loading ? (
            <div className="p-md text-center text-on-surface-variant">Loading...</div>
          ) : todayPayments.length === 0 ? (
            <div className="p-md text-center text-on-surface-variant">No payments recorded today.</div>
          ) : (
            todayPayments.map((payment) => (
              <div key={payment.id} className="p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm hover:bg-surface-container-low transition-colors rounded-xl md:rounded-none">
                <div className="flex flex-col sm:w-1/3">
                  <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:gap-lg text-sm text-on-surface-variant sm:w-1/3">
                  <div>Cash: ₹{payment.cash_amount?.toLocaleString('en-IN') || '0'}</div>
                  <div>UPI: ₹{payment.upi_amount?.toLocaleString('en-IN') || '0'}</div>
                </div>
                <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                  <span className="font-bold text-[16px] text-[#166534]">₹{payment.total_received.toLocaleString('en-IN')}</span>
                  <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                    <button onClick={() => startEdit(payment)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteRequest(payment.id)} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* History Payments List */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col mt-md animate-fade-in mb-xl">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center hover:bg-surface-container-low transition-colors w-full text-left"
        >
          <h3 className="font-headline-sm text-on-surface flex items-center gap-2">
            Payment History <span className="text-sm font-normal text-on-surface-variant">(Past dates)</span>
          </h3>
          <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300" style={{ transform: showHistory ? 'rotate(180deg)' : '' }}>expand_more</span>
        </button>
        
        {showHistory && (
          <div className="flex flex-col p-sm md:p-md gap-sm bg-surface-container-lowest animate-fade-in">
            {historyPayments.map((payment) => (
              <div key={payment.id} className="p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm border border-outline-variant/50 rounded-2xl hover:border-primary/30 transition-colors">
                <div className="flex flex-col sm:w-1/3">
                  <span className="text-xs text-on-surface-variant mb-1">{payment.date}</span>
                  <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:gap-lg text-sm text-on-surface-variant sm:w-1/3">
                  <div>Cash: ₹{payment.cash_amount?.toLocaleString('en-IN') || '0'}</div>
                  <div>UPI: ₹{payment.upi_amount?.toLocaleString('en-IN') || '0'}</div>
                </div>
                <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                  <span className="font-bold text-[16px] text-[#166534]">₹{payment.total_received.toLocaleString('en-IN')}</span>
                  <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                    <button onClick={() => startEdit(payment)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteRequest(payment.id)} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {historyLoading && <div className="text-center py-md text-on-surface-variant">Loading history...</div>}
            
            {hasMoreHistory && historyPayments.length > 0 && !historyLoading && (
              <button onClick={loadMoreHistory} className="mt-xs py-sm text-primary font-medium hover:underline text-center w-full">
                Load More History
              </button>
            )}
            
            {!historyLoading && historyPayments.length === 0 && (
              <div className="text-center py-xl text-on-surface-variant">No past payments found.</div>
            )}
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-lg w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-error mb-sm flex items-center gap-2">
              <span className="material-symbols-outlined">lock</span> Password Required
            </h3>
            <p className="text-on-surface-variant text-sm mb-md">Enter master password to delete this payment.</p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl text-[16px] mb-md outline-none focus:border-error focus:ring-1 focus:ring-error"
              placeholder="Enter password"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
            />
            <div className="flex justify-end gap-sm">
              <button onClick={() => setShowPasswordModal(false)} className="px-md py-sm text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-md py-sm bg-error text-white rounded-xl hover:bg-error/90 transition-colors">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
