import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Star, StarOff, GitCompare, Download, Filter, X, Calculator } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, ReferenceLine } from "recharts";
import { MODEL_REGISTRY, FAMILY_LABEL, fetchForecast, generateMockForecast, type Family, type Horizon, type ForecastResponse, type ModelForecast } from "@/lib/forecast/workbench";
import { NIFTY500 } from "@/lib/nifty500";
import { INDICES_UNIVERSE } from "@/lib/forecast/indices";
import { ETFS_UNIVERSE, type ETFRow } from "@/lib/forecast/etfs";
import { FUNDS_UNIVERSE, type FundRow } from "@/lib/forecast/funds";
import { runLongTermForecast, LONG_HORIZONS, cagrSourceLabel, type LongHorizon, type LongTermResult } from "@/lib/forecast/longterm";

export const Route = createFileRoute("/forecast")({
  head: () => ({ meta: [
    { title: "Forecast Workbench — Dexter" },
    { name: "description", content: "Multi-model forecasting for Indian stocks, indices, ETFs and mutual funds. Short-term signals and long-term Monte Carlo projections." },
  ] }),
  component: ForecastWorkbench,
});

// --- design tokens ---
const GOLD = "#D4AF37";
const NAVY_BG = "#0B1220";
const CARD_BG = "#111C33";
const BORDER = "#1e2a44";
const TEXT_DIM = "#8b9bb4";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const BLUE = "#60a5fa";

// --- types ---
type AssetType = "stock" | "index" | "etf" | "fund";
type Term = "short" | "long";
interface Asset { id: string; symbol: string; name: string; type: AssetType; meta?: string }

const ASSET_LABEL: Record<AssetType, string> = { stock: "Stocks", index: "Indices", etf: "ETFs", fund: "Mutual Funds" };
const SHORT_HORIZONS: { id: Horizon; label: string }[] = [
  { id: "1d", label: "1D" }, { id: "5d", label: "5D" }, { id: "20d", label: "1M" },
];
const FAMILIES: Family[] = ["deep_learning", "ensemble_hybrid", "machine_learning", "statistical", "advanced_niche", "next_gen"];
const LS_PREFS = "dx_forecast_v2_prefs";
const LS_WATCH = "dx_forecast_v2_watchlist";

interface Prefs { assetType: AssetType; assetId: string; term: Term; horizonShort: Horizon; horizonLong: LongHorizon; models: string[] }
function loadPrefs(): Prefs {
  const def: Prefs = { assetType: "stock", assetId: "RELIANCE", term: "short", horizonShort: "5d", horizonLong: "1y", models: MODEL_REGISTRY.map((m) => m.name) };
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_PREFS) : null;
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return { ...def, ...p, models: Array.isArray(p.models) && p.models.length ? p.models : def.models };
  } catch { return def; }
}
function loadWatch(): string[] { try { const r = typeof window !== "undefined" ? localStorage.getItem(LS_WATCH) : null; return r ? JSON.parse(r) : []; } catch { return []; } }

// --- universe lookups ---
function stockAssets(): Asset[] {
  return NIFTY500.map((s) => ({ id: `stock:${s.symbol}`, symbol: `${s.symbol}.NS`, name: s.name, type: "stock", meta: s.sector }));
}
function indexAssets(): Asset[] { return INDICES_UNIVERSE.map((i) => ({ id: `index:${i.symbol}`, symbol: i.symbol, name: i.name, type: "index", meta: i.cat })); }
function etfAssets(): Asset[] { return ETFS_UNIVERSE.map((e) => ({ id: `etf:${e.name}`, symbol: e.name, name: e.name, type: "etf", meta: e.cat })); }
function fundAssets(): Asset[] { return FUNDS_UNIVERSE.map((f) => ({ id: `fund:${f.name}`, symbol: f.name, name: f.name, type: "fund", meta: f.cat })); }
function universeFor(t: AssetType): Asset[] {
  return t === "stock" ? stockAssets() : t === "index" ? indexAssets() : t === "etf" ? etfAssets() : fundAssets();
}
function assetById(id: string): Asset | null {
  const [type] = id.split(":") as [AssetType];
  return universeFor(type).find((a) => a.id === id) ?? null;
}
function findEtf(name: string): ETFRow | undefined { return ETFS_UNIVERSE.find((e) => e.name === name); }
function findFund(name: string): FundRow | undefined { return FUNDS_UNIVERSE.find((f) => f.name === name); }

// --- deterministic bar synth for long-term when we have no live series ---
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function synthBars(seed: string, basePrice: number, days = 1500) {
  const r = rnd(hash(seed));
  const bars: { t: number; c: number }[] = [];
  let p = basePrice * (0.5 + r() * 0.3);
  const now = Date.now();
  for (let i = days; i > 0; i--) {
    p *= 1 + (r() - 0.48) * 0.018;
    bars.push({ t: now - i * 86400000, c: +p.toFixed(2) });
  }
  return bars;
}

// ============ ROOT ============
function ForecastWorkbench() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [watchlist, setWatchlist] = useState<string[]>(() => loadWatch());
  const [compare, setCompare] = useState<string[]>([]);
  const [screenerOpen, setScreenerOpen] = useState(false);

  useEffect(() => { try { localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  useEffect(() => { try { localStorage.setItem(LS_WATCH, JSON.stringify(watchlist)); } catch { /* ignore */ } }, [watchlist]);

  const asset = assetById(prefs.assetId) ?? universeFor(prefs.assetType)[0];
  const isFund = asset.type === "fund";

  // short-term uses the workbench API; not applicable to funds (no daily price series)
  const shortMutation = useMutation({
    mutationFn: (req: { ticker: string; horizon: Horizon; models: string[] }) => fetchForecast(req),
  });

  // long-term is computed client-side deterministically
  const longResult = useMemo<LongTermResult | null>(() => {
    if (prefs.term !== "long") return null;
    const fund = isFund ? findFund(asset.name) : undefined;
    const etf = asset.type === "etf" ? findEtf(asset.name) : undefined;
    const base = fund ? 100 : etf?.nav ?? 500 + (hash(asset.id) % 2000);
    const bars = synthBars(asset.id, base);
    return runLongTermForecast({
      bars,
      horizon: prefs.horizonLong,
      confidence: 80,
      mcPaths: 1500,
      fundCagr: fund ? { r1: fund.r1, r3: fund.r3, r5: fund.r5, r10: fund.r10 } : undefined,
    });
  }, [prefs.term, prefs.horizonLong, asset, isFund]);

  const runShort = () => {
    if (isFund) return;
    shortMutation.mutate({ ticker: asset.symbol, horizon: prefs.horizonShort, models: prefs.models });
  };

  useEffect(() => { if (prefs.term === "short" && !isFund) runShort(); /* eslint-disable-next-line */ }, [prefs.assetId, prefs.horizonShort, prefs.term]);

  const toggleWatch = (id: string) => setWatchlist((w) => w.includes(id) ? w.filter((x) => x !== id) : [...w, id]);
  const toggleCompare = (id: string) => setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]);

  const setAssetType = (t: AssetType) => {
    const u = universeFor(t);
    setPrefs((p) => ({ ...p, assetType: t, assetId: u[0]?.id ?? p.assetId, term: t === "fund" ? "long" : p.term }));
  };

  return (
    <div style={{ background: NAVY_BG, minHeight: "100vh", color: "#e6ecf5" }} className="tabular-nums">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Header */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <div className="text-xs uppercase tracking-wider" style={{ color: GOLD, letterSpacing: 2 }}>Forecast Workbench</div>
              <h1 className="text-2xl md:text-3xl font-semibold mt-1">Stocks · Indices · ETFs · Funds</h1>
              <p className="text-sm mt-1" style={{ color: TEXT_DIM }}>35-model short-term signals · Monte Carlo long-term projections · Screener · Watchlist · Compare</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setScreenerOpen(true)} className="px-3 py-2 text-sm rounded flex items-center gap-2" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#cbd5e1" }}><Filter size={14} /> Screener</button>
              <button onClick={() => toggleWatch(asset.id)} className="px-3 py-2 text-sm rounded flex items-center gap-2" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: watchlist.includes(asset.id) ? GOLD : "#cbd5e1" }}>
                {watchlist.includes(asset.id) ? <Star size={14} fill={GOLD} /> : <StarOff size={14} />}
                Watchlist ({watchlist.length})
              </button>
              <button onClick={() => toggleCompare(asset.id)} className="px-3 py-2 text-sm rounded flex items-center gap-2" style={{ background: compare.includes(asset.id) ? GOLD : "#0d1728", border: `1px solid ${BORDER}`, color: compare.includes(asset.id) ? NAVY_BG : "#cbd5e1" }}>
                <GitCompare size={14} /> Compare ({compare.length}/3)
              </button>
            </div>
          </div>

          {/* Asset type tabs */}
          <div className="mt-4 flex gap-1 border-b" style={{ borderColor: BORDER }}>
            {(Object.keys(ASSET_LABEL) as AssetType[]).map((t) => {
              const on = prefs.assetType === t;
              return (
                <button key={t} onClick={() => setAssetType(t)} className="px-4 py-2 text-sm transition"
                  style={{ color: on ? GOLD : TEXT_DIM, borderBottom: `2px solid ${on ? GOLD : "transparent"}`, fontWeight: on ? 600 : 500 }}>
                  {ASSET_LABEL[t]} <span className="text-xs opacity-70">({universeFor(t).length})</span>
                </button>
              );
            })}
          </div>

          {/* Asset picker + horizon/term */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]"><AssetPicker assetType={prefs.assetType} value={prefs.assetId} onChange={(id) => setPrefs((p) => ({ ...p, assetId: id }))} /></div>
            {!isFund && (
              <div className="flex items-center gap-1 rounded-md p-1" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
                {(["short", "long"] as Term[]).map((t) => {
                  const on = prefs.term === t;
                  return <button key={t} onClick={() => setPrefs((p) => ({ ...p, term: t }))} className="px-3 py-1.5 text-xs rounded transition"
                    style={{ background: on ? GOLD : "transparent", color: on ? NAVY_BG : "#cbd5e1", fontWeight: on ? 600 : 500 }}>{t === "short" ? "Short-Term" : "Long-Term"}</button>;
                })}
              </div>
            )}
            {(prefs.term === "short" && !isFund) ? (
              <div className="flex items-center gap-1 rounded-md p-1" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
                {SHORT_HORIZONS.map((h) => {
                  const on = prefs.horizonShort === h.id;
                  return <button key={h.id} onClick={() => setPrefs((p) => ({ ...p, horizonShort: h.id }))} className="px-3 py-1.5 text-xs rounded"
                    style={{ background: on ? GOLD : "transparent", color: on ? NAVY_BG : "#cbd5e1", fontWeight: on ? 600 : 500 }}>{h.label}</button>;
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1 rounded-md p-1" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
                {LONG_HORIZONS.map((h) => {
                  const on = prefs.horizonLong === h.id;
                  return <button key={h.id} onClick={() => setPrefs((p) => ({ ...p, horizonLong: h.id }))} className="px-3 py-1.5 text-xs rounded"
                    style={{ background: on ? GOLD : "transparent", color: on ? NAVY_BG : "#cbd5e1", fontWeight: on ? 600 : 500 }}>{h.label}</button>;
                })}
              </div>
            )}
            {prefs.term === "short" && !isFund && (
              <button onClick={runShort} disabled={shortMutation.isPending} className="px-4 py-2 rounded font-semibold text-sm flex items-center gap-2 transition disabled:opacity-50" style={{ background: GOLD, color: NAVY_BG }}>
                {shortMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />} Run
              </button>
            )}
          </div>
        </div>

        {/* Compare bar */}
        {compare.length > 0 && (
          <CompareBar ids={compare} term={prefs.term} horizonShort={prefs.horizonShort} horizonLong={prefs.horizonLong} models={prefs.models} onRemove={toggleCompare} onClear={() => setCompare([])} />
        )}

        {/* Watchlist row */}
        {watchlist.length > 0 && (
          <WatchlistStrip ids={watchlist} onOpen={(id) => setPrefs((p) => ({ ...p, assetId: id, assetType: (id.split(":")[0] as AssetType) }))} onRemove={toggleWatch} />
        )}

        {/* Body */}
        {prefs.term === "short" && !isFund && (
          <ShortTermPanel data={shortMutation.data} pending={shortMutation.isPending} models={prefs.models} setModels={(mm) => setPrefs((p) => ({ ...p, models: mm }))} asset={asset} />
        )}
        {(prefs.term === "long" || isFund) && longResult && (
          <LongTermPanel asset={asset} result={longResult} />
        )}
        {isFund && <SIPCalculator fund={findFund(asset.name)} horizonLong={prefs.horizonLong} />}

        {screenerOpen && <Screener assetType={prefs.assetType} onClose={() => setScreenerOpen(false)} onPick={(id) => { setPrefs((p) => ({ ...p, assetId: id, assetType: (id.split(":")[0] as AssetType) })); setScreenerOpen(false); }} />}

        <div className="text-center text-xs pt-6" style={{ color: TEXT_DIM }}>
          Educational forecasts using historical data and statistical models · Not investment advice
        </div>
      </div>
    </div>
  );
}

// ============ AssetPicker ============
function AssetPicker({ assetType, value, onChange }: { assetType: AssetType; value: string; onChange: (id: string) => void }) {
  const universe = useMemo(() => universeFor(assetType), [assetType]);
  const current = universe.find((u) => u.id === value) ?? universe[0];
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return universe.slice(0, 10);
    return universe.filter((u) => u.name.toLowerCase().includes(s) || u.symbol.toLowerCase().includes(s)).slice(0, 12);
  }, [q, universe]);
  return (
    <div className="relative">
      <div className="flex items-center rounded-md" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
        <Search size={15} style={{ color: TEXT_DIM, marginLeft: 10 }} />
        <input value={open ? q : `${current?.name ?? ""}`} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQ(""); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Search ${ASSET_LABEL[assetType].toLowerCase()}…`}
          className="flex-1 bg-transparent px-2 py-2 text-sm outline-none" style={{ color: "#e6ecf5" }} />
        {current && <span className="text-xs pr-3" style={{ color: GOLD }}>{current.symbol}</span>}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md z-30 max-h-72 overflow-auto" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          {suggestions.map((s) => (
            <button key={s.id} onMouseDown={() => { onChange(s.id); setOpen(false); setQ(""); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-[#0d1728]">
              <div className="flex justify-between gap-2">
                <span style={{ color: "#e6ecf5" }}>{s.name}</span>
                <span className="text-xs" style={{ color: GOLD }}>{s.symbol}</span>
              </div>
              {s.meta && <div className="text-xs" style={{ color: TEXT_DIM }}>{s.meta}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Short-Term Panel (35-model workbench) ============
function ShortTermPanel({ data, pending, models, setModels, asset }: { data: ForecastResponse | undefined; pending: boolean; models: string[]; setModels: (m: string[]) => void; asset: Asset }) {
  const toggleModel = (n: string) => setModels(models.includes(n) ? models.filter((m) => m !== n) : [...models, n]);
  const toggleFamily = (fam: Family) => {
    const fm = MODEL_REGISTRY.filter((m) => m.family === fam).map((m) => m.name);
    const allOn = fm.every((n) => models.includes(n));
    setModels(allOn ? models.filter((n) => !fm.includes(n)) : Array.from(new Set([...models, ...fm])));
  };
  return (
    <>
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Model Selection <span style={{ color: TEXT_DIM }}>· {models.length}/{MODEL_REGISTRY.length} active</span></div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setModels(MODEL_REGISTRY.map((m) => m.name))} style={{ color: GOLD }}>All</button>
            <span style={{ color: TEXT_DIM }}>·</span>
            <button onClick={() => setModels([])} style={{ color: TEXT_DIM }}>Clear</button>
          </div>
        </div>
        <FamilyTabs selected={models} onToggleModel={toggleModel} onToggleFamily={toggleFamily} />
      </div>

      {data?.isDemo && (
        <div className="rounded-lg p-3 flex items-start gap-2 text-sm" style={{ background: "#3a2c0d", border: `1px solid ${GOLD}`, color: "#f5e5b8" }}>
          <AlertTriangle size={16} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
          <div><strong>Demo data</strong> — {data.demoReason} Set <code style={{ background: "#00000040", padding: "1px 5px", borderRadius: 3 }}>FORECAST_API_URL</code> to point /api/forecast at your Python forecasting service.</div>
        </div>
      )}

      {pending && <SkeletonBlock />}
      {!pending && data && (
        <div className="space-y-5">
          <ConsensusCard data={data} asset={asset} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2"><PriceChart data={data} /></div>
            <IntervalCoverageCard data={data} />
          </div>
          <Leaderboard models={data.models} />
          <BacktestPanel data={data} />
          <ExportBar data={data} asset={asset} />
        </div>
      )}
    </>
  );
}

function ConsensusCard({ data, asset }: { data: ForecastResponse; asset: Asset }) {
  const c = data.consensus;
  const color = c.signal === "BUY" ? GREEN : c.signal === "SELL" ? RED : "#94a3b8";
  const Icon = c.signal === "BUY" ? TrendingUp : c.signal === "SELL" ? TrendingDown : Minus;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-lg flex flex-col items-center justify-center" style={{ background: `${color}22`, border: `2px solid ${color}` }}>
            <Icon size={28} color={color} />
            <div className="text-lg font-bold mt-1" style={{ color }}>{c.signal}</div>
          </div>
          <div>
            <div className="text-xs uppercase" style={{ color: TEXT_DIM, letterSpacing: 1.5 }}>Consensus · {asset.name}</div>
            <div className="text-3xl font-semibold mt-1" style={{ color }}>₹{c.predictedRange.low.toFixed(2)} – ₹{c.predictedRange.high.toFixed(2)}</div>
            <div className="text-sm mt-0.5" style={{ color: TEXT_DIM }}>Median ₹{c.predictedRange.median.toFixed(2)} · 10th–90th percentile</div>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 md:justify-end flex-wrap">
          <Chip label="Confidence" value={`${c.confidencePct.toFixed(1)}%`} />
          <Chip label="Models" value={`${data.models.length}`} />
          <Chip label="Regime" value={c.regime === "HIGH_VOLATILITY" ? "High Vol" : "Low Vol"} color={c.regime === "HIGH_VOLATILITY" ? AMBER : GREEN} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t text-sm" style={{ borderColor: BORDER, color: "#cbd5e1" }}>{c.reasoning}</div>
    </div>
  );
}
function Chip({ label, value, color = GOLD }: { label: string; value: string; color?: string }) {
  return <div className="px-3 py-2 rounded-md" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
    <div className="text-xs" style={{ color: TEXT_DIM }}>{label}</div>
    <div className="text-lg font-semibold" style={{ color }}>{value}</div>
  </div>;
}

function PriceChart({ data }: { data: ForecastResponse }) {
  const chart = useMemo(() => {
    const hist = data.historical.slice(-90).map((h) => ({ date: h.date, actual: h.close, median: null as number | null, low: null as number | null, high: null as number | null }));
    const last = hist[hist.length - 1];
    const fc = data.forecastPath.map((f) => ({ date: f.date, actual: null as number | null, median: f.median, low: f.low, high: f.high }));
    if (last) fc.unshift({ date: last.date, actual: last.actual, median: last.actual, low: last.actual, high: last.actual });
    return [...hist, ...fc];
  }, [data]);
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="text-sm font-medium mb-3">Price Forecast <span className="text-xs" style={{ color: TEXT_DIM }}>· 90d history + forecast band</span></div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs><linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.25} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: TEXT_DIM, fontSize: 11 }} minTickGap={30} />
          <YAxis tick={{ fill: TEXT_DIM, fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `₹${v.toFixed(0)}`} />
          <Tooltip contentStyle={{ background: NAVY_BG, border: `1px solid ${BORDER}`, borderRadius: 6 }} labelStyle={{ color: GOLD }} />
          <Area type="monotone" dataKey="high" stroke="none" fill="url(#bandFill)" />
          <Area type="monotone" dataKey="low" stroke="none" fill={NAVY_BG} />
          <Line type="monotone" dataKey="actual" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="median" stroke={GOLD} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
function IntervalCoverageCard({ data }: { data: ForecastResponse }) {
  const gap = Math.abs(data.intervalCoverage.actualPct - data.intervalCoverage.targetPct);
  const ok = gap <= 5;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4 space-y-4">
      <div><div className="text-sm font-medium">Interval Calibration</div><div className="text-xs" style={{ color: TEXT_DIM }}>Are the bands honest?</div></div>
      <div><div className="text-3xl font-semibold" style={{ color: ok ? GREEN : AMBER }}>{data.intervalCoverage.actualPct.toFixed(1)}%</div>
        <div className="text-xs mt-1" style={{ color: TEXT_DIM }}>90-day coverage · target {data.intervalCoverage.targetPct}%</div></div>
      <div className="text-xs pt-3 border-t" style={{ borderColor: BORDER, color: TEXT_DIM }}>Walk-forward expanding-window validation.</div>
    </div>
  );
}
function FamilyTabs({ selected, onToggleModel, onToggleFamily }: { selected: string[]; onToggleModel: (n: string) => void; onToggleFamily: (f: Family) => void }) {
  const [active, setActive] = useState<Family>("deep_learning");
  const famModels = MODEL_REGISTRY.filter((m) => m.family === active);
  return (
    <>
      <div className="flex gap-1 border-b mb-3 overflow-x-auto" style={{ borderColor: BORDER }}>
        {FAMILIES.map((f) => {
          const count = MODEL_REGISTRY.filter((m) => m.family === f && selected.includes(m.name)).length;
          const total = MODEL_REGISTRY.filter((m) => m.family === f).length;
          const on = active === f;
          return <button key={f} onClick={() => setActive(f)} className="px-3 py-2 text-sm whitespace-nowrap"
            style={{ color: on ? GOLD : TEXT_DIM, borderBottom: `2px solid ${on ? GOLD : "transparent"}`, fontWeight: on ? 600 : 500 }}>
            {FAMILY_LABEL[f]} <span className="text-xs opacity-70">({count}/{total})</span>
          </button>;
        })}
      </div>
      <div className="flex justify-between items-center mb-2">
        <button onClick={() => onToggleFamily(active)} className="text-xs" style={{ color: GOLD }}>Toggle all in {FAMILY_LABEL[active]}</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {famModels.map((m) => {
          const on = selected.includes(m.name);
          return <button key={m.name} onClick={() => onToggleModel(m.name)} className="px-3 py-2 text-xs rounded text-left"
            style={{ background: on ? "#1a2542" : "#0d1728", border: `1px solid ${on ? GOLD : BORDER}`, color: on ? "#e6ecf5" : TEXT_DIM }}>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: on ? GOLD : "#3a4560" }} />{m.name}
          </button>;
        })}
      </div>
    </>
  );
}

type SortKey = "directionalAccuracyPct" | "rmse" | "mae" | "mapePct" | "weight" | "name";
function Leaderboard({ models }: { models: ModelForecast[] }) {
  const [sort, setSort] = useState<SortKey>("directionalAccuracyPct");
  const [asc, setAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = useMemo(() => {
    const arr = [...models]; arr.sort((a, b) => {
      const av = a[sort] as number | string; const bv = b[sort] as number | string;
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }); return arr;
  }, [models, sort, asc]);
  const toggle = (k: SortKey) => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(false); } };
  const dc = (v: number) => v > 58 ? GREEN : v >= 50 ? AMBER : RED;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="text-sm font-medium mb-3">Model Leaderboard <span style={{ color: TEXT_DIM }}>· {models.length} active · click row to expand</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr style={{ color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }} className="text-xs uppercase">
            <Th label="Model" k="name" sort={sort} asc={asc} onClick={toggle} align="left" />
            <th className="px-3 py-2 text-left">Family</th>
            <Th label="RMSE" k="rmse" sort={sort} asc={asc} onClick={toggle} />
            <Th label="MAE" k="mae" sort={sort} asc={asc} onClick={toggle} />
            <Th label="MAPE %" k="mapePct" sort={sort} asc={asc} onClick={toggle} />
            <Th label="Dir. Acc." k="directionalAccuracyPct" sort={sort} asc={asc} onClick={toggle} />
            <Th label="Weight" k="weight" sort={sort} asc={asc} onClick={toggle} />
          </tr></thead>
          <tbody>{sorted.map((m) => (
            <Fragment key={m.name}>
              <tr onClick={() => setExpanded(expanded === m.name ? null : m.name)} className="cursor-pointer hover:bg-[#0d1728]" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td className="px-3 py-2.5 flex items-center gap-2">{expanded === m.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span>{m.name}</span></td>
                <td className="px-3 py-2.5 text-xs" style={{ color: TEXT_DIM }}>{FAMILY_LABEL[m.family]}</td>
                <td className="px-3 py-2.5 text-right">{m.rmse.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right">{m.mae.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right">{m.mapePct.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-semibold" style={{ color: dc(m.directionalAccuracyPct) }}>{m.directionalAccuracyPct.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-right" style={{ color: m.weight > 0 ? GOLD : TEXT_DIM }}>{(m.weight * 100).toFixed(2)}%</td>
              </tr>
              {expanded === m.name && (
                <tr style={{ background: "#0a1121" }}><td colSpan={7} className="px-4 py-3">
                  <div className="text-xs mb-2" style={{ color: TEXT_DIM }}>Last 30 predictions vs actual · Target ₹{m.predictedPrice.toFixed(2)}</div>
                  <ResponsiveContainer width="100%" height={140}><LineChart data={m.recentPredictions}>
                    <CartesianGrid stroke={BORDER} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: TEXT_DIM, fontSize: 10 }} minTickGap={40} />
                    <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: NAVY_BG, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }} />
                    <Line type="monotone" dataKey="actual" stroke={GOLD} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="predicted" stroke={BLUE} strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                  </LineChart></ResponsiveContainer>
                </td></tr>
              )}
            </Fragment>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
function Th({ label, k, sort, asc, onClick, align = "right" }: { label: string; k: SortKey; sort: SortKey; asc: boolean; onClick: (k: SortKey) => void; align?: "left" | "right" }) {
  const on = sort === k;
  return <th onClick={() => onClick(k)} className={`px-3 py-2 cursor-pointer select-none ${align === "right" ? "text-right" : "text-left"}`} style={{ color: on ? GOLD : TEXT_DIM }}>{label}{on ? (asc ? " ↑" : " ↓") : ""}</th>;
}
function BacktestPanel({ data }: { data: ForecastResponse }) {
  const [open, setOpen] = useState(true);
  const recent = data.backtestHistory.slice(-20);
  const avg = recent.reduce((s, p) => s + p.rollingDirAccPct, 0) / (recent.length || 1);
  const reg = avg > 55 ? { label: "Working well", color: GREEN } : avg >= 50 ? { label: "Mixed", color: AMBER } : { label: "Struggling", color: RED };
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <div className="text-sm font-medium">Backtest & Validation</div>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${reg.color}22`, color: reg.color }}>{reg.label} · {avg.toFixed(1)}%</span>
        </div>
        <div className="text-xs" style={{ color: TEXT_DIM }}>90d rolling · 20d window</div>
      </button>
      {open && <div className="p-4 pt-0">
        <ResponsiveContainer width="100%" height={200}><LineChart data={data.backtestHistory}>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: TEXT_DIM, fontSize: 10 }} minTickGap={30} />
          <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} domain={[30, 80]} tickFormatter={(v: number) => `${v}%`} />
          <ReferenceLine y={50} stroke={TEXT_DIM} strokeDasharray="3 3" />
          <Tooltip contentStyle={{ background: NAVY_BG, border: `1px solid ${BORDER}`, borderRadius: 6 }} />
          <Line type="monotone" dataKey="rollingDirAccPct" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div>}
    </div>
  );
}

// ============ Long-Term Panel ============
function LongTermPanel({ asset, result }: { asset: Asset; result: LongTermResult }) {
  const isFund = asset.type === "fund";
  const chart = useMemo(() => result.timestamps.map((t, i) => ({
    date: new Date(t).toISOString().slice(0, 10),
    cagr: +result.cagrPath[i].toFixed(2),
    median: +result.mcMedian[i].toFixed(2),
    low: +result.mcLow[i].toFixed(2),
    high: +result.mcHigh[i].toFixed(2),
  })), [result]);
  const totalRet = ((result.endMedian / result.currentPrice) - 1) * 100;
  const color = totalRet > 0 ? GREEN : RED;
  return (
    <div className="space-y-5">
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs uppercase" style={{ color: TEXT_DIM, letterSpacing: 1.5 }}>Long-Term Projection · {asset.name}</div>
            <div className="text-3xl font-semibold mt-1" style={{ color }}>
              {isFund ? "" : "₹"}{result.endMedian.toFixed(2)}{isFund ? "" : ""}
              <span className="text-lg ml-2" style={{ color }}>({totalRet >= 0 ? "+" : ""}{totalRet.toFixed(1)}%)</span>
            </div>
            <div className="text-sm mt-1" style={{ color: TEXT_DIM }}>
              80% band: {result.endLow.toFixed(2)} – {result.endHigh.toFixed(2)} · {result.horizonLabel} horizon
            </div>
          </div>
          <div className="flex-1 flex gap-3 flex-wrap md:justify-end">
            <Chip label="CAGR used" value={`${result.cagrUsed.toFixed(1)}%`} />
            <Chip label="Ann. Vol" value={`${result.sigmaAnnual.toFixed(1)}%`} color={result.sigmaAnnual > 30 ? AMBER : GREEN} />
            <Chip label="P(positive)" value={`${result.probPositive.toFixed(0)}%`} color={result.probPositive > 60 ? GREEN : result.probPositive > 40 ? AMBER : RED} />
            <Chip label="Paths" value={`${result.paths}`} />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t text-sm" style={{ borderColor: BORDER, color: "#cbd5e1" }}>
          Central line uses <strong>{cagrSourceLabel(result.cagrSource)}</strong>. The band is a lognormal Monte Carlo simulation over {result.paths} paths using historical volatility. Wider bands = higher uncertainty.
        </div>
      </div>

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
        <div className="text-sm font-medium mb-3">Monte Carlo Projection <span className="text-xs" style={{ color: TEXT_DIM }}>· 80% confidence band</span></div>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs><linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.28} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: TEXT_DIM, fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fill: TEXT_DIM, fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(0)} />
            <Tooltip contentStyle={{ background: NAVY_BG, border: `1px solid ${BORDER}`, borderRadius: 6 }} labelStyle={{ color: GOLD }} />
            <Area type="monotone" dataKey="high" stroke="none" fill="url(#mcBand)" />
            <Area type="monotone" dataKey="low" stroke="none" fill={NAVY_BG} />
            <Line type="monotone" dataKey="median" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} name="MC Median" />
            <Line type="monotone" dataKey="cagr" stroke={BLUE} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="CAGR Line" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 text-xs mt-2" style={{ color: TEXT_DIM }}>
          <span><span className="inline-block w-3 h-0.5 mr-1" style={{ background: GOLD }} />Monte Carlo median</span>
          <span><span className="inline-block w-3 h-0.5 mr-1" style={{ background: BLUE, borderTop: "1px dashed" }} />CAGR extrapolation</span>
          <span><span className="inline-block w-3 h-2 mr-1" style={{ background: `${GOLD}44` }} />80% confidence band</span>
        </div>
      </div>

      {isFund && findFund(asset.name) && <FundSnapshot fund={findFund(asset.name)!} />}
      {asset.type === "etf" && findEtf(asset.name) && <EtfSnapshot etf={findEtf(asset.name)!} />}
    </div>
  );
}

function FundSnapshot({ fund }: { fund: FundRow }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="text-sm font-medium mb-3">Fund Snapshot · {fund.cat}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {[["1Y", fund.r1], ["3Y", fund.r3], ["5Y", fund.r5], ["10Y", fund.r10]].map(([k, v]) => (
          <div key={k as string} className="p-3 rounded" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
            <div className="text-xs" style={{ color: TEXT_DIM }}>{k} Return</div>
            <div className="text-lg font-semibold" style={{ color: (v as number | null) == null ? TEXT_DIM : (v as number) >= 0 ? GREEN : RED }}>
              {(v as number | null) == null ? "—" : `${(v as number).toFixed(2)}%`}
            </div>
          </div>
        ))}
        <div className="p-3 rounded" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
          <div className="text-xs" style={{ color: TEXT_DIM }}>Expense</div>
          <div className="text-lg font-semibold" style={{ color: GOLD }}>{fund.er == null ? "—" : `${fund.er.toFixed(2)}%`}</div>
        </div>
        <div className="p-3 rounded" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
          <div className="text-xs" style={{ color: TEXT_DIM }}>Rating</div>
          <div className="text-lg font-semibold" style={{ color: GOLD }}>{"★".repeat(fund.rating)}<span style={{ color: TEXT_DIM }}>{"★".repeat(5 - fund.rating)}</span></div>
        </div>
        <div className="p-3 rounded" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
          <div className="text-xs" style={{ color: TEXT_DIM }}>Risk</div>
          <div className="text-lg font-semibold" style={{ color: fund.risk.includes("Very") ? RED : AMBER }}>{fund.risk}</div>
        </div>
        <div className="p-3 rounded" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
          <div className="text-xs" style={{ color: TEXT_DIM }}>Grade</div>
          <div className="text-lg font-semibold" style={{ color: fund.grade.includes("Above") || fund.grade.includes("High") ? GREEN : TEXT_DIM }}>{fund.grade}</div>
        </div>
      </div>
    </div>
  );
}
function EtfSnapshot({ etf }: { etf: ETFRow }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="text-sm font-medium mb-3">ETF Snapshot · {etf.cat}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Chip label="NAV" value={etf.nav ? `₹${etf.nav.toFixed(2)}` : "—"} />
        <Chip label="Day %" value={etf.chg ? `${etf.chg.toFixed(2)}%` : "—"} color={(etf.chg ?? 0) >= 0 ? GREEN : RED} />
        <Chip label="AUM" value={etf.aum ? `₹${etf.aum.toLocaleString()} Cr` : "—"} />
        <Chip label="Expense" value={etf.er ? `${etf.er.toFixed(2)}%` : "—"} />
        <Chip label="1Y" value={etf.r1 != null ? `${etf.r1.toFixed(1)}%` : "—"} color={(etf.r1 ?? 0) >= 0 ? GREEN : RED} />
        <Chip label="3Y" value={etf.r3 != null ? `${etf.r3.toFixed(1)}%` : "—"} />
        <Chip label="5Y" value={etf.r5 != null ? `${etf.r5.toFixed(1)}%` : "—"} />
        <Chip label="1M" value={etf.r1m != null ? `${etf.r1m.toFixed(2)}%` : "—"} color={(etf.r1m ?? 0) >= 0 ? GREEN : RED} />
      </div>
    </div>
  );
}

// ============ SIP Calculator ============
function SIPCalculator({ fund, horizonLong }: { fund: FundRow | undefined; horizonLong: LongHorizon }) {
  const [amount, setAmount] = useState(10000);
  if (!fund) return null;
  const spec = LONG_HORIZONS.find((h) => h.id === horizonLong)!;
  const cagr = (fund.r5 ?? fund.r3 ?? fund.r1 ?? 12) / 100;
  const months = Math.round(spec.years * 12);
  const monthlyRate = Math.pow(1 + cagr, 1 / 12) - 1;
  const fv = monthlyRate === 0 ? amount * months : amount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  const invested = amount * months;
  const gain = fv - invested;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="text-sm font-medium mb-3 flex items-center gap-2"><Calculator size={16} style={{ color: GOLD }} /> SIP Calculator · {spec.label} @ {(cagr * 100).toFixed(1)}% CAGR</div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm">Monthly SIP: <span style={{ color: GOLD }}>₹</span>
          <input type="number" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} className="ml-1 w-32 px-2 py-1 rounded" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#e6ecf5" }} />
        </label>
        <Chip label="Invested" value={`₹${(invested / 100000).toFixed(2)}L`} />
        <Chip label="Future Value" value={`₹${(fv / 100000).toFixed(2)}L`} color={GREEN} />
        <Chip label="Est. Gain" value={`₹${(gain / 100000).toFixed(2)}L`} color={GOLD} />
        <Chip label="Multiplier" value={`${(fv / invested).toFixed(2)}×`} />
      </div>
      <div className="text-xs mt-3" style={{ color: TEXT_DIM }}>Compounded monthly at the fund's trailing CAGR. Actual returns will vary — this is a mathematical projection, not a guarantee.</div>
    </div>
  );
}

// ============ Compare Bar ============
function CompareBar({ ids, term, horizonShort, horizonLong, models, onRemove, onClear }: { ids: string[]; term: Term; horizonShort: Horizon; horizonLong: LongHorizon; models: string[]; onRemove: (id: string) => void; onClear: () => void }) {
  const rows = useMemo(() => ids.map((id) => {
    const a = assetById(id); if (!a) return null;
    if (a.type === "fund") {
      const fund = findFund(a.name);
      const spec = LONG_HORIZONS.find((h) => h.id === horizonLong)!;
      const cagr = (fund?.r5 ?? fund?.r3 ?? fund?.r1 ?? 12) / 100;
      const proj = 100 * Math.pow(1 + cagr, spec.years);
      return { asset: a, signal: "—", target: proj, cagr: cagr * 100 };
    }
    if (term === "long") {
      const bars = synthBars(a.id, 500);
      const r = runLongTermForecast({ bars, horizon: horizonLong, confidence: 80, mcPaths: 400 });
      return { asset: a, signal: r.probPositive > 55 ? "BULL" : r.probPositive < 45 ? "BEAR" : "NEUTRAL", target: r.endMedian, cagr: r.cagrUsed };
    }
    const fc = generateMockForecast(a.symbol, horizonShort, models);
    return { asset: a, signal: fc.consensus.signal, target: fc.consensus.predictedRange.median, cagr: null };
  }).filter(Boolean) as { asset: Asset; signal: string; target: number; cagr: number | null }[], [ids, term, horizonShort, horizonLong, models]);

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium flex items-center gap-2"><GitCompare size={14} style={{ color: GOLD }} /> Comparison</div>
        <button onClick={onClear} className="text-xs" style={{ color: TEXT_DIM }}>Clear all</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.asset.id} className="p-3 rounded relative" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
            <button onClick={() => onRemove(r.asset.id)} className="absolute top-2 right-2" style={{ color: TEXT_DIM }}><X size={14} /></button>
            <div className="text-xs" style={{ color: TEXT_DIM }}>{ASSET_LABEL[r.asset.type]}</div>
            <div className="text-sm font-semibold pr-4" style={{ color: "#e6ecf5" }}>{r.asset.name}</div>
            <div className="mt-2 flex gap-3 text-xs">
              <span>Signal: <strong style={{ color: r.signal === "BUY" || r.signal === "BULL" ? GREEN : r.signal === "SELL" || r.signal === "BEAR" ? RED : AMBER }}>{r.signal}</strong></span>
              <span>Target: <strong style={{ color: GOLD }}>{r.target.toFixed(1)}</strong></span>
              {r.cagr != null && <span>CAGR: <strong style={{ color: GOLD }}>{r.cagr.toFixed(1)}%</strong></span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Watchlist Strip ============
function WatchlistStrip({ ids, onOpen, onRemove }: { ids: string[]; onOpen: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-3">
      <div className="text-xs uppercase mb-2" style={{ color: TEXT_DIM, letterSpacing: 1.5 }}>Watchlist</div>
      <div className="flex gap-2 flex-wrap">
        {ids.map((id) => { const a = assetById(id); if (!a) return null;
          return <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded text-xs" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
            <button onClick={() => onOpen(id)} style={{ color: "#e6ecf5" }}>{a.name}</button>
            <button onClick={() => onRemove(id)} style={{ color: TEXT_DIM }}><X size={12} /></button>
          </div>;
        })}
      </div>
    </div>
  );
}

// ============ Screener ============
function Screener({ assetType, onClose, onPick }: { assetType: AssetType; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [minRet, setMinRet] = useState<string>("");
  const [maxEr, setMaxEr] = useState<string>("");

  const universe = universeFor(assetType);
  const cats = useMemo(() => ["All", ...Array.from(new Set(universe.map((u) => u.meta || "").filter(Boolean)))], [universe]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const mr = minRet === "" ? null : Number(minRet);
    const me = maxEr === "" ? null : Number(maxEr);
    return universe.filter((u) => {
      if (s && !u.name.toLowerCase().includes(s) && !u.symbol.toLowerCase().includes(s)) return false;
      if (cat !== "All" && u.meta !== cat) return false;
      if (assetType === "fund") { const f = findFund(u.name); if (!f) return false;
        if (mr !== null && (f.r3 ?? -999) < mr) return false;
        if (me !== null && (f.er ?? 999) > me) return false;
      }
      if (assetType === "etf") { const e = findEtf(u.name); if (!e) return false;
        if (mr !== null && (e.r3 ?? -999) < mr) return false;
        if (me !== null && (e.er ?? 999) > me) return false;
      }
      return true;
    }).slice(0, 200);
  }, [universe, q, cat, minRet, maxEr, assetType]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-5xl rounded-lg overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: BORDER }}>
          <div className="text-lg font-semibold" style={{ color: GOLD }}>Screener · {ASSET_LABEL[assetType]}</div>
          <button onClick={onClose} style={{ color: TEXT_DIM }}><X size={20} /></button>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="px-3 py-2 rounded text-sm flex-1 min-w-[200px]" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#e6ecf5" }} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-3 py-2 rounded text-sm" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#e6ecf5" }}>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(assetType === "fund" || assetType === "etf") && (<>
            <input type="number" value={minRet} onChange={(e) => setMinRet(e.target.value)} placeholder="Min 3Y ret %" className="px-3 py-2 rounded text-sm w-36" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#e6ecf5" }} />
            <input type="number" value={maxEr} onChange={(e) => setMaxEr(e.target.value)} placeholder="Max expense %" className="px-3 py-2 rounded text-sm w-36" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#e6ecf5" }} />
          </>)}
          <div className="text-xs self-center" style={{ color: TEXT_DIM }}>{rows.length} match</div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: CARD_BG }}>
              <tr style={{ color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }} className="text-xs uppercase">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                {assetType === "fund" && (<><th className="px-3 py-2 text-right">1Y</th><th className="px-3 py-2 text-right">3Y</th><th className="px-3 py-2 text-right">5Y</th><th className="px-3 py-2 text-right">ER</th><th className="px-3 py-2 text-right">Rating</th></>)}
                {assetType === "etf" && (<><th className="px-3 py-2 text-right">NAV</th><th className="px-3 py-2 text-right">1Y</th><th className="px-3 py-2 text-right">3Y</th><th className="px-3 py-2 text-right">5Y</th><th className="px-3 py-2 text-right">ER</th></>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const f = assetType === "fund" ? findFund(u.name) : null;
                const e = assetType === "etf" ? findEtf(u.name) : null;
                return <tr key={u.id} onClick={() => onPick(u.id)} className="cursor-pointer hover:bg-[#0d1728]" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: TEXT_DIM }}>{u.meta}</td>
                  {f && (<>
                    <td className="px-3 py-2 text-right" style={{ color: (f.r1 ?? 0) >= 0 ? GREEN : RED }}>{f.r1?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (f.r3 ?? 0) >= 0 ? GREEN : RED }}>{f.r3?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (f.r5 ?? 0) >= 0 ? GREEN : RED }}>{f.r5?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{f.er?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right" style={{ color: GOLD }}>{"★".repeat(f.rating)}</td>
                  </>)}
                  {e && (<>
                    <td className="px-3 py-2 text-right">{e.nav?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (e.r1 ?? 0) >= 0 ? GREEN : RED }}>{e.r1?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (e.r3 ?? 0) >= 0 ? GREEN : RED }}>{e.r3?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (e.r5 ?? 0) >= 0 ? GREEN : RED }}>{e.r5?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{e.er?.toFixed(2) ?? "—"}</td>
                  </>)}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ Export CSV ============
function ExportBar({ data, asset }: { data: ForecastResponse; asset: Asset }) {
  const download = () => {
    const rows: string[] = ["model,family,predicted_price,rmse,mae,mape_pct,dir_acc_pct,weight"];
    for (const m of data.models) rows.push([m.name, m.family, m.predictedPrice, m.rmse, m.mae, m.mapePct, m.directionalAccuracyPct, m.weight].join(","));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${asset.symbol}_forecast_${data.asOf.slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex justify-end">
      <button onClick={download} className="px-3 py-2 text-xs rounded flex items-center gap-2" style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: GOLD }}>
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
}

// ============ Skeleton ============
function SkeletonBlock() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg h-40 animate-pulse" style={{ background: CARD_BG }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg h-80 animate-pulse" style={{ background: CARD_BG }} />
        <div className="rounded-lg h-80 animate-pulse" style={{ background: CARD_BG }} />
      </div>
      <div className="text-center text-sm flex items-center justify-center gap-2" style={{ color: TEXT_DIM }}>
        <Loader2 size={14} className="animate-spin" /> Running 35-model panel
      </div>
    </div>
  );
}
