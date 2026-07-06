'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Purchase } from '@/lib/types';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredPurchases = purchases.filter(p =>
    p.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalThisList = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:flex flex-col h-full overflow-y-auto">
        <div className="p-md md:p-container-padding flex flex-col gap-lg flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Purchases</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Company se aaye saman ka payment record.</p>
            </div>
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Add Purchase
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-md items-start sm:items-center justify-between">
            <div className="relative max-w-sm w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
              <input
                className="w-full h-[44px] pl-10 pr-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-md placeholder-outline"
                placeholder="Search by company / invoice no..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="font-label-md text-on-surface-variant">
              Total: <span className="font-bold text-primary">₹{totalThisList.toLocaleString('en-IN')}</span>
            </div>
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
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Date</th>
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Company / Party</th>
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Invoice #</th>
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Total</th>
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Cash</th>
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Online</th>
                    <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {filteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm text-on-surface-variant">{new Date(p.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-md py-sm font-medium text-on-surface">
                        {p.party_name}
                        {p.note && <div className="text-xs text-on-surface-variant mt-0.5">{p.note}</div>}
                      </td>
                      <td className="px-md py-sm text-on-surface-variant">{p.invoice_number || '—'}</td>
                      <td className="px-md py-sm text-right font-bold text-primary">₹{Number(p.total_amount).toLocaleString('en-IN')}</td>
                      <td className="px-md py-sm text-right text-on-surface-variant">₹{Number(p.cash_amount).toLocaleString('en-IN')}</td>
                      <td className="px-md py-sm text-right text-on-surface-variant">₹{Number(p.online_amount).toLocaleString('en-IN')}</td>
                      <td className="px-md py-sm text-right">
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
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col">
        <header className="flex items-center justify-between p-4 w-full z-50 bg-surface top-0 sticky border-b border-outline-variant shadow-sm transition-colors duration-200">
          <button onClick={() => window.history.back()} className="text-primary active:bg-surface-container-high rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </button>
          <h1 className="font-title-main text-[20px] font-bold text-primary tracking-tight">Purchases</h1>
          <button onClick={handleAddNew} className="text-primary active:bg-surface-container-high rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>add</span>
          </button>
        </header>

        <main className="p-[16px] space-y-[12px]">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              className="w-full h-[48px] pl-10 pr-4 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-standard placeholder-outline"
              placeholder="Search by company / invoice no..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center font-label-md text-on-surface-variant px-1">
            <span>{filteredPurchases.length} entries</span>
            <span>Total: <span className="font-bold text-primary">₹{totalThisList.toLocaleString('en-IN')}</span></span>
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
                      <button onClick={() => handleEdit(p)} className="p-2 text-outline active:text-primary transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-2 text-outline active:text-error transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
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
