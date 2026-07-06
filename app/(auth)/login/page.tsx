'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-md">
      <div className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-xl flex flex-col gap-lg">
        <div className="flex flex-col items-center gap-sm text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[24px]">storefront</span>
          </div>
          <div>
            <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Subh Safal Traders</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Ice Cream Distribution</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-sm">
              <p className="text-error text-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-xs px-xl py-sm bg-primary text-on-primary font-label-lg rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 mt-xs"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
