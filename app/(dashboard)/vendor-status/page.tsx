'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import type { Vendor } from '@/lib/types';

type DayStatus = {
  vendor_id: string;
  vendor_name: string;
  billed: number;
  paid: number;
  present: boolean;
};

type CalendarCell = {
  date: string;
  present: boolean;
};

export default function VendorStatusPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [view, setView] = useState<'day' | 'history'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayStatuses, setDayStatuses] = useState<DayStatus[]>([]);

  // History view state
  const [historyVendorId, setHistoryVendorId] = useState<string>('');
  const [historyMonth, setHistoryMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month 0-indexed
  });
  const [calendarCells, setCalendarCells] = useState<CalendarCell[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (view === 'day') fetchDayStatus(selectedDate);
  }, [selectedDate, view, vendors]);

  useEffect(() => {
    if (view === 'history' && historyVendorId) fetchHistory();
  }, [view, historyVendorId, historyMonth]);

  const fetchVendors = async () => {
    setLoading(true);
    // Bug fix: vendors.active isn't a real column (it's is_active) — querying
    // it always failed and silently fell back to a second request, doubling
    // the wait before this page's vendor list populated.
    const res = await supabase.from('vendors').select('id, name, type').eq('is_active', true).eq('type', 'vendor');
    const list = res.data as any[] | null;
    // Safety filter: this page tracks only vendors (not shopkeepers)
    setVendors(((list || []) as Vendor[]).filter(v => v.type === 'vendor'));
    setLoading(false);
  };

  const fetchDayStatus = async (date: string) => {
    if (vendors.length === 0) return;
    setLoading(true);
    const [{ data: bills }, { data: payments }] = await Promise.all([
      supabase.from('bills').select('vendor_id, grand_total').eq('date', date).eq('is_deleted', false),
      supabase.from('payments').select('vendor_id, cash_amount, upi_amount').eq('date', date).eq('is_deleted', false),
    ]);

    const billedMap = new Map<string, number>();
    (bills as any[] || []).forEach(b => {
      billedMap.set(b.vendor_id, (billedMap.get(b.vendor_id) || 0) + (Number(b.grand_total) || 0));
    });
    const paidMap = new Map<string, number>();
    (payments as any[] || []).forEach(p => {
      paidMap.set(p.vendor_id, (paidMap.get(p.vendor_id) || 0) + (Number(p.cash_amount) || 0) + (Number(p.upi_amount) || 0));
    });

    const statuses: DayStatus[] = vendors.map(v => ({
      vendor_id: v.id,
      vendor_name: v.name,
      billed: billedMap.get(v.id) || 0,
      paid: paidMap.get(v.id) || 0,
      present: billedMap.has(v.id),
    }));

    // Present vendors first, then absent, both alphabetically
    statuses.sort((a, b) => {
      if (a.present !== b.present) return a.present ? -1 : 1;
      return a.vendor_name.localeCompare(b.vendor_name);
    });

    setDayStatuses(statuses);
    setLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { year, month } = historyMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstStr = firstDay.toISOString().split('T')[0];
    const lastStr = lastDay.toISOString().split('T')[0];

    const { data: bills } = await supabase
      .from('bills')
      .select('date')
      .eq('vendor_id', historyVendorId)
      .eq('is_deleted', false)
      .gte('date', firstStr)
      .lte('date', lastStr);

    const billedDates = new Set((bills as any[] || []).map(b => b.date));

    const cells: CalendarCell[] = [];
    const daysInMonth = lastDay.getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dStr = d.toISOString().split('T')[0];
      if (dStr > todayStr) break; // don't mark future days
      cells.push({ date: dStr, present: billedDates.has(dStr) });
    }
    setCalendarCells(cells);
    setHistoryLoading(false);
  };

  const presentCount = useMemo(() => dayStatuses.filter(s => s.present).length, [dayStatuses]);
  const absentCount = dayStatuses.length - presentCount;

  const changeMonth = (delta: number) => {
    setHistoryMonth(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  };

  const monthLabel = new Date(historyMonth.year, historyMonth.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
        <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-md h-full overflow-y-auto max-w-4xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-xs">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Vendor Status</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Track who took goods and paid, day by day.</p>
            </div>
            <div className="flex bg-surface-container-high rounded-xl p-1">
              <button
                onClick={() => setView('day')}
                className={`px-space-lg py-space-xs font-label-md rounded-lg transition-all ${view === 'day' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}`}
              >
                Today's View
              </button>
              <button
                onClick={() => setView('history')}
                className={`px-space-lg py-space-xs font-label-md rounded-lg transition-all ${view === 'history' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}`}
              >
                History / Calendar
              </button>
            </div>
          </div>

          {view === 'day' && (
            <>
              <div className="flex items-center gap-space-md">
                <input
                  type="date"
                  value={selectedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
                <div className="flex gap-space-sm">
                  <span className="px-space-md py-space-xs rounded-full bg-primary/10 text-primary text-sm font-bold">{presentCount} Billed</span>
                  <span className="px-space-md py-space-xs rounded-full bg-error/10 text-error text-sm font-bold">{absentCount} Absent</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="px-space-md py-space-sm font-label-md text-on-surface-variant">Vendor</th>
                        <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-right">Goods Taken (Billed)</th>
                        <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-right">Money Given</th>
                        <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {loading ? (
                        <tr><td colSpan={4} className="px-space-md py-space-xl text-center text-on-surface-variant">Loading...</td></tr>
                      ) : dayStatuses.length === 0 ? (
                        <tr><td colSpan={4} className="px-space-md py-space-xl text-center text-on-surface-variant">No active vendors found.</td></tr>
                      ) : (
                        dayStatuses.map(s => (
                          <tr key={s.vendor_id} className={`hover:bg-surface-container-low transition-colors ${!s.present ? 'opacity-70' : ''}`}>
                            <td className="px-space-md py-space-sm font-medium text-on-surface">{s.vendor_name}</td>
                            <td className="px-space-md py-space-sm text-right table-lining-figures">{s.present ? `₹${s.billed.toLocaleString('en-IN')}` : '—'}</td>
                            <td className="px-space-md py-space-sm text-right table-lining-figures">{s.paid > 0 ? `₹${s.paid.toLocaleString('en-IN')}` : '—'}</td>
                            <td className="px-space-md py-space-sm text-center">
                              {s.present ? (
                                <span className="px-space-sm py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">Billed</span>
                              ) : (
                                <span className="px-space-sm py-1 rounded-full bg-error/10 text-error text-xs font-bold">Absent</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {view === 'history' && (
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-md flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center gap-space-md">
                <select
                  value={historyVendorId}
                  onChange={(e) => setHistoryVendorId(e.target.value)}
                  className="w-full sm:w-64 px-space-md py-space-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {historyVendorId && (
                  <div className="flex items-center gap-space-sm ml-auto">
                    <button onClick={() => changeMonth(-1)} className="p-space-sm rounded-full hover:bg-surface-container-high transition-colors">
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <span className="font-label-lg text-on-surface min-w-[140px] text-center">{monthLabel}</span>
                    <button onClick={() => changeMonth(1)} className="p-space-sm rounded-full hover:bg-surface-container-high transition-colors">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                )}
              </div>

              {!historyVendorId ? (
                <div className="text-center text-on-surface-variant py-space-xl">Select a vendor to see their attendance calendar.</div>
              ) : historyLoading ? (
                <div className="text-center text-on-surface-variant py-space-xl">Loading...</div>
              ) : (
                <div className="grid grid-cols-7 gap-space-sm">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-xs font-bold text-on-surface-variant uppercase">{d}</div>
                  ))}
                  {calendarCells.length > 0 && Array.from({ length: new Date(calendarCells[0].date).getDay() }).map((_, i) => (
                    <div key={`pad-${i}`}></div>
                  ))}
                  {calendarCells.map(cell => (
                    <div
                      key={cell.date}
                      title={cell.present ? 'Billed' : 'Absent'}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold ${cell.present ? 'bg-primary/15 text-primary' : 'bg-error/10 text-error'}`}
                    >
                      {new Date(cell.date).getDate()}
                    </div>
                  ))}
                </div>
              )}

              {historyVendorId && !historyLoading && (
                <div className="flex gap-space-md text-sm mt-space-sm">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/15 border border-primary/30 inline-block"></span> Billed</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-error/10 border border-error/30 inline-block"></span> Absent</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col">
        <header className="flex items-center justify-between p-4 w-full z-10 bg-surface border-b border-outline-variant shadow-sm sticky top-0">
          <h1 className="font-title-main text-[20px] font-bold text-primary">Vendor Status</h1>
        </header>

        <main className="flex-1 px-[16px] py-4 space-y-[12px] overflow-y-auto">
          <div className="flex p-1 bg-surface-container-high rounded-lg">
            <button
              onClick={() => setView('day')}
              className={`flex-1 h-[44px] rounded font-label-caption text-[14px] transition-all ${view === 'day' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              Today's View
            </button>
            <button
              onClick={() => setView('history')}
              className={`flex-1 h-[44px] rounded font-label-caption text-[14px] transition-all ${view === 'history' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              History
            </button>
          </div>

          {view === 'day' && (
            <>
              <input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded px-3 font-body-standard text-[16px] focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <span className="flex-1 text-center px-space-sm py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold">{presentCount} Billed</span>
                <span className="flex-1 text-center px-space-sm py-2 rounded-xl bg-error/10 text-error text-sm font-bold">{absentCount} Absent</span>
              </div>

              <div className="flex flex-col gap-2">
                {loading ? (
                  <div className="text-center text-on-surface-variant py-8 text-sm">Loading...</div>
                ) : dayStatuses.length === 0 ? (
                  <div className="text-center text-on-surface-variant py-8 text-sm">No active vendors found.</div>
                ) : (
                  dayStatuses.map(s => (
                    <div key={s.vendor_id} className={`bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex items-center justify-between ${!s.present ? 'opacity-70' : ''}`}>
                      <div>
                        <p className="font-body-standard text-[14px] font-medium text-on-surface">{s.vendor_name}</p>
                        <p className="font-label-caption text-[12px] text-on-surface-variant">
                          {s.present ? `Billed ₹${s.billed.toLocaleString('en-IN')}` : 'No bill today'}
                          {s.paid > 0 ? ` • Paid ₹${s.paid.toLocaleString('en-IN')}` : ''}
                        </p>
                      </div>
                      {s.present ? (
                        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">Billed</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-error/10 text-error text-[11px] font-bold">Absent</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {view === 'history' && (
            <>
              <select
                value={historyVendorId}
                onChange={(e) => setHistoryVendorId(e.target.value)}
                className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded px-3 font-body-standard text-[16px] focus:border-primary focus:outline-none"
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {historyVendorId && (
                <div className="flex items-center justify-center gap-space-md">
                  <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <span className="font-label-lg text-on-surface min-w-[140px] text-center">{monthLabel}</span>
                  <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              )}

              {!historyVendorId ? (
                <div className="text-center text-on-surface-variant py-8 text-sm">Select a vendor to see their attendance calendar.</div>
              ) : historyLoading ? (
                <div className="text-center text-on-surface-variant py-8 text-sm">Loading...</div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-on-surface-variant uppercase">{d}</div>
                  ))}
                  {calendarCells.length > 0 && Array.from({ length: new Date(calendarCells[0].date).getDay() }).map((_, i) => (
                    <div key={`pad-${i}`}></div>
                  ))}
                  {calendarCells.map(cell => (
                    <div
                      key={cell.date}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold ${cell.present ? 'bg-primary/15 text-primary' : 'bg-error/10 text-error'}`}
                    >
                      {new Date(cell.date).getDate()}
                    </div>
                  ))}
                </div>
              )}

              {historyVendorId && !historyLoading && (
                <div className="flex gap-space-md text-xs mt-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/15 border border-primary/30 inline-block"></span> Billed</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-error/10 border border-error/30 inline-block"></span> Absent</span>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
