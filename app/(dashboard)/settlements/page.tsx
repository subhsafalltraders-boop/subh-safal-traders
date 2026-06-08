'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Settlement, AppSetting } from '@/lib/types';

const PREDEFINED_PRICES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];

export default function SettlementsPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: '',
    date_from: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of current month
    date_to: new Date().toISOString().split('T')[0], // Today
  });

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

  const fetchInitialData = async () => {
    setLoading(true);
    const [vendorsRes, settlementsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('is_active', true),
      supabase.from('settlements').select('*, vendors(name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('app_settings').select('*').limit(1).single()
    ]);

    if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);
    
    // Initialize van stock qtys
    const initialQtys: { [price: number]: number } = {};
    PREDEFINED_PRICES.forEach(p => initialQtys[p] = 0);
    setVanStockQty(initialQtys);

    if ((settlementsRes as any).data) setSettlements((settlementsRes as any).data as Settlement[]);
    if ((settingsRes as any).data) setAppSetting((settingsRes as any).data as AppSetting);
    setLoading(false);
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
  const finalBalance = totalSupplied - totalReceived - vanStockTotal;

  const handleSave = async (printAfter: boolean) => {
    if (!formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }

    setSaving(true);
    const vendor = vendors.find(v => v.id === formData.vendor_id);
    
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

    const payload = {
      vendor_id: formData.vendor_id,
      date_from: formData.date_from,
      date_to: formData.date_to,
      total_supplied: totalSupplied,
      total_received: totalReceived,
      van_stock_value: vanStockTotal,
      final_balance: finalBalance,
      van_stock_detail: vanStockDetail
    };

    const { error } = await (supabase as any).from('settlements').insert([payload]);

    setSaving(false);

    if (error) {
      toast.error("Error saving settlement: " + error.message);
      return;
    }

    toast.success("Settlement saved successfully!");
    fetchInitialData();

    if (printAfter) {
      window.print();
    }

    // Reset van stock
    const resetQtys: { [price: number]: number } = {};
    PREDEFINED_PRICES.forEach(p => resetQtys[p] = 0);
    setVanStockQty(resetQtys);
    setCustomVanStock([{ id: Date.now(), price: '', pieces: '' }]);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this settlement?")) {
      const { error } = await supabase.from('settlements').delete().eq('id', id);
      if (error) {
        toast.error("Failed to delete settlement");
      } else {
        toast.success("Settlement deleted successfully");
        fetchInitialData();
      }
    }
  };

  const printPastSettlement = () => {
    toast.error("In a full app, this would load the settlement state into the form and call window.print().");
  };

  return (
    <>
      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Settlements</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Reconcile billing vs collections and van stock.</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow p-xl flex flex-col gap-lg">
          {/* Header Stats */}
          {lastSettlementDate && formData.vendor_id && (
            <div className="bg-surface-container px-md py-sm rounded-lg inline-flex max-w-fit">
              <span className="font-label-md text-label-md text-on-surface-variant">Last Settlement for this Vendor: </span>
              <span className="font-label-md text-primary ml-xs font-bold">{lastSettlementDate}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
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
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date To *</label>
              <input
                type="date"
                value={formData.date_to}
                onChange={(e) => setFormData({...formData, date_to: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Aggregates Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md items-center bg-surface-container-low p-md rounded-lg border border-outline-variant">
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant uppercase tracking-wider">Total Supplied (Bills)</span>
              <span className="font-headline-md text-on-surface font-bold mt-xs">₹{totalSupplied.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-on-surface-variant uppercase tracking-wider">Total Received (Payments)</span>
              <span className="font-headline-md text-[#166534] font-bold mt-xs">₹{totalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          {/* Van Stock Section */}
          <div>
            <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs mb-md">Van Stock Details</h3>
            
            {/* Predefined Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-md">
              {PREDEFINED_PRICES.map(price => {
                const qty = vanStockQty[price] || 0;
                const rowTotal = price * qty;
                return (
                  <div key={price} className="flex flex-col gap-xs bg-surface border border-outline-variant p-sm rounded-lg hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <label className="font-headline-sm text-primary font-bold">₹{price}</label>
                      <span className="font-body-sm text-on-surface-variant bg-surface-container-low px-xs rounded">Total: ₹{rowTotal}</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="Kitne pieces?"
                      value={vanStockQty[price] || ''}
                      onChange={(e) => setVanStockQty({...vanStockQty, [price]: e.target.value ? Number(e.target.value) : 0})}
                      className="w-full px-sm py-xs mt-xs bg-surface-container-lowest border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                );
              })}
            </div>

            {/* Custom Input */}
            <div className="mt-md p-md bg-surface-container-low border border-outline-variant rounded-lg">
              <h4 className="font-label-lg text-on-surface mb-sm">Custom Amounts</h4>
              {customVanStock.map((item, index) => {
                const rowTotal = (Number(item.price) || 0) * (Number(item.pieces) || 0);
                return (
                  <div key={item.id} className="flex flex-wrap items-center gap-sm mb-sm">
                    <input 
                      type="number" 
                      placeholder="Custom ₹" 
                      value={item.price} 
                      onChange={(e) => {
                        const newStock = [...customVanStock];
                        newStock[index].price = e.target.value ? Number(e.target.value) : '';
                        setCustomVanStock(newStock);
                      }}
                      className="w-32 px-sm py-xs border border-outline-variant rounded-DEFAULT font-body-md"
                    />
                    <span className="text-on-surface-variant font-bold">×</span>
                    <input 
                      type="number" 
                      placeholder="Kitne pieces?" 
                      value={item.pieces} 
                      onChange={(e) => {
                        const newStock = [...customVanStock];
                        newStock[index].pieces = e.target.value ? Number(e.target.value) : '';
                        setCustomVanStock(newStock);
                      }}
                      className="w-36 px-sm py-xs border border-outline-variant rounded-DEFAULT font-body-md"
                    />
                    <span className="font-body-md font-bold ml-sm w-24">Total: ₹{rowTotal}</span>
                    {customVanStock.length > 1 && (
                      <button 
                        onClick={() => setCustomVanStock(customVanStock.filter((_, i) => i !== index))}
                        className="text-error hover:text-error-container"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                );
              })}
              <button 
                onClick={() => setCustomVanStock([...customVanStock, { id: Date.now(), price: '', pieces: '' }])}
                className="text-primary font-label-md hover:underline flex items-center gap-xs mt-xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> Add Custom ₹
              </button>
            </div>

            <div className="flex justify-end mt-md pt-sm border-t border-outline-variant">
              <span className="font-body-lg text-on-surface-variant mr-sm">Total Van Stock Value:</span>
              <span className="font-headline-lg text-primary font-bold">₹{vanStockTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          {/* Final Balance */}
          <div className="flex flex-col sm:flex-row sm:justify-between items-center bg-[#F1F5F9] border border-outline-variant p-lg rounded-lg mt-md gap-md text-center sm:text-left">
            <div>
              <span className="font-headline-sm text-on-surface uppercase tracking-wider block">Final Balance</span>
              {finalBalance > 0 ? (
                <p className="font-headline-sm text-error mt-2">Vendor pe ₹{finalBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})} baaki hai</p>
              ) : finalBalance < 0 ? (
                <p className="font-headline-sm text-[#166534] mt-2">Aap vendor ko ₹{Math.abs(finalBalance).toLocaleString('en-IN', {minimumFractionDigits: 2})} denge</p>
              ) : (
                <p className="font-headline-sm text-on-surface-variant mt-2">Hisab barabar hai</p>
              )}
            </div>
            <div className="text-right">
              <span className={`font-display-sm font-bold ${finalBalance > 0 ? 'text-error' : finalBalance < 0 ? 'text-[#166534]' : 'text-on-surface'}`}>
                ₹{Math.abs(finalBalance).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                {finalBalance < 0 && ' (Adv)'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-md mt-sm">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-xs px-xl py-sm border border-primary text-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Only'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">print</span> {saving ? 'Saving...' : 'Save & Print'}
            </button>
          </div>
        </div>

        {/* Past Settlements List */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col mt-md">
          <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="font-headline-sm text-on-surface">Past Settlements</h3>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Date Settled</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Vendor</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Date Range</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Supplied</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Received</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Van Stock</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Final Balance</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
                {loading ? (
                  <tr><td colSpan={8} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
                ) : settlements.length === 0 ? (
                  <tr><td colSpan={8} className="px-md py-lg text-center text-on-surface-variant">No settlements recorded yet.</td></tr>
                ) : (
                  settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm text-on-surface-variant">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-md py-sm font-medium text-primary">{(s as any).vendors?.name || 'Unknown'}</td>
                      <td className="px-md py-sm text-on-surface-variant text-sm">{s.date_from} to {s.date_to}</td>
                      <td className="px-md py-sm text-right text-on-surface-variant">₹{s.total_supplied.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-md py-sm text-right text-[#166534]">₹{s.total_received.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-md py-sm text-right text-error">₹{((s as any).van_stock_value || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-md py-sm text-right">
                        <span className={`font-bold ${s.final_balance > 0 ? 'text-error' : s.final_balance < 0 ? 'text-[#166534]' : 'text-on-surface-variant'}`}>
                          ₹{s.final_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </span>
                      </td>
                      <td className="px-md py-sm text-center">
                        <button onClick={printPastSettlement} className="text-secondary hover:text-secondary-container transition-colors mr-sm">
                          <span className="material-symbols-outlined text-[20px]">print</span>
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="text-error hover:text-error-container transition-colors">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
