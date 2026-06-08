'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Vendor } from '@/lib/types';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    type: 'vendor',
    phone: '',
    credit_limit: '',
    is_active: true,
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setVendors(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      type: formData.type,
      phone: formData.phone || null,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
      is_active: formData.is_active,
    };

    if (editingId) {
      await (supabase as any).from('vendors').update(payload).eq('id', editingId);
    } else {
      await (supabase as any).from('vendors').insert([payload]);
    }

    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ name: '', type: 'vendor', phone: '', credit_limit: '', is_active: true });
    fetchVendors();
  };

  const handleEdit = (vendor: Vendor) => {
    setFormData({
      name: vendor.name,
      type: vendor.type,
      phone: vendor.phone || '',
      credit_limit: vendor.credit_limit ? vendor.credit_limit.toString() : '',
      is_active: vendor.is_active,
    });
    setEditingId(vendor.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this vendor?')) {
      await (supabase as any).from('vendors').delete().eq('id', id);
      fetchVendors();
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Vendors & Shopkeepers</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage your business partners and their credit limits.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', type: 'vendor', phone: '', credit_limit: '', is_active: true });
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-xs px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Add New
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
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-md gap-x-md sm:grid-cols-2">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Name *</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Type *</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all">
                <option value="vendor">Vendor</option>
                <option value="shopkeeper">Shopkeeper</option>
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Phone</label>
              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Credit Limit (₹)</label>
              <input type="number" step="0.01" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div className="sm:col-span-2 flex items-center mt-xs">
              <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary" />
              <label htmlFor="is_active" className="ml-sm block font-body-md text-body-md text-on-surface">Active Status</label>
            </div>
            <div className="sm:col-span-2 mt-sm flex gap-sm">
              <button type="submit" className="w-full sm:w-auto flex items-center justify-center px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors">
                {editingId ? 'Update Vendor' : 'Save Vendor'}
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
              placeholder="Search by name..."
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
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Name</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Type</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Phone</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Credit Limit</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={6} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : filteredVendors.length === 0 ? (
                <tr><td colSpan={6} className="px-md py-lg text-center text-on-surface-variant">No vendors found.</td></tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm font-medium text-primary">{vendor.name}</td>
                    <td className="px-md py-sm capitalize text-on-surface-variant">{vendor.type}</td>
                    <td className="px-md py-sm text-on-surface-variant">{vendor.phone || '-'}</td>
                    <td className="px-md py-sm text-right table-lining-figures font-medium">{vendor.credit_limit ? `₹${vendor.credit_limit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-md py-sm text-center">
                      <span className={`inline-block px-sm py-xs text-[11px] font-bold rounded-DEFAULT uppercase tracking-wide ${vendor.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-md py-sm text-right">
                      <button onClick={() => handleEdit(vendor)} className="text-primary hover:text-primary-container transition-colors mr-sm">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button onClick={() => handleDelete(vendor.id)} className="text-error hover:text-error-container transition-colors">
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
