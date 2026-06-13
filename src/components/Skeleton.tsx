export function Shimmer({ className = "", height = 16 }: { className?: string; height?: number }) {
  return (
    <div
      className={`dx-shimmer rounded ${className}`}
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} height={14} className="w-full" />
      ))}
    </div>
  );
}
