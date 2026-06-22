import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search as SearchIcon, ArrowUpDown, Brain } from "lucide-react";
import { ETFS, ETF_CATEGORIES, type ETF } from "@/lib/etfs";
import { fetchYahooChart } from "@/lib/yahoo.functions";

export const Route = createFileRoute("/etfs")({
  head: () => ({
    meta: [
      { title: "ETF Hub — DEXTER" },
      { name: "description", content: "Indian ETF scanner and forecaster — Nifty 50, Gold, Silver, International, Debt." },
    ],
  }),
  component: ETFHub,
});

type Tab = "scanner" | "forecast";
type SortKey = "name" | "price" | "expenseRatio" | "trackingError";

function ETFHub() {
  const [tab, setTab] = useState<Tab>("scanner");
  return (
    <div className="space-y-4 dx-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">ETF Hub</h1>
        <p className="text-sm text-muted-foreground">Indian ETFs across asset classes. Live prices via NSE/Yahoo.</p>
      </header>
      <div className="flex gap-2 border-b border-border">
        {(["scanner", "forecast"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} data-active={tab === t}
            className="px-4 py-2 text-sm border-b-2 border-transparent data-[active=true]:border-primary data-[active=true]:text-primary">
            {t === "scanner" ? "ETF Scanner" : "ETF Forecasting"}
          </button>
        ))}
      </div>
      {tab === "scanner" ? <ETFScanner /> : <ETFForecast />}
    </div>
  );
}

function ETFScanner() {
  const [category, setCategory] = useState<typeof ETF_CATEGORIES[number]>("Nifty 50");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = ETFS.filter((e) => e.category === category && (!q || e.name.toLowerCase().includes(q) || e.ticker.toLowerCase().includes(q)));
    return rows.sort((a, b) => {
      const av = a[sortKey] ?? 0; const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [category, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(-1); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {ETF_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} data-active={category === c}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-card/40 hover:bg-card data-[active=true]:bg-primary data-[active=true]:text-primary-foreground transition">
            {c}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-border bg-background/40">
          <SearchIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter ETFs..."
            className="bg-transparent text-xs outline-none w-40" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border" style={{ background: "#0d1117" }}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <Th label="ETF" onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} />
              <th className="text-left p-3">Ticker</th>
              <Th label="Price (₹)" onClick={() => toggleSort("price")} active={sortKey === "price"} dir={sortDir} right />
              <Th label="Expense %" onClick={() => toggleSort("expenseRatio")} active={sortKey === "expenseRatio"} dir={sortDir} right />
              <th className="text-right p-3">AUM</th>
              <Th label="Tracking Err" onClick={() => toggleSort("trackingError")} active={sortKey === "trackingError"} dir={sortDir} right />
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.ticker} className="border-b border-border/40 hover:bg-card/40">
                <td className="p-3">{e.name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{e.ticker}</td>
                <td className="p-3 text-right tabular-nums">{e.price.toFixed(2)}</td>
                <td className="p-3 text-right tabular-nums">{e.expenseRatio.toFixed(2)}</td>
                <td className="p-3 text-right text-xs">{e.aum}</td>
                <td className="p-3 text-right tabular-nums">{e.trackingError != null ? e.trackingError.toFixed(2) : "—"}</td>
                <td className="p-3 text-right">
                  <Link to="/etfs" search={{ ticker: e.ticker } as never}
                    className="text-xs text-primary hover:underline">Forecast →</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">No ETFs match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Static metadata snapshot (June 2026). Live prices on the forecast tab via Yahoo Finance. For research only — not investment advice.
      </p>
    </div>
  );
}

function Th({ label, onClick, active, dir, right }: { label: string; onClick: () => void; active: boolean; dir: number; right?: boolean }) {
  return (
    <th className={`p-3 ${right ? "text-right" : "text-left"} cursor-pointer select-none`} onClick={onClick}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="w-3 h-3 opacity-50" />{active ? <span className="text-primary">{dir === 1 ? "▲" : "▼"}</span> : null}</span>
    </th>
  );
}

function ETFForecast() {
  const [ticker, setTicker] = useState("NIFTYBEES");
  const [horizon, setHorizon] = useState(30);
  const [loading, setLoading] = useState(false);
  const [bars, setBars] = useState<Array<{ t: number; c: number }>>([]);
  const [meta, setMeta] = useState<{ price?: number; longName?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const fetchChart = useServerFn(fetchYahooChart);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetchChart({ data: { symbol: `${ticker}.NS`, range: "1y", interval: "1d" } })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) { setError(res.error || "No data"); setBars([]); return; }
        setBars(res.bars.map((b) => ({ t: b.t, c: b.c })));
        setMeta({ price: res.price, longName: res.longName });
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [ticker, fetchChart]);

  const forecast = useMemo(() => {
    if (bars.length < 30) return [] as Array<{ t: number; c: number; band: [number, number] }>;
    const closes = bars.map((b) => b.c);
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
    const v = rets.reduce((a, b) => a + (b - mu) ** 2, 0) / rets.length;
    const sd = Math.sqrt(v);
    const last = closes[closes.length - 1];
    const out: Array<{ t: number; c: number; band: [number, number] }> = [];
    const dayMs = 86_400_000;
    const startT = bars[bars.length - 1].t;
    for (let i = 1; i <= horizon; i++) {
      const p = last * Math.exp(mu * i);
      const halfBand = 1.96 * sd * Math.sqrt(i) * last;
      out.push({ t: startT + i * dayMs, c: p, band: [p - halfBand, p + halfBand] });
    }
    return out;
  }, [bars, horizon]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">ETF</label>
          <select value={ticker} onChange={(e) => setTicker(e.target.value)}
            className="bg-card border border-border rounded px-3 py-2 text-sm min-w-[280px]">
            {ETF_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {ETFS.filter((e) => e.category === cat).map((e) => (
                  <option key={e.ticker} value={e.ticker}>{e.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horizon (days)</label>
          <div className="flex gap-1">
            {[7, 15, 30, 60, 90].map((h) => (
              <button key={h} onClick={() => setHorizon(h)} data-active={horizon === h}
                className="px-3 py-2 text-xs rounded border border-border bg-card/40 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">{h}d</button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-sm">
          {meta.price && <span className="font-mono text-primary">₹{meta.price.toFixed(2)}</span>}
          {meta.longName && <div className="text-xs text-muted-foreground">{meta.longName}</div>}
        </div>
      </div>

      {loading && <div className="h-64 animate-pulse rounded border border-border bg-card/30" />}
      {error && !loading && <div className="p-4 rounded border border-red-500/50 text-sm text-red-300 bg-red-500/10">Couldn't fetch ETF data: {error}</div>}

      {!loading && !error && bars.length > 0 && (
        <div className="rounded-lg border border-border p-4" style={{ background: "#0d1117" }}>
          <div className="flex items-center gap-2 mb-3"><Brain className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Geometric Brownian Motion forecast · {horizon} days</span></div>
          <MiniChart bars={bars} forecast={forecast} />
          {forecast.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Spot" value={`₹${bars[bars.length - 1].c.toFixed(2)}`} />
              <Stat label={`Forecast (${horizon}d)`} value={`₹${forecast[forecast.length - 1].c.toFixed(2)}`} />
              <Stat label="95% Low" value={`₹${forecast[forecast.length - 1].band[0].toFixed(2)}`} />
              <Stat label="95% High" value={`₹${forecast[forecast.length - 1].band[1].toFixed(2)}`} />
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Forecasts are produced by deterministic mathematical models on historical price series for reproducibility. They are research outputs, not investment advice. Black-swan events, regime breaks, and behavioural contamination are out of scope. Trade at your own discretion. Not SEBI-registered investment advice.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 p-2 bg-background/30">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function MiniChart({ bars, forecast }: { bars: Array<{ t: number; c: number }>; forecast: Array<{ t: number; c: number; band: [number, number] }> }) {
  const all = [...bars.map((b) => b.c), ...forecast.flatMap((f) => [f.band[0], f.band[1]])];
  const min = Math.min(...all); const max = Math.max(...all); const range = max - min || 1;
  const W = 720; const H = 220;
  const total = bars.length + forecast.length;
  const xOf = (i: number) => (i / Math.max(1, total - 1)) * W;
  const yOf = (v: number) => H - ((v - min) / range) * H;
  const histPath = bars.map((b, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(b.c).toFixed(1)}`).join(" ");
  const fcStart = bars.length - 1;
  const fcPath = [`M${xOf(fcStart).toFixed(1)},${yOf(bars[fcStart].c).toFixed(1)}`, ...forecast.map((f, i) => `L${xOf(fcStart + 1 + i).toFixed(1)},${yOf(f.c).toFixed(1)}`)].join(" ");
  const bandPath = forecast.length
    ? [`M${xOf(fcStart).toFixed(1)},${yOf(bars[fcStart].c).toFixed(1)}`,
       ...forecast.map((f, i) => `L${xOf(fcStart + 1 + i).toFixed(1)},${yOf(f.band[1]).toFixed(1)}`),
       ...forecast.slice().reverse().map((f, i) => `L${xOf(fcStart + forecast.length - i).toFixed(1)},${yOf(f.band[0]).toFixed(1)}`),
       "Z"].join(" ")
    : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
      {bandPath && <path d={bandPath} fill="rgba(0,212,255,0.12)" />}
      <path d={histPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <path d={fcPath} fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  );
}
