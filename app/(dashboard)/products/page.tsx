'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    price_per_box: '',
    price_per_piece: '',
    is_active: true,
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
    const payload = {
      name: formData.name,
      price_per_box: formData.price_per_box ? parseFloat(formData.price_per_box) : null,
      price_per_piece: formData.price_per_piece ? parseFloat(formData.price_per_piece) : null,
      is_active: formData.is_active,
    };

    if (editingId) {
      await (supabase as any).from('products').update(payload).eq('id', editingId);
    } else {
      await (supabase as any).from('products').insert([payload]);
    }

    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ name: '', price_per_box: '', price_per_piece: '', is_active: true });
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price_per_box: product.price_per_box ? product.price_per_box.toString() : '',
      price_per_piece: product.price_per_piece ? product.price_per_piece.toString() : '',
      is_active: product.is_active,
    });
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await (supabase as any).from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Products Inventory</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage your product catalog and pricing.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', price_per_box: '', price_per_piece: '', is_active: true });
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-xs px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Add Product
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
            <div className="hidden sm:block"></div> {/* Spacer */}
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Box (₹)</label>
              <input type="number" step="0.01" value={formData.price_per_box} onChange={e => setFormData({...formData, price_per_box: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Price Per Piece (₹)</label>
              <input type="number" step="0.01" value={formData.price_per_piece} onChange={e => setFormData({...formData, price_per_piece: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div className="sm:col-span-2 flex items-center mt-xs">
              <input type="checkbox" id="is_active_prod" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary" />
              <label htmlFor="is_active_prod" className="ml-sm block font-body-md text-body-md text-on-surface">Available in Stock</label>
            </div>
            <div className="sm:col-span-2 mt-sm flex gap-sm">
              <button type="submit" className="w-full sm:w-auto flex items-center justify-center px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors">
                {editingId ? 'Update Product' : 'Save Product'}
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
              <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Product Name</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Price/Box</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Price/Piece</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
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
                    <td className="px-md py-sm text-on-surface-variant">{product.price_per_box ? `₹${product.price_per_box.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-md py-sm text-on-surface-variant">{product.price_per_piece ? `₹${product.price_per_piece.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-md py-sm text-center">
                      <span className={`inline-block px-sm py-xs text-[11px] font-bold rounded-DEFAULT uppercase tracking-wide ${product.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-md py-sm text-right">
                      <button onClick={() => handleEdit(product)} className="text-primary hover:text-primary-container transition-colors mr-sm">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-error hover:text-error-container transition-colors">
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
  );
}
