'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, AppSetting, Advance } from '@/lib/types';
import Link from 'next/link';
import { generateBillHTML, printBill } from '@/lib/printUtils';

const PREDEFINED_PRICES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];

export default function SettlementsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: '',
    date_from: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of current month
    date_to: new Date().toISOString().split('T')[0], // Today
  });

  // Advance States
  const [pendingAdvances, setPendingAdvances] = useState<Advance[]>([]);
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState<Set<string>>(new Set());

  // GST States
  const [gstRateType, setGstRateType] = useState('18%');
  const [customGstRate, setCustomGstRate] = useState<number>(0);

  // UI States
  const [showVanStock, setShowVanStock] = useState(false);

  const [vanStockQty, setVanStockQty] = useState<{ [price: number]: number }>({});
  const [customVanStock, setCustomVanStock] = useState<{ id: number, price: number | '', pieces: number | '' }[]>([
    { id: Date.now(), price: '', pieces: '' }
  ]);
  
  const [totalSupplied, setTotalSupplied] = useState<number>(0);
  const [totalReceived, setTotalReceived] = useState<number>(0);
  const [lastSettlementDate, setLastSettlementDate] = useState<string | null>(null);
  const [lastSettlementBalance, setLastSettlementBalance] = useState<number>(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceAdjusted, setOpeningBalanceAdjusted] = useState<boolean>(false);
  
  const [periodBills, setPeriodBills] = useState<any[]>([]);
  const [periodPayments, setPeriodPayments] = useState<any[]>([]);
  const [billsExpanded, setBillsExpanded] = useState(false);

  // New Feature States
  const [returnBillGenerating, setReturnBillGenerating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalType, setPaymentModalType] = useState<'receive' | 'give'>('receive');
  const [quickPaymentFormData, setQuickPaymentFormData] = useState({ amount: '', mode: 'cash' as 'cash' | 'upi', note: '' });
  const [showClearHisaabModal, setShowClearHisaabModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.vendor_id && formData.date_from && formData.date_to) {
      fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
    } else {
      setTotalSupplied(0);
      setTotalReceived(0);
      setLastSettlementDate(null);
    }
  }, [formData.vendor_id, formData.date_from, formData.date_to]);

  useEffect(() => {
    if (formData.vendor_id) {
      fetchPendingAdvances(formData.vendor_id);
    } else {
      setPendingAdvances([]);
      setSelectedAdvanceIds(new Set());
    }
  }, [formData.vendor_id]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [vendorsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('active', true),
      supabase.from('app_settings').select('*')
    ]);

    if ((vendorsRes as any).error && (vendorsRes as any).error.message.includes('active')) {
       const fallbackRes = await supabase.from('vendors').select('id, name, type').eq('is_active', true);
       if (fallbackRes.data) setVendors(fallbackRes.data as Vendor[]);
    } else if ((vendorsRes as any).data) {
       setVendors((vendorsRes as any).data as Vendor[]);
    }
    
    // Initialize van stock qtys
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
      
    if (data) {
      setPendingAdvances(data as Advance[]);
      setSelectedAdvanceIds(new Set(data.map((a: any) => a.id)));
    }
  };

  const fetchAggregates = async (vendor_id: string, from: string, to: string) => {
    // Fetch last settlement
    const { data: rawLastSettlement } = await (supabase as any)
      .from('settlements')
      .select('final_balance, date_to, created_at')
      .eq('vendor_id', vendor_id)
      .order('date_to', { ascending: false })
      .limit(1)
      .single();
    const lastSettlement = rawLastSettlement as { final_balance: number; date_to: string; created_at: string } | null;

    if (lastSettlement) {
      setLastSettlementDate(new Date(lastSettlement.created_at).toLocaleDateString());
      const balance = lastSettlement.final_balance || 0;
      setLastSettlementBalance(balance);
      
      if (balance > 0) {
        setOpeningBalance(balance);
      } else {
        setOpeningBalance(0);
        setOpeningBalanceAdjusted(false);
      }
    } else {
      setLastSettlementDate('Never');
      setLastSettlementBalance(0);
      setOpeningBalance(0);
      setOpeningBalanceAdjusted(false);
    }

    // Fetch Total Supplied
    const { data: billsData } = await supabase
      .from('bills')
      .select('id, bill_number, date, grand_total')
      .eq('vendor_id', vendor_id)
      .gte('date', from)
      .lte('date', to)
      .eq('is_deleted', false)
      .order('date', { ascending: true });
    
    let suppliedSum = 0;
    if (billsData) {
      suppliedSum = billsData.reduce((acc: number, curr: any) => acc + (Number(curr.grand_total) || 0), 0);
      setPeriodBills(billsData);
    } else {
      setPeriodBills([]);
    }
    setTotalSupplied(suppliedSum);

    // Fetch Total Received
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('date, total_received')
      .eq('vendor_id', vendor_id)
      .gte('date', from)
      .lte('date', to)
      .eq('is_deleted', false);
    
    let receivedSum = 0;
    if (paymentsData) {
      receivedSum = paymentsData.reduce((acc: number, curr: any) => acc + (Number(curr.total_received) || 0), 0);
      setPeriodPayments(paymentsData);
    } else {
      setPeriodPayments([]);
    }
    setTotalReceived(receivedSum);
  };

  // Calculations
  const vanStockPredefinedTotal = PREDEFINED_PRICES.reduce((sum, price) => {
    return sum + ((vanStockQty[price] || 0) * price);
  }, 0);

  const vanStockCustomTotal = customVanStock.reduce((sum, item) => {
    return sum + ((Number(item.price) || 0) * (Number(item.pieces) || 0));
  }, 0);

  const vanStockTotal = vanStockPredefinedTotal + vanStockCustomTotal;
  
  const advanceAmount = pendingAdvances
    .filter(a => selectedAdvanceIds.has(a.id))
    .reduce((sum, a) => sum + a.amount, 0);
  
  // GST Calculations
  const selectedVendor = vendors.find(v => v.id === formData.vendor_id);
  const isVendorType = selectedVendor?.type === 'vendor';
  
  let gstRate = 0;
  if (isVendorType) {
    if (gstRateType === '12%') gstRate = 12;
    else if (gstRateType === '18%') gstRate = 18;
    else if (gstRateType === 'Custom') gstRate = Number(customGstRate) || 0;
  }
  
  const taxableAmount = totalSupplied - vanStockTotal;
  const gstAmount = isVendorType && taxableAmount > 0 ? Math.round(taxableAmount * (gstRate / (100 + gstRate))) : 0;
  const totalSuppliedAfterGst = totalSupplied - gstAmount;
  
  // New Final Balance Logic
  // final_balance = total_supplied - van_stock_value - gst_amount - totalReceived + advance_amount + opening_balance
  const finalBalance = totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount + openingBalance;

  const handleSave = async (printAfter: boolean) => {
    if (!formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }

    setSaving(true);
    
    // Build JSON for van stock
    const vanStockDetail: { price: number, pieces: number, total: number }[] = [];
    PREDEFINED_PRICES.forEach(price => {
      const pieces = vanStockQty[price] || 0;
      if (pieces > 0) {
        vanStockDetail.push({ price, pieces, total: price * pieces });
      }
    });

    customVanStock.forEach(item => {
      const p = Number(item.price) || 0;
      const pcs = Number(item.pieces) || 0;
      if (p > 0 && pcs > 0) {
        vanStockDetail.push({ price: p, pieces: pcs, total: p * pcs });
      }
    });

    // Check if table has advance_amount first to gracefully fallback
    const { data: probeData, error: probeError } = await supabase.from('settlements').select('advance_amount').limit(1);
    const hasAdvanceAmountColumn = !probeError || !probeError.message.includes('Could not find the');
    
    const payload: any = {
      vendor_id: formData.vendor_id,
      date_from: formData.date_from,
      date_to: formData.date_to,
      total_supplied: Math.round(totalSupplied),
      total_received: Math.round(totalReceived),
      van_stock_value: Math.round(vanStockTotal),
      final_balance: Math.round(finalBalance),
      van_stock_detail: vanStockDetail,
      gst_rate: gstRate,
      gst_amount: Math.round(gstAmount),
      opening_balance: Math.round(openingBalance),
      opening_balance_adjusted: openingBalanceAdjusted
    };

    if (hasAdvanceAmountColumn) {
      payload.advance_amount = Math.round(advanceAmount);
    } else if (advanceAmount > 0) {
      toast.error("advance_amount column missing in DB. Please run ALTER TABLE settlements ADD COLUMN advance_amount integer DEFAULT 0;");
      setSaving(false);
      return;
    }

    const { error } = await (supabase as any).from('settlements').insert([payload]);

    if (error) {
      setSaving(false);
      if (error.message.includes('advance_amount')) {
         toast.error("Database schema out of date. Please run: ALTER TABLE settlements ADD COLUMN advance_amount integer DEFAULT 0;");
      } else {
         toast.error("Error saving settlement: " + error.message);
      }
      return;
    }

    // Mark selected advances as used
    if (selectedAdvanceIds.size > 0) {
      const idsArray = Array.from(selectedAdvanceIds);
      await (supabase as any).from('vendor_advances').update({ used_in_settlement: true }).in('id', idsArray);
    }

    setSaving(false);
    toast.success("Settlement saved successfully!");
    
    if (printAfter) {
      window.print();
    }

    // Reset Form
    setFormData({ ...formData, vendor_id: '' });
    const resetQtys: { [price: number]: number } = {};
    PREDEFINED_PRICES.forEach(p => resetQtys[p] = 0);
    setVanStockQty(resetQtys);
    setCustomVanStock([{ id: Date.now(), price: '', pieces: '' }]);
    setShowVanStock(false);
    setGstRateType('18%');
    setCustomGstRate(0);
    setPendingAdvances([]);
    setSelectedAdvanceIds(new Set());
  };

  const handleGenerateReturnBill = async () => {
    if (!formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }
    
    // Collect all van stock items > 0
    const items: any[] = [];
    PREDEFINED_PRICES.forEach(price => {
      const qty = vanStockQty[price] || 0;
      if (qty > 0) {
        items.push({
          product_name: `Rs.${price} Item`,
          piece_qty: qty,
          box_qty: 0,
          price_per_piece: price,
          line_total: qty * price
        });
      }
    });
    
    customVanStock.forEach(item => {
      const p = Number(item.price) || 0;
      const pcs = Number(item.pieces) || 0;
      if (p > 0 && pcs > 0) {
        items.push({
          product_name: `Rs.${p} Item (Custom)`,
          piece_qty: pcs,
          box_qty: 0,
          price_per_piece: p,
          line_total: p * pcs
        });
      }
    });

    if (items.length === 0) {
      toast.error("No van stock entered to generate a bill.");
      return;
    }

    setReturnBillGenerating(true);
    try {
      let newBillNum = 1;
      const { data: numData } = await (supabase as any).from('app_settings').select('value').eq('key', 'last_simple_bill_number').single();
      if (numData && numData.value) {
        newBillNum = Number(numData.value) + 1;
        await (supabase as any).from('app_settings').update({ value: String(newBillNum) }).eq('key', 'last_simple_bill_number');
      } else {
        await (supabase as any).from('app_settings').insert([{ key: 'last_simple_bill_number', value: '1' }]);
      }
      
      const year = new Date().getFullYear();
      const billNumber = `SST-${year}-${String(newBillNum).padStart(3, '0')}`;
      
      const billTotal = items.reduce((sum, item) => sum + item.line_total, 0);

      const billPayload = {
        vendor_id: formData.vendor_id,
        date: new Date().toISOString().split('T')[0],
        bill_number: billNumber,
        items: items,
        grand_total: billTotal,
        subtotal: billTotal,
        discount_amount: 0,
        gst_amount: 0,
        bill_type: 'simple',
        vendor_name: vendors.find(v => v.id === formData.vendor_id)?.name || 'Vendor'
      };

      const { data: insertedBill, error } = await (supabase as any).from('bills').insert([billPayload]).select().single();
      
      if (error) throw error;
      
      toast.success(`Return Bill ${billNumber} generated!`);
      
      const html = generateBillHTML(insertedBill, appSetting, 'shopkeeper', true);
      printBill(html);
      
    } catch (err: any) {
      toast.error("Failed to generate bill: " + err.message);
    } finally {
      setReturnBillGenerating(false);
    }
  };

  const handleQuickPaymentSubmit = async () => {
    if (!quickPaymentFormData.amount || Number(quickPaymentFormData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setActionLoading(true);
    try {
      const amt = Number(quickPaymentFormData.amount);
      const isGive = paymentModalType === 'give';
      const finalTotal = isGive ? -amt : amt;
      
      const payload: any = {
        vendor_id: formData.vendor_id,
        date: new Date().toISOString().split('T')[0],
        cash_amount: quickPaymentFormData.mode === 'cash' ? finalTotal : 0,
        upi_amount: quickPaymentFormData.mode === 'upi' ? finalTotal : 0,
        total_received: finalTotal,
        outstanding: 0,
        bill_ids: [],
        note: quickPaymentFormData.note
      };

      const { error } = await (supabase as any).from('payments').insert([payload]);
      if (error) {
        if (error.message.includes('note')) {
           const fallbackPayload = { ...payload };
           delete fallbackPayload.note;
           const fallbackRes = await (supabase as any).from('payments').insert([fallbackPayload]);
           if (fallbackRes.error) throw fallbackRes.error;
        } else {
           throw error;
        }
      }
      
      toast.success(`Money ${isGive ? 'Given' : 'Received'} successfully`);
      setShowPaymentModal(false);
      setQuickPaymentFormData({ amount: '', mode: 'cash', note: '' });
      fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
    } catch (err: any) {
      toast.error("Payment failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearHisaabSubmit = async () => {
    setActionLoading(true);
    try {
      // Create payload dynamically without 'notes' column first if it might not exist, but let's try with notes.
      const payloadSettlement: any = {
        vendor_id: formData.vendor_id,
        date_from: lastSettlementDate && lastSettlementDate !== 'Never' ? new Date(lastSettlementDate).toISOString().split('T')[0] : formData.date_from,
        date_to: new Date().toISOString().split('T')[0],
        total_supplied: Math.round(totalSupplied),
        total_received: Math.round(totalReceived),
        van_stock_value: Math.round(vanStockTotal),
        final_balance: 0,
        van_stock_detail: [],
        gst_rate: 0,
        gst_amount: 0,
        opening_balance: 0,
        opening_balance_adjusted: false,
        notes: `Hisaab cleared on ${new Date().toLocaleDateString()}`
      };
      
      const { error: sErr } = await (supabase as any).from('settlements').insert([payloadSettlement]);
      if (sErr) {
         if (sErr.message.includes('notes')) {
            const fallbackS = { ...payloadSettlement };
            delete fallbackS.notes;
            const { error: sErr2 } = await (supabase as any).from('settlements').insert([fallbackS]);
            if (sErr2) throw sErr2;
         } else {
            throw sErr;
         }
      }
      
      if (finalBalance !== 0) {
        const pPayload: any = {
          vendor_id: formData.vendor_id,
          date: new Date().toISOString().split('T')[0],
          cash_amount: finalBalance,
          upi_amount: 0,
          total_received: finalBalance,
          outstanding: 0,
          bill_ids: [],
          note: 'Clear Hisaab Adjustment'
        };
        const { error: pErr } = await (supabase as any).from('payments').insert([pPayload]);
        if (pErr) {
          if (pErr.message.includes('note')) {
            const fallback = { ...pPayload };
            delete fallback.note;
            const { error: pErr2 } = await (supabase as any).from('payments').insert([fallback]);
            if (pErr2) throw pErr2;
          } else {
             throw pErr;
          }
        }
      }
      
      toast.success("Hisaab cleared successfully");
      setShowClearHisaabModal(false);
      fetchAggregates(formData.vendor_id, formData.date_from, formData.date_to);
    } catch (err: any) {
      toast.error("Failed to clear hisaab: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
        <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg print:hidden h-full overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Settlements</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Reconcile billing vs collections.</p>
          </div>
          <Link 
            href="/settlements/history"
            className="flex items-center justify-center gap-xs px-lg py-sm bg-surface-container-low border border-outline-variant text-on-surface hover:bg-surface-container transition-colors rounded-xl font-medium shadow-sm w-full sm:w-auto"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Past Settlements
          </Link>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg animate-fade-in max-w-4xl mx-auto w-full mb-xl">
          {/* Header Stats */}
          {lastSettlementDate && formData.vendor_id && (
            <div className="bg-primary/10 px-md py-sm rounded-xl inline-flex max-w-fit animate-fade-in">
              <span className="font-label-md text-primary">Last Settlement: <span className="font-bold">{lastSettlementDate}</span></span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date From *</label>
              <input
                type="date"
                value={formData.date_from}
                onChange={(e) => setFormData({...formData, date_from: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date To *</label>
              <input
                type="date"
                value={formData.date_to}
                onChange={(e) => setFormData({...formData, date_to: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Aggregates Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md items-center bg-surface-container-low p-lg rounded-2xl border border-outline-variant">
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant uppercase tracking-wider mb-1">Total Supplied (Bills)</span>
              <span className="font-headline-md text-on-surface font-bold">₹{totalSupplied.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant uppercase tracking-wider mb-1">Total Received (Payments)</span>
              <span className="font-headline-md text-primary font-bold">₹{totalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
          </div>
          
          {/* Opening Balance Carry Forward */}
          {formData.vendor_id && lastSettlementBalance !== 0 && (
            <div className={`p-md rounded-2xl border shadow-sm ${lastSettlementBalance > 0 ? 'bg-error/5 border-error/20' : 'bg-[#166534]/5 border-[#166534]/20'}`}>
              {lastSettlementBalance > 0 ? (
                <div className="flex items-center gap-sm text-error">
                  <span className="font-bold">📋 Pichla baaki: ₹{lastSettlementBalance.toLocaleString('en-IN')} (vendor pe tha)</span>
                </div>
              ) : (
                <div className="flex flex-col gap-sm">
                  <div className="flex items-center gap-sm text-[#166534]">
                    <span className="font-bold">📋 Pichla balance: ₹{Math.abs(lastSettlementBalance).toLocaleString('en-IN')} (aap vendor ko dete the)</span>
                  </div>
                  <div className="flex gap-md mt-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="opening_balance" 
                        checked={openingBalanceAdjusted} 
                        onChange={() => {
                          setOpeningBalanceAdjusted(true);
                          setOpeningBalance(lastSettlementBalance);
                        }} 
                        className="w-4 h-4 text-primary focus:ring-primary" 
                      />
                      <span className="text-sm font-medium">✓ Is baar minus kar do</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="opening_balance" 
                        checked={!openingBalanceAdjusted} 
                        onChange={() => {
                          setOpeningBalanceAdjusted(false);
                          setOpeningBalance(0);
                        }} 
                        className="w-4 h-4 text-primary focus:ring-primary" 
                      />
                      <span className="text-sm font-medium">Baad mein lenge</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Pending Advances Section */}
          {formData.vendor_id && (
            <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col gap-sm">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs">Pending Advances</h3>
              {pendingAdvances.length === 0 ? (
                <p className="text-on-surface-variant text-sm py-2">No pending advances for this vendor.</p>
              ) : (
                <div className="flex flex-col gap-sm max-h-[200px] overflow-y-auto pr-2">
                  {pendingAdvances.map(adv => (
                    <label key={adv.id} className="flex items-center gap-md p-sm bg-surface rounded-xl border border-outline-variant/50 cursor-pointer hover:bg-surface-container-low transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedAdvanceIds.has(adv.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAdvanceIds);
                          if (e.target.checked) newSet.add(adv.id);
                          else newSet.delete(adv.id);
                          setSelectedAdvanceIds(newSet);
                        }}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium text-on-surface">{adv.date}</span>
                        {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                      </div>
                      <span className="font-bold text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                  <div className="text-right font-bold text-error mt-xs pt-xs border-t border-outline-variant/30">
                    Total Selected Advances: ₹{advanceAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GST Adjustment for Vendors */}
          {isVendorType && (
            <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col gap-sm">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs">GST Adjustment (Annual)</h3>
              <div className="flex flex-col sm:flex-row gap-md sm:items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-body-md text-on-surface-variant">GST Rate:</span>
                  <div className="flex gap-2">
                     <button onClick={() => setGstRateType('12%')} className={`px-sm py-xs font-label-md rounded-lg transition-colors border ${gstRateType === '12%' ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>12%</button>
                     <button onClick={() => setGstRateType('18%')} className={`px-sm py-xs font-label-md rounded-lg transition-colors border ${gstRateType === '18%' ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>18%</button>
                     <button onClick={() => setGstRateType('Custom')} className={`px-sm py-xs font-label-md rounded-lg transition-colors border ${gstRateType === 'Custom' ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}>Manual</button>
                  </div>
                  {gstRateType === 'Custom' && (
                    <input type="number" value={customGstRate} onChange={e => setCustomGstRate(Number(e.target.value))} className="w-20 px-sm py-xs bg-surface border border-outline-variant rounded-lg font-body-md text-[16px] focus:border-primary focus:outline-none" placeholder="%"/>
                  )}
                </div>
              </div>
              <div className="mt-sm bg-surface-container-low p-md rounded-xl border border-outline-variant flex flex-col sm:flex-row sm:justify-between gap-md items-start sm:items-center">
                 <div className="flex flex-col">
                    <span className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Calculation</span>
                     <div className="flex items-center gap-md mt-1">
                       <span className="font-medium text-on-surface">Total: ₹{totalSupplied.toLocaleString('en-IN')}</span>
                       <span className="font-medium text-on-surface">- Van Stock: ₹{vanStockTotal.toLocaleString('en-IN')}</span>
                       <span className="font-bold text-[#166534]">- GST ({gstRate}%): ₹{gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                 </div>
                 <div className="flex flex-col sm:items-end">
                    <span className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">After GST</span>
                    <span className="font-headline-sm text-primary font-bold">₹{totalSuppliedAfterGst.toLocaleString('en-IN')}</span>
                 </div>
              </div>
            </div>
          )}

          {/* Bills in This Period Section */}
          {periodBills.length > 0 && (
            <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden mb-6 shadow-sm">
              <button 
                onClick={() => setBillsExpanded(!billsExpanded)}
                className="w-full flex items-center justify-between p-md bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
              >
                <h3 className="font-headline-sm text-on-surface">
                  📋 Bills in This Period ({periodBills.length} bills) {billsExpanded ? '▲' : '▼'}
                </h3>
              </button>
              {billsExpanded && (
                <div className="p-md border-t border-outline-variant bg-surface overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="px-md py-sm font-label-md text-on-surface-variant">Bill No.</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant">Date</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Amount</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Payment Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                      {(() => {
                        const paymentsByDate: Record<string, number> = {};
                        periodPayments.forEach(p => {
                          const d = p.date;
                          paymentsByDate[d] = (paymentsByDate[d] || 0) + Number(p.total_received);
                        });

                        const renderedPaymentDates = new Set<string>();

                        return periodBills.map(bill => {
                          let paymentStr = '-';
                          if (paymentsByDate[bill.date] && !renderedPaymentDates.has(bill.date)) {
                            paymentStr = `₹${paymentsByDate[bill.date].toLocaleString('en-IN')}`;
                            renderedPaymentDates.add(bill.date);
                          }

                          return (
                            <tr key={bill.id} className="hover:bg-surface-container-low transition-colors">
                              <td className="px-md py-sm font-body-md text-on-surface">{bill.bill_number}</td>
                              <td className="px-md py-sm font-body-md text-on-surface">{new Date(bill.date).toLocaleDateString('en-IN')}</td>
                              <td className="px-md py-sm font-body-md text-on-surface text-right">₹{Number(bill.grand_total).toLocaleString('en-IN')}</td>
                              <td className="px-md py-sm font-body-md text-right font-medium" style={{ color: '#2E7D32' }}>{paymentStr}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-outline-variant">
                        <td colSpan={2} className="px-md py-sm font-headline-sm text-on-surface font-bold">Total</td>
                        <td className="px-md py-sm font-headline-sm text-on-surface text-right font-bold">
                          ₹{periodBills.reduce((acc, curr) => acc + (Number(curr.grand_total) || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-md py-sm font-headline-sm text-right font-bold" style={{ color: '#2E7D32' }}>
                          ₹{periodPayments.reduce((acc, curr) => acc + (Number(curr.total_received) || 0), 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Van Stock Section (Collapsible) */}
          <div className="border border-outline-variant rounded-2xl bg-surface-container-lowest overflow-hidden">
            <button 
              onClick={() => setShowVanStock(!showVanStock)}
              className="w-full p-md flex justify-between items-center bg-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-xs sm:gap-md">
                 <span className="font-headline-sm text-on-surface">Van Stock Entry</span>
                 {vanStockTotal > 0 && (
                    <span className="bg-[#166534]/10 text-[#166534] px-xs py-1 rounded-md text-sm font-medium">₹{vanStockTotal.toLocaleString('en-IN')} Deducted</span>
                 )}
              </div>
              <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300" style={{ transform: showVanStock ? 'rotate(180deg)' : '' }}>expand_more</span>
            </button>
            
            {showVanStock && (
              <div className="p-md border-t border-outline-variant bg-surface-container-lowest animate-fade-in">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-md max-h-[300px] overflow-y-auto p-xs">
                  {PREDEFINED_PRICES.map(price => {
                    const qty = vanStockQty[price] || 0;
                    const rowTotal = price * qty;
                    return (
                      <div key={price} className="flex flex-col items-center justify-center p-sm border border-outline-variant/60 rounded-xl bg-surface hover:border-primary/50 transition-colors shadow-sm">
                        <label className="font-headline-sm text-primary font-bold">₹{price}</label>
                        <input
                          type="number" min="0" value={vanStockQty[price] || ''}
                          onChange={(e) => setVanStockQty({...vanStockQty, [price]: e.target.value ? Number(e.target.value) : 0})}
                          className="w-full max-w-[70px] text-center px-xs py-xs mt-xs bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-[16px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          placeholder="Qty"
                        />
                        <span className="font-body-sm text-on-surface-variant mt-1 text-xs">= ₹{rowTotal}</span>
                      </div>
                    );
                  })}
                  
                  {/* Custom Input */}
                  {customVanStock.map((item, index) => {
                    const rowTotal = (Number(item.price) || 0) * (Number(item.pieces) || 0);
                    return (
                      <div key={item.id} className="flex flex-col items-center justify-center p-sm border border-outline-variant/60 rounded-xl bg-surface-container-low relative group shadow-sm col-span-2 sm:col-span-1">
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
                            className="w-full max-w-[60px] text-center px-xs py-xs bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-[16px]"
                          />
                        </div>
                        <input 
                          type="number" placeholder="Qty" value={item.pieces} 
                          onChange={(e) => {
                            const newStock = [...customVanStock];
                            newStock[index].pieces = e.target.value ? Number(e.target.value) : '';
                            setCustomVanStock(newStock);
                          }}
                          className="w-full max-w-[70px] text-center px-xs py-xs mt-xs bg-surface-container-lowest border border-outline-variant rounded-lg font-body-sm text-[16px]"
                        />
                        <span className="font-body-sm text-on-surface-variant mt-1 text-xs">= ₹{rowTotal}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center p-sm border border-dashed border-outline-variant rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors col-span-2 sm:col-span-1" onClick={() => setCustomVanStock([...customVanStock, { id: Date.now(), price: '', pieces: '' }])}>
                    <span className="text-primary font-label-md flex flex-col items-center text-center">
                      <span className="material-symbols-outlined mb-1 text-[20px]">add</span> Custom
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-sm pt-sm border-t border-outline-variant">
                  <button 
                    onClick={handleGenerateReturnBill}
                    disabled={returnBillGenerating || vanStockTotal === 0}
                    className="flex items-center gap-xs px-sm py-xs bg-primary/10 text-primary font-label-md rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                    {returnBillGenerating ? 'Generating...' : 'Return Bill'}
                  </button>
                  <div className="flex items-center">
                    <span className="font-body-md text-on-surface-variant mr-sm flex items-center">Total:</span>
                    <span className="font-headline-sm text-error font-bold">₹{vanStockTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Final Balance */}
          <div className={`flex flex-col border p-xl rounded-2xl gap-md shadow-sm transition-colors ${finalBalance > 0 ? 'bg-error/5 border-error/20' : finalBalance < 0 ? 'bg-[#166534]/5 border-[#166534]/20' : 'bg-surface-variant/30 border-outline-variant/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Final Balance Result</span>
              {finalBalance > 0 ? (
                <p className="font-headline-md text-error">Vendor pe <span className="font-bold">₹{finalBalance.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> baaki hai</p>
              ) : finalBalance < 0 ? (
                <p className="font-headline-md text-[#166534]">Aap vendor ko <span className="font-bold">₹{Math.abs(finalBalance).toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> denge</p>
              ) : (
                <p className="font-headline-md text-on-surface">Hisab barabar hai</p>
              )}
            </div>
            {/* Step-wise running total table */}
            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {/* Row 1: Total Supplied — no deduction, just the starting amount */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: '14px' }}>Total Supplied:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#666', width: '120px' }}></td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '14px', width: '130px' }}>
                      ₹{totalSupplied.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 2: Van Stock */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) Van Stock:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828', width: '120px' }}>
                      ₹{vanStockTotal.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666', width: '130px' }}>
                      = ₹{(totalSupplied - vanStockTotal).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 3: GST (only for vendors) */}
                  {isVendorType && (
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                      <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) GST ({gstRate}%):</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828', width: '120px' }}>
                        ₹{gstAmount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666', width: '130px' }}>
                        = ₹{(totalSupplied - vanStockTotal - gstAmount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                  {/* Row 4: Received */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) Received:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828', width: '120px' }}>
                      ₹{totalReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666', width: '130px' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 5: Advance */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(+) Advance:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#2e7d32', width: '120px' }}>
                      ₹{advanceAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666', width: '130px' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 6: Pichla baaki */}
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(+/-) Pichla:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: openingBalance >= 0 ? '#2e7d32' : '#c62828', width: '120px' }}>
                      {openingBalance >= 0 ? '' : '-'}₹{Math.abs(openingBalance).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666', width: '130px' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount + openingBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Net Balance row */}
                  <tr style={{ background: finalBalance > 0 ? 'rgba(211,47,47,0.06)' : finalBalance < 0 ? 'rgba(22,101,52,0.06)' : 'rgba(0,0,0,0.03)' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: '15px', color: finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000' }}>
                      Net Balance:
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '16px', color: finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000', width: '130px' }}>
                      ₹{Math.abs(finalBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-md mt-sm w-full">
            <div className="flex flex-wrap gap-sm">
              <button
                onClick={() => { setPaymentModalType('receive'); setShowPaymentModal(true); }}
                disabled={!formData.vendor_id}
                className="flex items-center justify-center gap-xs px-md py-sm bg-[#166534] text-white font-label-md rounded-xl hover:bg-[#166534]/90 transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">payments</span> Receive Money
              </button>
              <button
                onClick={() => { setPaymentModalType('give'); setShowPaymentModal(true); }}
                disabled={!formData.vendor_id}
                className="flex items-center justify-center gap-xs px-md py-sm bg-error text-white font-label-md rounded-xl hover:bg-error/90 transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">outbox</span> Give Money
              </button>
              <button
                onClick={() => setShowClearHisaabModal(true)}
                disabled={!formData.vendor_id || finalBalance === 0}
                className="flex items-center justify-center gap-xs px-md py-sm bg-indigo-600 text-white font-label-md rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span> Clear Hisaab
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-md">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-xs px-xl py-md border border-primary text-primary font-label-md rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-xs px-xl py-md bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">print</span> {saving ? 'Saving...' : 'Save & Print'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Payment History Section (Desktop) */}
        {formData.vendor_id && periodPayments.length > 0 && (
          <div className="max-w-4xl mx-auto w-full mb-xl grid grid-cols-1 md:grid-cols-2 gap-md animate-fade-in">
            <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs mb-sm">Money Received</h3>
              <div className="flex flex-col gap-sm max-h-[300px] overflow-y-auto">
                {periodPayments.filter(p => Number(p.total_received) > 0).length === 0 ? (
                   <p className="text-on-surface-variant text-sm py-2">No money received in this period.</p>
                ) : (
                   periodPayments.filter(p => Number(p.total_received) > 0).map((p, idx) => (
                     <div key={idx} className="flex flex-col p-sm bg-surface rounded-xl border border-outline-variant/50">
                       <div className="flex justify-between items-center">
                         <span className="font-medium text-on-surface">{new Date(p.date).toLocaleDateString()}</span>
                         <span className="font-bold text-[#166534]">₹{Number(p.total_received).toLocaleString('en-IN')}</span>
                       </div>
                       {(p.note || p.cash_amount > 0 || p.upi_amount > 0) && (
                         <div className="text-xs text-on-surface-variant mt-1">
                           {p.cash_amount > 0 && <span className="mr-2">Cash</span>}
                           {p.upi_amount > 0 && <span className="mr-2">UPI</span>}
                           {p.note && <span>• {p.note}</span>}
                         </div>
                       )}
                     </div>
                   ))
                )}
              </div>
            </div>
            
            <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs mb-sm">Money Given</h3>
              <div className="flex flex-col gap-sm max-h-[300px] overflow-y-auto">
                {periodPayments.filter(p => Number(p.total_received) < 0).length === 0 ? (
                   <p className="text-on-surface-variant text-sm py-2">No money given in this period.</p>
                ) : (
                   periodPayments.filter(p => Number(p.total_received) < 0).map((p, idx) => (
                     <div key={idx} className="flex flex-col p-sm bg-surface rounded-xl border border-outline-variant/50">
                       <div className="flex justify-between items-center">
                         <span className="font-medium text-on-surface">{new Date(p.date).toLocaleDateString()}</span>
                         <span className="font-bold text-error">₹{Math.abs(Number(p.total_received)).toLocaleString('en-IN')}</span>
                       </div>
                       {p.note && (
                         <div className="text-xs text-on-surface-variant mt-1">{p.note}</div>
                       )}
                     </div>
                   ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col overflow-x-hidden">
        {/* TopAppBar */}
        <header className="sticky top-0 border-b border-outline-variant shadow-sm flex items-center justify-between p-4 w-full z-50 bg-surface transition-colors duration-200">
          <button onClick={() => window.history.back()} className="flex items-center justify-center text-primary active:bg-surface-container-high rounded-full transition-colors duration-200">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="font-title-main text-[18px] font-bold text-primary">Settlement</h1>
          <div className="w-6"></div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 px-[16px] py-[12px] flex flex-col gap-[12px] pb-[140px]">
          {/* Vendor Select */}
          <div className="flex flex-col gap-1 relative">
            <label className="font-label-caption text-[14px] text-on-surface-variant">Vendor</label>
            <div className="relative">
              <select 
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
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

          {/* Date Range Pickers Side-by-Side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-label-caption text-[14px] text-on-surface-variant">From Date</label>
              <input 
                type="date" 
                value={formData.date_from}
                onChange={(e) => setFormData({...formData, date_from: e.target.value})}
                className="w-full h-[48px] border border-outline-variant rounded px-3 font-body-standard text-[16px] text-on-surface bg-surface focus:outline-none focus:border-2 focus:border-primary focus:ring-0" 
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caption text-[14px] text-on-surface-variant">To Date</label>
              <input 
                type="date" 
                value={formData.date_to}
                onChange={(e) => setFormData({...formData, date_to: e.target.value})}
                className="w-full h-[48px] border border-outline-variant rounded px-3 font-body-standard text-[16px] text-on-surface bg-surface focus:outline-none focus:border-2 focus:border-primary focus:ring-0" 
              />
            </div>
          </div>

          {/* Summary Cards (Bento style) */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-surface rounded-lg p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col gap-1 border border-outline-variant/30 relative overflow-hidden">
              <div className="absolute -right-2 -top-2 w-16 h-16 bg-primary-container/10 rounded-full blur-xl pointer-events-none"></div>
              <span className="font-label-caption text-[14px] text-on-surface-variant">Total Supplied</span>
              <span className="font-rupee-currency text-[18px] font-bold text-primary">₹{totalSupplied.toLocaleString('en-IN')}</span>
              <span className="material-symbols-outlined absolute top-3 right-3 text-primary/40 text-[20px]">local_shipping</span>
            </div>
            <div className="bg-surface rounded-lg p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col gap-1 border border-outline-variant/30 relative overflow-hidden">
              <div className="absolute -right-2 -top-2 w-16 h-16 bg-secondary-container/30 rounded-full blur-xl pointer-events-none"></div>
              <span className="font-label-caption text-[14px] text-on-surface-variant">Total Received</span>
              <span className="font-rupee-currency text-[18px] font-bold text-secondary">₹{totalReceived.toLocaleString('en-IN')}</span>
              <span className="material-symbols-outlined absolute top-3 right-3 text-secondary/40 text-[20px]">account_balance_wallet</span>
            </div>
          </div>

          
          


          {/* Pending Advances Section */}
          {formData.vendor_id && (
            <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col gap-sm">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs">Pending Advances</h3>
              {pendingAdvances.length === 0 ? (
                <p className="text-on-surface-variant text-sm py-2">No pending advances for this vendor.</p>
              ) : (
                <div className="flex flex-col gap-sm max-h-[200px] overflow-y-auto pr-2">
                  {pendingAdvances.map(adv => (
                    <label key={adv.id} className="flex items-center gap-md p-sm bg-surface rounded-xl border border-outline-variant/50 cursor-pointer hover:bg-surface-container-low transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedAdvanceIds.has(adv.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAdvanceIds);
                          if (e.target.checked) newSet.add(adv.id);
                          else newSet.delete(adv.id);
                          setSelectedAdvanceIds(newSet);
                        }}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium text-on-surface">{adv.date}</span>
                        {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                      </div>
                      <span className="font-bold text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                  <div className="text-right font-bold text-error mt-xs pt-xs border-t border-outline-variant/30">
                    Total Selected Advances: ₹{advanceAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Final Balance */}
          <div className={`flex flex-col border p-4 rounded-2xl gap-3 shadow-sm transition-colors ${finalBalance > 0 ? 'bg-error/5 border-error/20' : finalBalance < 0 ? 'bg-[#166534]/5 border-[#166534]/20' : 'bg-surface-variant/30 border-outline-variant/50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Final Balance Result</span>
              {finalBalance > 0 ? (
                <p className="font-headline-md text-error text-[18px]">Vendor pe <span className="font-bold">₹{finalBalance.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> baaki hai</p>
              ) : finalBalance < 0 ? (
                <p className="font-headline-md text-[#166534] text-[18px]">Aap vendor ko <span className="font-bold">₹{Math.abs(finalBalance).toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> denge</p>
              ) : (
                <p className="font-headline-md text-on-surface text-[18px]">Hisab barabar hai</p>
              )}
            </div>
            {/* Step-wise running total table */}
            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {/* Row 1: Total Supplied */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: '14px' }}>Total Supplied:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#666', width: '100px' }}></td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '14px', width: '110px' }}>
                      ₹{totalSupplied.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 2: Van Stock */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) Van Stock:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>
                      ₹{vanStockTotal.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 3: GST (only for vendors) */}
                  {isVendorType && (
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                      <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) GST ({gstRate}%):</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>
                        ₹{gstAmount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                        = ₹{(totalSupplied - vanStockTotal - gstAmount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                  {/* Row 4: Received */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) Received:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>
                      ₹{totalReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 5: Advance */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(+) Advance:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#2e7d32' }}>
                      ₹{advanceAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 6: Pichla baaki */}
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(+/-) Pichla:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: openingBalance >= 0 ? '#2e7d32' : '#c62828' }}>
                      {openingBalance >= 0 ? '' : '-'}₹{Math.abs(openingBalance).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount + openingBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Net Balance row */}
                  <tr style={{ background: finalBalance > 0 ? 'rgba(211,47,47,0.06)' : finalBalance < 0 ? 'rgba(22,101,52,0.06)' : 'rgba(0,0,0,0.03)' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: '15px', color: finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000' }}>
                      Net Balance:
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '16px', color: finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000' }}>
                      ₹{Math.abs(finalBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>


          {/* Van Stock Section */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h2 className="font-title-main text-[18px] font-bold text-on-surface">Van Stock Entry</h2>
              <span className="font-body-standard text-[14px] font-medium text-error">Total: ₹{vanStockTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex flex-col gap-3">
              {PREDEFINED_PRICES.filter(p => [10, 20, 30].includes(p)).map(price => (
                <div key={price} className="bg-surface rounded-lg p-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-outline-variant/50 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-body-standard text-[16px] font-semibold">₹{price} Items</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setVanStockQty({...vanStockQty, [price]: Math.max(0, (vanStockQty[price] || 0) - 1)})}
                      className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center active:bg-outline-variant transition-colors"
                    >
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <input 
                      type="number" 
                      value={vanStockQty[price] || ''}
                      onChange={(e) => setVanStockQty({...vanStockQty, [price]: e.target.value ? Number(e.target.value) : 0})}
                      className="w-14 h-[48px] text-center border-none bg-transparent font-value-display text-[18px] font-bold focus:ring-0 p-0" 
                    />
                    <button 
                      onClick={() => setVanStockQty({...vanStockQty, [price]: (vanStockQty[price] || 0) + 1})}
                      className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center active:bg-outline-variant transition-colors"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => setShowVanStock(!showVanStock)}
                className="w-full py-2 text-primary font-medium text-center hover:bg-primary/5 rounded"
              >
                {showVanStock ? 'Hide All Prices' : 'Show All Prices'}
              </button>
              
              {showVanStock && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {PREDEFINED_PRICES.filter(p => ![10, 20, 30].includes(p)).map(price => (
                    <div key={price} className="flex flex-col items-center justify-center p-2 border border-outline-variant/60 rounded-xl bg-surface">
                      <label className="font-bold text-primary">₹{price}</label>
                      <input
                        type="number" min="0" value={vanStockQty[price] || ''}
                        onChange={(e) => setVanStockQty({...vanStockQty, [price]: e.target.value ? Number(e.target.value) : 0})}
                        className="w-full max-w-[70px] text-center px-1 py-1 mt-1 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-[16px] focus:border-primary focus:outline-none"
                        placeholder="Qty"
                      />
                    

                  {/* Custom Input */}
                  {customVanStock.map((item, index) => {
                    const rowTotal = (Number(item.price) || 0) * (Number(item.pieces) || 0);
                    return (
                      <div key={item.id} className="flex flex-col items-center justify-center p-2 border border-outline-variant/60 rounded-xl bg-surface-container-low relative group shadow-sm col-span-3">
                        {customVanStock.length > 1 && (
                          <button 
                            onClick={() => setCustomVanStock(customVanStock.filter((_, i) => i !== index))}
                            className="absolute -top-2 -right-2 bg-error text-white rounded-full p-1 z-10"
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
                            className="w-full max-w-[60px] text-center px-1 py-1 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-[16px]"
                          />
                        </div>
                        <input 
                          type="number" placeholder="Qty" value={item.pieces} 
                          onChange={(e) => {
                            const newStock = [...customVanStock];
                            newStock[index].pieces = e.target.value ? Number(e.target.value) : '';
                            setCustomVanStock(newStock);
                          }}
                          className="w-full max-w-[70px] text-center px-1 py-1 mt-1 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-[16px]"
                        />
                        <span className="font-body-sm text-on-surface-variant mt-1 text-xs">= ₹{rowTotal}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center p-2 border border-dashed border-outline-variant rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors col-span-3" onClick={() => setCustomVanStock([...customVanStock, { id: Date.now(), price: '', pieces: '' }])}>
                    <span className="text-primary font-label-md flex flex-col items-center text-center">
                      <span className="material-symbols-outlined mb-1 text-[20px]">add</span> Custom
                    </span>
                  </div>

</div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={handleGenerateReturnBill}
              disabled={returnBillGenerating || vanStockTotal === 0}
              className="mt-2 w-full flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              {returnBillGenerating ? 'Generating...' : 'Generate Return Bill'}
            </button>
          </div>
          
          {/* Quick Actions (Mobile) */}
          <div className="mt-4 grid grid-cols-2 gap-3">
             <button
                onClick={() => { setPaymentModalType('receive'); setShowPaymentModal(true); }}
                disabled={!formData.vendor_id}
                className="flex flex-col items-center justify-center gap-1 p-3 bg-[#166534] text-white rounded-xl shadow-sm disabled:opacity-50"
             >
                <span className="material-symbols-outlined">payments</span>
                <span className="font-bold text-[13px]">Receive</span>
             </button>
             <button
                onClick={() => { setPaymentModalType('give'); setShowPaymentModal(true); }}
                disabled={!formData.vendor_id}
                className="flex flex-col items-center justify-center gap-1 p-3 bg-error text-white rounded-xl shadow-sm disabled:opacity-50"
             >
                <span className="material-symbols-outlined">outbox</span>
                <span className="font-bold text-[13px]">Give</span>
             </button>
             <button
                onClick={() => setShowClearHisaabModal(true)}
                disabled={!formData.vendor_id || finalBalance === 0}
                className="col-span-2 flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-xl shadow-sm disabled:opacity-50"
             >
                <span className="material-symbols-outlined">check_circle</span>
                <span className="font-bold text-[14px]">Clear Hisaab</span>
             </button>
          </div>

          {/* Payment History (Mobile) */}
          {formData.vendor_id && periodPayments.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {periodPayments.filter(p => Number(p.total_received) > 0).length > 0 && (
                <div>
                  <h3 className="font-title-main text-[16px] font-bold text-on-surface mb-2 border-b border-outline-variant pb-1">Money Received</h3>
                  <div className="flex flex-col gap-2">
                    {periodPayments.filter(p => Number(p.total_received) > 0).map((p, idx) => (
                      <div key={idx} className="bg-surface rounded-lg p-3 border border-outline-variant/50 shadow-sm">
                         <div className="flex justify-between items-center">
                           <span className="font-medium text-on-surface">{new Date(p.date).toLocaleDateString()}</span>
                           <span className="font-bold text-[#166534]">₹{Number(p.total_received).toLocaleString('en-IN')}</span>
                         </div>
                         {(p.note || p.cash_amount > 0 || p.upi_amount > 0) && (
                           <div className="text-xs text-on-surface-variant mt-1">
                             {p.cash_amount > 0 && <span className="mr-2">Cash</span>}
                             {p.upi_amount > 0 && <span className="mr-2">UPI</span>}
                             {p.note && <span>• {p.note}</span>}
                           </div>
                         )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {periodPayments.filter(p => Number(p.total_received) < 0).length > 0 && (
                <div>
                  <h3 className="font-title-main text-[16px] font-bold text-on-surface mb-2 border-b border-outline-variant pb-1">Money Given</h3>
                  <div className="flex flex-col gap-2">
                    {periodPayments.filter(p => Number(p.total_received) < 0).map((p, idx) => (
                      <div key={idx} className="bg-surface rounded-lg p-3 border border-outline-variant/50 shadow-sm">
                         <div className="flex justify-between items-center">
                           <span className="font-medium text-on-surface">{new Date(p.date).toLocaleDateString()}</span>
                           <span className="font-bold text-error">₹{Math.abs(Number(p.total_received)).toLocaleString('en-IN')}</span>
                         </div>
                         {p.note && (
                           <div className="text-xs text-on-surface-variant mt-1">{p.note}</div>
                         )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sticky Action Area */}
        <div className="fixed bottom-[64px] left-0 right-0 md:w-[375px] md:mx-auto bg-surface border-t border-outline-variant p-[16px] z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex gap-3">
          <button 
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 h-[48px] bg-primary text-on-primary font-body-standard text-[16px] font-semibold rounded flex items-center justify-center gap-2 active:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            {saving ? 'Saving...' : 'Save Settlement'}
          </button>
          <button 
            onClick={() => handleSave(true)}
            disabled={saving}
            className="w-[48px] h-[48px] bg-transparent border border-primary text-primary rounded flex items-center justify-center active:bg-primary-container/10 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
          </button>
        </div>
      </div>
      
      {/* MODALS (Shared across Desktop & Mobile) */}
      
      {/* Quick Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className={`p-4 ${paymentModalType === 'give' ? 'bg-error text-white' : 'bg-[#166534] text-white'} flex justify-between items-center`}>
              <h3 className="font-bold text-lg">{paymentModalType === 'give' ? 'Give Money' : 'Receive Money'}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="opacity-80 hover:opacity-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Vendor</label>
                <div className="font-bold text-lg text-on-surface">{vendors.find(v => v.id === formData.vendor_id)?.name}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                  <input 
                    type="number" 
                    value={quickPaymentFormData.amount}
                    onChange={(e) => setQuickPaymentFormData({...quickPaymentFormData, amount: e.target.value})}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-bold text-lg focus:border-primary focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Payment Mode</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setQuickPaymentFormData({...quickPaymentFormData, mode: 'cash'})}
                    className={`flex-1 py-2 rounded-lg border font-medium ${quickPaymentFormData.mode === 'cash' ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}
                  >Cash</button>
                  <button 
                    onClick={() => setQuickPaymentFormData({...quickPaymentFormData, mode: 'upi'})}
                    className={`flex-1 py-2 rounded-lg border font-medium ${quickPaymentFormData.mode === 'upi' ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-on-surface-variant'}`}
                  >UPI</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Note (Optional)</label>
                <input 
                  type="text" 
                  value={quickPaymentFormData.note}
                  onChange={(e) => setQuickPaymentFormData({...quickPaymentFormData, note: e.target.value})}
                  placeholder="e.g. Partial payment"
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-outline-variant/30 flex gap-3">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 rounded-xl border border-outline-variant font-bold text-on-surface-variant"
              >
                Cancel
              </button>
              <button 
                onClick={handleQuickPaymentSubmit}
                disabled={actionLoading || !quickPaymentFormData.amount}
                className={`flex-1 py-3 rounded-xl font-bold text-white ${paymentModalType === 'give' ? 'bg-error hover:bg-error/90' : 'bg-[#166534] hover:bg-[#166534]/90'} disabled:opacity-50`}
              >
                {actionLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Hisaab Modal */}
      {showClearHisaabModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="bg-indigo-600 text-white p-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-[48px]">check_circle</span>
              <h3 className="font-bold text-xl">Clear Hisaab?</h3>
            </div>
            <div className="p-6 text-center text-on-surface-variant">
              Are you sure you want to mark all dues as settled for 
              <strong className="text-on-surface block mt-2 text-lg">{vendors.find(v => v.id === formData.vendor_id)?.name}</strong> 
              as of today?
            </div>
            <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 flex gap-3">
              <button 
                onClick={() => setShowClearHisaabModal(false)}
                className="flex-1 py-3 rounded-xl border border-outline-variant font-bold text-on-surface-variant"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearHisaabSubmit}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? 'Clearing...' : 'Yes, Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
