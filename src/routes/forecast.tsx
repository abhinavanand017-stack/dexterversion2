import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";
import {
  MODEL_REGISTRY, FAMILY_LABEL, fetchForecast,
  type Family, type Horizon, type ForecastResponse, type ModelForecast,
} from "@/lib/forecast/workbench";
import { NIFTY500 } from "@/lib/nifty500";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "Forecast Workbench — Dexter" },
      { name: "description", content: "35-model signal engine with performance-adaptive ensemble weighting and calibrated uncertainty bands." },
    ],
  }),
  component: ForecastWorkbench,
});

const GOLD = "#D4AF37";
const NAVY_BG = "#0B1220";
const CARD_BG = "#111C33";
const BORDER = "#1e2a44";
const TEXT_DIM = "#8b9bb4";

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: "1d", label: "1-Day" }, { id: "5d", label: "5-Day" }, { id: "20d", label: "20-Day" },
];
const FAMILIES: Family[] = ["deep_learning", "ensemble_hybrid", "machine_learning", "statistical", "advanced_niche", "next_gen"];
const LS_KEY = "dx_forecast_workbench_prefs_v1";

interface Prefs { ticker: string; horizon: Horizon; models: string[] }

function loadPrefs(): Prefs {
  const def: Prefs = { ticker: "RELIANCE.NS", horizon: "5d", models: MODEL_REGISTRY.map((m) => m.name) };
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return { ticker: p.ticker || def.ticker, horizon: (p.horizon as Horizon) || def.horizon, models: Array.isArray(p.models) && p.models.length ? p.models : def.models };
  } catch { return def; }
}

function ForecastWorkbench() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const { ticker, horizon, models: selected } = prefs;

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);

  const mutation = useMutation({ mutationFn: (req: { ticker: string; horizon: Horizon; models: string[] }) => fetchForecast(req) });
  const data = mutation.data;

  const run = () => {
    if (!ticker.trim() || selected.length === 0) return;
    mutation.mutate({ ticker: ticker.trim().toUpperCase(), horizon, models: selected });
  };

  // auto-run once on first mount
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const toggleModel = (name: string) =>
    setPrefs((p) => ({ ...p, models: p.models.includes(name) ? p.models.filter((n) => n !== name) : [...p.models, name] }));
  const toggleFamily = (fam: Family) => {
    const famModels = MODEL_REGISTRY.filter((m) => m.family === fam).map((m) => m.name);
    const allOn = famModels.every((n) => selected.includes(n));
    setPrefs((p) => ({ ...p, models: allOn ? p.models.filter((n) => !famModels.includes(n)) : Array.from(new Set([...p.models, ...famModels])) }));
  };

  return (
    <div style={{ background: NAVY_BG, minHeight: "100vh", color: "#e6ecf5" }} className="tabular-nums">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Header */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider" style={{ color: GOLD, letterSpacing: 2 }}>Forecast Workbench</div>
              <h1 className="text-2xl md:text-3xl font-semibold mt-1">35-Model Signal Engine</h1>
              <p className="text-sm mt-1" style={{ color: TEXT_DIM }}>Performance-weighted consensus · Calibrated uncertainty bands · Walk-forward validated</p>
            </div>
            <TickerSearch value={ticker} onChange={(t) => setPrefs((p) => ({ ...p, ticker: t }))} />
            <div className="flex items-center gap-1 rounded-md p-1" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
              {HORIZONS.map((h) => {
                const active = horizon === h.id;
                return (
                  <button key={h.id} onClick={() => setPrefs((p) => ({ ...p, horizon: h.id }))}
                    className="px-3 py-1.5 text-sm rounded transition"
                    style={{ background: active ? GOLD : "transparent", color: active ? NAVY_BG : "#cbd5e1", fontWeight: active ? 600 : 500 }}>
                    {h.label}
                  </button>
                );
              })}
            </div>
            <button onClick={run} disabled={mutation.isPending || selected.length === 0}
              className="px-5 py-2.5 rounded font-semibold text-sm flex items-center gap-2 transition disabled:opacity-50"
              style={{ background: GOLD, color: NAVY_BG }}>
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              Run Forecast
            </button>
          </div>
        </div>

        {/* Family Tabs */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Model Selection <span style={{ color: TEXT_DIM }}>· {selected.length}/{MODEL_REGISTRY.length} active</span></div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setPrefs((p) => ({ ...p, models: MODEL_REGISTRY.map((m) => m.name) }))} style={{ color: GOLD }}>Select all</button>
              <span style={{ color: TEXT_DIM }}>·</span>
              <button onClick={() => setPrefs((p) => ({ ...p, models: [] }))} style={{ color: TEXT_DIM }}>Clear</button>
            </div>
          </div>
          <FamilyTabs selected={selected} onToggleModel={toggleModel} onToggleFamily={toggleFamily} />
        </div>

        {/* Demo Banner */}
        {data?.isDemo && (
          <div className="rounded-lg p-3 flex items-start gap-2 text-sm" style={{ background: "#3a2c0d", border: `1px solid ${GOLD}`, color: "#f5e5b8" }}>
            <AlertTriangle size={16} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Demo data</strong> — {data.demoReason} Set <code style={{ background: "#00000040", padding: "1px 5px", borderRadius: 3 }}>FORECAST_API_URL</code> to point <code>/api/forecast</code> at your Python forecasting service (FastAPI/Flask) to see live model output.
            </div>
          </div>
        )}

        {/* Results */}
        {mutation.isPending && <SkeletonBlock />}
        {!mutation.isPending && !data && <div className="text-center py-10" style={{ color: TEXT_DIM }}>Enter a ticker and click Run Forecast.</div>}
        {data && !mutation.isPending && <Results data={data} />}
      </div>
    </div>
  );
}

// ---------------- Ticker search ----------------
function TickerSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => setQ(value), [value]);
  const suggestions = useMemo(() => {
    if (!q || q.length < 1) return [];
    const s = q.toUpperCase();
    return NIFTY500.filter((n) => n.symbol.includes(s) || n.name.toUpperCase().includes(s)).slice(0, 8);
  }, [q]);
  return (
    <div className="relative min-w-[260px]">
      <div className="flex items-center rounded-md" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
        <Search size={15} style={{ color: TEXT_DIM, marginLeft: 10 }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { onChange(q.toUpperCase()); setOpen(false); } }}
          placeholder="e.g. RELIANCE.NS"
          className="flex-1 bg-transparent px-2 py-2 text-sm outline-none" style={{ color: "#e6ecf5" }} />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md z-20 max-h-64 overflow-auto" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          {suggestions.map((s) => (
            <button key={s.symbol} onMouseDown={() => { onChange(`${s.symbol}.NS`); setQ(`${s.symbol}.NS`); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-[#0d1728]">
              <div style={{ color: GOLD, fontWeight: 500 }}>{s.symbol}.NS</div>
              <div className="text-xs" style={{ color: TEXT_DIM }}>{s.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Family tabs (mobile-dropdown, desktop-grid) ----------------
function FamilyTabs({ selected, onToggleModel, onToggleFamily }: { selected: string[]; onToggleModel: (n: string) => void; onToggleFamily: (f: Family) => void }) {
  const [active, setActive] = useState<Family>("deep_learning");
  const famModels = MODEL_REGISTRY.filter((m) => m.family === active);
  return (
    <>
      {/* Desktop: horizontal tabs */}
      <div className="hidden md:flex gap-1 border-b mb-3 overflow-x-auto" style={{ borderColor: BORDER }}>
        {FAMILIES.map((f) => {
          const count = MODEL_REGISTRY.filter((m) => m.family === f && selected.includes(m.name)).length;
          const total = MODEL_REGISTRY.filter((m) => m.family === f).length;
          const isActive = active === f;
          return (
            <button key={f} onClick={() => setActive(f)}
              className="px-3 py-2 text-sm whitespace-nowrap transition"
              style={{ color: isActive ? GOLD : TEXT_DIM, borderBottom: `2px solid ${isActive ? GOLD : "transparent"}`, fontWeight: isActive ? 600 : 500 }}>
              {FAMILY_LABEL[f]} <span className="text-xs opacity-70">({count}/{total})</span>
            </button>
          );
        })}
      </div>
      {/* Mobile: select */}
      <div className="md:hidden mb-3">
        <select value={active} onChange={(e) => setActive(e.target.value as Family)}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{ background: "#0d1728", border: `1px solid ${BORDER}`, color: "#e6ecf5" }}>
          {FAMILIES.map((f) => <option key={f} value={f}>{FAMILY_LABEL[f]}</option>)}
        </select>
      </div>
      <div className="flex justify-between items-center mb-2">
        <button onClick={() => onToggleFamily(active)} className="text-xs" style={{ color: GOLD }}>
          Toggle all in {FAMILY_LABEL[active]}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {famModels.map((m) => {
          const on = selected.includes(m.name);
          return (
            <button key={m.name} onClick={() => onToggleModel(m.name)}
              className="px-3 py-2 text-xs rounded transition text-left"
              style={{ background: on ? "#1a2542" : "#0d1728", border: `1px solid ${on ? GOLD : BORDER}`, color: on ? "#e6ecf5" : TEXT_DIM }}>
              <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: on ? GOLD : "#3a4560" }} />
              {m.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Results ----------------
function Results({ data }: { data: ForecastResponse }) {
  return (
    <div className="space-y-5">
      <ConsensusCard data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><PriceChart data={data} /></div>
        <IntervalCoverageCard data={data} />
      </div>
      <Leaderboard models={data.models} />
      <BacktestPanel data={data} />
    </div>
  );
}

function ConsensusCard({ data }: { data: ForecastResponse }) {
  const c = data.consensus;
  const color = c.signal === "BUY" ? "#22c55e" : c.signal === "SELL" ? "#ef4444" : "#94a3b8";
  const Icon = c.signal === "BUY" ? TrendingUp : c.signal === "SELL" ? TrendingDown : Minus;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-lg flex flex-col items-center justify-center" style={{ background: `${color}22`, border: `2px solid ${color}` }}>
            <Icon size={28} color={color} />
            <div className="text-lg font-bold mt-1" style={{ color }}>{c.signal}</div>
          </div>
          <div>
            <div className="text-xs uppercase" style={{ color: TEXT_DIM, letterSpacing: 1.5 }}>Consensus · {data.ticker}</div>
            <div className="text-3xl font-semibold mt-1" style={{ color }}>
              ₹{c.predictedRange.low.toFixed(2)} – ₹{c.predictedRange.high.toFixed(2)}
            </div>
            <div className="text-sm mt-0.5" style={{ color: TEXT_DIM }}>Median target ₹{c.predictedRange.median.toFixed(2)} · 10th–90th percentile band</div>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 md:justify-end flex-wrap">
          <StatChip label="Confidence" value={`${c.confidencePct.toFixed(1)}%`} />
          <StatChip label="Models" value={`${data.models.length}`} />
          <RegimeChip regime={c.regime} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t text-sm" style={{ borderColor: BORDER, color: "#cbd5e1" }}>
        {c.reasoning}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-md" style={{ background: "#0d1728", border: `1px solid ${BORDER}` }}>
      <div className="text-xs" style={{ color: TEXT_DIM }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: GOLD }}>{value}</div>
    </div>
  );
}
function RegimeChip({ regime }: { regime: "LOW_VOLATILITY" | "HIGH_VOLATILITY" }) {
  const isHigh = regime === "HIGH_VOLATILITY";
  const color = isHigh ? "#f59e0b" : "#22c55e";
  return (
    <div className="px-3 py-2 rounded-md flex items-center gap-2" style={{ background: `${color}18`, border: `1px solid ${color}` }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <div>
        <div className="text-xs" style={{ color: TEXT_DIM }}>Regime (last 20d)</div>
        <div className="text-sm font-semibold" style={{ color }}>{isHigh ? "High Volatility" : "Low Volatility"}</div>
      </div>
    </div>
  );
}

function PriceChart({ data }: { data: ForecastResponse }) {
  const [overlayN, setOverlayN] = useState(0);
  const overlays = data.models.slice(0, overlayN);
  const chart = useMemo(() => {
    const hist = data.historical.slice(-90).map((h) => ({ date: h.date, actual: h.close, median: null as number | null, low: null as number | null, high: null as number | null }));
    const last = hist[hist.length - 1];
    const fc = data.forecastPath.map((f) => ({ date: f.date, actual: null as number | null, median: f.median, low: f.low, high: f.high }));
    if (last) fc.unshift({ date: last.date, actual: last.actual, median: last.actual, low: last.actual, high: last.actual });
    return [...hist, ...fc];
  }, [data]);
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium">Price Forecast</div>
          <div className="text-xs" style={{ color: TEXT_DIM }}>Historical close + forecast band</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: TEXT_DIM }}>Overlay models:</span>
          {[0, 2, 3].map((n) => (
            <button key={n} onClick={() => setOverlayN(n)} className="px-2 py-1 rounded" style={{ background: overlayN === n ? GOLD : "#0d1728", color: overlayN === n ? NAVY_BG : TEXT_DIM, border: `1px solid ${BORDER}` }}>{n === 0 ? "None" : n}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={340}>
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
          {overlays.map((m, i) => {
            const c = ["#60a5fa", "#c084fc", "#22d3ee"][i % 3];
            const last = data.historical[data.historical.length - 1];
            const overlayPath = [{ date: last.date, [m.name]: last.close }, { date: data.forecastPath[data.forecastPath.length - 1].date, [m.name]: m.predictedPrice }];
            return <Line key={m.name} data={overlayPath} type="linear" dataKey={m.name} stroke={c} strokeWidth={1.5} strokeDasharray="2 3" dot={{ fill: c, r: 3 }} isAnimationActive={false} />;
          })}
        </ComposedChart>
      </ResponsiveContainer>
      {overlayN > 0 && (
        <div className="flex gap-3 text-xs mt-2 flex-wrap">
          {overlays.map((m, i) => (
            <span key={m.name} style={{ color: ["#60a5fa", "#c084fc", "#22d3ee"][i % 3] }}>■ {m.name} → ₹{m.predictedPrice.toFixed(2)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function IntervalCoverageCard({ data }: { data: ForecastResponse }) {
  const gap = Math.abs(data.intervalCoverage.actualPct - data.intervalCoverage.targetPct);
  const wellCal = gap <= 5;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4 space-y-4">
      <div>
        <div className="text-sm font-medium">Interval Calibration</div>
        <div className="text-xs" style={{ color: TEXT_DIM }}>Are the confidence bands honest?</div>
      </div>
      <div>
        <div className="text-3xl font-semibold" style={{ color: wellCal ? "#22c55e" : "#f59e0b" }}>{data.intervalCoverage.actualPct.toFixed(1)}%</div>
        <div className="text-xs mt-1" style={{ color: TEXT_DIM }}>actual coverage over last 90 days · target {data.intervalCoverage.targetPct}%</div>
      </div>
      <div className="text-xs pt-3 border-t" style={{ borderColor: BORDER, color: TEXT_DIM }}>
        Validation method: <span style={{ color: "#cbd5e1" }}>walk-forward expanding window</span> — models are retrained on an expanding history and evaluated only on the held-out next window, not one static split.
      </div>
    </div>
  );
}

// ---------------- Leaderboard ----------------
type SortKey = "directionalAccuracyPct" | "rmse" | "mae" | "mapePct" | "weight" | "name";
function Leaderboard({ models }: { models: ModelForecast[] }) {
  const [sort, setSort] = useState<SortKey>("directionalAccuracyPct");
  const [asc, setAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = useMemo(() => {
    const arr = [...models];
    arr.sort((a, b) => {
      const av = a[sort] as number | string; const bv = b[sort] as number | string;
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [models, sort, asc]);

  const toggle = (k: SortKey) => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(false); } };

  const dirColor = (v: number) => v > 58 ? "#22c55e" : v >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Model Leaderboard <span style={{ color: TEXT_DIM }}>· {models.length} active</span></div>
        <div className="text-xs" style={{ color: TEXT_DIM }}>Click row to expand · Click column to sort</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }} className="text-xs uppercase tracking-wider">
              <Th label="Model" k="name" sort={sort} asc={asc} onClick={toggle} align="left" />
              <th className="px-3 py-2 text-left">Family</th>
              <Th label="RMSE" k="rmse" sort={sort} asc={asc} onClick={toggle} />
              <Th label="MAE" k="mae" sort={sort} asc={asc} onClick={toggle} />
              <Th label="MAPE %" k="mapePct" sort={sort} asc={asc} onClick={toggle} />
              <Th label="Dir. Acc. %" k="directionalAccuracyPct" sort={sort} asc={asc} onClick={toggle} />
              <Th label="Weight" k="weight" sort={sort} asc={asc} onClick={toggle} />
              <th className="px-3 py-2 text-right">Last BT</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <>
                <tr key={m.name} onClick={() => setExpanded(expanded === m.name ? null : m.name)}
                  className="cursor-pointer hover:bg-[#0d1728]" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td className="px-3 py-2.5 flex items-center gap-2">
                    {expanded === m.name ? <ChevronDown size={14} style={{ color: TEXT_DIM }} /> : <ChevronRight size={14} style={{ color: TEXT_DIM }} />}
                    <span style={{ color: "#e6ecf5" }}>{m.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: TEXT_DIM }}>{FAMILY_LABEL[m.family]}</td>
                  <td className="px-3 py-2.5 text-right">{m.rmse.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right">{m.mae.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right">{m.mapePct.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold" style={{ color: dirColor(m.directionalAccuracyPct) }}>{m.directionalAccuracyPct.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: m.weight > 0 ? GOLD : TEXT_DIM }}>{(m.weight * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ color: TEXT_DIM }}>{m.lastBacktestDate}</td>
                </tr>
                {expanded === m.name && (
                  <tr key={`${m.name}-exp`} style={{ background: "#0a1121" }}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="text-xs mb-2" style={{ color: TEXT_DIM }}>Last 30 predictions vs actual · Predicted target: <span style={{ color: GOLD }}>₹{m.predictedPrice.toFixed(2)}</span></div>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={m.recentPredictions}>
                          <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fill: TEXT_DIM, fontSize: 10 }} minTickGap={40} />
                          <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} domain={["auto", "auto"]} />
                          <Tooltip contentStyle={{ background: NAVY_BG, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }} />
                          <Line type="monotone" dataKey="actual" stroke={GOLD} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="predicted" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, k, sort, asc, onClick, align = "right" }: { label: string; k: SortKey; sort: SortKey; asc: boolean; onClick: (k: SortKey) => void; align?: "left" | "right" }) {
  const active = sort === k;
  return (
    <th onClick={() => onClick(k)} className={`px-3 py-2 cursor-pointer select-none ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: active ? GOLD : TEXT_DIM }}>
      {label}{active ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );
}

// ---------------- Backtest panel ----------------
function BacktestPanel({ data }: { data: ForecastResponse }) {
  const [open, setOpen] = useState(true);
  const recent = data.backtestHistory.slice(-20);
  const avg = recent.reduce((s, p) => s + p.rollingDirAccPct, 0) / (recent.length || 1);
  const regime = avg > 55 ? { label: "Working well", color: "#22c55e" } : avg >= 50 ? { label: "Mixed", color: "#f59e0b" } : { label: "Struggling", color: "#ef4444" };
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}` }} className="rounded-lg">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={16} style={{ color: TEXT_DIM }} /> : <ChevronRight size={16} style={{ color: TEXT_DIM }} />}
          <div className="text-sm font-medium">Backtest & Validation</div>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${regime.color}22`, color: regime.color }}>{regime.label} · {avg.toFixed(1)}% avg</span>
        </div>
        <div className="text-xs" style={{ color: TEXT_DIM }}>90-day rolling · 20-day window</div>
      </button>
      {open && (
        <div className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.backtestHistory}>
              <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: TEXT_DIM, fontSize: 10 }} minTickGap={30} />
              <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} domain={[30, 80]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ background: NAVY_BG, border: `1px solid ${BORDER}`, borderRadius: 6 }} />
              <Line type="monotone" dataKey="rollingDirAccPct" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 text-xs p-3 rounded" style={{ background: "#0d1728", color: TEXT_DIM, border: `1px solid ${BORDER}` }}>
            <strong style={{ color: "#cbd5e1" }}>Validation method:</strong> walk-forward expanding-window retrain-and-test. Results are computed on out-of-sample windows only; no single lucky train/test split.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Skeleton ----------------
function SkeletonBlock() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg h-40 animate-pulse" style={{ background: CARD_BG }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg h-80 animate-pulse" style={{ background: CARD_BG }} />
        <div className="rounded-lg h-80 animate-pulse" style={{ background: CARD_BG }} />
      </div>
      <div className="rounded-lg h-96 animate-pulse" style={{ background: CARD_BG }} />
      <div className="text-center text-sm flex items-center justify-center gap-2" style={{ color: TEXT_DIM }}>
        <Loader2 size={14} className="animate-spin" /> Running 35-model panel · this can take 10–60s with a live forecasting API
      </div>
    </div>
  );
}
