import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Loader2, TrendingUp, TrendingDown, Sparkles, X } from "lucide-react";
import { INDICES, INDEX_GROUP_LABEL, type IndexDef, type IndexGroup } from "@/lib/indices";
import { fetchYahooChart } from "@/lib/yahoo.functions";

export const Route = createFileRoute("/indices")({
  head: () => ({
    meta: [
      { title: "Live NSE & BSE Indices — Dexter" },
      { name: "description", content: "Live Indian market indices: NIFTY 50, Bank Nifty, sectoral and strategy indices, with one-click forecasting." },
    ],
  }),
  component: IndicesPage,
});

interface Snapshot {
  key: string;
  name: string;
  exchange: string;
  group: IndexGroup;
  price: number;
  change: number;
  pct: number;
  sparkline: { t: number; c: number }[];
  ok: boolean;
  err?: string;
}

async function loadSnapshot(idx: IndexDef): Promise<Snapshot> {
  try {
    const r = await fetchYahooChart({ data: { symbol: idx.yahooSymbol, range: "5d", interval: "30m" } });
    if (!r.ok || !r.bars.length) {
      return { key: idx.key, name: idx.name, exchange: idx.exchange, group: idx.group, price: 0, change: 0, pct: 0, sparkline: [], ok: false, err: r.error };
    }
    const last = r.bars[r.bars.length - 1].c;
    const first = r.bars[0].c;
    const change = last - first;
    const pct = (change / first) * 100;
    return {
      key: idx.key, name: idx.name, exchange: idx.exchange, group: idx.group,
      price: last, change, pct,
      sparkline: r.bars.map((b) => ({ t: b.t, c: b.c })),
      ok: true,
    };
  } catch (e) {
    return { key: idx.key, name: idx.name, exchange: idx.exchange, group: idx.group, price: 0, change: 0, pct: 0, sparkline: [], ok: false, err: e instanceof Error ? e.message : "fail" };
  }
}

function IndicesPage() {
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<IndexDef | null>(null);

  const refresh = async () => {
    setLoading(true);
    // Stagger in batches so we don't hammer the proxy
    const batchSize = 6;
    for (let i = 0; i < INDICES.length; i += batchSize) {
      const batch = INDICES.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(loadSnapshot));
      setSnapshots((prev) => {
        const next = { ...prev };
        results.forEach((s) => { next[s.key] = s; });
        return next;
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups: IndexGroup[] = ["broad", "sectoral", "strategy"];

  return (
    <div className="space-y-6 dx-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Indices</h1>
          <p className="text-sm text-muted-foreground">
            Real-time NSE &amp; BSE indices. Click any card for a detail view and one-click forecast.
            {loading && <span className="ml-2 inline-flex items-center gap-1 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> refreshing</span>}
          </p>
        </div>
        <button onClick={refresh} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted">Refresh now</button>
      </header>

      {groups.map((g) => {
        const items = INDICES.filter((i) => i.group === g);
        return (
          <section key={g} className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{INDEX_GROUP_LABEL[g]}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((idx) => {
                const s = snapshots[idx.key];
                return <IndexCard key={idx.key} idx={idx} s={s} onOpen={() => setOpen(idx)} />;
              })}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Price data via Yahoo Finance (with Marketstack fallback). Index symbol coverage on Yahoo
        is best-effort — a few NSE sectoral indices may show "data unavailable" if the upstream
        feed is temporarily missing that series. Forecasts are statistical projections, not advice.
      </p>

      {open && <IndexDetail idx={open} snap={snapshots[open.key]} onClose={() => setOpen(null)} />}
    </div>
  );
}

function IndexCard({ idx, s, onOpen }: { idx: IndexDef; s?: Snapshot; onOpen: () => void }) {
  const up = (s?.pct ?? 0) >= 0;
  const color = up ? "#00ff88" : "#ff4466";
  return (
    <button
      onClick={onOpen}
      className="text-left p-3 rounded-lg border bg-card/40 hover:bg-card/70 transition"
      style={{ borderColor: s?.ok ? `${color}55` : "rgba(255,255,255,0.08)", boxShadow: s?.ok ? `0 0 10px ${color}22` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-mono text-muted-foreground uppercase">{idx.exchange}</div>
          <div className="text-sm font-semibold truncate">{idx.name}</div>
        </div>
        {s?.ok ? (
          up ? <TrendingUp className="h-4 w-4" style={{ color }} /> : <TrendingDown className="h-4 w-4" style={{ color }} />
        ) : <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="mt-1.5">
        {s?.ok ? (
          <>
            <div className="text-xl font-mono">{s.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div className="text-xs font-mono" style={{ color }}>
              {up ? "+" : ""}{s.change.toFixed(2)} ({up ? "+" : ""}{s.pct.toFixed(2)}%)
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">{s?.err ? "data unavailable" : "loading…"}</div>
        )}
      </div>
      {s?.ok && s.sparkline.length > 1 && (
        <div className="h-10 mt-2 -mx-1">
          <ResponsiveContainer>
            <LineChart data={s.sparkline}>
              <Line type="monotone" dataKey="c" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}

function IndexDetail({ idx, snap, onClose }: { idx: IndexDef; snap?: Snapshot; onClose: () => void }) {
  const [range, setRange] = useState<"1mo" | "6mo" | "1y" | "5y">("1y");
  const [bars, setBars] = useState<{ t: number; c: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchYahooChart({ data: { symbol: idx.yahooSymbol, range, interval: range === "1mo" ? "1d" : range === "6mo" ? "1d" : "1wk" } });
        if (!cancelled) setBars(r.bars.map((b) => ({ t: b.t, c: b.c })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idx.yahooSymbol, range]);

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="dx-glass max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase">{idx.exchange} · {INDEX_GROUP_LABEL[idx.group]}</div>
            <h2 className="text-xl font-semibold">{idx.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/forecast"
              search={{ index: idx.key } as never}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary/10"
            >
              <Sparkles className="h-3 w-3" /> Forecast this Index
            </Link>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {snap?.ok && (
            <div className="flex items-baseline gap-4">
              <div className="text-3xl font-mono">{snap.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
              <div className="text-sm font-mono" style={{ color: snap.pct >= 0 ? "#00ff88" : "#ff4466" }}>
                {snap.pct >= 0 ? "+" : ""}{snap.change.toFixed(2)} ({snap.pct >= 0 ? "+" : ""}{snap.pct.toFixed(2)}%)
              </div>
            </div>
          )}
          <div className="flex gap-1">
            {(["1mo", "6mo", "1y", "5y"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} data-active={range === r}
                className="px-2.5 py-1 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">
                {r}
              </button>
            ))}
            {loading && <Loader2 className="h-3 w-3 animate-spin ml-2 self-center" />}
          </div>
          <div className="h-64">
            {bars.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={bars}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)" }} labelFormatter={(t) => new Date(t as number).toLocaleDateString("en-IN")} />
                  <Line dataKey="c" stroke="#00d4ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                {loading ? "Loading…" : "No data available for this range."}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Long-horizon forecasts on the Forecaster page use historical CAGR and Monte
            Carlo simulation — not short-term machine learning. Multi-year projections carry
            substantial uncertainty.
          </p>
        </div>
      </div>
    </div>
  );
}
