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
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'products' | 'stock'>('products');

  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    price_per_box: '',
    price_per_piece: '',
    stock_boxes: '0',
    stock_pieces: '0',
    is_active: true,
  });

  const [stockFormData, setStockFormData] = useState({
    product_id: '',
    add_boxes: 0,
    add_pieces: 0,
    reason: 'Stock In'
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: formData.name,
      price_per_box: formData.price_per_box ? parseFloat(formData.price_per_box) : null,
      price_per_piece: formData.price_per_piece ? parseFloat(formData.price_per_piece) : null,
      stock_boxes: formData.stock_boxes ? parseInt(formData.stock_boxes) : 0,
      stock_pieces: formData.stock_pieces ? parseInt(formData.stock_pieces) : 0,
      is_active: formData.is_active,
    };

    let error;
    if (editingId) {
      const res = await (supabase as any).from('products').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('products').insert([payload]);
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
    setFormData({ name: '', price_per_box: '', price_per_piece: '', stock_boxes: '0', stock_pieces: '0', is_active: true });
    fetchProducts();
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFormData.product_id) {
      toast.error('Please select a product');
      return;
    }
    setSaving(true);

    const product = products.find(p => p.id === stockFormData.product_id);
    if (!product) return;

    // Calculate new stock
    // Since 'add_boxes' can be negative (e.g. for Return or Adjustment), we just add it to current.
    const newBoxes = (product.stock_boxes || 0) + stockFormData.add_boxes;
    const newPieces = (product.stock_pieces || 0) + stockFormData.add_pieces;

    const { error } = await (supabase as any).from('products').update({
      stock_boxes: newBoxes,
      stock_pieces: newPieces
    }).eq('id', product.id);

    setSaving(false);
    
    if (error) {
      toast.error(error.message || 'Failed to update stock');
      return;
    }

    toast.success('Stock updated successfully');
    setIsStockModalOpen(false);
    setStockFormData({ product_id: '', add_boxes: 0, add_pieces: 0, reason: 'Stock In' });
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price_per_box: product.price_per_box ? product.price_per_box.toString() : '',
      price_per_piece: product.price_per_piece ? product.price_per_piece.toString() : '',
      stock_boxes: product.stock_boxes ? product.stock_boxes.toString() : '0',
      stock_pieces: product.stock_pieces ? product.stock_pieces.toString() : '0',
      is_active: product.is_active,
    });
    setEditingId(product.id);
    setIsFormOpen(true);
    setActiveTab('products');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      const { error } = await (supabase as any).from('products').delete().eq('id', id);
      if (error) {
        toast.error(error.message || 'Failed to delete product');
      } else {
        toast.success('Product deleted successfully');
        fetchProducts();
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Products & Stock</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage your product catalog and warehouse inventory.</p>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', price_per_box: '', price_per_piece: '', stock_boxes: '0', stock_pieces: '0', is_active: true });
              setIsFormOpen(true);
              setIsStockModalOpen(false);
            }}
            className="flex items-center justify-center gap-xs px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Add Product
          </button>
          <button
            onClick={() => {
              setStockFormData({ product_id: '', add_boxes: 0, add_pieces: 0, reason: 'Stock In' });
              setIsStockModalOpen(true);
              setIsFormOpen(false);
            }}
            className="flex items-center justify-center gap-xs px-md py-sm bg-secondary text-on-secondary font-label-md text-label-md rounded-DEFAULT hover:bg-secondary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span> Add Stock
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-outline-variant">
        <button 
          onClick={() => setActiveTab('products')}
          className={`px-lg py-sm font-label-lg transition-colors border-b-2 ${activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}`}
        >
          Product Management
        </button>
        <button 
          onClick={() => setActiveTab('stock')}
          className={`px-lg py-sm font-label-lg transition-colors border-b-2 ${activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}`}
        >
          Stock Management
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-surface-container-lowest p-md rounded-lg ambient-shadow border border-outline-variant relative">
          <button 
            onClick={() => setIsFormOpen(false)}
            className="absolute top-md right-md text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-md gap-x-md sm:grid-cols-2">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Product Name *</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div className="hidden sm:block"></div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Box (₹)</label>
              <input type="number" step="0.01" value={formData.price_per_box} onChange={e => setFormData({...formData, price_per_box: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Piece (₹)</label>
              <input type="number" step="0.01" value={formData.price_per_piece} onChange={e => setFormData({...formData, price_per_piece: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            {!editingId && (
              <>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Initial Stock (Boxes)</label>
                  <input type="number" value={formData.stock_boxes} onChange={e => setFormData({...formData, stock_boxes: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Initial Stock (Pieces)</label>
                  <input type="number" value={formData.stock_pieces} onChange={e => setFormData({...formData, stock_pieces: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
                </div>
              </>
            )}
            <div className="sm:col-span-2 flex items-center mt-xs">
              <input type="checkbox" id="is_active_prod" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary" />
              <label htmlFor="is_active_prod" className="ml-sm block font-body-md text-body-md text-on-surface">Available in System</label>
            </div>
            <div className="sm:col-span-2 mt-sm flex gap-sm">
              <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
              </button>
            </div>
          </form>
        </div>
      )}

      {isStockModalOpen && (
        <div className="bg-surface-container-lowest p-md rounded-lg ambient-shadow border border-outline-variant relative">
          <button 
            onClick={() => setIsStockModalOpen(false)}
            className="absolute top-md right-md text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">Update Stock</h3>
          <form onSubmit={handleStockSubmit} className="grid grid-cols-1 gap-y-md gap-x-md sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Product *</label>
              <select required value={stockFormData.product_id} onChange={e => setStockFormData({...stockFormData, product_id: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all">
                <option value="">-- Select Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Current: {p.stock_boxes || 0} Box, {p.stock_pieces || 0} Pcs)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Add/Remove Boxes</label>
              <div className="flex items-center">
                <button type="button" onClick={() => setStockFormData(p => ({...p, add_boxes: p.add_boxes - 1}))} className="px-sm py-xs bg-surface-container border border-outline-variant rounded-l-DEFAULT hover:bg-surface-container-high">-</button>
                <input type="number" value={stockFormData.add_boxes} onChange={e => setStockFormData({...stockFormData, add_boxes: parseInt(e.target.value) || 0})} className="w-full text-center px-sm py-xs bg-surface border-y border-outline-variant font-body-md text-body-md focus:outline-none" />
                <button type="button" onClick={() => setStockFormData(p => ({...p, add_boxes: p.add_boxes + 1}))} className="px-sm py-xs bg-surface-container border border-outline-variant rounded-r-DEFAULT hover:bg-surface-container-high">+</button>
              </div>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Add/Remove Pieces</label>
              <div className="flex items-center">
                <button type="button" onClick={() => setStockFormData(p => ({...p, add_pieces: p.add_pieces - 1}))} className="px-sm py-xs bg-surface-container border border-outline-variant rounded-l-DEFAULT hover:bg-surface-container-high">-</button>
                <input type="number" value={stockFormData.add_pieces} onChange={e => setStockFormData({...stockFormData, add_pieces: parseInt(e.target.value) || 0})} className="w-full text-center px-sm py-xs bg-surface border-y border-outline-variant font-body-md text-body-md focus:outline-none" />
                <button type="button" onClick={() => setStockFormData(p => ({...p, add_pieces: p.add_pieces + 1}))} className="px-sm py-xs bg-surface-container border border-outline-variant rounded-r-DEFAULT hover:bg-surface-container-high">+</button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Reason *</label>
              <select required value={stockFormData.reason} onChange={e => setStockFormData({...stockFormData, reason: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all">
                <option value="Stock In">Stock In</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Return">Return</option>
              </select>
            </div>
            <div className="sm:col-span-2 mt-sm flex gap-sm">
              <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-md py-sm bg-secondary text-on-secondary font-label-md text-label-md rounded-DEFAULT hover:bg-secondary-container transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Stock Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col flex-1">
        <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
          <div className="relative w-full sm:w-auto">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-xl pr-sm py-xs w-full sm:w-64 bg-surface-container-low border border-outline-variant rounded-DEFAULT font-body-sm text-body-sm focus:border-secondary-container focus:ring-1 focus:ring-secondary-container focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              {activeTab === 'products' ? (
                <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Product Name</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Price/Box</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Price/Piece</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              ) : (
                <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Product Name</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Stock Boxes</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Stock Pieces</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              )}
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={5} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={5} className="px-md py-lg text-center text-on-surface-variant">No products found.</td></tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm font-medium text-primary">{product.name}</td>
                    
                    {activeTab === 'products' ? (
                      <>
                        <td className="px-md py-sm text-on-surface-variant">{product.price_per_box ? `₹${product.price_per_box.toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-md py-sm text-on-surface-variant">{product.price_per_piece ? `₹${product.price_per_piece.toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-md py-sm text-center">
                          <span className={`inline-block px-sm py-xs text-[11px] font-bold rounded-DEFAULT uppercase tracking-wide ${product.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-md py-sm text-on-surface-variant">
                          <span className={`font-bold ${product.stock_boxes < 5 ? 'text-error' : 'text-on-surface'}`}>
                            {product.stock_boxes || 0}
                          </span>
                          {product.stock_boxes < 5 && <span className="ml-2 text-xs bg-error/10 text-error px-2 py-1 rounded-full">Low Stock</span>}
                        </td>
                        <td className="px-md py-sm text-on-surface-variant font-medium">
                          {product.stock_pieces || 0}
                        </td>
                        <td className="px-md py-sm text-on-surface-variant">
                          <span className={`inline-block px-sm py-xs text-[11px] font-bold rounded-DEFAULT uppercase tracking-wide ${product.stock_boxes > 0 || product.stock_pieces > 0 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {product.stock_boxes > 0 || product.stock_pieces > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                      </>
                    )}

                    <td className="px-md py-sm text-right">
                      {activeTab === 'products' ? (
                        <>
                          <button onClick={() => handleEdit(product)} className="text-primary hover:text-primary-container transition-colors mr-sm">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="text-error hover:text-error-container transition-colors">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </>
                      ) : (
                        <button onClick={() => {
                          setStockFormData({ product_id: product.id, add_boxes: 0, add_pieces: 0, reason: 'Stock In' });
                          setIsStockModalOpen(true);
                          setIsFormOpen(false);
                        }} className="text-secondary hover:text-secondary-container transition-colors">
                          <span className="material-symbols-outlined text-[20px]">add_box</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
