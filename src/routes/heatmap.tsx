import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { getNseStockIndex } from "@/lib/yahoo.functions";

export const Route = createFileRoute("/heatmap")({
  head: () => ({
    meta: [
      { title: "Sector Heatmap — DEXTER" },
      { name: "description", content: "Nifty 500 sector heatmap with live 1-day change." },
    ],
  }),
  component: HeatmapPage,
});

interface Row { symbol: string; lastPrice: number; pChange: number; sector: string; name: string }

function colorFor(pct: number): string {
  if (pct <= -3) return "#7f1d1d";
  if (pct <= -1) return "#dc2626";
  if (pct < -0.5) return "#f87171";
  if (pct < 0.5) return "#374151";
  if (pct < 2) return "#86efac";
  return "#16a34a";
}

function HeatmapPage() {
  const fetchIndex = useServerFn(getNseStockIndex);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchIndex({ data: { index: "NIFTY 500" } });
      if (!res.ok || res.data.length === 0) {
        setError("Heatmap unavailable – live data required");
        setRows([]); setLoading(false); return;
      }
      const mapped: Row[] = res.data
        .filter((d) => d.symbol && d.symbol !== "NIFTY 500")
        .map((d) => ({
          symbol: d.symbol,
          lastPrice: Number(d.lastPrice) || 0,
          pChange: Number(d.pChange) || 0,
          sector: d.meta?.industry || "Other",
          name: d.meta?.companyName || d.symbol,
        }));
      setRows(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Heatmap unavailable");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = map.get(r.sector) || [];
      arr.push(r); map.set(r.sector, arr);
    }
    return Array.from(map.entries())
      .map(([sector, items]) => ({ sector, items: items.sort((a, b) => b.lastPrice - a.lastPrice) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [rows]);

  return (
    <div className="space-y-4 dx-fade-in">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nifty 500 Sector Heatmap</h1>
          <p className="text-sm text-muted-foreground">Live 1-day % change · auto-refresh every 60s · NSE</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-3 items-center text-[11px]">
        <span className="text-muted-foreground">Legend:</span>
        {[{ l: "≤-3%", c: "#7f1d1d" }, { l: "-1 to -3%", c: "#dc2626" }, { l: "0", c: "#374151" }, { l: "+0.5 to +2%", c: "#86efac" }, { l: "≥+2%", c: "#16a34a" }].map((x) => (
          <span key={x.l} className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: x.c }} />{x.l}</span>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="aspect-square rounded bg-card/30 animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="p-6 rounded border border-red-500/50 bg-red-500/10 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="px-3 py-1 text-xs rounded border border-red-500/50 hover:bg-red-500/20">Retry</button>
        </div>
      )}

      {!loading && !error && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(({ sector, items }) => (
            <div key={sector}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                <span className="font-medium text-foreground">{sector}</span>
                <span>({items.length})</span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1">
                {items.map((r) => (
                  <div key={r.symbol}
                    onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}
                    className="relative aspect-square rounded p-1 flex flex-col justify-between text-[9px] font-mono cursor-pointer transition hover:ring-2 hover:ring-primary"
                    style={{ background: colorFor(r.pChange), color: Math.abs(r.pChange) > 1 ? "#fff" : "#e5e7eb" }}>
                    <div className="truncate font-semibold">{r.symbol}</div>
                    <div className="text-right tabular-nums">{r.pChange >= 0 ? "+" : ""}{r.pChange.toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hover && (
        <div className="fixed bottom-4 right-4 z-50 p-3 rounded-lg border border-border bg-background/95 backdrop-blur shadow-xl text-xs space-y-0.5 min-w-[200px]">
          <div className="font-semibold text-sm">{hover.name}</div>
          <div className="text-muted-foreground font-mono">{hover.symbol} · {hover.sector}</div>
          <div className="flex justify-between mt-1"><span>LTP</span><span className="font-mono">₹{hover.lastPrice.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>1D Change</span><span className="font-mono" style={{ color: hover.pChange >= 0 ? "#22c55e" : "#ef4444" }}>{hover.pChange >= 0 ? "+" : ""}{hover.pChange.toFixed(2)}%</span></div>
        </div>
      )}
    </div>
  );
}
