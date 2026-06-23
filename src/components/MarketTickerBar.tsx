import { useTickerQuotes } from "@/hooks/useTickerQuotes";
import { formatNum } from "@/lib/formatINR";

const SOURCE_DOT: Record<string, { color: string; label: string }> = {
  nse:    { color: "#22c55e", label: "live · nse" },
  yahoo:  { color: "#f59e0b", label: "delayed · yahoo" },
  cached: { color: "#f59e0b", label: "cached" },
  init:   { color: "#94a3b8", label: "loading" },
};

export function MarketTickerBar() {
  const { quotes, source, marketStatus } = useTickerQuotes(15_000);
  const items = quotes.length ? quotes : [];
  const loop = [...items, ...items];
  const meta = SOURCE_DOT[source] ?? SOURCE_DOT.init;
  const closed = marketStatus === "closed";
  return (
    <div className="relative overflow-hidden border-y border-border bg-background/70 backdrop-blur" style={{ height: 34 }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(90deg, var(--background) 0%, transparent 5%, transparent 95%, var(--background) 100%)",
        zIndex: 2,
      }} />
      <span
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider bg-background/80 px-1.5 py-0.5 rounded border"
        style={{ borderColor: closed ? "#f59e0b66" : `${meta.color}66`, color: closed ? "#f59e0b" : meta.color }}
        title={meta.label}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 5px ${meta.color}` }}
          aria-hidden
        />
        {closed ? "market closed" : meta.label}
      </span>
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
