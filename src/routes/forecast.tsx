import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle, ChevronDown, ChevronRight, Info, Settings2, Clock, History } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, BarChart, Bar as RBar } from "recharts";
import { buildFeatures } from "@/lib/forecast/features";
import { runSelected, MODEL_SPECS, type ModelResult, type ModelSpec } from "@/lib/forecast/models";
import { computeConsensus, type Consensus } from "@/lib/forecast/consensus";
import { loadStock, loadFundNav } from "@/lib/forecast/data";
import type { Bar as PriceBar } from "@/lib/forecast/features";
import { runLongTermForecast, LONG_HORIZONS, cagrSourceLabel, type LongHorizon, type LongTermResult } from "@/lib/forecast/longterm";
import { StockCombobox, FundCombobox } from "@/components/AssetCombobox";
import { NIFTY500, type NiftyStock } from "@/lib/nifty500";
import { FUND_UNIVERSE, FUND_CATEGORY_LABELS, type CuratedFund } from "@/lib/fundUniverse";
import { INDICES, getIndex } from "@/lib/indices";
import { fetchYahooChart } from "@/lib/yahoo.functions";

export const Route = createFileRoute("/forecast")({
  validateSearch: (s: Record<string, unknown>) => ({
    index: typeof s.index === "string" ? s.index : undefined,
    tier: s.tier === "long" || s.tier === "short" ? s.tier : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dexter Forecaster — Short & Long-Term Multi-Model Engine" },
      { name: "description", content: "Tactical 1–90 day forecasts plus CAGR + Monte Carlo long-term projections for Indian stocks, funds, and indices." },
    ],
  }),
  component: ForecastPage,
});

type Mode = "stock" | "fund" | "index";
type Tier = "short" | "long";

const SHORT_HORIZONS = [7, 15, 30, 60, 90];
const LOOKBACKS = [
  { id: "6m", label: "6 months", days: 130 },
  { id: "1y", label: "1 year", days: 252 },
  { id: "3y", label: "3 years", days: 756 },
  { id: "5y", label: "5 years", days: 1260 },
];
const CONFIDENCE_BANDS = [80, 90, 95] as const;

// Short-term-only models — disabled in long-term mode (multi-year forecasts).
const SHORT_TERM_ONLY = new Set(["svr", "knn", "cnn1d", "wavenet", "transformer"]);
const LONG_PRESET = ["arima", "prophet", "ensemble", "mc"];

const PRESET_RECOMMENDED = MODEL_SPECS.filter((s) => s.recommended).map((s) => s.id);
const PRESET_ALL = MODEL_SPECS.map((s) => s.id);

const GROUPS: Array<ModelSpec["groupLabel"]> = [
  "Classic statistical", "Machine learning", "Deep learning", "Ensemble & simulation",
];

const MODEL_COLORS = [
  "#00ff88", "#00d4ff", "#ffaa00", "#ff44aa", "#a78bfa",
  "#22c55e", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6",
  "#10b981", "#3b82f6", "#eab308", "#ec4899", "#14b8a6",
  "#f97316", "#6366f1",
];
const colorFor = (id: string) => MODEL_COLORS[MODEL_SPECS.findIndex((s) => s.id === id) % MODEL_COLORS.length];

const SIGNAL_COLORS: Record<string, { bg: string; bd: string; tx: string; glow?: string }> = {
  "STRONG BUY": { bg: "#00ff8840", bd: "#00ff88", tx: "#00ff88", glow: "0 0 14px #00ff8880" },
  "BUY":        { bg: "#00ff8820", bd: "#00ff88", tx: "#00ff88" },
  "HOLD":       { bg: "#ffaa0020", bd: "#ffaa00", tx: "#ffaa00" },
  "SELL":       { bg: "#ff446620", bd: "#ff4466", tx: "#ff4466" },
  "STRONG SELL":{ bg: "#ff446640", bd: "#ff4466", tx: "#ff4466", glow: "0 0 14px #ff446680" },
};

function SignalBadge({ label, large }: { label: string; large?: boolean }) {
  const c = SIGNAL_COLORS[label] || SIGNAL_COLORS["HOLD"];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-semibold tracking-wider ${large ? "px-4 py-2 text-base" : "px-2 py-0.5 text-[10px]"}`}
      style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.tx, boxShadow: c.glow }}
    >
      {label.includes("BUY") ? <TrendingUp className="w-3.5 h-3.5" /> : label.includes("SELL") ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}

function fmtPrice(v: number, currency = "₹"): string {
  if (!Number.isFinite(v)) return "—";
  return `${currency}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function ForecastPage() {
  const search = Route.useSearch();
  const [tier, setTier] = useState<Tier>(() => (search.tier === "long" ? "long" : "short"));
  const [longHorizon, setLongHorizon] = useState<LongHorizon>("1y");
  const [longResult, setLongResult] = useState<LongTermResult | null>(null);
  const [rebase, setRebase] = useState(false);                 // Rebase to ₹1,00,000
  const [cagrAdjust, setCagrAdjust] = useState(0);             // %-point nudge to historical CAGR

  const [mode, setMode] = useState<Mode>(() => (search.index ? "index" : "stock"));
  const [query, setQuery] = useState(search.index ? (getIndex(search.index)?.yahooSymbol ?? "RELIANCE") : "RELIANCE");
  const [horizon, setHorizon] = useState(30);
  const [customHorizon, setCustomHorizon] = useState("");
  const [lookback, setLookback] = useState("1y");
  const [confidenceBand, setConfidenceBand] = useState<typeof CONFIDENCE_BANDS[number]>(90);
  const [mcPaths, setMcPaths] = useState(2000);
  const [sensitivity, setSensitivity] = useState(50); // 0-100
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [preset, setPreset] = useState<"recommended" | "all" | "custom">("recommended");
  const [selected, setSelected] = useState<Set<string>>(new Set(PRESET_RECOMMENDED));

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string }>({ done: 0, total: 0 });
  const [bars, setBars] = useState<PriceBar[]>([]);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [hiddenInChart, setHiddenInChart] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ name: string; exchange: string; currency: string }>({ name: "", exchange: "NSE", currency: "₹" });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"price" | "perf" | "mc" | "ind">("price");

  const [pickedStock, setPickedStock] = useState<NiftyStock | null>(() => NIFTY500.find((s) => s.symbol === "RELIANCE") ?? null);
  const [pickedFund, setPickedFund] = useState<CuratedFund | null>(null);
  const [pickedIndex, setPickedIndex] = useState<string | null>(() => search.index && getIndex(search.index) ? search.index : null);
  const [uiMode, setUiMode] = useState<"simple" | "advanced">(() => {
    try { return (localStorage.getItem("dx_forecast_ui") as "simple" | "advanced") || "simple"; } catch { return "simple"; }
  });
  useEffect(() => { try { localStorage.setItem("dx_forecast_ui", uiMode); } catch { /* noop */ } }, [uiMode]);

  const applyPreset = (p: "recommended" | "all" | "custom") => {
    setPreset(p);
    if (p === "recommended") setSelected(new Set(PRESET_RECOMMENDED));
    else if (p === "all") setSelected(new Set(PRESET_ALL));
  };

  const toggleModel = (id: string) => {
    setPreset("custom");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const effectiveHorizon = useMemo(() => {
    const c = Number(customHorizon);
    if (Number.isFinite(c) && c >= 1 && c <= 365) return Math.round(c);
    return horizon;
  }, [customHorizon, horizon]);

  // Switching to long-term auto-prunes models that are meaningless multi-year.
  useEffect(() => {
    if (tier === "long") {
      setSelected((prev) => {
        const next = new Set(Array.from(prev).filter((id) => !SHORT_TERM_ONLY.has(id)));
        if (next.size === 0) LONG_PRESET.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [tier]);

  async function loadPriceSeries(): Promise<{ bars: PriceBar[]; metaOut: typeof meta }> {
    if (mode === "index") {
      const idx = pickedIndex ? getIndex(pickedIndex) : null;
      if (!idx) throw new Error("Pick an index from the dropdown");
      // Long horizons want at least 5-10y of data so MC vol & CAGR are stable
      const range = tier === "long" ? "10y" : "2y";
      const r = await fetchYahooChart({ data: { symbol: idx.yahooSymbol, range, interval: "1d" } });
      if (!r.ok || !r.bars.length) throw new Error(r.error || "No data for this index");
      return { bars: r.bars.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })), metaOut: { name: idx.name, exchange: idx.exchange, currency: "₹" } };
    }
    if (mode === "stock") {
      const r = await loadStock(query, "NS");
      return { bars: r, metaOut: { name: query.toUpperCase(), exchange: "NSE", currency: "₹" } };
    }
    const code = Number(query);
    if (!Number.isFinite(code)) throw new Error("Pick a fund from the dropdown");
    const r = await loadFundNav(code);
    return { bars: r.bars, metaOut: { name: r.meta?.scheme_name || `Scheme ${code}`, exchange: r.meta?.fund_house || "MF", currency: "₹" } };
  }

  const handleSearch = async () => {
    if (selected.size === 0) {
      setError("Pick at least one model.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setLongResult(null);
    setHiddenInChart(new Set());
    setProgress({ done: 0, total: selected.size });
    try {
      const { bars: priceBars, metaOut } = await loadPriceSeries();
      setMeta(metaOut);
      const lb = LOOKBACKS.find((l) => l.id === lookback)?.days ?? 252;
      const trimmed = priceBars.slice(Math.max(0, priceBars.length - lb));
      setBars(trimmed);
      const rows = buildFeatures(trimmed);
      const collected: ModelResult[] = [];
      const ids = Array.from(selected).filter((id) => !SHORT_TERM_ONLY.has(id) || tier === "short");
      await runSelected(rows, effectiveHorizon, ids, (res, p) => {
        collected.push(res);
        setResults([...collected]);
        setProgress(p);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const handleLongRun = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setLongResult(null);
    try {
      const { bars: priceBars, metaOut } = await loadPriceSeries();
      setMeta(metaOut);
      setBars(priceBars);
      const fundCagr = mode === "fund" && pickedFund ? undefined : undefined; // VR enrichment not yet wired into CuratedFund
      const res = runLongTermForecast({
        bars: priceBars,
        horizon: longHorizon,
        confidence: confidenceBand,
        mcPaths,
        cagrOverride: cagrAdjust || null,
        fundCagr,
      });
      setLongResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const runForTier = () => (tier === "long" ? handleLongRun() : handleSearch());

  // sync `query` with picked asset so handleSearch + meta keep working
  useEffect(() => {
    if (mode === "stock" && pickedStock) setQuery(pickedStock.symbol);
    else if (mode === "fund" && pickedFund) setQuery(String(pickedFund.code));
    else if (mode === "index" && pickedIndex) {
      const idx = getIndex(pickedIndex);
      if (idx) setQuery(idx.yahooSymbol);
    }
  }, [mode, pickedStock, pickedFund, pickedIndex]);

  // Simple mode → bundle of curated model ids
  const SIMPLE_BUNDLES: Record<string, string[]> = {
    trend: ["arima", "linreg", "ensemble"],
    pattern: ["lstm", "gru", "prophet"],
    range: ["mc", "ensemble"],
  };
  const applySimpleBundle = (key: keyof typeof SIMPLE_BUNDLES) => {
    const ids = SIMPLE_BUNDLES[key].filter((id) => MODEL_SPECS.some((m) => m.id === id));
    setSelected(new Set(ids));
    setPreset("custom");
  };

  const currentPrice = bars.length ? bars[bars.length - 1].c : 0;
  const consensus: Consensus | null = results.length ? computeConsensus(results, currentPrice) : null;
  const lastFeature = bars.length ? buildFeatures(bars).slice(-1)[0] : null;

  // Confidence band: derive a z-multiplier (assume forecast spread ≈ ±1σ).
  const zMult = confidenceBand === 80 ? 1.28 : confidenceBand === 90 ? 1.645 : 1.96;

  const chartData = useMemo(() => {
    if (!bars.length) return [];
    const tailBars = bars.slice(-180);
    const base = tailBars.map((b) => {
      const row: Record<string, number | null> = { t: b.t, price: b.c };
      results.forEach((r) => { row[r.id] = null; });
      row.consensus = null;
      row.bandLow = null;
      row.bandHigh = null;
      return row;
    });
    if (results.length) {
      const lastT = bars[bars.length - 1].t;
      const visible = results.filter((r) => !hiddenInChart.has(r.id));
      for (let h = 1; h <= effectiveHorizon; h++) {
        const row: Record<string, number | null> = { t: lastT + h * 86400000, price: null };
        results.forEach((r) => { row[r.id] = hiddenInChart.has(r.id) ? null : (r.forecast[h - 1] ?? null); });
        if (visible.length) {
          const vals = visible.map((r) => r.forecast[h - 1]).filter((v): v is number => Number.isFinite(v));
          if (vals.length) {
            const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
            const sd = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / Math.max(1, vals.length - 1));
            row.consensus = avg;
            row.bandLow = avg - zMult * sd;
            row.bandHigh = avg + zMult * sd;
          }
        }
        base.push(row);
      }
    }
    return base;
  }, [bars, results, effectiveHorizon, hiddenInChart, zMult]);

  const mc = results.find((r) => r.id === "mc");
  const mcData = useMemo(() => {
    if (!mc?.fanLow || !mc.fanHigh) return [];
    return mc.forecast.map((p, i) => ({
      day: i + 1,
      median: p,
      low: mc.fanLow![i],
      high: mc.fanHigh![i],
    }));
  }, [mc]);

  const perfData = useMemo(() => results.slice().sort((a, b) => a.rmse - b.rmse).map((r) => ({
    name: r.name.split(" ")[0],
    rmse: Number(r.rmse.toFixed(2)),
  })), [results]);

  // Plain-language agreement summary
  const agreement = useMemo(() => {
    if (!results.length) return null;
    const up = results.filter((r) => r.expectedReturn > 0).length;
    const down = results.filter((r) => r.expectedReturn < 0).length;
    const flat = results.length - up - down;
    const majority = Math.max(up, down, flat);
    const direction = majority === up ? "upward" : majority === down ? "downward" : "sideways";
    return { up, down, flat, total: results.length, direction, majority };
  }, [results]);

  const risks = useMemo(() => {
    const list: string[] = [];
    if (!lastFeature || !consensus) return list;
    if (lastFeature.rsi14 > 75) list.push("Highly overbought (RSI > 75) — potential reversal risk");
    if (lastFeature.c > lastFeature.bbUpper * 1.1) list.push("Extreme price extension above Bollinger band");
    if (consensus.agreement < 0.5) list.push("High model disagreement — signal unreliable");
    if (mc?.extra && typeof mc.extra.sigmaAnnual === "number" && (mc.extra.sigmaAnnual as number) > 40)
      list.push(`High annualised volatility (${(mc.extra.sigmaAnnual as number).toFixed(0)}%) — wide forecast range`);
    const best = results.slice().sort((a, b) => a.mape - b.mape)[0];
    if (best && best.mape > 15) list.push(`Best-model MAPE ${best.mape.toFixed(1)}% — low historical accuracy`);
    return list;
  }, [lastFeature, consensus, mc, results]);

  const nuances = useMemo(() => {
    if (!lastFeature) return [];
    const list: string[] = [];
    const rsiTxt = lastFeature.rsi14 > 70 ? "Overbought" : lastFeature.rsi14 < 30 ? "Oversold" : "Neutral";
    list.push(`RSI at ${lastFeature.rsi14.toFixed(1)} — ${rsiTxt}`);
    list.push(`MACD ${lastFeature.macd > lastFeature.macdSignal ? "above" : "below"} signal line — ${lastFeature.macd > lastFeature.macdSignal ? "Bullish" : "Bearish"} momentum`);
    list.push(`Trading ${lastFeature.c > lastFeature.sma50 ? "above" : "below"} 50-day SMA — ${lastFeature.c > lastFeature.sma50 ? "Uptrend" : "Downtrend"}`);
    if (mc?.extra && typeof mc.extra.probPositive === "number") {
      list.push(`Monte Carlo: ${((mc.extra.probPositive as number) * 100).toFixed(0)}% probability of positive return over ${effectiveHorizon} days`);
    }
    return list;
  }, [lastFeature, mc, effectiveHorizon]);

  return (
    <div className="space-y-5 dx-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dexter Forecaster</h1>
        <p className="text-sm text-muted-foreground">
          Live price data from a layered backend service (Yahoo → Marketstack fallback). Pick which models to run and how aggressively to fit.
        </p>
      </header>

      {/* Asset picker — combobox flow */}
      <div className="dx-glass p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setMode("stock")} data-active={mode === "stock"}
            className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">📈 Stock</button>
          <button onClick={() => setMode("fund")} data-active={mode === "fund"}
            className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">💰 Mutual Fund</button>
          <button onClick={() => setMode("index")} data-active={mode === "index"}
            className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">📊 Index</button>
          <div className="ml-auto flex gap-1 items-center">
            <span className="text-[10px] text-muted-foreground">Mode</span>
            {(["simple", "advanced"] as const).map((m) => (
              <button key={m} onClick={() => setUiMode(m)} data-active={uiMode === m}
                className="px-2 py-1 text-[11px] rounded border border-border data-[active=true]:bg-accent data-[active=true]:text-accent-foreground capitalize">{m}</button>
            ))}
          </div>
        </div>

        {mode === "stock" && <StockCombobox value={pickedStock} onChange={(s) => { setPickedStock(s); setQuery(s.symbol); }} />}
        {mode === "fund"  && <FundCombobox  value={pickedFund}  onChange={(f) => { setPickedFund(f);  setQuery(String(f.code)); }} />}
        {mode === "index" && (
          <select
            value={pickedIndex ?? ""}
            onChange={(e) => { setPickedIndex(e.target.value); const idx = getIndex(e.target.value); if (idx) setQuery(idx.yahooSymbol); }}
            className="w-full px-3 py-2 text-sm rounded border border-border bg-background/40 font-mono"
          >
            <option value="">— Pick an NSE/BSE index —</option>
            {(["broad","sectoral","strategy"] as const).map((g) => (
              <optgroup key={g} label={g === "broad" ? "Broad Market" : g === "sectoral" ? "Sectoral" : "Volatility & Strategy"}>
                {INDICES.filter((i) => i.group === g).map((i) => (
                  <option key={i.key} value={i.key}>{i.name} ({i.exchange})</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        {/* Asset context card */}
        {mode === "stock" && pickedStock && (
          <div className="rounded border border-border bg-background/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div><div className="text-[10px] uppercase text-muted-foreground">Symbol</div><div className="font-mono font-semibold">{pickedStock.symbol}</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground">Sector</div><div>{pickedStock.sector}</div></div>
            <div className="col-span-2 sm:col-span-2"><div className="text-[10px] uppercase text-muted-foreground">Company</div><div className="truncate">{pickedStock.name}</div></div>
          </div>
        )}
        {mode === "fund" && pickedFund && (
          <div className="rounded border border-border bg-background/30 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="col-span-2"><div className="text-[10px] uppercase text-muted-foreground">Fund</div><div className="truncate">{pickedFund.name}</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground">House</div><div>{pickedFund.house}</div></div>
            <div className="col-span-2 sm:col-span-3"><div className="text-[10px] uppercase text-muted-foreground">Category</div><div>{FUND_CATEGORY_LABELS[pickedFund.category] || pickedFund.category}</div></div>
          </div>
        )}

        {/* Horizon Tier toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Horizon tier:</span>
          {(["short","long"] as const).map((t) => (
            <button key={t} onClick={() => setTier(t)} data-active={tier === t}
              className="px-3 py-1 text-xs rounded-full border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">
              {t === "short" ? "Short-Term (1–90d)" : "Long-Term (6M–10Y)"}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">
            {tier === "short" ? "Tactical pattern detection — 17 models" : "Structural projection — CAGR + Monte Carlo"}
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-2 flex-wrap items-stretch">
          <div className="flex gap-1 flex-wrap">
            {tier === "short"
              ? SHORT_HORIZONS.map((h) => (
                  <button key={h} onClick={() => { setHorizon(h); setCustomHorizon(""); }} data-active={horizon === h && !customHorizon}
                    className="px-3 py-2 text-xs rounded border border-border data-[active=true]:bg-accent data-[active=true]:text-accent-foreground">{h}d</button>
                ))
              : LONG_HORIZONS.map((h) => (
                  <button key={h.id} onClick={() => setLongHorizon(h.id)} data-active={longHorizon === h.id}
                    className="px-3 py-2 text-xs rounded border border-border data-[active=true]:bg-accent data-[active=true]:text-accent-foreground">{h.label}</button>
                ))}
          </div>
          <button
            onClick={runForTier}
            disabled={loading || (mode === "stock" ? !pickedStock : mode === "fund" ? !pickedFund : !pickedIndex)}
            className="ml-auto px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading
              ? (tier === "short" ? `Running ${progress.done}/${progress.total}…` : "Simulating paths…")
              : tier === "short"
                ? `Run ${selected.size} model${selected.size === 1 ? "" : "s"}`
                : `Run Long-Term Forecast`}
          </button>
        </div>

        {tier === "long" && (
          <div className="rounded border border-border bg-background/30 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-muted-foreground">CAGR adjustment: <span className="font-mono">{cagrAdjust >= 0 ? "+" : ""}{cagrAdjust}%</span></label>
              <input type="range" min={-10} max={10} step={0.5} value={cagrAdjust}
                onChange={(e) => setCagrAdjust(Number(e.target.value))} className="w-full" />
              <div className="text-[10px] text-muted-foreground">Nudge the historical baseline up or down.</div>
            </div>
            <div className="flex items-center gap-2">
              <input id="rebase" type="checkbox" checked={rebase} onChange={(e) => setRebase(e.target.checked)} />
              <label htmlFor="rebase" className="cursor-pointer">Rebase to ₹1,00,000 (growth-of-lakh view)</label>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" /> Long-horizon mode uses CAGR extrapolation + Monte Carlo simulation. Short-term-only ML models are disabled.
            </div>
          </div>
        )}

        {/* Simple mode bundles */}
        {uiMode === "simple" && (
          <div className="grid sm:grid-cols-3 gap-2 pt-1">
            <BundleCard emoji="📈" title="Trend" desc="Detects direction with ARIMA + Linear Regression + Ensemble." onClick={() => applySimpleBundle("trend")} />
            <BundleCard emoji="🔄" title="Pattern Recognition" desc="Neural nets (LSTM + GRU) plus Prophet for seasonality." onClick={() => applySimpleBundle("pattern")} />
            <BundleCard emoji="🎲" title="Range of Outcomes" desc="Monte Carlo simulation + ensemble — best/worst-case bands." onClick={() => applySimpleBundle("range")} />
          </div>
        )}

        {/* Preset chips — only visible in advanced mode */}
        {uiMode === "advanced" && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Settings2 className="h-3 w-3" /> Preset:</span>
            {(["recommended", "all", "custom"] as const).map((p) => (
              <button key={p} onClick={() => applyPreset(p)} data-active={preset === p}
                className="px-3 py-1 text-xs rounded-full border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground capitalize">
                {p === "all" ? "All 17" : p}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground font-mono">{selected.size} / {MODEL_SPECS.length} selected</span>
          </div>
        )}
        {/* Model picker grouped — Advanced only */}
        {uiMode === "advanced" && (
          <div className="space-y-2">
            {GROUPS.map((g) => {
              const models = MODEL_SPECS.filter((m) => m.groupLabel === g);
              return (
                <div key={g}>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {models.map((m) => {
                      const on = selected.has(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleModel(m.id)} title={m.tooltip}
                          className="px-2.5 py-1 text-xs rounded border font-mono"
                          style={{
                            borderColor: on ? colorFor(m.id) : "rgba(255,255,255,0.1)",
                            background: on ? `${colorFor(m.id)}20` : "transparent",
                            color: on ? colorFor(m.id) : "#94a3b8",
                          }}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Advanced settings */}
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Advanced settings
        </button>
        {advancedOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 rounded border border-border bg-background/30">
            <div>
              <label className="text-[11px] text-muted-foreground flex items-center gap-1">Lookback window <Info className="w-3 h-3" /></label>
              <div className="flex flex-wrap gap-1 mt-1">
                {LOOKBACKS.map((l) => (
                  <button key={l.id} onClick={() => setLookback(l.id)} data-active={lookback === l.id}
                    className="px-2 py-1 text-xs rounded border border-border data-[active=true]:bg-accent data-[active=true]:text-accent-foreground">
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Custom horizon (days)</label>
              <input type="number" min={1} max={365} value={customHorizon} onChange={(e) => setCustomHorizon(e.target.value)}
                placeholder={`${horizon}`}
                className="mt-1 w-full px-2 py-1 text-xs font-mono bg-background/40 border border-border rounded outline-none" />
              <div className="text-[10px] text-muted-foreground mt-1">Currently using: {effectiveHorizon}d</div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Confidence band</label>
              <div className="flex gap-1 mt-1">
                {CONFIDENCE_BANDS.map((b) => (
                  <button key={b} onClick={() => setConfidenceBand(b)} data-active={confidenceBand === b}
                    className="px-2 py-1 text-xs rounded border border-border data-[active=true]:bg-accent data-[active=true]:text-accent-foreground">
                    {b}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Monte Carlo paths: <span className="font-mono">{mcPaths}</span></label>
              <input type="range" min={500} max={10000} step={500} value={mcPaths}
                onChange={(e) => setMcPaths(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Model sensitivity: <span className="font-mono">{sensitivity}</span></label>
              <input type="range" min={0} max={100} value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))} className="w-full" />
              <div className="text-[10px] text-muted-foreground">Higher = more reactive to recent data</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-xs text-muted-foreground font-mono">
            Running {progress.done} of {progress.total} selected models · {progress.current || "preparing"}…
            <div className="mt-1 h-1 bg-muted rounded">
              <div className="h-full bg-primary rounded transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        {error && <div className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}
      </div>

      {/* Hero consensus */}
      {consensus && agreement && (
        <div className="dx-glass p-5 grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-mono">{meta.exchange}</div>
            <div className="text-2xl font-semibold truncate">{meta.name}</div>
            <div className="text-3xl font-mono mt-2">{fmtPrice(currentPrice, meta.currency)}</div>
            <div className="text-xs text-muted-foreground mt-1">Forecast horizon: {effectiveHorizon} days</div>
          </div>
          <div className="flex flex-col items-center justify-center gap-3">
            <SignalBadge label={consensus.label} large />
            <div className="text-xs text-muted-foreground">
              Confidence <span className="font-mono text-foreground">{consensus.confidence.toFixed(0)}%</span>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              <span className="font-mono text-foreground">{agreement.majority} of {agreement.total}</span> models agree on a <span className="font-semibold" style={{ color: agreement.direction === "upward" ? "#00ff88" : agreement.direction === "downward" ? "#ff4466" : "#ffaa00" }}>{agreement.direction}</span> trend over {effectiveHorizon}d
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Target range ({effectiveHorizon}d, {confidenceBand}% band)</div>
            <div className="text-lg font-mono">
              {fmtPrice(consensus.targetLow, meta.currency)} — {fmtPrice(consensus.targetHigh, meta.currency)}
            </div>
            <div className="text-xs text-muted-foreground">Weighted return {consensus.score.toFixed(2)}%</div>
            <div className="text-[10px] text-muted-foreground">
              Signal based on: {results.map((r) => r.name).join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* Model grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((r) => (
            <ModelCard key={r.id} r={r} currency={meta.currency} />
          ))}
        </div>
      )}

      {/* Charts */}
      {results.length > 0 && (
        <div className="dx-glass p-4">
          <div className="flex gap-2 mb-3 flex-wrap">
            {([["price","Price Forecast"],["perf","Model Performance"],["mc","Monte Carlo Fan"],["ind","Indicator Dashboard"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} data-active={tab === k}
                className="px-3 py-1.5 text-xs rounded border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">
                {label}
              </button>
            ))}
          </div>

          {tab === "price" && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {results.map((r) => {
                  const hidden = hiddenInChart.has(r.id);
                  return (
                    <button key={r.id} onClick={() => {
                      setHiddenInChart((prev) => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; });
                    }}
                      className="px-2 py-0.5 text-[10px] rounded border font-mono"
                      style={{ borderColor: colorFor(r.id), color: hidden ? "#475569" : colorFor(r.id), background: hidden ? "transparent" : `${colorFor(r.id)}15`, textDecoration: hidden ? "line-through" : "none" }}>
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ width: "100%", height: 360 }}>
            {tab === "price" && (
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)" }} labelFormatter={(t) => new Date(t as number).toLocaleDateString("en-IN")} />
                  <ReferenceLine y={currentPrice} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Area dataKey="bandHigh" stroke="none" fill="rgba(0,255,136,0.12)" isAnimationActive={false} />
                  <Area dataKey="bandLow" stroke="none" fill="#060810" isAnimationActive={false} />
                  <Line dataKey="price" stroke="#00d4ff" strokeWidth={2} dot={false} isAnimationActive={false} name="History" />
                  {results.map((r) => (
                    <Line key={r.id} dataKey={r.id} stroke={colorFor(r.id)} strokeWidth={1.2} dot={false} isAnimationActive={false}
                      hide={hiddenInChart.has(r.id)} />
                  ))}
                  <Line dataKey="consensus" stroke="#00ff88" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Consensus" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {tab === "perf" && (
              <ResponsiveContainer>
                <BarChart data={perfData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)" }} />
                  <RBar dataKey="rmse" fill="#00d4ff" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {tab === "mc" && mcData.length > 0 && (
              <ResponsiveContainer>
                <ComposedChart data={mcData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)" }} />
                  <Area dataKey="high" stroke="none" fill="rgba(0,212,255,0.2)" />
                  <Area dataKey="low" stroke="none" fill="#060810" />
                  <Line dataKey="median" stroke="#00ff88" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {tab === "ind" && lastFeature && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 h-full">
                <Gauge label="RSI 14" value={lastFeature.rsi14} max={100} />
                <Gauge label="MACD" value={lastFeature.macd} signed />
                <Gauge label="BB position" value={((lastFeature.c - lastFeature.bbLower) / Math.max(lastFeature.bbWidth, 1e-6)) * 100} max={100} suffix="%" />
                <Gauge label="ATR 14" value={lastFeature.atr14} />
                <Gauge label="Volume Δ" value={lastFeature.volChange * 100} signed suffix="%" />
                <Gauge label="vs SMA50" value={((lastFeature.c - lastFeature.sma50) / lastFeature.sma50) * 100} signed suffix="%" />
              </div>
            )}
          </div>
        </div>
      )}

      {nuances.length > 0 && (
        <div className="dx-glass p-4">
          <h3 className="font-semibold mb-2">Key nuances</h3>
          <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
            {nuances.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {risks.length > 0 && (
        <div className="p-4 rounded border" style={{ borderColor: "#ff4466", background: "rgba(255,68,102,0.08)" }}>
          <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "#ff4466" }}>
            <AlertTriangle className="w-4 h-4" /> Risk flags
          </h3>
          <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: "#ffaaaa" }}>
            {risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Plain-language summary */}
      {results.length > 0 && consensus && agreement && (
        <div className="dx-glass p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">In plain English</div>
          <p className="text-sm leading-relaxed">
            Based on the {results.length} model{results.length === 1 ? "" : "s"} you ran, <span className="font-semibold">{meta.name}</span> is projected to move <span className="font-mono font-semibold" style={{ color: consensus.score >= 0 ? "#00ff88" : "#ff4466" }}>{consensus.score >= 0 ? "+" : ""}{consensus.score.toFixed(2)}%</span> over the next {effectiveHorizon} days.{" "}
            <span className="font-mono">{agreement.majority} of {agreement.total}</span> models agree on a <span className="font-semibold">{agreement.direction}</span> direction; confidence is <span className="font-semibold">{consensus.confidence >= 70 ? "high" : consensus.confidence >= 45 ? "moderate" : "low"}</span> based on model agreement.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
        Dexter's algorithmic signal is for informational purposes only. Not SEBI-registered investment
        advice. Past model accuracy does not guarantee future performance. Always consult a SEBI-registered
        advisor before investing.
      </p>
    </div>
  );
}

function ModelCard({ r, currency }: { r: ModelResult; currency: string }) {
  const c = SIGNAL_COLORS[r.signal] || SIGNAL_COLORS.HOLD;
  const sparkPath = useMemo(() => {
    if (!r.forecast.length) return "";
    const w = 120; const h = 32;
    const min = Math.min(...r.forecast); const max = Math.max(...r.forecast);
    const range = max - min || 1;
    return r.forecast.map((v, i) => {
      const x = (i / (r.forecast.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [r.forecast]);
  return (
    <div className="p-3 rounded-lg border" style={{ borderColor: "rgba(0,212,255,0.15)", background: "#0d1117" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{r.name}</div>
          <div className="text-[10px] text-muted-foreground font-mono uppercase">{r.category}</div>
        </div>
        <SignalBadge label={r.signal} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="text-lg font-mono">{fmtPrice(r.forecast[r.forecast.length - 1] ?? 0, currency)}</div>
          <div className="text-xs font-mono" style={{ color: r.expectedReturn >= 0 ? "#00ff88" : "#ff4466" }}>
            {r.expectedReturn >= 0 ? "+" : ""}{r.expectedReturn.toFixed(2)}%
          </div>
        </div>
        <svg width={120} height={32}>
          <path d={sparkPath} fill="none" stroke={c.tx} strokeWidth={1.5} />
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>RMSE {r.rmse.toFixed(2)}</span>
        <span>MAPE {r.mape.toFixed(1)}%</span>
        <span>Conf {r.confidence.toFixed(0)}%</span>
      </div>
      {r.note && <div className="mt-1 text-[10px] text-amber-400/70">{r.note}</div>}
    </div>
  );
}

function Gauge({ label, value, max, signed, suffix }: { label: string; value: number; max?: number; signed?: boolean; suffix?: string }) {
  const v = Number.isFinite(value) ? value : 0;
  const pct = max ? Math.max(0, Math.min(100, (v / max) * 100)) : signed ? 50 + Math.max(-50, Math.min(50, v / 2)) : 50;
  const color = signed ? (v >= 0 ? "#00ff88" : "#ff4466") : pct > 70 ? "#ff4466" : pct < 30 ? "#00ff88" : "#ffaa00";
  return (
    <div className="p-3 rounded border border-border bg-background/40 flex flex-col justify-between">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-mono">{v.toFixed(2)}{suffix || ""}</div>
      <div className="h-1.5 bg-muted rounded mt-2"><div className="h-full rounded" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

function BundleCard({ emoji, title, desc, onClick }: { emoji: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-lg border border-border bg-background/40 hover:bg-card/60 hover:border-primary/40 transition p-3">
      <div className="text-2xl">{emoji}</div>
      <div className="font-semibold text-sm mt-1">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
    </button>
  );
}
