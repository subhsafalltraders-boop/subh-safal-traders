'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { name: 'Billing', href: '/billing', icon: 'receipt_long' },
  { name: 'Purchases', href: '/purchases', icon: 'local_shipping' },
  { name: 'Payments', href: '/payments', icon: 'payments' },
  { name: 'Settlement', href: '/settlements', icon: 'account_balance_wallet' },
  { name: 'Vendors', href: '/vendors', icon: 'storefront' },
  { name: 'Products', href: '/products', icon: 'inventory_2' },
  { name: 'Reports', href: '/reports', icon: 'assessment' },
  { name: 'Profit', href: '/profit', icon: 'trending_up' },
  { name: 'Settings', href: '/settings', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const mainMobileItems = ['Billing', 'Payments', 'Reports'];
  const drawerMobileItems = navItems.filter(item => !mainMobileItems.includes(item.name));

  return (
    <div className="flex w-full bg-background text-on-background min-h-screen md:flex-row flex-col relative">
      {/* Desktop SideNavBar */}
      <aside className="w-sidebar-width h-screen fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant shadow-none hidden md:flex flex-col gap-sm py-lg z-50">
        <div className="px-lg pb-md mb-md border-b border-outline-variant">
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Subh Safal Traders</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Ice Cream Distribution</p>
        </div>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-xs">
          {navItems.map((item) => {
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full md:w-auto md:ml-sidebar-width min-h-screen pb-24 md:pb-lg flex flex-col">
        {children}
      </main>

      {/* Mobile BottomNavBar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white z-50 border-t flex justify-around items-center h-[64px] px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
        {navItems.filter(item => mainMobileItems.includes(item.name)).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={
                isActive
                  ? "flex flex-col items-center justify-center text-primary font-bold flex-1 active:bg-surface-container-highest rounded-lg h-full transition-colors"
                  : "flex flex-col items-center justify-center text-on-surface-variant flex-1 active:bg-surface-container-highest rounded-lg h-full transition-colors"
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
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center text-on-surface-variant flex-1 active:bg-surface-container-highest rounded-lg h-full transition-colors"
        >
          <span className="material-symbols-outlined text-[24px] mb-1">menu</span>
          <span className="font-label-caption text-[10px] leading-tight">Menu</span>
        </button>
      </nav>

      {/* Mobile Drawer (Bottom Sheet) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          {/* Sheet Content */}
          <div className="relative bg-surface w-full rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up pb-6">
            <div className="w-12 h-1.5 bg-outline-variant rounded-full mx-auto my-3"></div>
            <div className="px-4 pb-4">
              <h2 className="font-title-main text-[18px] font-bold text-on-surface mb-4">More Options</h2>
              <div className="grid grid-cols-3 gap-4">
                {drawerMobileItems.map((item) => {
                  const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={
                        isActive
                          ? "flex flex-col items-center justify-center p-3 rounded-xl bg-primary-container text-on-primary-container"
                          : "flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors"
                      }
                    >
                      <span className="material-symbols-outlined mb-1" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                      <span className="text-[12px] font-medium text-center">{item.name === 'Settlement' ? 'Hisaab' : item.name}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-error-container text-on-error-container col-span-3 mt-2"
                >
                  <span className="material-symbols-outlined mb-1">logout</span>
                  <span className="text-[12px] font-medium text-center">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
