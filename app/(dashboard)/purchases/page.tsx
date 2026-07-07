'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Purchase } from '@/lib/types';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const supabase = createClient();

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: today,
    party_name: '',
    invoice_number: '',
    total_amount: '',
    cash_amount: '',
    online_amount: '',
    note: '',
  });

  const fetchPurchases = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('purchases')
      .select('*')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setPurchases(data as Purchase[]);
    } else if (error) {
      toast.error('Error loading purchases: ' + error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const resetForm = () => {
    setFormData({
      date: today,
      party_name: '',
      invoice_number: '',
      total_amount: '',
      cash_amount: '',
      online_amount: '',
      note: '',
    });
    setEditingId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (p: Purchase) => {
    setFormData({
      date: p.date,
      party_name: p.party_name,
      invoice_number: p.invoice_number || '',
      total_amount: String(p.total_amount ?? ''),
      cash_amount: String(p.cash_amount ?? ''),
      online_amount: String(p.online_amount ?? ''),
      note: p.note || '',
    });
    setEditingId(p.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (p: Purchase) => {
    if (!confirm(`"${p.party_name}" ka ye purchase entry delete karna hai?`)) return;
    const { error } = await (supabase as any).from('purchases').update({ is_deleted: true }).eq('id', p.id);
    if (error) {
      toast.error('Delete failed: ' + error.message);
    } else {
      toast.success('Purchase entry delete ho gayi');
      fetchPurchases();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.party_name.trim()) {
      toast.error('Company/party name required hai');
      return;
    }
    if (!formData.total_amount || Number(formData.total_amount) <= 0) {
      toast.error('Total amount daalo');
      return;
    }

    const cash = Number(formData.cash_amount || 0);
    const online = Number(formData.online_amount || 0);
    const total = Number(formData.total_amount);

    if (cash + online !== total) {
      toast.error(`Cash (₹${cash}) + Online (₹${online}) = ₹${cash + online}, jo ki Total (₹${total}) se match nahi karta.`);
      return;
    }

    setSaving(true);

    const payload = {
      date: formData.date,
      party_name: formData.party_name.trim(),
      invoice_number: formData.invoice_number.trim() || null,
      total_amount: total,
      cash_amount: cash,
      online_amount: online,
      note: formData.note.trim() || null,
    };

    let error;
    if (editingId) {
      const res = await (supabase as any).from('purchases').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('purchases').insert([payload]);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to save purchase');
      return;
    }

    toast.success(editingId ? 'Purchase update ho gaya' : 'Purchase add ho gaya');
    setIsFormOpen(false);
    resetForm();
    fetchPurchases();
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchesSearch =
        p.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFrom = !dateFrom || p.date >= dateFrom;
      const matchesTo = !dateTo || p.date <= dateTo;
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [purchases, searchQuery, dateFrom, dateTo]);

  const totalThisList = useMemo(() => filteredPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0), [filteredPurchases]);
  const cashThisList = useMemo(() => filteredPurchases.reduce((sum, p) => sum + (Number(p.cash_amount) || 0), 0), [filteredPurchases]);
  const onlineThisList = useMemo(() => filteredPurchases.reduce((sum, p) => sum + (Number(p.online_amount) || 0), 0), [filteredPurchases]);

  const StatCard = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <div className="flex items-center gap-space-md bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-space-lg flex-1 min-w-[200px]">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary text-[24px]">{icon}</span>
      </div>
      <div>
        <div className="font-label-md text-on-surface-variant">{label}</div>
        <div className="font-headline-sm text-headline-sm font-bold text-on-surface table-lining-figures">{value}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:flex flex-col h-full overflow-y-auto">
        <div className="p-space-md md:p-container-padding flex flex-col gap-space-lg flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant/30 pb-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[28px]">local_shipping</span>
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Purchases</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Company se aaye saman ka payment record.</p>
              </div>
            </div>
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-space-xs px-space-xl py-space-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Add Purchase
            </button>
          </div>

          {/* Stat cards */}
          <div className="flex flex-col sm:flex-row gap-space-md">
            <StatCard icon="currency_rupee" label="Total Purchases (filtered)" value={`₹${totalThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            <StatCard icon="payments" label="Cash Paid" value={`₹${cashThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            <StatCard icon="smartphone" label="Online Paid" value={`₹${onlineThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          </div>

          {/* Filters */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-space-lg flex flex-col sm:flex-row gap-space-md sm:items-end">
            <div className="flex flex-col gap-1 flex-1">
              <label className="font-label-md text-on-surface-variant">Search</label>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
                <input
                  className="w-full h-[44px] pl-11 pr-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-md placeholder-outline"
                  placeholder="Company name or invoice number"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-on-surface-variant">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-[44px] px-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-md"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-on-surface-variant">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-[44px] px-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-md"
              />
            </div>
            {(dateFrom || dateTo || searchQuery) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setSearchQuery(''); }}
                className="h-[44px] px-space-md rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors font-label-md"
              >
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center text-on-surface-variant py-8">Loading...</div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center text-on-surface-variant py-8">Koi purchase record nahi mila.</div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Date</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Company</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Invoice No</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm text-right">Cash</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm text-right">Online</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm text-right">Total</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {filteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-space-md py-space-sm text-on-surface-variant">{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-space-md py-space-sm font-medium text-on-surface">
                        {p.party_name}
                        {p.note && <div className="text-xs text-on-surface-variant mt-0.5 font-normal">{p.note}</div>}
                      </td>
                      <td className="px-space-md py-space-sm text-on-surface-variant">{p.invoice_number || '—'}</td>
                      <td className="px-space-md py-space-sm text-right text-on-surface-variant table-lining-figures">{p.cash_amount ? `₹${Number(p.cash_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className="px-space-md py-space-sm text-right text-on-surface-variant table-lining-figures">{p.online_amount ? `₹${Number(p.online_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className="px-space-md py-space-sm text-right font-bold text-primary table-lining-figures">₹{Number(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-space-md py-space-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(p)} className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-full transition-colors inline-flex" title="Edit">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete(p)} className="p-2 text-outline hover:text-error hover:bg-error/10 rounded-full transition-colors inline-flex" title="Delete">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-outline-variant bg-surface-container-low font-bold">
                    <td className="px-space-md py-space-sm text-on-surface" colSpan={3}>Total:</td>
                    <td className="px-space-md py-space-sm text-right text-on-surface table-lining-figures">₹{cashThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-space-md py-space-sm text-right text-on-surface table-lining-figures">₹{onlineThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-space-md py-space-sm text-right text-primary table-lining-figures">₹{totalThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col">
        <header className="flex items-center justify-between p-4 w-full z-50 bg-surface top-0 sticky border-b border-outline-variant shadow-sm transition-colors duration-200">
          <button onClick={() => window.history.back()} className="text-primary active:bg-surface-container-high rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </button>
          <h1 className="font-title-main text-[20px] font-bold text-primary tracking-tight">Purchases</h1>
          <button onClick={handleAddNew} className="text-primary active:bg-surface-container-high rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>add</span>
          </button>
        </header>

        <main className="p-[16px] space-y-[12px]">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[20px]">currency_rupee</span>
              </div>
              <div>
                <div className="text-[12px] text-on-surface-variant">Total Purchases (filtered)</div>
                <div className="text-[18px] font-bold text-on-surface table-lining-figures">₹{totalThisList.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                <div>
                  <div className="text-[11px] text-on-surface-variant">Cash</div>
                  <div className="text-[14px] font-bold text-on-surface table-lining-figures">₹{cashThisList.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                <span className="material-symbols-outlined text-primary text-[18px]">smartphone</span>
                <div>
                  <div className="text-[11px] text-on-surface-variant">Online</div>
                  <div className="text-[14px] font-bold text-on-surface table-lining-figures">₹{onlineThisList.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              className="w-full h-[48px] pl-11 pr-4 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-standard placeholder-outline"
              placeholder="Company name or invoice number"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 min-h-[44px] px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-[16px]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 min-h-[44px] px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-[16px]"
            />
          </div>

          <div className="flex justify-between items-center font-label-md text-on-surface-variant px-1">
            <span>{filteredPurchases.length} entries</span>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center text-on-surface-variant py-4">Loading...</div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center text-on-surface-variant py-4">Koi purchase record nahi mila.</div>
            ) : (
              filteredPurchases.map((p) => (
                <div key={p.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-title-main text-[18px] text-on-surface">{p.party_name}</h2>
                      <span className="text-on-surface-variant text-[13px]">{new Date(p.date).toLocaleDateString('en-IN')}{p.invoice_number ? ` • Inv# ${p.invoice_number}` : ''}</span>
                    </div>
                    <div className="flex gap-1 -mr-2 -mt-2">
                      <button onClick={() => handleEdit(p)} className="p-2 text-outline active:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-2 text-outline active:text-error transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-outline-variant pt-3">
                    <div className="text-on-surface-variant text-[14px]">
                      Cash: ₹{Number(p.cash_amount).toLocaleString('en-IN')} • Online: ₹{Number(p.online_amount).toLocaleString('en-IN')}
                    </div>
                    <div className="font-bold text-primary text-[16px]">₹{Number(p.total_amount).toLocaleString('en-IN')}</div>
                  </div>
                  {p.note && <div className="text-xs text-on-surface-variant border-t border-outline-variant pt-2">{p.note}</div>}
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Add / Edit Purchase Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant relative animate-fade-in w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 p-2 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-[24px] text-on-surface mb-4">{editingId ? 'Edit Purchase' : 'Add New Purchase'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Date *</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Invoice Number</label>
                <input type="text" value={formData.invoice_number} onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Company / Party Name *</label>
                <input required type="text" value={formData.party_name} onChange={e => setFormData({ ...formData, party_name: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="e.g. Vadilal, Amul" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Total Amount (₹) *</label>
                <input required type="number" min="0" value={formData.total_amount} onChange={e => setFormData({ ...formData, total_amount: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="e.g. 50000" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Cash (₹)</label>
                <input type="number" min="0" value={formData.cash_amount} onChange={e => setFormData({ ...formData, cash_amount: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="e.g. 30000" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Online (₹)</label>
                <input type="number" min="0" value={formData.online_amount} onChange={e => setFormData({ ...formData, online_amount: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="e.g. 20000" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Note</label>
                <input type="text" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
              </div>
              <div className="sm:col-span-2 mt-2 flex gap-4 justify-end border-t border-outline-variant/30 pt-4">
                <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : (editingId ? 'Update Purchase' : 'Save Purchase')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
