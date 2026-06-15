import { useTickerQuotes } from "@/hooks/useTickerQuotes";
import { formatNum } from "@/lib/formatINR";

export function MarketTickerBar() {
  const { quotes, cached } = useTickerQuotes(60_000);
  const items = quotes.length ? quotes : [];
  // Duplicate for seamless marquee
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border bg-background/70 backdrop-blur" style={{ height: 34 }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(90deg, var(--background) 0%, transparent 5%, transparent 95%, var(--background) 100%)",
        zIndex: 2,
      }} />
      {cached && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-[9px] font-mono uppercase tracking-wider text-amber-400/80 bg-background/80 px-1.5 py-0.5 rounded border border-amber-400/30">
          cached
        </span>
      )}
      <div className="flex items-center h-full animate-marquee whitespace-nowrap" style={{ width: "max-content" }}>
        {loop.map((q, i) => {
          const up = q.change >= 0;
          return (
            <div key={i} className="flex items-center gap-2 px-5 font-mono text-xs">
              <span className="text-muted-foreground tracking-wider">{q.name}</span>
              <span className="text-foreground font-semibold">{formatNum(q.price)}</span>
              <span style={{ color: up ? "#22c55e" : "#ef4444" }} className="text-[11px]">
                {up ? "▲" : "▼"} {formatNum(Math.abs(q.change))} ({up ? "+" : "-"}{formatNum(Math.abs(q.pct))}%)
              </span>
              <span className="text-border">·</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
