'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Settlement, Vendor, AppSetting } from '@/lib/types';
import Link from 'next/link';
import { generateSettlementHTML } from '@/lib/printUtils';

export default function SettlementsHistoryPage() {
  const supabase = createClient();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
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
    try {
      const [vendorsRes, settingsRes] = await Promise.all([
        supabase.from('vendors').select('id, name, type'),
        supabase.from('app_settings').select('*')
      ]);

      if ((vendorsRes as any).data) setVendors((vendorsRes as any).data as Vendor[]);

      if ((settingsRes as any).data && (settingsRes as any).data.length > 0) {
        setAppSetting((settingsRes as any).data[0] as AppSetting);
        
        // Check for app_password in key-value format
        const allSettings = (settingsRes as any).data;
        const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
        if (pwdSetting) setMasterPassword(pwdSetting.value);
      }
    } catch (err) {
      console.error('fetchInitialData failed:', err);
      toast.error('Data load nahi ho paya — internet check karke phir try karein.');
    }
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

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching settlements:', error);
      toast.error('Settlements load nahi ho paaye — internet check karke phir try karein.');
    }

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

  const printPastSettlement = async (settlement: Settlement) => {
    const vendorName = (settlement as any).vendors?.name || settlement.vendor_name || 'Unknown Vendor';
    
    // Fetch bills for this settlement period
    const { data: settlementBills } = await supabase
      .from('bills')
      .select('bill_number, date, grand_total')
      .eq('vendor_id', settlement.vendor_id)
      .eq('is_deleted', false)
      .gte('date', settlement.date_from)
      .lte('date', settlement.date_to)
      .order('date', { ascending: true });

    // We alias grand_total to total to match the expected format
    const formattedBills = (settlementBills || []).map((b: any) => ({
      ...b,
      total: b.grand_total
    }));

    // Fetch payments for this settlement period
    const { data: settlementPayments } = await supabase
      .from('payments')
      .select('date, total_received')
      .eq('vendor_id', settlement.vendor_id)
      .eq('is_deleted', false)
      .gte('date', settlement.date_from)
      .lte('date', settlement.date_to);

    const settlementHTML = generateSettlementHTML(settlement, vendorName, appSetting, formattedBills, settlementPayments || []);
    
    // Open in new window and print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(settlementHTML);
      printWindow.document.close();
      // Wait for content to load before triggering print
      printWindow.onload = () => {
        printWindow.focus();
      };
    } else {
      toast.error("Please allow pop-ups to print settlements");
    }
  };

  return (
    <div className="p-space-md md:p-container-padding flex-1 flex flex-col gap-space-lg h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs">
            <Link href="/settlements" className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Settlement History</h2>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">View and manage past vendor settlements.</p>
        </div>
        
        <select 
          value={vendorFilter} 
          onChange={e => setVendorFilter(e.target.value)}
          className="px-space-md py-space-sm bg-surface border border-outline-variant rounded-xl focus:border-primary outline-none"
        >
          <option value="all">All Vendors</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col animate-fade-in">
        <div className="flex flex-col gap-space-md">
          {loading && page === 0 ? (
            <div className="p-space-xl text-center text-on-surface-variant bg-surface-container-low rounded-xl">Loading settlements...</div>
          ) : settlements.length === 0 ? (
            <div className="p-space-xl text-center text-on-surface-variant bg-surface-container-low rounded-xl">No past settlements found.</div>
          ) : (
            settlements.map((s, index) => {
              const isLatest = page === 0 && index === 0 && vendorFilter !== 'all';
              return (
                <div key={s.id} className={`p-space-md sm:p-space-lg bg-surface rounded-2xl border ${isLatest ? 'border-primary shadow-md relative overflow-hidden' : 'border-outline-variant/30 shadow-sm'} flex flex-col gap-space-md transition-all hover:shadow-md`}>
                  {isLatest && (
                    <div className="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                      Latest Settlement
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-headline-sm text-primary mb-1">{(s as any).vendors?.name || 'Unknown Vendor'}</div>
                      <div className="text-on-surface-variant text-sm font-medium bg-surface-variant/30 inline-block px-2 py-1 rounded-md">
                        {s.date_from} &rarr; {s.date_to}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-on-surface-variant mb-1">Settled On</div>
                      <div className="font-medium text-on-surface">{new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/20">
                    <div>
                      <div className="text-xs text-on-surface-variant mb-1">Total Supplied</div>
                      <div className="font-semibold text-on-surface">₹{s.total_supplied.toLocaleString('en-IN', {minimumFractionDigits: 0})}</div>
                    </div>
                    <div>
                      <div className="text-xs text-on-surface-variant mb-1">Total Received</div>
                      <div className="font-semibold text-[#166534]">₹{s.total_received.toLocaleString('en-IN', {minimumFractionDigits: 0})}</div>
                    </div>
                    <div>
                      <div className="text-xs text-on-surface-variant mb-1">Van Stock</div>
                      <div className="font-semibold text-error">₹{((s as any).van_stock_value || 0).toLocaleString('en-IN', {minimumFractionDigits: 0})}</div>
                    </div>
                    <div className="border-l border-outline-variant/30 pl-space-sm">
                      <div className="text-xs text-on-surface-variant mb-1">Final Balance</div>
                      <div className={`font-bold text-lg ${s.final_balance > 0 ? 'text-error' : s.final_balance < 0 ? 'text-[#166534]' : 'text-on-surface-variant'}`}>
                        ₹{s.final_balance.toLocaleString('en-IN', {minimumFractionDigits: 0})}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-space-sm mt-space-xs">
                    <button onClick={() => printPastSettlement(s)} className="flex items-center gap-1 text-sm font-medium text-secondary hover:bg-secondary/10 px-3 py-2 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">print</span> Print
                    </button>
                    <button onClick={() => handleDeleteRequest(s.id)} className="flex items-center gap-1 text-sm font-medium text-error hover:bg-error/10 px-3 py-2 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {hasMore && !loading && settlements.length > 0 && (
          <div className="flex justify-center p-space-md">
            <button onClick={loadMore} className="px-space-xl py-space-sm bg-surface-container text-primary font-medium hover:bg-surface-variant transition-colors rounded-xl shadow-sm border border-outline-variant/30">
              Load More Settlements
            </button>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-space-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-sm shadow-lg animate-fade-in">
            <h3 className="font-headline-sm text-error mb-space-sm flex items-center gap-2">
              <span className="material-symbols-outlined">lock</span> Password Required
            </h3>
            <p className="text-on-surface-variant text-sm mb-space-md">Enter master password to delete this settlement.</p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full px-space-md py-space-sm bg-surface border border-outline-variant rounded-xl text-[16px] mb-space-md outline-none focus:border-error focus:ring-1 focus:ring-error"
              placeholder="Enter password"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
            />
            <div className="flex justify-end gap-space-sm">
              <button onClick={() => setShowPasswordModal(false)} className="px-space-md py-space-sm text-on-surface-variant hover:bg-surface-variant/20 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-space-md py-space-sm bg-error text-white rounded-xl hover:bg-error/90 transition-colors">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
