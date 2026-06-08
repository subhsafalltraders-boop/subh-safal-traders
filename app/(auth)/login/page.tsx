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
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-[448px] space-y-8 bg-surface-container-lowest p-xl rounded-xl ambient-shadow border border-outline-variant">
        <div>
          <h2 className="mt-6 text-center font-headline-lg text-headline-lg text-primary">
            Subh Safal Traders
          </h2>
          <p className="mt-2 text-center font-body-md text-body-md text-on-surface-variant">
            Ice Cream Distribution
          </p>
        </div>
        
        <form className="mt-8 space-y-lg" onSubmit={handleLogin}>
          <div className="space-y-md rounded-md shadow-sm">
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
                className="w-full px-md py-sm bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block font-label-md text-label-md text-on-surface-variant mb-xs">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-md py-sm bg-surface border border-outline-variant rounded-DEFAULT font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="font-body-md text-body-md text-error text-center bg-error-container p-sm rounded-DEFAULT border border-[#ffdad6]">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-full px-md py-sm bg-primary text-on-primary font-label-md text-label-md rounded-DEFAULT hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
