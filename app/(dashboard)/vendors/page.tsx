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
    <>
      {/* DESKTOP UI */}
      <div className="hidden md:block h-full">
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

        </div>
      </div>

      {/* MOBILE UI */}
      <div className="block md:hidden pb-[80px] bg-surface min-h-[100dvh] flex flex-col overflow-x-hidden">
        {/* TopAppBar */}
        <header className="flex items-center justify-between p-4 w-full z-50 bg-surface top-0 sticky border-b border-outline-variant shadow-sm transition-colors duration-200">
          <button onClick={() => window.history.back()} className="text-primary active:bg-surface-container-high rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
          </button>
          <h1 className="font-title-main text-[20px] font-bold text-primary tracking-tight">Vendors & Shopkeepers</h1>
          <button onClick={() => { setEditingId(null); setFormData({ name: '', type: 'vendor', phone: '', active: true }); setIsFormOpen(true); }} className="text-primary active:bg-surface-container-high rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>add</span>
          </button>
        </header>

        {/* Main Content */}
        <main className="p-[16px] space-y-[12px]">
          {/* Search Bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input 
              className="w-full h-[48px] pl-10 pr-4 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-[16px] font-body-standard placeholder-outline" 
              placeholder="Search vendors..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Vendor List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center text-on-surface-variant py-4">Loading...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="text-center text-on-surface-variant py-4">No vendors found.</div>
            ) : (
              filteredVendors.map((vendor) => {
                const isActive = (vendor as any).active !== undefined ? (vendor as any).active : (vendor as any).is_active;
                return (
                  <div key={vendor.id} className={`bg-surface-container-lowest rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-surface-container-low flex flex-col gap-3 ${!isActive ? 'opacity-75' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="font-title-main text-[20px] text-on-surface">{vendor.name}</h2>
                        <span className={`inline-block mt-1 px-2 py-1 rounded font-label-caption text-[12px] uppercase tracking-wider ${vendor.type === 'vendor' ? 'bg-secondary-container/20 text-on-secondary-container' : 'bg-primary-container/10 text-primary'}`}>
                          {vendor.type}
                        </span>
                      </div>
                      <button onClick={() => handleEdit(vendor)} className="p-2 text-outline active:text-primary transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center -mr-2 -mt-2">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-t border-outline-variant pt-3 mt-1">
                      <div className="flex items-center gap-2 text-on-surface-variant font-body-standard text-[16px]">
                        <span className="material-symbols-outlined text-outline">call</span>
                        {vendor.phone || '-'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-label-caption text-[14px] ${isActive ? 'text-on-surface-variant' : 'text-outline'}`}>{isActive ? 'Active' : 'Inactive'}</span>
                        <label className="relative inline-flex items-center cursor-pointer ml-2">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isActive}
                            onChange={() => requestToggleActive(vendor)}
                          />
                          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Shared Forms & Modals */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant relative animate-fade-in w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20 p-2 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-[24px] text-on-surface mb-4">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Type *</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all">
                  <option value="vendor">Vendor</option>
                  <option value="shopkeeper">Shopkeeper</option>
                </select>
              </div>
              <div>
                <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all" />
              </div>
              <div className="sm:col-span-2 flex items-center mt-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant/50 w-fit">
                <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" />
                <label htmlFor="active" className="ml-2 block font-body-md text-[16px] text-on-surface cursor-pointer">Active Vendor</label>
              </div>
              <div className="sm:col-span-2 mt-4 flex gap-4 justify-end border-t border-outline-variant/30 pt-4">
                <button disabled={saving} type="submit" className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : (editingId ? 'Update Vendor' : 'Save Vendor')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-error mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">lock</span> Password Required
            </h3>
            <p className="text-on-surface-variant text-sm mb-4">
              Enter master password to change vendor status.
            </p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-xl text-[16px] mb-4 outline-none focus:border-error focus:ring-1 focus:ring-error"
              placeholder="Enter password"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmToggle()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmToggle} className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
