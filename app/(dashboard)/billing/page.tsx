'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Product, Bill, BillItem, AppSetting } from '@/lib/types';
import PrintBill from '@/components/PrintBill';

export default function BillingPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billToPrint, setBillToPrint] = useState<Bill | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [items, setItems] = useState<(BillItem & { ui_id: number })[]>([
    { ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0 }
  ]);

  const [discountType, setDiscountType] = useState('None');
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [gstType, setGstType] = useState('0%');
  const [customGst, setCustomGst] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [vendorsRes, productsRes, billsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('is_active', true),
      supabase.from('products').select('id, name, price_per_box, price_per_piece').eq('is_active', true),
      supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('app_settings').select('*').limit(1).single()
    ]);

    if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);
    if ((productsRes as any).data) setProducts((productsRes as any).data as Product[]);
    if ((billsRes as any).data) setBills((billsRes as any).data as Bill[]);
    if ((settingsRes as any).data) setAppSetting((settingsRes as any).data as AppSetting);
    setLoading(false);
  };

  const addItemRow = () => {
    setItems([...items, { ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0 }]);
  };

  const removeItemRow = (ui_id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.ui_id !== ui_id));
    }
  };

  const handleItemChange = (ui_id: number, field: string, value: string | number | null) => {
    setItems(items.map(item => {
      if (item.ui_id !== ui_id) return item;
      
      const updatedItem = { ...item, [field]: value };
      
      // Auto-fill and calculate
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          updatedItem.product_name = product.name;
        } else {
          updatedItem.product_name = '';
        }
      }

      const product = products.find(p => p.id === updatedItem.product_id);
      let total = 0;
      let effectiveRate = 0;
      if (product) {
        const bQty = Number(updatedItem.box_qty) || 0;
        const pQty = Number(updatedItem.piece_qty) || 0;
        const bPrice = product.price_per_box || 0;
        const pPrice = product.price_per_piece || 0;
        
        total = (bQty * bPrice) + (pQty * pPrice);
        if (bQty > 0) effectiveRate = bPrice;
        else if (pQty > 0) effectiveRate = pPrice;
      }
      
      updatedItem.rate = effectiveRate;
      updatedItem.total = total;
      return updatedItem;
    }));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  let discountAmount = 0;
  if (discountType === '5%') discountAmount = subtotal * 0.05;
  else if (discountType === '10%') discountAmount = subtotal * 0.10;
  else if (discountType === '15%') discountAmount = subtotal * 0.15;
  else if (discountType === 'Custom') discountAmount = Number(customDiscount) || 0;

  const afterDiscount = subtotal - discountAmount;

  let gstAmount = 0;
  if (gstType === '5%') gstAmount = afterDiscount * 0.05;
  else if (gstType === '12%') gstAmount = afterDiscount * 0.12;
  else if (gstType === '18%') gstAmount = afterDiscount * 0.18;
  else if (gstType === 'Custom') gstAmount = afterDiscount * ((Number(customGst) || 0) / 100);

  const grandTotal = afterDiscount + gstAmount;

  const handleSave = async (printAfter: boolean) => {
    if (!formData.vendor_id) {
      toast.error("Please select a vendor.");
      return;
    }
    if (items.some(i => !i.product_id)) {
      toast.error("Please select products for all rows.");
      return;
    }

    setSaving(true);
    const vendor = vendors.find(v => v.id === formData.vendor_id);
    
    // Auto Generate Bill Number
    const lastBillRes = await supabase.from('bills').select('bill_number').order('created_at', { ascending: false }).limit(1);
    let nextNum = 1;
    if ((lastBillRes as any).data && (lastBillRes as any).data.length > 0) {
      const lastNumStr = (lastBillRes as any).data[0].bill_number.split('-').pop();
      if (lastNumStr) nextNum = parseInt(lastNumStr) + 1;
    }
    const currentYear = new Date().getFullYear();
    const billNumber = `SST-${currentYear}-${nextNum.toString().padStart(3, '0')}`;

    // Clean items before saving
    const cleanItems = items.map(({ ui_id, ...rest }) => rest);

    const payload = {
      vendor_id: formData.vendor_id,
      vendor_name: vendor?.name || '',
      bill_number: billNumber,
      date: formData.date,
      subtotal: subtotal,
      discount_type: discountType,
      discount_amount: discountAmount,
      gst_type: gstType,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      items: cleanItems as any
    };

    const { error } = await (supabase as any).from('bills').insert([payload]);
    
    if (error) {
      setSaving(false);
      toast.error("Error saving bill: " + error.message);
      return;
    }

    const savedBill = { ...payload, id: 'temp-id', created_at: new Date().toISOString() } as unknown as Bill;

    // Deduct Stock
    for (const item of cleanItems) {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        const newBoxes = Math.max(0, (product.stock_boxes || 0) - (item.box_qty || 0));
        const newPieces = Math.max(0, (product.stock_pieces || 0) - (item.piece_qty || 0));
        await (supabase as any).from('products').update({ stock_boxes: newBoxes, stock_pieces: newPieces }).eq('id', product.id);
      }
    }

    setSaving(false);
    toast.success("Bill saved successfully!");

    await fetchData();

    if (printAfter) {
      setBillToPrint(savedBill);
      setTimeout(() => {
        window.print();
        setTimeout(() => setBillToPrint(null), 1000);
      }, 500);
    }

    // Reset Form
    setFormData({ ...formData, vendor_id: '' });
    setItems([{ ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0 }]);
    setDiscountType('None');
    setCustomDiscount(0);
    setGstType('0%');
    setCustomGst(0);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the current bill?")) {
      setFormData({ ...formData, vendor_id: '' });
      setItems([{ ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0 }]);
      setDiscountType('None');
      setCustomDiscount(0);
      setGstType('0%');
      setCustomGst(0);
      toast.success('Form cleared');
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      const { error } = await supabase.from('bills').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete bill');
      } else {
        toast.success('Bill deleted successfully');
        fetchData();
      }
    }
  };

  const printPastBill = (bill: Bill) => {
    setBillToPrint(bill);
    setTimeout(() => {
      window.print();
      setTimeout(() => setBillToPrint(null), 1000);
    }, 500);
  };

  return (
    <>
      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Billing</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Create and manage customer bills.</p>
          </div>
        </div>

        {/* Bill Creation Form */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-outline-variant rounded-lg mt-sm">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-[#F1F5F9] border-b border-outline-variant">
                <tr>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase w-[40%]">Product</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase w-[15%]">Box Qty</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase w-[15%]">Piece Qty</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase w-[10%]">Rate</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase w-[10%] text-right">Total</th>
                  <th className="px-md py-sm w-[10%] text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {items.map((item) => (
                  <tr key={item.ui_id} className="hover:bg-surface-container-low">
                    <td className="px-md py-sm">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(item.ui_id, 'product_id', e.target.value)}
                        className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md min-w-[120px]"
                      >
                        <option value="">Select Product...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-md py-sm">
                      <input
                        type="number"
                        min="0"
                        value={item.box_qty === null ? '' : item.box_qty}
                        onChange={(e) => handleItemChange(item.ui_id, 'box_qty', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md min-w-[60px]"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-md py-sm">
                      <input
                        type="number"
                        min="0"
                        value={item.piece_qty === null ? '' : item.piece_qty}
                        onChange={(e) => handleItemChange(item.ui_id, 'piece_qty', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] md:text-body-md min-w-[60px]"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-md py-sm text-on-surface-variant">
                      ₹{item.rate.toLocaleString('en-IN')}
                    </td>
                    <td className="px-md py-sm text-on-surface text-right font-medium">
                      ₹{item.total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-md py-sm text-center">
                      <button onClick={() => removeItemRow(item.ui_id)} className="text-error hover:text-error-container disabled:opacity-30" disabled={items.length === 1}>
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-start">
            <button
              onClick={addItemRow}
              className="flex items-center justify-center gap-xs px-md py-sm border border-outline-variant bg-surface-container-low text-primary font-label-md text-label-md rounded-xl hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Add Row
            </button>
          </div>

          {/* Totals Section */}
          <div className="flex flex-col items-end gap-sm mt-md pt-md border-t border-outline-variant w-full">
            <div className="flex justify-between w-full sm:w-1/3 items-center">
              <span className="font-body-md text-on-surface-variant">Subtotal:</span>
              <span className="font-body-md text-on-surface">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between w-full sm:w-1/3 items-center">
              <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                Discount:
                <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm text-body-sm w-24">
                  <option value="None">None</option>
                  <option value="5%">5%</option>
                  <option value="10%">10%</option>
                  <option value="15%">15%</option>
                  <option value="Custom">Custom</option>
                </select>
              </span>
              {discountType === 'Custom' ? (
                <input 
                  type="number" 
                  value={customDiscount} 
                  onChange={e => setCustomDiscount(Number(e.target.value))} 
                  className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm text-[16px] md:text-sm text-right text-error"
                />
              ) : (
                <span className="font-body-md text-error">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              )}
            </div>

            <div className="flex justify-between w-full sm:w-1/3 items-center">
              <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                GST:
                <select value={gstType} onChange={e => setGstType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm text-body-sm w-24">
                  <option value="0%">0%</option>
                  <option value="5%">5%</option>
                  <option value="12%">12%</option>
                  <option value="18%">18%</option>
                  <option value="Custom">Custom</option>
                </select>
              </span>
              {gstType === 'Custom' ? (
                <input 
                  type="number" 
                  value={customGst} 
                  onChange={e => setCustomGst(Number(e.target.value))} 
                  className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm text-[16px] md:text-sm text-right"
                  placeholder="%"
                />
              ) : (
                <span className="font-body-md text-on-surface">+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              )}
            </div>

            <div className="flex justify-between w-full sm:w-1/3 items-center pt-sm mt-sm border-t border-outline-variant">
              <span className="font-headline-sm text-on-surface font-bold">Grand Total:</span>
              <span className="font-headline-sm text-primary font-bold">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-md mt-md w-full sm:w-auto">
              <button
                onClick={handleClear}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-error text-error font-label-md text-label-md rounded-xl hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">clear_all</span> Clear Form
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-primary text-primary font-label-md text-label-md rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">save</span> {saving ? 'Saving...' : 'Save Bill'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm bg-primary text-on-primary font-label-md text-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">print</span> {saving ? 'Saving...' : 'Save & Print'}
              </button>
            </div>
          </div>
        </div>

        {/* Bill List */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col mt-md">
          <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="font-headline-sm text-on-surface">Recent Bills</h3>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col divide-y divide-outline-variant/30">
            {loading ? (
              <div className="p-md text-center text-on-surface-variant">Loading...</div>
            ) : bills.length === 0 ? (
              <div className="p-md text-center text-on-surface-variant">No bills generated yet.</div>
            ) : (
              bills.map((bill) => (
                <div key={bill.id} className="p-md flex flex-col gap-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-primary text-[16px]">{bill.bill_number}</div>
                      <div className="text-on-surface-variant text-sm mt-xs">{bill.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[16px] text-on-surface">₹{bill.grand_total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</div>
                    </div>
                  </div>
                  <div className="font-body-md text-on-surface">{bill.vendor_name}</div>
                  <div className="flex justify-end gap-md mt-xs">
                    <button onClick={() => printPastBill(bill)} className="text-secondary hover:text-secondary-container transition-colors flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[18px]">print</span>
                    </button>
                    <button onClick={() => handleDeleteBill(bill.id)} className="text-error hover:text-error-container transition-colors flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop/Tablet Table Layout */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Bill No.</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Date</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase">Vendor</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Grand Total</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
                {loading ? (
                  <tr><td colSpan={5} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
                ) : bills.length === 0 ? (
                  <tr><td colSpan={5} className="px-md py-lg text-center text-on-surface-variant">No bills generated yet.</td></tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm font-medium text-primary">{bill.bill_number}</td>
                      <td className="px-md py-sm text-on-surface-variant">{bill.date}</td>
                      <td className="px-md py-sm text-on-surface-variant">{bill.vendor_name}</td>
                      <td className="px-md py-sm text-right font-medium text-on-surface">₹{bill.grand_total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-md py-sm text-right">
                        <button onClick={() => printPastBill(bill)} className="text-secondary hover:text-secondary-container transition-colors mr-sm">
                          <span className="material-symbols-outlined text-[20px]">print</span>
                        </button>
                        <button onClick={() => handleDeleteBill(bill.id)} className="text-error hover:text-error-container transition-colors">
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
      
      <PrintBill bill={billToPrint} appSetting={appSetting} />
    </>
  );
}
