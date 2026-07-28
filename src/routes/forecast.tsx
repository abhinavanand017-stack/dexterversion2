import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Loader2, TrendingUp, TrendingDown, X, Star, StarOff, GitCompare, Sparkles, RefreshCw, ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
  LineChart,
} from "recharts";
import { fetchYahooChart, fetchYahooFundamentals, type YahooFundamentals } from "@/lib/yahoo.functions";
import { generateDexterInsight } from "@/lib/forecast/insight.functions";
import { generateFundamentalSummary } from "@/lib/forecast/insight.functions";
import { runShortTermForecast, barsToOHLCV, HORIZON_DAYS, FACTOR_REGISTRY, ALL_FACTOR_KEYS, type Horizon, type EngineResult } from "@/lib/forecast/engine12";
import { NIFTY500 } from "@/lib/nifty500";
import { INDICES_UNIVERSE } from "@/lib/forecast/indices";
import { ETFS_UNIVERSE } from "@/lib/forecast/etfs";
import { FUNDS_UNIVERSE } from "@/lib/forecast/funds";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "Forecast — Live 12-Factor Analysis · Dexter" },
      { name: "description", content: "Live NSE/BSE forecasts using a 12-factor technical engine, real-time Yahoo data, and Dexter AI commentary." },
      { property: "og:title", content: "Dexter Forecast — Live 12-Factor Analysis" },
      { property: "og:description", content: "Live prices, 12 weighted technical factors, price targets and Dexter AI insight for Indian stocks, indices and ETFs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForecastPage,
});

// ── design tokens ──
const BG = "#0a0a1a";
const CARD = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.08)";
const BLUE = "#378ADD";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";
const HORIZONS: Horizon[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "3Y", "5Y"];

// ── universe ──
type AssetKind = "stock" | "index" | "etf" | "fund";
interface Asset { key: string; symbol: string; name: string; kind: AssetKind; meta?: string; yahoo?: string; fundReturns?: { r1?: number | null; r3?: number | null; r5?: number | null; r10?: number | null; nav?: number | null } }

const UNIVERSE: Asset[] = [
  ...NIFTY500.map((s): Asset => ({ key: `stock:${s.symbol}`, symbol: `${s.symbol}.NS`, name: s.name, kind: "stock", meta: s.sector, yahoo: `${s.symbol}.NS` })),
  ...INDICES_UNIVERSE.map((i): Asset => ({ key: `index:${i.symbol}`, symbol: i.symbol, name: i.name, kind: "index", meta: i.cat, yahoo: i.symbol })),
  ...ETFS_UNIVERSE.map((e): Asset => ({ key: `etf:${e.name}`, symbol: e.name, name: e.name, kind: "etf", meta: e.cat, fundReturns: { r1: e.r1, r3: e.r3, r5: e.r5, nav: e.nav } })),
  ...FUNDS_UNIVERSE.map((f): Asset => ({ key: `fund:${f.name}`, symbol: f.name, name: f.name, kind: "fund", meta: f.cat, fundReturns: { r1: f.r1, r3: f.r3, r5: f.r5, r10: f.r10, nav: null } })),
];

const POPULAR = ["stock:RELIANCE", "stock:TCS", "stock:HDFCBANK", "stock:INFY", "stock:BHARTIARTL", "stock:SBIN", "stock:BAJFINANCE", "index:^NSEI"];
const LS_WATCH = "dx_fc_watch_v3";
const LS_HIST = (sym: string) => `dexter_hist_${sym}`;
const HIST_TTL_MS = 4 * 60 * 60 * 1000;

// ── helpers ──
function fmtINR(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(digits)}%`;
}
function fmtVol(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + " L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}
function signalColor(sig: string): string {
  if (sig.includes("STRONG BUY")) return GREEN;
  if (sig === "BUY") return GREEN;
  if (sig === "SELL") return RED;
  if (sig.includes("STRONG SELL")) return RED;
  return AMBER;
}

// ── Yahoo cache with sessionStorage ──
interface CachedHist { ts: number; bars: { t: number; o: number; h: number; l: number; c: number; v: number }[]; meta: YahooMeta }
interface YahooMeta { price?: number; prevClose?: number; dayHigh?: number; dayLow?: number; dayOpen?: number; volume?: number; w52High?: number; w52Low?: number; longName?: string; currency?: string }

async function loadYahoo(symbol: string, force = false): Promise<{ bars: CachedHist["bars"]; meta: YahooMeta; cached: boolean } | null> {
  const key = LS_HIST(symbol);
  if (!force && typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const c = JSON.parse(raw) as CachedHist;
        if (Date.now() - c.ts < HIST_TTL_MS) return { bars: c.bars, meta: c.meta, cached: true };
      }
    } catch { /* ignore */ }
  }
  const r = await fetchYahooChart({ data: { symbol, range: "1y", interval: "1d" } });
  if (!r.ok || !r.bars.length) return null;
  const meta: YahooMeta = { price: r.price, prevClose: r.prevClose, dayHigh: r.dayHigh, dayLow: r.dayLow, dayOpen: r.dayOpen, volume: r.volume, w52High: r.w52High, w52Low: r.w52Low, longName: r.longName, currency: r.currency };
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), bars: r.bars, meta } satisfies CachedHist)); } catch { /* ignore */ }
  return { bars: r.bars, meta, cached: false };
}

// ── Search combobox ──
function SearchAssets({ selected, onSelect, placeholder = "Search stocks, indices, ETFs, mutual funds..." }: { selected: Asset | null; onSelect: (a: Asset | null) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [] as Asset[];
    const hits: Asset[] = [];
    for (const a of UNIVERSE) {
      if (hits.length >= 40) break;
      if (a.symbol.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)) hits.push(a);
    }
    return hits;
  }, [q]);

  const showPopular = !q.trim();
  const popularAssets = useMemo(() => POPULAR.map((k) => UNIVERSE.find((a) => a.key === k)!).filter(Boolean), []);

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: MUTED }}>{selected.kind}</div>
          <div className="font-mono text-sm font-semibold" style={{ color: TEXT }}>{selected.symbol}</div>
          <div className="text-sm truncate flex-1" style={{ color: MUTED }}>{selected.name}</div>
          <button onClick={() => { onSelect(null); setQ(""); }} className="rounded-md p-1 hover:bg-white/5" aria-label="Clear">
            <X size={14} color={MUTED} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={MUTED} />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setCursor(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              const list = showPopular ? popularAssets : results;
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(list.length - 1, c + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
              else if (e.key === "Enter" && list[cursor]) { onSelect(list[cursor]); setQ(""); setOpen(false); }
              else if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            className="w-full rounded-xl pl-10 pr-3 py-3 text-sm outline-none"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT, height: 48 }}
          />
        </div>
      )}
      {open && !selected && (
        <div className="absolute z-40 mt-2 w-full max-h-96 overflow-auto rounded-xl shadow-xl" style={{ background: "#0f0f22", border: `1px solid ${BORDER}` }}>
          {showPopular ? (
            <>
              <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Popular</div>
              {popularAssets.map((a, i) => <ResultRow key={a.key} asset={a} active={i === cursor} onClick={() => { onSelect(a); setQ(""); setOpen(false); }} />)}
            </>
          ) : results.length ? (
            <>
              <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{results.length} matches</div>
              {results.map((a, i) => <ResultRow key={a.key} asset={a} active={i === cursor} onClick={() => { onSelect(a); setQ(""); setOpen(false); }} />)}
            </>
          ) : (
            <div className="p-4 text-sm" style={{ color: MUTED }}>No matches.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ asset, active, onClick }: { asset: Asset; active: boolean; onClick: () => void }) {
  const dot = asset.kind === "stock" ? BLUE : asset.kind === "index" ? AMBER : asset.kind === "etf" ? GREEN : "#a78bfa";
  return (
    <button onClick={onClick} className="w-full text-left px-3 py-2 flex items-center gap-3 transition-colors" style={{ background: active ? "rgba(55,138,221,0.1)" : "transparent" }}>
      <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
      <span className="font-mono text-xs font-semibold w-28 truncate" style={{ color: TEXT }}>{asset.symbol}</span>
      <span className="text-sm flex-1 truncate" style={{ color: TEXT }}>{asset.name}</span>
      <span className="text-[10px] uppercase" style={{ color: MUTED }}>{asset.meta ?? asset.kind}</span>
    </button>
  );
}

// ── Live quote strip ──
function QuoteStrip({ meta, asset, cached, onRefresh, isRefreshing }: { meta: YahooMeta | null; asset: Asset; cached: boolean; onRefresh: () => void; isRefreshing: boolean }) {
  if (!meta || meta.price == null) return null;
  const change = meta.price - (meta.prevClose ?? meta.price);
  const changePct = meta.prevClose ? (change / meta.prevClose) * 100 : 0;
  const positive = change >= 0;
  const color = positive ? GREEN : RED;
  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold" style={{ color: TEXT }}>{asset.symbol}</span>
            <span className="text-sm" style={{ color: MUTED }}>{meta.longName ?? asset.name}</span>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl font-semibold font-mono" style={{ color }}>{fmtINR(meta.price)}</span>
            <span className="text-sm font-mono" style={{ color }}>{positive ? "▲" : "▼"} {change.toFixed(2)} ({fmtPct(changePct)})</span>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider" style={{ color: cached ? AMBER : GREEN }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cached ? AMBER : GREEN }} />
              {cached ? "Cached" : "Live"}
            </span>
          </div>
        </div>
        <button onClick={onRefresh} disabled={isRefreshing} className="rounded-lg p-2 hover:bg-white/5" aria-label="Refresh">
          {isRefreshing ? <Loader2 size={16} className="animate-spin" color={MUTED} /> : <RefreshCw size={16} color={MUTED} />}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-2 mt-4 text-xs">
        <Stat label="Open" value={fmtINR(meta.dayOpen)} />
        <Stat label="High" value={fmtINR(meta.dayHigh)} />
        <Stat label="Low" value={fmtINR(meta.dayLow)} />
        <Stat label="Volume" value={fmtVol(meta.volume)} />
        <Stat label="52W High" value={fmtINR(meta.w52High)} />
        <Stat label="52W Low" value={fmtINR(meta.w52Low)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{label}</div>
      <div className="font-mono text-sm" style={{ color: TEXT }}>{value}</div>
    </div>
  );
}

// ── Chart tooltip ──
type TooltipPayloadEntry = { dataKey?: string; value?: number | string | null };
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string | number }) {
  if (!active || !payload || !payload.length) return null;
  const p: Record<string, number | undefined> = {};
  for (const row of payload) if (row.dataKey && typeof row.value === "number") p[String(row.dataKey)] = row.value;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(10,10,26,0.95)", border: `1px solid ${BORDER}`, color: TEXT }}>
      <div className="font-mono mb-1" style={{ color: MUTED }}>{label}</div>
      {p.historical != null && <div>Price: <span className="font-mono">{fmtINR(p.historical)}</span></div>}
      {p.forecast != null && <div style={{ color: GREEN }}>Forecast: <span className="font-mono">{fmtINR(p.forecast)}</span></div>}
      {p.upper != null && <div style={{ color: MUTED }}>Upper: <span className="font-mono">{fmtINR(p.upper)}</span></div>}
      {p.lower != null && <div style={{ color: MUTED }}>Lower: <span className="font-mono">{fmtINR(p.lower)}</span></div>}
      {p.volume != null && p.volume > 0 && <div style={{ color: MUTED }}>Volume: <span className="font-mono">{fmtVol(p.volume)}</span></div>}
    </div>
  );
}

// ── Main chart ──
function ForecastChart({ result, currentPrice }: { result: EngineResult; currentPrice: number }) {
  const data = useMemo(() => {
    const hist = result.history90.map((h) => ({
      date: h.date, historical: +h.close.toFixed(2), forecast: null as number | null, upper: null as number | null, lower: null as number | null, volume: h.volume,
    }));
    // seam
    const last = hist[hist.length - 1];
    const fc = result.forecastPath.map((f, i) => ({
      date: f.date,
      historical: i === 0 ? last?.historical ?? null : null,
      forecast: f.price, upper: f.upper, lower: f.lower, volume: 0,
    }));
    return [...hist, ...fc];
  }, [result]);

  const todayDate = result.history90.at(-1)?.date ?? "";
  const yDomain: [number, number] = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const d of data) {
      for (const v of [d.historical, d.forecast, d.upper, d.lower]) {
        if (typeof v === "number") { if (v < lo) lo = v; if (v > hi) hi = v; }
      }
    }
    const pad = (hi - lo) * 0.05;
    return [lo - pad, hi + pad];
  }, [data]);

  return (
    <div style={{ width: "100%", height: 420 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 60, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal vertical={false} />
          <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 11 }} interval={Math.floor(data.length / 12)} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis yAxisId="price" domain={yDomain} tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={(v: number) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} axisLine={false} tickLine={false} width={70} />
          <YAxis yAxisId="vol" orientation="right" hide domain={[0, "dataMax"]} />
          <Tooltip content={<ChartTooltip />} />
          <Bar yAxisId="vol" dataKey="volume" fill="rgba(255,255,255,0.06)" />
          <Area yAxisId="price" dataKey="upper" stroke="none" fill="rgba(55,138,221,0.14)" isAnimationActive={false} />
          <Area yAxisId="price" dataKey="lower" stroke="none" fill={BG} isAnimationActive={false} />
          <Line yAxisId="price" dataKey="historical" stroke="#94a3b8" strokeWidth={2} dot={false} isAnimationActive animationDuration={1200} connectNulls={false} />
          <Line yAxisId="price" dataKey="forecast" stroke={GREEN} strokeWidth={2.5} strokeDasharray="6 3" dot={false} isAnimationActive animationDuration={1200} connectNulls={false} />
          <ReferenceLine yAxisId="price" x={todayDate} stroke="rgba(255,255,255,0.3)" label={{ value: "Today", fill: MUTED, fontSize: 11, position: "top" }} />
          <ReferenceLine yAxisId="price" y={result.targetPrice} stroke={GREEN} strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: `Target ${fmtINR(result.targetPrice)}`, position: "right", fill: GREEN, fontSize: 11 }} />
          <ReferenceLine yAxisId="price" y={result.supportLevels.s1} stroke={AMBER} strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: `S1 ${fmtINR(result.supportLevels.s1, 0)}`, position: "right", fill: AMBER, fontSize: 10 }} />
          <ReferenceLine yAxisId="price" y={result.resistanceLevels.r1} stroke={RED} strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: `R1 ${fmtINR(result.resistanceLevels.r1, 0)}`, position: "right", fill: RED, fontSize: 10 }} />
          <ReferenceLine yAxisId="price" y={currentPrice} stroke="rgba(255,255,255,0.2)" strokeDasharray="1 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Mini indicator charts ──
function MiniCharts({ result }: { result: EngineResult }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <MiniPanel title="RSI (14)" value={result.rsi.toFixed(1)}>
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={result.rsi90} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} hide />
            <ReferenceLine y={70} stroke={RED} strokeDasharray="2 2" strokeOpacity={0.4} />
            <ReferenceLine y={30} stroke={GREEN} strokeDasharray="2 2" strokeOpacity={0.4} />
            <Line dataKey="rsi" stroke={BLUE} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </MiniPanel>
      <MiniPanel title="MACD Histogram" value={result.macd.hist.toFixed(2)}>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={result.macd90} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
            <Bar dataKey="hist">
              {result.macd90.map((d, i) => <ReferenceLine key={i} y={d.hist} />)}
            </Bar>
            <Line dataKey="hist" stroke="none" />
          </ComposedChart>
        </ResponsiveContainer>
      </MiniPanel>
      <MiniPanel title="Volume (90d)" value={fmtVol(result.history90.at(-1)?.volume)}>
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={result.history90} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Bar dataKey="volume" fill={BLUE} />
          </ComposedChart>
        </ResponsiveContainer>
      </MiniPanel>
    </div>
  );
}

function MiniPanel({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{title}</span>
        <span className="font-mono text-xs" style={{ color: TEXT }}>{value}</span>
      </div>
      {children}
    </div>
  );
}

// ── Signal dashboard ──
function SignalDashboard({ result }: { result: EngineResult }) {
  const color = signalColor(result.signal);
  const agree = Math.max(result.buyCount, result.sellCount);
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5 text-center" style={{ background: CARD, border: `2px solid ${color}` }}>
        <div className="text-2xl font-bold tracking-wide" style={{ color }}>{result.signal}</div>
        <div className="mt-2 text-xs" style={{ color: MUTED }}>
          Composite <span className="font-mono" style={{ color: TEXT }}>{result.compositeScore >= 0 ? "+" : ""}{result.compositeScore.toFixed(3)}</span>
          <span className="mx-2">·</span>
          Confidence <span className="font-mono" style={{ color: TEXT }}>{result.confidence.toFixed(1)}%</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono" style={{ color: MUTED }}>
          <span style={{ color: GREEN }}>{result.buyCount} Buy</span>
          <span>·</span>
          <span style={{ color: RED }}>{result.sellCount} Sell</span>
          <span>·</span>
          <span style={{ color: AMBER }}>{result.holdCount} Hold</span>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full" style={{ width: `${(agree / 12) * 100}%`, background: color }} />
        </div>
        <div className="mt-1 text-[10px]" style={{ color: MUTED }}>{agree}/12 factors agree</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <TargetCard emoji="🐻" label="Bear" value={result.bearTarget} basis={result.forecastPath[0]?.price ?? 1} tint={RED} />
        <TargetCard emoji="📊" label="Base" value={result.targetPrice} basis={result.forecastPath[0]?.price ?? 1} tint={BLUE} />
        <TargetCard emoji="🐂" label="Bull" value={result.bullTarget} basis={result.forecastPath[0]?.price ?? 1} tint={GREEN} />
      </div>

      <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: MUTED }}>Support & Resistance</div>
        <SRRow label="R2" value={result.resistanceLevels.r2} color={RED} />
        <SRRow label="R1" value={result.resistanceLevels.r1} color={RED} />
        <SRRow label="Pivot" value={result.supportLevels.pivot} color={MUTED} />
        <SRRow label="S1" value={result.supportLevels.s1} color={GREEN} />
        <SRRow label="S2" value={result.supportLevels.s2} color={GREEN} />
      </div>
    </div>
  );
}

function TargetCard({ emoji, label, value, basis, tint }: { emoji: string; label: string; value: number; basis: number; tint: string }) {
  const pct = ((value - basis) / basis) * 100;
  return (
    <div className="rounded-xl p-2.5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-lg">{emoji}</div>
      <div className="text-[10px] uppercase" style={{ color: MUTED }}>{label}</div>
      <div className="font-mono text-sm" style={{ color: TEXT }}>{fmtINR(value, 0)}</div>
      <div className="font-mono text-[11px]" style={{ color: tint }}>{fmtPct(pct)}</div>
    </div>
  );
}
function SRRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="font-mono" style={{ color }}>{label}</span>
      <span className="font-mono" style={{ color: TEXT }}>{fmtINR(value, 0)}</span>
    </div>
  );
}

// ── Factor table ──
function FactorTable({ result }: { result: EngineResult }) {
  const rows = [...result.factors].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>12 Factors · sorted by weight</div>
      <div className="divide-y" style={{ borderColor: BORDER }}>
        {rows.map((f) => {
          const color = f.score > 0.15 ? GREEN : f.score < -0.15 ? RED : AMBER;
          const barPct = Math.min(100, Math.abs(f.score) * 100);
          return (
            <div key={f.key} className="px-3 py-2 grid grid-cols-[8px_1fr_60px_80px] gap-3 items-center" style={{ borderLeft: `3px solid ${color}` }}>
              <span />
              <div>
                <div className="text-xs font-medium" style={{ color: TEXT }}>{f.label}</div>
                <div className="text-[11px]" style={{ color: MUTED }}>{f.detail}</div>
              </div>
              <div className="font-mono text-xs text-right" style={{ color }}>{f.score >= 0 ? "+" : ""}{f.score.toFixed(2)}</div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full" style={{ width: `${barPct}%`, background: color, marginLeft: f.score < 0 ? `${100 - barPct}%` : 0 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fund-specific projection ──
interface FundProjection { years: number[]; values: number[]; cagr: number; source: string }
function projectFund(a: Asset, years = [1, 3, 5, 10]): FundProjection | null {
  const fr = a.fundReturns;
  if (!fr) return null;
  const nav = fr.nav ?? 100;
  // Pick a best-available CAGR (converting cumulative returns to annualised)
  let cagr: number | null = null; let src = "";
  if (fr.r5 != null) { cagr = Math.pow(1 + fr.r5 / 100, 1 / 5) - 1; src = "5Y CAGR"; }
  else if (fr.r3 != null) { cagr = Math.pow(1 + fr.r3 / 100, 1 / 3) - 1; src = "3Y CAGR"; }
  else if (fr.r1 != null) { cagr = fr.r1 / 100; src = "1Y return"; }
  if (cagr == null) return null;
  const values = years.map((y) => nav * Math.pow(1 + cagr!, y));
  return { years, values, cagr: cagr * 100, source: src };
}

// ── Page ──
function ForecastPage() {
  const [selected, setSelected] = useState<Asset | null>(() => UNIVERSE.find((a) => a.key === "stock:RELIANCE") ?? null);
  const [compareOn, setCompareOn] = useState(false);
  const [selected2, setSelected2] = useState<Asset | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("1M");
  const [watch, setWatch] = useState<string[]>(() => {
    try { const r = typeof localStorage !== "undefined" ? localStorage.getItem(LS_WATCH) : null; return r ? JSON.parse(r) as string[] : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(LS_WATCH, JSON.stringify(watch)); } catch { /* ignore */ } }, [watch]);

  const primary = useSlot(selected, horizon);
  const secondary = useSlot(compareOn ? selected2 : null, horizon);

  const isWatched = selected ? watch.includes(selected.key) : false;
  function toggleWatch() {
    if (!selected) return;
    setWatch((w) => w.includes(selected.key) ? w.filter((k) => k !== selected.key) : [...w, selected.key]);
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: BG, color: TEXT }}>
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Forecast Workbench</h1>
            <p className="text-sm" style={{ color: MUTED }}>Live NSE/BSE data · 12-factor engine · Dexter AI commentary</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCompareOn((v) => !v); if (compareOn) setSelected2(null); }}
              className="rounded-lg px-3 py-2 text-xs font-medium inline-flex items-center gap-2"
              style={{ background: compareOn ? BLUE : CARD, border: `1px solid ${BORDER}`, color: TEXT }}
            >
              <GitCompare size={14} /> {compareOn ? "Comparing" : "Compare"}
            </button>
            <button
              onClick={toggleWatch}
              disabled={!selected}
              className="rounded-lg px-3 py-2 text-xs font-medium inline-flex items-center gap-2 disabled:opacity-40"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}
            >
              {isWatched ? <StarOff size={14} /> : <Star size={14} />} Watchlist
            </button>
          </div>
        </div>

        {/* Search + horizon */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="space-y-2">
            <SearchAssets selected={selected} onSelect={setSelected} />
            {compareOn && <SearchAssets selected={selected2} onSelect={setSelected2} placeholder="Compare against…" />}
          </div>
          <div className="flex items-center gap-1 flex-wrap rounded-xl p-1" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {HORIZONS.map((h) => (
              <button key={h} onClick={() => setHorizon(h)} className="rounded-lg px-3 py-2 text-xs font-mono"
                style={{ background: horizon === h ? BLUE : "transparent", color: horizon === h ? "#fff" : TEXT }}>
                {h}
              </button>
            ))}
          </div>
        </div>

        {watch.length > 0 && (
          <div className="rounded-xl p-3 flex items-center gap-2 flex-wrap" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <span className="text-[10px] uppercase tracking-wider mr-2" style={{ color: MUTED }}>Watchlist</span>
            {watch.map((k) => {
              const a = UNIVERSE.find((x) => x.key === k);
              if (!a) return null;
              return (
                <button key={k} onClick={() => setSelected(a)} className="rounded-md px-2 py-1 text-xs font-mono hover:bg-white/5" style={{ border: `1px solid ${BORDER}` }}>
                  {a.symbol}
                </button>
              );
            })}
          </div>
        )}

        {/* Main slots */}
        <SlotView slot={primary} horizon={horizon} title={selected?.symbol ?? ""} />
        {compareOn && <SlotView slot={secondary} horizon={horizon} title={selected2?.symbol ?? ""} secondary />}

        {compareOn && primary.result && secondary.result && (
          <ComparisonBanner a={selected!} ar={primary.result} b={selected2!} br={secondary.result} horizon={horizon} />
        )}

        <p className="text-xs mt-8 leading-relaxed" style={{ color: MUTED }}>
          Forecasts are generated using statistical models applied to historical data. They are for educational and research purposes only and do not constitute investment advice. Past performance does not guarantee future results. Please consult a SEBI-registered investment advisor before making any investment decisions.
        </p>
      </div>
    </div>
  );
}

// ── slot state hook ──
interface SlotState {
  asset: Asset | null;
  bars: CachedHist["bars"] | null;
  meta: YahooMeta | null;
  cached: boolean;
  result: EngineResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  isRefreshing: boolean;
  // model selection (session-local component state)
  draftKeys: string[];
  appliedKeys: string[];
  toggleModel: (k: string) => void;
  selectAllModels: () => void;
  clearModels: () => void;
  applyModels: () => void;
  modelsDirty: boolean;
}

function useSlot(asset: Asset | null, horizon: Horizon): SlotState {
  const enabled = !!asset && asset.kind !== "fund" && !!asset.yahoo;
  const query = useQuery({
    queryKey: ["yhist", asset?.yahoo],
    queryFn: async () => {
      if (!asset?.yahoo) return null;
      const r = await loadYahoo(asset.yahoo);
      if (!r) throw new Error("Yahoo fetch failed");
      return r;
    },
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    staleTime: 25_000,
  });

  const refetchMut = useMutation({
    mutationFn: async () => {
      if (!asset?.yahoo) return null;
      const r = await loadYahoo(asset.yahoo, true);
      if (!r) throw new Error("refresh failed");
      return r;
    },
    onSuccess: () => query.refetch(),
  });

  const [draftKeys, setDraftKeys] = useState<string[]>(() => [...ALL_FACTOR_KEYS]);
  const [appliedKeys, setAppliedKeys] = useState<string[]>(() => [...ALL_FACTOR_KEYS]);

  const result = useMemo(() => {
    if (!query.data?.bars || query.data.bars.length < 40) return null;
    return runShortTermForecast(barsToOHLCV(query.data.bars), horizon, appliedKeys);
  }, [query.data, horizon, appliedKeys]);

  const modelsDirty =
    draftKeys.length !== appliedKeys.length || draftKeys.some((k) => !appliedKeys.includes(k));

  return {
    asset,
    bars: query.data?.bars ?? null,
    meta: query.data?.meta ?? null,
    cached: query.data?.cached ?? false,
    result,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => refetchMut.mutate(),
    isRefreshing: refetchMut.isPending,
    draftKeys,
    appliedKeys,
    toggleModel: (k) => setDraftKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])),
    selectAllModels: () => setDraftKeys([...ALL_FACTOR_KEYS]),
    clearModels: () => setDraftKeys([]),
    applyModels: () => setAppliedKeys(draftKeys.length ? [...draftKeys] : [...ALL_FACTOR_KEYS]),
    modelsDirty,
  };
}

// ── Models used in this forecast ──
function ModelsPanel({ slot, result }: { slot: SlotState; result: EngineResult }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const byKey = useMemo(() => Object.fromEntries(result.factors.map((f) => [f.key, f])), [result]);
  const noneSelected = slot.draftKeys.length === 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-2"
        style={{ borderBottom: open ? `1px solid ${BORDER}` : "none" }}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={13} color={BLUE} />
          <span className="text-xs uppercase tracking-wider" style={{ color: TEXT }}>Models Used in This Forecast</span>
          <span className="text-[10px] font-mono" style={{ color: MUTED }}>
            {slot.appliedKeys.length}/{FACTOR_REGISTRY.length} active
          </span>
        </span>
        {open ? <ChevronDown size={14} color={MUTED} /> : <ChevronRight size={14} color={MUTED} />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Select models */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider mr-1" style={{ color: MUTED }}>Select models</span>
            <button onClick={slot.selectAllModels} className="rounded-md px-2 py-1 text-[11px] hover:bg-white/5" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>All</button>
            <button onClick={slot.clearModels} className="rounded-md px-2 py-1 text-[11px] hover:bg-white/5" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>None</button>
          </div>

          <div className="flex flex-wrap gap-2">
            {FACTOR_REGISTRY.map((m) => {
              const on = slot.draftKeys.includes(m.key);
              const f = byKey[m.key];
              const tint = !on ? MUTED : f && f.score > 0.15 ? GREEN : f && f.score < -0.15 ? RED : AMBER;
              return (
                <button
                  key={m.key}
                  onClick={() => slot.toggleModel(m.key)}
                  title={m.description}
                  className="rounded-full px-2.5 py-1 text-[11px] inline-flex items-center gap-1.5 transition-colors"
                  style={{
                    border: `1px solid ${on ? tint : BORDER}`,
                    background: on ? `${tint}1a` : "transparent",
                    color: on ? TEXT : MUTED,
                    opacity: on ? 1 : 0.6,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? tint : "rgba(255,255,255,0.2)" }} />
                  {m.label}
                  <span className="font-mono" style={{ color: MUTED }}>{(m.weight * 100).toFixed(0)}%</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={slot.applyModels}
              disabled={!slot.modelsDirty || noneSelected}
              className="rounded-lg px-3 py-2 text-xs font-medium inline-flex items-center gap-2 disabled:opacity-40"
              style={{ background: slot.modelsDirty && !noneSelected ? BLUE : CARD, border: `1px solid ${BORDER}`, color: TEXT }}
            >
              <RefreshCw size={12} /> Recalculate Forecast
            </button>
            {noneSelected && <span className="text-[11px]" style={{ color: AMBER }}>Select at least one model.</span>}
            {slot.modelsDirty && !noneSelected && <span className="text-[11px]" style={{ color: AMBER }}>Selection changed — recalculate to apply.</span>}
          </div>

          {/* Breakdown table */}
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-3 py-2 grid grid-cols-[1fr_74px_64px_72px] gap-2 text-[10px] uppercase tracking-wider" style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
              <span>Model</span><span className="text-right">Signal</span><span className="text-right">Weight</span><span className="text-right">Contrib.</span>
            </div>
            {FACTOR_REGISTRY.map((m) => {
              const f = byKey[m.key];
              if (!f) return null;
              const active = result.activeKeys.includes(m.key);
              const bias = f.signal === "BUY" ? "Bullish" : f.signal === "SELL" ? "Bearish" : "Neutral";
              const tint = f.signal === "BUY" ? GREEN : f.signal === "SELL" ? RED : AMBER;
              const isOpen = expanded === m.key;
              return (
                <div key={m.key} style={{ borderBottom: `1px solid ${BORDER}`, opacity: active ? 1 : 0.4 }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : m.key)}
                    className="w-full px-3 py-2 grid grid-cols-[1fr_74px_64px_72px] gap-2 items-center text-left hover:bg-white/5"
                  >
                    <span className="text-xs flex items-center gap-1.5 truncate" style={{ color: TEXT }}>
                      {isOpen ? <ChevronDown size={11} color={MUTED} /> : <ChevronRight size={11} color={MUTED} />}
                      {m.label}
                    </span>
                    <span className="text-[11px] text-right" style={{ color: active ? tint : MUTED }}>{active ? bias : "Excluded"}</span>
                    <span className="font-mono text-[11px] text-right" style={{ color: MUTED }}>{((f.weight ?? 0) * 100).toFixed(1)}%</span>
                    <span className="font-mono text-[11px] text-right" style={{ color: active ? tint : MUTED }}>
                      {(f.contribution ?? 0) >= 0 ? "+" : ""}{(f.contribution ?? 0).toFixed(3)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2 pl-8 text-[11px] space-y-1" style={{ color: MUTED }}>
                      <div>{f.detail}</div>
                      <div>{m.description}</div>
                      <div className="font-mono">
                        raw score {f.score >= 0 ? "+" : ""}{f.score.toFixed(2)} × weight {((f.weight ?? 0) * 100).toFixed(1)}% = {(f.contribution ?? 0) >= 0 ? "+" : ""}{(f.contribution ?? 0).toFixed(3)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="px-3 py-2 grid grid-cols-[1fr_74px_64px_72px] gap-2 text-xs" style={{ color: TEXT }}>
              <span className="uppercase tracking-wider text-[10px]" style={{ color: MUTED }}>Composite</span>
              <span />
              <span className="font-mono text-[11px] text-right" style={{ color: MUTED }}>100%</span>
              <span className="font-mono text-right" style={{ color: signalColor(result.signal) }}>
                {result.compositeScore >= 0 ? "+" : ""}{result.compositeScore.toFixed(3)}
              </span>
            </div>
          </div>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Weights are renormalised across the selected models, so the composite score stays on the same scale.
            Selection applies to this session only.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Fundamentals ──
function fmtCr(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1e7) return "₹" + (n / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtNum(n: number | null | undefined, suffix = "", digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return n.toFixed(digits) + suffix;
}

function FundamentalsPanel({ asset, meta }: { asset: Asset; meta: YahooMeta | null }) {
  const seed = useMemo(
    () => NIFTY500.find((s) => `${s.symbol}.NS` === asset.yahoo || s.symbol === asset.symbol) ?? null,
    [asset],
  );

  const q = useQuery({
    queryKey: ["yfund", asset.yahoo],
    queryFn: async (): Promise<YahooFundamentals | null> => {
      if (!asset.yahoo) return null;
      const r = await fetchYahooFundamentals({ data: { symbol: asset.yahoo } });
      return r.data;
    },
    enabled: !!asset.yahoo,
    staleTime: 15 * 60_000,
  });

  const f = q.data ?? null;
  const marketCapCr = f?.marketCap != null ? f.marketCap : seed?.marCap != null ? seed.marCap * 1e7 : null;

  const rows: { label: string; value: string }[] = [
    { label: "P/E Ratio (TTM)", value: fmtNum(f?.peTrailing ?? seed?.pe ?? null) },
    { label: "P/B Ratio", value: fmtNum(f?.pb ?? null) },
    { label: "EPS (TTM)", value: f?.eps != null ? fmtINR(f.eps) : "N/A" },
    { label: "Market Cap", value: fmtCr(marketCapCr) },
    { label: "Dividend Yield", value: fmtNum(f?.dividendYieldPct ?? seed?.divYld ?? null, "%") },
    { label: "Debt / Equity", value: fmtNum(f?.debtToEquity ?? seed?.debtEquity ?? null) },
    { label: "ROE", value: fmtNum(f?.roePct ?? null, "%") },
    { label: "ROCE", value: fmtNum(seed?.roce ?? null, "%") },
    { label: "Revenue growth (YoY)", value: fmtNum(f?.revenueGrowthPct ?? seed?.qtrSalesVar ?? null, "%") },
    { label: "Profit margin", value: fmtNum(f?.profitMarginPct ?? null, "%") },
    { label: "52-week high", value: f?.w52High != null ? fmtINR(f.w52High) : meta?.w52High != null ? fmtINR(meta.w52High) : "N/A" },
    { label: "52-week low", value: f?.w52Low != null ? fmtINR(f.w52Low) : meta?.w52Low != null ? fmtINR(meta.w52Low) : "N/A" },
  ];

  const [summary, setSummary] = useState("");
  const [sumLoading, setSumLoading] = useState(false);
  const [sumErr, setSumErr] = useState<string | null>(null);

  async function genSummary() {
    setSumLoading(true); setSumErr(null); setSummary("");
    try {
      const r = await generateFundamentalSummary({ data: {
        symbol: asset.symbol,
        name: asset.name,
        sector: f?.sector ?? seed?.sector ?? asset.meta ?? "",
        metricLines: rows.map((x) => `${x.label}: ${x.value}`),
      } });
      if (!r.ok) setSumErr(r.error ?? "Summary unavailable");
      else setSummary(r.text);
    } catch (e) {
      setSumErr(e instanceof Error ? e.message : "unknown");
    } finally { setSumLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider" style={{ color: TEXT }}>Fundamentals · {asset.symbol}</span>
          <span className="text-[10px]" style={{ color: MUTED }}>
            {q.isLoading ? "Loading…" : q.data ? (f?.industry ?? f?.sector ?? seed?.sector ?? "") : "Live fundamentals unavailable — showing bundled snapshot"}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{r.label}</div>
              <div className="font-mono text-sm" style={{ color: r.value === "N/A" ? MUTED : TEXT }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} color={BLUE} />
            <span className="text-xs uppercase tracking-wider" style={{ color: TEXT }}>Fundamental Summary</span>
          </div>
          <button onClick={genSummary} disabled={sumLoading} className="text-[11px] inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/5 disabled:opacity-40" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
            {sumLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {summary ? "Regenerate" : "Generate"}
          </button>
        </div>
        {sumErr && <div className="text-xs" style={{ color: RED }}>{sumErr}</div>}
        {!summary && !sumLoading && !sumErr && <div className="text-xs" style={{ color: MUTED }}>Click Generate for a Dexter read on these fundamentals.</div>}
        {summary && <div className="text-sm leading-relaxed" style={{ color: TEXT }}>{summary}</div>}
      </div>
    </div>
  );
}


function SlotView({ slot, horizon, title, secondary }: { slot: SlotState; horizon: Horizon; title: string; secondary?: boolean }) {
  const { asset, meta, cached, result, loading, error, refresh, isRefreshing } = slot;
  if (!asset) return null;

  // Fund path
  if (asset.kind === "fund") {
    const proj = projectFund(asset);
    return (
      <div className="rounded-xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="text-sm" style={{ color: MUTED }}>{asset.name}</div>
        {!proj ? (
          <div className="text-sm mt-2" style={{ color: AMBER }}>Insufficient historical returns for projection.</div>
        ) : (
          <div className="mt-3">
            <div className="text-xs" style={{ color: MUTED }}>Implied CAGR from {proj.source}: <span className="font-mono" style={{ color: TEXT }}>{proj.cagr.toFixed(2)}%</span></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {proj.years.map((y, i) => (
                <div key={y} className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="text-[10px] uppercase" style={{ color: MUTED }}>{y}Y projection</div>
                  <div className="font-mono text-lg" style={{ color: TEXT }}>{fmtINR(proj.values[i], 2)}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] mt-3" style={{ color: MUTED }}>Starting NAV {fmtINR(asset.fundReturns?.nav ?? 100)}. Mutual fund forecasts use the fund's own historical CAGR — live NAV integration coming soon.</div>
          </div>
        )}
      </div>
    );
  }

  if (loading) return (
    <div className="rounded-xl p-8 flex items-center gap-3" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
      <Loader2 size={16} className="animate-spin" /> Fetching live data for {asset.symbol}…
    </div>
  );
  if (error) return (
    <div className="rounded-xl p-5" style={{ background: CARD, border: `1px solid ${RED}`, color: RED }}>
      Could not fetch live data for {asset.symbol}: {error}
    </div>
  );
  if (!result || !meta) return null;

  const currentPrice = meta.price ?? result.history90.at(-1)?.close ?? 0;

  return (
    <div className="space-y-4">
      {secondary && <div className="text-xs uppercase tracking-wider" style={{ color: MUTED }}>Comparison: {title}</div>}
      <QuoteStrip meta={meta} asset={asset} cached={cached} onRefresh={refresh} isRefreshing={isRefreshing} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <div className="space-y-3">
          <div className="flex gap-1">
            {(["technical", "fundamentals"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-lg px-3 py-1.5 text-xs capitalize"
                style={{
                  border: `1px solid ${tab === t ? BLUE : BORDER}`,
                  background: tab === t ? "rgba(55,138,221,0.15)" : "transparent",
                  color: tab === t ? TEXT : MUTED,
                }}
              >
                {t === "technical" ? "Technical Forecast" : "Fundamentals"}
              </button>
            ))}
          </div>

          {tab === "technical" ? (
            <>
              <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="text-xs" style={{ color: MUTED }}>
                    Historical 90d + {horizon} forecast · {HORIZON_DAYS[horizon]} trading days
                  </div>
                  <div className="flex items-center gap-3 text-[11px]" style={{ color: MUTED }}>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: "#94a3b8" }} /> Historical</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: GREEN, borderTop: `1px dashed ${GREEN}` }} /> Forecast</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-2" style={{ background: "rgba(55,138,221,0.3)" }} /> 80% band</span>
                  </div>
                </div>
                <ForecastChart result={result} currentPrice={currentPrice} />
              </div>
              <MiniCharts result={result} />
              <FactorTable result={result} />
              <ModelsPanel slot={slot} result={result} />
            </>
          ) : (
            <FundamentalsPanel asset={asset} meta={meta} />
          )}
        </div>
        <div className="space-y-4">
          <SignalDashboard result={result} />
          <DexterInsightCard asset={asset} result={result} horizon={horizon} currentPrice={currentPrice} />
        </div>
      </div>
    </div>
  );
}

// ── Dexter AI insight ──
function DexterInsightCard({ asset, result, horizon, currentPrice }: { asset: Asset; result: EngineResult; horizon: Horizon; currentPrice: number }) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  async function generate() {
    setLoading(true); setErr(null); setText("");
    const factorLines = result.factors.map((f) => `${f.label}: ${f.detail}`);
    try {
      const r = await generateDexterInsight({ data: {
        symbol: asset.symbol, name: asset.name, currentPrice,
        horizon, compositeScore: result.compositeScore, signal: result.signal, confidence: result.confidence,
        buyCount: result.buyCount, factorLines,
        targetPrice: result.targetPrice, upsidePct: result.upsidePct,
        s1: result.supportLevels.s1, r1: result.resistanceLevels.r1, atrPct: result.atrPct,
      } });
      if (!r.ok) setErr(r.error ?? "AI insight failed");
      else {
        setText(r.text);
        setGeneratedAt(Date.now());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown");
    } finally { setLoading(false); }
  }

  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} color={BLUE} />
          <span className="text-xs uppercase tracking-wider" style={{ color: TEXT }}>Dexter Analysis</span>
        </div>
        <button onClick={generate} disabled={loading} className="text-[11px] inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/5 disabled:opacity-40" style={{ border: `1px solid ${BORDER}`, color: TEXT }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {text ? "Regenerate" : "Generate"}
        </button>
      </div>
      {err && <div className="text-xs mt-2" style={{ color: RED }}>{err}</div>}
      {!text && !loading && !err && (
        <div className="text-xs" style={{ color: MUTED }}>Click Generate for AI commentary tailored to this signal.</div>
      )}
      {loading && <div className="text-xs flex items-center gap-2 mt-2" style={{ color: MUTED }}><Loader2 size={12} className="animate-spin" /> Composing analysis…</div>}
      {text && (
        <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: TEXT }}>{text}</div>
      )}
      {generatedAt && (
        <div className="text-[10px] mt-2" style={{ color: MUTED }}>Generated {Math.max(0, Math.floor((Date.now() - generatedAt) / 1000))}s ago</div>
      )}
    </div>
  );
}

// ── comparison ──
function ComparisonBanner({ a, ar, b, br, horizon }: { a: Asset; ar: EngineResult; b: Asset; br: EngineResult; horizon: Horizon }) {
  const winner = ar.compositeScore > br.compositeScore ? { asset: a, r: ar } : { asset: b, r: br };
  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BLUE}` }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: MUTED }}>Comparison · {horizon}</div>
      <div className="grid grid-cols-2 gap-3">
        {[{ asset: a, r: ar }, { asset: b, r: br }].map(({ asset, r }) => (
          <div key={asset.key} className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="font-mono text-xs" style={{ color: TEXT }}>{asset.symbol}</div>
            <div className="text-lg font-semibold" style={{ color: signalColor(r.signal) }}>{r.signal}</div>
            <div className="text-xs font-mono mt-1" style={{ color: MUTED }}>Score {r.compositeScore >= 0 ? "+" : ""}{r.compositeScore.toFixed(3)} · Target {fmtPct(r.upsidePct)}</div>
          </div>
        ))}
      </div>
      <div className="text-sm mt-3" style={{ color: TEXT }}>
        <span style={{ color: BLUE }}>▲</span> Best opportunity: <span className="font-semibold">{winner.asset.symbol}</span> — strongest signal ({winner.r.compositeScore >= 0 ? "+" : ""}{winner.r.compositeScore.toFixed(3)}) with {fmtPct(winner.r.upsidePct)} target over {horizon}.
      </div>
    </div>
  );
}
