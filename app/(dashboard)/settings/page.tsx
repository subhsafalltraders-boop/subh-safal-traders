'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { VanPriceCategory, AppSetting } from '@/lib/types';

export default function SettingsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<VanPriceCategory[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    price: ''
  });

  const [settingsForm, setSettingsForm] = useState({
    company_name: '',
    gst_number: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [catsRes, settingsRes] = await Promise.all([
      supabase.from('van_price_categories').select('*').order('price', { ascending: false }),
      supabase.from('app_settings').select('*').limit(1).single()
    ]);

    if ((catsRes as any).data) setCategories((catsRes as any).data as VanPriceCategory[]);
    if ((settingsRes as any).data) {
      const setting = (settingsRes as any).data as AppSetting;
      setAppSetting(setting);
      setSettingsForm({
        company_name: setting.company_name || '',
        gst_number: setting.gst_number || ''
      });
    }
    setLoading(false);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name || !categoryForm.price) {
      toast.error("Please enter name and price");
      return;
    }

    setSavingCategory(true);
    const payload = {
      name: categoryForm.name,
      price: Number(categoryForm.price)
    };

    const { error } = await (supabase as any).from('van_price_categories').insert([payload]);
    
    setSavingCategory(false);
    
    if (error) {
      toast.error("Failed to add category");
    } else {
      toast.success("Category added successfully");
      setCategoryForm({ name: '', price: '' });
      fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      const { error } = await supabase.from('van_price_categories').delete().eq('id', id);
      if (error) {
        toast.error("Failed to delete category");
      } else {
        toast.success("Category deleted");
        fetchData();
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    
    const payload = {
      company_name: settingsForm.company_name,
      gst_number: settingsForm.gst_number
    };

    let error;
    if (appSetting?.id) {
      const res = await (supabase as any).from('app_settings').update(payload).eq('id', appSetting.id);
      error = res.error;
    } else {
      const res = await (supabase as any).from('app_settings').insert([payload]);
      error = res.error;
    }

    setSavingSettings(false);

    if (error) {
      toast.error("Failed to update settings");
    } else {
      toast.success("Settings updated");
      fetchData();
    }
  };

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Settings</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage app preferences and configurations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* App Settings */}
        <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-lg ambient-shadow">
          <h3 className="font-headline-sm text-on-surface mb-md pb-xs border-b border-outline-variant">Company Info</h3>
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-md">
            <div>
              <label className="block font-label-md text-on-surface-variant mb-xs">Company Name</label>
              <input
                type="text"
                value={settingsForm.company_name}
                onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md focus:border-primary focus:outline-none"
                placeholder="Subh Safal Traders"
              />
            </div>
            <div>
              <label className="block font-label-md text-on-surface-variant mb-xs">GST Number</label>
              <input
                type="text"
                value={settingsForm.gst_number}
                onChange={(e) => setSettingsForm({...settingsForm, gst_number: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md focus:border-primary focus:outline-none"
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="flex justify-end mt-sm">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-xl py-sm bg-primary text-on-primary font-label-md rounded-DEFAULT hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Van Price Categories */}
        <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-lg ambient-shadow flex flex-col h-full">
          <h3 className="font-headline-sm text-on-surface mb-md pb-xs border-b border-outline-variant">Van Price Categories</h3>
          <form onSubmit={handleSaveCategory} className="flex flex-col sm:flex-row gap-md mb-lg">
            <div className="flex-1">
              <label className="block font-label-md text-on-surface-variant mb-xs">Label / Name</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md focus:border-primary focus:outline-none"
                placeholder="e.g. ₹10 MRP"
              />
            </div>
            <div className="flex-1">
              <label className="block font-label-md text-on-surface-variant mb-xs">Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={categoryForm.price}
                onChange={(e) => setCategoryForm({...categoryForm, price: e.target.value})}
                className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-DEFAULT font-body-md focus:border-primary focus:outline-none"
                placeholder="10"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={savingCategory}
                className="w-full sm:w-auto px-lg py-sm bg-secondary text-on-secondary font-label-md rounded-DEFAULT hover:bg-secondary/90 transition-colors disabled:opacity-50 h-[38px]"
              >
                {savingCategory ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto border border-outline-variant rounded-md">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F1F5F9] border-b border-outline-variant sticky top-0">
                <tr>
                  <th className="px-md py-sm font-label-md text-on-surface-variant">Name</th>
                  <th className="px-md py-sm font-label-md text-on-surface-variant text-right">Price</th>
                  <th className="px-md py-sm font-label-md text-on-surface-variant text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {loading ? (
                  <tr><td colSpan={3} className="px-md py-md text-center text-on-surface-variant">Loading...</td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={3} className="px-md py-md text-center text-on-surface-variant">No categories found.</td></tr>
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm font-medium">{cat.name}</td>
                      <td className="px-md py-sm text-right font-medium text-primary">₹{cat.price.toLocaleString('en-IN')}</td>
                      <td className="px-md py-sm text-center">
                        <button onClick={() => handleDeleteCategory(cat.id)} className="text-error hover:text-error-container transition-colors">
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
    </div>
  );
}
