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
    cost_price: '',
    cost_per_box: '',
    boxes_per_tray: '',
    pieces_per_box: '',
    hsn_code: '',
    stock_boxes: '',
    stock_pieces: '',
    is_active: true,
    is_party_pack: false,
    aliases: '',
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
      .select('id, created_at, name, price_per_box, price_per_piece, cost_price, cost_per_box, stock_boxes, stock_pieces, boxes_per_tray, pieces_per_box, is_active, is_party_pack, aliases')
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
      const payload: any = {
        name: formData.name,
        price_per_box: Number(formData.price_per_box || 0),
        price_per_piece: Number(formData.price_per_piece || 0),
        cost_price: Number(formData.cost_price || 0),
        cost_per_box: Number(formData.cost_per_box || 0),
        boxes_per_tray: Number(formData.boxes_per_tray || 0),
        pieces_per_box: Number(formData.pieces_per_box || 0),
        hsn_code: formData.hsn_code || '',
        is_party_pack: formData.is_party_pack || false,
        is_active: formData.is_active,
        aliases: formData.aliases ? formData.aliases.split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      let error;
      if (editingId) {
        const res = await (supabase as any)
          .from('products')
          .update(payload)
          .eq('id', editingId);
        error = res.error;
      } else {
        payload.stock_boxes = Number(formData.stock_boxes || 0);
        payload.stock_pieces = Number(formData.stock_pieces || 0);
        const res = await (supabase as any)
          .from('products')
          .insert([payload]);
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
      cost_price: product.cost_price ? product.cost_price.toString() : '',
      cost_per_box: product.cost_per_box ? product.cost_per_box.toString() : '',
      boxes_per_tray: product.boxes_per_tray ? product.boxes_per_tray.toString() : '',
      pieces_per_box: product.pieces_per_box ? product.pieces_per_box.toString() : '',
      hsn_code: product.hsn_code || '',
      stock_boxes: '',
      stock_pieces: '',
      is_active: product.is_active,
      is_party_pack: product.is_party_pack || false,
      aliases: product.aliases?.join(', ') || '',
    });
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setFormData({
      name: '',
      price_per_box: '',
      price_per_piece: '',
      cost_price: '',
      cost_per_box: '',
      boxes_per_tray: '',
      pieces_per_box: '',
      hsn_code: '',
      stock_boxes: '',
      stock_pieces: '',
      is_active: true,
      is_party_pack: false,
      aliases: '',
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
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
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
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Short names used on bills (comma separated)</label>
                <input type="text" value={formData.aliases} onChange={e => setFormData({...formData, aliases: e.target.value})} placeholder="e.g. butter cup, BC, butter" className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Ek Box mein kitne pieces? *</label>
                <input required type="text" inputMode="numeric" pattern="[0-9]*" value={formData.pieces_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, pieces_per_box: val});
                }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Required" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Ek Tray mein kitne boxes? *</label>
                <input required type="text" inputMode="numeric" pattern="[0-9]*" value={formData.boxes_per_tray} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, boxes_per_tray: val});
                }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Required" />
              </div>
              {!editingId && (
                <>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Initial Stock (Boxes)</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.stock_boxes} onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setFormData({...formData, stock_boxes: val});
                    }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Initial Stock (Pieces)</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.stock_pieces} onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setFormData({...formData, stock_pieces: val});
                    }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
                  </div>
                </>
              )}
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">HSN Code</label>
                <input type="text" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Cost Per Box (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.cost_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, cost_per_box: val});
                }} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-[#166534] focus:ring-1 focus:ring-[#166534] focus:outline-none transition-all" placeholder="Vendor Price" />
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
                      {product.aliases && product.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.aliases.map(a => (
                            <span key={a} className="px-1.5 py-0.5 bg-surface-variant text-on-surface-variant text-[10px] rounded border border-outline-variant/30">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-on-surface-variant text-xs mt-xs uppercase tracking-wider">
                        Box: ₹{product.price_per_box || '-'} • Pcs: ₹{product.price_per_piece || '-'}
                      </div>
                      <div className="text-on-surface-variant text-xs mt-1 font-medium">
                        Tray = {product.boxes_per_tray || '-'} Boxes | Box = {product.pieces_per_box || '-'} Pcs
                      </div>
                      <div className="text-xs text-on-surface-variant mt-1 font-medium">
                        Current Stock: {product.stock_boxes || 0} boxes {product.stock_pieces || 0} pieces (Total: {((product.stock_boxes || 0) * (product.pieces_per_box || 1)) + (product.stock_pieces || 0)} pcs)
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
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Profit</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm w-40">Stock Boxes</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm w-40">Stock Pieces</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-center">Status</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={7} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-md py-lg text-center text-on-surface-variant">No products found.</td></tr>
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
                        {product.aliases && product.aliases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {product.aliases.map(a => (
                              <span key={a} className="px-1.5 py-0.5 bg-surface-variant text-on-surface-variant text-[10px] rounded border border-outline-variant/30">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-on-surface-variant mt-1 font-medium">
                          Stock: {product.stock_boxes || 0} boxes {product.stock_pieces || 0} pieces (Total: {((product.stock_boxes || 0) * (product.pieces_per_box || 1)) + (product.stock_pieces || 0)} pcs)
                        </div>
                      </td>
                      <td className="px-md py-sm text-on-surface-variant text-sm">
                        B: ₹{product.price_per_box || '-'} <br/> P: ₹{product.price_per_piece || '-'} <br/>
                        <span className="text-xs">Tray: {product.boxes_per_tray || '-'}B | Box: {product.pieces_per_box || '-'}P</span>
                      </td>
                      <td className="px-md py-sm text-sm">
                        {(() => {
                           const cp = product.cost_per_box || 0;
                           const sp = product.price_per_box || 0;
                           const profit = sp - cp;
                           const margin = sp > 0 ? ((profit / sp) * 100).toFixed(1) : 0;
                           return (
                             <div className="flex flex-col">
                               <span className="font-bold text-[#166534]">₹{profit} / box</span>
                               <span className="text-[10px] text-on-surface-variant bg-[#166534]/10 text-[#166534] w-fit px-1 rounded font-bold">{margin}% margin</span>
                             </div>
                           )
                        })()}
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
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col overflow-x-hidden">
        {/* TopAppBar */}
        <header className="flex justify-between items-center h-[56px] px-[16px] w-full z-50 bg-surface top-0 sticky border-b border-outline-variant shadow-sm transition-colors duration-200">
          <button onClick={() => window.history.back()} className="text-primary active:bg-surface-container-high p-2 rounded-full flex items-center justify-center min-w-[48px] min-h-[48px]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </button>
          <h1 className="font-title-main text-[20px] font-bold text-primary tracking-tight">Products</h1>
          <button onClick={handleAddNew} className="text-primary active:bg-surface-container-high p-2 rounded-full flex items-center justify-center min-w-[48px] min-h-[48px]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>add</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-[16px] pt-4 pb-4 flex flex-col gap-[12px]">
          {/* Search Bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input 
              className="w-full h-[48px] pl-10 pr-4 border border-outline-variant focus:border-2 focus:border-primary rounded-lg bg-surface-container-lowest text-[16px] font-body-standard text-on-surface outline-none transition-all placeholder:text-outline-variant shadow-sm" 
              placeholder="Search products..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Product Cards List */}
          <div className="flex flex-col gap-[12px] mt-2">
            {loading ? (
              <div className="text-center text-on-surface-variant py-4">Loading...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-on-surface-variant py-4">No products found.</div>
            ) : (
              filteredProducts.map((product) => {
                const isLowStock = (product.stock_boxes || 0) > 0 && (product.stock_boxes || 0) <= 15;
                const isOutOfStock = (product.stock_boxes || 0) === 0;

                return (
                  <article key={product.id} className={`bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-variant relative ${!product.is_active ? 'opacity-75' : ''}`}>
                    {!product.is_active && (
                      <div className="absolute top-2 left-2 bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider z-10">Inactive</div>
                    )}
                    <div className="flex justify-between items-start">
                      <h3 className={`font-title-main text-[18px] font-semibold text-on-surface pr-2 ${!product.is_active ? 'mt-4' : ''}`}>{product.name}</h3>
                      <button onClick={() => handleEdit(product)} className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-primary text-primary active:bg-surface-container-high transition-colors shrink-0">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
                      </button>
                    </div>
                    <div className="flex justify-between items-end border-b border-surface-variant pb-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-label-caption text-[14px] text-on-surface-variant">Price / Box</span>
                        <span className="font-value-display text-[18px] font-bold text-on-surface">₹{product.price_per_box || 0}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-label-caption text-[14px] text-on-surface-variant">Profit / Box</span>
                        {(() => {
                           const cp = product.cost_per_box || 0;
                           const sp = product.price_per_box || 0;
                           const profit = sp - cp;
                           const margin = sp > 0 ? ((profit / sp) * 100).toFixed(1) : 0;
                           return (
                             <div className="flex flex-col text-[#166534]">
                               <span className="font-value-display text-[18px] font-bold">₹{profit}</span>
                               <span className="text-[10px] bg-[#166534]/10 w-fit px-1 rounded font-bold -mt-1">{margin}%</span>
                             </div>
                           )
                        })()}
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <span className="font-label-caption text-[14px] text-on-surface-variant">Price / Piece</span>
                        <span className="font-value-display text-[18px] font-bold text-on-surface">₹{product.price_per_piece || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <span className="font-label-caption text-[14px] text-on-surface-variant w-full mb-1 flex justify-between items-center">
                        Current Stock: 
                        {isOutOfStock ? (
                          <span className="text-error font-bold text-[12px] uppercase tracking-wider">Out of Stock</span>
                        ) : isLowStock ? (
                          <span className="text-[#FF9800] font-bold text-[12px] uppercase tracking-wider">Low Stock</span>
                        ) : null}
                      </span>
                      <div className={`px-3 py-1.5 rounded-md font-body-standard text-[16px] font-medium flex items-center gap-1 ${isOutOfStock ? 'bg-error/10 text-error border border-error/20' : 'bg-secondary-container/30 text-on-secondary-container'}`}>
                        <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                        {product.stock_boxes || 0} Boxes
                      </div>
                      <div className="bg-surface-container-high text-on-surface px-3 py-1.5 rounded-md font-body-standard text-[16px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">icecream</span>
                        {product.stock_pieces || 0} Pcs
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* ── Shared Modals ── */}
      {/* Edit / Add Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant relative animate-fade-in w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 p-2 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-[24px] text-on-surface mb-4">{editingId ? 'Edit Product Details' : 'Add New Product'}</h3>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Product Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Short names (comma separated)</label>
                <input type="text" value={formData.aliases} onChange={e => setFormData({...formData, aliases: e.target.value})} placeholder="e.g. butter cup, BC" className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Ek Box mein kitne pieces? *</label>
                <input required type="text" inputMode="numeric" pattern="[0-9]*" value={formData.pieces_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, pieces_per_box: val});
                }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Required" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Ek Tray mein kitne boxes? *</label>
                <input required type="text" inputMode="numeric" pattern="[0-9]*" value={formData.boxes_per_tray} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, boxes_per_tray: val});
                }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Required" />
              </div>
              {!editingId && (
                <>
                  <div>
                    <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Initial Stock (Boxes)</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.stock_boxes} onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setFormData({...formData, stock_boxes: val});
                    }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Initial Stock (Pieces)</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.stock_pieces} onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setFormData({...formData, stock_pieces: val});
                    }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />
                  </div>
                </>
              )}
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">HSN Code</label>
                <input type="text" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Optional" />

              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Cost Per Box (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.cost_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, cost_per_box: val});
                }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-[#166534] focus:ring-1 focus:ring-[#166534] focus:outline-none transition-all" placeholder="Vendor Price" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Price Per Box (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, price_per_box: val});
                }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Price Per Piece (₹)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_piece} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) setFormData({...formData, price_per_piece: val});
                }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all mb-2" />
                <div className="flex flex-wrap gap-2">
                  {PRICE_PRESETS.map(price => (
                    <button 
                      key={price} 
                      type="button" 
                      onClick={() => setFormData({...formData, price_per_piece: price.toString()})}
                      className={`px-3 py-1 text-[14px] font-medium rounded-lg border transition-colors ${formData.price_per_piece === price.toString() ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
                    >
                      ₹{price}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4 mt-2">
                <div className="flex items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/50 flex-1">
                  <input type="checkbox" id="is_active_prod" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
                  <label htmlFor="is_active_prod" className="ml-2 block font-body-md text-[16px] text-on-surface cursor-pointer">Available in System</label>
                </div>
                <div className="flex items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/50 flex-1">
                  <input type="checkbox" id="is_party_pack_prod" checked={formData.is_party_pack} onChange={e => setFormData({...formData, is_party_pack: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
                  <label htmlFor="is_party_pack_prod" className="ml-2 block font-body-md text-[16px] text-on-surface cursor-pointer">This is a Party Pack</label>
                </div>
              </div>
              <div className="sm:col-span-2 mt-4 flex justify-end border-t border-outline-variant/30 pt-4">
                <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Password Modal */}
      {deletePasswordModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-on-surface mb-2 flex items-center gap-2">
              🔒 Delete Product
            </h3>
            <p className="text-on-surface-variant text-[14px] mb-4">
              <strong>"{deletePasswordModal.productName}"</strong> delete karne ke liye password daalo.
            </p>
            <input
              type="password"
              autoFocus
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeletePasswordError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-[16px] mb-2 outline-none focus:border-error focus:ring-1 focus:ring-error transition-all"
              placeholder="Password"
            />
            {deletePasswordError && (
              <p className="text-error text-[14px] mb-2">{deletePasswordError}</p>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setDeletePasswordModal({ open: false, productId: '', productName: '' })}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-container-low transition-colors font-label-md"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-error text-white rounded-xl hover:bg-error/90 transition-colors font-label-md"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmModal.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-error mb-2 flex items-center gap-2">
              ⚠️ Confirm Delete
            </h3>
            <p className="text-[14px] text-on-surface mb-2">
              <strong>"{deleteConfirmModal.productName}"</strong> delete karna chahte ho?
            </p>
            <div className="bg-error/5 border border-error/20 rounded-xl p-4 mb-4">
              <p className="text-[14px] text-on-surface">
                Ye product permanently delete ho jaayega. Iske saare bill records mein product naam saved hai, woh safe rahenge.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                disabled={deleting}
                onClick={() => setDeleteConfirmModal({ open: false, productId: '', productName: '' })}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-container-low transition-colors font-label-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-error text-white rounded-xl hover:bg-error/90 transition-colors font-label-md disabled:opacity-50 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
