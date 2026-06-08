import { createServerClient } from '@/lib/supabase/server';
import type { Bill, Payment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  const [
    { data: billsToday },
    { data: paymentsToday },
    { data: allPayments },
    { count: activeVendorsCount },
    { data: recentBills }
  ] = await Promise.all([
    supabase.from('bills').select('grand_total').eq('date', today),
    supabase.from('payments').select('total_received').eq('date', today),
    supabase.from('payments').select('outstanding'),
    supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('bills').select('*').eq('date', today).order('created_at', { ascending: false })
  ]);

  const totalSalesToday = (billsToday as unknown as Bill[] | null)?.reduce((sum, bill) => sum + (bill.grand_total || 0), 0) || 0;
  const totalCollectionToday = (paymentsToday as unknown as Payment[] | null)?.reduce((sum, payment) => sum + (payment.total_received || 0), 0) || 0;
  const totalOutstanding = (allPayments as unknown as Payment[] | null)?.reduce((sum, payment) => sum + (payment.outstanding || 0), 0) || 0;

  return (
    <>
      {/* Page Header & Controls */}
      <div className="px-md md:px-container-padding py-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md border-b border-outline-variant/30 bg-surface-container-lowest sticky top-16 md:top-0 z-30">
        <div>
          <h2 className="font-headline-lg text-headline-lg hidden md:block">Dashboard Overview</h2>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:hidden">Overview</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Summary for {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-md">
          {/* Total Sales */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Aaj ki Total Sales</span>
              <div className="bg-primary-container/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-primary-container">receipt_long</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface table-lining-figures">
              ₹{totalSalesToday.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Collection */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Aaj ka Total Collection</span>
              <div className="bg-[#166534]/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-[#166534]">payments</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface table-lining-figures">
              ₹{totalCollectionToday.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Total Outstanding */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Outstanding Amount</span>
              <div className="bg-[#9a3412]/10 p-sm rounded-full">
                <span className="material-symbols-outlined text-[#9a3412]">warning</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-[#9a3412] table-lining-figures">
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Active Vendors */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md ambient-shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-sm">
              <span className="font-label-lg text-label-lg text-on-surface-variant">Active Vendors</span>
              <div className="bg-secondary-container/30 p-sm rounded-full">
                <span className="material-symbols-outlined text-on-secondary-container">group</span>
              </div>
            </div>
            <div className="font-headline-lg text-headline-lg text-on-surface table-lining-figures">
              {activeVendorsCount || 0}
            </div>
          </div>
        </div>

        {/* Detailed Report Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg ambient-shadow overflow-hidden flex flex-col flex-1">
          <div className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Today's Bills</h3>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-outline-variant">
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4">Bill Number</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4">Vendor Name</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4 text-right">Grand Total</th>
                  <th className="px-md py-sm font-label-md text-label-md text-on-surface-variant uppercase tracking-wider w-1/4">Time</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant/50">
                {!recentBills || recentBills.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-md py-lg text-center text-on-surface-variant">
                      No bills recorded today yet.
                    </td>
                  </tr>
                ) : (
                  (recentBills as unknown as Bill[] | null)?.map((bill) => (
                    <tr key={bill.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-md py-sm font-medium text-primary">{bill.bill_number}</td>
                      <td className="px-md py-sm">{bill.vendor_name}</td>
                      <td className="px-md py-sm text-right table-lining-figures font-medium">₹{bill.grand_total.toLocaleString('en-IN')}</td>
                      <td className="px-md py-sm text-on-surface-variant">
                        {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
