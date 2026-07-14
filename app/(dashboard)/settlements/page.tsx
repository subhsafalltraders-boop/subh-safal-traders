'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, AppSetting, Advance, Bill } from '@/lib/types';
import { generateBillHTML, printBill } from '@/lib/printUtils';

const PREDEFINED_PRICES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];

type DayRow = {
  date: string;
  bills: any[];
  billedTotal: number;
  paidTotal: number;
  present: boolean;
  note: string;
};

export default function SettlementsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    vendor_id: '',
    date_from: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
  });

  const [periodBills, setPeriodBills] = useState<any[]>([]);
  const [periodPayments, setPeriodPayments] = useState<any[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [pendingAdvances, setPendingAdvances] = useState<Advance[]>([]);

  // Van Stock / Waapsi (Return)
  const [showVanStock, setShowVanStock] = useState(false);
  const [vanStockQty, setVanStockQty] = useState<{ [price: number]: number }>({});
  const [customVanStock, setCustomVanStock] = useState<{ id: number, price: number | '', pieces: number | '' }[]>([
    { id: Date.now(), price: '', pieces: '' }
  ]);
  const [waapsiDate, setWaapsiDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnBillGenerating, setReturnBillGenerating] = useState(false);

  // Manual adjustments (replace the old auto-carried-forward opening balance)
  const [pichlaAmount, setPichlaAmount] = useState<string>('');
  const [pichlaSign, setPichlaSign] = useState<'add' | 'subtract'>('subtract');
  const [otherAmount, setOtherAmount] = useState<string>('');
  const [otherSign, setOtherSign] = useState<'add' | 'subtract'>('add');
  const [otherLabel, setOtherLabel] = useState('');

  // Bill preview modal
  const [previewBill, setPreviewBill] = useState<any | null>(null);

  // Inline "edit money for this day" modal
  const [editPaymentDate, setEditPaymentDate] = useState<string | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState<{ cash: string; upi: string; existingId: string | null }>({ cash: '', upi: '', existingId: null });
  const [savingPayment, setSavingPayment] = useState(false);

  // Inline "note for this day" modal
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.vendor_id && formData.date_from && formData.date_to) {
      fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
    } else {
      setPeriodBills([]);
      setPeriodPayments([]);
      setNotesMap({});
    }
  }, [formData.vendor_id, formData.date_from, formData.date_to]);

  useEffect(() => {
    if (formData.vendor_id) {
      fetchPendingAdvances(formData.vendor_id);
    } else {
      setPendingAdvances([]);
    }
  }, [formData.vendor_id]);

  useEffect(() => {
    // Keep the Waapsi print date sensible as the selected range changes.
    setWaapsiDate(formData.date_to || new Date().toISOString().split('T')[0]);
  }, [formData.date_to]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [vendorsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('is_active', true),
      supabase.from('app_settings').select('*')
    ]);

    if ((vendorsRes as any).data) {
      setVendors((vendorsRes as any).data as Vendor[]);
    }

    const initialQtys: { [price: number]: number } = {};
    PREDEFINED_PRICES.forEach(p => initialQtys[p] = 0);
    setVanStockQty(initialQtys);

    setLoading(false);
  };

  const fetchPendingAdvances = async (vendorId: string) => {
    const { data } = await (supabase as any)
      .from('vendor_advances')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('used_in_settlement', false)
      .order('date', { ascending: true });

    if (data) setPendingAdvances(data as Advance[]);
  };

  const fetchAggregates = async (vendor_id: string, from: string, to: string) => {
    const [{ data: billsData }, { data: paymentsData }] = await Promise.all([
      supabase
        .from('bills')
        .select('id, bill_number, date, grand_total, items, vendor_id, vendor_name, bill_type')
        .eq('vendor_id', vendor_id)
        .gte('date', from)
        .lte('date', to)
        .eq('is_deleted', false)
        .order('date', { ascending: true }),
      supabase
        .from('payments')
        .select('id, date, cash_amount, upi_amount, total_received')
        .eq('vendor_id', vendor_id)
        .gte('date', from)
        .lte('date', to)
        .eq('is_deleted', false)
    ]);

    setPeriodBills(billsData || []);
    setPeriodPayments(paymentsData || []);

    // Notes table is new — fetch defensively in case the migration hasn't been run yet.
    try {
      const { data: notesData, error: notesError } = await (supabase as any)
        .from('settlement_notes')
        .select('date, note')
        .eq('vendor_id', vendor_id)
        .gte('date', from)
        .lte('date', to);
      if (!notesError && notesData) {
        const map: Record<string, string> = {};
        notesData.forEach((n: any) => { map[n.date] = n.note; });
        setNotesMap(map);
      } else {
        setNotesMap({});
      }
    } catch {
      setNotesMap({});
    }
  };

  // Build one row per calendar day in the selected range
  const dayRows: DayRow[] = useMemo(() => {
    if (!formData.date_from || !formData.date_to) return [];
    const start = new Date(formData.date_from);
    const end = new Date(formData.date_to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const billsByDate = new Map<string, any[]>();
    periodBills.forEach(b => {
      if (!billsByDate.has(b.date)) billsByDate.set(b.date, []);
      billsByDate.get(b.date)!.push(b);
    });

    const paidByDate = new Map<string, number>();
    periodPayments.forEach(p => {
      paidByDate.set(p.date, (paidByDate.get(p.date) || 0) + (Number(p.total_received) || 0));
    });

    const rows: DayRow[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dStr = cursor.toISOString().split('T')[0];
      const bills = billsByDate.get(dStr) || [];
      rows.push({
        date: dStr,
        bills,
        billedTotal: bills.reduce((s, b) => s + (Number(b.grand_total) || 0), 0),
        paidTotal: paidByDate.get(dStr) || 0,
        present: bills.length > 0,
        note: notesMap[dStr] || '',
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }, [periodBills, periodPayments, notesMap, formData.date_from, formData.date_to]);

  // Calculations
  const totalBilled = useMemo(() => periodBills.reduce((s, b) => s + (Number(b.grand_total) || 0), 0), [periodBills]);
  const totalReceived = useMemo(() => periodPayments.reduce((s, p) => s + (Number(p.total_received) || 0), 0), [periodPayments]);

  const vanStockPredefinedTotal = PREDEFINED_PRICES.reduce((sum, price) => sum + ((vanStockQty[price] || 0) * price), 0);
  const vanStockCustomTotal = customVanStock.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.pieces) || 0)), 0);
  const vanStockTotal = vanStockPredefinedTotal + vanStockCustomTotal;

  const advanceAmount = pendingAdvances.reduce((sum, a) => sum + a.amount, 0);

  const selectedVendor = vendors.find(v => v.id === formData.vendor_id);
  const isVendorType = selectedVendor?.type === 'vendor';
  const gstRate = isVendorType ? 18 : 0;
  const taxableAmount = totalBilled - vanStockTotal;
  const gstAmount = isVendorType && taxableAmount > 0 ? Math.round(taxableAmount * (18 / 118)) : 0;

  const pichlaValue = pichlaSign === 'add' ? Math.abs(Number(pichlaAmount) || 0) : -Math.abs(Number(pichlaAmount) || 0);
  const otherValue = otherSign === 'add' ? Math.abs(Number(otherAmount) || 0) : -Math.abs(Number(otherAmount) || 0);

  const finalBalance = totalBilled - vanStockTotal - gstAmount - totalReceived + advanceAmount + pichlaValue + otherValue;

  const generateBillNumber = async (supabaseClient: any) => {
    const year = new Date().getFullYear();
    const prefix = `SST-${year}-`;
    const { data, error } = await supabaseClient
      .from('bills')
      .select('bill_number')
      .like('bill_number', `${prefix}%`)
      .order('bill_number', { ascending: false });

    if (error) throw error;

    let maxNum = 0;
    if (data && data.length > 0) {
      data.forEach((bill: { bill_number: string }) => {
        const parts = bill.bill_number.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
    }
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  };

  const handleGenerateReturnBill = async () => {
    if (!formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }

    const items: any[] = [];
    PREDEFINED_PRICES.forEach(price => {
      const qty = vanStockQty[price] || 0;
      if (qty > 0) {
        items.push({ product_name: `Rs.${price} Item`, piece_qty: qty, box_qty: 0, price_per_piece: price, line_total: qty * price });
      }
    });
    customVanStock.forEach(item => {
      const p = Number(item.price) || 0;
      const pcs = Number(item.pieces) || 0;
      if (p > 0 && pcs > 0) {
        items.push({ product_name: `Rs.${p} Item (Custom)`, piece_qty: pcs, box_qty: 0, price_per_piece: p, line_total: p * pcs });
      }
    });

    if (items.length === 0) {
      toast.error("No van stock entered to generate a bill.");
      return;
    }

    setReturnBillGenerating(true);
    try {
      const billNumber = await generateBillNumber(supabase);
      const billTotal = items.reduce((sum, item) => sum + item.line_total, 0);

      const billPayload = {
        vendor_id: formData.vendor_id,
        date: waapsiDate || new Date().toISOString().split('T')[0],
        bill_number: billNumber,
        items: items,
        grand_total: billTotal,
        subtotal: billTotal,
        discount_amount: 0,
        gst_amount: 0,
        bill_type: 'simple',
        vendor_name: vendors.find(v => v.id === formData.vendor_id)?.name || 'Vendor'
      };

      const { data: insertedBill, error } = await (supabase as any)
        .from('bills')
        .insert([billPayload])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const retryBillNumber = await generateBillNumber(supabase);
          const retryPayload = { ...billPayload, bill_number: retryBillNumber };
          const { data: retryBill, error: retryError } = await (supabase as any)
            .from('bills')
            .insert([retryPayload])
            .select()
            .single();
          if (retryError) throw retryError;
          toast.success(`Return Bill ${retryBillNumber} generated!`);
          const html = generateBillHTML(retryBill, appSetting, 'shopkeeper', true);
          printBill(html);
          fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
          return;
        }
        throw error;
      }

      toast.success(`Return Bill ${billNumber} generated!`);
      const html = generateBillHTML(insertedBill, appSetting, 'shopkeeper', true);
      printBill(html);
      fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
    } catch (err: any) {
      toast.error("Failed to generate bill: " + err.message);
    } finally {
      setReturnBillGenerating(false);
    }
  };

  const openEditPayment = (dateStr: string) => {
    const existing = periodPayments.filter(p => p.date === dateStr);
    const first = existing[0];
    setEditPaymentForm({
      cash: first ? String(first.cash_amount || 0) : '',
      upi: first ? String(first.upi_amount || 0) : '',
      existingId: first ? first.id : null,
    });
    setEditPaymentDate(dateStr);
  };

  const saveEditPayment = async () => {
    if (!editPaymentDate || !formData.vendor_id) return;
    const cash = Number(editPaymentForm.cash) || 0;
    const upi = Number(editPaymentForm.upi) || 0;

    setSavingPayment(true);
    const payload: any = {
      vendor_id: formData.vendor_id,
      date: editPaymentDate,
      cash_amount: Math.round(cash),
      upi_amount: Math.round(upi),
      total_received: Math.round(cash + upi),
      is_deleted: false,
    };

    let error;
    if (editPaymentForm.existingId) {
      const res = await (supabase as any).from('payments').update(payload).eq('id', editPaymentForm.existingId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('payments').insert([payload]);
      error = res.error;
    }
    setSavingPayment(false);

    if (error) {
      toast.error('Failed to save payment: ' + error.message);
      return;
    }

    toast.success('Payment saved');
    setEditPaymentDate(null);
    fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
  };

  const openNoteEditor = (dateStr: string) => {
    setNoteText(notesMap[dateStr] || '');
    setNoteDate(dateStr);
  };

  const saveNote = async () => {
    if (!noteDate || !formData.vendor_id) return;
    setSavingNote(true);
    const { error } = await (supabase as any)
      .from('settlement_notes')
      .upsert(
        { vendor_id: formData.vendor_id, date: noteDate, note: noteText, updated_at: new Date().toISOString() },
        { onConflict: 'vendor_id,date' }
      );
    setSavingNote(false);

    if (error) {
      toast.error('Failed to save note: ' + (error.message || 'Notes table may be missing — run the latest migration.'));
      return;
    }

    toast.success('Note saved');
    setNoteDate(null);
    fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
  };

  const formatDateLabel = (dStr: string) => new Date(dStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

  const handlePrintSettlement = () => {
    if (!selectedVendor) {
      toast.error('Please select a vendor first.');
      return;
    }
    const fmt = (d: string) => {
      try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; }
    };
    const companyName = appSetting?.company_name || 'SUBH SAFAL TRADERS';
    const companyAddress = appSetting?.address || 'LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI';
    const gstin = appSetting?.gstin || '10BDBPM9273J1Z1';
    const phone = appSetting?.phone || '9122035642, 9431836502';

    const ledgerRows = dayRows.map(row => {
      const billsStr = row.bills.length > 0 ? row.bills.map((b: any) => b.bill_number).join(', ') : '-';
      const statusStr = row.present ? 'Billed' : 'Absent / Not Billed';
      const moneyStr = row.paidTotal > 0 ? `Rs.${row.paidTotal.toLocaleString('en-IN')}` : 'No money given';
      return `
        <tr style="border-bottom:1px solid #eee;${!row.present ? 'background:#fff5f5;' : ''}">
          <td style="padding:5px 6px;">${formatDateLabel(row.date)}</td>
          <td style="padding:5px 6px;">${billsStr}</td>
          <td style="padding:5px 6px;text-align:right;">${row.present ? 'Rs.' + row.billedTotal.toLocaleString('en-IN') : '-'}</td>
          <td style="padding:5px 6px;text-align:right;color:${row.paidTotal > 0 ? '#166534' : '#999'};">${moneyStr}</td>
          <td style="padding:5px 6px;text-align:center;">${statusStr}</td>
          <td style="padding:5px 6px;font-size:10px;color:#666;">${row.note || ''}</td>
        </tr>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Settlement - ${selectedVendor.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size:12px; }
    @page { size: A4 portrait; margin: 12mm; }
    @media print { .no-print { display:none !important; } }
    table { width:100%; border-collapse:collapse; }
  </style>
</head>
<body>
  <div style="max-width:800px;margin:0 auto;padding:16px;">
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:6px;">
        <div>GSTIN: ${gstin}</div>
        <div>MOB: ${phone}</div>
      </div>
      <div style="font-size:13px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Settlement Statement</div>
      <div style="font-size:16px;font-weight:bold;text-transform:uppercase;">${companyName}</div>
      <div style="font-size:10px;text-transform:uppercase;">${companyAddress}</div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding:10px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;">
      <div>
        <div style="font-size:10px;color:#666;">Vendor/Shopkeeper</div>
        <div style="font-size:13px;font-weight:bold;">${selectedVendor.name} (${selectedVendor.type})</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#666;">Period</div>
        <div style="font-size:13px;font-weight:bold;">${fmt(formData.date_from)} to ${fmt(formData.date_to)}</div>
      </div>
    </div>

    <table style="font-size:11px;border:1px solid #000;margin-bottom:16px;">
      <thead style="background:#f5f5f5;border-bottom:2px solid #000;">
        <tr>
          <th style="padding:6px;text-align:left;">Date</th>
          <th style="padding:6px;text-align:left;">Bill No.</th>
          <th style="padding:6px;text-align:right;">Billed</th>
          <th style="padding:6px;text-align:right;">Money</th>
          <th style="padding:6px;text-align:center;">Status</th>
          <th style="padding:6px;text-align:left;">Note</th>
        </tr>
      </thead>
      <tbody>${ledgerRows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #000;font-weight:bold;background:#f9f9f9;">
          <td colspan="2" style="padding:6px;">Total</td>
          <td style="padding:6px;text-align:right;">Rs.${totalBilled.toLocaleString('en-IN')}</td>
          <td style="padding:6px;text-align:right;color:#166534;">Rs.${totalReceived.toLocaleString('en-IN')}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    <table style="font-size:12px;margin-bottom:16px;">
      <tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Total Billed</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">Rs.${totalBilled.toLocaleString('en-IN')}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">(-) Waapsi (Return)</td><td style="padding:8px;border:1px solid #ddd;text-align:right;color:#c62828;">- Rs.${vanStockTotal.toLocaleString('en-IN')}</td></tr>
      ${isVendorType ? `<tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">(-) GST (18%)</td><td style="padding:8px;border:1px solid #ddd;text-align:right;color:#c62828;">- Rs.${gstAmount.toLocaleString('en-IN')}</td></tr>` : ''}
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">(-) Received</td><td style="padding:8px;border:1px solid #ddd;text-align:right;color:#166534;font-weight:bold;">- Rs.${totalReceived.toLocaleString('en-IN')}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">(+) Advance</td><td style="padding:8px;border:1px solid #ddd;text-align:right;color:#166534;">+ Rs.${advanceAmount.toLocaleString('en-IN')}</td></tr>
      ${pichlaValue !== 0 ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Pichla Hisaab</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">${pichlaValue > 0 ? '+' : '-'} Rs.${Math.abs(pichlaValue).toLocaleString('en-IN')}</td></tr>` : ''}
      ${otherValue !== 0 ? `<tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Other${otherLabel ? ' (' + otherLabel + ')' : ''}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">${otherValue > 0 ? '+' : '-'} Rs.${Math.abs(otherValue).toLocaleString('en-IN')}</td></tr>` : ''}
      <tr style="border-top:3px solid #000;background:${finalBalance > 0 ? '#ffebee' : finalBalance < 0 ? '#e8f5e9' : '#f5f5f5'};">
        <td style="padding:10px;border:1px solid #ddd;font-weight:bold;font-size:14px;">NET BALANCE</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:right;font-weight:bold;font-size:15px;color:${finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000'};">Rs.${Math.abs(finalBalance).toLocaleString('en-IN')}</td>
      </tr>
    </table>

    <div style="padding:12px;background:${finalBalance > 0 ? '#ffebee' : finalBalance < 0 ? '#e8f5e9' : '#f5f5f5'};border-left:4px solid ${finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#999'};border-radius:4px;margin-bottom:24px;">
      <div style="font-size:13px;">
        ${finalBalance > 0
          ? `Vendor pe <strong>Rs.${Math.abs(finalBalance).toLocaleString('en-IN')}</strong> baaki hai`
          : finalBalance < 0
            ? `Aap vendor ko <strong>Rs.${Math.abs(finalBalance).toLocaleString('en-IN')}</strong> denge`
            : 'Hisab barabar hai'}
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;padding-top:16px;border-top:2px dashed #ccc;">
      <div><div style="font-size:10px;color:#666;">Printed On</div><div style="font-size:12px;font-weight:bold;">${new Date().toLocaleDateString('en-IN')}</div></div>
      <div style="text-align:center;min-width:180px;"><div style="border-top:2px solid #000;padding-top:5px;font-size:11px;">Authorized Signature</div></div>
    </div>

    <div class="no-print" style="margin-top:24px;text-align:center;">
      <button onclick="window.print()" style="padding:10px 26px;background:#1976d2;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;">Print Settlement</button>
      <button onclick="window.close()" style="padding:10px 26px;background:#666;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;margin-left:8px;">Close</button>
    </div>
  </div>
</body>
</html>
    `;
    printBill(html);
  };

  // ---- Shared calculation breakdown rows (used by both desktop & mobile) ----
  const CalcBreakdown = ({ compact }: { compact?: boolean }) => (
    <div className={`bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden divide-y divide-outline-variant/10`}>
      <div className="flex justify-between items-center px-3 py-2 gap-2">
        <span className="font-medium text-[14px]">Total Billed:</span>
        <span className="font-semibold text-[14px] text-right shrink-0">₹{totalBilled.toLocaleString('en-IN')}</span>
      </div>
      <div className="flex justify-between items-center px-3 py-2 gap-2 flex-wrap">
        <span className="text-[14px]">(-) Waapsi (Return):</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] text-[#c62828]">₹{vanStockTotal.toLocaleString('en-IN')}</span>
          <span className="text-[13px] text-on-surface-variant">= ₹{(totalBilled - vanStockTotal).toLocaleString('en-IN')}</span>
        </div>
      </div>
      {isVendorType && (
        <div className="flex justify-between items-center px-3 py-2 gap-2 flex-wrap">
          <span className="text-[14px]">(-) GST (18%):</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] text-[#c62828]">₹{gstAmount.toLocaleString('en-IN')}</span>
            <span className="text-[13px] text-on-surface-variant">= ₹{(totalBilled - vanStockTotal - gstAmount).toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center px-3 py-2 gap-2 flex-wrap">
        <span className="text-[14px]">(-) Received:</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] font-bold text-[#166534]">₹{totalReceived.toLocaleString('en-IN')}</span>
          <span className="text-[13px] text-on-surface-variant">= ₹{(totalBilled - vanStockTotal - gstAmount - totalReceived).toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div className="flex justify-between items-center px-3 py-2 gap-2 flex-wrap">
        <span className="text-[14px]">(+) Advance:</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] text-[#2e7d32]">₹{advanceAmount.toLocaleString('en-IN')}</span>
          <span className="text-[13px] text-on-surface-variant">= ₹{(totalBilled - vanStockTotal - gstAmount - totalReceived + advanceAmount).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Pichla Hisaab — manual, user picks add or subtract */}
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[14px] font-medium">Pichla Hisaab (manual):</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPichlaSign('add')} className={`px-2 py-1 rounded text-xs font-bold border ${pichlaSign === 'add' ? 'bg-[#166534] text-white border-[#166534]' : 'text-[#166534] border-[#166534]/30'}`}>+ Add</button>
            <button onClick={() => setPichlaSign('subtract')} className={`px-2 py-1 rounded text-xs font-bold border ${pichlaSign === 'subtract' ? 'bg-error text-white border-error' : 'text-error border-error/30'}`}>- Subtract</button>
          </div>
        </div>
        <input
          type="number" min="0" value={pichlaAmount}
          onChange={(e) => setPichlaAmount(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-[16px] focus:border-primary focus:outline-none"
        />
        <div className="text-right text-[13px] text-on-surface-variant">= ₹{(totalBilled - vanStockTotal - gstAmount - totalReceived + advanceAmount + pichlaValue).toLocaleString('en-IN')}</div>
      </div>

      {/* Other — manual, generic adjustment */}
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[14px] font-medium">Other Adjustment:</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setOtherSign('add')} className={`px-2 py-1 rounded text-xs font-bold border ${otherSign === 'add' ? 'bg-[#166534] text-white border-[#166534]' : 'text-[#166534] border-[#166534]/30'}`}>+ Add</button>
            <button onClick={() => setOtherSign('subtract')} className={`px-2 py-1 rounded text-xs font-bold border ${otherSign === 'subtract' ? 'bg-error text-white border-error' : 'text-error border-error/30'}`}>- Subtract</button>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-[14px] focus:border-primary focus:outline-none"
          />
          <input
            type="number" min="0" value={otherAmount}
            onChange={(e) => setOtherAmount(e.target.value)}
            placeholder="0"
            className="w-28 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-[16px] focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Net Balance */}
      <div
        className="flex justify-between items-center px-3 py-2.5 gap-2"
        style={{ background: finalBalance > 0 ? 'rgba(211,47,47,0.06)' : finalBalance < 0 ? 'rgba(22,101,52,0.06)' : 'rgba(0,0,0,0.03)' }}
      >
        <span className={`font-bold text-[15px] ${finalBalance > 0 ? 'text-[#c62828]' : finalBalance < 0 ? 'text-[#166534]' : 'text-on-surface'}`}>Net Balance:</span>
        <span className={`font-bold text-[16px] text-right shrink-0 ${finalBalance > 0 ? 'text-[#c62828]' : finalBalance < 0 ? 'text-[#166534]' : 'text-on-surface'}`}>
          ₹{Math.abs(finalBalance).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );

  // ---- Shared Van Stock (Waapsi) section ----
  const VanStockSection = () => (
    <div className="border border-outline-variant rounded-2xl bg-surface-container-lowest overflow-hidden">
      <button
        onClick={() => setShowVanStock(!showVanStock)}
        className="w-full p-space-md flex justify-between items-center bg-surface hover:bg-surface-container-low transition-colors text-left"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-space-xs sm:gap-space-md">
          <span className="font-headline-sm text-on-surface">Waapsi (Van Stock Return)</span>
          {vanStockTotal > 0 && (
            <span className="bg-[#166534]/10 text-[#166534] px-space-xs py-1 rounded-md text-sm font-medium">₹{vanStockTotal.toLocaleString('en-IN')}</span>
          )}
        </div>
        <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300" style={{ transform: showVanStock ? 'rotate(180deg)' : '' }}>expand_more</span>
      </button>

      {showVanStock && (
        <div className="p-space-md border-t border-outline-variant bg-surface-container-lowest animate-fade-in flex flex-col gap-space-md">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-space-md max-h-[300px] overflow-y-auto p-space-xs">
            {PREDEFINED_PRICES.map(price => {
              const qty = vanStockQty[price] || 0;
              const rowTotal = price * qty;
              return (
                <div key={price} className="flex flex-col items-center justify-center p-space-sm border border-outline-variant/60 rounded-xl bg-surface hover:border-primary/50 transition-colors shadow-sm">
                  <label className="font-headline-sm text-primary font-bold">₹{price}</label>
                  <input
                    type="number" min="0" value={vanStockQty[price] || ''}
                    onChange={(e) => setVanStockQty({ ...vanStockQty, [price]: e.target.value ? Number(e.target.value) : 0 })}
                    className="w-full max-w-[70px] text-center px-space-xs py-space-xs mt-space-xs bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-[16px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <span className="font-body-sm text-on-surface-variant mt-1 text-xs">= ₹{rowTotal}</span>
                </div>
              );
            })}

            {customVanStock.map((item, index) => {
              const rowTotal = (Number(item.price) || 0) * (Number(item.pieces) || 0);
              return (
                <div key={item.id} className="flex flex-col items-center justify-center p-space-sm border border-outline-variant/60 rounded-xl bg-surface-container-low relative group shadow-sm col-span-2 sm:col-span-1">
                  {customVanStock.length > 1 && (
                    <button
                      onClick={() => setCustomVanStock(customVanStock.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-error text-white rounded-full p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1 w-full justify-center">
                    <span className="font-bold text-primary text-sm">₹</span>
                    <input
                      type="number" placeholder="Amt" value={item.price}
                      onChange={(e) => {
                        const newStock = [...customVanStock];
                        newStock[index].price = e.target.value ? Number(e.target.value) : '';
                        setCustomVanStock(newStock);
                      }}
                      className="w-full max-w-[60px] text-center px-space-xs py-space-xs bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-[16px]"
                    />
                  </div>
                  <input
                    type="number" placeholder="Qty" value={item.pieces}
                    onChange={(e) => {
                      const newStock = [...customVanStock];
                      newStock[index].pieces = e.target.value ? Number(e.target.value) : '';
                      setCustomVanStock(newStock);
                    }}
                    className="w-full max-w-[70px] text-center px-space-xs py-space-xs mt-space-xs bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-[16px]"
                  />
                  <span className="font-body-sm text-on-surface-variant mt-1 text-xs">= ₹{rowTotal}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-center p-space-sm border border-dashed border-outline-variant rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors col-span-2 sm:col-span-1" onClick={() => setCustomVanStock([...customVanStock, { id: Date.now(), price: '', pieces: '' }])}>
              <span className="text-primary font-label-md flex flex-col items-center text-center">
                <span className="material-symbols-outlined mb-1 text-[20px]">add</span> Custom
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-space-md pt-space-sm border-t border-outline-variant">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-on-surface-variant text-xs">Waapsi Print Date</label>
              <input
                type="date"
                value={waapsiDate}
                onChange={(e) => setWaapsiDate(e.target.value)}
                className="px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={handleGenerateReturnBill}
              disabled={returnBillGenerating || vanStockTotal === 0}
              className="flex items-center justify-center gap-space-xs px-space-md py-space-sm bg-primary/10 text-primary font-label-md rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              {returnBillGenerating ? 'Generating...' : 'Print Waapsi'}
            </button>
            <div className="flex items-center sm:ml-auto">
              <span className="font-body-md text-on-surface-variant mr-space-sm">Total:</span>
              <span className="font-headline-sm text-error font-bold">₹{vanStockTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ---- Day-by-day ledger, desktop table ----
  const LedgerTableDesktop = () => (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr>
              <th className="px-space-md py-space-sm font-label-md text-on-surface-variant">Date</th>
              <th className="px-space-md py-space-sm font-label-md text-on-surface-variant">Bill(s)</th>
              <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-right">Billed</th>
              <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-right">Money</th>
              <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-center">Status</th>
              <th className="px-space-md py-space-sm font-label-md text-on-surface-variant text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {dayRows.map(row => (
              <tr key={row.date} className={`hover:bg-surface-container-low transition-colors ${!row.present ? 'bg-error/5' : ''}`}>
                <td className="px-space-md py-space-sm font-medium text-on-surface whitespace-nowrap">{formatDateLabel(row.date)}</td>
                <td className="px-space-md py-space-sm">
                  {row.bills.length === 0 ? (
                    <span className="text-on-surface-variant text-sm">—</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {row.bills.map((b: any) => (
                        <div key={b.id} className="flex items-center gap-2">
                          <span className="text-sm text-on-surface">{b.bill_number}</span>
                          <button onClick={() => setPreviewBill(b)} className="text-secondary hover:bg-secondary/10 rounded-full p-1" title="Preview bill">
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-space-md py-space-sm text-right table-lining-figures">{row.present ? `₹${row.billedTotal.toLocaleString('en-IN')}` : '—'}</td>
                <td className="px-space-md py-space-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={row.paidTotal > 0 ? 'text-[#166534] font-medium table-lining-figures' : 'text-on-surface-variant text-sm'}>
                      {row.paidTotal > 0 ? `₹${row.paidTotal.toLocaleString('en-IN')}` : 'No money given'}
                    </span>
                    <button onClick={() => openEditPayment(row.date)} className="text-primary hover:bg-primary/10 rounded-full p-1" title="Edit money for this day">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>
                </td>
                <td className="px-space-md py-space-sm text-center">
                  {row.present ? (
                    <span className="px-space-sm py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">Billed</span>
                  ) : (
                    <span className="px-space-sm py-1 rounded-full bg-error/10 text-error text-xs font-bold">Absent</span>
                  )}
                </td>
                <td className="px-space-md py-space-sm text-center">
                  <button onClick={() => openNoteEditor(row.date)} className={`p-1 rounded-full hover:bg-surface-container-high ${row.note ? 'text-primary' : 'text-on-surface-variant'}`} title={row.note || 'Add note'}>
                    <span className="material-symbols-outlined text-[18px]" style={row.note ? { fontVariationSettings: "'FILL' 1" } : {}}>sticky_note_2</span>
                  </button>
                </td>
              </tr>
            ))}
            {dayRows.length === 0 && (
              <tr><td colSpan={6} className="px-space-md py-space-xl text-center text-on-surface-variant">Select a vendor and date range to see the ledger.</td></tr>
            )}
          </tbody>
          {dayRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-outline-variant bg-surface-container-low">
                <td colSpan={2} className="px-space-md py-space-sm font-headline-sm text-on-surface font-bold">Total</td>
                <td className="px-space-md py-space-sm font-headline-sm text-on-surface text-right font-bold">₹{totalBilled.toLocaleString('en-IN')}</td>
                <td className="px-space-md py-space-sm font-headline-sm text-right font-bold text-[#166534]">₹{totalReceived.toLocaleString('en-IN')}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  // ---- Day-by-day ledger, mobile cards ----
  const LedgerCardsMobile = () => (
    <div className="flex flex-col gap-2">
      {dayRows.length === 0 ? (
        <div className="text-center text-on-surface-variant py-8 text-sm">Select a vendor and date range to see the ledger.</div>
      ) : (
        dayRows.map(row => (
          <div key={row.date} className={`bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2 ${!row.present ? 'bg-error/5' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-on-surface text-sm">{formatDateLabel(row.date)}</span>
              <div className="flex items-center gap-1">
                {row.present ? (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">Billed</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-error/10 text-error text-[11px] font-bold">Absent</span>
                )}
                <button onClick={() => openNoteEditor(row.date)} className={`p-1 rounded-full ${row.note ? 'text-primary' : 'text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-[16px]" style={row.note ? { fontVariationSettings: "'FILL' 1" } : {}}>sticky_note_2</span>
                </button>
              </div>
            </div>

            {row.bills.length > 0 && (
              <div className="flex flex-col gap-1">
                {row.bills.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <span className="text-on-surface">{b.bill_number}</span>
                    <div className="flex items-center gap-2">
                      <span className="table-lining-figures">₹{Number(b.grand_total).toLocaleString('en-IN')}</span>
                      <button onClick={() => setPreviewBill(b)} className="text-secondary p-1">
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/50">
              <span className={row.paidTotal > 0 ? 'text-[#166534] font-medium text-sm' : 'text-on-surface-variant text-xs'}>
                {row.paidTotal > 0 ? `Money: ₹${row.paidTotal.toLocaleString('en-IN')}` : 'No money given'}
              </span>
              <button onClick={() => openEditPayment(row.date)} className="text-primary flex items-center gap-1 text-xs font-medium">
                <span className="material-symbols-outlined text-[16px]">edit</span> Edit
              </button>
            </div>

            {row.note && (
              <div className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg px-2 py-1">{row.note}</div>
            )}
          </div>
        ))
      )}
      {dayRows.length > 0 && (
        <div className="flex justify-between items-center bg-surface-container-low rounded-xl px-3 py-2 mt-1 font-bold text-sm">
          <span>Total</span>
          <span>Billed ₹{totalBilled.toLocaleString('en-IN')} • <span className="text-[#166534]">Recv ₹{totalReceived.toLocaleString('en-IN')}</span></span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
        <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-lg print:hidden h-full overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant/30 pb-space-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Settlements</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Vendor ka din-wise hisaab.</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-md sm:p-space-xl flex flex-col gap-space-lg animate-fade-in max-w-5xl mx-auto w-full mb-space-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Vendor / Shopkeeper *</label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Date From *</label>
                <input
                  type="date"
                  value={formData.date_from}
                  onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                  className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-space-xs">Date To *</label>
                <input
                  type="date"
                  value={formData.date_to}
                  onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                  className="w-full px-space-sm py-space-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            {formData.vendor_id && LedgerTableDesktop()}

            {formData.vendor_id && pendingAdvances.length > 0 && (
              <div className="bg-surface-container-lowest border border-outline-variant p-space-md rounded-2xl shadow-sm flex flex-col gap-space-sm">
                <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-space-xs">Pending Advances (auto-included)</h3>
                <div className="flex flex-col gap-space-sm max-h-[160px] overflow-y-auto pr-2">
                  {pendingAdvances.map(adv => (
                    <div key={adv.id} className="flex items-center justify-between p-space-sm bg-surface rounded-xl border border-outline-variant/50">
                      <div className="flex flex-col">
                        <span className="font-medium text-on-surface text-sm">{adv.date}</span>
                        {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                      </div>
                      <span className="font-bold text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.vendor_id && VanStockSection()}

            {formData.vendor_id && (
              <div className={`flex flex-col border p-space-xl rounded-2xl gap-space-md shadow-sm transition-colors ${finalBalance > 0 ? 'bg-error/5 border-error/20' : finalBalance < 0 ? 'bg-[#166534]/5 border-[#166534]/20' : 'bg-surface-variant/30 border-outline-variant/50'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                  <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Final Balance Result</span>
                  {finalBalance > 0 ? (
                    <p className="font-headline-md text-error">Vendor pe <span className="font-bold">₹{finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span> baaki hai</p>
                  ) : finalBalance < 0 ? (
                    <p className="font-headline-md text-[#166534]">Aap vendor ko <span className="font-bold">₹{Math.abs(finalBalance).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span> denge</p>
                  ) : (
                    <p className="font-headline-md text-on-surface">Hisab barabar hai</p>
                  )}
                </div>
                {CalcBreakdown({})}
                <button
                  onClick={handlePrintSettlement}
                  className="self-start flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span> Print Settlement
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col overflow-x-hidden">
        <header className="sticky top-0 border-b border-outline-variant shadow-sm flex items-center justify-between p-4 w-full z-50 bg-surface transition-colors duration-200">
          <button onClick={() => window.history.back()} className="flex items-center justify-center min-w-[44px] min-h-[44px] text-primary active:bg-surface-container-high rounded-full transition-colors duration-200">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="font-title-main text-[18px] font-bold text-primary">Settlement</h1>
          <div className="w-[44px]"></div>
        </header>

        <main className="flex-1 px-[16px] py-[12px] flex flex-col gap-[12px] pb-[40px]">
          <div className="flex flex-col gap-1">
            <label className="font-label-caption text-[14px] text-on-surface-variant">Vendor</label>
            <div className="relative">
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                className="w-full h-[48px] appearance-none border border-outline-variant rounded px-4 font-body-standard text-[16px] text-on-surface bg-surface focus:outline-none focus:border-2 focus:border-primary focus:ring-0"
              >
                <option value="">Select Vendor</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-label-caption text-[14px] text-on-surface-variant">From Date</label>
              <input
                type="date"
                value={formData.date_from}
                onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                className="w-full h-[48px] border border-outline-variant rounded px-3 font-body-standard text-[16px] text-on-surface bg-surface focus:outline-none focus:border-2 focus:border-primary focus:ring-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caption text-[14px] text-on-surface-variant">To Date</label>
              <input
                type="date"
                value={formData.date_to}
                onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                className="w-full h-[48px] border border-outline-variant rounded px-3 font-body-standard text-[16px] text-on-surface bg-surface focus:outline-none focus:border-2 focus:border-primary focus:ring-0"
              />
            </div>
          </div>

          {formData.vendor_id && LedgerCardsMobile()}

          {formData.vendor_id && pendingAdvances.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant p-3 rounded-2xl shadow-sm flex flex-col gap-2">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-1 text-sm">Pending Advances (auto-included)</h3>
              <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                {pendingAdvances.map(adv => (
                  <div key={adv.id} className="flex items-center justify-between p-2 bg-surface rounded-xl border border-outline-variant/50 text-sm">
                    <span className="font-medium text-on-surface">{adv.date}</span>
                    <span className="font-bold text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.vendor_id && VanStockSection()}

          {formData.vendor_id && (
            <div className={`flex flex-col border p-4 rounded-2xl gap-3 shadow-sm transition-colors ${finalBalance > 0 ? 'bg-error/5 border-error/20' : finalBalance < 0 ? 'bg-[#166534]/5 border-[#166534]/20' : 'bg-surface-variant/30 border-outline-variant/50'}`}>
              <div className="flex flex-col gap-2">
                <span className="font-label-lg text-on-surface-variant uppercase tracking-wider text-xs">Final Balance Result</span>
                {finalBalance > 0 ? (
                  <p className="font-headline-md text-error text-[16px]">Vendor pe <span className="font-bold">₹{finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span> baaki hai</p>
                ) : finalBalance < 0 ? (
                  <p className="font-headline-md text-[#166534] text-[16px]">Aap vendor ko <span className="font-bold">₹{Math.abs(finalBalance).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span> denge</p>
                ) : (
                  <p className="font-headline-md text-on-surface text-[16px]">Hisab barabar hai</p>
                )}
              </div>
              {CalcBreakdown({ compact: true })}
              <button
                onClick={handlePrintSettlement}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary font-bold rounded-xl active:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">print</span> Print Settlement
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Bill Preview Modal */}
      {previewBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-space-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-lg overflow-hidden animate-fade-in">
            <div className="p-space-md border-b border-outline-variant flex justify-between items-center bg-surface">
              <h3 className="font-headline-sm text-on-surface">Bill Preview</h3>
              <div className="flex gap-space-sm">
                <button onClick={() => setPreviewBill(null)} className="px-space-lg py-space-sm border border-outline-variant rounded-xl font-medium text-on-surface hover:bg-surface-variant transition-colors">Close</button>
                <button
                  onClick={() => {
                    const html = generateBillHTML(previewBill, appSetting, vendors.find(v => v.id === previewBill.vendor_id)?.type);
                    printBill(html);
                  }}
                  className="px-space-lg py-space-sm bg-primary text-on-primary rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span> Print
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto overflow-x-hidden p-space-md sm:p-space-xl bg-surface-variant/50 flex justify-center items-start print:p-0 print:bg-transparent print:overflow-visible">
              <iframe
                title="Bill Preview"
                className="shadow-2xl print:shadow-none bg-white w-full max-w-[800px] border-0"
                style={{ minHeight: '70vh', height: '70vh' }}
                srcDoc={generateBillHTML(previewBill, appSetting, vendors.find(v => v.id === previewBill.vendor_id)?.type)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Money Modal */}
      {editPaymentDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-primary text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Edit Money — {formatDateLabel(editPaymentDate)}</h3>
              <button onClick={() => setEditPaymentDate(null)} className="opacity-80 hover:opacity-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Cash (₹)</label>
                <input
                  type="number" min="0" value={editPaymentForm.cash}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, cash: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-bold text-lg focus:border-primary focus:outline-none"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">UPI (₹)</label>
                <input
                  type="number" min="0" value={editPaymentForm.upi}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, upi: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-bold text-lg focus:border-primary focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="p-4 border-t border-outline-variant/30 flex gap-3">
              <button onClick={() => setEditPaymentDate(null)} className="flex-1 py-3 rounded-xl border border-outline-variant font-bold text-on-surface-variant">Cancel</button>
              <button
                onClick={saveEditPayment}
                disabled={savingPayment}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {savingPayment ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-container-high flex justify-between items-center">
              <h3 className="font-bold text-lg text-on-surface">Note — {formatDateLabel(noteDate)}</h3>
              <button onClick={() => setNoteDate(null)} className="opacity-70 hover:opacity-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Vendor absent due to festival, or partial payment reason..."
                rows={4}
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-[16px] focus:border-primary focus:outline-none resize-none"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-outline-variant/30 flex gap-3">
              <button onClick={() => setNoteDate(null)} className="flex-1 py-3 rounded-xl border border-outline-variant font-bold text-on-surface-variant">Cancel</button>
              <button
                onClick={saveNote}
                disabled={savingNote}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
