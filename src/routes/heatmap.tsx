import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { getNseHeatmap, type HeatmapIndex, type HeatmapCategory } from "@/lib/heatmap.functions";
import { useMarketStatus } from "@/hooks/useMarketStatus";

export const Route = createFileRoute("/heatmap")({
  head: () => ({
    meta: [
      { title: "Index Heatmap — DEXTER" },
      { name: "description", content: "Live NSE index heatmap: broad market, sectoral, thematic, and strategy indices color-coded by 1-day % change." },
    ],
  }),
  component: HeatmapPage,
});

const CATEGORIES: Array<{ key: HeatmapCategory; label: string; expected: number }> = [
  { key: "broad", label: "Broad Market", expected: 16 },
  { key: "sectoral", label: "Sectoral", expected: 17 },
  { key: "thematic", label: "Thematic", expected: 16 },
  { key: "strategy", label: "Strategy", expected: 14 },
];

function colorFor(pct: number): string {
  if (pct >= 3) return "#00700a";
  if (pct >= 1.5) return "#009e0f";
  if (pct >= 0.5) return "#00c213";
  if (pct > -0.5) return "#2d3748";
  if (pct > -1.5) return "#b91c1c";
  if (pct > -3) return "#991b1b";
  return "#7f1d1d";
}

function isMarketOpen(now = new Date()): boolean {
  // IST = UTC+5:30
  const ist = new Date(now.getTime() + (330 - now.getTimezoneOffset()) * 60000);
  const day = ist.getUTCDay(); // now in IST-shifted, use UTC accessors
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

function formatIST(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

function HeatmapPage() {
  const fetchFn = useServerFn(getNseHeatmap);
  const [category, setCategory] = useState<HeatmapCategory>("broad");
  const [rows, setRows] = useState<HeatmapIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastTs, setLastTs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [hover, setHover] = useState<{ row: HeatmapIndex; x: number; y: number } | null>(null);
  const marketOpen = useMemo(() => isMarketOpen(new Date(nowMs)), [nowMs]);
  const abortRef = useRef<number>(0);

  const load = useCallback(async (cat: HeatmapCategory) => {
    const token = ++abortRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn({ data: { category: cat } });
      if (token !== abortRef.current) return;
      if (!res.ok || res.rows.length === 0) {
        setError(res.error || "NSE feed could not be reached.");
        setRows([]);
      } else {
        setRows(res.rows);
        setLastTs(res.ts);
      }
    } catch (e) {
      if (token !== abortRef.current) return;
      setError(e instanceof Error ? e.message : "Live data unavailable");
      setRows([]);
    } finally {
      if (token === abortRef.current) setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => { load(category); }, [category, load]);

  // Tick clock for "updated X seconds ago" + market status
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh every 30s during market hours
  useEffect(() => {
    if (!marketOpen) return;
    const id = setInterval(() => load(category), 30_000);
    return () => clearInterval(id);
  }, [marketOpen, category, load]);

  const stats = useMemo(() => {
    let a = 0, d = 0, u = 0;
    for (const r of rows) {
      if (r.advances != null || r.declines != null || r.unchanged != null) {
        a += r.advances || 0; d += r.declines || 0; u += r.unchanged || 0;
      } else {
        if (r.percentChange > 0) a++;
        else if (r.percentChange < 0) d++;
        else u++;
      }
    }
    return { a, d, u };
  }, [rows]);

  const ageSec = lastTs ? Math.max(0, Math.floor((nowMs - lastTs) / 1000)) : null;
  const isStale = ageSec != null && ageSec > 60;
  const expected = CATEGORIES.find((c) => c.key === category)?.expected ?? 16;

  return (
    <div className="space-y-4 dx-fade-in">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Index Heatmap</h1>
          <p className="text-sm text-muted-foreground">Live NSE indices — color coded by 1-day % change</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded border ${marketOpen ? "border-green-500/40 text-green-400" : "border-amber-500/40 text-amber-400"}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${marketOpen ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
            {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isStale ? "bg-amber-400" : "bg-green-500 animate-pulse"}`} />
            {ageSec == null ? "—" : `Updated ${ageSec}s ago`}
          </span>
          <button
            onClick={() => load(category)}
            className="p-1.5 rounded border border-border hover:bg-card"
            title="Refresh now"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              category === c.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>-5%</span>
        <div className="h-2 flex-1 max-w-md rounded-full overflow-hidden" style={{
          background: "linear-gradient(to right,#7f1d1d,#991b1b,#b91c1c,#2d3748,#00c213,#009e0f,#00700a)",
        }} />
        <span>+5%</span>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border border-border rounded px-3 py-2 bg-card/30">
        <span>Advances: <span className="text-green-400 font-mono">{stats.a}</span></span>
        <span>Declines: <span className="text-red-400 font-mono">{stats.d}</span></span>
        <span>Unchanged: <span className="text-foreground font-mono">{stats.u}</span></span>
        <span className="ml-auto">As of {lastTs ? formatIST(lastTs) : "—"} IST</span>
      </div>

      {/* Grid */}
      {loading && rows.length === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: expected }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-card/40 animate-pulse border border-border" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="p-8 rounded-lg border border-red-500/40 bg-red-500/5 text-center space-y-2">
          <div className="text-red-300 text-sm">⚠ Live data unavailable</div>
          <div className="text-xs text-muted-foreground">{error} · Retrying automatically.</div>
          <button onClick={() => load(category)} className="mt-2 px-3 py-1.5 text-xs rounded border border-red-500/50 hover:bg-red-500/20 text-red-300">Retry Now</button>
        </div>
      )}

      {!error && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {rows.map((r) => {
            const bg = colorFor(r.percentChange);
            const up = r.percentChange >= 0;
            return (
              <div
                key={r.indexName}
                onMouseEnter={(e) => setHover({ row: r, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ row: r, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                className="p-4 rounded-lg cursor-pointer transition hover:brightness-125"
                style={{ background: bg, border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              >
                <div className="text-[11px] font-semibold tracking-wide truncate" title={r.indexName}>{r.indexName}</div>
                <div className="text-lg font-mono mt-1 tabular-nums">{r.last.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                <div className="text-base font-mono tabular-nums mt-0.5">
                  {up ? "▲" : "▼"} {up ? "+" : ""}{r.percentChange.toFixed(2)}%
                </div>
                <div className="text-[11px] font-mono opacity-80 tabular-nums">
                  {up ? "+" : ""}{r.variation.toFixed(2)} pts
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hover && (
        <div
          className="fixed z-50 p-3 rounded-lg border border-border bg-background/95 backdrop-blur shadow-xl text-xs space-y-1 min-w-[220px] pointer-events-none"
          style={{ left: Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1280) - 240), top: hover.y + 14 }}
        >
          <div className="font-semibold text-sm">{hover.row.indexName}</div>
          <div className="flex justify-between"><span className="text-muted-foreground">LTP</span><span className="font-mono">{hover.row.last.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span className="font-mono" style={{ color: hover.row.percentChange >= 0 ? "#22c55e" : "#ef4444" }}>{hover.row.percentChange >= 0 ? "+" : ""}{hover.row.percentChange.toFixed(2)}% ({hover.row.variation >= 0 ? "+" : ""}{hover.row.variation.toFixed(2)})</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Open</span><span className="font-mono">{hover.row.open.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">High</span><span className="font-mono">{hover.row.high.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Low</span><span className="font-mono">{hover.row.low.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Prev Close</span><span className="font-mono">{hover.row.previousClose.toFixed(2)}</span></div>
          {(hover.row.advances != null || hover.row.declines != null || hover.row.unchanged != null) && (
            <div className="flex justify-between pt-1 border-t border-border/50">
              <span className="text-muted-foreground">A / D / U</span>
              <span className="font-mono">
                <span className="text-green-400">{hover.row.advances ?? 0}</span> / <span className="text-red-400">{hover.row.declines ?? 0}</span> / {hover.row.unchanged ?? 0}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
