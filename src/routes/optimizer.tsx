import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EfficientFrontier } from "@/components/EfficientFrontier";
import { LambdaSlider } from "@/components/LambdaSlider";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { StockCombobox } from "@/components/AssetCombobox";
import { optimize, frontier, syntheticBacktest, backtestStats, type ObjectiveKind } from "@/lib/optimizerMath";
import { useDexterState } from "@/hooks/useDexterState";
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Plus, Trash2, History, Copy, AlertTriangle } from "lucide-react";
import { NIFTY500 } from "@/lib/nifty500";

export const Route = createFileRoute("/optimizer")({
  head: () => ({ meta: [{ title: "Portfolio Optimizer — DEXTER" }] }),
  component: Optimizer,
});

type Asset = { symbol: string; name: string; sector: string; weight: number; locked: boolean };

interface SavedOptim {
  id: string;
  ts: number;
  objective: ObjectiveKind;
  weights: Array<{ symbol: string; w: number }>;
  expReturn: number;
  vol: number;
  sharpe: number;
  notes: string;
}

const OBJECTIVES: Array<{ key: ObjectiveKind; label: string; help: string }> = [
  { key: "maxSharpe", label: "Max Sharpe", help: "Best risk-adjusted return — the classic optimum." },
  { key: "minVol", label: "Min Volatility", help: "Lowest-risk portfolio on the frontier." },
  { key: "maxReturnAtRisk", label: "Max Return @ Target Risk", help: "Best return at or below an acceptable volatility." },
  { key: "minRiskAtReturn", label: "Min Risk @ Target Return", help: "Lowest risk that still hits your desired return." },
  { key: "riskParity", label: "Risk Parity", help: "Equal risk contribution from each asset." },
];

// crude per-symbol expected return + vol synthesizer — seed-stable so the
// same symbols always yield the same numbers across the app.
function statsFor(sym: string): { mu: number; sig: number } {
  let h = 0; for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const mu = 0.08 + (h % 1500) / 10000;          // 8% – 23%
  const sig = 0.15 + ((h >> 8) % 2200) / 10000;   // 15% – 37%
  return { mu, sig };
}

function Optimizer() {
  const { holdings } = usePortfolio();
  const arousal = useDexterState((s) => s.arousal);
  const [overrideLambda, setOverrideLambda] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [objective, setObjective] = useState<ObjectiveKind>("maxSharpe");
  const [targetRisk, setTargetRisk] = useState(0.18);
  const [targetReturn, setTargetReturn] = useState(0.14);
  const [maxPerAsset, setMaxPerAsset] = useState(40);
  const [minPerAsset, setMinPerAsset] = useState(2);
  const [sectorCaps, setSectorCaps] = useState<Array<{ sector: string; max: number }>>([]);
  const [minimizeTrades, setMinimizeTrades] = useState(false);
  const [picker, setPicker] = useState<null | "add">(null);
  const [backtestYears, setBacktestYears] = useState<1 | 3 | 5>(3);
  const [history, setHistory] = useLocalStorage<SavedOptim[]>("dx_optim_history_v1", []);
  const [historyOpen, setHistoryOpen] = useState(false);

  // load from /portfolio holdings
  const usePortfolioBtn = () => {
    if (!holdings.length) return;
    const totalVal = holdings.reduce((s, h) => s + h.qty * h.avgCost, 0) || 1;
    const next: Asset[] = holdings.map((h) => ({
      symbol: h.symbol, name: h.name,
      sector: h.sector ?? (NIFTY500.find((x) => x.symbol === h.symbol)?.sector ?? "Other"),
      weight: (h.qty * h.avgCost) / totalVal, locked: false,
    }));
    setAssets(next);
  };

  // Seed with 4 default assets if blank
  useEffect(() => {
    if (assets.length === 0) {
      const seed = ["RELIANCE", "TCS", "HDFCBANK", "ITC"].map((s) => NIFTY500.find((x) => x.symbol === s)!).filter(Boolean);
      setAssets(seed.map((s) => ({ symbol: s.symbol, name: s.name, sector: s.sector, weight: 1 / seed.length, locked: false })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const symbols = assets.map((a) => a.symbol);
  const stats = symbols.map((s) => statsFor(s));

  const lockedWeights = useMemo(() => {
    const r: Record<number, number> = {};
    assets.forEach((a, i) => { if (a.locked) r[i] = a.weight; });
    return r;
  }, [assets]);

  const weightBounds = useMemo(() => assets.map(() => ({ min: minPerAsset / 100, max: maxPerAsset / 100 })), [assets, minPerAsset, maxPerAsset]);

  const sectorCapMap = useMemo(() => {
    const m: Record<string, number> = {};
    sectorCaps.forEach((s) => { if (s.sector) m[s.sector] = s.max / 100; });
    return m;
  }, [sectorCaps]);

  const input = {
    symbols,
    expReturns: stats.map((s) => s.mu),
    vols: stats.map((s) => s.sig),
    weightBounds,
    lockedWeights,
    sectors: assets.map((a) => a.sector),
    sectorCaps: sectorCapMap,
  };

  const [result, frontierData] = useMemo(() => {
    if (assets.length < 2) return [null, []];
    const r = optimize(input, objective, { targetRisk, targetReturn, iterations: minimizeTrades ? 3000 : 7000 });
    const f = frontier(input, 800).slice(0, 800);
    return [r, f];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ symbols, objective, targetRisk, targetReturn, weightBounds, lockedWeights, sectorCapMap, minimizeTrades })]);

  const currentRet = useMemo(() => assets.reduce((s, a, i) => s + a.weight * stats[i].mu, 0), [assets, stats]);
  const currentVol = useMemo(() => {
    let v = 0;
    for (let i = 0; i < assets.length; i++) v += (assets[i].weight * stats[i].sig) ** 2;
    return Math.sqrt(v);
  }, [assets, stats]);

  // Suggested trades
  const totalInvested = holdings.reduce((s, h) => s + h.qty * h.avgCost, 0) || 100000;
  const trades = useMemo(() => {
    if (!result) return [];
    return assets.map((a, i) => {
      const curW = a.weight, newW = result.weights[i];
      const deltaPct = newW - curW;
      const deltaInr = deltaPct * totalInvested;
      let action: "BUY" | "SELL" | "HOLD" = "HOLD";
      if (Math.abs(deltaPct) >= 0.005) action = deltaPct > 0 ? "BUY" : "SELL";
      return { symbol: a.symbol, curW, newW, deltaPct, deltaInr, action };
    });
  }, [result, assets, totalInvested]);

  // Backtest series
  const backtest = useMemo(() => {
    if (!result) return null;
    const eq = new Array(assets.length).fill(1 / assets.length);
    const cur = syntheticBacktest(assets.map((a) => a.weight), input.expReturns, input.vols, backtestYears, "current-" + symbols.join(","));
    const opt = syntheticBacktest(result.weights, input.expReturns, input.vols, backtestYears, "opt-" + symbols.join(",") + objective);
    const bench = syntheticBacktest(eq, input.expReturns, input.vols, backtestYears, "bench-" + symbols.join(","));
    const merged: Array<{ d: number; current: number; optimal: number; benchmark: number }> = [];
    const len = Math.min(cur.length, opt.length, bench.length);
    for (let i = 0; i < len; i++) merged.push({ d: cur[i].d, current: cur[i].v, optimal: opt[i].v, benchmark: bench[i].v });
    const sCur = backtestStats(cur), sOpt = backtestStats(opt), sBn = backtestStats(bench);
    return { series: merged, current: sCur, optimal: sOpt, benchmark: sBn };
  }, [result, assets, input.expReturns, input.vols, backtestYears, symbols, objective]);

  const addAsset = (sym: string, name: string, sector: string) => {
    if (assets.some((a) => a.symbol === sym)) return;
    const w = 1 / (assets.length + 1);
    const rescale = 1 - w;
    setAssets([...assets.map((a) => ({ ...a, weight: a.weight * rescale })), { symbol: sym, name, sector, weight: w, locked: false }]);
    setPicker(null);
  };
  const removeAsset = (sym: string) => {
    const next = assets.filter((a) => a.symbol !== sym);
    if (next.length === 0) { setAssets(next); return; }
    const sum = next.reduce((s, a) => s + a.weight, 0) || 1;
    setAssets(next.map((a) => ({ ...a, weight: a.weight / sum })));
  };
  const setWeight = (sym: string, w: number) => {
    setAssets(assets.map((a) => a.symbol === sym ? { ...a, weight: w } : a));
  };
  const toggleLock = (sym: string) => {
    setAssets(assets.map((a) => a.symbol === sym ? { ...a, locked: !a.locked } : a));
  };

  const saveOptim = () => {
    if (!result) return;
    const entry: SavedOptim = {
      id: crypto.randomUUID(), ts: Date.now(), objective,
      weights: assets.map((a, i) => ({ symbol: a.symbol, w: result.weights[i] })),
      expReturn: result.expReturn, vol: result.vol, sharpe: result.sharpe, notes: "",
    };
    setHistory([entry, ...history].slice(0, 20));
  };

  const copyChecklist = () => {
    if (!trades.length) return;
    const text = "Dexter — Suggested Rebalance\n" + trades.map((t) => `${t.action} ${t.symbol}: ${t.action === "HOLD" ? "—" : "₹" + Math.abs(t.deltaInr).toFixed(0)} (${(t.deltaPct * 100).toFixed(1)}%)`).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const scatter = frontierData.map((p) => ({ x: p.vol * 100, y: p.ret * 100, sharpe: p.sharpe }));
  const currentPoint = [{ x: currentVol * 100, y: currentRet * 100 }];
  const optPoint = result ? [{ x: result.vol * 100, y: result.expReturn * 100 }] : [];

  return (
    <div className="grid gap-4 dx-fade-in">
      {/* Existing UX kept */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><EfficientFrontier /></div>
        <div className="space-y-2">
          <LambdaSlider />
          <div className="dx-glass p-3 text-[11px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-muted-foreground">🔗 Auto-adjusted from biometric arousal: <span className="font-mono text-primary">{arousal.toFixed(2)}</span></span>
              <label className="cursor-pointer flex items-center gap-1"><input type="checkbox" checked={overrideLambda} onChange={(e) => setOverrideLambda(e.target.checked)} /> override</label>
            </div>
            <p className="text-muted-foreground">At higher arousal, Dexter raises λ (risk aversion) and favours defensive allocations. Override to test against your own setting.</p>
          </div>
        </div>
      </div>

      {/* Holdings input */}
      <section className="dx-glass p-4 space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold">Optimize My Portfolio</h2>
            <p className="text-[11px] text-muted-foreground">Pick which holdings to include. Lock anything you don't want rebalanced.</p>
          </div>
          <div className="flex gap-2">
            {holdings.length > 0 && <button onClick={usePortfolioBtn} className="dx-pill cursor-pointer">Use My Live Portfolio</button>}
            <button onClick={() => setPicker("add")} className="dx-pill cursor-pointer"><Plus className="h-3 w-3" /> Add Asset</button>
          </div>
        </div>

        {picker === "add" && (
          <div className="rounded border border-border bg-background/30 p-2">
            <StockCombobox onChange={(s) => addAsset(s.symbol, s.name, s.sector)} />
          </div>
        )}

        {assets.length < 2
          ? <p className="text-xs text-amber-400">Add at least 2 assets to optimize.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr><th className="text-left px-2 py-1">Symbol</th><th className="text-left px-2 py-1">Sector</th><th className="text-right px-2 py-1">Weight %</th><th className="text-center px-2 py-1">Lock</th><th></th></tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.symbol} className="border-t border-border">
                      <td className="px-2 py-1.5 font-mono font-semibold">{a.symbol}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{a.sector}</td>
                      <td className="px-2 py-1.5 text-right"><input type="number" min={0} max={100} step={0.5} value={(a.weight * 100).toFixed(1)} onChange={(e) => setWeight(a.symbol, Math.max(0, Number(e.target.value)) / 100)} className="w-16 text-right font-mono bg-background/40 border border-border rounded px-1 py-0.5" /></td>
                      <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={a.locked} onChange={() => toggleLock(a.symbol)} /></td>
                      <td className="px-2 py-1.5 text-right"><button onClick={() => removeAsset(a.symbol)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {/* Objective toggle */}
      <section className="dx-glass p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Optimization Objective</div>
        <div className="flex flex-wrap gap-1.5">
          {OBJECTIVES.map((o) => (
            <button key={o.key} onClick={() => setObjective(o.key)} title={o.help} data-active={objective === o.key}
              className="px-3 py-1.5 text-xs rounded-full border border-border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">{o.label}</button>
          ))}
        </div>
        {objective === "maxReturnAtRisk" && (
          <Slider label={`Target risk (vol): ${(targetRisk * 100).toFixed(1)}%`} v={targetRisk * 100} min={5} max={50} step={0.5} on={(v) => setTargetRisk(v / 100)} />
        )}
        {objective === "minRiskAtReturn" && (
          <Slider label={`Target return: ${(targetReturn * 100).toFixed(1)}%`} v={targetReturn * 100} min={5} max={35} step={0.5} on={(v) => setTargetReturn(v / 100)} />
        )}
      </section>

      {/* Constraints */}
      <section className="dx-glass p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Real-world Constraints</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Slider label={`Max per asset: ${maxPerAsset}%`} v={maxPerAsset} min={5} max={100} step={1} on={setMaxPerAsset} />
          <Slider label={`Min per asset: ${minPerAsset}%`} v={minPerAsset} min={0} max={20} step={0.5} on={setMinPerAsset} />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Sector exposure caps</div>
          {sectorCaps.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={s.sector} onChange={(e) => { const n = [...sectorCaps]; n[i].sector = e.target.value; setSectorCaps(n); }} className="text-xs bg-background/40 border border-border rounded px-2 py-1">
                <option value="">— Sector —</option>
                {Array.from(new Set(assets.map((a) => a.sector))).map((sec) => <option key={sec}>{sec}</option>)}
              </select>
              <input type="number" min={5} max={100} step={1} value={s.max} onChange={(e) => { const n = [...sectorCaps]; n[i].max = Number(e.target.value); setSectorCaps(n); }} className="w-20 text-xs font-mono bg-background/40 border border-border rounded px-2 py-1" />
              <span className="text-[10px] text-muted-foreground">%</span>
              <button onClick={() => setSectorCaps(sectorCaps.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setSectorCaps([...sectorCaps, { sector: "", max: 30 }])} className="text-xs text-primary hover:underline">+ Add sector cap</button>
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={minimizeTrades} onChange={(e) => setMinimizeTrades(e.target.checked)} /> Minimize number of trades (slightly less optimal, fewer transactions)</label>
      </section>

      {/* Frontier + result */}
      {result && (
        <section className="dx-glass p-4 space-y-3">
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold">Frontier · Current vs Suggested</h2>
              <p className="text-[11px] text-muted-foreground">Each dot is a random feasible portfolio. Yellow star = your current weights. Green star = optimized.</p>
            </div>
            <button onClick={saveOptim} className="dx-pill cursor-pointer">💾 Save Optimization</button>
          </div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="x" name="Vol %" tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Volatility %", position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Return %" tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Expected Return %", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10 }} />
                <ZAxis range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Scatter name="Feasible" data={scatter} fill="rgba(0,212,255,0.25)" />
                <Scatter name="Current" data={currentPoint} fill="#ffaa00" shape="star" />
                <Scatter name="Optimal" data={optPoint} fill="#00ff88" shape="star" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="grid sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Expected Return" value={`${(result.expReturn * 100).toFixed(2)}%`} color="var(--bull)" />
            <Stat label="Volatility" value={`${(result.vol * 100).toFixed(2)}%`} />
            <Stat label="Sharpe" value={result.sharpe.toFixed(2)} color="var(--primary)" />
            <Stat label="Trades" value={String(trades.filter((t) => t.action !== "HOLD").length)} />
          </div>
        </section>
      )}

      {/* Suggested trades */}
      {result && trades.length > 0 && (
        <section className="dx-glass p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Suggested Trades</h2>
            <button onClick={copyChecklist} className="dx-pill cursor-pointer"><Copy className="h-3 w-3" /> Copy as Checklist</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted-foreground"><tr>
                <th className="text-left px-2 py-1">Asset</th>
                <th className="text-right px-2 py-1">Current %</th>
                <th className="text-right px-2 py-1">Suggested %</th>
                <th className="text-right px-2 py-1">Action</th>
                <th className="text-right px-2 py-1">Amount (₹)</th>
              </tr></thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.symbol} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono font-semibold">{t.symbol}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{(t.curW * 100).toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-right font-mono">{(t.newW * 100).toFixed(1)}%</td>
                    <td className={"px-2 py-1.5 text-right font-mono " + (t.action === "BUY" ? "text-emerald-400" : t.action === "SELL" ? "text-red-400" : "text-muted-foreground")}>{t.action}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{t.action === "HOLD" ? "—" : `₹${Math.abs(t.deltaInr).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {trades.filter((t) => t.action !== "HOLD").length} trades total. Consider transaction costs and any exit loads on mutual funds before executing.</p>
        </section>
      )}

      {/* Backtest */}
      {backtest && (
        <section className="dx-glass p-4 space-y-3">
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold">Hypothetical Backtest</h2>
              <p className="text-[11px] text-muted-foreground">Rebased to 100. Synthetic paths driven by each asset's expected return/vol assumptions.</p>
            </div>
            <div className="flex gap-1">
              {[1, 3, 5].map((y) => (
                <button key={y} onClick={() => setBacktestYears(y as 1 | 3 | 5)} data-active={backtestYears === y} className="px-2 py-1 text-xs rounded border border-border data-[active=true]:bg-accent data-[active=true]:text-accent-foreground">{y}Y</button>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={backtest.series}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="d" tickFormatter={(d) => `${Math.round(d / 252)}y`} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="current" stroke="#ffaa00" dot={false} strokeWidth={1.5} name="Current" />
                <Line dataKey="optimal" stroke="#00ff88" dot={false} strokeWidth={2} name="Suggested" />
                <Line dataKey="benchmark" stroke="#94a3b8" dot={false} strokeWidth={1.2} strokeDasharray="4 4" name="Equal-weight Benchmark" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <BTRow label="Current" s={backtest.current} color="#ffaa00" />
            <BTRow label="Suggested" s={backtest.optimal} color="#00ff88" />
            <BTRow label="Benchmark" s={backtest.benchmark} color="#94a3b8" />
          </div>
          <p className="text-[10px] text-muted-foreground italic">Backtested performance is hypothetical. The suggested allocation did not actually exist in the past — this shows how today's optimal weights would have performed had they been held throughout the period. Not investment advice.</p>
        </section>
      )}

      {/* History */}
      <section className="dx-glass p-4">
        <button onClick={() => setHistoryOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> Optimization History ({history.length})</button>
        {historyOpen && (
          <div className="mt-3 space-y-1">
            {history.length === 0 && <p className="text-xs text-muted-foreground">No saved optimizations yet. Use 💾 above to save one.</p>}
            {history.map((h) => (
              <div key={h.id} className="flex justify-between border-t border-border py-1.5 text-xs">
                <span>{new Date(h.ts).toLocaleString("en-IN")}</span>
                <span className="font-mono text-muted-foreground">{h.objective}</span>
                <span className="font-mono">Ret {(h.expReturn * 100).toFixed(1)}% · Vol {(h.vol * 100).toFixed(1)}% · Sharpe {h.sharpe.toFixed(2)}</span>
                <button onClick={() => setHistory(history.filter((x) => x.id !== h.id))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground italic">For planning purposes only. Algorithmic optimization is not SEBI-registered investment advice. <Link to="/biometrics" className="underline">See biometrics →</Link></p>
    </div>
  );
}

function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (n: number) => void }) {
  return (
    <label className="block text-xs">
      <div className="flex justify-between mb-0.5"><span>{label}</span></div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(Number(e.target.value))} className="w-full accent-primary" />
    </label>
  );
}
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="rounded bg-background/40 p-2"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-mono font-semibold" style={{ color }}>{value}</div></div>;
}
function BTRow({ label, s, color }: { label: string; s: { cagr: number; maxDD: number; sharpe: number }; color: string }) {
  return (
    <div className="rounded bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</div>
      <div className="grid grid-cols-3 mt-1 text-[11px] font-mono">
        <div><span className="text-muted-foreground">CAGR</span> {(s.cagr * 100).toFixed(1)}%</div>
        <div><span className="text-muted-foreground">DD</span> {(s.maxDD * 100).toFixed(1)}%</div>
        <div><span className="text-muted-foreground">Sh</span> {s.sharpe.toFixed(2)}</div>
      </div>
    </div>
  );
}
