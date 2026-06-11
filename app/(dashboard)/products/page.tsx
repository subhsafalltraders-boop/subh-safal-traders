'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';

const DELETE_PASSWORD = '1234';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Delete modal state
  const [deletePasswordModal, setDeletePasswordModal] = useState<{ open: boolean; productId: string; productName: string }>({
    open: false, productId: '', productName: '',
  });
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; productId: string; productName: string }>({
    open: false, productId: '', productName: '',
  });
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    price_per_box: '',
    price_per_piece: '',
    pieces_per_box: '',
    hsn_code: '',
    is_active: true,
    is_party_pack: false,
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
      .select('id, created_at, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, is_active, is_party_pack')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setProducts(data);
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

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        price_per_box: Number(formData.price_per_box || 0),
        price_per_piece: Number(formData.price_per_piece || 0),
        pieces_per_box: Number(formData.pieces_per_box || 0),
        hsn_code: formData.hsn_code || '',
        is_party_pack: formData.is_party_pack || false,
        is_active: formData.is_active,
      };

      let error;
      if (editingId) {
        const res = await (supabase as any)
          .from('products')
          .update(payload)
          .eq('id', editingId);
        error = res.error;
      } else {
        const res = await (supabase as any)
          .from('products')
          .insert([{ ...payload, stock_boxes: 0, stock_pieces: 0 }]);
        error = res.error;
      }

      if (error) throw error;

      toast.success(editingId ? 'Product updated!' : 'Product added!');
      setIsFormOpen(false);
      setEditingId(null);
      fetchProducts();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Failed to save product'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price_per_box: product.price_per_box ? product.price_per_box.toString() : '',
      price_per_piece: product.price_per_piece ? product.price_per_piece.toString() : '',
      pieces_per_box: product.pieces_per_box ? product.pieces_per_box.toString() : '',
      hsn_code: product.hsn_code || '',
      is_active: product.is_active,
      is_party_pack: product.is_party_pack || false,
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
      is_party_pack: false,
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  // ---- Delete flow ----
  const handleDeleteClick = (product: Product) => {
    setDeletePassword('');
    setDeletePasswordError('');
    setDeletePasswordModal({ open: true, productId: product.id, productName: product.name });
  };

  const handlePasswordSubmit = () => {
    if (deletePassword === DELETE_PASSWORD) {
      setDeletePasswordModal({ open: false, productId: '', productName: '' });
      setDeleteConfirmModal({
        open: true,
        productId: deletePasswordModal.productId,
        productName: deletePasswordModal.productName,
      });
    } else {
      setDeletePasswordError('Galat password! Sahi password daalo.');
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', deleteConfirmModal.productId);

    if (error) {
      toast.error('Delete failed: ' + error.message);
    } else {
      toast.success('Product delete ho gaya!');
      setProducts(prev => prev.filter(p => p.id !== deleteConfirmModal.productId));
    }
    setDeleting(false);
    setDeleteConfirmModal({ open: false, productId: '', productName: '' });
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
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Products &amp; Stock</h2>
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

      {/* ── Edit / Add Modal ── */}
      {isFormOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setIsFormOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 999,
            }}
          />
          {/* Modal */}
          <div
            id="edit-product-form"
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'white',
              borderRadius: '16px',
              padding: '28px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
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
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.pieces_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, pieces_per_box: val});
                }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">HSN Code</label>
                <input type="text" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Box (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, price_per_box: val});
                }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Piece (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_piece} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, price_per_piece: val});
                }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
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
              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4 mt-xs">
                <div className="flex items-center bg-surface-container-low p-md rounded-xl border border-outline-variant/50 flex-1">
                  <input type="checkbox" id="is_active_prod" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
                  <label htmlFor="is_active_prod" className="ml-sm block font-body-md text-body-md text-on-surface cursor-pointer">Available in System</label>
                </div>
                <div className="flex items-center bg-surface-container-low p-md rounded-xl border border-outline-variant/50 flex-1">
                  <input type="checkbox" id="is_party_pack_prod" checked={formData.is_party_pack} onChange={e => setFormData({...formData, is_party_pack: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
                  <label htmlFor="is_party_pack_prod" className="ml-sm block font-body-md text-body-md text-on-surface cursor-pointer">This is a Party Pack / Family Pack</label>
                </div>
              </div>
              <div className="sm:col-span-2 mt-sm flex justify-end border-t border-outline-variant/30 pt-md">
                <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Delete Password Modal ── */}
      {deletePasswordModal.open && (
        <>
          <div
            onClick={() => setDeletePasswordModal({ open: false, productId: '', productName: '' })}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000, background: 'white', borderRadius: '16px',
            padding: '28px', width: '90%', maxWidth: '400px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 className="font-headline-sm text-on-surface mb-xs">🔒 Delete Product</h3>
            <p className="text-sm text-on-surface-variant mb-md">
              <strong>"{deletePasswordModal.productName}"</strong> delete karne ke liye password daalo.
            </p>
            <input
              type="password"
              autoFocus
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeletePasswordError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-error focus:ring-1 focus:ring-error focus:outline-none transition-all mb-sm"
              placeholder="Password"
            />
            {deletePasswordError && (
              <p className="text-error text-sm mb-sm">{deletePasswordError}</p>
            )}
            <div className="flex gap-sm justify-end mt-sm">
              <button
                onClick={() => setDeletePasswordModal({ open: false, productId: '', productName: '' })}
                className="px-lg py-sm border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-container-low transition-colors font-label-md"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-lg py-sm bg-error text-white rounded-xl hover:bg-error/90 transition-colors font-label-md"
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirmModal.open && (
        <>
          <div
            onClick={() => !deleting && setDeleteConfirmModal({ open: false, productId: '', productName: '' })}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000, background: 'white', borderRadius: '16px',
            padding: '28px', width: '90%', maxWidth: '420px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 className="font-headline-sm text-error mb-sm">⚠️ Confirm Delete</h3>
            <p className="text-sm text-on-surface mb-sm">
              <strong>"{deleteConfirmModal.productName}"</strong> delete karna chahte ho?
            </p>
            <div className="bg-error/5 border border-error/20 rounded-xl p-md mb-md">
              <p className="text-sm text-on-surface">
                Ye product permanently delete ho jaayega. Iske saare bill records mein product naam saved hai, woh safe rahenge.
              </p>
            </div>
            <div className="flex gap-sm justify-end">
              <button
                disabled={deleting}
                onClick={() => setDeleteConfirmModal({ open: false, productId: '', productName: '' })}
                className="px-lg py-sm border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-container-low transition-colors font-label-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-lg py-sm bg-error text-white rounded-xl hover:bg-error/90 transition-colors font-label-md disabled:opacity-50 flex items-center gap-xs"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                {deleting ? 'Deleting...' : 'Haan, Delete Karo'}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 animate-fade-in mb-xl">
        <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
          <div className="relative w-full sm:w-auto">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>search</span>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-sm py-sm !pl-10 w-full sm:w-64 bg-surface-container-low border border-outline-variant rounded-xl font-body-sm text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
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
                      <div className="font-medium text-primary text-[16px] flex items-center gap-2 flex-wrap">
                        {product.name}
                        {(product.stock_boxes || 0) === 0 && <span className="px-2 py-0.5 bg-error text-white text-[10px] font-bold rounded-full">Out of Stock</span>}
                        {(product.stock_boxes || 0) > 0 && (product.stock_boxes || 0) <= 15 && <span className="px-2 py-0.5 bg-[#FF9800] text-white text-[10px] font-bold rounded-full">⚠️ Low</span>}
                        {isChanged && <span className="w-2 h-2 rounded-full bg-primary"></span>}
                      </div>
                      <div className="text-on-surface-variant text-xs mt-xs uppercase tracking-wider">
                        Box: ₹{product.price_per_box || '-'} • Pcs: ₹{product.price_per_piece || '-'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(product)} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center bg-surface-container-lowest border border-outline-variant">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button onClick={() => handleDeleteClick(product)} className="text-error hover:bg-error/10 p-2 rounded-full transition-colors flex items-center bg-surface-container-lowest border border-outline-variant">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface-container-low p-sm rounded-xl mt-sm border border-outline-variant/50">
                     <p className="text-xs text-on-surface-variant mb-2 font-medium uppercase tracking-wider">Inline Stock Update</p>
                     <div className="flex gap-md items-center">
                        <div className="flex-1">
                          <label className="text-xs text-on-surface-variant block mb-1">Boxes</label>
                          <input 
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            value={stockUpdates[product.id]?.stock_boxes ?? ''} 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) handleStockChange(product.id, 'stock_boxes', val);
                            }}
                            className={`w-full px-sm py-xs rounded-lg text-sm border focus:outline-none focus:border-primary ${currentStockBoxes < 5 ? 'border-error/50 bg-error/5' : 'border-outline-variant bg-surface-container-lowest'}`}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-on-surface-variant block mb-1">Pieces</label>
                          <input 
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            value={stockUpdates[product.id]?.stock_pieces ?? ''} 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) handleStockChange(product.id, 'stock_pieces', val);
                            }}
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
                           {(product.stock_boxes || 0) === 0 && <span className="px-2 py-0.5 bg-error text-white text-[10px] font-bold rounded-full">Out of Stock</span>}
                           {(product.stock_boxes || 0) > 0 && (product.stock_boxes || 0) <= 15 && <span className="px-2 py-0.5 bg-[#FF9800] text-white text-[10px] font-bold rounded-full">⚠️ Low Stock</span>}
                           {isChanged && <span className="w-2 h-2 rounded-full bg-primary" title="Unsaved changes"></span>}
                        </div>
                      </td>
                      <td className="px-md py-sm text-on-surface-variant text-sm">
                        B: ₹{product.price_per_box || '-'} <br/> P: ₹{product.price_per_piece || '-'}
                      </td>
                      <td className="px-md py-sm">
                        <input 
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={stockUpdates[product.id]?.stock_boxes ?? ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) handleStockChange(product.id, 'stock_boxes', val);
                          }}
                          className={`w-24 px-sm py-xs rounded-lg text-sm border focus:outline-none focus:border-primary transition-colors ${currentStockBoxes < 5 ? 'border-error/50 bg-error/5 text-error font-medium' : 'border-outline-variant bg-surface'}`}
                        />
                      </td>
                      <td className="px-md py-sm">
                        <input 
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={stockUpdates[product.id]?.stock_pieces ?? ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) handleStockChange(product.id, 'stock_pieces', val);
                          }}
                          className="w-24 px-sm py-xs rounded-lg text-sm border border-outline-variant bg-surface focus:outline-none focus:border-primary transition-colors"
                        />
                      </td>
                      <td className="px-md py-sm text-center">
                        <span className={`inline-block px-sm py-xs text-[11px] font-bold rounded-xl uppercase tracking-wide ${product.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-md py-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(product)} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors inline-flex border border-transparent hover:border-primary/20" title="Edit">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button onClick={() => handleDeleteClick(product)} className="text-error hover:bg-error/10 p-2 rounded-full transition-colors inline-flex border border-transparent hover:border-error/20" title="Delete">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
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
