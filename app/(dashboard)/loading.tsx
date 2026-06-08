export default function DashboardLoading() {
  return (
    <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center border-b border-outline-variant/30 pb-lg">
        <div>
          <div className="h-8 w-48 bg-surface-variant rounded mb-2"></div>
          <div className="h-4 w-32 bg-surface-variant rounded"></div>
        </div>
        <div className="flex gap-sm">
          <div className="h-10 w-24 bg-surface-variant rounded"></div>
          <div className="h-10 w-36 bg-surface-variant rounded"></div>
          <div className="h-10 w-32 bg-surface-variant rounded"></div>
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-md">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface border border-outline-variant rounded-lg p-md">
            <div className="flex justify-between items-start mb-sm">
              <div className="h-4 w-24 bg-surface-variant rounded"></div>
              <div className="h-10 w-10 bg-surface-variant rounded-full"></div>
            </div>
            <div className="h-8 w-32 bg-surface-variant rounded"></div>
          </div>
        ))}
      </div>

      {/* Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md flex-1">
        <div className="lg:col-span-2 bg-surface border border-outline-variant rounded-lg p-md">
          <div className="h-6 w-32 bg-surface-variant rounded mb-md"></div>
          <div className="space-y-sm">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-surface-variant rounded"></div>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-outline-variant rounded-lg p-md">
          <div className="h-6 w-40 bg-surface-variant rounded mb-md"></div>
          <div className="space-y-sm">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 w-full bg-surface-variant rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
