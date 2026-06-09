'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Settlement, Vendor } from '@/lib/types';
import Link from 'next/link';

export default function SettlementsHistoryPage() {
  const supabase = createClient();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterPassword, setMasterPassword] = useState('1234');
  
  // Filtering
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setPage(0);
    fetchSettlements(0, true);
  }, [vendorFilter]);

  const fetchInitialData = async () => {
    const [vendorsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type'),
      supabase.from('app_settings').select('key, value')
    ]);

    if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);

    let pwd = '1234';
    if ((settingsRes as any).data) {
      const allSettings = (settingsRes as any).data;
      const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = pwdSetting.value;
    }
    setMasterPassword(pwd);
  };

  const fetchSettlements = async (pageIndex: number, reset: boolean = false) => {
    setLoading(true);
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('settlements')
      .select('*, vendors(name)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (vendorFilter !== 'all') {
      query = query.eq('vendor_id', vendorFilter);
    }

    const { data } = await query;

    if (data) {
      if (reset) {
        setSettlements(data as Settlement[]);
      } else {
        setSettlements(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newSettlements = data.filter((s: any) => !existingIds.has(s.id));
          return [...prev, ...(newSettlements as Settlement[])];
        });
      }
      setHasMore(data.length === ITEMS_PER_PAGE);
    }
    setLoading(false);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSettlements(nextPage);
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
    setPasswordInput('');
    setShowPasswordModal(true);
  };

  const confirmDelete = async () => {
    if (passwordInput !== masterPassword) {
      toast.error("Incorrect password");
      return;
    }
    setShowPasswordModal(false);
    
    if (pendingDeleteId) {
      const { error } = await supabase.from('settlements').delete().eq('id', pendingDeleteId);
      if (error) {
        toast.error("Failed to delete settlement");
      } else {
        toast.success("Settlement deleted successfully");
        setPage(0);
        fetchSettlements(0, true);
      }
      setPendingDeleteId(null);
    }
  };

  const printPastSettlement = () => {
    toast.error("Printing past settlement requires loading data into print template.");
  };

  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-xs">
            <Link href="/settlements" className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Settlement History</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">View and manage past vendor settlements.</p>
        </div>
        
        <select 
          value={vendorFilter} 
          onChange={e => setVendorFilter(e.target.value)}
          className="px-md py-sm bg-surface border border-outline-variant rounded-xl focus:border-primary outline-none"
        >
          <option value="all">All Vendors</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col animate-fade-in">
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Date Settled</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Vendor</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm">Date Range</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Supplied</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Received</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Van Stock</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-right">Final Balance</th>
                <th className="px-md py-sm font-medium text-on-surface-variant uppercase text-sm text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {loading && page === 0 ? (
                <tr><td colSpan={8} className="px-md py-lg text-center text-on-surface-variant">Loading...</td></tr>
              ) : settlements.length === 0 ? (
                <tr><td colSpan={8} className="px-md py-lg text-center text-on-surface-variant">No settlements found.</td></tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm text-on-surface-variant">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-md py-sm font-medium text-primary">{(s as any).vendors?.name || 'Unknown'}</td>
                    <td className="px-md py-sm text-on-surface-variant text-sm">{s.date_from} to {s.date_to}</td>
                    <td className="px-md py-sm text-right text-on-surface-variant">₹{s.total_supplied.toLocaleString('en-IN', {minimumFractionDigits: 0})}</td>
                    <td className="px-md py-sm text-right text-[#166534]">₹{s.total_received.toLocaleString('en-IN', {minimumFractionDigits: 0})}</td>
                    <td className="px-md py-sm text-right text-error">₹{((s as any).van_stock_value || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</td>
                    <td className="px-md py-sm text-right">
                      <span className={`font-bold ${s.final_balance > 0 ? 'text-error' : s.final_balance < 0 ? 'text-[#166534]' : 'text-on-surface-variant'}`}>
                        ₹{s.final_balance.toLocaleString('en-IN', {minimumFractionDigits: 0})}
                      </span>
                    </td>
                    <td className="px-md py-sm text-center">
                      <button onClick={printPastSettlement} className="text-secondary hover:text-secondary-container transition-colors mr-sm p-1 rounded-full">
                        <span className="material-symbols-outlined text-[20px]">print</span>
                      </button>
                      <button onClick={() => handleDeleteRequest(s.id)} className="text-error hover:bg-error/10 transition-colors p-1 rounded-full">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-outline-variant/30">
          {loading && page === 0 ? (
            <div className="p-md text-center text-on-surface-variant">Loading...</div>
          ) : settlements.length === 0 ? (
            <div className="p-md text-center text-on-surface-variant">No settlements found.</div>
          ) : (
            settlements.map((s) => (
              <div key={s.id} className="p-md flex flex-col gap-sm">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-primary text-[16px]">{(s as any).vendors?.name || 'Unknown'}</div>
                  <div className={`font-bold text-[16px] ${s.final_balance > 0 ? 'text-error' : s.final_balance < 0 ? 'text-[#166534]' : 'text-on-surface-variant'}`}>
                    Bal: ₹{s.final_balance.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-on-surface-variant text-sm mt-xs">{s.date_from} to {s.date_to}</div>
                <div className="grid grid-cols-2 gap-xs text-sm mt-sm">
                  <div className="text-on-surface-variant">Sup: ₹{s.total_supplied.toLocaleString('en-IN')}</div>
                  <div className="text-[#166534]">Rec: ₹{s.total_received.toLocaleString('en-IN')}</div>
                  <div className="text-error col-span-2">Van: ₹{((s as any).van_stock_value || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="flex justify-end mt-xs gap-md">
                  <button onClick={printPastSettlement} className="text-secondary p-2 bg-secondary/10 rounded-full">
                    <span className="material-symbols-outlined text-[18px]">print</span>
                  </button>
                  <button onClick={() => handleDeleteRequest(s.id)} className="text-error p-2 bg-error/10 rounded-full">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {hasMore && !loading && settlements.length > 0 && (
          <button onClick={loadMore} className="p-md text-primary font-medium hover:bg-surface-container-low transition-colors w-full border-t border-outline-variant">
            Load More
          </button>
        )}
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-lg w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-error mb-sm flex items-center gap-2">
              <span className="material-symbols-outlined">lock</span> Password Required
            </h3>
            <p className="text-on-surface-variant text-sm mb-md">Enter master password to delete this settlement.</p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl text-[16px] mb-md outline-none focus:border-error focus:ring-1 focus:ring-error"
              placeholder="Enter password"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
            />
            <div className="flex justify-end gap-sm">
              <button onClick={() => setShowPasswordModal(false)} className="px-md py-sm text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-md py-sm bg-error text-white rounded-xl hover:bg-error/90 transition-colors">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
