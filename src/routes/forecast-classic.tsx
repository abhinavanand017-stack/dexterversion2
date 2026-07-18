import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle, ChevronDown, ChevronRight, Info, Settings2, Clock, History, Activity, Sparkles } from "lucide-react";
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
import { runDeepResearch, type DeepResearchResult, type DeepOverrides } from "@/lib/forecast/deepResearch";
import { MODEL_ACCURACY, accuracyColor, plainConsensus, pushHistory, readHistory, assessVix, bucketBenchmark, type HistoryEntry } from "@/lib/forecast/accuracy";

export const Route = createFileRoute("/forecast-classic")({
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

  // Deep Research (Models 18–22) + Market Context + History
  const [deep, setDeep] = useState<DeepResearchResult | null>(null);
  const [deepEnabled, setDeepEnabled] = useState<boolean>(true);
  const [deepModels, setDeepModels] = useState<Set<"dcf" | "emom" | "bbrev" | "rs" | "quant">>(
    () => new Set(["dcf", "emom", "bbrev", "rs", "quant"]),
  );
  const [overrides, setOverrides] = useState<DeepOverrides>({ eps: null, epsCagr5y: null, revGrowth: null });
  const [vix, setVix] = useState<number | null>(null);
  const [n200Above, setN200Above] = useState<boolean | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => { try { return readHistory(); } catch { return []; } });
  const [historyOpen, setHistoryOpen] = useState(false);

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

  // Market Context: fetch VIX + Nifty 200 last close vs 200 DMA (once on mount, cached)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, n] = await Promise.all([
          fetchYahooChart({ data: { symbol: "^INDIAVIX", range: "5d", interval: "1d" } }),
          fetchYahooChart({ data: { symbol: "^CNX200", range: "1y", interval: "1d" } }),
        ]);
        if (cancelled) return;
        if (v.ok && v.bars?.length) setVix(v.bars[v.bars.length - 1].c);
        if (n.ok && n.bars && n.bars.length >= 200) {
          const closes = n.bars.map((b) => b.c);
          const tail200 = closes.slice(-200);
          const dma = tail200.reduce((s, x) => s + x, 0) / tail200.length;
          setN200Above(closes[closes.length - 1] > dma);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Deep Research (Models 18–22) — recompute whenever results/overrides/bars change
  useEffect(() => {
    let cancelled = false;
    if (!deepEnabled || mode !== "stock" || !bars.length || !results.length) { setDeep(null); return; }
    (async () => {
      const rows = buildFeatures(bars);
      let benchBars: PriceBar[] | null = null;
      const bench = bucketBenchmark(pickedStock?.bucket);
      const idx = getIndex(bench.key);
      if (idx) {
        try {
          const r = await fetchYahooChart({ data: { symbol: idx.yahooSymbol, range: "1y", interval: "1d" } });
          if (r.ok && r.bars.length) benchBars = r.bars;
        } catch { /* fallback in model */ }
      }
      if (cancelled) return;
      const dr = runDeepResearch(bars, rows, effectiveHorizon, pickedStock, benchBars, bench.name, overrides);
      setDeep(dr);
    })();
    return () => { cancelled = true; };
  }, [bars, results, overrides, pickedStock, mode, effectiveHorizon, deepEnabled]);

  // Push run into history when a new consensus completes
  useEffect(() => {
    if (!consensus || !results.length || !bars.length) return;
    const entry: HistoryEntry = {
      ts: Date.now(),
      asset: meta.name || query,
      horizon: effectiveHorizon,
      price: currentPrice,
      consensusLabel: consensus.label,
      score: consensus.score,
      targetLow: consensus.targetLow,
      targetHigh: consensus.targetHigh,
      models: results.length,
    };
    setHistory(pushHistory(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length]);

  const vixInfo = assessVix(vix);

  return (
    <div className="space-y-5 dx-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dexter Forecaster</h1>
        <p className="text-sm text-muted-foreground">
          Live prices via Yahoo → Marketstack fallback. 17 forecast models + 5 Deep Research models. If historical data can't be fetched, the run stops with a clear error — no synthetic prices.
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
          <div className="space-y-2">
            <div className="rounded border border-border bg-background/30 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><div className="text-[10px] uppercase text-muted-foreground">Symbol</div><div className="font-mono font-semibold">{pickedStock.symbol}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Sector</div><div>{pickedStock.sector}</div></div>
              <div className="col-span-2 sm:col-span-2 flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="text-[10px] uppercase text-muted-foreground">Company</div><div className="truncate">{pickedStock.name}</div></div>
                <a
                  href={`https://www.screener.in/company/${encodeURIComponent(pickedStock.symbol)}/consolidated/`}
                  target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-[10px] px-2 py-1 rounded border border-primary/50 text-primary hover:bg-primary/10 whitespace-nowrap"
                >📊 Screener.in →</a>
              </div>
            </div>
            {(pickedStock.pe != null || pickedStock.roce != null || pickedStock.divYld != null || pickedStock.marCap != null) && (
              <div className="rounded border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] uppercase text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>Fundamentals Snapshot <span className="text-[9px] opacity-60">(Screener.in · Jun 2026)</span></span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                  <FundBit label="P/E"        val={pickedStock.pe}     fmt={(v)=>v.toFixed(1)} />
                  <FundBit label="ROCE"       val={pickedStock.roce}   fmt={(v)=>v.toFixed(1)+"%"} />
                  <FundBit label="Div Yield"  val={pickedStock.divYld} fmt={(v)=>v.toFixed(2)+"%"} />
                  <FundBit label="MarCap ₹Cr" val={pickedStock.marCap} fmt={(v)=>v>=1e5?(v/1e5).toFixed(1)+"L":v.toLocaleString("en-IN")} />
                  <FundBit label="Seed CMP"   val={pickedStock.cmp}    fmt={(v)=>"₹"+v.toFixed(0)} />
                </div>
              </div>
            )}
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
        {/* Model picker grouped — Advanced only, short-term tier only */}
        {uiMode === "advanced" && tier === "short" && (
          <div className="space-y-2">
            {GROUPS.map((g) => {
              const models = MODEL_SPECS.filter((m) => m.groupLabel === g);
              return (
                <div key={g}>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {models.map((m) => {
                      const on = selected.has(m.id);
                      const disabled = SHORT_TERM_ONLY.has(m.id) && (tier as Tier) === "long";
                      return (
                        <button key={m.id} onClick={() => !disabled && toggleModel(m.id)}
                          title={disabled ? "Disabled for multi-year horizons — designed for short-term patterns." : m.tooltip}
                          disabled={disabled}
                          className="px-2.5 py-1 text-xs rounded border font-mono disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* Long-term forecast panel */}
      {tier === "long" && longResult && (
        <LongTermPanel res={longResult} meta={meta} rebase={rebase} confidence={confidenceBand} />
      )}

      {/* Market Context banner */}
      {(vix != null || n200Above != null) && (
        <div className="dx-glass p-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground uppercase tracking-wider text-[10px]">
            <Activity className="w-3.5 h-3.5" /> Market context
          </span>
          {vix != null && (
            <span className="flex items-center gap-1">
              India VIX <span className="font-mono">{vix.toFixed(2)}</span>
              <span className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: `${vixInfo.color}20`, color: vixInfo.color, border: `1px solid ${vixInfo.color}` }}>{vixInfo.label}</span>
            </span>
          )}
          {n200Above != null && (
            <span className="flex items-center gap-1">
              NIFTY 200 <span style={{ color: n200Above ? "#00ff88" : "#ff4466" }} className="font-semibold">{n200Above ? "above" : "below"}</span> 200-DMA
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">Broader regime context — read alongside the model consensus below.</span>
        </div>
      )}


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

      {/* Model Consensus summary card */}
      {consensus && results.length > 0 && (
        <div className="dx-glass p-4 border-l-2" style={{ borderLeftColor: SIGNAL_COLORS[consensus.label]?.tx || "#00d4ff" }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Model Consensus Summary</h3>
            <SignalBadge label={consensus.label} />
            <span className="ml-auto text-[11px] text-muted-foreground font-mono">
              agreement {(consensus.agreement * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {plainConsensus(meta.name || query, effectiveHorizon, consensus, meta.currency)}
          </p>
        </div>
      )}

      {/* Deep Research (Models 18–22) — stock mode only */}
      {mode === "stock" && (
        <div className="dx-glass p-3 border border-primary/25">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input type="checkbox" checked={deepEnabled} onChange={(e) => setDeepEnabled(e.target.checked)} />
              🔬 Enable Deep Research (Models 18–22)
            </label>
            {deepEnabled && (
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Show:</span>
                {([
                  ["dcf", "DCF-Lite"],
                  ["emom", "Earnings Momentum"],
                  ["bbrev", "Bollinger Reversion"],
                  ["rs", "Relative Strength"],
                  ["quant", "Composite Quant"],
                ] as const).map(([k, label]) => {
                  const active = deepModels.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() => setDeepModels((prev) => {
                        const n = new Set(prev);
                        if (n.has(k)) n.delete(k); else n.add(k);
                        return n;
                      })}
                      className="px-2 py-1 text-[11px] rounded border transition"
                      style={{
                        borderColor: active ? "#a78bfa" : "rgba(255,255,255,0.15)",
                        background: active ? "rgba(167,139,250,0.15)" : "transparent",
                        color: active ? "#a78bfa" : "#94a3b8",
                      }}
                    >
                      {active ? "✓ " : ""}{label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {deepEnabled && deep && (
            <div className="mt-3">
              <DeepResearchPanel
                deep={deep}
                currency={meta.currency}
                currentPrice={currentPrice}
                overrides={overrides}
                setOverrides={setOverrides}
                visible={deepModels}
              />
            </div>
          )}
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

      {/* Past forecast history */}
      {history.length > 0 && (
        <div className="dx-glass p-4">
          <button onClick={() => setHistoryOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold w-full">
            {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <History className="w-4 h-4" /> How accurate were past forecasts?
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">{history.length} run{history.length === 1 ? "" : "s"} logged</span>
          </button>
          {historyOpen && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left py-1 pr-2">When</th>
                    <th className="text-left py-1 pr-2">Asset</th>
                    <th className="text-right py-1 pr-2">Horizon</th>
                    <th className="text-right py-1 pr-2">Price then</th>
                    <th className="text-left py-1 pr-2">Consensus</th>
                    <th className="text-right py-1 pr-2">Weighted %</th>
                    <th className="text-right py-1">Target range</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 5).map((h, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-1 pr-2">{new Date(h.ts).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="py-1 pr-2 truncate max-w-[140px]">{h.asset}</td>
                      <td className="py-1 pr-2 text-right">{h.horizon}d</td>
                      <td className="py-1 pr-2 text-right">₹{h.price.toFixed(2)}</td>
                      <td className="py-1 pr-2">{h.consensusLabel}</td>
                      <td className="py-1 pr-2 text-right" style={{ color: h.score >= 0 ? "#00ff88" : "#ff4466" }}>{h.score >= 0 ? "+" : ""}{h.score.toFixed(2)}%</td>
                      <td className="py-1 text-right">₹{h.targetLow.toFixed(0)}–₹{h.targetHigh.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
        This app is for research, forecasting and news only — do not trust signals without your own research.
        Forecasts are produced by deterministic mathematical models on live historical OHLCV data (Yahoo → Marketstack).
        When historical data can't be fetched, the run stops with a clear "⚠️ Could not fetch" error rather than falling back
        to synthetic prices. Per-model accuracy badges are indicative baselines from backtests; realised accuracy will vary.
        Black-swan events, regime breaks, and behavioural contamination are out of scope. Not SEBI-registered investment advice.
        Past model accuracy does not guarantee future performance. Always consult a SEBI-registered advisor before investing.
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
      {MODEL_ACCURACY[r.id] && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
          <span className="text-muted-foreground">Historical:</span>
          <span className="px-1.5 py-0.5 rounded font-mono"
            style={{ background: `${accuracyColor(MODEL_ACCURACY[r.id].mape)}20`, color: accuracyColor(MODEL_ACCURACY[r.id].mape), border: `1px solid ${accuracyColor(MODEL_ACCURACY[r.id].mape)}` }}>
            ±{MODEL_ACCURACY[r.id].mape.toFixed(1)}% MAPE
          </span>
          <span className="text-muted-foreground font-mono">· hit {MODEL_ACCURACY[r.id].hitRate}%</span>
        </div>
      )}
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

// ============= Long-term forecast panel =============

function LongTermPanel({
  res, meta, rebase, confidence,
}: {
  res: LongTermResult;
  meta: { name: string; exchange: string; currency: string };
  rebase: boolean;
  confidence: number;
}) {
  const scale = rebase ? 100000 / res.currentPrice : 1;
  const fmt = (v: number) => `${meta.currency}${(v * scale).toLocaleString("en-IN", { maximumFractionDigits: rebase ? 0 : 2 })}`;
  const data = res.timestamps.map((t, i) => ({
    t,
    cagr: res.cagrPath[i] * scale,
    median: res.mcMedian[i] * scale,
    low: res.mcLow[i] * scale,
    high: res.mcHigh[i] * scale,
  }));
  const positive = res.endMedian >= res.currentPrice;
  const lakhEnd = (res.endMedian / res.currentPrice) * 100000;
  return (
    <div className="dx-glass p-5 space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-foreground font-mono">{meta.exchange}</div>
          <div className="text-2xl font-semibold truncate">{meta.name}</div>
          <div className="text-3xl font-mono mt-2">{fmt(res.currentPrice)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Long-term horizon: <span className="text-foreground">{res.horizonLabel}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Central projection (CAGR extrapolation)</div>
          <div className="text-xl font-mono" style={{ color: positive ? "#00ff88" : "#ff4466" }}>
            {fmt(res.endCagr)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Drift used: <span className="font-mono text-foreground">{res.cagrUsed.toFixed(2)}% /yr</span> · source: {cagrSourceLabel(res.cagrSource)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Annualised vol: <span className="font-mono">{res.sigmaAnnual.toFixed(1)}%</span> · paths: <span className="font-mono">{res.paths}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">{confidence}% Monte Carlo range at {res.horizonLabel}</div>
          <div className="text-lg font-mono">
            {fmt(res.endLow)} — {fmt(res.endHigh)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Median outcome: <span className="font-mono text-foreground">{fmt(res.endMedian)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Prob. of profit: <span className="font-mono text-foreground">{res.probPositive.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="t"
              tickFormatter={(t) => {
                const d = new Date(t);
                return res.years <= 1
                  ? d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
                  : `${d.getFullYear()}`;
              }}
              tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis domain={["auto","auto"]}
              tickFormatter={(v) => rebase ? `₹${Math.round(Number(v) / 1000)}k` : Number(v).toFixed(0)}
              tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)" }}
              labelFormatter={(t) => new Date(t as number).toLocaleDateString("en-IN")} />
            <ReferenceLine y={res.currentPrice * scale} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "Today", fill: "#94a3b8", fontSize: 10, position: "right" }} />
            <Area dataKey="high" stroke="none" fill="rgba(0,212,255,0.18)" isAnimationActive={false} />
            <Area dataKey="low"  stroke="none" fill="#060810" isAnimationActive={false} />
            <Line dataKey="median" stroke="#00d4ff" strokeWidth={2}   dot={false} isAnimationActive={false} name="MC median" />
            <Line dataKey="cagr"   stroke="#00ff88" strokeWidth={2.5} dot={false} isAnimationActive={false} name="CAGR extrapolation" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">In plain English</div>
        <p className="text-sm leading-relaxed">
          At the {cagrSourceLabel(res.cagrSource).toLowerCase()} of <span className="font-mono">{res.cagrUsed.toFixed(2)}%</span>, a lumpsum of <span className="font-mono">₹1,00,000</span> in <span className="font-semibold">{meta.name}</span> today
          could grow to approximately <span className="font-mono font-semibold" style={{ color: positive ? "#00ff88" : "#ff4466" }}>₹{Math.round(lakhEnd).toLocaleString("en-IN")}</span> over <span className="font-semibold">{res.horizonLabel}</span>,
          based on Monte Carlo simulation across <span className="font-mono">{res.paths}</span> paths. <span className="font-mono">{res.probPositive.toFixed(0)}%</span> of simulated outcomes were profitable.
          This is a statistical projection, not a guarantee — past returns do not predict future performance, especially over multi-year periods where fundamentals, fund management, and market regimes can change substantially.
        </p>
      </div>
    </div>
  );
}

function FundBit({ label, val, fmt }: { label: string; val: number | undefined; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono">{val != null ? fmt(val) : "—"}</div>
    </div>
  );
}

// ============= Deep Research (Models 18–22) =============
function DeepResearchPanel({
  deep, currency, currentPrice, overrides, setOverrides, visible,
}: {
  deep: DeepResearchResult;
  currency: string;
  currentPrice: number;
  overrides: DeepOverrides;
  setOverrides: React.Dispatch<React.SetStateAction<DeepOverrides>>;
  visible?: Set<"dcf" | "emom" | "bbrev" | "rs" | "quant">;
}) {
  const show = (k: "dcf" | "emom" | "bbrev" | "rs" | "quant") => !visible || visible.has(k);
  const { dcf, emom, bbrev, rs, quant } = deep;
  const setNum = (k: keyof DeepOverrides) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setOverrides((prev) => ({ ...prev, [k]: v === "" ? null : Number(v) }));
  };
  return (
    <div className="dx-glass p-4 space-y-4 border border-primary/25">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: "#a78bfa" }} />
        <h3 className="font-semibold text-sm">🔬 Deep Research (Models 18–22)</h3>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">stock mode · seeded fundamentals</span>
      </div>

      {/* Manual overrides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col">
          <span className="text-muted-foreground text-[10px]">Override EPS (₹)</span>
          <input type="number" placeholder={dcf.used.eps.toFixed(2)} value={overrides.eps ?? ""} onChange={setNum("eps")}
            className="mt-1 px-2 py-1 bg-background/40 border border-border rounded font-mono outline-none" />
        </label>
        <label className="flex flex-col">
          <span className="text-muted-foreground text-[10px]">EPS 5Y CAGR (%)</span>
          <input type="number" placeholder={dcf.used.g.toFixed(1)} value={overrides.epsCagr5y ?? ""} onChange={setNum("epsCagr5y")}
            className="mt-1 px-2 py-1 bg-background/40 border border-border rounded font-mono outline-none" />
        </label>
        <label className="flex flex-col">
          <span className="text-muted-foreground text-[10px]">Revenue Growth (%)</span>
          <input type="number" placeholder={emom.breakdown.sales.toFixed(1)} value={overrides.revGrowth ?? ""} onChange={setNum("revGrowth")}
            className="mt-1 px-2 py-1 bg-background/40 border border-border rounded font-mono outline-none" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* DCF-Lite */}
        {show("dcf") && (
        <DRCard title="18 · DCF-Lite" accent="#00d4ff">
          <div className="text-lg font-mono">{currency}{dcf.fairValue.toFixed(2)}</div>
          <div className="text-[11px] text-muted-foreground">
            Fair value · MoS <span style={{ color: dcf.mos >= 0 ? "#00ff88" : "#ff4466" }}>{dcf.mos >= 0 ? "+" : ""}{dcf.mos.toFixed(1)}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            EPS {dcf.used.eps.toFixed(2)} · g {dcf.used.g.toFixed(1)}% · PE {dcf.used.pe.toFixed(1)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Band: {currency}{dcf.band.low.toFixed(2)} – {currency}{dcf.band.high.toFixed(2)}
          </div>
          {dcf.note && <div className="text-[10px] text-amber-400/70 mt-1">{dcf.note}</div>}
        </DRCard>
        )}

        {/* Earnings Momentum gauge */}
        {show("emom") && (
        <DRCard title="19 · Earnings Momentum" accent="#00ff88">
          <div className="text-lg font-mono">{emom.score.toFixed(0)}<span className="text-muted-foreground text-xs">/100</span></div>
          <div className="h-1.5 bg-muted rounded mt-1">
            <div className="h-full rounded" style={{ width: `${emom.score}%`, background: emom.score >= 66 ? "#00ff88" : emom.score >= 40 ? "#ffaa00" : "#ff4466" }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 font-mono">
            Profit {emom.breakdown.profit >= 0 ? "+" : ""}{emom.breakdown.profit.toFixed(1)}% · Sales {emom.breakdown.sales >= 0 ? "+" : ""}{emom.breakdown.sales.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground">Target shift {emom.targetShift >= 0 ? "+" : ""}{emom.targetShift.toFixed(2)}%</div>
        </DRCard>
        )}

        {/* Bollinger Reversion */}
        {show("bbrev") && (
        <DRCard title="20 · Bollinger Reversion" accent="#ffaa00">
          <div className="text-lg font-mono">{currency}{bbrev.target.toFixed(2)}</div>
          <div className="text-[11px] text-muted-foreground">
            Reversion target · <span style={{ color: bbrev.distance >= 0 ? "#00ff88" : "#ff4466" }}>{bbrev.distance >= 0 ? "+" : ""}{bbrev.distance.toFixed(2)}%</span> from price
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            Zone: <span style={{ color: bbrev.zone === "inside" ? "#94a3b8" : bbrev.zone === "upper" ? "#ff4466" : "#00ff88" }}>{bbrev.zone.toUpperCase()}</span>
            · Bands {currency}{bbrev.bandLower.toFixed(1)} – {currency}{bbrev.bandUpper.toFixed(1)}
          </div>
        </DRCard>
        )}

        {/* Relative Strength */}
        {show("rs") && (
        <DRCard title="21 · Relative Strength" accent="#a78bfa">
          <div className="text-lg font-mono" style={{ color: rs.rs >= 0 ? "#00ff88" : "#ff4466" }}>
            {rs.rs >= 0 ? "+" : ""}{rs.rs.toFixed(2)} pp
          </div>
          <div className="text-[11px] text-muted-foreground">vs {rs.benchLabel} · 3-month</div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            Stock {rs.stockRet3m >= 0 ? "+" : ""}{rs.stockRet3m.toFixed(2)}% · Bench {rs.benchRet3m >= 0 ? "+" : ""}{rs.benchRet3m.toFixed(2)}%
          </div>
          <div className="h-1.5 bg-muted rounded mt-2">
            <div className="h-full rounded" style={{ width: `${rs.score}%`, background: rs.score >= 55 ? "#00ff88" : rs.score >= 45 ? "#ffaa00" : "#ff4466" }} />
          </div>
        </DRCard>
        )}

        {/* Composite Quant Score with hexagonal radar */}
        {show("quant") && (
        <div className="p-3 rounded-lg border md:col-span-2 lg:col-span-2" style={{ borderColor: "#00ff8830", background: "#0d1117" }}>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">22 · Composite Quant Score</div>
            <div className="ml-auto text-2xl font-mono" style={{ color: quant.score >= 66 ? "#00ff88" : quant.score >= 40 ? "#ffaa00" : "#ff4466" }}>
              {quant.score.toFixed(0)}<span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <QuantRadar axes={quant.axes} />
        </div>
        )}
      </div>
    </div>
  );
}

function DRCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border" style={{ borderColor: `${accent}30`, background: "#0d1117" }}>
      <div className="text-[11px] font-mono uppercase tracking-wider" style={{ color: accent }}>{title}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function QuantRadar({ axes }: { axes: Array<{ label: string; value: number }> }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - 30;
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * rMax;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const outer = axes.map((_, i) => pt(i, 100));
  const inner = axes.map((a, i) => pt(i, a.value));
  const path = inner.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
  const grid = [25, 50, 75, 100].map((v) =>
    axes.map((_, i) => pt(i, v)).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z"
  );
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
      <svg width={size} height={size} className="shrink-0">
        {grid.map((g, i) => (
          <path key={i} d={g} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}
        {outer.map(([x, y], i) => (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" />
        ))}
        <path d={path} fill="rgba(0,255,136,0.15)" stroke="#00ff88" strokeWidth={1.5} />
        {axes.map((a, i) => {
          const [lx, ly] = pt(i, 118);
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="#94a3b8" className="font-mono uppercase">{a.label}</text>
          );
        })}
      </svg>
      <div className="flex-1 grid grid-cols-2 gap-1.5 text-[11px] w-full">
        {axes.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 rounded border border-border/40">
            <span className="text-muted-foreground truncate">{a.label}</span>
            <span className="font-mono" style={{ color: a.value >= 66 ? "#00ff88" : a.value >= 40 ? "#ffaa00" : "#ff4466" }}>
              {a.value.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


