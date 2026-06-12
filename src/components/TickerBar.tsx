import { memo, useEffect, useRef } from "react";
import { useLiveTicker, type FeedSource } from "@/hooks/useLiveTicker";

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function SourcePill({ source }: { source: FeedSource }) {
  const map: Record<FeedSource, { label: string; cls: string }> = {
    angel: { label: "Angel One · Live", cls: "dx-pill-ok" },
    finnhub: { label: "Finnhub · Fallback", cls: "" },
    offline: { label: "Offline · Seed", cls: "dx-pill-warn" },
    connecting: { label: "Connecting…", cls: "" },
  };
  const { label, cls } = map[source];
  return (
    <span className={`dx-pill ${cls}`}>
      <span className="dx-pill-dot" />
      {label}
    </span>
  );
}

const Item = memo(function Item({
  symbol,
  ltp,
  change,
  percentChange,
}: {
  symbol: string;
  ltp: number;
  change: number;
  percentChange: number;
}) {
  const prev = useRef(ltp);
  const elRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!elRef.current) return;
    if (ltp > prev.current) {
      elRef.current.classList.remove("dx-flash-down");
      elRef.current.classList.add("dx-flash-up");
    } else if (ltp < prev.current) {
      elRef.current.classList.remove("dx-flash-up");
      elRef.current.classList.add("dx-flash-down");
    }
    prev.current = ltp;
  }, [ltp]);
  const up = change >= 0;
  return (
    <div ref={elRef} className="dx-ticker-item">
      <span className="dx-ticker-sym">{symbol}</span>
      <span className="dx-ticker-ltp">{fmt(ltp)}</span>
      <span className={up ? "dx-bull" : "dx-bear"}>
        {up ? "▲" : "▼"} {fmt(Math.abs(change))} ({up ? "+" : "-"}
        {fmt(Math.abs(percentChange))}%)
      </span>
    </div>
  );
});

export function TickerBar() {
  const { quotes, source } = useLiveTicker();
  return (
    <div className="dx-ticker">
      <SourcePill source={source} />
      {quotes.map((q) => (
        <Item key={`${q.exchange}:${q.symbol}`} {...q} />
      ))}
    </div>
  );
}
