'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { MoneyCalculatorHistory } from '@/lib/types';

export default function MoneyHistoryPage() {
  const supabase = createClient();
  const [history, setHistory] = useState<MoneyCalculatorHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('money_calculator_history')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (data) setHistory(data as MoneyCalculatorHistory[]);
    setLoading(false);
  };

  const formatDateTime = (dt: string) => new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span> Back
          </Link>
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
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-600">{formatDateTime(item.created_at)}</span>
                  <span className="text-lg font-bold text-blue-600">₹{item.total_amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {item.entries.map((e, idx) => (
                    <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500">₹{e.denomination} × {e.count}</span>
                      <span className="font-medium text-slate-800">₹{e.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                {item.note && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                    Note: <span className="text-slate-700 font-medium">{item.note}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
