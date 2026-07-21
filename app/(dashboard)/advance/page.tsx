'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Advance } from '@/lib/types';

export default function AdvancePage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPassword, setMasterPassword] = useState('1234');

  const [advances, setAdvances] = useState<Advance[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: ''
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    // Bug fix: vendors.active isn't a real column (it's is_active) — querying
    // it always failed and silently fell back to a second request, doubling
    // the wait before the vendor dropdown populated on every page load.
    const [vendorsRes, advRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('is_active', true),
      (supabase as any).from('vendor_advances').select('*, vendors(name)').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value')
    ]);

    if ((vendorsRes as any).data) {
      setVendors((vendorsRes as any).data as Vendor[]);
    }

    if (!advRes.error && advRes.data) setAdvances(advRes.data as Advance[]);

    let pwd = '1234';
    if ((settingsRes as any).data) {
      const allSettings = (settingsRes as any).data;
      const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = pwdSetting.value;
    }
    setMasterPassword(pwd);
    setLoading(false);
  };

  const refetchAdvances = async () => {
    const { data } = await (supabase as any).from('vendor_advances').select('*, vendors(name)').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (data) setAdvances(data as Advance[]);
  };

  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id) return toast.error("Please select a vendor.");
    const amt = Number(formData.amount);
    if (!amt || amt <= 0) return toast.error("Please enter a valid amount.");

    setSaving(true);
    const payload = {
      vendor_id: formData.vendor_id,
      date: formData.date,
      amount: Math.round(amt),
      note: formData.note,
      used_in_settlement: false
    };

    const res = await (supabase as any).from('vendor_advances').insert([payload]);
    setSaving(false);

    if (res.error) {
      return toast.error("Error saving advance: " + res.error.message);
    }

    toast.success("Advance saved successfully!");
    setFormData({ vendor_id: formData.vendor_id, date: new Date().toISOString().split('T')[0], amount: '', note: '' });
    refetchAdvances();
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
    setPasswordInput('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (passwordInput !== masterPassword) {
      setPasswordError("Incorrect password");
      setPasswordInput('');
      return;
    }
    setShowPasswordModal(false);
    if (pendingDeleteId) {
      const { error } = await (supabase as any).from('vendor_advances').delete().eq('id', pendingDeleteId);
      if (error) {
        toast.error("Failed to delete advance");
      } else {
        toast.success("Advance deleted successfully");
        refetchAdvances();
      }
      setPendingDeleteId(null);
    }
  };

  const filteredAdvances = vendorFilter === 'all' ? advances : advances.filter(a => a.vendor_id === vendorFilter);
  const totalPending = advances.filter(a => !a.used_in_settlement).reduce((s, a) => s + a.amount, 0);

  const AdvanceForm = (
    <form onSubmit={handleSaveAdvance} className="flex flex-col gap-space-md">
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Vendor / Shopkeeper *</label>
        <select
          value={formData.vendor_id}
          onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
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
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Advance Amount (₹) *</label>
        <input
          type="number" min="1" step="1" value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Note (Optional)</label>
        <input
          type="text" value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          placeholder="e.g. For next week's stock"
        />
      </div>
      <button type="submit" disabled={saving} className="flex items-center justify-center gap-space-xs px-space-xl py-space-sm bg-error text-white font-label-md rounded-xl hover:bg-error/90 transition-colors disabled:opacity-50 mt-space-xs">
        <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Advance'}
      </button>
    </form>
  );

  const HistoryList = (
    <div className="flex flex-col gap-space-sm">
      {loading ? (
        <div className="text-center text-on-surface-variant py-space-xl">Loading...</div>
      ) : filteredAdvances.length === 0 ? (
        <div className="text-center text-on-surface-variant py-space-xl">No advances recorded yet.</div>
      ) : (
        filteredAdvances.map(adv => (
          <div key={adv.id} className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border border-outline-variant rounded-2xl hover:border-error/30 transition-colors">
            <div className="flex flex-col sm:w-1/3">
              <span className="font-medium text-on-surface text-[15px]">{(adv as any).vendors?.name || 'Unknown'}</span>
              <span className="text-xs text-on-surface-variant">{new Date(adv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{adv.note ? ` • ${adv.note}` : ''}</span>
            </div>
            <div className="flex sm:w-1/4 items-center">
              <span className={`text-xs px-2 py-1 rounded-full ${adv.used_in_settlement ? 'bg-primary/10 text-primary' : 'bg-surface-variant/30 text-on-surface-variant'}`}>
                {adv.used_in_settlement ? 'Settled' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-space-md">
              <span className="font-bold text-[16px] text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
              <button onClick={() => handleDeleteRequest(adv.id)} disabled={adv.used_in_settlement} className="p-space-sm text-error hover:bg-error/10 rounded-full transition-colors disabled:opacity-30">
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
        <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-md h-full overflow-y-auto max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between gap-space-md pb-space-xs">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Advance</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Advances given to vendors — not a daily thing.</p>
            </div>
            <Link href="/payments" className="flex items-center gap-1 px-space-md py-space-xs border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-variant/20 transition-colors font-label-md">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Payments
            </Link>
          </div>

          {totalPending > 0 && (
            <div className="bg-error/10 border border-error/20 rounded-2xl p-space-md flex items-center justify-between animate-fade-in">
              <div>
                <h3 className="font-label-md text-error uppercase tracking-wider">Total Pending Advances</h3>
                <p className="font-headline-md text-on-surface font-bold mt-1">₹{totalPending.toLocaleString('en-IN')}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-error/20 flex items-center justify-center text-error shrink-0">
                <span className="material-symbols-outlined text-[20px]">money_off</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md items-start">
            {/* History on the left/main area */}
            <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-sm p-space-md sm:p-space-lg flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
                <h3 className="font-headline-sm text-on-surface">Advance History</h3>
                <div className="w-full sm:w-64">
                  <select
                    value={vendorFilter}
                    onChange={(e) => setVendorFilter(e.target.value)}
                    className="w-full px-space-md py-space-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[15px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="all">All Vendors & Shopkeepers</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                    ))}
                  </select>
                </div>
              </div>
              {HistoryList}
            </div>

            {/* Entry form pinned to the right */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-md sm:p-space-lg flex flex-col gap-space-md lg:sticky lg:top-space-md">
              <h3 className="font-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[20px]">money_off</span> Add Advance
              </h3>
              {AdvanceForm}
            </div>
          </div>

          {/* Password Modal */}
          {showPasswordModal && (
            <div className="password-modal-overlay">
              <div className="password-modal-box">
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">lock</span> Password Required
                </h3>
                <p className="text-on-surface-variant text-sm">Enter master password to delete this advance.</p>
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
                  <button onClick={handlePasswordSubmit} className="bg-error text-white">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col">
        <header className="flex items-center justify-between p-4 w-full z-10 bg-surface border-b border-outline-variant shadow-sm sticky top-0">
          <Link href="/payments" className="flex items-center justify-center min-w-[44px] min-h-[44px] text-on-surface-variant active:bg-surface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </Link>
          <h1 className="font-title-main text-[18px] font-bold text-error">Advance</h1>
          <div className="w-[44px]"></div>
        </header>

        <main className="flex-1 px-[16px] py-4 space-y-[16px] overflow-y-auto">
          {totalPending > 0 && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-error uppercase tracking-wider font-medium">Total Pending</p>
                <p className="text-[18px] font-bold text-on-surface">₹{totalPending.toLocaleString('en-IN')}</p>
              </div>
              <span className="material-symbols-outlined text-error text-[22px]">money_off</span>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <h3 className="font-title-main text-[15px] font-bold text-on-surface">Add Advance</h3>
            {AdvanceForm}
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-title-main text-[15px] font-bold text-on-surface">History</h3>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-outline-variant rounded-lg text-[13px] focus:border-primary outline-none"
            >
              <option value="all">All</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          {HistoryList}
        </main>

        {showPasswordModal && (
          <div className="password-modal-overlay">
            <div className="password-modal-box">
              <h3 className="font-headline-sm text-error flex items-center gap-2">
                <span className="material-symbols-outlined">lock</span> Password Required
              </h3>
              <p className="text-on-surface-variant text-sm">Enter master password to delete this advance.</p>
              <input
                type="password"
                autoComplete="off"
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
                <button onClick={handlePasswordSubmit} className="bg-error text-white">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
