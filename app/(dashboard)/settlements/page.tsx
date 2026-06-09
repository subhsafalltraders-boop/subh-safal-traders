'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, AppSetting, Advance } from '@/lib/types';
import Link from 'next/link';

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
    const { data: lastSettlement } = await supabase
      .from('settlements')
      .select('created_at')
      .eq('vendor_id', vendor_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (lastSettlement && lastSettlement.length > 0) {
      setLastSettlementDate(new Date((lastSettlement as any[])[0].created_at).toLocaleDateString());
    } else {
      setLastSettlementDate('Never');
    }

    // Fetch Total Supplied
    const { data: billsData } = await supabase
      .from('bills')
      .select('grand_total')
      .eq('vendor_id', vendor_id)
      .gte('date', from)
      .lte('date', to);
    
    let suppliedSum = 0;
    if (billsData) {
      suppliedSum = billsData.reduce((acc: number, curr: any) => acc + (Number(curr.grand_total) || 0), 0);
    }
    setTotalSupplied(suppliedSum);

    // Fetch Total Received
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('total_received')
      .eq('vendor_id', vendor_id)
      .gte('date', from)
      .lte('date', to);
    
    let receivedSum = 0;
    if (paymentsData) {
      receivedSum = paymentsData.reduce((acc: number, curr: any) => acc + (Number(curr.total_received) || 0), 0);
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
  
  const gstAmount = isVendorType ? Math.round(totalSupplied * (gstRate / (100 + gstRate))) : 0;
  const totalSuppliedAfterGst = totalSupplied - gstAmount;
  
  // New Final Balance Logic (Corrected Calculation Order)
  // final_balance = total_supplied - van_stock_value - gst_amount + advance_amount (- totalReceived)
  const finalBalance = totalSuppliedAfterGst - totalReceived - vanStockTotal + advanceAmount;

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
      total_supplied: totalSupplied,
      total_received: totalReceived,
      van_stock_value: vanStockTotal,
      final_balance: finalBalance,
      van_stock_detail: vanStockDetail,
      gst_rate: gstRate,
      gst_amount: gstAmount
    };

    if (hasAdvanceAmountColumn) {
      payload.advance_amount = advanceAmount;
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

  return (
    <>
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
                <div className="flex justify-end mt-sm pt-sm border-t border-outline-variant">
                  <span className="font-body-md text-on-surface-variant mr-sm flex items-center">Van Stock Total:</span>
                  <span className="font-headline-sm text-error font-bold">₹{vanStockTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Final Balance */}
          <div className={`flex flex-col sm:flex-row sm:justify-between items-center border p-xl rounded-2xl gap-md text-center sm:text-left shadow-sm transition-colors ${finalBalance > 0 ? 'bg-error/5 border-error/20' : finalBalance < 0 ? 'bg-[#166534]/5 border-[#166534]/20' : 'bg-surface-variant/30 border-outline-variant/50'}`}>
            <div>
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider block mb-2">Final Balance Result</span>
              {finalBalance > 0 ? (
                <p className="font-headline-md text-error">Vendor pe <span className="font-bold">₹{finalBalance.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> baaki hai</p>
              ) : finalBalance < 0 ? (
                <p className="font-headline-md text-[#166534]">Aap vendor ko <span className="font-bold">₹{Math.abs(finalBalance).toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> denge</p>
              ) : (
                <p className="font-headline-md text-on-surface">Hisab barabar hai</p>
              )}
            </div>
            <div className="text-center sm:text-right flex flex-col bg-surface p-md rounded-xl border border-outline-variant shadow-sm min-w-[200px]">
               <div className="flex justify-between text-sm text-on-surface-variant mb-1"><span>Supplied</span><span>{totalSupplied}</span></div>
               {isVendorType && gstAmount > 0 && (
                 <div className="flex justify-between text-sm text-[#166534] mb-1"><span>GST ({gstRate}%)</span><span>-{gstAmount}</span></div>
               )}
               {isVendorType && gstAmount > 0 && (
                 <div className="flex justify-between text-xs text-primary font-bold mb-1 pb-1 border-b border-outline-variant/30"><span>After GST</span><span>{totalSuppliedAfterGst}</span></div>
               )}
               <div className="flex justify-between text-sm text-[#166534] mb-1"><span>Van Stock</span><span>-{vanStockTotal}</span></div>
               <div className="flex justify-between text-sm text-[#166534] mb-1"><span>Received</span><span>-{totalReceived}</span></div>
               <div className="flex justify-between text-sm text-error pb-2 border-b border-outline-variant/50"><span>Advance Taken</span><span>+{advanceAmount}</span></div>
               <div className="flex justify-between font-bold text-lg mt-2 pt-1">
                 <span className={finalBalance > 0 ? 'text-error' : finalBalance < 0 ? 'text-[#166534]' : 'text-on-surface'}>Net Balance</span>
                 <span className={finalBalance > 0 ? 'text-error' : finalBalance < 0 ? 'text-[#166534]' : 'text-on-surface'}>₹{finalBalance}</span>
               </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-md mt-sm w-full">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-xs px-xl py-md border border-primary text-primary font-label-md rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Settlement'}
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
    </>
  );
}
