'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    company_name: '',
    gst_number: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    app_password: '1234'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: settingsRes, error } = await supabase.from('app_settings').select('*');

    if (!error && settingsRes) {
      let companyName = '';
      let gstNumber = '';
      let appPassword = '1234';

      settingsRes.forEach((setting: any) => {
        if (setting.key === 'company_name') companyName = setting.value;
        if (setting.key === 'gst_number') gstNumber = setting.value;
        if (setting.key === 'app_password') appPassword = setting.value;
      });

      setSettingsForm({ company_name: companyName, gst_number: gstNumber });
      setPasswordForm({ app_password: appPassword });
    }
    setLoading(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    
    // UPSERT keys
    const toUpsert = [
       { key: 'company_name', value: settingsForm.company_name },
       { key: 'gst_number', value: settingsForm.gst_number }
    ];

    let hasError = false;
    for (const item of toUpsert) {
       // Check if exists
       const { data } = await (supabase as any).from('app_settings').select('id').eq('key', item.key).single();
       if (data) {
          const { error } = await (supabase as any).from('app_settings').update({ value: item.value }).eq('id', data.id);
          if (error) hasError = true;
       } else {
          const { error } = await (supabase as any).from('app_settings').insert([item]);
          if (error) hasError = true;
       }
    }

    setSavingSettings(false);

    if (hasError) {
      toast.error("Failed to update company settings");
    } else {
      toast.success("Company settings updated");
      fetchData();
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.app_password || passwordForm.app_password.trim() === '') {
       toast.error("Password cannot be empty");
       return;
    }

    setSavingPassword(true);
    
    const { data } = await (supabase as any).from('app_settings').select('id').eq('key', 'app_password').single();
    let error;
    
    if (data) {
       const res = await (supabase as any).from('app_settings').update({ value: passwordForm.app_password }).eq('id', data.id);
       error = res.error;
    } else {
       const res = await (supabase as any).from('app_settings').insert([{ key: 'app_password', value: passwordForm.app_password }]);
       error = res.error;
    }

    setSavingPassword(false);

    if (error) {
      toast.error("Failed to update master password");
    } else {
      toast.success("Master password updated successfully");
      fetchData();
    }
  };

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg overflow-y-auto h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Settings</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Manage app preferences and configurations.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-xl text-on-surface-variant">Loading settings...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg max-w-6xl animate-fade-in">
          
          {/* Security Settings */}
          <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm flex flex-col h-fit">
            <div className="flex items-center gap-sm mb-md pb-sm border-b border-outline-variant">
               <span className="material-symbols-outlined text-primary">security</span>
               <h3 className="font-headline-sm text-on-surface">Security</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-md">
               Master password is required for deleting bills, recording settlements, and managing vendors. Default is <code className="bg-surface-container px-1 py-0.5 rounded text-primary">1234</code>.
            </p>
            <form onSubmit={handleSavePassword} className="flex flex-col gap-md">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-xs">Master Password</label>
                <input
                  type="text"
                  value={passwordForm.app_password}
                  onChange={(e) => setPasswordForm({...passwordForm, app_password: e.target.value})}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Enter new master password"
                />
              </div>
              
              <div className="flex justify-end mt-sm">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full sm:w-auto px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* App Settings */}
          <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl shadow-sm h-fit">
            <div className="flex items-center gap-sm mb-md pb-sm border-b border-outline-variant">
               <span className="material-symbols-outlined text-primary">business</span>
               <h3 className="font-headline-sm text-on-surface">Company Info</h3>
            </div>
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-md">
              <div>
                <label className="block font-label-md text-on-surface-variant mb-xs">Company Name</label>
                <input
                  type="text"
                  value={settingsForm.company_name}
                  onChange={(e) => setSettingsForm({...settingsForm, company_name: e.target.value})}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Subh Safal Traders"
                />
              </div>
              <div>
                <label className="block font-label-md text-on-surface-variant mb-xs">GST Number</label>
                <input
                  type="text"
                  value={settingsForm.gst_number}
                  onChange={(e) => setSettingsForm({...settingsForm, gst_number: e.target.value})}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div className="flex justify-end mt-sm">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full sm:w-auto px-xl py-sm bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Info'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 mt-md p-md bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary text-[24px]">info</span>
                <div>
                   <p className="font-medium text-on-surface">App Version 2.0</p>
                   <p className="text-xs text-on-surface-variant">Built for performance and responsive design.</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
