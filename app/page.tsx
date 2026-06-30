import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-surface flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full sm:w-[90%] bg-surface-container-low p-8 rounded-3xl shadow-lg border border-outline-variant/30 text-center flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-4xl font-bold text-primary mb-2">Subh Safal Traders</h1>
          <p className="font-body-lg text-on-surface-variant text-lg">Ice Cream Distribution Agency, Madhubani</p>
        </div>

        <div className="mt-4">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center bg-primary text-on-primary px-8 py-3 rounded-full font-label-lg shadow-md hover:shadow-lg hover:bg-primary/90 transition-all active:scale-95"
          >
            Enter Dashboard (Temporary Bypass)
          </Link>
        </div>
      </div>
    </div>
  );
}
