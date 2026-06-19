import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { STOCK_UNIVERSE, SECTORS, dexterScore, calcRating, type Stock } from "@/lib/stockUniverse";
import { useWatchlist } from "@/components/WatchlistDrawer";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import { LiveBadge } from "@/components/LiveBadge";
import { X, Download, Star, Filter, ExternalLink, BarChart3, Sparkles } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { toast } from "sonner";

const searchSchema = z.object({ q: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/screener")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Market Screener — DEXTER" },
      { name: "description", content: "Bloomberg-lite Indian stock screener: filter Nifty 500 by sector, market cap, PE, ROE, dividend yield, and more." },
    ],
  }),
  component: ScreenerPage,
});

interface Filters {
  sectors: string[];
  capMin: number; capMax: number;
  peMin: number; peMax: number;
  pbMax: number;
  roeMin: number;
  divMin: number;
  deMax: number;
  growthMin: number;
  position: "all" | "near-high" | "near-low" | "mid";
  ratings: number[];
}

const DEFAULT_FILTERS: Filters = {
  sectors: [],
  capMin: 0, capMax: 2_500_000,
  peMin: 0, peMax: 100,
  pbMax: 30,
  roeMin: -20,
  divMin: 0,
  deMax: 10,
  growthMin: -20,
  position: "all",
  ratings: [],
};

function matches(s: Stock, f: Filters): boolean {
  if (f.sectors.length && !f.sectors.includes(s.sector)) return false;
  if (s.marketCap < f.capMin || s.marketCap > f.capMax) return false;
  if (s.pe < f.peMin || s.pe > f.peMax) return false;
  if (s.pb > f.pbMax) return false;
  if (s.roe < f.roeMin) return false;
  if (s.dividendYield < f.divMin) return false;
  if (s.debtEquity > f.deMax) return false;
  if (s.revenueGrowth < f.growthMin) return false;
  if (f.position === "near-high" && (s.week52High - s.price) / s.week52High > 0.1) return false;
  if (f.position === "near-low" && (s.price - s.week52Low) / s.week52Low > 0.1) return false;
  if (f.position === "mid") {
    const mid = (s.week52High + s.week52Low) / 2;
    if (Math.abs(s.price - mid) / mid > 0.25) return false;
  }
  if (f.ratings.length && !f.ratings.includes(s.rating)) return false;
  return true;
}

function fmtCr(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L Cr`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K Cr`;
  return `₹${n.toFixed(0)} Cr`;
}

function Sparkline({ symbol, color }: { symbol: string; color: string }) {
  const seed = symbol.charCodeAt(0) + symbol.length;
  const vals = Array.from({ length: 7 }, (_, i) => 0.4 + 0.5 * Math.sin(seed * 0.3 + i * 0.9));
  const max = Math.max(...vals);
  return (
    <svg width="50" height="18" viewBox="0 0 50 18" className="inline-block">
      {vals.map((v, i) => {
        const h = (v / max) * 16 + 2;
        return <rect key={i} x={i * 7} y={18 - h} width="5" height={h} fill={color} opacity="0.7" />;
      })}
    </svg>
  );
}

function ScreenerPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [textSearch, setTextSearch] = useState(search.q || "");
  const [sortKey, setSortKey] = useState<keyof Stock>("marketCap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Stock | null>(null);
  const [compare, setCompare] = useState<Stock[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const { add } = useWatchlist();

  // Pre-compute live ratings once per universe so the distribution actually varies.
  const ratedUniverse = useMemo<Stock[]>(
    () => STOCK_UNIVERSE.map((s) => ({ ...s, rating: calcRating(s) })),
    [],
  );

  // Live prices for the entire universe — server fn batches & caches; safe for ~500 symbols.
  const allSymbols = useMemo(() => ratedUniverse.map((s) => `${s.symbol}.NS`), [ratedUniverse]);
  const { quotes, status: liveStatus, fetchedAt } = useLiveQuotes(allSymbols);

  // Merge live prices into the working dataset.
  const liveUniverse = useMemo<Stock[]>(() => {
    return ratedUniverse.map((s) => {
      const q = quotes[`${s.symbol}.NS`];
      if (!q || !q.price) return s;
      return { ...s, price: q.price };
    });
  }, [ratedUniverse, quotes]);

  useEffect(() => {
    if (search.q) {
      setTextSearch(search.q);
      const s = liveUniverse.find((x) => x.symbol === search.q.toUpperCase());
      if (s) setSelected(s);
    }
  }, [search.q, liveUniverse]);

  const filtered = useMemo(() => {
    const Q = textSearch.trim().toUpperCase();
    let rows = liveUniverse.filter((s) => matches(s, filters));
    if (Q) rows = rows.filter((s) => s.symbol.includes(Q) || s.name.toUpperCase().includes(Q));
    rows.sort((a, b) => {
      const av = a[sortKey] as number; const bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [filters, textSearch, sortKey, sortDir, liveUniverse]);

  const PAGE_SIZE = 20;
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const applyPreset = (preset: "quality" | "dividend" | "growth") => {
    if (preset === "quality") setFilters({ ...DEFAULT_FILTERS, roeMin: 20, peMax: 40, deMax: 0.5 });
    if (preset === "dividend") setFilters({ ...DEFAULT_FILTERS, divMin: 2.5, peMax: 25 });
    if (preset === "growth") setFilters({ ...DEFAULT_FILTERS, growthMin: 15, roeMin: 15 });
    setPage(0);
  };

  const toggleSort = (k: keyof Stock) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const exportCsv = () => {
    const headers = ["Symbol", "Name", "Sector", "Price", "MarketCap(Cr)", "PE", "PB", "ROE", "DivYield", "D/E", "RevGrowth", "Rating", "PriceSource", "ExportedAt"];
    const stamp = new Date().toISOString();
    const lines = [headers.join(",")];
    filtered.forEach((s) => {
      const q = quotes[`${s.symbol}.NS`];
      const src = q?.source ?? "seed";
      lines.push([s.symbol, `"${s.name}"`, s.sector, s.price, s.marketCap, s.pe, s.pb, s.roe, s.dividendYield, s.debtEquity, s.revenueGrowth, s.rating, src, stamp].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `screener-${stamp.slice(0, 19)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported live data to CSV");
  };

  const toggleCompare = (s: Stock) => {
    if (compare.find((x) => x.symbol === s.symbol)) {
      setCompare(compare.filter((x) => x.symbol !== s.symbol));
    } else if (compare.length >= 3) {
      toast.error("Max 3 stocks for comparison");
    } else {
      setCompare([...compare, s]);
      toast.success(`Added to comparison (${compare.length + 1}/3)`);
    }
  };

  return (
    <div className="dx-fade-in space-y-4 pb-24">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Market Screener</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
            <span>Showing {filtered.length} of {STOCK_UNIVERSE.length} stocks · NSE/BSE</span>
            <LiveBadge status={liveStatus} fetchedAt={fetchedAt} source="Yahoo Finance / Marketstack" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input value={textSearch} onChange={(e) => { setTextSearch(e.target.value); setPage(0); }} placeholder="Search by name or symbol…" className="bg-card/60 border border-border rounded px-3 py-1.5 text-sm font-mono w-56 outline-none focus:border-primary" />
          <button onClick={() => setShowFilters(!showFilters)} className="dx-pill md:hidden cursor-pointer"><Filter className="h-3 w-3" /> Filters</button>
          <button onClick={exportCsv} className="dx-pill cursor-pointer"><Download className="h-3 w-3" /> CSV</button>
        </div>
      </header>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => applyPreset("quality")} className="dx-pill dx-pill-ok cursor-pointer">🔥 Quality Compounders</button>
        <button onClick={() => applyPreset("dividend")} className="dx-pill cursor-pointer">💰 High Dividend</button>
        <button onClick={() => applyPreset("growth")} className="dx-pill cursor-pointer">🚀 Growth Rockets</button>
        <button onClick={() => { setFilters(DEFAULT_FILTERS); setTextSearch(""); setPage(0); }} className="dx-pill cursor-pointer text-muted-foreground">Reset All</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {showFilters && (
          <aside className="dx-glass p-4 space-y-4 text-xs h-fit">
            <div>
              <div className="font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Sector</div>
              <div className="flex flex-wrap gap-1">
                {SECTORS.map((sec) => {
                  const active = filters.sectors.includes(sec);
                  return (
                    <button key={sec} onClick={() => setFilters((f) => ({ ...f, sectors: active ? f.sectors.filter((x) => x !== sec) : [...f.sectors, sec] }))}
                      className={"px-2 py-0.5 rounded-full border text-[10px] " + (active ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card/40 hover:bg-card")}>
                      {sec}
                    </button>
                  );
                })}
              </div>
            </div>
            <RangeFilter label={`P/E ≤ ${filters.peMax}`} min={5} max={100} value={filters.peMax} onChange={(v) => setFilters((f) => ({ ...f, peMax: v }))} />
            <RangeFilter label={`P/B ≤ ${filters.pbMax.toFixed(1)}`} min={0} max={30} step={0.5} value={filters.pbMax} onChange={(v) => setFilters((f) => ({ ...f, pbMax: v }))} />
            <RangeFilter label={`ROE ≥ ${filters.roeMin}%`} min={-20} max={50} value={filters.roeMin} onChange={(v) => setFilters((f) => ({ ...f, roeMin: v }))} />
            <RangeFilter label={`Div Yield ≥ ${filters.divMin.toFixed(1)}%`} min={0} max={8} step={0.5} value={filters.divMin} onChange={(v) => setFilters((f) => ({ ...f, divMin: v }))} />
            <RangeFilter label={`D/E ≤ ${filters.deMax.toFixed(1)}`} min={0} max={10} step={0.5} value={filters.deMax} onChange={(v) => setFilters((f) => ({ ...f, deMax: v }))} />
            <RangeFilter label={`Rev Growth ≥ ${filters.growthMin}%`} min={-20} max={50} value={filters.growthMin} onChange={(v) => setFilters((f) => ({ ...f, growthMin: v }))} />
            <div>
              <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">52W Position</div>
              <select value={filters.position} onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value as Filters["position"] }))} className="w-full bg-card/60 border border-border rounded px-2 py-1 text-xs">
                <option value="all">All</option>
                <option value="near-high">Near 52W High (≤10%)</option>
                <option value="near-low">Near 52W Low (≤10%)</option>
                <option value="mid">Mid-Range</option>
              </select>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Rating</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => {
                  const active = filters.ratings.includes(r);
                  return (
                    <button key={r} onClick={() => setFilters((f) => ({ ...f, ratings: active ? f.ratings.filter((x) => x !== r) : [...f.ratings, r] }))}
                      className={"flex-1 py-1 rounded border text-[10px] " + (active ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border bg-card/40")}>
                      {r}★
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        <div className="dx-glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-background/40">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left cursor-pointer" onClick={() => toggleSort("name")}>Company</th>
                  <th className="px-2 py-2 text-left">Sector</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort("price")}>Price</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort("marketCap")}>Mkt Cap</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort("pe")}>PE</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort("roe")}>ROE %</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort("dividendYield")}>Div %</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort("revenueGrowth")}>Growth</th>
                  <th className="px-2 py-2 text-center">Rating</th>
                  <th className="px-2 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const tint = s.roe > 20 ? "bg-emerald-500/[0.04]" : s.revenueGrowth < 0 ? "bg-red-500/[0.04]" : "";
                  return (
                    <tr key={s.symbol} className={"border-t border-border hover:bg-primary/[0.06] cursor-pointer " + tint} onClick={() => setSelected(s)}>
                      <td className="px-2 py-2 text-muted-foreground font-mono text-xs">{page * PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{s.symbol} · {s.exchange}</div>
                      </td>
                      <td className="px-2 py-2 text-xs">{s.sector}</td>
                      <td className="px-2 py-2 text-right font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          <span>₹{s.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                          {quotes[`${s.symbol}.NS`] && (
                            <span className={`h-1 w-1 rounded-full ${quotes[`${s.symbol}.NS`].status === "live" ? "bg-emerald-400" : quotes[`${s.symbol}.NS`].status === "delayed" ? "bg-amber-400" : "bg-rose-400"}`} />
                          )}
                        </div>
                        <Sparkline symbol={s.symbol} color={s.revenueGrowth >= 0 ? "#22c55e" : "#ef4444"} />
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{fmtCr(s.marketCap)}</td>
                      <td className="px-2 py-2 text-right font-mono">{s.pe.toFixed(1)}</td>
                      <td className={"px-2 py-2 text-right font-mono " + (s.roe > 20 ? "text-emerald-400" : "")}>{s.roe.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right font-mono">{s.dividendYield.toFixed(1)}</td>
                      <td className={"px-2 py-2 text-right font-mono " + (s.revenueGrowth >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {s.revenueGrowth >= 0 ? "+" : ""}{s.revenueGrowth.toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-center text-amber-400 text-xs">
                        {"★".repeat(s.rating)}<span className="text-muted-foreground/30">{"★".repeat(5 - s.rating)}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); add(s.symbol); toast.success(`${s.symbol} added to watchlist`); }} title="Add to Watchlist" className="text-amber-400 hover:scale-110 transition"><Star className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); toggleCompare(s); }} title="Compare" className={"hover:scale-110 transition " + (compare.find((x) => x.symbol === s.symbol) ? "text-primary" : "text-muted-foreground")}><BarChart3 className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); navigate({ to: "/forecast", search: { symbol: s.symbol } as never }); }} title="Forecast" className="text-cyan-400 hover:scale-110 transition"><Sparkles className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={11} className="px-3 py-12 text-center text-muted-foreground text-sm">
                    No stocks match your criteria. <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-primary underline">Reset filters</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs font-mono">
              <span className="text-muted-foreground">Page {page + 1} / {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-30">Prev</button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-30">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && <StockModal stock={selected} onClose={() => setSelected(null)} onAddWatch={(sym) => add(sym)} onCompare={toggleCompare} inCompare={!!compare.find((x) => x.symbol === selected.symbol)} />}
      {compare.length >= 2 && <CompareTray stocks={compare} onClear={() => setCompare([])} onRemove={(sym) => setCompare(compare.filter((x) => x.symbol !== sym))} />}
    </div>
  );
}

function RangeFilter({ label, min, max, step = 1, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1"><span className="text-muted-foreground uppercase tracking-wider">{label}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    </div>
  );
}

function StockModal({ stock, onClose, onAddWatch, onCompare, inCompare }: { stock: Stock; onClose: () => void; onAddWatch: (s: string) => void; onCompare: (s: Stock) => void; inCompare: boolean }) {
  const [tab, setTab] = useState<"overview" | "financials" | "chart" | "analysis">("overview");
  const score = dexterScore(stock);
  const dayChange = stock.price * (Math.sin(stock.symbol.charCodeAt(0)) * 0.02);
  const dayPct = (dayChange / stock.price) * 100;
  const up = dayChange >= 0;
  const w52pos = ((stock.price - stock.week52Low) / (stock.week52High - stock.week52Low)) * 100;

  // Synthetic series
  const revSeries = Array.from({ length: 5 }, (_, i) => ({ year: `FY${20 + i}`, revenue: stock.eps * (10 + i * 1.5) * 100, profit: stock.eps * (2 + i * 0.4) * 100 }));
  const priceSeries = useMemo(() => {
    const out: { d: number; p: number }[] = [];
    let p = stock.week52Low;
    const drift = (stock.price - stock.week52Low) / 252;
    const seed = stock.symbol.length;
    for (let i = 0; i < 252; i++) {
      p += drift + (Math.sin(i * 0.3 + seed) * stock.price * 0.008);
      out.push({ d: i, p: Math.max(stock.week52Low * 0.95, Math.min(stock.week52High * 1.02, p)) });
    }
    return out;
  }, [stock]);

  const strengths: string[] = [];
  if (stock.roe > 20) strengths.push(`Strong ROE of ${stock.roe.toFixed(1)}%`);
  if (stock.debtEquity < 0.1) strengths.push("Near-zero debt");
  if (stock.dividendYield > 2) strengths.push(`Consistent dividend payer (${stock.dividendYield.toFixed(1)}%)`);
  if (stock.revenueGrowth > 15) strengths.push(`Revenue growing at ${stock.revenueGrowth.toFixed(1)}%`);

  const risks: string[] = [];
  if (stock.pe > 60) risks.push(`High PE of ${stock.pe.toFixed(1)}x — premium valuation`);
  if (stock.revenueGrowth < 0) risks.push(`Negative revenue growth (${stock.revenueGrowth.toFixed(1)}%)`);
  if (stock.debtEquity > 5) risks.push(`High D/E of ${stock.debtEquity.toFixed(1)} — leverage risk`);

  const similar = STOCK_UNIVERSE.filter((s) => s.sector === stock.sector && s.symbol !== stock.symbol).slice(0, 3);

  return (
    <div className="fixed inset-0 z-[180] bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="min-h-screen sm:p-6 flex items-start justify-center">
        <div className="w-full max-w-5xl dx-glass rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="dx-pill">{stock.symbol}</span>
                <span className="dx-pill" style={{ background: "var(--accent)", color: "white", borderColor: "transparent" }}>{stock.sector}</span>
                <span className="dx-pill">{stock.exchange}</span>
              </div>
              <h2 className="text-xl font-semibold">{stock.name}</h2>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-bold font-mono">₹{stock.price.toLocaleString("en-IN")}</span>
                <span className={"text-sm font-mono " + (up ? "text-emerald-400" : "text-red-400")}>
                  {up ? "▲" : "▼"} ₹{Math.abs(dayChange).toFixed(2)} ({up ? "+" : ""}{dayPct.toFixed(2)}%)
                </span>
              </div>
              <div className="mt-3 max-w-md">
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1"><span>52W L ₹{stock.week52Low}</span><span>52W H ₹{stock.week52High}</span></div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div className="absolute h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 opacity-50 w-full" />
                  <div className="absolute h-3 w-1 bg-primary -top-0.5" style={{ left: `${w52pos}%`, boxShadow: "0 0 8px var(--primary)" }} />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {(["overview", "financials", "chart", "analysis"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 text-xs uppercase tracking-wider font-medium border-b-2 " + (tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { k: "Market Cap", v: fmtCr(stock.marketCap) },
                    { k: "P/E", v: stock.pe.toFixed(1) },
                    { k: "P/B", v: stock.pb.toFixed(1) },
                    { k: "EPS", v: `₹${stock.eps.toFixed(1)}` },
                    { k: "ROE", v: `${stock.roe.toFixed(1)}%` },
                    { k: "D/E", v: stock.debtEquity.toFixed(2) },
                    { k: "Div Yield", v: `${stock.dividendYield.toFixed(1)}%` },
                    { k: "Rev Growth", v: `${stock.revenueGrowth.toFixed(1)}%` },
                  ].map((m) => (
                    <div key={m.k} className="dx-glass p-3 rounded-lg">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{m.k}</div>
                      <div className="text-lg font-mono font-semibold mt-1">{m.v}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">About</div>
                  <p className="text-sm text-foreground/80">{stock.name} operates in the {stock.sector} sector and is listed on {stock.exchange}. A {stock.rating}★ rated company based on quality, growth, and stability metrics.</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-amber-400 text-xl">
                    {"★".repeat(stock.rating)}<span className="text-muted-foreground/20">{"★".repeat(5 - stock.rating)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{["Poor", "Below Avg", "Average", "Good", "Excellent"][stock.rating - 1]}</span>
                  </div>
                  <a href={`https://www.screener.in/company/${stock.symbol}/`} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                    View on Screener.in <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            )}
            {tab === "financials" && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Revenue & Profit (₹ Cr)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revSeries}>
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Bar dataKey="revenue" fill="var(--cyan)" />
                      <Bar dataKey="profit" fill="var(--violet-l)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {tab === "chart" && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">1Y Price (synthetic)</div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={priceSeries}>
                    <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                    <Line type="monotone" dataKey="p" stroke="var(--cyan)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {tab === "analysis" && (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="relative h-32 w-32">
                    <svg viewBox="0 0 100 100" className="-rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bull)" strokeWidth="8" strokeDasharray={`${(score / 100) * 264} 264`} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px var(--bull))" }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold font-mono">{score}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Dexter Score</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Strengths</div>
                      <ul className="text-sm space-y-1 mt-1">{strengths.map((s) => <li key={s}>✓ {s}</li>)}{strengths.length === 0 && <li className="text-muted-foreground">No standout strengths.</li>}</ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-red-400 uppercase tracking-wider">Risk Flags</div>
                      <ul className="text-sm space-y-1 mt-1">{risks.map((s) => <li key={s}>⚠ {s}</li>)}{risks.length === 0 && <li className="text-muted-foreground">No major risks detected.</li>}</ul>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Similar Stocks</div>
                  <div className="grid grid-cols-3 gap-2">
                    {similar.map((s) => (
                      <div key={s.symbol} className="dx-glass p-3 rounded text-xs">
                        <div className="font-mono">{s.symbol}</div>
                        <div className="text-muted-foreground truncate">{s.name}</div>
                        <div className="font-mono mt-1">₹{s.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-3 border-t border-border bg-background/40">
            <button onClick={() => onAddWatch(stock.symbol)} className="dx-pill cursor-pointer"><Star className="h-3 w-3" /> Watchlist</button>
            <button onClick={() => onCompare(stock)} className="dx-pill cursor-pointer">{inCompare ? "Remove Compare" : "+ Compare"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareTray({ stocks, onClear, onRemove }: { stocks: Stock[]; onClear: () => void; onRemove: (sym: string) => void }) {
  const radarData = ["pe", "roe", "revenueGrowth", "dividendYield", "rating"].map((key) => {
    const row: Record<string, number | string> = { metric: key.toUpperCase() };
    stocks.forEach((s) => { row[s.symbol] = Math.min(50, Math.abs(s[key as keyof Stock] as number)); });
    return row;
  });
  const colors = ["#00ffcc", "#ff6b9d", "#ffaa00"];
  return (
    <div className="fixed bottom-12 inset-x-0 z-50 px-4">
      <div className="max-w-5xl mx-auto dx-glass rounded-t-xl p-3 border-b-0">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">Comparison ({stocks.length})</h4>
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">Clear All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-muted-foreground text-[10px] uppercase">
                <th className="text-left">Metric</th>
                {stocks.map((s) => <th key={s.symbol} className="text-right">{s.symbol} <button onClick={() => onRemove(s.symbol)} className="text-red-400 ml-1">×</button></th>)}
              </tr></thead>
              <tbody>
                {[["Price", "price"], ["PE", "pe"], ["ROE %", "roe"], ["Div %", "dividendYield"], ["Growth %", "revenueGrowth"]].map(([label, k]) => (
                  <tr key={k} className="border-t border-border">
                    <td className="py-1 text-muted-foreground">{label}</td>
                    {stocks.map((s) => <td key={s.symbol} className="text-right font-mono py-1">{(s[k as keyof Stock] as number).toFixed(1)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              {stocks.map((s, i) => (
                <Radar key={s.symbol} dataKey={s.symbol} stroke={colors[i]} fill={colors[i]} fillOpacity={0.2} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
