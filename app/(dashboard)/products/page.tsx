'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals for editing name/prices
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    price_per_box: '',
    price_per_piece: '',
    pieces_per_box: '',
    hsn_code: '',
    is_active: true,
  });

  // Inline Stock Updates
  const [stockUpdates, setStockUpdates] = useState<Record<string, { stock_boxes: number; stock_pieces: number }>>({});
  const [savingStock, setSavingStock] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, created_at, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, is_active')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setProducts(data);
      // Initialize stock updates with current values
      const initialStock: Record<string, { stock_boxes: number; stock_pieces: number }> = {};
      data.forEach((p: any) => {
        initialStock[p.id] = { 
          stock_boxes: p.stock_boxes || 0, 
          stock_pieces: p.stock_pieces || 0 
        };
      });
      setStockUpdates(initialStock);
    }
    setLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    setSaving(true);
    const payload = {
      name: formData.name,
      price_per_box: formData.price_per_box ? parseFloat(formData.price_per_box) : null,
      price_per_piece: formData.price_per_piece ? parseFloat(formData.price_per_piece) : null,
      pieces_per_box: formData.pieces_per_box ? parseInt(formData.pieces_per_box) : null,
      hsn_code: formData.hsn_code,
      is_active: formData.is_active,
    };

    let error;
    if (editingId) {
      const res = await (supabase as any).from('products').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('products').insert([{ ...payload, stock_boxes: 0, stock_pieces: 0 }]);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error(error.message || 'Failed to save product');
      return;
    }

    toast.success(editingId ? 'Product updated successfully' : 'Product added successfully');
    setIsFormOpen(false);
    setEditingId(null);
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price_per_box: product.price_per_box ? product.price_per_box.toString() : '',
      price_per_piece: product.price_per_piece ? product.price_per_piece.toString() : '',
      pieces_per_box: product.pieces_per_box ? product.pieces_per_box.toString() : '',
      hsn_code: product.hsn_code || '',
      is_active: product.is_active,
    });
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setFormData({
      name: '',
      price_per_box: '',
      price_per_piece: '',
      pieces_per_box: '',
      hsn_code: '',
      is_active: true,
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const PRICE_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];

  const handleStockChange = (id: string, field: 'stock_boxes' | 'stock_pieces', value: string) => {
    const numValue = value === '' ? 0 : parseInt(value);
    setStockUpdates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: numValue
      }
    }));
  };

  const saveStockUpdates = async () => {
    // Find what changed
    const changedProducts = products.filter(p => {
      const update = stockUpdates[p.id];
      if (!update) return false;
      return update.stock_boxes !== (p.stock_boxes || 0) || update.stock_pieces !== (p.stock_pieces || 0);
    });

    if (changedProducts.length === 0) {
      toast('No stock changes to save.', { icon: 'ℹ️' });
      return;
    }

    setSavingStock(true);
    
    // We update sequentially or Promise.all. 
    // Since there could be a few, Promise.all is faster.
    const promises = changedProducts.map(p => {
      const update = stockUpdates[p.id];
      return (supabase as any).from('products').update({
        stock_boxes: update.stock_boxes,
        stock_pieces: update.stock_pieces
      }).eq('id', p.id);
    });

    const results = await Promise.all(promises);
    const hasError = results.some(r => r.error);

    setSavingStock(false);

    if (hasError) {
      toast.error('Failed to update some stock values');
    } else {
      toast.success('Stock updated successfully');
    }
    fetchProducts();
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasUnsavedChanges = products.some(p => {
    const update = stockUpdates[p.id];
    if (!update) return false;
    return update.stock_boxes !== (p.stock_boxes || 0) || update.stock_pieces !== (p.stock_pieces || 0);
  });

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md sticky top-0 bg-surface-container-lowest z-10">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Products & Stock</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage catalog prices and inline inventory updates.</p>
        </div>
        <div className="flex gap-sm w-full sm:w-auto">
          {hasUnsavedChanges && (
            <button
              onClick={saveStockUpdates}
              disabled={savingStock}
              className="flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-all shadow-sm animate-fade-in flex-1 sm:flex-none"
            >
              <span className="material-symbols-outlined text-[18px]">save</span> 
              {savingStock ? 'Saving...' : 'Save Stock Changes'}
            </button>
          )}
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-xs px-lg py-sm border border-primary text-primary font-label-md rounded-xl hover:bg-primary-container transition-all flex-1 sm:flex-none"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Add Product
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-surface-container-lowest p-xl rounded-2xl shadow-sm border border-outline-variant relative animate-fade-in">
          <button 
            onClick={() => setIsFormOpen(false)}
            className="absolute top-md right-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 p-sm rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">{editingId ? 'Edit Product Details' : 'Add New Product'}</h3>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-y-lg gap-x-md sm:grid-cols-2">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Product Name *</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Ek Box mein kitne pieces?</label>
              <input type="number" min="1" value={formData.pieces_per_box} onChange={e => setFormData({...formData, pieces_per_box: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">HSN Code</label>
              <input type="text" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Box (₹)</label>
              <input type="number" step="0.01" value={formData.price_per_box} onChange={e => setFormData({...formData, price_per_box: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Piece (₹)</label>
              <input type="number" step="0.01" value={formData.price_per_piece} onChange={e => setFormData({...formData, price_per_piece: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              <div className="flex flex-wrap gap-2 mt-sm">
                {PRICE_PRESETS.map(price => (
                  <button 
                    key={price} 
                    type="button" 
                    onClick={() => setFormData({...formData, price_per_piece: price.toString()})}
                    className={`px-3 py-1 text-sm font-medium rounded-lg border transition-colors ${formData.price_per_piece === price.toString() ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                  >
                    ₹{price}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex items-center mt-xs bg-surface-container-low p-md rounded-xl border border-outline-variant/50 w-fit">
              <input type="checkbox" id="is_active_prod" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
              <label htmlFor="is_active_prod" className="ml-sm block font-body-md text-body-md text-on-surface cursor-pointer">Available in System</label>
            </div>
            <div className="sm:col-span-2 mt-sm flex justify-end border-t border-outline-variant/30 pt-md">
              <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Update Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 animate-fade-in mb-xl">
        <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
          <div className="relative w-full sm:w-auto">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-xl pr-sm py-sm w-full sm:w-64 bg-surface-container-low border border-outline-variant rounded-xl font-body-sm text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-outline-variant/30">
          {loading ? (
            <div className="p-md text-center text-on-surface-variant">Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-md text-center text-on-surface-variant">No products found.</div>
          ) : (
            filteredProducts.map((product) => {
              const currentStockBoxes = stockUpdates[product.id]?.stock_boxes ?? (product.stock_boxes || 0);
              const currentStockPieces = stockUpdates[product.id]?.stock_pieces ?? (product.stock_pieces || 0);
              const isChanged = currentStockBoxes !== (product.stock_boxes || 0) || currentStockPieces !== (product.stock_pieces || 0);

              return (
                <div key={product.id} className={`p-md flex flex-col gap-sm transition-all ${!product.is_active ? 'opacity-60 bg-surface-container/30' : 'bg-surface'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-primary text-[16px] flex items-center gap-2">
                        {product.name}
                        {isChanged && <span className="w-2 h-2 rounded-full bg-primary"></span>}
                      </div>
                      <div className="text-on-surface-variant text-xs mt-xs uppercase tracking-wider">
                        Box: ₹{product.price_per_box || '-'} • Pcs: ₹{product.price_per_piece || '-'}
                      </div>
                    </div>
                    <div>
                      <button onClick={() => handleEdit(product)} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center bg-surface-container-lowest border border-outline-variant">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface-container-low p-sm rounded-xl mt-sm border border-outline-variant/50">
                     <p className="text-xs text-on-surface-variant mb-2 font-medium uppercase tracking-wider">Inline Stock Update</p>
                     <div className="flex gap-md items-center">
                        <div className="flex-1">
                          <label className="text-xs text-on-surface-variant block mb-1">Boxes</label>
                          <input 
                            type="number" 
                            min="0"
                            value={stockUpdates[product.id]?.stock_boxes ?? ''} 
                            onChange={(e) => handleStockChange(product.id, 'stock_boxes', e.target.value)}
                            className={`w-full px-sm py-xs rounded-lg text-sm border focus:outline-none focus:border-primary ${currentStockBoxes < 5 ? 'border-error/50 bg-error/5' : 'border-outline-variant bg-surface-container-lowest'}`}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-on-surface-variant block mb-1">Pieces</label>
                          <input 
                            type="number" 
                            min="0"
                            value={stockUpdates[product.id]?.stock_pieces ?? ''} 
                            onChange={(e) => handleStockChange(product.id, 'stock_pieces', e.target.value)}
                            className="w-full px-sm py-xs rounded-lg text-sm border border-outline-variant bg-surface-container-lowest focus:outline-none focus:border-primary"
                          />
                        </div>
                     </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Product Name</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Prices</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm w-40">Stock Boxes</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm w-40">Stock Pieces</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-center">Status</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={6} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="px-md py-lg text-center text-on-surface-variant">No products found.</td></tr>
              ) : (
                filteredProducts.map((product) => {
                  const currentStockBoxes = stockUpdates[product.id]?.stock_boxes ?? (product.stock_boxes || 0);
                  const isChanged = currentStockBoxes !== (product.stock_boxes || 0) || (stockUpdates[product.id]?.stock_pieces ?? (product.stock_pieces || 0)) !== (product.stock_pieces || 0);

                  return (
                    <tr key={product.id} className={`transition-all ${!product.is_active ? 'opacity-60 bg-surface-container/20' : 'hover:bg-surface-container-low'}`}>
                      <td className="px-md py-sm font-medium text-primary">
                        <div className="flex items-center gap-2">
                           {product.name}
                           {isChanged && <span className="w-2 h-2 rounded-full bg-primary" title="Unsaved changes"></span>}
                        </div>
                      </td>
                      <td className="px-md py-sm text-on-surface-variant text-sm">
                        B: ₹{product.price_per_box || '-'} <br/> P: ₹{product.price_per_piece || '-'}
                      </td>
                      <td className="px-md py-sm">
                        <input 
                          type="number" 
                          min="0"
                          value={stockUpdates[product.id]?.stock_boxes ?? ''} 
                          onChange={(e) => handleStockChange(product.id, 'stock_boxes', e.target.value)}
                          className={`w-24 px-sm py-xs rounded-lg text-sm border focus:outline-none focus:border-primary transition-colors ${currentStockBoxes < 5 ? 'border-error/50 bg-error/5 text-error font-medium' : 'border-outline-variant bg-surface'}`}
                        />
                      </td>
                      <td className="px-md py-sm">
                        <input 
                          type="number" 
                          min="0"
                          value={stockUpdates[product.id]?.stock_pieces ?? ''} 
                          onChange={(e) => handleStockChange(product.id, 'stock_pieces', e.target.value)}
                          className="w-24 px-sm py-xs rounded-lg text-sm border border-outline-variant bg-surface focus:outline-none focus:border-primary transition-colors"
                        />
                      </td>
                      <td className="px-md py-sm text-center">
                        <span className={`inline-block px-sm py-xs text-[11px] font-bold rounded-xl uppercase tracking-wide ${product.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-md py-sm text-right">
                        <button onClick={() => handleEdit(product)} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors inline-flex border border-transparent hover:border-primary/20">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
