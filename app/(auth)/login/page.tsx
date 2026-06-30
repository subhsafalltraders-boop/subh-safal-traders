'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // TEMPORARY BYPASS
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="animate-pulse font-headline-md text-primary">
        Redirecting to Dashboard...
      </div>
    </div>
  );
}

