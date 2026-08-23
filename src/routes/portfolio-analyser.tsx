import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileSpreadsheet, Download, Plus, Trash2, Save, FolderOpen, Play, AlertTriangle, TrendingUp, TrendingDown, Sparkles, Import, Loader2, XCircle } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { StockCombobox, FundCombobox } from "@/components/AssetCombobox";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import type { AnalyserHolding, AnalysisResult, EnrichedHolding } from "@/lib/portfolioAnalyser/types";
import { downloadTemplate, parseWorkbook, exportHoldings } from "@/lib/portfolioAnalyser/excel";
import { xirr, cagr } from "@/lib/portfolioAnalyser/math";
import { assetAllocation, sectorConcentration, diversificationScore } from "@/lib/portfolioAnalyser/stats";
import { analyzePortfolio } from "@/lib/portfolioAnalyser/analyze.functions";
import { fetchYahooFundamentals } from "@/lib/yahoo.functions";
import { PreviewTable } from "@/components/portfolioAnalyser/PreviewTable";
import { ResultsDashboard } from "@/components/portfolioAnalyser/ResultsDashboard";
import { SourceBadge } from "@/components/portfolioAnalyser/SourceBadge";
import { readHoldings as readMyPortfolio } from "@/hooks/usePortfolio";
import { formatINR } from "@/lib/formatINR";

export const Route = createFileRoute("/portfolio-analyser")({
  head: () => ({
    meta: [
      { title: "Portfolio Analyser — Dexter" },
      { name: "description", content: "Upload or enter your Indian stock & mutual fund holdings for deep portfolio analysis: XIRR, Sharpe, forecast, tax, and AI insights." },
      { property: "og:title", content: "Portfolio Analyser — Dexter" },
      { property: "og:description", content: "Deep analysis of your Indian equity + mutual fund portfolio using 17 forecasting models and AI." },
    ],
  }),
  component: PortfolioAnalyser,
});

const SAVE_KEY = "portfolioAnalyser_v1";

interface FundNav { nav: number; asOf: string }

async function fetchFundNav(code: number): Promise<FundNav | null> {
  try {
    const r = await fetch(`https://api.mfapi.in/mf/${code}/latest`);
    if (!r.ok) return null;
    const j = await r.json() as { data?: { nav: string; date: string }[] };
    const first = j.data?.[0];
    if (!first) return null;
    return { nav: Number(first.nav), asOf: first.date };
  } catch { return null; }
}

const NEON_COLORS = ["#00ffe0", "#00c8ff", "#7dff00", "#ff00c8", "#ffbb00", "#ff5b5b", "#8b5cf6", "#22d3ee", "#f472b6", "#a3e635"];

function PortfolioAnalyser() {
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [holdings, setHoldings] = useState<AnalyserHolding[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analyzed, setAnalyzed] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [fundamentals, setFundamentals] = useState<Record<string, EnrichedHolding["fundamentals"]>>({});
  const [fundNavs, setFundNavs] = useState<Record<string, FundNav>>({});
  const dropRef = useRef<HTMLDivElement>(null);
  const runAnalysis = useServerFn(analyzePortfolio);
  const getFundamentals = useServerFn(fetchYahooFundamentals);

  // load saved
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) setHoldings(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Live prices for listed instruments (stocks + ETFs)
  const stockSymbols = useMemo(
    () => holdings.filter((h) => h.kind === "stock" || h.kind === "etf").map((h) => h.symbol).filter(Boolean),
    [holdings]
  );
  const { quotes } = useLiveQuotes(stockSymbols);

  // Fund NAV fetch
  useEffect(() => {
    const codes = holdings.filter((h) => h.kind === "fund" && h.schemeCode).map((h) => h.schemeCode!);
    for (const c of codes) {
      if (fundNavs[String(c)]) continue;
      fetchFundNav(c).then((n) => {
        if (n) setFundNavs((prev) => ({ ...prev, [String(c)]: n }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  // Enriched holdings with current price
  const enriched = useMemo(() => holdings.map((h) => {
    let cp = h.currentPrice;
    let live = false;
    if (h.kind === "stock" || h.kind === "etf") {
      const q = quotes[h.symbol];
      if (q && q.price > 0 && q.source !== "unavailable") { cp = q.price; live = true; }
      else cp = cp ?? h.avgCost;
    } else if (h.schemeCode && fundNavs[String(h.schemeCode)]) {
      cp = fundNavs[String(h.schemeCode)].nav; live = true;
    } else cp = cp ?? h.avgCost;
    const price = cp ?? h.avgCost;
    const value = price * h.qty;
    const invested = h.avgCost * h.qty;
    const pnl = value - invested;
    const pnlPct = invested > 0 ? pnl / invested : 0;
    const years = Math.max(0.01, (Date.now() - new Date(h.buyDate).getTime()) / (365.25 * 86400_000));
    // CAGR is meaningless for very short holds — report 0 rather than an absurd annualised figure.
    const holdCagr = years >= 0.25 ? cagr(h.avgCost, price, years) : 0;
    const dayChange = h.kind === "stock" ? (quotes[h.symbol]?.change ?? 0) * h.qty : 0;
    return {
      ...h, currentPrice: price, price,
      priceSource: (live ? "live" : "reference") as EnrichedHolding["priceSource"],
      value, invested, pnl, pnlPct, years, holdCagr, dayChange, weight: 0,
      fundamentals: fundamentals[h.symbol.toUpperCase()],
      fundamentalsSource: (fundamentals[h.symbol.toUpperCase()] ? "live" : "reference") as EnrichedHolding["priceSource"],
      unresolved: !h.symbol.trim() || !live,
    };
  }), [holdings, quotes, fundNavs, fundamentals]);

  const totalBookValue = useMemo(() => enriched.reduce((s, h) => s + h.value, 0), [enriched]);
  const analysisRows: EnrichedHolding[] = useMemo(
    () => enriched.map((h) => ({ ...h, weight: totalBookValue > 0 ? (h.value / totalBookValue) * 100 : 0 })),
    [enriched, totalBookValue],
  );

  const totals = useMemo(() => {
    const totalValue = enriched.reduce((s, h) => s + h.value, 0);
    const totalInvested = enriched.reduce((s, h) => s + h.invested, 0);
    const stocksValue = enriched.filter((h) => h.kind === "stock").reduce((s, h) => s + h.value, 0);
    const fundsValue = enriched.filter((h) => h.kind === "fund").reduce((s, h) => s + h.value, 0);
    const dayChange = enriched.reduce((s, h) => s + h.dayChange, 0);
    const pnl = totalValue - totalInvested;
    const pnlPct = totalInvested > 0 ? pnl / totalInvested : 0;

    const cf = enriched.flatMap((h) => [
      { amount: -h.invested, date: new Date(h.buyDate) },
    ]);
    if (totalValue > 0) cf.push({ amount: totalValue, date: new Date() });
    const irr = cf.length > 1 ? xirr(cf) : null;

    // portfolio daily returns approximation from holdings' CAGR mix — Sharpe rough estimate
    const sortedByPct = [...enriched].sort((a, b) => b.pnlPct - a.pnlPct);
    const best = sortedByPct[0];
    const worst = sortedByPct[sortedByPct.length - 1];

    // rough Sharpe using per-holding annualised return proxy
    const weightedReturns = enriched.map((h) => (h.value / (totalValue || 1)) * h.holdCagr);
    const portReturn = weightedReturns.reduce((a, b) => a + b, 0);
    const approxDailyStd = 0.011; // 11% annualised placeholder for Phase 1
    const sharpe = approxDailyStd ? (portReturn - 0.065) / (approxDailyStd * Math.sqrt(252)) : 0;

    return { totalValue, totalInvested, stocksValue, fundsValue, dayChange, pnl, pnlPct, irr, best, worst, sharpe };
  }, [enriched]);

  const allocation = useMemo(() => {
    const stocks = enriched.filter((h) => h.kind === "stock").reduce((s, h) => s + h.value, 0);
    const funds = enriched.filter((h) => h.kind === "fund").reduce((s, h) => s + h.value, 0);
    return [
      { name: "Equity Stocks", value: stocks },
      { name: "Equity Funds", value: funds },
    ].filter((d) => d.value > 0);
  }, [enriched]);

  const sectorMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of enriched) {
      if (h.kind !== "stock") continue;
      const sec = h.sector || "Other";
      map.set(sec, (map.get(sec) || 0) + h.value);
    }
    return Array.from(map.entries()).map(([sector, value]) => ({ sector, value })).sort((a, b) => b.value - a.value);
  }, [enriched]);

  // handlers
  const onFile = async (file: File) => {
    setWarnings([]); setParseErrors([]); setAnalysis(null); setAnalysisError(null); setEnrichError(null);
    try {
      const res = await parseWorkbook(file);
      setWarnings(res.warnings);
      setParseErrors(res.errors);
      if (res.errors.length) { setHoldings([]); toast.error(res.errors[0]); setAnalyzed(false); return; }
      setHoldings(res.holdings);
      toast.success(`Parsed ${res.holdings.length} holdings — review before running analysis`);
      setAnalyzed(false);
    } catch (e) {
      setParseErrors([`Failed to parse "${file.name}": ${(e as Error).message}`]);
      toast.error("Failed to parse file");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const addStockRow = () => setHoldings((p) => [...p, {
    id: crypto.randomUUID(), kind: "stock", symbol: "", name: "", qty: 0, avgCost: 0, buyDate: new Date().toISOString(),
  }]);
  const addFundRow = () => setHoldings((p) => [...p, {
    id: crypto.randomUUID(), kind: "fund", symbol: "", name: "", qty: 0, avgCost: 0, buyDate: new Date().toISOString(),
  }]);
  const addEtfRow = () => setHoldings((p) => [...p, {
    id: crypto.randomUUID(), kind: "etf" as const, symbol: "", name: "", qty: 0, avgCost: 0, buyDate: new Date().toISOString(),
  }]);

  const patch = (id: string, updates: Partial<AnalyserHolding>) =>
    setHoldings((p) => p.map((h) => h.id === id ? { ...h, ...updates } : h));
  const remove = (id: string) => setHoldings((p) => p.filter((h) => h.id !== id));

  const importFromMyPortfolio = () => {
    const rows = readMyPortfolio();
    if (!rows.length) { toast.error("No holdings found in /portfolio"); return; }
    setHoldings((prev) => [
      ...prev,
      ...rows.map((r): AnalyserHolding => ({
        id: crypto.randomUUID(),
        kind: r.type,
        symbol: r.symbol,
        name: r.name,
        sector: r.sector,
        category: r.category,
        qty: r.qty,
        avgCost: r.avgCost,
        buyDate: r.buyDate || new Date().toISOString(),
        schemeCode: r.schemeCode,
      })),
    ]);
    toast.success(`Imported ${rows.length} holdings from Portfolio page`);
  };

  const savePortfolio = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(holdings)); toast.success("Portfolio saved"); }
    catch { toast.error("Save failed"); }
  };
  const loadPortfolio = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { toast.error("No saved portfolio"); return; }
      setHoldings(JSON.parse(raw));
      toast.success("Portfolio restored");
    } catch { toast.error("Load failed"); }
  };

  const analyze = async () => {
    if (!holdings.length) { toast.error("Add holdings first"); return; }
    const invalid = holdings.filter((h) => !h.symbol.trim() || !h.qty || !h.avgCost);
    if (invalid.length) {
      setAnalysisError(`${invalid.length} row(s) are missing a symbol, quantity or average cost. Fix them in the preview above before running the analysis.`);
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null); setEnrichError(null); setAnalysis(null);

    // 1) enrichment — fundamentals for listed instruments (prices already stream in via useLiveQuotes)
    setAnalysisStep("Enriching holdings with live market data…");
    const listed = holdings.filter((h) => h.kind === "stock" || h.kind === "etf").slice(0, 25);
    const got: Record<string, EnrichedHolding["fundamentals"]> = {};
    let failures = 0;
    await Promise.all(listed.map(async (h) => {
      const key = h.symbol.toUpperCase();
      if (fundamentals[key]) return;
      try {
        const r = await getFundamentals({ data: { symbol: `${key}.NS` } });
        if (r.ok) {
          got[key] = {
            sector: r.data.sector, marketCap: r.data.marketCap, pe: r.data.peTrailing,
            pb: r.data.pb, roePct: r.data.roePct, beta: r.data.beta,
            w52High: r.data.w52High, w52Low: r.data.w52Low,
          };
        } else failures++;
      } catch { failures++; }
    }));
    if (Object.keys(got).length) setFundamentals((p) => ({ ...p, ...got }));
    if (failures) setEnrichError(`Fundamentals could not be fetched for ${failures} instrument(s) — those rows are marked Reference and analysed qualitatively.`);

    // 2) analysis call
    setAnalysisStep("Running institutional analysis…");
    const total = enriched.reduce((s, h) => s + h.value, 0) || 1;
    const div = diversificationScore(analysisRows);
    try {
      const res = await runAnalysis({
        data: {
          holdings: enriched.map((h) => {
            const f = got[h.symbol.toUpperCase()] ?? h.fundamentals;
            return {
              symbol: h.symbol, name: h.name || h.symbol, kind: h.kind,
              qty: h.qty, avgCost: h.avgCost, price: h.price, priceSource: h.priceSource,
              value: h.value, weightPct: (h.value / total) * 100, pnlPct: h.pnlPct, years: h.years,
              sector: f?.sector ?? h.sector ?? null,
              category: h.category ?? null,
              marketCapCr: f?.marketCap ? f.marketCap / 1e7 : null,
              pe: f?.pe ?? null, pb: f?.pb ?? null, roePct: f?.roePct ?? null, beta: f?.beta ?? null,
              w52High: f?.w52High ?? null, w52Low: f?.w52Low ?? null,
            };
          }),
          totals: { value: total, invested: enriched.reduce((s, h) => s + h.invested, 0), pnlPct: totals.pnlPct },
          allocation: assetAllocation(analysisRows).map((a) => ({ label: a.label, pct: a.pct })),
          sectors: sectorConcentration(analysisRows).map((s) => ({ name: s.name, pct: s.pct })),
          diversification: { score: div.score, drag: div.drag },
          mandate: null,
        },
      });
      if (!res.ok || !res.result) {
        setAnalysisError(res.error ?? "Analysis failed.");
      } else {
        setAnalysis(res.result);
        setAnalyzed(true);
      }
    } catch (e) {
      setAnalysisError(`Analysis request failed: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
      setAnalysisStep("");
    }
  };

  const exportXlsx = () => {
    const rows = enriched.map((h) => ({
      name: h.name || h.symbol,
      kind: h.kind,
      qty: h.qty,
      avgCost: h.avgCost,
      currentValue: h.value,
      pnl: h.pnl,
      pnlPct: h.pnlPct,
      cagr: h.holdCagr,
      weight: totals.totalValue > 0 ? h.value / totals.totalValue : 0,
    }));
    exportHoldings(rows);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold dx-grad-text">🗂️ Portfolio Analyser</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload or enter your stocks + mutual funds. Get XIRR, Sharpe, forecast cones, tax and AI insights.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={savePortfolio} className="dx-pill flex items-center gap-1"><Save className="h-3.5 w-3.5" /> Save</button>
          <button onClick={loadPortfolio} className="dx-pill flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" /> Load</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("upload")}
          className={`px-4 py-2 text-sm font-mono ${tab === "upload" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
        >📤 Upload Excel / CSV</button>
        <button
          onClick={() => setTab("manual")}
          className={`px-4 py-2 text-sm font-mono ${tab === "manual" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
        >✏️ Manual Entry</button>
      </div>

      {tab === "upload" && (
        <div className="dx-glass p-6 space-y-4">
          <div
            ref={dropRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-primary/40 rounded-lg p-10 text-center hover:border-primary/70 hover:bg-primary/5 transition"
          >
            <Upload className="h-12 w-12 mx-auto text-primary/70 mb-3" />
            <p className="text-base font-semibold">Drag & drop your .xlsx / .csv here</p>
            <p className="text-xs text-muted-foreground mt-1">or</p>
            <label className="mt-3 inline-block dx-pill dx-pill-ok cursor-pointer">
              Browse file
              <input type="file" accept=".xlsx,.xls,.csv" hidden
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            <p className="text-[11px] text-muted-foreground mt-4">Accepted formats: .xlsx, .xls, .csv</p>
          </div>
          <div className="flex justify-between items-center">
            <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Download className="h-4 w-4" /> Download Template
            </button>
            <button onClick={importFromMyPortfolio} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Import className="h-4 w-4" /> Import from My Portfolio
            </button>
          </div>
        </div>
      )}

      {tab === "manual" && (
        <div className="dx-glass p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={addStockRow} className="dx-pill flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Stock</button>
            <button onClick={addFundRow} className="dx-pill flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Mutual Fund</button>
            <button onClick={addEtfRow} className="dx-pill flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add ETF</button>
            <button onClick={importFromMyPortfolio} className="dx-pill flex items-center gap-1"><Import className="h-3.5 w-3.5" /> Import from My Portfolio</button>
          </div>
          {holdings.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No holdings yet. Click "Add Stock" or "Add Mutual Fund" to begin.
            </div>
          )}
          <div className="space-y-2">
            {holdings.map((h) => (
              <div key={h.id} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1fr,auto] gap-2 items-center p-2 rounded border border-border bg-card/40">
                <div>
                  {h.kind === "stock" ? (
                    <StockCombobox
                      value={h.symbol ? { symbol: h.symbol, name: h.name, sector: h.sector || "Other", bucket: "nifty500" } as never : null}
                      onChange={(s) => patch(h.id, { symbol: s.symbol, name: s.name, sector: s.sector })}
                    />
                  ) : h.kind === "etf" ? (
                    <div className="flex gap-2">
                      <input placeholder="NSE symbol (e.g. NIFTYBEES)" value={h.symbol}
                        onChange={(e) => patch(h.id, { symbol: e.target.value.toUpperCase() })}
                        className="w-40 rounded border border-border bg-background/40 px-2 py-1.5 font-mono text-sm" />
                      <input placeholder="ETF name" value={h.name}
                        onChange={(e) => patch(h.id, { name: e.target.value })}
                        className="flex-1 rounded border border-border bg-background/40 px-2 py-1.5 text-sm" />
                    </div>
                  ) : (
                    <FundCombobox
                      value={h.schemeCode ? { code: h.schemeCode, name: h.name, house: "", category: h.category || "" } as never : null}
                      onChange={(f) => patch(h.id, { symbol: String(f.code), name: f.name, schemeCode: f.code, category: f.category })}
                    />
                  )}
                </div>
                <input type="number" placeholder="Qty/Units" value={h.qty || ""} onChange={(e) => patch(h.id, { qty: Number(e.target.value) })}
                  className="px-2 py-1.5 rounded border border-border bg-background/40 text-sm" />
                <input type="number" placeholder="Avg Cost" value={h.avgCost || ""} onChange={(e) => patch(h.id, { avgCost: Number(e.target.value) })}
                  className="px-2 py-1.5 rounded border border-border bg-background/40 text-sm" />
                <input type="date" value={h.buyDate.slice(0, 10)} onChange={(e) => patch(h.id, { buyDate: new Date(e.target.value).toISOString() })}
                  className="px-2 py-1.5 rounded border border-border bg-background/40 text-sm" />
                <button onClick={() => remove(h.id)} className="p-1.5 rounded hover:bg-destructive/20 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="dx-glass p-3 border-l-4 border-rose-500 text-sm">
          <div className="flex items-center gap-2 font-semibold text-rose-400 mb-1"><XCircle className="h-4 w-4" /> File could not be used</div>
          {parseErrors.map((w, i) => <div key={i} className="text-muted-foreground">{w}</div>)}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="dx-glass p-3 border-l-4 border-amber-500 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-400 mb-1"><AlertTriangle className="h-4 w-4" /> Warnings</div>
          {warnings.map((w, i) => <div key={i} className="text-muted-foreground">{w}</div>)}
        </div>
      )}

      {/* Editable preview before any analysis run */}
      {tab === "upload" && holdings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Review parsed holdings</h2>
            <span className="text-xs text-muted-foreground">Fix any misread row before running the analysis.</span>
          </div>
          <PreviewTable holdings={holdings} onPatch={patch} onRemove={remove} />
        </div>
      )}

      {/* Analyse button */}
      {holdings.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <button onClick={analyze} disabled={analyzing}
            className="dx-pill dx-pill-ok flex items-center gap-2 px-6 py-2 text-base font-semibold">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {analyzing ? analysisStep : `Run Analysis (${holdings.length} holdings)`}
          </button>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            Prices <SourceBadge source={analysisRows.some((h) => h.priceSource === "live") ? "live" : "reference"} />
            {analysisRows.filter((h) => h.priceSource === "reference").length > 0 &&
              `${analysisRows.filter((h) => h.priceSource === "reference").length} row(s) using user-supplied prices`}
          </div>
        </div>
      )}

      {enrichError && (
        <div className="dx-glass p-3 border-l-4 border-amber-500 text-sm text-muted-foreground">{enrichError}</div>
      )}
      {analysisError && (
        <div className="dx-glass p-3 border-l-4 border-rose-500 text-sm">
          <div className="flex items-center gap-2 font-semibold text-rose-400 mb-1"><XCircle className="h-4 w-4" /> Analysis failed</div>
          <div className="text-muted-foreground">{analysisError}</div>
        </div>
      )}

      {analysis && <ResultsDashboard result={analysis} rows={analysisRows} />}

      {/* Report */}
      {analyzed && holdings.length > 0 && (
        <div className="space-y-6">
          {/* Section A: Snapshot */}
          <section className="dx-glass p-4 md:p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">📊 Portfolio Snapshot</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Total Value" value={formatINR(totals.totalValue)} />
              <MetricCard label="Invested" value={formatINR(totals.totalInvested)} />
              <MetricCard label="P&L" value={formatINR(totals.pnl)} sub={`${(totals.pnlPct * 100).toFixed(2)}%`} tone={totals.pnl >= 0 ? "up" : "down"} />
              <MetricCard label="Today's Change" value={formatINR(totals.dayChange)} tone={totals.dayChange >= 0 ? "up" : "down"} />
              <MetricCard label="XIRR" value={totals.irr !== null ? `${(totals.irr * 100).toFixed(2)}%` : "—"} tone={(totals.irr ?? 0) >= 0 ? "up" : "down"} />
              <MetricCard label="Sharpe (est)" value={totals.sharpe.toFixed(2)} />
              <MetricCard label="Stocks Value" value={formatINR(totals.stocksValue)} />
              <MetricCard label="Funds Value" value={formatINR(totals.fundsValue)} />
            </div>

            {(totals.best || totals.worst) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {totals.best && (
                  <div className="p-3 rounded border-l-4 border-emerald-500 bg-emerald-500/5">
                    <div className="text-xs text-muted-foreground">Best Performer</div>
                    <div className="font-semibold mt-0.5 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /> {totals.best.name || totals.best.symbol}</div>
                    <div className="text-emerald-400 text-sm mt-0.5">+{(totals.best.pnlPct * 100).toFixed(2)}%</div>
                  </div>
                )}
                {totals.worst && totals.worst.id !== totals.best?.id && (
                  <div className="p-3 rounded border-l-4 border-red-500 bg-red-500/5">
                    <div className="text-xs text-muted-foreground">Worst Performer</div>
                    <div className="font-semibold mt-0.5 flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-400" /> {totals.worst.name || totals.worst.symbol}</div>
                    <div className="text-red-400 text-sm mt-0.5">{(totals.worst.pnlPct * 100).toFixed(2)}%</div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold mb-2">Asset Class Allocation</div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {allocation.map((_, i) => <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "#0a0a1a", border: "1px solid #333" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Sector Mix (stocks)</div>
                <div className="h-64">
                  {sectorMix.length > 0 ? (
                    <ResponsiveContainer>
                      <BarChart data={sectorMix} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" tick={{ fill: "#aaa", fontSize: 11 }} />
                        <YAxis type="category" dataKey="sector" tick={{ fill: "#aaa", fontSize: 11 }} width={90} />
                        <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "#0a0a1a", border: "1px solid #333" }} />
                        <Bar dataKey="value" fill="#00ffe0" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-sm text-muted-foreground flex items-center justify-center h-full">No stock holdings</div>}
                </div>
              </div>
            </div>
          </section>

          {/* Section B: Individual Holdings */}
          <section className="dx-glass p-4 md:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">📋 Individual Holdings</h2>
              <button onClick={exportXlsx} className="dx-pill flex items-center gap-1 text-xs">
                <Download className="h-3 w-3" /> Export XLSX
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Type</th>
                    <th className="text-right py-2 px-2">Qty</th>
                    <th className="text-right py-2 px-2">Avg Cost</th>
                    <th className="text-right py-2 px-2">Current</th>
                    <th className="text-right py-2 px-2">Value</th>
                    <th className="text-right py-2 px-2">P&L</th>
                    <th className="text-right py-2 px-2">P&L %</th>
                    <th className="text-right py-2 px-2">Holding</th>
                    <th className="text-right py-2 px-2">CAGR</th>
                    <th className="text-right py-2 px-2">Weight</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((h) => {
                    const weight = totals.totalValue > 0 ? h.value / totals.totalValue : 0;
                    const border = h.pnlPct > 0.2 ? "border-l-4 border-emerald-500" : h.pnlPct < -0.1 ? "border-l-4 border-red-500" : "";
                    return (
                      <tr key={h.id} className={`border-b border-border/40 ${border}`}>
                        <td className="py-2 px-2 font-medium">{h.name || h.symbol}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{h.kind === "stock" ? "Stock" : h.kind === "etf" ? "ETF" : "Fund"}</td>
                        <td className="py-2 px-2 text-right font-mono">{h.qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatINR(h.avgCost)}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatINR(h.currentPrice ?? 0)}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatINR(h.value)}</td>
                        <td className={`py-2 px-2 text-right font-mono ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatINR(h.pnl)}</td>
                        <td className={`py-2 px-2 text-right font-mono ${h.pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{(h.pnlPct * 100).toFixed(2)}%</td>
                        <td className="py-2 px-2 text-right text-xs text-muted-foreground">{h.years.toFixed(1)}y</td>
                        <td className={`py-2 px-2 text-right font-mono text-xs ${h.holdCagr >= 0 ? "text-emerald-400" : "text-red-400"}`}>{(h.holdCagr * 100).toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{(weight * 100).toFixed(1)}%</td>
                        <td className="py-2 px-2 text-center">
                          {h.kind === "stock" && (
                            <Link
                              to="/forecast"
                              search={{ symbol: h.symbol, type: "stock", horizon: "long" } as never}
                              className="text-xs text-primary hover:underline flex items-center gap-1 justify-center"
                            >
                              <Sparkles className="h-3 w-3" /> Forecast
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="dx-glass p-4 text-xs text-muted-foreground border-l-4 border-primary/60">
            <strong className="text-foreground">Coming next:</strong> Monte Carlo portfolio forecast cone, risk analysis (beta / correlation heatmap), AI-powered insights, SIP simulator, tax estimation, and PDF export are being wired up next. The 17-model Python forecasting engine (ARIMA, SARIMA, LSTM, GRU, Transformer, WaveNet, RF, GBM, SVR, KNN, Prophet, CNN, Ridge, Ensemble, Monte Carlo, Exp Smoothing) runs on the Forecaster page for individual assets — click "Forecast" on any holding row to jump there.
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-foreground";
  return (
    <div className="p-3 rounded border border-border bg-card/40">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold font-mono mt-0.5 ${color}`}>{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${color}`}>{sub}</div>}
    </div>
  );
}
