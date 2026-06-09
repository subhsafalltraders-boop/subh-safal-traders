'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Payment, Advance } from '@/lib/types';

export default function PaymentsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPassword, setMasterPassword] = useState('1234');
  const [activeTab, setActiveTab] = useState<'regular' | 'advance'>('regular');
  const [paymentsTab, setPaymentsTab] = useState<'record' | 'previous'>('record');
  const [previousPaymentsVendorFilter, setPreviousPaymentsVendorFilter] = useState<string>('all');

  // Payments State
  const [todayPayments, setTodayPayments] = useState<(Payment & { is_deleted?: boolean })[]>([]);
  const [historyPayments, setHistoryPayments] = useState<(Payment & { is_deleted?: boolean })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [allPayments, setAllPayments] = useState<(Payment & { is_deleted?: boolean })[]>([]);
  const ITEMS_PER_PAGE = 20;

  // Advances State
  const [todayAdvances, setTodayAdvances] = useState<Advance[]>([]);
  const [historyAdvances, setHistoryAdvances] = useState<Advance[]>([]);
  const [advanceHistoryPage, setAdvanceHistoryPage] = useState(0);
  const [hasMoreAdvanceHistory, setHasMoreAdvanceHistory] = useState(true);

  // Form State
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
    cash: '',
    upi: '',
  });
  
  const [advanceFormData, setAdvanceFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: ''
  });

  const [totalBilled, setTotalBilled] = useState<number>(0);

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [passwordError, setPasswordError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<{id: string, type: 'payment' | 'advance'} | null>(null);
  const [pendingEditPayment, setPendingEditPayment] = useState<(Payment & {is_deleted?: boolean}) | null>(null);

  useEffect(() => {
    fetchInitialData();
    fetchPayments();
  }, []);

  useEffect(() => {
    if (activeTab === 'regular') {
      if (formData.vendor_id && formData.date) {
        fetchBilledAmount(formData.vendor_id, formData.date);
      } else {
        setTotalBilled(0);
      }
    }
  }, [formData.vendor_id, formData.date, activeTab]);

  useEffect(() => {
    if (showHistory) {
      if (activeTab === 'regular' && historyPage === 0 && historyPayments.length === 0) {
        fetchHistory(0, true);
      } else if (activeTab === 'advance' && advanceHistoryPage === 0 && historyAdvances.length === 0) {
        fetchAdvanceHistory(0, true);
      }
    }
  }, [showHistory, historyPage, advanceHistoryPage, activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const [vendorsRes, todayRes, todayAdvRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('active', true),
      supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false }),
      (supabase as any).from('vendor_advances').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value')
    ]);

    if ((vendorsRes as any).error && (vendorsRes as any).error.message.includes('active')) {
       const fallbackRes = await supabase.from('vendors').select('id, name, type').eq('is_active', true);
       if (fallbackRes.data) setVendors(fallbackRes.data as Vendor[]);
    } else if ((vendorsRes as any).data) {
       setVendors((vendorsRes as any).data as Vendor[]);
    }

    if ((todayRes as any).data) setTodayPayments((todayRes as any).data);
    if (!todayAdvRes.error && todayAdvRes.data) setTodayAdvances(todayAdvRes.data as Advance[]);
    
    let pwd = '1234';
    if ((settingsRes as any).data) {
      const allSettings = (settingsRes as any).data;
      const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = pwdSetting.value;
    }
    setMasterPassword(pwd);
    setMasterPassword(pwd);
    setLoading(false);
  };

  const fetchPayments = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*, vendors(name, type)')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (data) {
      setAllPayments(data);
    }
    setHistoryLoading(false);
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
        setHistoryPayments(data);
      } else {
        setHistoryPayments(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPayments = data.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...(newPayments)];
        });
      }
      setHasMoreHistory(data.length === ITEMS_PER_PAGE);
    }
    setHistoryLoading(false);
  };

  const fetchAdvanceHistory = async (pageIndex: number, reset: boolean = false) => {
    setHistoryLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await (supabase as any)
      .from('vendor_advances')
      .select('*, vendors(name)')
      .neq('date', todayStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      if (reset) {
        setHistoryAdvances(data as Advance[]);
      } else {
        setHistoryAdvances(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAdvances = data.filter((a: any) => !existingIds.has(a.id));
          return [...prev, ...(newAdvances as Advance[])];
        });
      }
      setHasMoreAdvanceHistory(data.length === ITEMS_PER_PAGE);
    }
    setHistoryLoading(false);
  };

  const fetchBilledAmount = async (vendor_id: string, date: string) => {
    const { data } = await supabase
      .from('bills')
      .select('total, grand_total')
      .eq('vendor_id', vendor_id)
      .eq('date', date)
      .eq('is_deleted', false);
    
    if (data) {
      const sum = data.reduce((acc: number, curr: any) => acc + (Number(curr.total || curr.grand_total) || 0), 0);
      setTotalBilled(sum);
    } else {
      setTotalBilled(0);
    }
  };

  const loadMoreHistory = () => {
    if (activeTab === 'regular') {
      const nextPage = historyPage + 1;
      setHistoryPage(nextPage);
      fetchHistory(nextPage);
    } else {
      const nextPage = advanceHistoryPage + 1;
      setAdvanceHistoryPage(nextPage);
      fetchAdvanceHistory(nextPage);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
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
      total_received: totalReceived,
      is_deleted: false
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
    
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
    if (data) setTodayPayments(data);

    fetchPayments();

    if (showHistory) {
      setHistoryPage(0);
      fetchHistory(0, true);
    }
  };

  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceFormData.vendor_id) return toast.error("Please select a vendor.");
    const amt = Number(advanceFormData.amount);
    if (!amt || amt <= 0) return toast.error("Please enter a valid amount.");

    setSaving(true);
    const payload = {
      vendor_id: advanceFormData.vendor_id,
      date: advanceFormData.date,
      amount: amt,
      note: advanceFormData.note,
      used_in_settlement: false
    };

    const res = await (supabase as any).from('vendor_advances').insert([payload]);
    setSaving(false);

    if (res.error) {
      return toast.error("Error saving advance: " + res.error.message);
    }

    toast.success("Advance saved successfully!");
    setAdvanceFormData({ vendor_id: '', date: new Date().toISOString().split('T')[0], amount: '', note: '' });

    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await (supabase as any).from('vendor_advances').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
    if (data) setTodayAdvances(data as Advance[]);

    if (showHistory) {
      setAdvanceHistoryPage(0);
      fetchAdvanceHistory(0, true);
    }
  };

  const handleClear = () => {
    setFormData({ vendor_id: '', date: new Date().toISOString().split('T')[0], cash: '', upi: '' });
    setTotalBilled(0);
    setEditingPaymentId(null);
  };

  const startEdit = (payment: Payment & {is_deleted?: boolean}) => {
    if (payment.is_deleted) return;
    setPendingEditPayment(payment);
    setPendingDeleteId(null);
    setPasswordInput('');
    setPasswordStep(1);
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handleDeleteRequest = (id: string, type: 'payment' | 'advance') => {
    setPendingDeleteId({ id, type });
    setPasswordInput('');
    setPasswordStep(1);
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput !== masterPassword) {
      setPasswordError("Incorrect password");
      setPasswordInput('');
    } else {
      setPasswordError('');
      if (pendingEditPayment) {
        setShowPasswordModal(false);
        const payment = pendingEditPayment;
        setPendingEditPayment(null);
        setActiveTab('regular');
        setPaymentsTab('record');
        setEditingPaymentId(payment.id);
        setFormData({
          vendor_id: payment.vendor_id,
          date: payment.date,
          cash: payment.cash > 0 ? String(payment.cash) : ((payment as any).cash_amount > 0 ? String((payment as any).cash_amount) : ''),
          upi: payment.upi > 0 ? String(payment.upi) : ((payment as any).upi_amount > 0 ? String((payment as any).upi_amount) : '')
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('Editing Payment', { icon: '✏️' });
      } else {
        setPasswordStep(2);
      }
    }
  };

  const confirmDelete = async () => {
    setShowPasswordModal(false);
    if (pendingDeleteId) {
      let error;
      if (pendingDeleteId.type === 'payment') {
        const res = await (supabase as any).from('payments').update({ is_deleted: true }).eq('id', pendingDeleteId.id);
        error = res.error;
      } else {
        const res = await (supabase as any).from('vendor_advances').delete().eq('id', pendingDeleteId.id);
        error = res.error;
      }
      
      if (error) {
        toast.error(`Failed to delete ${pendingDeleteId.type}`);
      } else {
        toast.success(`${pendingDeleteId.type === 'payment' ? 'Payment' : 'Advance'} deleted successfully`);
        
        const todayStr = new Date().toISOString().split('T')[0];
        if (pendingDeleteId.type === 'payment') {
          const { data } = await supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
          if (data) setTodayPayments(data);
          fetchPayments();
          if (showHistory) {
            setHistoryPage(0);
            fetchHistory(0, true);
          }
        } else {
          const { data } = await (supabase as any).from('vendor_advances').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
          if (data) setTodayAdvances(data as Advance[]);
          if (showHistory) {
            setAdvanceHistoryPage(0);
            fetchAdvanceHistory(0, true);
          }
        }
      }
      setPendingDeleteId(null);
    }
  };

  const cashNum = Number(formData.cash) || 0;
  const upiNum = Number(formData.upi) || 0;
  const currentTotalReceived = cashNum + upiNum;
  const currentOutstanding = totalBilled - currentTotalReceived;

  const todaysTotalReceived = todayPayments.reduce((acc, curr) => curr.is_deleted ? acc : acc + curr.total_received, 0);
  const todaysTotalAdvances = todayAdvances.reduce((acc, curr) => acc + curr.amount, 0);

  const groupedHistoryPayments = useMemo(() => {
    const groups: Record<string, (Payment & { is_deleted?: boolean })[]> = {};
    const filtered = previousPaymentsVendorFilter === 'all' 
      ? allPayments 
      : allPayments.filter(p => p.vendor_id === previousPaymentsVendorFilter);
      
    filtered.forEach(payment => {
      if (!groups[payment.date]) {
        groups[payment.date] = [];
      }
      groups[payment.date].push(payment);
    });
    return groups;
  }, [allPayments, previousPaymentsVendorFilter]);

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md pb-xs">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Payments & Advances</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Record regular collections or advances given.</p>
        </div>
      </div>

      {/* Main Tabs - Record Payment vs Previous Payments */}
      <div className="flex border-b border-outline-variant mt-sm">
        <button 
          onClick={() => setPaymentsTab('record')}
          className={`flex-1 sm:flex-none px-xl py-md font-label-lg transition-colors border-b-2 ${paymentsTab === 'record' ? 'border-primary text-primary font-bold bg-primary/5' : 'border-transparent text-on-surface-variant hover:bg-surface-variant/10'}`}
        >
          Record Payment
        </button>
        <button 
          onClick={() => setPaymentsTab('previous')}
          className={`flex-1 sm:flex-none px-xl py-md font-label-lg transition-colors border-b-2 ${paymentsTab === 'previous' ? 'border-primary text-primary font-bold bg-primary/5' : 'border-transparent text-on-surface-variant hover:bg-surface-variant/10'}`}
        >
          Previous Payments
        </button>
      </div>

      {paymentsTab === 'record' && (
        <>
          {/* Sub Tabs - Regular vs Advance (only in Record Payment mode) */}
          <div className="flex border-b border-outline-variant">
            <button 
              onClick={() => setActiveTab('regular')}
              className={`flex-1 sm:flex-none px-lg py-sm font-label-md transition-colors border-b-2 ${activeTab === 'regular' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
            >
              Regular Payment
            </button>
            <button 
              onClick={() => setActiveTab('advance')}
              className={`flex-1 sm:flex-none px-lg py-sm font-label-md transition-colors border-b-2 ${activeTab === 'advance' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
            >
              Advance Given
            </button>
          </div>

      {/* Top Banner */}
      {paymentsTab === 'record' && activeTab === 'regular' && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-md flex items-center justify-between animate-fade-in">
          <div>
            <h3 className="font-label-lg text-primary uppercase tracking-wider">Today's Total Received</h3>
            <p className="font-headline-lg text-on-surface font-bold mt-1">₹{todaysTotalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          </div>
        </div>
      )}
      {paymentsTab === 'record' && activeTab === 'advance' && (
        <div className="bg-error/10 border border-error/20 rounded-2xl p-md flex items-center justify-between animate-fade-in">
          <div>
            <h3 className="font-label-lg text-error uppercase tracking-wider">Today's Advances Given</h3>
            <p className="font-headline-lg text-on-surface font-bold mt-1">₹{todaysTotalAdvances.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-error/20 flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-[24px]">money_off</span>
          </div>
        </div>
      )}
        </>
      )}

      {/* Main Forms - Only show in Record Payment tab */}
      {paymentsTab === 'record' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg animate-fade-in">
        {activeTab === 'regular' && (
          <form onSubmit={handleSavePayment} className="flex flex-col gap-lg animate-fade-in">
            {editingPaymentId && (
              <div className="bg-primary/10 text-primary p-sm rounded-xl font-medium flex items-center justify-between">
                <span>Editing Payment</span>
                <button type="button" onClick={handleClear} className="text-primary hover:underline text-sm">Cancel Edit</button>
              </div>
            )}
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
        )}

        {activeTab === 'advance' && (
          <form onSubmit={handleSaveAdvance} className="flex flex-col gap-lg animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
                <select
                  value={advanceFormData.vendor_id}
                  onChange={(e) => setAdvanceFormData({...advanceFormData, vendor_id: e.target.value})}
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
                  value={advanceFormData.date}
                  onChange={(e) => setAdvanceFormData({...advanceFormData, date: e.target.value})}
                  className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Advance Amount (₹) *</label>
                <input
                  type="number" min="1" step="1" value={advanceFormData.amount}
                  onChange={(e) => setAdvanceFormData({...advanceFormData, amount: e.target.value})}
                  className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="0"
                />
              </div>
            </div>
            
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Note (Optional)</label>
              <input
                type="text" value={advanceFormData.note}
                onChange={(e) => setAdvanceFormData({...advanceFormData, note: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="e.g. For next week's stock"
              />
            </div>

            <div className="flex justify-end mt-sm gap-md">
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-xs px-xl py-sm bg-error text-on-primary font-label-md rounded-xl hover:bg-error/90 transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Advance'}
              </button>
            </div>
          </form>
        )}
      </div>
      )}

      {/* Lists - Only show in Record Payment tab */}
      {paymentsTab === 'record' && activeTab === 'regular' && (
        <>
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
                  <div key={payment.id} className={`p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm hover:bg-surface-container-low transition-colors rounded-xl md:rounded-none ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                    <div className="flex flex-col sm:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                        {payment.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:gap-lg text-sm text-on-surface-variant sm:w-1/3">
                      <div>Cash: ₹{((payment as any).cash_amount || payment.cash)?.toLocaleString('en-IN') || '0'}</div>
                      <div>UPI: ₹{((payment as any).upi_amount || payment.upi)?.toLocaleString('en-IN') || '0'}</div>
                    </div>
                    <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                      <span className="font-bold text-[16px] text-[#166534]">₹{payment.total_received.toLocaleString('en-IN')}</span>
                      {!payment.is_deleted && (
                        <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                          <button onClick={() => startEdit(payment)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      {paymentsTab === 'record' && activeTab === 'advance' && (
        <>
          {/* Today's Advances List */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col animate-fade-in">
            <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
              <h3 className="font-headline-sm text-on-surface">Today's Advances Given</h3>
            </div>
            <div className="flex flex-col divide-y divide-outline-variant/30 p-sm md:p-0">
              {loading ? (
                <div className="p-md text-center text-on-surface-variant">Loading...</div>
              ) : todayAdvances.length === 0 ? (
                <div className="p-md text-center text-on-surface-variant">No advances given today.</div>
              ) : (
                todayAdvances.map((adv) => (
                  <div key={adv.id} className="p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm hover:bg-surface-container-low transition-colors rounded-xl md:rounded-none">
                    <div className="flex flex-col sm:w-1/3">
                      <span className="font-medium text-error text-[16px]">{(adv as any).vendors?.name || 'Unknown'}</span>
                      {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                    </div>
                    <div className="flex sm:w-1/3 items-center justify-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${adv.used_in_settlement ? 'bg-primary/10 text-primary' : 'bg-surface-variant/20 text-on-surface-variant'}`}>
                        {adv.used_in_settlement ? 'Settled' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                      <span className="font-bold text-[16px] text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                      <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                        <button onClick={() => handleDeleteRequest(adv.id, 'advance')} disabled={adv.used_in_settlement} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors disabled:opacity-30">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Previous Payments Tab - Show all payments with vendor filter */}
      {paymentsTab === 'previous' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md flex flex-col gap-md animate-fade-in min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
            <h3 className="font-headline-sm text-on-surface">Previous Payments History</h3>
            <div className="w-full sm:w-64">
              <select
                value={previousPaymentsVendorFilter}
                onChange={(e) => {
                  setPreviousPaymentsVendorFilter(e.target.value);
                  setHistoryPage(0);
                  fetchHistory(0, true);
                }}
                className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              >
                <option value="all">All Vendors & Shopkeepers</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-sm">
            {historyLoading && allPayments.length === 0 ? (
              <div className="text-center text-on-surface-variant py-xl">Loading...</div>
            ) : allPayments.length === 0 ? (
              <div className="text-center text-on-surface-variant py-xl">No previous payments found.</div>
            ) : Object.keys(groupedHistoryPayments).length === 0 ? (
              <div className="text-center text-on-surface-variant py-xl">No payments found for this vendor.</div>
            ) : (
              Object.entries(groupedHistoryPayments).map(([date, datePayments]) => (
                <div key={date} className="mb-md">
                  <h3 className="font-label-lg text-on-surface-variant mb-sm sticky top-0 bg-surface-container-lowest py-2 border-b border-outline-variant/30 z-10">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  <div className="flex flex-col gap-sm">
                    {datePayments.map(payment => (
                      <div key={payment.id} className={`p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm border border-outline-variant rounded-2xl hover:border-primary/30 transition-colors ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                        <div className="flex flex-col sm:w-1/4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                            {payment.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:gap-lg text-sm text-on-surface-variant sm:w-1/3">
                          <div>Cash: ₹{((payment as any).cash_amount || payment.cash)?.toLocaleString('en-IN') || '0'}</div>
                          <div>UPI: ₹{((payment as any).upi_amount || payment.upi)?.toLocaleString('en-IN') || '0'}</div>
                        </div>
                        <div className="flex items-center justify-between sm:w-1/4 sm:justify-end gap-md">
                          <span className="font-bold text-[16px] text-[#166534]">Total: ₹{payment.total_received.toLocaleString('en-IN')}</span>
                          {!payment.is_deleted && (
                            <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                              <button onClick={() => startEdit(payment)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors" title="Edit">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors" title="Delete">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Shared History List - Keep for backward compatibility when in Record Payment mode */}
      {paymentsTab === 'record' && (
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col mt-md animate-fade-in mb-xl">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center hover:bg-surface-container-low transition-colors w-full text-left"
        >
          <h3 className="font-headline-sm text-on-surface flex items-center gap-2">
            {activeTab === 'regular' ? 'Payment History' : 'Advance History'} <span className="text-sm font-normal text-on-surface-variant">(Past dates)</span>
          </h3>
          <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300" style={{ transform: showHistory ? 'rotate(180deg)' : '' }}>expand_more</span>
        </button>
        
        {showHistory && activeTab === 'regular' && (
          <div className="flex flex-col p-sm md:p-md gap-sm bg-surface-container-lowest animate-fade-in">
            {historyPayments.map((payment) => (
              <div key={payment.id} className={`p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm border border-outline-variant/50 rounded-2xl hover:border-primary/30 transition-colors ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                <div className="flex flex-col sm:w-1/3">
                  <span className="text-xs text-on-surface-variant mb-1">{payment.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                    {payment.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:gap-lg text-sm text-on-surface-variant sm:w-1/3">
                  <div>Cash: ₹{((payment as any).cash_amount || payment.cash)?.toLocaleString('en-IN') || '0'}</div>
                  <div>UPI: ₹{((payment as any).upi_amount || payment.upi)?.toLocaleString('en-IN') || '0'}</div>
                </div>
                <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                  <span className="font-bold text-[16px] text-[#166534]">₹{payment.total_received.toLocaleString('en-IN')}</span>
                  {!payment.is_deleted && (
                    <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                      <button onClick={() => startEdit(payment)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}
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

        {showHistory && activeTab === 'advance' && (
          <div className="flex flex-col p-sm md:p-md gap-sm bg-surface-container-lowest animate-fade-in">
            {historyAdvances.map((adv) => (
              <div key={adv.id} className="p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm border border-outline-variant/50 rounded-2xl hover:border-error/30 transition-colors">
                <div className="flex flex-col sm:w-1/3">
                  <span className="text-xs text-on-surface-variant mb-1">{adv.date}</span>
                  <span className="font-medium text-error text-[16px]">{(adv as any).vendors?.name || 'Unknown'}</span>
                  {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                </div>
                <div className="flex sm:w-1/3 items-center justify-center">
                   <span className={`text-xs px-2 py-1 rounded-full ${adv.used_in_settlement ? 'bg-primary/10 text-primary' : 'bg-surface-variant/20 text-on-surface-variant'}`}>
                     {adv.used_in_settlement ? 'Settled' : 'Pending'}
                   </span>
                </div>
                <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                  <span className="font-bold text-[16px] text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                  <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                    <button onClick={() => handleDeleteRequest(adv.id, 'advance')} disabled={adv.used_in_settlement} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors disabled:opacity-30">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {historyLoading && <div className="text-center py-md text-on-surface-variant">Loading history...</div>}
            
            {hasMoreAdvanceHistory && historyAdvances.length > 0 && !historyLoading && (
              <button onClick={loadMoreHistory} className="mt-xs py-sm text-primary font-medium hover:underline text-center w-full">
                Load More History
              </button>
            )}
            
            {!historyLoading && historyAdvances.length === 0 && (
              <div className="text-center py-xl text-on-surface-variant">No past advances found.</div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="password-modal-overlay">
          <div className="password-modal-box">
            {passwordStep === 1 ? (
              <>
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">lock</span> Password Required
                </h3>
                <p className="text-on-surface-variant text-sm">Enter master password to {pendingEditPayment ? 'edit' : 'delete'} this item.</p>
                <input 
                  type="password" 
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  data-lpignore="true"
                  data-form-type="other"
                  name="action-password"
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl text-[16px] outline-none focus:border-error focus:ring-1 focus:ring-error"
                  placeholder="Enter password"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                />
                {passwordError && <p className="text-error text-xs">{passwordError}</p>}
                <div className="password-modal-buttons">
                  <button onClick={() => setShowPasswordModal(false)} className="bg-surface-variant text-on-surface-variant">Cancel</button>
                  <button onClick={handlePasswordSubmit} className="bg-error text-white">Confirm</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">warning</span> Are you sure?
                </h3>
                <p className="text-on-surface-variant text-sm">This action will void the record. Are you sure you want to delete?</p>
                <div className="password-modal-buttons">
                  <button onClick={() => setShowPasswordModal(false)} className="bg-surface-variant text-on-surface-variant">Cancel</button>
                  <button onClick={confirmDelete} className="bg-error text-white">Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
