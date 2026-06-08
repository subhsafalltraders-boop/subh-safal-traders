'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Product, Bill, BillItem, AppSetting } from '@/lib/types';

export default function BillingPage() {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);

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
      alert("Please select a vendor.");
      return;
    }
    if (items.some(i => !i.product_id)) {
      alert("Please select products for all rows.");
      return;
    }

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
      alert("Error saving bill: " + error.message);
      return;
    }

    await fetchData();

    if (printAfter) {
      window.print();
    }

    // Reset Form
    setFormData({ ...formData, vendor_id: '' });
    setItems([{ ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0 }]);
    setDiscountType('None');
    setCustomDiscount(0);
    setGstType('0%');
    setCustomGst(0);
  };

  const handleDeleteBill = async (id: string) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      await supabase.from('bills').delete().eq('id', id);
      fetchData();
    }
  };

  const printBill = (bill: Bill) => {
    alert("To reprint, normally we would load this bill state into the form and call window.print(). For now, simply View it.");
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
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow p-xl flex flex-col gap-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
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
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
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
                        className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md"
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
                        className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-md py-sm">
                      <input
                        type="number"
                        min="0"
                        value={item.piece_qty === null ? '' : item.piece_qty}
                        onChange={(e) => handleItemChange(item.ui_id, 'piece_qty', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md"
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
              className="flex items-center justify-center gap-xs px-md py-sm border border-outline-variant bg-surface-container-low text-primary font-label-md text-label-md rounded-DEFAULT hover:bg-surface-container transition-colors"
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
                <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-sm text-body-sm w-24">
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
                  className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-sm text-right text-error"
                />
              ) : (
                <span className="font-body-md text-error">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              )}
            </div>

            <div className="flex justify-between w-full sm:w-1/3 items-center">
              <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                GST:
                <select value={gstType} onChange={e => setGstType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-sm text-body-sm w-24">
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
                  className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-sm text-right"
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
            
            <div className="flex gap-md mt-md w-full sm:w-auto">
              <button
                onClick={() => handleSave(false)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-primary text-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">save</span> Save Bill
              </button>
              <button
                onClick={() => handleSave(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">print</span> Save & Print
              </button>
            </div>
          </div>
        </div>

        {/* Bill List */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col mt-md">
          <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="font-headline-sm text-on-surface">Recent Bills</h3>
          </div>
          <div className="overflow-x-auto w-full">
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
                        <button onClick={() => printBill(bill)} className="text-secondary hover:text-secondary-container transition-colors mr-sm">
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
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

      {/* Hidden Print View */}
      <div className="hidden print:flex flex-col w-full h-full bg-white text-black p-8 font-sans">
        {/* Original Half */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold uppercase tracking-wider">{appSetting?.company_name || 'Subh Safal Traders'}</h1>
            <p className="text-sm text-gray-600">GSTIN: {appSetting?.gst_number || 'N/A'} | Original for Recipient</p>
          </div>
          
          <div className="flex justify-between mb-6 pb-4 border-b-2 border-black">
            <div>
              <p className="font-semibold text-lg">Billed To:</p>
              <p className="text-lg">{vendors.find(v => v.id === formData.vendor_id)?.name || 'Unknown'}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Invoice No:</span> Auto-Generated on Save</p>
              <p><span className="font-semibold">Date:</span> {formData.date}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 font-semibold">Product Description</th>
                <th className="py-2 text-center font-semibold">Box Qty</th>
                <th className="py-2 text-center font-semibold">Piece Qty</th>
                <th className="py-2 text-right font-semibold">Rate (₹)</th>
                <th className="py-2 text-right font-semibold">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.product_id).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="py-2">{item.product_name}</td>
                  <td className="py-2 text-center">{item.box_qty || '-'}</td>
                  <td className="py-2 text-center">{item.piece_qty || '-'}</td>
                  <td className="py-2 text-right">{item.rate.toLocaleString('en-IN')}</td>
                  <td className="py-2 text-right">{item.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end w-full">
            <div className="w-1/2">
              <div className="flex justify-between py-1"><span className="font-semibold">Subtotal:</span> <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between py-1"><span className="font-semibold">Discount ({discountType}):</span> <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between py-1 border-b border-black"><span className="font-semibold">GST ({gstType}):</span> <span>+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between py-2 text-xl font-bold"><span>Grand Total:</span> <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
          
          <div className="mt-8 text-sm text-gray-500 italic">Thank you for your business!</div>
        </div>

        {/* Divider */}
        <div className="w-full border-t-2 border-dashed border-gray-400 my-8"></div>

        {/* Duplicate Half */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold uppercase tracking-wider">{appSetting?.company_name || 'Subh Safal Traders'}</h1>
            <p className="text-sm text-gray-600">GSTIN: {appSetting?.gst_number || 'N/A'} | Duplicate for Transporter</p>
          </div>
          
          <div className="flex justify-between mb-6 pb-4 border-b-2 border-black">
            <div>
              <p className="font-semibold text-lg">Billed To:</p>
              <p className="text-lg">{vendors.find(v => v.id === formData.vendor_id)?.name || 'Unknown'}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Invoice No:</span> Auto-Generated on Save</p>
              <p><span className="font-semibold">Date:</span> {formData.date}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 font-semibold">Product Description</th>
                <th className="py-2 text-center font-semibold">Box Qty</th>
                <th className="py-2 text-center font-semibold">Piece Qty</th>
                <th className="py-2 text-right font-semibold">Rate (₹)</th>
                <th className="py-2 text-right font-semibold">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.product_id).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="py-2">{item.product_name}</td>
                  <td className="py-2 text-center">{item.box_qty || '-'}</td>
                  <td className="py-2 text-center">{item.piece_qty || '-'}</td>
                  <td className="py-2 text-right">{item.rate.toLocaleString('en-IN')}</td>
                  <td className="py-2 text-right">{item.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end w-full">
            <div className="w-1/2">
              <div className="flex justify-between py-1"><span className="font-semibold">Subtotal:</span> <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between py-1"><span className="font-semibold">Discount ({discountType}):</span> <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between py-1 border-b border-black"><span className="font-semibold">GST ({gstType}):</span> <span>+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between py-2 text-xl font-bold"><span>Grand Total:</span> <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
          
          <div className="mt-8 text-sm text-gray-500 italic">Authorised Signatory ___________________</div>
        </div>
      </div>
    </>
  );
}
