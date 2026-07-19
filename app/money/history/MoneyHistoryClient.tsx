'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { MoneyCalculatorHistory } from '@/lib/types';
import DashboardNav from '@/components/DashboardNav';

export default function MoneyHistoryClient({ standalone }: { standalone: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [history, setHistory] = useState<MoneyCalculatorHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const moneyHref = standalone ? '/' : '/money';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('money_calculator_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setHistory(data as MoneyCalculatorHistory[]);
    setLoading(false);
  };

  const handleVoid = async (id: string) => {
    if (!window.confirm('Void this entry? It stays in history but gets crossed out — it is not removed.')) return;

    const { error } = await (supabase as any)
      .from('money_calculator_history')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      toast.error('Failed to void: ' + error.message);
      return;
    }

    toast.success('Entry voided');
    fetchHistory();
  };

  const formatDateTime = (dt: string) => new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const content = (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg flex flex-col gap-5">
        <div className="flex items-center justify-between">
          {standalone ? (
            <Link href={moneyHref} className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span> Back
            </Link>
          ) : (
            <button onClick={() => router.back()} className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span> Back
            </button>
          )}
          <h1 className="text-lg font-bold text-slate-800">History</h1>
          <div className="w-16"></div>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-16">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-center text-slate-400 py-16">No saved calculations yet.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {history.map(item => (
              <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${item.is_deleted ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                  <span className={`text-sm text-slate-600 ${item.is_deleted ? 'line-through' : ''}`}>{formatDateTime(item.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {item.is_deleted && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">Void</span>
                    )}
                    <span className={`text-lg font-bold text-blue-600 ${item.is_deleted ? 'line-through' : ''}`}>₹{item.total_amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className={`divide-y divide-slate-100 ${item.is_deleted ? 'line-through' : ''}`}>
                  {item.entries.map((e, idx) => (
                    <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500">₹{e.denomination} × {e.count}</span>
                      <span className="font-medium text-slate-800">₹{e.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                {item.note && (
                  <div className={`px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 ${item.is_deleted ? 'line-through' : ''}`}>
                    Note: <span className="text-slate-700 font-medium">{item.note}</span>
                  </div>
                )}
                {!item.is_deleted && (
                  <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                    <Link
                      href={`${moneyHref}?edit=${item.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                    </Link>
                    <button
                      onClick={() => handleVoid(item.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (standalone) return content;
  return <DashboardNav>{content}</DashboardNav>;
}
