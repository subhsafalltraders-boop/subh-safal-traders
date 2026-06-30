'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TEMPORARY BYPASS FOR RAZORPAY APPROVAL
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-[448px] space-y-8 bg-surface p-xl rounded-2xl shadow-xl border border-outline-variant/30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex justify-center mb-md">
            <span className="material-symbols-outlined text-[48px] text-primary">icecream</span>
          </div>
          <h2 className="mt-2 text-center font-headline-lg text-headline-lg font-bold text-on-surface">
            Subh Safal Traders
          </h2>
          <p className="mt-2 text-center font-body-md text-body-md text-on-surface-variant">
            Ice Cream Distribution Management
          </p>
        </div>
        
        <form className="mt-8 space-y-lg relative z-10" onSubmit={handleLogin}>
          <div className="space-y-md">
            <div>
              <label htmlFor="email-address" className="block font-label-md text-label-md text-on-surface-variant mb-xs">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block font-label-md text-label-md text-on-surface-variant mb-xs mt-md">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="font-body-sm text-error text-center bg-error/10 p-sm rounded-lg border border-error/20 flex items-center justify-center gap-xs">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          <div className="pt-sm">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-sm w-full px-md py-md bg-primary text-on-primary font-label-lg rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  Signing in...
                </>
              ) : 'Sign in to Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
