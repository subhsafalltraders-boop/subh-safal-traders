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
    is_party_pack: false,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, created_at, name, price_per_box, price_per_piece, pieces_per_box, is_active, is_party_pack, aliases, hsn_code')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
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
        pieces_per_box: Number(formData.pieces_per_box || 0),
        is_party_pack: formData.is_party_pack || false,
        is_active: true,
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
      pieces_per_box: product.pieces_per_box ? product.pieces_per_box.toString() : '',
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

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderForm = () => (
    <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Product Name *</label>
        <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
      </div>
      <div>
        <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Ek Box mein kitne pieces? *</label>
        <input required type="text" inputMode="numeric" pattern="[0-9]*" value={formData.pieces_per_box} onChange={e => {
          const val = e.target.value;
          if (val === '' || /^\d+$/.test(val)) setFormData({ ...formData, pieces_per_box: val });
        }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" placeholder="Required" />
      </div>
      <div>
        <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Price Per Box (₹)</label>
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_box} onChange={e => {
          const val = e.target.value;
          if (val === '' || /^\d+$/.test(val)) setFormData({ ...formData, price_per_box: val });
        }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
      </div>
      <div className="sm:col-span-2">
        <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Price Per Piece (₹)</label>
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_piece} onChange={e => {
          const val = e.target.value;
          if (val === '' || /^\d+$/.test(val)) setFormData({ ...formData, price_per_piece: val });
        }} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all mb-2" />
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map(price => (
            <button
              key={price}
              type="button"
              onClick={() => setFormData({ ...formData, price_per_piece: price.toString() })}
              className={`px-3 py-1 text-[14px] font-medium rounded-lg border transition-colors ${formData.price_per_piece === price.toString() ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-variant'}`}
            >
              ₹{price}
            </button>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2 flex items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/50 mt-2">
        <input type="checkbox" id="is_party_pack_prod" checked={formData.is_party_pack} onChange={e => setFormData({ ...formData, is_party_pack: e.target.checked })} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
        <label htmlFor="is_party_pack_prod" className="ml-2 block font-body-md text-[16px] text-on-surface cursor-pointer">This is a Party Pack</label>
      </div>
      <div className="sm:col-span-2 mt-4 flex justify-end border-t border-outline-variant/30 pt-4">
        <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </form>
  );

  return (
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
        <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-lg h-full overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant/30 pb-space-md sticky top-0 bg-surface-container-lowest z-10">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Products</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Manage product catalog and prices.</p>
            </div>
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-space-xs px-space-lg py-space-sm border border-primary text-primary font-label-md rounded-xl hover:bg-primary-container transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Add Product
            </button>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 animate-fade-in mb-space-xl">
            <div className="px-space-md py-space-sm border-b border-outline-variant bg-surface flex justify-between items-center">
              <div className="relative w-full sm:w-auto">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>search</span>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-space-sm py-space-sm !pl-11 w-full sm:w-64 bg-surface-container-low border border-outline-variant rounded-xl font-body-sm text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Product Name</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Price / Box</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Price / Piece</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm">Pieces / Box</th>
                    <th className="px-space-md py-space-sm font-medium text-on-surface-variant uppercase text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-space-md py-space-lg text-center text-on-surface-variant">Loading...</td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-space-md py-space-lg text-center text-on-surface-variant">No products found.</td></tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-surface-container-low transition-all">
                        <td className="px-space-md py-space-sm font-medium text-primary">
                          {product.name}
                          {product.is_party_pack && <span className="ml-2 px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full uppercase">Party Pack</span>}
                        </td>
                        <td className="px-space-md py-space-sm text-on-surface-variant text-sm">₹{product.price_per_box || '-'}</td>
                        <td className="px-space-md py-space-sm text-on-surface-variant text-sm">₹{product.price_per_piece || '-'}</td>
                        <td className="px-space-md py-space-sm text-on-surface-variant text-sm">{product.pieces_per_box || '-'}</td>
                        <td className="px-space-md py-space-sm text-right">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col overflow-x-hidden">
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
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              className="w-full h-[48px] pl-11 pr-4 border border-outline-variant focus:border-2 focus:border-primary rounded-lg bg-surface-container-lowest text-[16px] font-body-standard text-on-surface outline-none transition-all placeholder:text-outline-variant shadow-sm"
              placeholder="Search products..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-[12px] mt-2">
            {loading ? (
              <div className="text-center text-on-surface-variant py-4">Loading...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center text-on-surface-variant py-4">No products found.</div>
            ) : (
              filteredProducts.map((product) => (
                <article key={product.id} className="bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-variant relative">
                  <div className="flex justify-between items-start">
                    <h3 className="font-title-main text-[18px] font-semibold text-on-surface pr-2 flex items-center gap-2 flex-wrap">
                      {product.name}
                      {product.is_party_pack && <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full uppercase">Party Pack</span>}
                    </h3>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleEdit(product)} className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-primary text-primary active:bg-surface-container-high transition-colors">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
                      </button>
                      <button onClick={() => handleDeleteClick(product)} className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-error text-error active:bg-error/10 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-end border-b border-surface-variant pb-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-label-caption text-[14px] text-on-surface-variant">Price / Box</span>
                      <span className="font-value-display text-[18px] font-bold text-on-surface">₹{product.price_per_box || 0}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <span className="font-label-caption text-[14px] text-on-surface-variant">Price / Piece</span>
                      <span className="font-value-display text-[18px] font-bold text-on-surface">₹{product.price_per_piece || 0}</span>
                    </div>
                  </div>
                  <div className="text-[14px] text-on-surface-variant">
                    Pieces / Box: <span className="font-medium text-on-surface">{product.pieces_per_box || '-'}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </main>
      </div>

      {/* ── Shared Modals ── */}
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
            {renderForm()}
          </div>
        </div>
      )}

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
