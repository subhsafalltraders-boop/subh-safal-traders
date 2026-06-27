'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Product } from '@/lib/types';

type PurchaseItem = {
  ui_id: number;
  product_id: string;
  product_name: string;
  tray_qty: number;
  box_qty: number;
  piece_qty: number;
  cost: number;
};

export default function PurchasesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [totalAmountOverride, setTotalAmountOverride] = useState<string>('');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // History toggle
  const [showHistory, setShowHistory] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [productsRes, purchasesRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('purchases').select('*').order('created_at', { ascending: false })
    ]);
    
    if (productsRes.data) setProducts(productsRes.data);
    if (purchasesRes.data) setPurchases(purchasesRes.data);
    setLoading(false);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        ui_id: Date.now() + Math.random(),
        product_id: '',
        product_name: '',
        tray_qty: 0,
        box_qty: 0,
        piece_qty: 0,
        cost: 0
      }
    ]);
  };

  const handleRemoveItem = (ui_id: number) => {
    setItems(items.filter(item => item.ui_id !== ui_id));
  };

  const handleItemChange = (ui_id: number, field: keyof PurchaseItem, value: any) => {
    setItems(items.map(item => {
      if (item.ui_id === ui_id) {
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          return { ...item, product_id: value, product_name: product?.name || '' };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const calculatedTotalAmount = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  const finalTotalAmount = totalAmountOverride !== '' ? Number(totalAmountOverride) : calculatedTotalAmount;
  const cash = Number(cashAmount) || 0;
  const online = Number(onlineAmount) || 0;
  const totalPaid = cash + online;

  const generatePurchaseNumber = () => {
    const year = new Date().getFullYear();
    const prefix = `PUR-${year}-`;
    const thisYearPurchases = purchases.filter(p => p.purchase_number?.startsWith(prefix));
    
    if (thisYearPurchases.length === 0) {
      return `${prefix}001`;
    }

    let maxNum = 0;
    thisYearPurchases.forEach(p => {
      const parts = p.purchase_number.split('-');
      if (parts.length === 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  const handleSave = async () => {
    if (!date) return toast.error('Date is required');
    if (items.length === 0) return toast.error('Please add at least one item');
    if (items.some(i => !i.product_id)) return toast.error('Please select a product for all rows');
    
    setSaving(true);

    try {
      const purchaseNumber = generatePurchaseNumber();

      const itemsToSave = items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        tray_qty: item.tray_qty,
        box_qty: item.box_qty,
        piece_qty: item.piece_qty,
        cost: item.cost
      }));

      // 1. Save to purchases table
      const { error: purchaseError } = await (supabase as any).from('purchases').insert([{
        purchase_number: purchaseNumber,
        date,
        total_amount: finalTotalAmount,
        cash_amount: cash,
        online_amount: online,
        total_paid: totalPaid,
        notes,
        items: itemsToSave
      }]);

      if (purchaseError) throw purchaseError;

      // 2. Update stock for each product
      for (const item of itemsToSave) {
        const product = products.find(p => p.id === item.product_id);
        if (!product) continue;

        const boxes_per_tray = Number(product.boxes_per_tray) || 1;
        const pieces_per_box = Number(product.pieces_per_box) || 1;

        const item_total_pieces = (item.tray_qty * boxes_per_tray * pieces_per_box) + 
                                  (item.box_qty * pieces_per_box) + 
                                  item.piece_qty;
                                  
        const current_total_pieces = (Number(product.stock_boxes || 0) * pieces_per_box) + Number(product.stock_pieces || 0);
        
        const new_total_pieces = current_total_pieces + item_total_pieces;
        
        const new_stock_boxes = Math.floor(new_total_pieces / pieces_per_box);
        const new_stock_pieces = new_total_pieces % pieces_per_box;

        await (supabase as any).from('products').update({
          stock_boxes: new_stock_boxes,
          stock_pieces: new_stock_pieces
        }).eq('id', product.id);
      }

      toast.success(`Purchase saved successfully!`);
      
      // Reset form
      setDate(new Date().toISOString().split('T')[0]);
      setItems([]);
      setTotalAmountOverride('');
      setCashAmount('');
      setOnlineAmount('');
      setNotes('');
      
      // Refresh
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error saving purchase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase? Stock will NOT auto-adjust.')) return;
    
    setLoading(true);
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
    } else {
      toast.success('Purchase deleted successfully');
      fetchData();
    }
    setLoading(false);
  };

  if (loading && products.length === 0) {
    return <div className="p-xl text-center text-on-surface-variant animate-pulse">Loading...</div>;
  }

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md sticky top-16 md:top-0 bg-background z-20">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Company Purchase Entry</h2>
          <p className="font-body-md text-on-surface-variant">Record incoming stock and calculate totals.</p>
        </div>
      </div>

      {/* FORM */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg border border-outline-variant/50">
        <div>
          <label className="block font-label-md text-on-surface-variant mb-xs">Date *</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="w-full sm:w-1/3 px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] outline-none focus:border-primary"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-sm">
            <label className="block font-label-md text-on-surface-variant font-bold">Items</label>
            <button 
              onClick={handleAddItem}
              className="flex items-center gap-xs px-sm py-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Row
            </button>
          </div>
          
          <div className="border border-outline-variant rounded-xl overflow-hidden shadow-sm overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-sm py-2 font-label-sm text-on-surface-variant w-1/3">Product</th>
                  <th className="px-sm py-2 font-label-sm text-on-surface-variant w-20">Trays</th>
                  <th className="px-sm py-2 font-label-sm text-on-surface-variant w-20">Boxes</th>
                  <th className="px-sm py-2 font-label-sm text-on-surface-variant w-20">Pieces</th>
                  <th className="px-sm py-2 font-label-sm text-on-surface-variant w-32">Cost (₹)</th>
                  <th className="px-sm py-2 font-label-sm text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 bg-surface">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-md text-center text-on-surface-variant text-sm">No items added yet. Click 'Add Row'.</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.ui_id} className="hover:bg-surface-container-lowest">
                      <td className="px-sm py-2">
                        <select 
                          value={item.product_id}
                          onChange={e => handleItemChange(item.ui_id, 'product_id', e.target.value)}
                          className="w-full px-2 py-1 bg-surface border border-outline-variant rounded text-sm focus:border-primary outline-none"
                        >
                          <option value="">Select Product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Tray:{p.boxes_per_tray||'-'}B | Box:{p.pieces_per_box||'-'}P)</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-sm py-2">
                        <input 
                          type="number" min="0" value={item.tray_qty === 0 ? '' : item.tray_qty} 
                          onChange={e => handleItemChange(item.ui_id, 'tray_qty', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-center border border-outline-variant rounded text-sm focus:border-primary outline-none"
                        />
                      </td>
                      <td className="px-sm py-2">
                        <input 
                          type="number" min="0" value={item.box_qty === 0 ? '' : item.box_qty} 
                          onChange={e => handleItemChange(item.ui_id, 'box_qty', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-center border border-outline-variant rounded text-sm focus:border-primary outline-none"
                        />
                      </td>
                      <td className="px-sm py-2">
                        <input 
                          type="number" min="0" value={item.piece_qty === 0 ? '' : item.piece_qty} 
                          onChange={e => handleItemChange(item.ui_id, 'piece_qty', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-center border border-outline-variant rounded text-sm focus:border-primary outline-none"
                        />
                      </td>
                      <td className="px-sm py-2">
                        <input 
                          type="number" min="0" step="0.01" value={item.cost === 0 ? '' : item.cost} 
                          onChange={e => handleItemChange(item.ui_id, 'cost', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-right border border-outline-variant rounded text-sm focus:border-primary outline-none"
                        />
                      </td>
                      <td className="px-sm py-2 text-center">
                        <button 
                          onClick={() => handleRemoveItem(item.ui_id)}
                          className="text-error hover:bg-error/10 p-1 rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="flex flex-col gap-sm md:hidden mt-2">
            {items.length === 0 ? (
              <div className="p-md text-center text-on-surface-variant text-sm border border-outline-variant rounded-xl">No items added yet. Click 'Add Row'.</div>
            ) : (
              items.map((item) => (
                <div key={item.ui_id} className="bg-surface border border-outline-variant rounded-xl p-sm flex flex-col gap-sm relative">
                  <button 
                    onClick={() => handleRemoveItem(item.ui_id)}
                    className="absolute top-2 right-2 text-error p-1 bg-error/10 hover:bg-error/20 rounded-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                  
                  <div className="pr-8">
                    <label className="text-[10px] text-on-surface-variant uppercase font-medium">Product Name</label>
                    <select 
                      value={item.product_id}
                      onChange={e => handleItemChange(item.ui_id, 'product_id', e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:border-primary outline-none"
                    >
                      <option value="">Select Product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-on-surface-variant uppercase font-medium">Trays</label>
                      <input 
                        type="number" min="0" value={item.tray_qty === 0 ? '' : item.tray_qty} 
                        onChange={e => handleItemChange(item.ui_id, 'tray_qty', parseInt(e.target.value) || 0)}
                        className="w-full mt-1 px-2 py-1.5 text-center border border-outline-variant rounded-lg text-sm focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-on-surface-variant uppercase font-medium">Boxes</label>
                      <input 
                        type="number" min="0" value={item.box_qty === 0 ? '' : item.box_qty} 
                        onChange={e => handleItemChange(item.ui_id, 'box_qty', parseInt(e.target.value) || 0)}
                        className="w-full mt-1 px-2 py-1.5 text-center border border-outline-variant rounded-lg text-sm focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-on-surface-variant uppercase font-medium">Pieces</label>
                      <input 
                        type="number" min="0" value={item.piece_qty === 0 ? '' : item.piece_qty} 
                        onChange={e => handleItemChange(item.ui_id, 'piece_qty', parseInt(e.target.value) || 0)}
                        className="w-full mt-1 px-2 py-1.5 text-center border border-outline-variant rounded-lg text-sm focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-on-surface-variant uppercase font-medium">Cost (₹)</label>
                    <input 
                      type="number" min="0" step="0.01" value={item.cost === 0 ? '' : item.cost} 
                      onChange={e => handleItemChange(item.ui_id, 'cost', parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 text-left border border-outline-variant rounded-lg text-sm focus:border-primary outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mt-sm">
          {/* Payment Section */}
          <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/30 flex flex-col gap-sm">
            <h3 className="font-label-lg font-bold text-on-surface mb-xs border-b border-outline-variant pb-2">Payment Details</h3>
            
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-on-surface-variant">Auto Total Sum (₹)</label>
               <span className="font-bold">{calculatedTotalAmount.toLocaleString('en-IN')}</span>
            </div>
            
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-on-surface-variant">Manual Override (₹)</label>
               <input 
                 type="number" 
                 min="0"
                 placeholder="Optional"
                 value={totalAmountOverride} 
                 onChange={e => setTotalAmountOverride(e.target.value)}
                 className="w-32 px-2 py-1 text-right bg-surface border border-outline-variant rounded text-sm focus:border-primary outline-none"
               />
            </div>
            
            <div className="h-px bg-outline-variant/50 my-1"></div>
            
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-on-surface-variant">Cash Paid (₹)</label>
               <input 
                 type="number" min="0" value={cashAmount} 
                 onChange={e => setCashAmount(e.target.value)}
                 className="w-32 px-2 py-1 text-right bg-surface border border-outline-variant rounded text-sm focus:border-primary outline-none"
               />
            </div>
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-on-surface-variant">Online Paid (₹)</label>
               <input 
                 type="number" min="0" value={onlineAmount} 
                 onChange={e => setOnlineAmount(e.target.value)}
                 className="w-32 px-2 py-1 text-right bg-surface border border-outline-variant rounded text-sm focus:border-primary outline-none"
               />
            </div>
            
            <div className="flex items-center justify-between bg-primary/10 p-2 rounded-lg mt-1">
               <label className="text-sm font-bold text-primary">Total Paid (₹)</label>
               <span className="font-bold text-primary">{totalPaid.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Notes & Actions */}
          <div className="flex flex-col gap-md">
            <div>
              <label className="block font-label-md text-on-surface-variant mb-xs">Notes</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Supplier name, remarks, etc."
                rows={4}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md outline-none focus:border-primary resize-y"
              />
            </div>
            
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full py-md bg-primary text-on-primary rounded-xl font-label-lg font-bold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 mt-auto shadow-md"
            >
              {saving ? 'Saving...' : '📦 Save Purchase & Update Stock'}
            </button>
          </div>
        </div>

      </div>

      {/* HISTORY */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/50 overflow-hidden mt-md mb-xl">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full p-md flex justify-between items-center bg-surface-container-low hover:bg-surface-container transition-colors"
        >
          <h3 className="font-headline-sm font-bold text-on-surface">Purchase History {showHistory ? '▼' : '▶'}</h3>
          <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">{purchases.length} Records</span>
        </button>
        
        {showHistory && (
          <div className="p-0 border-t border-outline-variant/50">
            {purchases.length === 0 ? (
              <div className="p-xl text-center text-on-surface-variant">No purchases recorded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Purchase #</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Date</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Total Amount</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Cash Paid</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Online Paid</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Notes</th>
                      <th className="px-md py-sm font-label-md text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 bg-surface">
                    {purchases.map(purchase => (
                      <tr key={purchase.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-md py-sm font-body-md font-bold text-primary">{purchase.purchase_number || '-'}</td>
                        <td className="px-md py-sm font-body-md font-medium">{new Date(purchase.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-md py-sm font-body-md font-bold text-on-surface">₹{purchase.total_amount?.toLocaleString('en-IN')}</td>
                        <td className="px-md py-sm text-sm text-green-600">₹{purchase.cash_amount}</td>
                        <td className="px-md py-sm text-sm text-blue-600">₹{purchase.online_amount}</td>
                        <td className="px-md py-sm text-sm text-on-surface-variant truncate max-w-[150px]">{purchase.notes}</td>
                        <td className="px-md py-sm text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button 
                              onClick={() => handleDelete(purchase.id)}
                              className="text-error hover:bg-error/10 px-2 py-1 rounded transition-colors text-sm font-medium flex items-center gap-1 border border-transparent hover:border-error/20"
                              title="Delete Purchase"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                            <span className="text-[9px] text-on-surface-variant leading-tight">Stock won't<br/>auto-adjust</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
