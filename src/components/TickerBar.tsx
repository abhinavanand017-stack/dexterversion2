import { memo, useEffect, useRef } from "react";
import { useMarketData } from "@/hooks/useMarketData";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { formatNum } from "@/lib/formatINR";

const LABELS: Record<string, string> = { nifty: "NIFTY 50", sensex: "SENSEX", vix: "INDIA VIX" };

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

export function TickerBar() {
  const data = useMarketData();
  const market = useMarketStatus();
  const items = [
    { key: "nifty", ...data.nifty },
    { key: "sensex", ...data.sensex },
    { key: "vix", ...data.vix },
  ];
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
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {data.isLive && data.lastUpdated
            ? `Updated ${data.lastUpdated} IST`
            : market.status === "closed"
              ? "Showing last session values"
              : "Connecting…"}
        </span>
      </div>
    </div>
  );
}
