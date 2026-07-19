'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import DashboardNav from '@/components/DashboardNav';

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5];

const BANK_NOTE_PRESET = 'Subh Safal Traders Bank Account';

export default function MoneyCalculatorClient({ standalone, editId }: { standalone: boolean; editId?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [noteType, setNoteType] = useState<'preset' | 'custom'>('preset');
  const [customNote, setCustomNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  const historyHref = standalone ? '/history' : '/money/history';

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('money_calculator_history')
        .select('*')
        .eq('id', editId)
        .single();

      if (error || !data) {
        toast.error('Could not load that entry to edit.');
        setLoadingEdit(false);
        return;
      }

      const newCounts: Record<number, string> = {};
      (data.entries || []).forEach((e: any) => {
        newCounts[e.denomination] = String(e.count);
      });
      setCounts(newCounts);

      if (data.note === BANK_NOTE_PRESET) {
        setNoteType('preset');
      } else {
        setNoteType('custom');
        setCustomNote(data.note || '');
      }

      setEditingId(data.id);
      setLoadingEdit(false);
    })();
  }, [editId]);

  const rows = useMemo(() => {
    return DENOMINATIONS.map(denom => {
      const count = Number(counts[denom]) || 0;
      const amount = denom * count;
      return { denom, count, amount };
    });
  }, [counts]);

  const grandTotal = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);
  const totalPieces = useMemo(() => rows.reduce((sum, r) => sum + r.count, 0), [rows]);

  const handleCountChange = (denom: number, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setCounts({ ...counts, [denom]: value });
    }
  };

  const handleClear = () => {
    setCounts({});
    setNoteType('preset');
    setCustomNote('');
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    handleClear();
    router.push(historyHref);
  };

  const handleSave = async () => {
    const nonZeroRows = rows.filter(r => r.count > 0);
    if (nonZeroRows.length === 0) {
      toast.error('Please enter at least one denomination count.');
      return;
    }

    const finalNote = noteType === 'preset' ? BANK_NOTE_PRESET : customNote.trim();
    if (noteType === 'custom' && !finalNote) {
      toast.error('Please enter a custom note.');
      return;
    }

    setSaving(true);
    const payload = {
      entries: nonZeroRows.map(r => ({ denomination: r.denom, count: r.count, amount: r.amount })),
      total_amount: grandTotal,
      note: finalNote,
      is_deleted: false,
    };

    if (editingId) {
      const { error } = await (supabase as any).from('money_calculator_history').update(payload).eq('id', editingId);
      setSaving(false);
      if (error) {
        toast.error('Failed to update: ' + error.message);
        return;
      }
      toast.success('Updated successfully!');
      handleClear();
      router.push(historyHref);
      return;
    }

    const { error } = await (supabase as any).from('money_calculator_history').insert([payload]);
    setSaving(false);

    if (error) {
      toast.error('Failed to save: ' + error.message);
      return;
    }

    toast.success('Saved successfully!');
    handleClear();
  };

  const content = (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg flex flex-col gap-5">
        {!standalone && (
          <button
            onClick={() => router.back()}
            className="self-start flex items-center gap-1 text-blue-600 font-semibold hover:underline"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span> Back
          </button>
        )}

        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Subh Safal Traders</h1>
          <p className="text-slate-500 text-sm mt-1">Cash Calculator</p>
        </div>

        {editingId && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl font-medium flex items-center justify-between text-sm">
            <span>Editing a saved entry</span>
            <button onClick={handleCancelEdit} className="text-blue-700 hover:underline text-sm font-semibold">Cancel</button>
          </div>
        )}

        {/* Denomination Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1.3fr] bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
            <div className="px-4 py-3">Note</div>
            <div className="px-4 py-3">Pieces</div>
            <div className="px-4 py-3 text-right">Amount</div>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map(row => (
              <div key={row.denom} className="grid grid-cols-[1fr_1fr_1.3fr] items-center">
                <div className="px-4 py-3 font-semibold text-slate-700">₹{row.denom}</div>
                <div className="px-4 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={counts[row.denom] ?? ''}
                    onChange={(e) => handleCountChange(row.denom, e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[16px] text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="px-4 py-3 text-right text-sm text-slate-600">
                  {row.count > 0 ? (
                    <span>{row.denom} × {row.count} = <b className="text-slate-900">₹{row.amount.toLocaleString('en-IN')}</b></span>
                  ) : (
                    <span className="text-slate-300">₹0</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grand Total */}
        <div className="bg-blue-600 rounded-2xl shadow-sm px-5 py-4 flex items-center justify-between text-white">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Total ({totalPieces} pcs)</p>
            <p className="text-2xl font-bold mt-1">₹{grandTotal.toLocaleString('en-IN')}</p>
          </div>
          <span className="material-symbols-outlined text-3xl opacity-80">payments</span>
        </div>

        {/* Note */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Note</label>
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as 'preset' | 'custom')}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[16px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="preset">{BANK_NOTE_PRESET}</option>
            <option value="custom">Custom</option>
          </select>
          {noteType === 'custom' && (
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Enter custom note..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[16px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all animate-fade-in"
              autoFocus
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClear}
            className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingEdit}
            className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
          </button>
        </div>

        <Link
          href={historyHref}
          className="text-center py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">history</span>
          Show History
        </Link>
      </div>
    </div>
  );

  if (standalone) return content;
  return <DashboardNav>{content}</DashboardNav>;
}
