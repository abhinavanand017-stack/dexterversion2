import { memo, useEffect, useRef, useState } from "react";
import { useMarketData } from "@/hooks/useMarketData";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { formatNum } from "@/lib/formatINR";

const LABELS: Record<string, string> = { nifty: "NIFTY 50", sensex: "SENSEX", vix: "INDIA VIX" };

const SOURCE_META: Record<string, { color: string; label: string }> = {
  nse:         { color: "#22c55e", label: "live · nse" },
  yahoo:       { color: "#22c55e", label: "live · yahoo" },
  marketstack: { color: "#f59e0b", label: "delayed · marketstack" },
  twelvedata:  { color: "#22c55e", label: "live · twelvedata" },
  cached:      { color: "#f59e0b", label: "cached" },
  seed:        { color: "#ef4444", label: "fallback" },
  init:        { color: "#94a3b8", label: "loading" },
};

const Item = memo(function Item({
  label, price, change, pct,
}: { label: string; price: number; change: number; pct: number }) {
  const prev = useRef(price);
  const elRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!elRef.current) return;
    if (price > prev.current) {
      elRef.current.classList.remove("dx-flash-down");
      elRef.current.classList.add("dx-flash-up");
    } else if (price < prev.current) {
      elRef.current.classList.remove("dx-flash-up");
      elRef.current.classList.add("dx-flash-down");
    }
    prev.current = price;
  }, [price]);
  const up = change >= 0;
  return (
    <div ref={elRef} className="dx-ticker-item">
      <span className="dx-ticker-sym">{label}</span>
      <span className="dx-ticker-ltp" style={{ transition: "color 0.4s" }}>{formatNum(price)}</span>
      <span style={{ color: up ? "#22c55e" : "#ef4444" }}>
        {up ? "▲" : "▼"} {formatNum(Math.abs(change))} ({up ? "+" : "-"}{formatNum(Math.abs(pct))}%)
      </span>
    </div>
  );
});

function useAgoTick(lastMs: number | null): string {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!lastMs) return "";
  const s = Math.max(0, Math.round((Date.now() - lastMs) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

export function TickerBar() {
  const data = useMarketData();
  const market = useMarketStatus();
  const ago = useAgoTick(data.lastUpdatedMs);
  const items = [
    { key: "nifty", ...data.nifty },
    { key: "sensex", ...data.sensex },
    { key: "vix", ...data.vix },
  ];
  const src = SOURCE_META[data.source] ?? SOURCE_META.init;
  return (
    <div className="flex flex-col">
      <div className="dx-ticker flex-wrap">
        <span
          className="dx-pill"
          style={{ color: market.color, borderColor: market.color }}
          title={market.label}
        >
          <span className="dx-pill-dot" />
          <span className="hidden sm:inline">{market.label}</span>
          <span className="sm:hidden">{market.status === "open" ? "Open" : market.status === "premarket" ? "Pre" : "Closed"}</span>
        </span>
        {items.map((q) => (
          <Item key={q.key} label={LABELS[q.key]} price={q.price} change={q.change} pct={q.pct} />
        ))}
        <span className="ml-auto flex items-center gap-2 text-[10px] font-mono">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: src.color, boxShadow: `0 0 6px ${src.color}` }}
            aria-hidden
          />
          <span style={{ color: src.color }} title={`Source: ${src.label}`}>{src.label}</span>
          {data.lastUpdatedMs && <span className="text-muted-foreground">· updated {ago}</span>}
          {data.failed && (
            <button
              onClick={data.retry}
              className="ml-1 px-1.5 py-0.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              retry
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
