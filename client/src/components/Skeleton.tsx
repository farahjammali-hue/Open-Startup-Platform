/**
 * Shimmering placeholder blocks, swapped in wherever a page previously showed plain "Loading..." text.
 * Pass tone="dark" when placing directly on the app's dark canvas (outside a white ost-card).
 */
export function Skeleton({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return <div className={`animate-pulse rounded-md ${tone === "dark" ? "bg-white/10" : "bg-slate-200"} ${className}`} />;
}

export function SkeletonText({ lines = 3, className = "", tone = "light" }: { lines?: number; className?: string; tone?: "light" | "dark" }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} tone={tone} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Row placeholders for inside a <tbody>; pass the real column count so cells line up. */
export function SkeletonRows({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-4">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Card-shaped placeholders for list/grid pages built from ost-card blocks rather than a table. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ost-card p-5">
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}
