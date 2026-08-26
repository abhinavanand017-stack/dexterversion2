import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { fetchYahooChart } from "@/lib/yahoo.functions";
import { getIndexSnapshot, type IndexSnapshot } from "@/lib/indices/nse.functions";
import { analyzeIndex, type IndexAnalysis } from "@/lib/indices/analyze.functions";
import {
  INDIAN_INDICES, GLOBAL_PEERS, type IndianIndex,
} from "@/lib/indices/universe";
import {
  annualizedVol, calendarYearReturns, correlation, drawdown, fairValueRange,
  lastClose, peBand, pctAbove200dma, rebase, returnsTable, rollingVolatility,
  scenarios, type Bar,
} from "@/lib/indices/metrics";
import { SourceChip } from "./SourceChip";
import {
  CalendarReturnsChart, ChartFrame, CorrelationHeatmap, DrawdownChart, PeBandChart,
  PriceChart, RebasedChart, ScenarioChart, SectorTreemap, VolatilityChart, peerColor,
} from "./charts";

type TabKey = "overview" | "valuation" | "scenarios" | "risk" | "global" | "performance";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "valuation", label: "Valuation" },
  { key: "scenarios", label: "Scenarios" },
  { key: "risk", label: "Risk" },
  { key: "global", label: "Global" },
  { key: "performance", label: "Performance" },
];

const RANGES = ["1D", "1M", "6M", "1Y", "5Y", "MAX"] as const;
type RangeKey = typeof RANGES[number];
const RANGE_DAYS: Record<RangeKey, number> = { "1D": 1, "1M": 31, "6M": 183, "1Y": 366, "5Y": 1830, MAX: 1e9 };

const num = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`);
const tone = (v: number | null | undefined) => (v == null ? "" : v >= 0 ? "text-[#00ff88]" : "text-[#ff4466]");

export function IndexDashboard({ index }: { index: IndianIndex }) {
  const chart = useServerFn(fetchYahooChart);
  const snapFn = useServerFn(getIndexSnapshot);
  const analyzeFn = useServerFn(analyzeIndex);

  const [bars, setBars] = useState<Bar[]>([]);
  const [intraday, setIntraday] = useState<Bar[]>([]);
  const [snap, setSnap] = useState<IndexSnapshot | null>(null);
  const [snapErr, setSnapErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [barsErr, setBarsErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [range, setRange] = useState<RangeKey>("1Y");

  const [peerBars, setPeerBars] = useState<Record<string, Bar[]>>({});
  const [peersLoading, setPeersLoading] = useState(false);
  const [sectorTiles, setSectorTiles] = useState<{ name: string; weight: number; pct: number }[]>([]);
  const peersStartedRef = useRef<string | null>(null);
  const sectorStartedRef = useRef(false);

  const [analysis, setAnalysis] = useState<IndexAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  // ── history + live snapshot ──────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    setLoading(true); setBars([]); setSnap(null); setSnapErr(null); setBarsErr(null);
    setAnalysis(null); setAiErr(null); setPeerBars({});
    (async () => {
      const [h, i] = await Promise.all([
        chart({ data: { symbol: index.yahoo, range: "10y", interval: "1d" } }),
        chart({ data: { symbol: index.yahoo, range: "5d", interval: "15m" } }),
      ]);
      if (dead) return;
      setBars(h.bars as Bar[]);
      if (!h.ok) setBarsErr(h.error || "price history unavailable");
      setIntraday(i.bars as Bar[]);
      setLoading(false);
    })();
    (async () => {
      if (!index.nseName) { setSnapErr("Not in the NSE index feed"); return; }
      const r = await snapFn({ data: { nseName: index.nseName } });
      if (dead) return;
      if (r.ok && r.snapshot) setSnap(r.snapshot); else setSnapErr(r.error || "NSE feed unavailable");
    })();
    return () => { dead = true; };
  }, [index.key, index.yahoo, index.nseName, chart, snapFn]);

  // ── derived metrics (all computed, never from the model) ─────────────
  const price = snap?.last || lastClose(bars);
  const dayPct = snap?.percentChange ?? (bars.length > 1 ? ((bars[bars.length - 1].c / bars[bars.length - 2].c) - 1) * 100 : null);
  const rets = useMemo(() => returnsTable(bars), [bars]);
  const dd = useMemo(() => drawdown(bars), [bars]);
  const cal = useMemo(() => calendarYearReturns(bars), [bars]);
  const vol1y = useMemo(() => annualizedVol(bars), [bars]);
  const above200 = useMemo(() => pctAbove200dma(bars), [bars]);
  const scen = useMemo(() => scenarios(bars), [bars]);
  const band5 = useMemo(() => (snap?.pe ? peBand(bars, snap.pe, 5) : null), [bars, snap?.pe]);
  const band10 = useMemo(() => (snap?.pe ? peBand(bars, snap.pe, 10) : null), [bars, snap?.pe]);
  const fv = useMemo(() => (snap?.pe && band10 ? fairValueRange(price, snap.pe, band10) : null), [price, snap?.pe, band10, price]);

  const volSeries = useMemo(() => {
    const a = rollingVolatility(bars, 30), b = rollingVolatility(bars, 90), c = rollingVolatility(bars, 252);
    const m = new Map<number, { t: number; v30?: number; v90?: number; v365?: number }>();
    a.forEach((p) => m.set(p.t, { ...(m.get(p.t) ?? { t: p.t }), v30: p.v }));
    b.forEach((p) => m.set(p.t, { ...(m.get(p.t) ?? { t: p.t }), v90: p.v }));
    c.forEach((p) => m.set(p.t, { ...(m.get(p.t) ?? { t: p.t }), v365: p.v }));
    return [...m.values()].sort((x, y) => x.t - y.t);
  }, [bars]);

  const visibleBars = useMemo(() => {
    if (range === "1D") return intraday.slice(-30);
    if (!bars.length) return [];
    const cutoff = bars[bars.length - 1].t - RANGE_DAYS[range] * 86_400_000;
    return bars.filter((b) => b.t >= cutoff);
  }, [bars, intraday, range]);

  const peers = useMemo(() => GLOBAL_PEERS.filter((p) => p.peer === index.peer), [index.peer]);

  // ── global peers (lazy: only when the Global tab opens) ──────────────
  useEffect(() => {
    if (tab !== "global" || !peers.length || peersStartedRef.current === index.key) return;
    peersStartedRef.current = index.key;
    setPeersLoading(true);
    (async () => {
      const results = await Promise.all(
        peers.map(async (p) => [p.key, (await chart({ data: { symbol: p.yahoo, range: "5y", interval: "1d" } })).bars as Bar[]] as const),
      );
      setPeerBars(Object.fromEntries(results));
      setPeersLoading(false);
    })();
  }, [tab, peers, chart, index.key]);

  // ── sector map (NSE sectoral indices, day change — reference view) ───
  useEffect(() => {
    if (tab !== "overview" || sectorTiles.length) return;
    let dead = false;
    (async () => {
      const sectorals = INDIAN_INDICES.filter((i) => i.category === "sectoral" && i.nseName);
      const res = await Promise.all(sectorals.map(async (s) => [s, await snapFn({ data: { nseName: s.nseName! } })] as const));
      if (dead) return;
      setSectorTiles(res.filter(([, r]) => r.ok && r.snapshot)
        .map(([s, r]) => ({ name: s.name.replace("NIFTY ", ""), weight: 1, pct: r.snapshot!.percentChange })));
    })();
    return () => { dead = true; };
  }, [tab, snapFn, sectorTiles.length]);

  const peerStats = useMemo(() => peers.map((p) => {
    const pb = peerBars[p.key] ?? [];
    const r = returnsTable(pb).find((x) => x.label === "1Y")?.pct ?? null;
    return {
      key: p.key, name: p.name, region: p.region, proxy: p.proxy,
      ret1y: r, vol: annualizedVol(pb), corr: correlation(bars, pb), bars: pb,
    };
  }), [peers, peerBars, bars]);

  const runAnalysis = useCallback(async () => {
    setAiLoading(true); setAiErr(null);
    const r = await analyzeFn({
      data: {
        indexKey: index.key, indexName: index.name, category: index.category, peerCategory: index.peer,
        price, pctChange: dayPct ?? 0,
        pe: snap?.pe ?? null, pb: snap?.pb ?? null, dy: snap?.dy ?? null,
        peMean5y: band5?.mean ?? null, peMean10y: band10?.mean ?? null, peZScore: band10?.zScore ?? null,
        peerMedianPe: null,
        fairLow: fv?.low ?? null, fairBase: fv?.base ?? null, fairHigh: fv?.high ?? null,
        returns: rets.map((x) => ({ label: x.label, pct: x.pct })),
        vol1y, maxDrawdownPct: dd.maxDrawdownPct, above200dmaPct: above200,
        advances: snap?.advances ?? null, declines: snap?.declines ?? null,
        scenarioTargets: scen ? {
          bull: scen.bull.target, base: scen.base.target, bear: scen.bear.target,
          probBull: scen.bull.prob, probBase: scen.base.prob, probBear: scen.bear.prob,
        } : null,
        peers: peerStats.map((p) => ({ name: p.name, ret1y: p.ret1y, pe: null, vol: p.vol, corr: p.corr })),
      },
    });
    if (r.ok && r.analysis) setAnalysis(r.analysis); else setAiErr(r.error || "analysis failed");
    setAiLoading(false);
  }, [analyzeFn, index, price, dayPct, snap, band5, band10, fv, rets, vol1y, dd.maxDrawdownPct, above200, scen, peerStats]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">
              {index.exchange} · {index.category}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{index.name}</h2>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl font-mono">{loading && !price ? "…" : num(price)}</span>
              <span className={`font-mono text-sm ${tone(dayPct)}`}>
                {pct(dayPct)} {snap ? `(${num(snap.variation)})` : ""}
              </span>
              <SourceChip live={!!snap} label={snap ? "Live NSE" : "Yahoo"} title={snap ? "nseindia.com live index feed" : "Yahoo Finance chart feed"} />
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Day range</div>
            <div className="font-mono text-sm">{snap ? `${num(snap.low)} – ${num(snap.high)}` : "–"}</div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground pt-1">52-week</div>
            <div className="font-mono text-sm">{snap?.yearLow ? `${num(snap.yearLow)} – ${num(snap.yearHigh)}` : "–"}</div>
          </div>
        </div>
        {snapErr && (
          <p className="mt-2 text-[11px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> NSE valuation feed: {snapErr}. Price and history shown from Yahoo.
          </p>
        )}
        {barsErr && <p className="mt-1 text-[11px] text-amber-400">History: {barsErr}</p>}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} data-active={tab === t.key}
            className="px-3 py-2 text-xs font-medium border-b-2 border-transparent text-muted-foreground data-[active=true]:border-primary data-[active=true]:text-foreground">
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> loading history…</div>}

      {tab === "overview" && (
        <div className="space-y-4">
          <ChartFrame
            title="Price"
            note={
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r} onClick={() => setRange(r)} data-active={range === r}
                    className="px-2 py-0.5 text-[10px] rounded border border-border font-mono data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">
                    {r}
                  </button>
                ))}
              </div>
            }
            height={300}
          >
            <PriceChart bars={visibleBars} intraday={range === "1D"} />
          </ChartFrame>

          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="P/E" value={num(snap?.pe)} live={!!snap?.pe} />
            <Stat label="P/B" value={num(snap?.pb)} live={!!snap?.pb} />
            <Stat label="Dividend yield" value={snap?.dy != null ? `${num(snap.dy)}%` : "–"} live={!!snap?.dy} />
            <Stat label="1Y volatility (ann.)" value={vol1y != null ? `${num(vol1y, 1)}%` : "–"} live={false} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card/40 p-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Breadth (constituents)</h3>
              {snap && snap.advances != null ? (
                <div className="flex items-center gap-4 text-sm font-mono">
                  <span className="text-[#00ff88]">{snap.advances} advancing</span>
                  <span className="text-[#ff4466]">{snap.declines} declining</span>
                  <span className="text-muted-foreground">{snap.unchanged} flat</span>
                </div>
              ) : <p className="text-xs text-muted-foreground">Not available for this index.</p>}
              <div className="mt-3 text-xs text-muted-foreground">
                Level vs 200-DMA: <span className={`font-mono ${tone(above200)}`}>{pct(above200)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Sector map</h3>
                <SourceChip live={false} label="Reference" title="Sectoral index day-change, equally sized — constituent weights are not published in the free feed" />
              </div>
              {sectorTiles.length ? <SectorTreemap tiles={sectorTiles} /> : <p className="text-xs text-muted-foreground">Loading sector moves…</p>}
              <p className="mt-2 text-[10px] text-muted-foreground">Sectoral index moves, equally sized. Constituent weights are not available from the public feed.</p>
            </div>
          </div>

          <DexterView analysis={analysis} loading={aiLoading} error={aiErr} onRun={runAnalysis} section="verdict" />
        </div>
      )}

      {tab === "valuation" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="Current P/E" value={num(snap?.pe)} live={!!snap?.pe} />
            <Stat label="5Y mean P/E" value={num(band5?.mean ?? null)} live={false} />
            <Stat label="10Y mean P/E" value={num(band10?.mean ?? null)} live={false} />
          </div>
          {band10 ? (
            <>
              <ChartFrame
                title="P/E vs its own 10-year band (±1σ)"
                note={<SourceChip live={false} label="Approximation" title="Price-implied P/E: current P/E scaled by price history, holding earnings constant" />}
                height={280}
              >
                <PeBandChart series={band10.series} mean={band10.mean} upper={band10.upper} lower={band10.lower} />
              </ChartFrame>
              <div className="grid gap-3 md:grid-cols-4">
                <Stat label="Z-score vs 10Y" value={num(band10.zScore)} live={false} />
                <Stat label="Fair value low (−1σ)" value={num(fv?.low ?? null, 0)} live={false} />
                <Stat label="Fair value base (mean)" value={num(fv?.base ?? null, 0)} live={false} />
                <Stat label="Fair value high (+1σ)" value={num(fv?.high ?? null, 0)} live={false} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                The band is a price-implied approximation — it scales today's reported P/E by the index's own price
                history and holds earnings constant. Treat it as a range, not a precise multiple.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Valuation band unavailable: this index has no P/E in the NSE feed (BSE and some thematic indices are not covered).
            </p>
          )}
          <DexterView analysis={analysis} loading={aiLoading} error={aiErr} onRun={runAnalysis} section="valuation" />
        </div>
      )}

      {tab === "scenarios" && (
        <div className="space-y-4">
          {scen ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {([["Bull", scen.bull, "#00ff88"], ["Base", scen.base, "#00d4ff"], ["Bear", scen.bear, "#ff4466"]] as const).map(([name, s, c]) => (
                  <div key={name} className="rounded-lg border border-border bg-card/40 p-3" style={{ borderColor: `${c}55` }}>
                    <div className="text-xs font-mono uppercase" style={{ color: c }}>{name} · {s.prob}% probability</div>
                    <div className="text-2xl font-mono mt-1">{num(s.target, 0)}</div>
                    <div className={`text-xs font-mono ${tone(s.retPct)}`}>{pct(s.retPct)} over 12 months</div>
                    {analysis && <p className="text-[11px] text-muted-foreground mt-2">{name === "Bull" ? analysis.triggers.bull : name === "Bear" ? analysis.triggers.bear : analysis.triggers.base}</p>}
                  </div>
                ))}
              </div>
              <ChartFrame title="12-month scenario targets" note={<SourceChip live={false} label="Computed" title="Lognormal projection from 3-year drift and volatility" />}>
                <ScenarioChart data={[
                  { name: "Bear", target: scen.bear.target, prob: scen.bear.prob },
                  { name: "Base", target: scen.base.target, prob: scen.base.prob },
                  { name: "Bull", target: scen.bull.target, prob: scen.bull.prob },
                ]} />
              </ChartFrame>
              <div className="text-xs text-muted-foreground">
                Probability-weighted 12-month return: <span className={`font-mono ${tone(scen.weighted)}`}>{pct(scen.weighted)}</span>
                {" · "}drift {num(scen.mu, 1)}% p.a., volatility {num(scen.sigma, 1)}% p.a.
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground">Not enough history to build scenarios.</p>}
          <DexterView analysis={analysis} loading={aiLoading} error={aiErr} onRun={runAnalysis} section="scenarios" />
        </div>
      )}

      {tab === "risk" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="1Y volatility (ann.)" value={vol1y != null ? `${num(vol1y, 1)}%` : "–"} live={false} />
            <Stat label="Max drawdown (10Y)" value={`${num(dd.maxDrawdownPct, 1)}%`} live={false} />
            <Stat label="Trough" value={dd.troughDate ? new Date(dd.troughDate).toLocaleDateString("en-IN") : "–"} live={false} />
            <Stat label="Days to recover" value={dd.recoveryDays != null ? `${dd.recoveryDays}` : "not yet recovered"} live={false} />
          </div>
          {analysis ? (
            <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Risk matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left"><th className="py-1 pr-3">Category</th><th className="pr-3">Likelihood</th><th className="pr-3">Impact</th><th>Note</th></tr>
                  </thead>
                  <tbody>
                    {analysis.risks.map((r) => (
                      <tr key={r.category} className="border-t border-border/60">
                        <td className="py-1.5 pr-3 font-medium">{r.category}</td>
                        <td className="pr-3"><Pill level={r.likelihood} /></td>
                        <td className="pr-3"><Pill level={r.impact} /></td>
                        <td className="text-muted-foreground">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded border border-[#ff4466]/40 bg-[#ff4466]/5 p-3">
                <div className="text-[10px] font-mono uppercase text-[#ff4466]">Killer risk</div>
                <div className="text-sm mt-0.5">{analysis.killerRisk.risk}</div>
                <div className="text-xs text-muted-foreground mt-1">Mitigant: {analysis.killerRisk.mitigant}</div>
              </div>
            </div>
          ) : <DexterView analysis={null} loading={aiLoading} error={aiErr} onRun={runAnalysis} section="risk" />}
        </div>
      )}

      {tab === "global" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SourceChip live={false} label="Global feed" title="Global peers come from Yahoo Finance, not the NSE/BSE pipeline" />
            {peersLoading && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> loading peers…</span>}
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left"><th className="py-1 pr-3">Index</th><th className="pr-3">Region</th><th className="pr-3 text-right">1Y return</th><th className="pr-3 text-right">Volatility</th><th className="text-right">Correlation</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/60 bg-primary/5">
                  <td className="py-1.5 pr-3 font-medium">{index.name}</td>
                  <td className="pr-3">India</td>
                  <td className={`pr-3 text-right font-mono ${tone(rets.find((r) => r.label === "1Y")?.pct)}`}>{pct(rets.find((r) => r.label === "1Y")?.pct)}</td>
                  <td className="pr-3 text-right font-mono">{vol1y != null ? `${num(vol1y, 1)}%` : "–"}</td>
                  <td className="text-right font-mono">1.00</td>
                </tr>
                {peerStats.map((p) => (
                  <tr key={p.key} className="border-t border-border/60">
                    <td className="py-1.5 pr-3" title={p.proxy ? `Tracked via ${p.proxy}` : undefined}>{p.name}{p.proxy && <span className="text-muted-foreground"> *</span>}</td>
                    <td className="pr-3 text-muted-foreground">{p.region}</td>
                    <td className={`pr-3 text-right font-mono ${tone(p.ret1y)}`}>{pct(p.ret1y)}</td>
                    <td className="pr-3 text-right font-mono">{p.vol != null ? `${num(p.vol, 1)}%` : "–"}</td>
                    <td className="text-right font-mono">{p.corr != null ? p.corr.toFixed(2) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-muted-foreground">* tracked via a listed ETF proxy where the index itself has no free price feed.</p>
          </div>

          {Object.keys(peerBars).length > 0 && (
            <>
              <ChartFrame title="Rebased to 100 — last 5 years" height={300}>
                <RebasedChart
                  rows={rebase(
                    [{ key: index.key, bars }, ...peerStats.map((p) => ({ key: p.key, bars: p.bars }))],
                    Date.now() - 5 * 365 * 86_400_000,
                  )}
                  series={[{ key: index.key, name: index.name }, ...peerStats.map((p) => ({ key: p.key, name: p.name }))]}
                />
              </ChartFrame>
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Correlation of daily returns (1Y)</h3>
                <CorrelationHeatmap
                  labels={[index.name, ...peerStats.map((p) => p.name)]}
                  matrix={[[index.name, bars] as const, ...peerStats.map((p) => [p.name, p.bars] as const)].map(([, a]) =>
                    [[index.name, bars] as const, ...peerStats.map((p) => [p.name, p.bars] as const)].map(([, b]) =>
                      a === b ? 1 : correlation(a as Bar[], b as Bar[]),
                    ),
                  )}
                />
              </div>
            </>
          )}
          <DexterView analysis={analysis} loading={aiLoading} error={aiErr} onRun={runAnalysis} section="global" />
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Returns</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {rets.map((r) => (
                <div key={r.label}>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">{r.label}{r.annualized ? " (p.a.)" : ""}</div>
                  <div className={`font-mono text-sm ${tone(r.pct)}`}>{pct(r.pct)}</div>
                </div>
              ))}
            </div>
          </div>
          <ChartFrame title="Calendar-year returns"><CalendarReturnsChart data={cal} /></ChartFrame>
          <ChartFrame title="Drawdown from running peak"><DrawdownChart series={dd.series} /></ChartFrame>
          <div className="text-xs text-muted-foreground">
            Deepest drawdown {num(dd.maxDrawdownPct, 1)}% — peak {dd.peakDate ? new Date(dd.peakDate).toLocaleDateString("en-IN") : "–"},
            trough {dd.troughDate ? new Date(dd.troughDate).toLocaleDateString("en-IN") : "–"},
            {dd.recoveryDate ? ` recovered ${new Date(dd.recoveryDate).toLocaleDateString("en-IN")} (${dd.recoveryDays} days).` : " not yet recovered."}
          </div>
          <ChartFrame title="Rolling annualized volatility"><VolatilityChart series={volSeries} /></ChartFrame>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{label}</span>
        <SourceChip live={live} label={live ? "Live" : "Computed"} title={live ? "From the live NSE index feed" : "Computed from fetched price history"} />
      </div>
      <div className="font-mono text-lg mt-1">{value}</div>
    </div>
  );
}

function Pill({ level }: { level: "Low" | "Medium" | "High" }) {
  const c = level === "High" ? "bg-[#ff4466]/15 text-[#ff4466]" : level === "Medium" ? "bg-amber-500/15 text-amber-400" : "bg-[#00ff88]/15 text-[#00ff88]";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${c}`}>{level}</span>;
}

function DexterView({
  analysis, loading, error, onRun, section,
}: { analysis: IndexAnalysis | null; loading: boolean; error: string | null; onRun: () => void; section: "verdict" | "valuation" | "scenarios" | "risk" | "global" }) {
  if (!analysis) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/20 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium">Dexter's read</div>
          <p className="text-xs text-muted-foreground">Narrative verdict, valuation read, scenario triggers and the risk matrix — every number stays as computed above.</p>
          {error && <p className="text-xs text-[#ff4466] mt-1">{error}</p>}
        </div>
        <button onClick={onRun} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary/10 disabled:opacity-50">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {loading ? "Analysing…" : "Generate Dexter's read"}
        </button>
      </div>
    );
  }
  const body =
    section === "valuation" ? analysis.valuationRead
      : section === "global" ? analysis.relativeStrength
        : section === "scenarios" ? `${analysis.triggers.base}`
          : analysis.verdict;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="text-[10px] font-mono uppercase text-primary mb-1">Dexter's read</div>
      <p className="text-sm">{section === "verdict" ? analysis.verdict : body}</p>
      {section === "verdict" && <p className="text-xs text-muted-foreground mt-2">{analysis.valuationRead}</p>}
      <p className="text-[10px] text-muted-foreground mt-2">AI narrative on computed data. Not investment advice.</p>
    </div>
  );
}

export { peerColor };
