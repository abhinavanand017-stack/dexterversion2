import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search as SearchIcon, ArrowUpDown, X, Star, StarOff, GitCompare, Loader2,
  RefreshCw, Sparkles, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";
import { listEtfs, getEtfAumHistory, generateEtfResearchNote, type EtfRow } from "@/lib/etf.functions";
import { fetchYahooChart } from "@/lib/yahoo.functions";
import { runShortTermForecast, barsToOHLCV, HORIZON_DAYS, type Horizon, type EngineResult } from "@/lib/forecast/engine12";
import { runLongTermForecast, LONG_HORIZONS, cagrSourceLabel, type LongHorizon } from "@/lib/forecast/longterm";
import { BENCHMARK_YAHOO, structuralAllocation, STRATEGY_NOTE, CATEGORY_CHIPS, matchesChip, type CategoryChip } from "@/lib/etfMeta";

export const Route = createFileRoute("/etfs")({
  head: () => ({
    meta: [
      { title: "ETF Research — Live Indian ETF Screener · Dexter" },
      { name: "description", content: "Live NSE ETF screener with tracking error, cost vs category, holdings, peer comparison and multi-horizon NAV forecasts." },
      { property: "og:title", content: "Dexter ETF Research" },
      { property: "og:description", content: "Screen 50 Indian ETFs on live NAV, AUM, expense ratio and returns — with short and long-term NAV forecasts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EtfPage,
});

// ── design tokens (identical to /forecast) ──
const CARD = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.08)";
const BLUE = "#378ADD";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";

const LS_WATCH = "dx_fc_watch_v3";
const NA = "Not available";

function num(n: number | null | undefined, d = 2, suffix = ""): string {
  return n == null || Number.isNaN(n) ? NA : `${n.toFixed(d)}${suffix}`;
}
function crore(n: number | null | undefined): string {
  if (n == null) return NA;
  return n >= 100000 ? `₹${(n / 100000).toFixed(2)}L Cr` : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}
function pctColor(n: number | null | undefined) { return n == null ? MUTED : n >= 0 ? GREEN : RED; }
function fundSignal(s: EngineResult["signal"]): { label: string; color: string } {
  if (s === "STRONG BUY" || s === "BUY") return { label: "Accumulate", color: GREEN };
  if (s === "SELL" || s === "STRONG SELL") return { label: "Reduce", color: RED };
  return { label: "Hold", color: AMBER };
}

// ══════════════════════════ page ══════════════════════════

function EtfPage() {
  const load = useServerFn(listEtfs);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["etfs"],
    queryFn: () => load(),
    refetchInterval: 5 * 60_000,
  });

  const rows = data?.rows ?? [];
  const [chip, setChip] = useState<CategoryChip>("All");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<keyof EtfRow>("aum_cr");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [open, setOpen] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [watch, setWatch] = useState<string[]>([]);

  useEffect(() => {
    try { const r = localStorage.getItem(LS_WATCH); if (r) setWatch(JSON.parse(r) as string[]); } catch { /* ignore */ }
  }, []);
  const toggleWatch = (t: string) => {
    setWatch((w) => {
      const next = w.includes(t) ? w.filter((x) => x !== t) : [...w, t];
      try { localStorage.setItem(LS_WATCH, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const toggleCompare = (t: string) =>
    setCompare((c) => (c.includes(t) ? c.filter((x) => x !== t) : c.length >= 3 ? c : [...c, t]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = rows.filter(
      (e) => matchesChip(e.category, chip) &&
        (!s || e.etf_name.toLowerCase().includes(s) || e.ticker.toLowerCase().includes(s) ||
          (e.benchmark ?? "").toLowerCase().includes(s)),
    );
    return [...out].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
      return (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity)) * sortDir;
    });
  }, [rows, chip, q, sortKey, sortDir]);

  const sort = (k: keyof EtfRow) => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(-1); }
  };

  const active = rows.find((r) => r.ticker === open) ?? null;
  const compareRows = compare.map((t) => rows.find((r) => r.ticker === t)).filter((r): r is EtfRow => !!r);

  return (
    <div className="space-y-4 dx-fade-in">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ETF Research</h1>
          <p className="text-sm" style={{ color: MUTED }}>
            {rows.length} Indian ETFs, live from the Dexter database · prices refresh every 20 min in market hours
          </p>
        </div>
        <button onClick={() => refetch()} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
          style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_CHIPS.map((c) => (
          <button key={c} onClick={() => setChip(c)} data-active={chip === c}
            className="rounded-full px-3 py-1.5 text-xs transition data-[active=true]:text-white"
            style={{ background: chip === c ? BLUE : CARD, border: `1px solid ${BORDER}`, color: chip === c ? "#fff" : TEXT }}>
            {c}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <SearchIcon size={13} style={{ color: MUTED }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ETF or index…"
            className="w-48 bg-transparent text-xs outline-none" style={{ color: TEXT }} />
        </div>
      </div>

      {compareRows.length > 0 && <CompareTray rows={compareRows} onClear={() => setCompare([])} onRemove={toggleCompare} />}

      {isLoading && <div className="h-64 animate-pulse rounded-lg" style={{ background: CARD, border: `1px solid ${BORDER}` }} />}
      {(error || data?.ok === false) && !isLoading && (
        <div className="rounded-lg p-4 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}>
          Couldn't load the ETF database{data?.error ? `: ${data.error}` : ""}.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase" style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
              <tr>
                <Th label="ETF" k="etf_name" sortKey={sortKey} dir={sortDir} onSort={sort} />
                <th className="p-3 text-left">Category</th>
                <Th label="LTP / NAV" k="ltp_nav" sortKey={sortKey} dir={sortDir} onSort={sort} right />
                <Th label="Day %" k="day_change_pct" sortKey={sortKey} dir={sortDir} onSort={sort} right />
                <Th label="AUM" k="aum_cr" sortKey={sortKey} dir={sortDir} onSort={sort} right />
                <Th label="Expense %" k="expense_ratio_pct" sortKey={sortKey} dir={sortDir} onSort={sort} right />
                <Th label="1Y %" k="ret_1yr_pct" sortKey={sortKey} dir={sortDir} onSort={sort} right />
                <Th label="Volume" k="volume" sortKey={sortKey} dir={sortDir} onSort={sort} right />
                <th className="p-3 text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.ticker} className="cursor-pointer hover:bg-white/5" style={{ borderBottom: `1px solid ${BORDER}` }}
                  onClick={() => setOpen(e.ticker)}>
                  <td className="p-3">
                    <div className="font-medium" style={{ color: TEXT }}>{e.etf_name}</div>
                    <div className="font-mono text-[11px]" style={{ color: MUTED }}>{e.ticker}{e.benchmark ? ` · ${e.benchmark}` : ""}</div>
                  </td>
                  <td className="p-3"><span className="rounded px-2 py-0.5 text-[10px]" style={{ background: "rgba(55,138,221,0.15)", color: BLUE }}>{e.category}</span></td>
                  <td className="p-3 text-right tabular-nums">{num(e.ltp_nav)}</td>
                  <td className="p-3 text-right tabular-nums" style={{ color: pctColor(e.day_change_pct) }}>{num(e.day_change_pct, 2, "%")}</td>
                  <td className="p-3 text-right text-xs">{crore(e.aum_cr)}</td>
                  <td className="p-3 text-right tabular-nums">{num(e.expense_ratio_pct)}</td>
                  <td className="p-3 text-right tabular-nums" style={{ color: pctColor(e.ret_1yr_pct) }}>{num(e.ret_1yr_pct, 2, "%")}</td>
                  <td className="p-3 text-right text-xs" style={{ color: MUTED }}>{e.volume == null ? NA : e.volume.toLocaleString("en-IN")}</td>
                  <td className="p-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button title="Watchlist" onClick={() => toggleWatch(e.ticker)} className="rounded p-1 hover:bg-white/10">
                        {watch.includes(e.ticker) ? <Star size={13} style={{ color: AMBER }} /> : <StarOff size={13} style={{ color: MUTED }} />}
                      </button>
                      <button title="Compare" onClick={() => toggleCompare(e.ticker)} className="rounded p-1 hover:bg-white/10">
                        <GitCompare size={13} style={{ color: compare.includes(e.ticker) ? BLUE : MUTED }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-sm" style={{ color: MUTED }}>No ETFs match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] italic" style={{ color: MUTED }}>
        Research output, not investment advice. Forecasts are model estimates on historical NAV series and can be wrong.
      </p>

      {active && (
        <EtfModal
          etf={active}
          all={rows}
          onClose={() => setOpen(null)}
          watched={watch.includes(active.ticker)}
          onWatch={() => toggleWatch(active.ticker)}
          compared={compare.includes(active.ticker)}
          onCompare={() => toggleCompare(active.ticker)}
          onOpenTicker={(t) => setOpen(t)}
        />
      )}
    </div>
  );
}

function Th({ label, k, sortKey, dir, onSort, right }: {
  label: string; k: keyof EtfRow; sortKey: keyof EtfRow; dir: number; onSort: (k: keyof EtfRow) => void; right?: boolean;
}) {
  return (
    <th className={`cursor-pointer select-none p-3 ${right ? "text-right" : "text-left"}`} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown size={11} className="opacity-50" />
        {sortKey === k && <span style={{ color: BLUE }}>{dir === 1 ? "▲" : "▼"}</span>}</span>
    </th>
  );
}

function CompareTray({ rows, onClear, onRemove }: { rows: EtfRow[]; onClear: () => void; onRemove: (t: string) => void }) {
  return (
    <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: MUTED }}>
        <GitCompare size={13} /> Comparing {rows.length} ETF{rows.length > 1 ? "s" : ""}
        <button onClick={onClear} className="ml-auto text-[11px] hover:underline" style={{ color: BLUE }}>Clear</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead style={{ color: MUTED }}><tr>
            <th className="p-2 text-left">ETF</th><th className="p-2 text-right">LTP</th><th className="p-2 text-right">Expense %</th>
            <th className="p-2 text-right">AUM</th><th className="p-2 text-right">Tracking err</th><th className="p-2 text-right">1Y %</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td className="p-2">{r.etf_name}</td>
                <td className="p-2 text-right tabular-nums">{num(r.ltp_nav)}</td>
                <td className="p-2 text-right tabular-nums">{num(r.expense_ratio_pct)}</td>
                <td className="p-2 text-right">{crore(r.aum_cr)}</td>
                <td className="p-2 text-right">{num(r.tracking_error_pct)}</td>
                <td className="p-2 text-right tabular-nums" style={{ color: pctColor(r.ret_1yr_pct) }}>{num(r.ret_1yr_pct, 2, "%")}</td>
                <td className="p-2 text-right"><button onClick={() => onRemove(r.ticker)}><X size={12} style={{ color: MUTED }} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════ modal ══════════════════════════

type Tab = "overview" | "holdings" | "performance" | "forecast" | "note";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "holdings", label: "Holdings & Composition" },
  { id: "performance", label: "Performance" },
  { id: "forecast", label: "Forecast" },
  { id: "note", label: "Research Note" },
];

function EtfModal({ etf, all, onClose, watched, onWatch, compared, onCompare, onOpenTicker }: {
  etf: EtfRow; all: EtfRow[]; onClose: () => void; watched: boolean; onWatch: () => void;
  compared: boolean; onCompare: () => void; onOpenTicker: (t: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const catAvgExpense = useMemo(() => {
    const v = all.filter((r) => r.category === etf.category && r.expense_ratio_pct != null).map((r) => r.expense_ratio_pct!);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }, [all, etf.category]);

  const peers = useMemo(
    () => all.filter((r) => r.ticker !== etf.ticker && (r.benchmark === etf.benchmark || r.category === etf.category))
      .sort((a, b) => (b.aum_cr ?? 0) - (a.aum_cr ?? 0)).slice(0, 3),
    [all, etf],
  );

  const premiumPct = etf.inav && etf.ltp_nav ? ((etf.ltp_nav - etf.inav) / etf.inav) * 100 : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="my-6 w-full max-w-5xl rounded-xl" style={{ background: "#0a0a1a", border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start gap-3 p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: TEXT }}>{etf.etf_name}</h2>
            <div className="text-xs" style={{ color: MUTED }}>{etf.ticker} · {etf.category} · {etf.benchmark ?? NA}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onWatch} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: watched ? AMBER : TEXT }}>
              {watched ? <Star size={13} /> : <StarOff size={13} />} {watched ? "In watchlist" : "Add to Watchlist"}
            </button>
            <button onClick={onCompare} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
              style={{ background: compared ? BLUE : CARD, border: `1px solid ${BORDER}`, color: compared ? "#fff" : TEXT }}>
              <GitCompare size={13} /> {compared ? "Comparing" : "Compare"}
            </button>
            <button onClick={onClose} className="rounded-md p-1.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}><X size={14} style={{ color: TEXT }} /></button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4 pt-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="whitespace-nowrap px-3 py-2 text-xs"
              style={{ color: tab === t.id ? BLUE : MUTED, borderBottom: `2px solid ${tab === t.id ? BLUE : "transparent"}` }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "overview" && <OverviewTab etf={etf} premiumPct={premiumPct} catAvgExpense={catAvgExpense} peers={peers} onOpenTicker={onOpenTicker} />}
          {tab === "holdings" && <HoldingsTab etf={etf} />}
          {tab === "performance" && <PerformanceTab etf={etf} all={all} />}
          {tab === "forecast" && <ForecastTab etf={etf} />}
          {tab === "note" && <NoteTab etf={etf} peers={peers} catAvgExpense={catAvgExpense} premiumPct={premiumPct} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md p-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] uppercase" style={{ color: MUTED }}>{label}</div>
      <div className="font-mono text-sm" style={{ color: color ?? TEXT }}>{value}</div>
    </div>
  );
}

// ── Tab 1: Overview ──
function OverviewTab({ etf, premiumPct, catAvgExpense, peers, onOpenTicker }: {
  etf: EtfRow; premiumPct: number | null; catAvgExpense: number | null; peers: EtfRow[]; onOpenTicker: (t: string) => void;
}) {
  const chart = useServerFn(fetchYahooChart);
  const bench = etf.benchmark ? BENCHMARK_YAHOO[etf.benchmark] : undefined;

  const etfQ = useQuery({ queryKey: ["etf-chart", etf.ticker], queryFn: () => chart({ data: { symbol: `${etf.ticker}.NS`, range: "1y", interval: "1d" } }) });
  const benchQ = useQuery({ queryKey: ["etf-bench", bench], enabled: !!bench, queryFn: () => chart({ data: { symbol: bench!, range: "1y", interval: "1d" } }) });

  const series = useMemo(() => {
    const eb = etfQ.data?.ok ? etfQ.data.bars : [];
    if (!eb.length) return [];
    const base = eb[0].c;
    const bmap = new Map<string, number>();
    if (benchQ.data?.ok && benchQ.data.bars.length) {
      const bb = benchQ.data.bars; const bbase = bb[0].c;
      for (const b of bb) bmap.set(new Date(b.t).toISOString().slice(0, 10), (b.c / bbase - 1) * 100);
    }
    return eb.map((b) => {
      const d = new Date(b.t).toISOString().slice(0, 10);
      return { date: d, etf: +((b.c / base - 1) * 100).toFixed(2), bench: bmap.get(d) != null ? +bmap.get(d)!.toFixed(2) : null };
    });
  }, [etfQ.data, benchQ.data]);

  const cheaper = catAvgExpense != null && etf.expense_ratio_pct != null
    ? etf.expense_ratio_pct < catAvgExpense ? "below" : etf.expense_ratio_pct > catAvgExpense ? "above" : "in line with"
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="LTP / NAV" value={num(etf.ltp_nav)} />
        <Stat label="Day change" value={num(etf.day_change_pct, 2, "%")} color={pctColor(etf.day_change_pct)} />
        <Stat label="iNAV premium / discount" value={premiumPct == null ? NA : `${premiumPct >= 0 ? "+" : ""}${premiumPct.toFixed(2)}%`} />
        <Stat label="Tracking error" value={num(etf.tracking_error_pct, 2, "%")} />
        <Stat label="AUM" value={crore(etf.aum_cr)} />
        <Stat label="Expense ratio" value={num(etf.expense_ratio_pct, 2, "%")} />
        <Stat label="AMC" value={etf.amc ?? NA} />
        <Stat label="Inception" value={etf.inception_date ?? NA} />
        <Stat label="52-week high" value={num(etf.w52_high)} />
        <Stat label="52-week low" value={num(etf.w52_low)} />
        <Stat label="Avg daily volume" value={etf.volume == null ? NA : etf.volume.toLocaleString("en-IN")} />
        <Stat label="Avg bid-ask spread" value={NA} />
      </div>

      {cheaper && (
        <div className="rounded-md p-3 text-xs" style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
          Expense ratio <b>{etf.expense_ratio_pct!.toFixed(2)}%</b> — {cheaper} the {etf.category} category average of {catAvgExpense!.toFixed(2)}%.
        </div>
      )}

      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-2 text-xs" style={{ color: MUTED }}>
          1-year performance {bench ? `vs ${etf.benchmark}` : "(benchmark series not available)"} · rebased to 0%
        </div>
        {etfQ.isLoading ? <div className="h-56 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
          : series.length === 0 ? <div className="p-6 text-center text-xs" style={{ color: MUTED }}>Price history unavailable for {etf.ticker}.NS</div>
            : (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={series}>
                  <CartesianGrid stroke={BORDER} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10, fill: MUTED }} unit="%" />
                  <Tooltip contentStyle={{ background: "#0a0a1a", border: `1px solid ${BORDER}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="etf" name={etf.ticker} stroke={BLUE} dot={false} strokeWidth={2} />
                  {bench && <Line type="monotone" dataKey="bench" name={etf.benchmark ?? "Benchmark"} stroke={AMBER} dot={false} strokeWidth={1.5} connectNulls />}
                </LineChart>
              </ResponsiveContainer>
            )}
      </div>

      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-2 text-xs" style={{ color: MUTED }}>Peer comparison — similar mandate</div>
        <table className="w-full text-xs">
          <thead style={{ color: MUTED }}><tr><th className="p-1.5 text-left">ETF</th><th className="p-1.5 text-right">Expense %</th><th className="p-1.5 text-right">AUM</th><th className="p-1.5 text-right">Tracking err</th></tr></thead>
          <tbody>
            {peers.map((p) => (
              <tr key={p.ticker} className="cursor-pointer hover:bg-white/5" style={{ borderTop: `1px solid ${BORDER}` }} onClick={() => onOpenTicker(p.ticker)}>
                <td className="p-1.5" style={{ color: BLUE }}>{p.etf_name}</td>
                <td className="p-1.5 text-right tabular-nums">{num(p.expense_ratio_pct)}</td>
                <td className="p-1.5 text-right">{crore(p.aum_cr)}</td>
                <td className="p-1.5 text-right">{num(p.tracking_error_pct)}</td>
              </tr>
            ))}
            {peers.length === 0 && <tr><td colSpan={4} className="p-3 text-center" style={{ color: MUTED }}>No close peers in the universe.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 2: Holdings ──
const PIE_COLORS = [BLUE, AMBER, GREEN, "#a78bfa", "#f472b6"];

function HoldingsTab({ etf }: { etf: EtfRow }) {
  const alloc = structuralAllocation(etf.category);
  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-1 text-xs" style={{ color: MUTED }}>Strategy</div>
        <p className="text-sm" style={{ color: TEXT }}>{STRATEGY_NOTE[etf.category] ?? NA}</p>
      </div>

      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-2 text-xs" style={{ color: MUTED }}>Asset allocation</div>
        {alloc ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={alloc} dataKey="weight" nameKey="label" outerRadius={80} label={{ fontSize: 11, fill: TEXT }}>
                {alloc.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a0a1a", border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs" style={{ color: MUTED }}>
            Sector allocation for {etf.benchmark ?? "this index"} is not available — no holdings feed is wired up yet.
            The fund replicates its benchmark, so its sector mix mirrors that index.
          </p>
        )}
      </div>

      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-1 text-xs" style={{ color: MUTED }}>Top 10 holdings</div>
        <p className="flex items-center gap-2 text-xs" style={{ color: AMBER }}>
          <AlertTriangle size={13} /> Not available — a constituent-level holdings feed is not connected. No placeholder weights are shown.
        </p>
      </div>
    </div>
  );
}

// ── Tab 3: Performance ──
function PerformanceTab({ etf, all }: { etf: EtfRow; all: EtfRow[] }) {
  const aum = useServerFn(getEtfAumHistory);
  const aumQ = useQuery({ queryKey: ["etf-aum", etf.ticker], queryFn: () => aum({ data: { ticker: etf.ticker } }) });

  const catAvg = (k: keyof EtfRow) => {
    const v = all.filter((r) => r.category === etf.category && r[k] != null).map((r) => r[k] as number);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const rows: { label: string; k: keyof EtfRow }[] = [
    { label: "1 Month", k: "ret_1m_pct" }, { label: "3 Months", k: "ret_3m_pct" },
    { label: "1 Year", k: "ret_1yr_pct" }, { label: "3 Years", k: "ret_3yr_pct" }, { label: "5 Years", k: "ret_5yr_pct" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-2 text-xs" style={{ color: MUTED }}>Trailing returns vs category average</div>
        <table className="w-full text-xs">
          <thead style={{ color: MUTED }}><tr><th className="p-1.5 text-left">Period</th><th className="p-1.5 text-right">{etf.ticker}</th><th className="p-1.5 text-right">Category avg</th><th className="p-1.5 text-right">Difference</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const v = etf[r.k] as number | null; const a = catAvg(r.k);
              const d = v != null && a != null ? v - a : null;
              return (
                <tr key={r.k} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td className="p-1.5">{r.label}</td>
                  <td className="p-1.5 text-right tabular-nums" style={{ color: pctColor(v) }}>{num(v, 2, "%")}</td>
                  <td className="p-1.5 text-right tabular-nums" style={{ color: MUTED }}>{num(a, 2, "%")}</td>
                  <td className="p-1.5 text-right tabular-nums" style={{ color: pctColor(d) }}>{d == null ? NA : `${d >= 0 ? "+" : ""}${d.toFixed(2)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px]" style={{ color: MUTED }}>
          6-month and benchmark-level return series are not in the dataset yet — shown as {NA} rather than estimated.
        </p>
      </div>

      <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="mb-2 text-xs" style={{ color: MUTED }}>AUM trend (₹ Cr)</div>
        {aumQ.isLoading ? <div className="h-40 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
          : (aumQ.data?.points.length ?? 0) < 2
            ? <p className="text-xs" style={{ color: MUTED }}>Only {aumQ.data?.points.length ?? 0} snapshot recorded so far — the trend chart fills in as daily snapshots accumulate.</p>
            : (
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={aumQ.data!.points}>
                  <CartesianGrid stroke={BORDER} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: MUTED }} />
                  <Tooltip contentStyle={{ background: "#0a0a1a", border: `1px solid ${BORDER}`, fontSize: 12 }} />
                  <Area type="monotone" dataKey="aum" stroke={BLUE} fill="rgba(55,138,221,0.18)" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
      </div>
    </div>
  );
}

// ── Tab 4: Forecast ──
const SHORT: { id: Horizon; label: string }[] = [
  { id: "1M", label: "30 days" }, { id: "3M", label: "90 days" }, { id: "6M", label: "180 days" },
];

function ForecastTab({ etf }: { etf: EtfRow }) {
  const chart = useServerFn(fetchYahooChart);
  const [advanced, setAdvanced] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>("1M");
  const [longH, setLongH] = useState<LongHorizon>("3y");

  const q = useQuery({
    queryKey: ["etf-nav-history", etf.ticker],
    queryFn: () => chart({ data: { symbol: `${etf.ticker}.NS`, range: "5y", interval: "1d" } }),
  });

  const bars = q.data?.ok ? q.data.bars : [];
  const short = useMemo<EngineResult | null>(() => {
    if (bars.length < 60) return null;
    try { return runShortTermForecast(barsToOHLCV(bars), horizon); } catch { return null; }
  }, [bars, horizon]);

  const long = useMemo(() => {
    if (bars.length < 60) return null;
    try {
      return runLongTermForecast({
        bars, horizon: longH, confidence: 90,
        fundCagr: { r1: etf.ret_1yr_pct, r3: etf.ret_3yr_pct, r5: etf.ret_5yr_pct },
      });
    } catch { return null; }
  }, [bars, longH, etf]);

  if (q.isLoading) return <div className="h-64 animate-pulse rounded-lg" style={{ background: CARD, border: `1px solid ${BORDER}` }} />;

  if (!bars.length || bars.length < 60) {
    return (
      <div className="rounded-lg p-4 text-sm" style={{ background: "rgba(245,158,11,0.08)", border: `1px solid ${AMBER}`, color: TEXT }}>
        <div className="mb-1 flex items-center gap-2 font-medium" style={{ color: AMBER }}><AlertTriangle size={14} /> Demo data — forecast unavailable</div>
        NAV history for {etf.ticker}.NS could not be fetched, so no forecast is produced. No numbers are fabricated here.
      </div>
    );
  }

  const sig = short ? fundSignal(short.signal) : null;
  const spot = bars[bars.length - 1].c;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {SHORT.filter((h) => advanced || h.id === "1M").map((h) => (
          <button key={h.id} onClick={() => setHorizon(h.id)}
            className="rounded-md px-3 py-1.5 text-xs"
            style={{ background: horizon === h.id ? BLUE : CARD, border: `1px solid ${BORDER}`, color: horizon === h.id ? "#fff" : TEXT }}>
            {h.label}
          </button>
        ))}
        <button onClick={() => { setAdvanced((v) => !v); if (advanced) setHorizon("1M"); }}
          className="rounded-md px-3 py-1.5 text-xs" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
          {advanced ? "Hide advanced" : "Advanced (90d / 180d / long term)"}
        </button>
      </div>

      {short && sig && (
        <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: MUTED }}>
            <span className="rounded px-2 py-0.5 text-[11px] font-medium" style={{ background: `${sig.color}22`, color: sig.color }}>{sig.label}</span>
            <span>Short-term engine · 12 weighted technical models · {HORIZON_DAYS[horizon]}-day horizon · daily NAV series from Yahoo ({etf.ticker}.NS)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Spot NAV" value={`₹${spot.toFixed(2)}`} />
            <Stat label="Projected NAV" value={`₹${short.targetPrice.toFixed(2)}`} color={short.upsidePct >= 0 ? GREEN : RED} />
            <Stat label="Range low" value={`₹${short.bearTarget.toFixed(2)}`} />
            <Stat label="Range high" value={`₹${short.bullTarget.toFixed(2)}`} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={short.forecastPath}>
              <CartesianGrid stroke={BORDER} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} minTickGap={30} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: MUTED }} />
              <Tooltip contentStyle={{ background: "#0a0a1a", border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(55,138,221,0.14)" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="rgba(10,10,26,1)" />
              <Line type="monotone" dataKey="price" stroke={BLUE} dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 text-[11px]" style={{ color: MUTED }}>
            Confidence {short.confidence}% · {short.buyCount} bullish / {short.holdCount} neutral / {short.sellCount} bearish models
          </div>
        </div>
      )}

      {advanced && long && (
        <div className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {LONG_HORIZONS.map((h) => (
              <button key={h.id} onClick={() => setLongH(h.id)} className="rounded-md px-2.5 py-1 text-[11px]"
                style={{ background: longH === h.id ? BLUE : "transparent", border: `1px solid ${BORDER}`, color: longH === h.id ? "#fff" : TEXT }}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="mb-2 text-xs" style={{ color: MUTED }}>
            Long-term panel · CAGR extrapolation + {long.paths.toLocaleString()}-path Monte Carlo, 90% band · drift from {cagrSourceLabel(long.cagrSource)}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="CAGR used" value={`${long.cagrUsed.toFixed(2)}%`} />
            <Stat label="Median outcome" value={`₹${long.endMedian.toFixed(2)}`} />
            <Stat label="10th percentile" value={`₹${long.endLow.toFixed(2)}`} />
            <Stat label="90th percentile" value={`₹${long.endHigh.toFixed(2)}`} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={long.timestamps.map((t, i) => ({
              date: new Date(t).toISOString().slice(0, 10),
              median: +long.mcMedian[i].toFixed(2), low: +long.mcLow[i].toFixed(2), high: +long.mcHigh[i].toFixed(2), cagr: +long.cagrPath[i].toFixed(2),
            }))}>
              <CartesianGrid stroke={BORDER} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: MUTED }} />
              <Tooltip contentStyle={{ background: "#0a0a1a", border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Area type="monotone" dataKey="high" stroke="none" fill="rgba(55,138,221,0.14)" />
              <Area type="monotone" dataKey="low" stroke="none" fill="rgba(10,10,26,1)" />
              <Line type="monotone" dataKey="median" stroke={BLUE} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="cagr" stroke={AMBER} dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 text-[11px]" style={{ color: MUTED }}>
            Sanity check vs the fund's own trailing returns — 1Y {num(etf.ret_1yr_pct, 2, "%")}, 3Y {num(etf.ret_3yr_pct, 2, "%")}, 5Y {num(etf.ret_5yr_pct, 2, "%")} (cumulative).
            Probability of ending above today: {long.probPositive.toFixed(0)}%.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Research note ──
function NoteTab({ etf, peers, catAvgExpense, premiumPct }: {
  etf: EtfRow; peers: EtfRow[]; catAvgExpense: number | null; premiumPct: number | null;
}) {
  const gen = useServerFn(generateEtfResearchNote);
  const [style, setStyle] = useState<"banker" | "mckinsey">("banker");
  const m = useMutation({
    mutationFn: (s: "banker" | "mckinsey") => gen({
      data: {
        style: s, name: etf.etf_name, ticker: etf.ticker, category: etf.category, benchmark: etf.benchmark, amc: etf.amc,
        ltp: etf.ltp_nav, dayChangePct: etf.day_change_pct, aumCr: etf.aum_cr, expenseRatio: etf.expense_ratio_pct,
        categoryAvgExpense: catAvgExpense, trackingError: etf.tracking_error_pct, premiumDiscountPct: premiumPct,
        ret1m: etf.ret_1m_pct, ret1y: etf.ret_1yr_pct, ret3y: etf.ret_3yr_pct, ret5y: etf.ret_5yr_pct,
        peers: peers.map((p) => ({ name: p.etf_name, expense: p.expense_ratio_pct, aum: p.aum_cr, te: p.tracking_error_pct })),
      },
    }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["banker", "mckinsey"] as const).map((s) => (
          <button key={s} onClick={() => setStyle(s)} className="rounded-md px-3 py-1.5 text-xs"
            style={{ background: style === s ? BLUE : CARD, border: `1px solid ${BORDER}`, color: style === s ? "#fff" : TEXT }}>
            {s === "banker" ? "Investment Banker" : "McKinsey Partner"}
          </button>
        ))}
        <button onClick={() => m.mutate(style)} disabled={m.isPending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
          style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
          {m.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate note
        </button>
      </div>

      {!m.data && !m.isPending && <p className="text-xs" style={{ color: MUTED }}>Generate a 200–300 word note built strictly from this ETF's own data — cost, tracking, returns and peers.</p>}
      {m.data?.ok === false && (
        <div className="rounded-md p-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: `1px solid ${AMBER}`, color: TEXT }}>
          {m.data.error}
        </div>
      )}
      {m.data?.ok && (
        <div className="whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed" style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT }}>
          {m.data.text}
        </div>
      )}
    </div>
  );
}
