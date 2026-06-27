'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { name: 'Dashboard', href: '/', icon: 'dashboard' },
  { name: 'Billing', href: '/billing', icon: 'receipt_long' },
  { name: 'Purchases', href: '/purchases', icon: 'local_shipping' },
  { name: 'Payments', href: '/payments', icon: 'payments' },
  { name: 'Settlement', href: '/settlements', icon: 'account_balance_wallet' },
  { name: 'Vendors', href: '/vendors', icon: 'storefront' },
  { name: 'Products', href: '/products', icon: 'inventory_2' },
  { name: 'Reports', href: '/reports', icon: 'assessment' },
  { name: 'Settings', href: '/settings', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex bg-background text-on-background min-h-screen">
      {/* Desktop SideNavBar */}
      <nav className="w-sidebar-width h-screen fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant shadow-none hidden md:flex flex-col gap-sm py-lg z-50">
        <div className="px-lg pb-md mb-md border-b border-outline-variant">
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Subh Safal Traders</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Ice Cream Distribution</p>
        </div>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-xs">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={
                  isActive
                    ? "flex items-center gap-md bg-secondary-container text-on-secondary-container border-l-4 border-primary px-md py-sm cursor-pointer active:scale-95 transition-all"
                    : "flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer active:scale-95"
                }
              >
                <span 
                  className="material-symbols-outlined" 
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span className={`font-label-lg text-label-lg ${isActive ? 'font-bold' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="px-md mt-auto pt-md border-t border-outline-variant flex flex-col gap-xs">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-md text-error px-sm py-sm hover:bg-error-container transition-all cursor-pointer rounded-DEFAULT"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-lg text-label-lg">Logout</span>
          </button>
        </div>
      </nav>

      {/* Mobile TopAppBar */}
      <header className="md:hidden docked full-width top-0 sticky border-b border-outline-variant shadow-sm transition-colors duration-200 flex justify-between items-center h-[56px] px-[16px] w-full z-50 bg-surface">
        <h1 className="font-title-main text-[20px] leading-[28px] font-bold text-primary">SST</h1>
        <button onClick={handleLogout} className="active:bg-surface-container-high p-2 -mr-2 rounded-full text-error flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-sidebar-width min-h-screen pt-16 md:pt-0 pb-24 md:pb-lg flex flex-col">
        {children}
      </main>

      {/* Mobile BottomNavBar */}
      <nav className="md:hidden docked full-width bottom-0 fixed border-t border-outline-variant shadow-lg w-full h-[64px] z-50 flex justify-start overflow-x-auto hide-scrollbar whitespace-nowrap items-center bg-surface px-2 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        {navItems.filter(item => ['Dashboard', 'Bills', 'Billing', 'Payments', 'Settlement', 'Vendors', 'Reports', 'Purchases'].includes(item.name)).map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={
                isActive
                  ? "flex flex-col items-center justify-center text-primary font-bold w-16 active:bg-surface-container-highest rounded-lg py-1 transition-colors flex-shrink-0 mx-1"
                  : "flex flex-col items-center justify-center text-on-surface-variant w-16 active:bg-surface-container-highest rounded-lg py-1 transition-colors flex-shrink-0 mx-1"
              }
            >
              <span 
                className="material-symbols-outlined text-[24px] mb-1" 
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="font-label-caption text-[10px] leading-tight">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
