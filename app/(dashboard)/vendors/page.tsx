'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Vendor } from '@/lib/types';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState('1234');
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    type: 'vendor',
    phone: '',
    active: true,
  });

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingToggleVendor, setPendingToggleVendor] = useState<Vendor | null>(null);

  const fetchInitialData = async () => {
    setLoading(true);
    
    // First fetch settings for password
    const { data: settingsRes } = await supabase.from('app_settings').select('key, value');
    let pwd = '1234';
    if (settingsRes) {
      const pwdSetting = settingsRes.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = (pwdSetting as any).value;
    }
    setMasterPassword(pwd);

    // Try fetching with 'active' column, fallback to 'is_active'
    let { data, error } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
    
    if (data) {
      // Normalize active field to handle either 'active' or 'is_active'
      const normalizedData = data.map((v: any) => ({
        ...v,
        active: v.active !== undefined ? v.active : v.is_active
      }));
      setVendors(normalizedData as Vendor[]);
    } else {
      toast.error('Error loading vendors');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // We try to save both columns to be safe with user's DB schema migration state
    const payload = {
      name: formData.name,
      type: formData.type,
      phone: formData.phone || null,
      active: formData.active,
      is_active: formData.active, // Fallback
    };

    let error;
    if (editingId) {
      const res = await (supabase as any).from('vendors').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('vendors').insert([payload]);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      // Retry without 'active' if it failed due to schema
      if (error.message.includes('active')) {
         const fallbackPayload = {
           name: formData.name,
           type: formData.type,
           phone: formData.phone || null,
           is_active: formData.active,
         };
         let fallbackError;
         if (editingId) {
           fallbackError = (await (supabase as any).from('vendors').update(fallbackPayload).eq('id', editingId)).error;
         } else {
           fallbackError = (await (supabase as any).from('vendors').insert([fallbackPayload])).error;
         }
         
         if (fallbackError) {
           toast.error(fallbackError.message || 'Failed to save vendor');
           return;
         }
      } else {
        toast.error(error.message || 'Failed to save vendor');
        return;
      }
    }

    toast.success(editingId ? 'Vendor updated successfully' : 'Vendor added successfully');
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ name: '', type: 'vendor', phone: '', active: true });
    fetchInitialData();
  };

  const handleEdit = (vendor: any) => {
    setFormData({
      name: vendor.name,
      type: vendor.type,
      phone: vendor.phone || '',
      active: vendor.active !== undefined ? vendor.active : vendor.is_active,
    });
    setEditingId(vendor.id);
    setIsFormOpen(true);
  };

  const requestToggleActive = (vendor: Vendor) => {
    setPendingToggleVendor(vendor);
    setPasswordInput('');
    setShowPasswordModal(true);
  };

  const confirmToggle = async () => {
    if (passwordInput !== masterPassword) {
      toast.error("Incorrect password");
      return;
    }
    setShowPasswordModal(false);
    
    if (pendingToggleVendor) {
      const currentActive = (pendingToggleVendor as any).active !== undefined ? (pendingToggleVendor as any).active : (pendingToggleVendor as any).is_active;
      const newActiveState = !currentActive;
      
      const payload = {
         active: newActiveState,
         is_active: newActiveState
      };
      
      const { error } = await (supabase as any).from('vendors').update(payload).eq('id', pendingToggleVendor.id);
      
      if (error) {
         if (error.message.includes('active')) {
            const { error: fbErr } = await (supabase as any).from('vendors').update({ is_active: newActiveState }).eq('id', pendingToggleVendor.id);
            if (fbErr) {
               toast.error('Failed to update vendor status');
            } else {
               toast.success(`Vendor marked as ${newActiveState ? 'Active' : 'Inactive'}`);
               fetchInitialData();
            }
         } else {
            toast.error('Failed to update vendor status');
         }
      } else {
         toast.success(`Vendor marked as ${newActiveState ? 'Active' : 'Inactive'}`);
         fetchInitialData();
      }
      setPendingToggleVendor(null);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md sticky top-0 bg-surface-container-lowest z-10">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Vendors & Shopkeepers</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage your business partners and their statuses.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', type: 'vendor', phone: '', active: true });
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Add New
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-surface-container-lowest p-xl rounded-2xl shadow-sm border border-outline-variant relative animate-fade-in">
          <button 
            onClick={() => setIsFormOpen(false)}
            className="absolute top-md right-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 p-sm rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-lg gap-x-md sm:grid-cols-2">
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Name *</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Type *</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all">
                <option value="vendor">Vendor</option>
                <option value="shopkeeper">Shopkeeper</option>
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Phone</label>
              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
            </div>
            <div className="sm:col-span-2 flex items-center mt-xs bg-surface-container-low p-md rounded-xl border border-outline-variant/50 w-fit">
              <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
              <label htmlFor="active" className="ml-sm block font-body-md text-body-md text-on-surface cursor-pointer">Active Vendor</label>
            </div>
            <div className="sm:col-span-2 mt-sm flex gap-sm justify-end border-t border-outline-variant/30 pt-md">
              <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : (editingId ? 'Update Vendor' : 'Save Vendor')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 animate-fade-in mb-xl">
        <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
          <div className="relative w-full sm:w-auto">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>search</span>
            <input
              type="text"
              placeholder="Search by name..."
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
          ) : filteredVendors.length === 0 ? (
            <div className="p-md text-center text-on-surface-variant">No vendors found.</div>
          ) : (
            filteredVendors.map((vendor) => {
              const isActive = (vendor as any).active;
              return (
                <div key={vendor.id} className={`p-md flex flex-col gap-sm transition-all ${!isActive ? 'opacity-60 bg-surface-container/30' : 'bg-surface'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-primary text-[16px]">{vendor.name}</div>
                      <div className="text-on-surface-variant text-sm mt-xs capitalize">{vendor.type} • {vendor.phone || '-'}</div>
                    </div>
                    <div>
                      <button 
                        onClick={() => requestToggleActive(vendor)}
                        className={`flex items-center gap-1 px-sm py-1 rounded-full text-xs font-bold uppercase tracking-wide border transition-colors ${isActive ? 'bg-[#dcfce7] text-[#166534] border-[#166534]/20 hover:bg-[#bbf7d0]' : 'bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#166534]' : 'bg-on-surface-variant'}`}></div>
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end mt-xs">
                    <button onClick={() => handleEdit(vendor)} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors flex items-center">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
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
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Name</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Type</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Phone</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-center">Status</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={5} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : filteredVendors.length === 0 ? (
                <tr><td colSpan={5} className="px-md py-lg text-center text-on-surface-variant">No vendors found.</td></tr>
              ) : (
                filteredVendors.map((vendor) => {
                  const isActive = (vendor as any).active;
                  return (
                    <tr key={vendor.id} className={`transition-all ${!isActive ? 'opacity-60 bg-surface-container/20' : 'hover:bg-surface-container-low'}`}>
                      <td className="px-md py-sm font-medium text-primary">{vendor.name}</td>
                      <td className="px-md py-sm capitalize text-on-surface-variant">{vendor.type}</td>
                      <td className="px-md py-sm text-on-surface-variant">{vendor.phone || '-'}</td>
                      <td className="px-md py-sm text-center">
                        <button 
                          onClick={() => requestToggleActive(vendor)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border transition-colors mx-auto ${isActive ? 'bg-[#dcfce7] text-[#166534] border-[#166534]/20 hover:bg-[#bbf7d0]' : 'bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#166534]' : 'bg-on-surface-variant'}`}></div>
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-md py-sm text-right">
                        <button onClick={() => handleEdit(vendor)} className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors inline-flex">
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

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-lg w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-error mb-sm flex items-center gap-2">
              <span className="material-symbols-outlined">lock</span> Password Required
            </h3>
            <p className="text-on-surface-variant text-sm mb-md">
              Enter master password to change vendor status.
            </p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl text-[16px] mb-md outline-none focus:border-error focus:ring-1 focus:ring-error"
              placeholder="Enter password"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmToggle()}
            />
            <div className="flex justify-end gap-sm">
              <button onClick={() => setShowPasswordModal(false)} className="px-md py-sm text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmToggle} className="px-md py-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
