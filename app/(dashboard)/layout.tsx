'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
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
  { name: 'Ledger', href: '/ledger', icon: 'menu_book' },
  { name: 'Settings', href: '/settings', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

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
      <header className="md:hidden flex justify-between items-center px-lg w-full h-16 fixed top-0 z-40 bg-surface border-b border-outline-variant shadow-sm">
        <div className="flex items-center gap-sm">
          <span className="font-headline-md text-2xl md:text-headline-md font-bold text-primary">SST</span>
        </div>
        <div className="flex items-center gap-md">
          <span 
            className="material-symbols-outlined text-error cursor-pointer active:opacity-80 transition-colors hover:bg-error-container p-xs rounded-full" 
            onClick={handleLogout}
          >
            logout
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-sidebar-width min-h-screen pt-16 md:pt-0 pb-24 md:pb-lg flex flex-col">
        {children}
      </main>

      {/* Mobile BottomNavBar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around px-2 py-xs pb-safe bg-surface border-t border-outline-variant shadow-lg z-50">
        {navItems.filter(item => ['Dashboard', 'Billing', 'Purchases', 'Payments', 'Settlement'].includes(item.name)).map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={
                isActive
                  ? "flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-2xl px-3 py-1 touch-manipulation active:scale-90 transition-transform active:bg-surface-container"
                  : "flex flex-col items-center justify-center text-on-surface-variant px-3 py-1 touch-manipulation active:scale-90 transition-transform active:bg-surface-container rounded-2xl"
              }
            >
              <span 
                className="material-symbols-outlined text-[24px]" 
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className={`font-label-md text-label-md mt-xs text-[10px] ${isActive ? 'font-bold' : ''}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1 touch-manipulation active:scale-90 transition-transform active:bg-surface-container rounded-2xl"
        >
          <span className="material-symbols-outlined text-[24px]">grid_view</span>
          <span className="font-label-md text-label-md mt-xs text-[10px]">More</span>
        </button>
      </nav>

      {/* More Bottom Sheet */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsMoreOpen(false)}
          ></div>
          <div className="bg-surface rounded-t-3xl pb-safe pt-md px-md relative z-10 animate-fade-in-up">
            <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
              <h3 className="font-headline-sm font-bold text-on-surface ml-2">More Options</h3>
              <button onClick={() => setIsMoreOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-md pb-xl">
              {navItems.filter(item => ['Vendors', 'Products', 'Reports', 'Ledger'].includes(item.name)).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  className="flex flex-col items-center justify-center text-on-surface-variant p-2 touch-manipulation active:scale-90 transition-transform active:bg-surface-container rounded-2xl"
                >
                  <span className="material-symbols-outlined text-[28px] mb-1">{item.icon}</span>
                  <span className="font-label-md text-[11px] text-center">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
