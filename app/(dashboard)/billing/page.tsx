'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor, Product, Bill, BillItem, AppSetting } from '@/lib/types';
import PrintBill from '@/components/PrintBill';

type Tab = 'new' | 'previous';

export default function BillingPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('new');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [masterPassword, setMasterPassword] = useState('1234');
  
  // Previous Bills State
  const [bills, setBills] = useState<(Bill & { is_deleted?: boolean })[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreBills, setHasMoreBills] = useState(true);
  const [historyFilterVendor, setHistoryFilterVendor] = useState<string>('all');
  const ITEMS_PER_PAGE = 20;

  // Form State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [existingBillNumber, setExistingBillNumber] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
  });
  
  const [billType, setBillType] = useState<'simple' | 'gst'>('simple');

  const [items, setItems] = useState<(BillItem & { ui_id: number; hsn_code?: string })[]>([
    { ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0, hsn_code: '' }
  ]);

  const [discountType, setDiscountType] = useState('None');
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [gstType, setGstType] = useState('0%');
  const [customGst, setCustomGst] = useState<number>(0);

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [passwordError, setPasswordError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'previous') {
      setPage(0);
      fetchBills(0, true, historyFilterVendor);
    }
  }, [activeTab, historyFilterVendor]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [vendorsRes, productsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('active', true),
      supabase.from('products').select('id, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, hsn_code'),
      supabase.from('app_settings').select('key, value')
    ]);

    if ((vendorsRes as any).error && (vendorsRes as any).error.message.includes('active')) {
       const fallbackRes = await supabase.from('vendors').select('id, name, type').eq('is_active', true);
       if (fallbackRes.data) setVendors(fallbackRes.data as Vendor[]);
    } else if ((vendorsRes as any).data) {
       setVendors((vendorsRes as any).data as Vendor[]);
    }

    if ((productsRes as any).data) setProducts((productsRes as any).data as Product[]);
    
    let pwd = '1234';
    if ((settingsRes as any).data) {
      const allSettings = (settingsRes as any).data;
      const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = pwdSetting.value;
      
      const compName = allSettings.find((s: any) => s.key === 'company_name')?.value;
      const gstNum = allSettings.find((s: any) => s.key === 'gst_number')?.value;
      setAppSetting({ id: '1', created_at: '', company_name: compName, gst_number: gstNum });
    }
    setMasterPassword(pwd);
    setLoading(false);
  };

  const fetchBills = async (pageIndex: number, reset: boolean = false, vendorFilter: string = historyFilterVendor) => {
    setBillsLoading(true);
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('bills')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (vendorFilter && vendorFilter !== 'all') {
      query = query.eq('vendor_id', vendorFilter);
    }

    const { data, count } = await query;

    if (data) {
      if (reset) {
        setBills(data);
      } else {
        setBills(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newBills = data.filter((b: any) => !existingIds.has(b.id));
          return [...prev, ...newBills];
        });
      }
      setHasMoreBills(data.length === ITEMS_PER_PAGE);
    }
    setBillsLoading(false);
  };

  const loadMoreBills = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBills(nextPage, false, historyFilterVendor);
  };

  const groupedBills = useMemo(() => {
    return bills.reduce((acc, bill) => {
      if (!acc[bill.date]) acc[bill.date] = [];
      acc[bill.date].push(bill);
      return acc;
    }, {} as Record<string, (Bill & { is_deleted?: boolean })[]>);
  }, [bills]);

  const groupedProducts = useMemo(() => {
    const groups: Record<number, Product[]> = {};
    products.forEach(p => {
      const price = p.price_per_piece || 0;
      if (!groups[price]) groups[price] = [];
      groups[price].push(p);
    });
    return groups;
  }, [products]);

  // Form Handlers
  const addItemRow = () => {
    setItems([...items, { ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0, hsn_code: '' }]);
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
      
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        updatedItem.product_name = product ? product.name : '';
        updatedItem.hsn_code = product?.hsn_code || '';
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
  const selectedVendor = useMemo(() => vendors.find(v => v.id === formData.vendor_id), [vendors, formData.vendor_id]);
  const isShopkeeper = selectedVendor?.type === 'shopkeeper';

  useEffect(() => {
    if (!isShopkeeper) {
      setBillType('simple');
      setGstType('0%');
      setCustomGst(0);
      setDiscountType('None');
      setCustomDiscount(0);
    }
  }, [isShopkeeper, formData.vendor_id]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);

  let discountAmount = 0;
  if (discountType === '5%') discountAmount = subtotal * 0.05;
  else if (discountType === '10%') discountAmount = subtotal * 0.10;
  else if (discountType === '15%') discountAmount = subtotal * 0.15;
  else if (discountType === 'Custom') discountAmount = Number(customDiscount) || 0;

  const afterDiscount = subtotal - discountAmount;

  let gstAmount = 0;
  if (billType === 'gst') {
    if (gstType === '5%') gstAmount = afterDiscount * 0.05;
    else if (gstType === '12%') gstAmount = afterDiscount * 0.12;
    else if (gstType === '18%') gstAmount = afterDiscount * 0.18;
    else if (gstType === 'Custom') gstAmount = afterDiscount * ((Number(customGst) || 0) / 100);
  }

  const grandTotal = afterDiscount + gstAmount;

  const handleSave = async (printAfter: boolean) => {
    if (!formData.vendor_id) return toast.error("Please select a vendor.");
    if (items.some(i => !i.product_id)) return toast.error("Please select products for all rows.");

    setSaving(true);
    const vendor = vendors.find(v => v.id === formData.vendor_id);
    
    let billNumber = existingBillNumber;
    if (!billNumber) {
      const lastBillRes = await supabase.from('bills').select('bill_number').order('created_at', { ascending: false }).limit(1);
      let nextNum = 1;
      if ((lastBillRes as any).data && (lastBillRes as any).data.length > 0) {
        const lastNumStr = (lastBillRes as any).data[0].bill_number.split('-').pop();
        if (lastNumStr) nextNum = parseInt(lastNumStr) + 1;
      }
      const currentYear = new Date().getFullYear();
      billNumber = `SST-${currentYear}-${nextNum.toString().padStart(3, '0')}`;
    }

    const cleanItems = items.map(({ ui_id, ...rest }) => rest);

    const payload = {
      vendor_id: formData.vendor_id,
      vendor_name: vendor?.name || '',
      bill_number: billNumber,
      date: formData.date,
      subtotal: subtotal,
      discount_type: discountType,
      discount_amount: discountAmount,
      gst_type: billType === 'gst' ? gstType : '0%',
      gst_amount: billType === 'gst' ? gstAmount : 0,
      grand_total: grandTotal,
      bill_type: billType,
      items: cleanItems as any
    };

    let error;
    if (editingBillId) {
      const res = await (supabase as any).from('bills').update(payload).eq('id', editingBillId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('bills').insert([payload]);
      error = res.error;
    }
    
    if (error) {
      setSaving(false);
      return toast.error("Error saving bill: " + error.message);
    }

    const savedBill = { ...payload, id: editingBillId || 'temp-id', created_at: new Date().toISOString() } as unknown as Bill;

    // Smart Stock Deduction
    if (!editingBillId) {
      for (const item of cleanItems) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const ppb = product.pieces_per_box || 0;
          let newBoxes = 0;
          let newPieces = 0;

          if (ppb > 0) {
            const totalPiecesNeeded = ((item.box_qty || 0) * ppb) + (item.piece_qty || 0);
            const currentTotalPieces = ((product.stock_boxes || 0) * ppb) + (product.stock_pieces || 0);
            
            const remainingPieces = Math.max(0, currentTotalPieces - totalPiecesNeeded);
            newBoxes = Math.floor(remainingPieces / ppb);
            newPieces = remainingPieces % ppb;
          } else {
            newBoxes = Math.max(0, (product.stock_boxes || 0) - (item.box_qty || 0));
            newPieces = Math.max(0, (product.stock_pieces || 0) - (item.piece_qty || 0));
          }

          await (supabase as any).from('products').update({ stock_boxes: newBoxes, stock_pieces: newPieces }).eq('id', product.id);
        }
      }
      
      // Update local products state
      const { data: updatedProducts } = await supabase.from('products').select('id, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, hsn_code');
      if (updatedProducts) setProducts(updatedProducts as Product[]);
    }

    setSaving(false);
    toast.success(editingBillId ? "Bill updated successfully!" : "Bill saved successfully!");

    if (printAfter) {
      setPreviewBill(savedBill);
    }

    handleClear();
    
    if (activeTab === 'previous') {
      fetchBills(0, true, historyFilterVendor);
      setPage(0);
    } else {
      setActiveTab('previous');
    }
  };

  const handleClear = () => {
    setFormData({ vendor_id: '', date: new Date().toISOString().split('T')[0] });
    setBillType('simple');
    setItems([{ ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0, hsn_code: '' }]);
    setDiscountType('None');
    setCustomDiscount(0);
    setGstType('0%');
    setCustomGst(0);
    setEditingBillId(null);
    setExistingBillNumber(null);
  };

  const startEdit = (bill: Bill & { is_deleted?: boolean }) => {
    if (bill.is_deleted) return;
    setEditingBillId(bill.id);
    setExistingBillNumber(bill.bill_number);
    setFormData({ vendor_id: bill.vendor_id, date: bill.date });
    setBillType(bill.bill_type || 'simple');
    setDiscountType(bill.discount_type || 'None');
    setCustomDiscount(bill.discount_type === 'Custom' ? bill.discount_amount : 0);
    setGstType(bill.gst_type || '0%');
    setCustomGst(bill.gst_type === 'Custom' ? (bill.gst_amount / (bill.subtotal - bill.discount_amount) * 100) : 0);
    
    if (bill.items && bill.items.length > 0) {
      setItems(bill.items.map((i: any, idx) => ({ ...i, ui_id: Date.now() + idx, hsn_code: i.hsn_code || '' })));
    } else {
      setItems([{ ui_id: Date.now(), product_id: '', product_name: '', box_qty: null, piece_qty: null, rate: 0, total: 0, hsn_code: '' }]);
    }
    
    setActiveTab('new');
    toast('Editing Bill: ' + bill.bill_number, { icon: '✏️' });
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
    setPasswordInput('');
    setPasswordStep(1);
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput !== masterPassword) {
      setPasswordError("Incorrect password");
      setPasswordInput('');
    } else {
      setPasswordError('');
      setPasswordStep(2);
    }
  };

  const confirmDelete = async () => {
    setShowPasswordModal(false);
    
    if (pendingDeleteId) {
      const { error } = await (supabase as any).from('bills').update({ is_deleted: true }).eq('id', pendingDeleteId);
      if (error) {
        toast.error('Failed to delete bill');
      } else {
        toast.success('Bill deleted successfully');
        fetchBills(0, true, historyFilterVendor);
        setPage(0);
      }
      setPendingDeleteId(null);
    }
  };

  return (
    <>
      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg print:hidden h-full overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md sticky top-16 md:top-0 bg-surface-container-lowest z-20">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Billing</h2>
          
          <div className="flex bg-surface-variant/30 p-xs rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 sm:flex-none px-lg py-sm rounded-lg font-label-md transition-colors ${activeTab === 'new' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              New Bill
            </button>
            <button
              onClick={() => setActiveTab('previous')}
              className={`flex-1 sm:flex-none px-lg py-sm rounded-lg font-label-md transition-colors ${activeTab === 'previous' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Previous Bills
            </button>
          </div>
        </div>

        {activeTab === 'new' && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg animate-fade-in">
            {editingBillId && (
              <div className="bg-primary/10 text-primary p-sm rounded-xl font-medium flex items-center justify-between">
                <span>Editing Bill: {existingBillNumber}</span>
                <button onClick={handleClear} className="text-primary hover:underline text-sm">Cancel Edit</button>
              </div>
            )}
            
            {loading ? (
              <div className="h-40 flex items-center justify-center text-on-surface-variant animate-pulse">Loading data...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
                    <select
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                      className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
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
                      className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {isShopkeeper && (
                  <div className="flex gap-md bg-surface-container-lowest p-xs rounded-xl border border-outline-variant w-fit">
                    <button
                      onClick={() => setBillType('simple')}
                      className={`px-lg py-sm rounded-lg font-label-md transition-colors ${billType === 'simple' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
                    >
                      Simple Bill
                    </button>
                    <button
                      onClick={() => setBillType('gst')}
                      className={`px-lg py-sm rounded-lg font-label-md transition-colors ${billType === 'gst' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
                    >
                      GST Bill
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto border border-outline-variant rounded-2xl mt-sm">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="px-md py-sm font-label-md text-on-surface-variant w-[40%]">Product</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant w-[15%]">Box Qty</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant w-[15%]">Piece Qty</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant w-[10%]">Rate</th>
                        <th className="px-md py-sm font-label-md text-on-surface-variant w-[10%] text-right">Total</th>
                        <th className="px-md py-sm w-[10%] text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                      {items.map((item) => (
                        <tr key={item.ui_id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-md py-sm">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleItemChange(item.ui_id, 'product_id', e.target.value)}
                              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] outline-none"
                            >
                              <option value="">Select Product...</option>
                              {Object.entries(groupedProducts).sort((a,b) => Number(a[0]) - Number(b[0])).map(([price, prods]) => (
                                <optgroup key={price} label={`₹${price} Items`}>
                                  {prods.map(p => {
                                    const isOutOfStock = (p.stock_boxes || 0) === 0 && (p.stock_pieces || 0) === 0;
                                    return (
                                      <option key={p.id} value={p.id} disabled={isOutOfStock}>
                                        {p.name} {isOutOfStock ? '(Out of Stock)' : ''}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              ))}
                            </select>
                            {item.product_id && (
                              <div className="text-[11px] text-on-surface-variant mt-1 pl-1">
                                {(() => {
                                   const p = products.find(prod => prod.id === item.product_id);
                                   if (!p) return null;
                                   return `Stock: ${p.stock_boxes || 0} Boxes, ${p.stock_pieces || 0} Pieces`;
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="px-md py-sm">
                            <input
                              type="number" min="0" value={item.box_qty === null ? '' : item.box_qty}
                              onChange={(e) => handleItemChange(item.ui_id, 'box_qty', e.target.value ? Number(e.target.value) : null)}
                              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] outline-none" placeholder="0"
                            />
                          </td>
                          <td className="px-md py-sm">
                            <input
                              type="number" min="0" value={item.piece_qty === null ? '' : item.piece_qty}
                              onChange={(e) => handleItemChange(item.ui_id, 'piece_qty', e.target.value ? Number(e.target.value) : null)}
                              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] outline-none" placeholder="0"
                            />
                          </td>
                          <td className="px-md py-sm text-on-surface-variant">₹{item.rate.toLocaleString('en-IN')}</td>
                          <td className="px-md py-sm text-on-surface text-right font-medium">₹{item.total.toLocaleString('en-IN')}</td>
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
                  <button onClick={addItemRow} className="flex items-center gap-xs px-md py-sm border border-outline-variant bg-surface-container-low text-primary font-label-md rounded-xl hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add</span> Add Row
                  </button>
                </div>

                <div className="flex flex-col items-end gap-sm mt-md pt-md border-t border-outline-variant w-full">
                  <div className="flex justify-between w-full sm:w-1/3 items-center">
                    <span className="font-body-md text-on-surface-variant">Subtotal:</span>
                    <span className="font-body-md text-on-surface">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {isShopkeeper && (
                    <>
                      <div className="flex justify-between w-full sm:w-1/3 items-center">
                        <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                          Discount:
                          <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm w-24">
                            <option value="None">None</option>
                            <option value="5%">5%</option>
                            <option value="10%">10%</option>
                            <option value="15%">15%</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </span>
                        {discountType === 'Custom' ? (
                          <input type="number" value={customDiscount} onChange={e => setCustomDiscount(Number(e.target.value))} className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-xl text-[16px] text-right text-error"/>
                        ) : (
                          <span className="font-body-md text-error">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        )}
                      </div>

                      {billType === 'gst' && (
                        <div className="flex justify-between w-full sm:w-1/3 items-center">
                          <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                            GST:
                            <select value={gstType} onChange={e => setGstType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm w-24">
                              <option value="0%">0%</option>
                              <option value="5%">5%</option>
                              <option value="12%">12%</option>
                              <option value="18%">18%</option>
                              <option value="Custom">Custom</option>
                            </select>
                          </span>
                          {gstType === 'Custom' ? (
                            <input type="number" value={customGst} onChange={e => setCustomGst(Number(e.target.value))} className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-xl text-[16px] text-right" placeholder="%"/>
                          ) : (
                            <span className="font-body-md text-on-surface">+₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-between w-full sm:w-1/3 items-center pt-sm mt-sm border-t border-outline-variant">
                    <span className="font-headline-sm text-on-surface font-bold">Grand Total:</span>
                    <span className="font-headline-sm text-primary font-bold">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-md mt-md w-full sm:w-auto">
                    <button onClick={handleClear} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-error text-error rounded-xl hover:bg-error/10 transition-colors disabled:opacity-50">
                      Clear
                    </button>
                    <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-primary text-primary rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Bill'}
                    </button>
                    <button onClick={() => handleSave(true)} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save & Print'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'previous' && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md flex flex-col gap-md animate-fade-in min-h-[400px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-xs">
              <h3 className="font-headline-sm text-on-surface">Previous Bills History</h3>
              <div className="w-full sm:w-64">
                <select
                  value={historyFilterVendor}
                  onChange={(e) => setHistoryFilterVendor(e.target.value)}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                >
                  <option value="all">All Vendors & Shopkeepers</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                  ))}
                </select>
              </div>
            </div>

            {Object.keys(groupedBills).length === 0 && !billsLoading ? (
              <div className="text-center text-on-surface-variant py-xl">No previous bills found.</div>
            ) : (
              Object.entries(groupedBills).map(([date, dateBills]) => (
                <div key={date} className="mb-md">
                  <h3 className="font-label-lg text-on-surface-variant mb-sm sticky top-0 bg-surface-container-lowest py-2 border-b border-outline-variant/30 z-10">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  <div className="flex flex-col gap-sm">
                    {dateBills.map(bill => (
                      <div key={bill.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-md bg-surface border border-outline-variant rounded-2xl hover:border-primary/30 transition-colors cursor-pointer gap-sm ${bill.is_deleted ? 'opacity-50 line-through' : ''}`} onClick={() => setPreviewBill(bill as any)}>
                        <div className="flex items-center gap-md">
                          <span className="font-medium text-primary w-32">{bill.bill_number}</span>
                          <span className="font-body-md text-on-surface truncate max-w-[200px]">{bill.vendor_name}</span>
                          {bill.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                          {bill.bill_type === 'gst' && <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">GST</span>}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-md w-full sm:w-auto">
                          <span className="font-bold text-on-surface table-lining-figures">₹{bill.grand_total.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                          <div className="flex gap-xs bg-surface-container-low rounded-full p-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setPreviewBill(bill as any)} className="p-sm text-secondary hover:bg-secondary/10 rounded-full transition-colors flex">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            {!bill.is_deleted && (
                              <>
                                <button onClick={() => startEdit(bill)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button onClick={() => handleDeleteRequest(bill.id)} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            
            {billsLoading && <div className="text-center py-sm text-on-surface-variant">Loading bills...</div>}
            
            {hasMoreBills && !billsLoading && (
              <button onClick={loadMoreBills} className="mt-md py-sm text-primary font-medium hover:underline text-center w-full">
                Load More Bills
              </button>
            )}
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="password-modal-overlay">
          <div className="password-modal-box">
            {passwordStep === 1 ? (
              <>
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">lock</span> Password Required
                </h3>
                <p className="text-on-surface-variant text-sm">Enter master password to delete this item.</p>
                <input 
                  type="password" 
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  data-lpignore="true"
                  data-form-type="other"
                  name="action-password"
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl text-[16px] outline-none focus:border-error focus:ring-1 focus:ring-error"
                  placeholder="Enter password"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                />
                {passwordError && <p className="text-error text-xs">{passwordError}</p>}
                <div className="password-modal-buttons">
                  <button onClick={() => setShowPasswordModal(false)} className="bg-surface-variant text-on-surface-variant">Cancel</button>
                  <button onClick={handlePasswordSubmit} className="bg-error text-white">Confirm</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">warning</span> Are you sure?
                </h3>
                <p className="text-on-surface-variant text-sm">This action will void the record. Are you sure you want to delete?</p>
                <div className="password-modal-buttons">
                  <button onClick={() => setShowPasswordModal(false)} className="bg-surface-variant text-on-surface-variant">Cancel</button>
                  <button onClick={confirmDelete} className="bg-error text-white">Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-lg overflow-hidden animate-fade-in">
            <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface">
              <h3 className="font-headline-sm text-on-surface">Bill Preview</h3>
              <div className="flex gap-sm">
                <button onClick={() => setPreviewBill(null)} className="px-lg py-sm border border-outline-variant rounded-xl font-medium text-on-surface hover:bg-surface-variant transition-colors">Close</button>
                <button onClick={() => window.print()} className="px-lg py-sm bg-primary text-on-primary rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">print</span> Print
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-md sm:p-xl bg-surface-variant/50 flex justify-center items-start print:p-0 print:bg-transparent print:overflow-visible">
               <div className="shadow-2xl print:shadow-none bg-white">
                 <PrintBill 
                   bill={previewBill} 
                   appSetting={appSetting} 
                   vendorType={vendors.find(v => v.id === previewBill.vendor_id)?.type}
                 />
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
