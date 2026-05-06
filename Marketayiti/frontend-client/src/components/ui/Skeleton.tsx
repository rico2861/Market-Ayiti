export function MarketCardSkeleton() {
  return (
    <div className="mcard" style={{ pointerEvents: 'none' }}>
      <div className="flex items-start gap-3">
        <div className="skel w-9 h-9 rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="skel h-3.5 w-full" />
          <div className="skel h-3.5 w-3/4" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="skel h-3 w-1/3" />
        <div className="skel h-1 w-full" />
      </div>
      <div className="flex gap-1.5">
        <div className="skel h-8 flex-1" />
        <div className="skel h-8 flex-1" />
      </div>
      <div className="skel h-2.5 w-1/2" />
    </div>
  );
}

export function MarketGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => <MarketCardSkeleton key={i} />)}
    </div>
  );
}
