'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function PurchasesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // Received Items: { product_id: { trays: number, pieces: number } }
  const [receivedItems, setReceivedItems] = useState<Record<string, { trays: number, pieces: number }>>({});
  
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
      supabase.from('purchases').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    ]);
    
    if (productsRes.data) setProducts(productsRes.data);
    if (purchasesRes.data) setPurchases(purchasesRes.data);
    setLoading(false);
  };

  const handleItemChange = (productId: string, field: 'trays' | 'pieces', value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10) || 0;
    setReceivedItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId] || { trays: 0, pieces: 0 },
        [field]: numValue
      }
    }));
  };

  const handleClearAll = () => {
    setReceivedItems({});
  };

  const handleSelectAll = () => {
    const newItems: any = {};
    products.forEach(p => {
      newItems[p.id] = { trays: 1, pieces: 0 };
    });
    setReceivedItems(newItems);
  };

  const handleSave = async () => {
    if (!date) return toast.error('Date is required');
    if (!totalAmount) return toast.error('Total Amount is required');
    
    const amount = Number(totalAmount);
    const cash = Number(cashAmount) || 0;
    const online = Number(onlineAmount) || 0;
    
    if (cash + online !== amount) {
      toast.error('Warning: Cash + Online does not equal Total Amount', { duration: 4000 });
      // Don't return, allow save
    }

    const itemsToSave = [];
    for (const product of products) {
      const received = receivedItems[product.id];
      if (received && (received.trays > 0 || received.pieces > 0)) {
        itemsToSave.push({
          product_id: product.id,
          product_name: product.name,
          trays_received: received.trays,
          pieces_received: received.pieces
        });
      }
    }

    if (itemsToSave.length === 0) {
      return toast.error('Please add at least one product with trays or pieces received');
    }

    setSaving(true);

    try {
      // 1. Save to purchases table
      const { error: purchaseError } = await (supabase as any).from('purchases').insert([{
        date,
        total_amount: amount,
        cash_amount: cash,
        online_amount: online,
        notes,
        items: itemsToSave
      }]);

      if (purchaseError) throw purchaseError;

      // 2. Update stock for each product
      for (const item of itemsToSave) {
        const product = products.find(p => p.id === item.product_id);
        if (!product) continue;

        const ppb = product.units_per_box || 0;
        let newBoxes = 0;
        let newPieces = 0;

        if (ppb > 0) {
          const addedPieces = (item.trays_received * ppb) + item.pieces_received;
          const currentTotalPieces = (Number(product.stock_boxes || 0) * ppb) + Number(product.stock_pieces || 0);
          const totalPieces = currentTotalPieces + addedPieces;
          
          newBoxes = Math.floor(totalPieces / ppb);
          newPieces = totalPieces % ppb;
        } else {
          newBoxes = Number(product.stock_boxes || 0) + item.trays_received;
          newPieces = Number(product.stock_pieces || 0) + item.pieces_received;
        }

        await (supabase as any).from('products').update({
          stock_boxes: newBoxes,
          stock_pieces: newPieces
        }).eq('id', product.id);
      }

      toast.success(`Purchase saved! Stock updated for ${itemsToSave.length} products.`);
      
      // Reset form
      setDate(new Date().toISOString().split('T')[0]);
      setTotalAmount('');
      setCashAmount('');
      setOnlineAmount('');
      setNotes('');
      setReceivedItems({});
      
      // Refresh
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error saving purchase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-xl text-center text-on-surface-variant animate-pulse">Loading...</div>;
  }

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md sticky top-16 md:top-0 bg-background z-20">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Company Purchase Entry</h2>
          <p className="font-body-md text-on-surface-variant">Vadilal se aaya maal record karo</p>
        </div>
      </div>

      {/* FORM */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg border border-outline-variant/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div>
            <label className="block font-label-md text-on-surface-variant mb-xs">Date *</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-label-md text-on-surface-variant mb-xs">Total Amount (₹) *</label>
            <input 
              type="text" 
              inputMode="numeric" 
              placeholder="Kitne ka maal aaya?"
              value={totalAmount} 
              onChange={e => {
                if (e.target.value === '' || /^\d+$/.test(e.target.value)) setTotalAmount(e.target.value);
              }}
              className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="block font-label-md text-on-surface-variant mb-xs">Payment Mode Breakdown</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md bg-surface-container-low p-md rounded-xl border border-outline-variant/30">
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1">Cash (₹)</label>
              <input 
                type="text" 
                inputMode="numeric" 
                value={cashAmount} 
                onChange={e => {
                  if (e.target.value === '' || /^\d+$/.test(e.target.value)) setCashAmount(e.target.value);
                }}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1">Online (₹)</label>
              <input 
                type="text" 
                inputMode="numeric" 
                value={onlineAmount} 
                onChange={e => {
                  if (e.target.value === '' || /^\d+$/.test(e.target.value)) setOnlineAmount(e.target.value);
                }}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block font-label-sm text-on-surface-variant mb-1">Total Calculated</label>
              <div className="w-full px-sm py-xs bg-surface-variant rounded-lg font-body-md font-bold flex items-center h-[42px]">
                ₹ {(Number(cashAmount) || 0) + (Number(onlineAmount) || 0)}
              </div>
            </div>
          </div>
          {(Number(cashAmount) || 0) + (Number(onlineAmount) || 0) !== Number(totalAmount) && totalAmount !== '' && (
            <p className="text-error text-xs mt-1 font-medium">Warning: Cash + Online does not match Total Amount</p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-end mb-sm">
            <label className="block font-label-md text-on-surface-variant font-bold">Kaunsa maal aaya?</label>
            <div className="flex gap-sm">
              <button onClick={handleSelectAll} className="text-primary text-sm hover:underline font-medium">Select All</button>
              <button onClick={handleClearAll} className="text-error text-sm hover:underline font-medium">Clear All</button>
            </div>
          </div>
          
          <div className="border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="max-h-[400px] overflow-y-auto bg-surface">
              {products.map(p => {
                const received = receivedItems[p.id] || { trays: 0, pieces: 0 };
                const isSelected = received.trays > 0 || received.pieces > 0;
                
                return (
                  <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-sm border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <div className="flex-1 font-body-md font-medium text-on-surface mb-2 sm:mb-0">
                      {p.name}
                      <span className="text-xs text-on-surface-variant block sm:inline sm:ml-2">
                        (Current: {p.stock_boxes || 0}B, {p.stock_pieces || 0}P)
                      </span>
                    </div>
                    <div className="flex items-center gap-sm sm:w-[300px]">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant w-10">Trays:</span>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          value={received.trays || ''}
                          onChange={e => handleItemChange(p.id, 'trays', e.target.value)}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center border border-outline-variant rounded focus:border-primary outline-none"
                        />
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant w-10">Pcs:</span>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          value={received.pieces || ''}
                          onChange={e => handleItemChange(p.id, 'pieces', e.target.value)}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center border border-outline-variant rounded focus:border-primary outline-none"
                        />
                      </div>
                      <div className="w-8 flex justify-center">
                        {isSelected && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="block font-label-md text-on-surface-variant mb-xs">Koi note likhna ho toh... (Optional)</label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md outline-none focus:border-primary resize-y"
          />
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full py-md bg-primary text-on-primary rounded-xl font-label-lg font-bold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 mt-sm shadow-md"
        >
          {saving ? 'Saving...' : '📦 Save Purchase & Update Stock'}
        </button>
      </div>

      {/* HISTORY */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/50 overflow-hidden mt-md">
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
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Date</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Total Amount</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Payment Mode</th>
                      <th className="px-md py-sm font-label-md text-on-surface-variant">Items Received</th>
                      <th className="px-md py-sm font-label-md text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 bg-surface">
                    {purchases.map(purchase => {
                      const items = purchase.items || [];
                      return (
                        <tr key={purchase.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-md py-sm font-body-md font-medium">{new Date(purchase.date).toLocaleDateString('en-IN')}</td>
                          <td className="px-md py-sm font-body-md font-bold text-primary">₹{purchase.total_amount?.toLocaleString('en-IN')}</td>
                          <td className="px-md py-sm text-sm">
                            <span className="text-green-600">Cash: ₹{purchase.cash_amount}</span><br/>
                            <span className="text-blue-600">Online: ₹{purchase.online_amount}</span>
                          </td>
                          <td className="px-md py-sm text-sm text-on-surface-variant">
                            {items.length} products
                          </td>
                          <td className="px-md py-sm text-center">
                            <button 
                              onClick={() => setViewPurchase(purchase)}
                              className="text-primary hover:bg-primary/10 px-3 py-1 rounded transition-colors text-sm font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL */}
      {viewPurchase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-md bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">
            <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <h3 className="font-headline-sm font-bold">Purchase Details</h3>
              <button 
                onClick={() => setViewPurchase(null)}
                className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors"
              >
                close
              </button>
            </div>
            
            <div className="p-md flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-md mb-lg bg-surface-container-low p-md rounded-xl">
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Date</p>
                  <p className="font-bold text-lg">{new Date(viewPurchase.date).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Total Amount</p>
                  <p className="font-bold text-lg text-primary">₹{viewPurchase.total_amount?.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Payment Breakdown</p>
                  <p className="text-sm font-medium">Cash: <span className="text-green-600">₹{viewPurchase.cash_amount}</span></p>
                  <p className="text-sm font-medium">Online: <span className="text-blue-600">₹{viewPurchase.online_amount}</span></p>
                </div>
                {viewPurchase.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm italic bg-surface p-2 rounded border border-outline-variant/30">{viewPurchase.notes}</p>
                  </div>
                )}
              </div>

              <h4 className="font-label-lg font-bold mb-sm border-b border-outline-variant pb-2">Products Received</h4>
              <table className="w-full text-left border-collapse border border-outline-variant rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-sm py-2 text-sm text-on-surface-variant">Product</th>
                    <th className="px-sm py-2 text-sm text-center text-on-surface-variant">Trays/Boxes</th>
                    <th className="px-sm py-2 text-sm text-center text-on-surface-variant">Pieces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {viewPurchase.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-container-lowest">
                      <td className="px-sm py-2 font-medium text-sm">{item.product_name}</td>
                      <td className="px-sm py-2 text-center text-sm font-bold text-primary">{item.trays_received || 0}</td>
                      <td className="px-sm py-2 text-center text-sm font-bold text-primary">{item.pieces_received || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-md border-t border-outline-variant bg-surface-container-lowest flex justify-end">
              <button 
                onClick={() => setViewPurchase(null)}
                className="px-lg py-sm bg-surface border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
