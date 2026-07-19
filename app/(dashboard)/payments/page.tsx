'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Payment } from '@/lib/types';

export default function PaymentsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPassword, setMasterPassword] = useState('1234');
  const [paymentsTab, setPaymentsTab] = useState<'record' | 'previous'>('record');
  const [previousPaymentsVendorFilter, setPreviousPaymentsVendorFilter] = useState<string>('all');

  // Payments State
  const [todayPayments, setTodayPayments] = useState<(Payment & { is_deleted?: boolean })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allPayments, setAllPayments] = useState<(Payment & { is_deleted?: boolean })[]>([]);
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
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [passwordError, setPasswordError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<{id: string, type: 'payment'} | null>(null);
  const [pendingEditPayment, setPendingEditPayment] = useState<(Payment & {is_deleted?: boolean}) | null>(null);

  useEffect(() => {
    fetchInitialData();
    fetchPayments();
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

    if ((todayRes as any).data) setTodayPayments((todayRes as any).data);

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
      cash_amount: Math.round(cashAmount),
      upi_amount: Math.round(upiAmount),
      total_received: Math.round(totalReceived),
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

  const handleDeleteRequest = (id: string, type: 'payment') => {
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
      const res = await (supabase as any).from('payments').update({ is_deleted: true }).eq('id', pendingDeleteId.id);
      const error = res.error;

      if (error) {
        toast.error('Failed to delete payment');
      } else {
        toast.success('Payment deleted successfully');

        const todayStr = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('payments').select('*, vendors(name)').eq('date', todayStr).order('created_at', { ascending: false });
        if (data) setTodayPayments(data);
        fetchPayments();
      }
      setPendingDeleteId(null);
    }
  };

  const cashNum = Number(formData.cash) || 0;
  const upiNum = Number(formData.upi) || 0;
  const currentTotalReceived = cashNum + upiNum;
  const currentOutstanding = totalBilled - currentTotalReceived;

  const todaysTotalReceived = todayPayments.reduce((acc, curr) => curr.is_deleted ? acc : acc + curr.total_received, 0);

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
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
        <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-md h-full overflow-y-auto max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-xs">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Payments</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Record today's collections.</p>
        </div>
        <div className="flex items-center gap-space-sm">
          <Link
            href="/advance"
            className="flex items-center gap-1 px-space-sm py-1.5 rounded-lg text-xs font-medium border border-error/30 text-error hover:bg-error/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">money_off</span>
            Advance
          </Link>
          <div className="flex bg-surface-container-high rounded-xl p-1">
            <button
              onClick={() => setPaymentsTab('record')}
              className={`px-space-lg py-space-xs font-label-md rounded-lg transition-all ${paymentsTab === 'record' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}`}
            >
              Add Payment
            </button>
            <button
              onClick={() => setPaymentsTab('previous')}
              className={`px-space-lg py-space-xs font-label-md rounded-lg transition-all ${paymentsTab === 'previous' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {paymentsTab === 'record' && (
        <>
          {/* Today's Summary Strip */}
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-space-md flex items-center justify-between animate-fade-in">
            <div>
              <h3 className="font-label-md text-primary uppercase tracking-wider">Collected Today</h3>
              <p className="font-headline-md text-on-surface font-bold mt-1">₹{todaysTotalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>

          {/* Add Payment Card */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-md sm:p-space-lg flex flex-col gap-space-md animate-fade-in">
            <h3 className="font-headline-sm text-on-surface">Add Payment</h3>

            <form onSubmit={handleSavePayment} className="flex flex-col gap-space-md animate-fade-in">
                {editingPaymentId && (
                  <div className="bg-primary/10 text-primary p-space-sm rounded-xl font-medium flex items-center justify-between">
                    <span>Editing Payment</span>
                    <button type="button" onClick={handleClear} className="text-primary hover:underline text-sm">Cancel Edit</button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Vendor / Shopkeeper *</label>
                    <select
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                      className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Date *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Cash Received (₹)</label>
                    <input
                      type="number" min="0" step="0.01" value={formData.cash}
                      onChange={(e) => setFormData({...formData, cash: e.target.value})}
                      className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">UPI Received (₹)</label>
                    <input
                      type="number" min="0" step="0.01" value={formData.upi}
                      onChange={(e) => setFormData({...formData, upi: e.target.value})}
                      className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Compact billing status - only shows once a vendor+date is picked */}
                {formData.vendor_id && (
                  <div className="flex items-center justify-between bg-surface-container-low px-space-md py-space-sm rounded-xl border border-outline-variant text-sm animate-fade-in">
                    <span className="text-on-surface-variant">Billed: <b className="text-on-surface">₹{totalBilled.toLocaleString('en-IN')}</b></span>
                    <span className="text-on-surface-variant">Receiving: <b className="text-primary">₹{currentTotalReceived.toLocaleString('en-IN')}</b></span>
                    <span className="text-on-surface-variant">Outstanding: <b className={currentOutstanding > 0 ? 'text-error' : 'text-[#166534]'}>₹{currentOutstanding.toLocaleString('en-IN')}</b></span>
                  </div>
                )}

                <div className="flex justify-end mt-space-xs gap-space-md flex-wrap">
                  <button type="button" onClick={handleClear} disabled={saving} className="px-space-xl py-space-sm border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-variant/20 transition-colors">
                    Clear
                  </button>
                  <button type="submit" disabled={saving} className="flex items-center justify-center gap-space-xs px-space-xl py-space-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Payment'}
                  </button>
                </div>
              </form>
          </div>
        </>
      )}

      {/* Lists - Only show in Record Payment tab */}
      {paymentsTab === 'record' && (
        <>
          {/* Today's Payments List */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col animate-fade-in">
            <div className="px-space-md py-space-sm border-b border-outline-variant bg-surface flex justify-between items-center">
              <h3 className="font-headline-sm text-on-surface">Today's Payments</h3>
            </div>
            <div className="flex flex-col divide-y divide-outline-variant/30 p-space-sm md:p-0">
              {loading ? (
                <div className="p-space-md text-center text-on-surface-variant">Loading...</div>
              ) : todayPayments.length === 0 ? (
                <div className="p-space-md text-center text-on-surface-variant">No payments recorded today.</div>
              ) : (
                todayPayments.map((payment) => (
                  <div key={payment.id} className={`p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm hover:bg-surface-container-low transition-colors rounded-xl md:rounded-none ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                    <div className="flex flex-col sm:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                        {payment.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:gap-space-lg text-sm text-on-surface-variant sm:w-1/3">
                      <div>Cash: ₹{((payment as any).cash_amount || payment.cash)?.toLocaleString('en-IN') || '0'}</div>
                      <div>UPI: ₹{((payment as any).upi_amount || payment.upi)?.toLocaleString('en-IN') || '0'}</div>
                    </div>
                    <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-space-md">
                      <span className="font-bold text-[16px] text-[#166534]">₹{payment.total_received.toLocaleString('en-IN')}</span>
                      {!payment.is_deleted && (
                        <div className="flex gap-space-xs bg-surface-container-low rounded-full p-1">
                          <button onClick={() => startEdit(payment)} className="p-space-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-space-sm text-error hover:bg-error/10 rounded-full transition-colors">
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

      {/* Previous Payments Tab - Show all payments with vendor filter */}
      {paymentsTab === 'previous' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-md flex flex-col gap-space-md animate-fade-in min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <h3 className="font-headline-sm text-on-surface">Previous Payments History</h3>
            <div className="w-full sm:w-64">
              <select
                value={previousPaymentsVendorFilter}
                onChange={(e) => setPreviousPaymentsVendorFilter(e.target.value)}
                className="w-full px-space-md py-space-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              >
                <option value="all">All Vendors & Shopkeepers</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-space-sm">
            {historyLoading && allPayments.length === 0 ? (
              <div className="text-center text-on-surface-variant py-space-xl">Loading...</div>
            ) : allPayments.length === 0 ? (
              <div className="text-center text-on-surface-variant py-space-xl">No previous payments found.</div>
            ) : Object.keys(groupedHistoryPayments).length === 0 ? (
              <div className="text-center text-on-surface-variant py-space-xl">No payments found for this vendor.</div>
            ) : (
              Object.entries(groupedHistoryPayments).map(([date, datePayments]) => (
                <div key={date} className="mb-space-md">
                  <h3 className="font-label-lg text-on-surface-variant mb-space-sm sticky top-0 bg-surface-container-lowest py-2 border-b border-outline-variant/30 z-10">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  <div className="flex flex-col gap-space-sm">
                    {datePayments.map(payment => (
                      <div key={payment.id} className={`p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border border-outline-variant rounded-2xl hover:border-primary/30 transition-colors ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                        <div className="flex flex-col sm:w-1/4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                            {payment.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:gap-space-lg text-sm text-on-surface-variant sm:w-1/3">
                          <div>Cash: ₹{((payment as any).cash_amount || payment.cash)?.toLocaleString('en-IN') || '0'}</div>
                          <div>UPI: ₹{((payment as any).upi_amount || payment.upi)?.toLocaleString('en-IN') || '0'}</div>
                        </div>
                        <div className="flex items-center justify-between sm:w-1/4 sm:justify-end gap-space-md">
                          <span className="font-bold text-[16px] text-[#166534]">Total: ₹{payment.total_received.toLocaleString('en-IN')}</span>
                          {!payment.is_deleted && (
                            <div className="flex gap-space-xs bg-surface-container-low rounded-full p-1">
                              <button onClick={() => startEdit(payment)} className="p-space-sm text-primary hover:bg-primary/10 rounded-full transition-colors" title="Edit">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-space-sm text-error hover:bg-error/10 rounded-full transition-colors" title="Delete">
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

        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col">
        <header className="flex items-center justify-between p-4 w-full z-10 bg-surface border-b border-outline-variant shadow-sm sticky top-0">
          <button onClick={() => window.history.back()} className="flex items-center justify-center min-w-[44px] min-h-[44px] text-on-surface-variant active:bg-surface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </button>
          <h1 className="font-title-main text-[20px] font-bold text-primary">Record Payment</h1>
          <Link href="/advance" className="flex items-center justify-center min-w-[44px] min-h-[44px] text-error active:bg-error/10 rounded-full transition-colors" title="Advance">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>money_off</span>
          </Link>
        </header>

        {/* Tab Switcher */}
        <div className="flex bg-surface-container-high p-1 mx-[16px] mt-[12px] rounded-xl shadow-inner">
          <button
            onClick={() => setPaymentsTab('record')}
            className={`flex-1 py-2 font-label-md text-[14px] rounded-lg transition-all ${paymentsTab === 'record' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}`}
          >
            Add Payment
          </button>
          <button
            onClick={() => setPaymentsTab('previous')}
            className={`flex-1 py-2 font-label-md text-[14px] rounded-lg transition-all ${paymentsTab === 'previous' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}`}
          >
            History
          </button>
        </div>

        <main className="flex-1 px-[16px] py-4 pb-[140px] space-y-[12px] overflow-y-auto">
          {paymentsTab === 'record' && (
          <>
          <h2 className="font-title-main text-[15px] font-bold text-on-surface">Add Payment</h2>

          <>
              {/* Vendor Dropdown */}
              <div className="relative w-full">
                <div className="relative flex items-center w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded px-3 focus-within:border-primary focus-within:border-2">
                  <select 
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                    className="w-full bg-transparent outline-none appearance-none font-body-standard text-[16px] text-on-surface truncate pr-8 cursor-pointer"
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-outline pointer-events-none">expand_more</span>
                </div>
              </div>

              {/* Date — lets you record/update a payment against a previous day, not just today */}
              <div className="relative w-full flex flex-col">
                <label className="text-[12px] text-on-surface-variant mb-1 font-medium">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded px-3 focus:border-primary focus:border-2 focus:outline-none font-body-standard text-[16px] text-on-surface transition-colors"
                />
              </div>

              {/* Highlighted Billed Card */}
              {formData.vendor_id && (
                <div className="bg-surface-container-highest rounded-xl p-4 flex justify-between items-center shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-outline-variant">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                    </div>
                    <div>
                      <p className="font-label-caption text-[14px] text-on-surface-variant">Today's Billed</p>
                      <p className="font-body-standard text-[16px] font-medium">{vendors.find(v => v.id === formData.vendor_id)?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-rupee-currency text-[18px] text-primary">₹{totalBilled.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              )}

              {/* Payment Inputs */}
              <div className="space-y-3">
                <div className="relative w-full flex flex-col">
                  <label className="text-[12px] text-on-surface-variant mb-1 font-medium">Cash Received (₹)</label>
                  <div className="relative">
                    <div className="absolute top-0 bottom-0 left-3 flex items-center pointer-events-none">
                      <span className="font-rupee-currency text-[18px] text-on-surface-variant">₹</span>
                    </div>
                    <input 
                      type="number" 
                      value={formData.cash}
                      onChange={(e) => setFormData({...formData, cash: e.target.value})}
                      className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded pl-9 pr-3 focus:border-primary focus:border-2 focus:outline-none font-rupee-currency text-[18px] text-on-surface transition-colors"
                      placeholder="0" 
                    />
                  </div>
                </div>
                <div className="relative w-full flex flex-col">
                  <label className="text-[12px] text-on-surface-variant mb-1 font-medium">UPI Received (₹)</label>
                  <div className="relative">
                    <div className="absolute top-0 bottom-0 left-3 flex items-center pointer-events-none">
                      <span className="font-rupee-currency text-[18px] text-on-surface-variant">₹</span>
                    </div>
                    <input 
                      type="number" 
                      value={formData.upi}
                      onChange={(e) => setFormData({...formData, upi: e.target.value})}
                      className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded pl-9 pr-3 focus:border-primary focus:border-2 focus:outline-none font-rupee-currency text-[18px] text-on-surface transition-colors"
                      placeholder="0" 
                    />
                  </div>
                </div>
              </div>

              {/* Auto Calculated Summary */}
              <div className="bg-surface-bright border border-outline-variant rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-body-standard text-[16px] text-on-surface-variant">Total Received</span>
                  <span className="font-rupee-currency text-[18px] text-on-surface">₹{currentTotalReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="h-[1px] bg-outline-variant w-full my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="font-body-standard text-[16px] font-medium">Outstanding</span>
                  <span className={`font-rupee-currency text-[18px] px-2 py-1 rounded ${currentOutstanding > 0 ? 'text-error bg-error-container' : 'text-[#166534] bg-[#166534]/10'}`}>
                    ₹{currentOutstanding.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Recent Payments List */}
              <div className="pt-4 space-y-[12px]">
                <h2 className="font-title-main text-[16px] font-bold text-on-surface border-b border-outline-variant pb-2">Today's Payments</h2>
                <div className="flex flex-col gap-2">
                  {todayPayments.length === 0 ? (
                    <div className="text-center text-on-surface-variant py-4 text-sm">No payments recorded today.</div>
                  ) : (
                    todayPayments.map((payment) => (
                      <div key={payment.id} className={`bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex justify-between items-center ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[20px]">payments</span>
                          </div>
                          <div>
                            <p className="font-body-standard text-[14px] font-medium text-on-surface flex items-center gap-2">
                              {(payment as any).vendors?.name || 'Unknown'}
                              {payment.is_deleted && <span className="bg-error text-white text-[10px] px-1 rounded uppercase no-underline">Void</span>}
                            </p>
                            <p className="font-label-caption text-[12px] text-on-surface-variant">
                              {payment.cash > 0 && `Cash: ₹${payment.cash}`}
                              {payment.cash > 0 && payment.upi > 0 && ' • '}
                              {payment.upi > 0 && `UPI: ₹${payment.upi}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-rupee-currency text-[16px] font-bold text-secondary">₹{payment.total_received.toLocaleString('en-IN')}</span>
                          {!payment.is_deleted && (
                            <div className="flex gap-1 bg-surface-container rounded-full p-0.5">
                              <button onClick={() => startEdit(payment)} className="p-1.5 text-primary active:bg-primary/10 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-1.5 text-error active:bg-error/10 rounded-full transition-colors">
                                <span className="material-symbols-outlined text-[16px]">delete</span>
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
          </>
          )}

          {paymentsTab === 'previous' && (
            <div className="space-y-[12px]">
              <div className="w-full">
                <select
                  value={previousPaymentsVendorFilter}
                  onChange={(e) => setPreviousPaymentsVendorFilter(e.target.value)}
                  className="w-full h-[44px] bg-surface-container-lowest border border-outline-variant rounded px-3 font-body-standard text-[14px] text-on-surface outline-none focus:border-primary focus:border-2"
                >
                  <option value="all">All Vendors & Shopkeepers</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                  ))}
                </select>
              </div>

              {historyLoading && allPayments.length === 0 ? (
                <div className="text-center text-on-surface-variant py-8 text-sm">Loading...</div>
              ) : allPayments.length === 0 ? (
                <div className="text-center text-on-surface-variant py-8 text-sm">No previous payments found.</div>
              ) : Object.keys(groupedHistoryPayments).length === 0 ? (
                <div className="text-center text-on-surface-variant py-8 text-sm">No payments found for this vendor.</div>
              ) : (
                Object.entries(groupedHistoryPayments).map(([date, datePayments]) => (
                  <div key={date} className="space-y-2">
                    <h3 className="font-label-md text-[12px] text-on-surface-variant uppercase tracking-wide sticky top-0 bg-surface py-1">
                      {new Date(date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {datePayments.map(payment => (
                        <div key={payment.id} className={`bg-surface-container-lowest border border-outline-variant rounded-lg p-3 flex justify-between items-center ${payment.is_deleted ? 'opacity-50 line-through' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-[20px]">payments</span>
                            </div>
                            <div>
                              <p className="font-body-standard text-[14px] font-medium text-on-surface flex items-center gap-2">
                                {(payment as any).vendors?.name || 'Unknown'}
                                {payment.is_deleted && <span className="bg-error text-white text-[10px] px-1 rounded uppercase no-underline">Void</span>}
                              </p>
                              <p className="font-label-caption text-[12px] text-on-surface-variant">
                                {((payment as any).cash_amount || payment.cash) > 0 && `Cash: ₹${(payment as any).cash_amount || payment.cash}`}
                                {((payment as any).cash_amount || payment.cash) > 0 && ((payment as any).upi_amount || payment.upi) > 0 && ' • '}
                                {((payment as any).upi_amount || payment.upi) > 0 && `UPI: ₹${(payment as any).upi_amount || payment.upi}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-rupee-currency text-[16px] font-bold text-secondary">₹{payment.total_received.toLocaleString('en-IN')}</span>
                            {!payment.is_deleted && (
                              <div className="flex gap-1 bg-surface-container rounded-full p-0.5">
                                <button onClick={() => startEdit(payment)} className="p-1.5 text-primary active:bg-primary/10 rounded-full transition-colors">
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-1.5 text-error active:bg-error/10 rounded-full transition-colors">
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
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
          )}
        </main>

        {/* Sticky Save Button */}
        {paymentsTab === 'record' && (
          <div className="fixed bottom-[64px] w-full bg-surface p-[16px] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] border-t border-outline-variant z-50">
            <button
              onClick={handleSavePayment}
              disabled={saving}
              className="w-full h-[48px] bg-primary text-on-primary font-title-main text-[16px] font-bold rounded flex justify-center items-center gap-2 active:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
              {saving ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        )}
      </div>

      {/* Password Modal — shared by desktop + mobile */}
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
                  className="w-full px-space-md py-space-sm bg-surface border border-outline-variant rounded-xl text-[16px] outline-none focus:border-error focus:ring-1 focus:ring-error"
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
    </>
  );
}
