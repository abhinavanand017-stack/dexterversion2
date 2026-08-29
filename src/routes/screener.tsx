import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useVirtualizer } from "@tanstack/react-virtual";
import { screenerQuery, screenerCoverage } from "@/lib/screener/query.functions";
import type { ScreenerRow, ScreenerFilters, SortKey } from "@/lib/screener/query.server";
import { useWatchlist } from "@/components/WatchlistDrawer";
import { X, Download, Star, Filter, Sparkles, Database, RefreshCw, Search, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const searchSchema = z.object({ q: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/screener")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Market Screener — 2,000+ NSE Stocks | DEXTER" },
      { name: "description", content: "Screen the full NSE listed universe on live end-of-day price, RSI, moving averages, beta, volume surge and 52-week positioning — sourced from official NSE index files." },
      { property: "og:title", content: "Market Screener — 2,000+ NSE Stocks | DEXTER" },
      { property: "og:description", content: "Filter the entire NSE equity universe on real technical and price data with full source provenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScreenerPage,
});

const PAGE_SIZE = 100;

const DEFAULT_FILTERS: ScreenerFilters = {
  search: "",
  sectors: [],
  index: null,
  priceMin: null,
  priceMax: null,
  rsiMin: null,
  rsiMax: null,
  position: "all",
  aboveDma50: false,
  aboveDma200: false,
  ret1yMin: null,
};

const PENDING = <span className="text-muted-foreground/50 text-[10px]">Data pending</span>;

// Grouped index universe — values must match stock_universe.index_membership strings.
// No sectoral indices here: sector filtering lives in the chip row below.
const INDEX_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Broad market",
    options: [
      { value: "", label: "All 1,000" },
      { value: "NSE EQUITY LIST", label: "NSE equity list" },
      { value: "NIFTY TOTAL MARKET", label: "NIFTY Total Market" },
    ],
  },
  {
    label: "Large cap",
    options: [
      { value: "NIFTY 50", label: "NIFTY 50" },
      { value: "NIFTY NEXT 50", label: "NIFTY Next 50" },
      { value: "NIFTY 100", label: "NIFTY 100" },
      { value: "BSE SENSEX", label: "BSE Sensex" },
      { value: "BSE 100", label: "BSE 100" },
    ],
  },
  {
    label: "Large & mid cap",
    options: [
      { value: "NIFTY 200", label: "NIFTY 200" },
      { value: "NIFTY LARGEMIDCAP 250", label: "NIFTY LargeMidcap 250" },
    ],
  },
  {
    label: "Mid cap",
    options: [
      { value: "NIFTY MIDCAP 50", label: "NIFTY Midcap 50" },
      { value: "NIFTY MIDCAP 100", label: "NIFTY Midcap 100" },
      { value: "NIFTY MIDCAP 150", label: "NIFTY Midcap 150" },
      { value: "BSE MIDCAP", label: "BSE Midcap" },
    ],
  },
  {
    label: "Small cap",
    options: [
      { value: "NIFTY SMALLCAP 50", label: "NIFTY Smallcap 50" },
      { value: "NIFTY SMALLCAP 100", label: "NIFTY Smallcap 100" },
      { value: "NIFTY SMALLCAP 250", label: "NIFTY Smallcap 250" },
      { value: "BSE SMALLCAP", label: "BSE Smallcap" },
    ],
  },
  { label: "Micro cap", options: [{ value: "NIFTY MICROCAP 250", label: "NIFTY Microcap 250" }] },
  {
    label: "Composite",
    options: [
      { value: "NIFTY 500", label: "NIFTY 500" },
      { value: "BSE 500", label: "BSE 500" },
      { value: "BSE 1000", label: "BSE 1000" },
    ],
  },
];

interface CoverageLike {
  universe: number;
  indexCounts?: Record<string, number>;
}

function IndexCombobox({ value, onChange, cov }: { value: string | null; onChange: (v: string | null) => void; cov: CoverageLike | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const groups = INDEX_GROUPS
    .map((g) => ({ ...g, options: g.options.filter((o) => !q || o.label.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);

  const countFor = (v: string) => (v === "" ? cov?.universe : cov?.indexCounts?.[v]);
  const current = INDEX_GROUPS.flatMap((g) => g.options).find((o) => o.value === (value ?? ""));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full mt-1 px-2 py-1.5 rounded bg-muted/40 border border-border text-xs font-mono outline-none focus:border-primary hover:bg-muted/60 transition flex items-center justify-between gap-2">
          <span className="truncate text-foreground">{current?.label ?? "All 1,000"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search index…" />
          <CommandList className="max-h-[50vh]">
            {groups.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">No matching index</div>
            )}
            {groups.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.options.map((o) => {
                  const c = countFor(o.value);
                  const sel = (value ?? "") === o.value;
                  return (
                    <CommandItem
                      key={o.value || "all"}
                      value={o.label}
                      onSelect={() => { onChange(o.value || null); setOpen(false); setQuery(""); }}
                      className={"gap-2 " + (sel ? "text-primary bg-primary/10" : "")}
                    >
                      <span className="flex-1 truncate">{o.label}</span>
                      {c != null && <span className="text-[10px] text-muted-foreground shrink-0">{c.toLocaleString("en-IN")} stocks</span>}
                      {sel && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function num(v: number | null | undefined, digits = 2, suffix = "") {
  if (v == null || Number.isNaN(v)) return PENDING;
  return <>{v.toFixed(digits)}{suffix}</>;
}

function pct(v: number | null | undefined) {
  if (v == null) return PENDING;
  return <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</span>;
}

function fmtVol(v: number | null) {
  if (v == null) return PENDING;
  if (v >= 1e7) return <>{(v / 1e7).toFixed(2)}Cr</>;
  if (v >= 1e5) return <>{(v / 1e5).toFixed(2)}L</>;
  return <>{v.toLocaleString("en-IN")}</>;
}

const COLUMNS: { key: SortKey | null; label: string; w: string; align?: string }[] = [
  { key: "company_name", label: "Stock", w: "min-w-[220px]" },
  { key: null, label: "Sector", w: "w-[150px]" },
  { key: "close", label: "Close ₹", w: "w-[100px]", align: "text-right" },
  { key: "ret_1m_pct", label: "1M", w: "w-[80px]", align: "text-right" },
  { key: "ret_3m_pct", label: "3M", w: "w-[80px]", align: "text-right" },
  { key: "ret_1y_pct", label: "1Y", w: "w-[80px]", align: "text-right" },
  { key: "rsi14", label: "RSI 14", w: "w-[80px]", align: "text-right" },
  { key: "pct_from_52w_high", label: "vs 52W H", w: "w-[90px]", align: "text-right" },
  { key: "volume_vs_20d_avg", label: "Vol×20d", w: "w-[85px]", align: "text-right" },
  { key: "beta", label: "Beta", w: "w-[70px]", align: "text-right" },
  { key: "volume", label: "Volume", w: "w-[95px]", align: "text-right" },
  { key: null, label: "", w: "w-[90px]", align: "text-center" },
];

function ScreenerPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { add } = useWatchlist();

  const [filters, setFilters] = useState<ScreenerFilters>({ ...DEFAULT_FILTERS, search: search.q || "" });
  const [draftSearch, setDraftSearch] = useState(search.q || "");
  const [sortKey, setSortKey] = useState<SortKey>("close");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<ScreenerRow | null>(null);
  const [coverage, setCoverage] = useState<{
    universe: number; withPrice: number; withTechnicals: number;
    lastPriceRefresh: string | null; sectors: string[]; indexes: string[];
  } | null>(null);

  // debounce the text box into the live filter set
  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, search: draftSearch })), 300);
    return () => clearTimeout(id);
  }, [draftSearch]);

  useEffect(() => { setPage(0); }, [filters, sortKey, sortDir]);

  useEffect(() => {
    screenerCoverage()
      .then((c) => setCoverage(c))
      .catch(() => setCoverage(null));
  }, []);

  const reqId = useRef(0);
  const load = useCallback(() => {
    const id = ++reqId.current;
    setLoading(true);
    screenerQuery({ data: { filters, sortKey, sortDir, page, pageSize: PAGE_SIZE } })
      .then((res) => {
        if (id !== reqId.current) return;
        setRows(res.rows);
        setTotal(res.total);
        setErr(null);
      })
      .catch((e: Error) => { if (id === reqId.current) setErr(e.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [filters, sortKey, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 12,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (k: SortKey | null) => {
    if (!k) return;
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const toggleSector = (s: string) => {
    setFilters((f) => {
      const cur = f.sectors ?? [];
      return { ...f, sectors: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] };
    });
  };

  const exportCsv = () => {
    const head = ["Ticker", "Company", "Sector", "Close", "1M%", "3M%", "1Y%", "RSI14", "DMA50", "DMA200", "Beta", "VolVs20d", "Volume", "52WHigh", "52WLow", "PriceDate"];
    const lines = rows.map((r) => [
      r.ticker, `"${r.company_name.replace(/"/g, "'")}"`, r.sector ?? "", r.close ?? "", r.ret_1m_pct ?? "", r.ret_3m_pct ?? "",
      r.ret_1y_pct ?? "", r.rsi14 ?? "", r.dma50 ?? "", r.dma200 ?? "", r.beta ?? "", r.volume_vs_20d_avg ?? "",
      r.volume ?? "", r.w52_high ?? "", r.w52_low ?? "", r.price_date ?? "",
    ].join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dexter-screener-page${page + 1}.csv`;
    a.click();
    toast.success(`Exported ${rows.length} rows`);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.sectors?.length) n++;
    if (filters.index) n++;
    if (filters.priceMin != null || filters.priceMax != null) n++;
    if (filters.rsiMin != null || filters.rsiMax != null) n++;
    if (filters.position && filters.position !== "all") n++;
    if (filters.aboveDma50) n++;
    if (filters.aboveDma200) n++;
    if (filters.ret1yMin != null) n++;
    return n;
  }, [filters]);

  const cov = coverage;
  const covPct = cov && cov.universe ? Math.round((cov.withTechnicals / cov.universe) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Screener</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Full NSE listed universe · official index files + end-of-day price/technicals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="dx-pill inline-flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
          <button onClick={load} className="dx-pill inline-flex items-center gap-1.5">
            <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} /> Refresh
          </button>
          <button onClick={exportCsv} className="dx-pill inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Coverage meter */}
      <div className="dx-glass rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs font-mono">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> Coverage
        </span>
        {cov ? (
          <>
            <span><span className="text-foreground font-semibold">{cov.universe.toLocaleString("en-IN")}</span> <span className="text-muted-foreground">names</span></span>
            <span><span className="text-emerald-400 font-semibold">{cov.withPrice.toLocaleString("en-IN")}</span> <span className="text-muted-foreground">with price</span></span>
            <span><span className="text-cyan-400 font-semibold">{cov.withTechnicals.toLocaleString("en-IN")}</span> <span className="text-muted-foreground">with technicals</span></span>
            <div className="flex-1 min-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400/70" style={{ width: `${covPct}%` }} />
            </div>
            <span className="text-muted-foreground">
              {cov.lastPriceRefresh ? `Updated ${new Date(cov.lastPriceRefresh).toLocaleString("en-IN")}` : "Awaiting first refresh"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Loading coverage…</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Filters */}
        {showFilters && (
          <aside className="dx-glass rounded-xl p-4 space-y-4 h-fit lg:sticky lg:top-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search</label>
              <div className="relative mt-1">
                <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                <input
                  value={draftSearch}
                  onChange={(e) => { setDraftSearch(e.target.value); navigate({ to: "/screener", search: { q: e.target.value }, replace: true }); }}
                  placeholder="Ticker or company"
                  className="w-full pl-7 pr-2 py-1.5 rounded bg-muted/40 border border-border text-xs font-mono outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Index</label>
              <select
                value={filters.index ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, index: e.target.value || null }))}
                className="w-full mt-1 px-2 py-1.5 rounded bg-muted/40 border border-border text-xs font-mono outline-none focus:border-primary"
              >
                <option value="">All listed</option>
                {(cov?.indexes ?? []).map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sectors</label>
              <div className="mt-1 flex flex-wrap gap-1 max-h-44 overflow-y-auto">
                {(cov?.sectors ?? []).map((s) => {
                  const on = filters.sectors?.includes(s);
                  return (
                    <button key={s} onClick={() => toggleSector(s)}
                      className={"px-2 py-0.5 rounded text-[10px] border transition " + (on ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
                      {s}
                    </button>
                  );
                })}
                {!cov?.sectors.length && <span className="text-[10px] text-muted-foreground">Loading…</span>}
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Sector shown only for official index constituents; other listed names show “Data pending”.</p>
            </div>

            <NumRange label="Close price ₹" min={filters.priceMin} max={filters.priceMax}
              onMin={(v) => setFilters((f) => ({ ...f, priceMin: v }))} onMax={(v) => setFilters((f) => ({ ...f, priceMax: v }))} />
            <NumRange label="RSI 14" min={filters.rsiMin} max={filters.rsiMax}
              onMin={(v) => setFilters((f) => ({ ...f, rsiMin: v }))} onMax={(v) => setFilters((f) => ({ ...f, rsiMax: v }))} />

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">52-week position</label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(["all", "near-high", "near-low", "mid"] as const).map((p) => (
                  <button key={p} onClick={() => setFilters((f) => ({ ...f, position: p }))}
                    className={"px-2 py-1 rounded text-[10px] border " + (filters.position === p ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground")}>
                    {p === "all" ? "Any" : p === "near-high" ? "Near high" : p === "near-low" ? "Near low" : "Mid-range"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Check label="Above 50 DMA" checked={!!filters.aboveDma50} onChange={(v) => setFilters((f) => ({ ...f, aboveDma50: v }))} />
              <Check label="Above 200 DMA" checked={!!filters.aboveDma200} onChange={(v) => setFilters((f) => ({ ...f, aboveDma200: v }))} />
              <p className="text-[10px] text-muted-foreground/70">Moving-average filters apply to the loaded page.</p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min 1Y return %</label>
              <input type="number" value={filters.ret1yMin ?? ""} placeholder="any"
                onChange={(e) => setFilters((f) => ({ ...f, ret1yMin: e.target.value === "" ? null : Number(e.target.value) }))}
                className="w-full mt-1 px-2 py-1.5 rounded bg-muted/40 border border-border text-xs font-mono outline-none focus:border-primary" />
            </div>

            <button onClick={() => { setFilters({ ...DEFAULT_FILTERS }); setDraftSearch(""); }}
              className="w-full py-1.5 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground">
              Reset filters
            </button>
          </aside>
        )}

        {/* Table */}
        <div className="dx-glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs font-mono">
            <span className="text-muted-foreground">
              {loading ? "Querying…" : `${total.toLocaleString("en-IN")} matches`} · page {page + 1} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button disabled={page === 0 || loading} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-30">Prev</button>
              <button disabled={page >= totalPages - 1 || loading} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-30">Next</button>
            </div>
          </div>

          {err && <div className="px-3 py-6 text-center text-xs text-red-400 font-mono">Query failed: {err}</div>}

          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              {/* header row */}
              <div className="flex bg-muted/30 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                {COLUMNS.map((c) => (
                  <button key={c.label || "act"} onClick={() => toggleSort(c.key)}
                    className={`px-2 py-2 ${c.w} ${c.align ?? "text-left"} ${c.key ? "hover:text-foreground" : "cursor-default"} flex-none`}>
                    {c.label}{c.key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                ))}
              </div>

              <div ref={parentRef} className="max-h-[62vh] overflow-y-auto">
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((vi) => {
                    const r = rows[vi.index];
                    return (
                      <div key={r.ticker}
                        onClick={() => setSelected(r)}
                        className="flex items-center border-b border-border/50 text-xs hover:bg-muted/30 cursor-pointer absolute left-0 right-0"
                        style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}>
                        <div className="px-2 min-w-[220px] flex-none">
                          <div className="font-mono text-primary">{r.ticker}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.company_name}</div>
                        </div>
                        <div className="px-2 w-[150px] flex-none text-[10px] text-muted-foreground truncate">{r.sector ?? PENDING}</div>
                        <div className="px-2 w-[100px] flex-none text-right font-mono">{r.close == null ? PENDING : `₹${r.close.toLocaleString("en-IN")}`}</div>
                        <div className="px-2 w-[80px] flex-none text-right font-mono">{pct(r.ret_1m_pct)}</div>
                        <div className="px-2 w-[80px] flex-none text-right font-mono">{pct(r.ret_3m_pct)}</div>
                        <div className="px-2 w-[80px] flex-none text-right font-mono">{pct(r.ret_1y_pct)}</div>
                        <div className={"px-2 w-[80px] flex-none text-right font-mono " + (r.rsi14 == null ? "" : r.rsi14 > 70 ? "text-red-400" : r.rsi14 < 30 ? "text-emerald-400" : "")}>{num(r.rsi14, 1)}</div>
                        <div className="px-2 w-[90px] flex-none text-right font-mono">{num(r.pct_from_52w_high, 1, "%")}</div>
                        <div className={"px-2 w-[85px] flex-none text-right font-mono " + (r.volume_vs_20d_avg != null && r.volume_vs_20d_avg > 2 ? "text-amber-400" : "")}>{num(r.volume_vs_20d_avg, 2, "×")}</div>
                        <div className="px-2 w-[70px] flex-none text-right font-mono">{num(r.beta, 2)}</div>
                        <div className="px-2 w-[95px] flex-none text-right font-mono">{fmtVol(r.volume)}</div>
                        <div className="px-2 w-[90px] flex-none text-center">
                          <div className="inline-flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); add(r.ticker); toast.success(`${r.ticker} added to watchlist`); }} title="Watchlist" className="text-amber-400 hover:scale-110 transition"><Star className="h-3.5 w-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); navigate({ to: "/forecast", search: { symbol: r.ticker } as never }); }} title="Forecast" className="text-cyan-400 hover:scale-110 transition"><Sparkles className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!loading && !rows.length && !err && (
                <div className="px-3 py-12 text-center text-muted-foreground text-sm">
                  No stocks match your criteria.{" "}
                  <button onClick={() => { setFilters({ ...DEFAULT_FILTERS }); setDraftSearch(""); }} className="text-primary underline">Reset filters</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selected && <RowDetail row={selected} onClose={() => setSelected(null)} onWatch={(t) => { add(t); toast.success(`${t} added to watchlist`); }} />}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary" />
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </label>
  );
}

function NumRange({ label, min, max, onMin, onMax }: {
  label: string; min: number | null | undefined; max: number | null | undefined;
  onMin: (v: number | null) => void; onMax: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-1">
        <input type="number" placeholder="min" value={min ?? ""} onChange={(e) => onMin(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full px-2 py-1.5 rounded bg-muted/40 border border-border text-xs font-mono outline-none focus:border-primary" />
        <input type="number" placeholder="max" value={max ?? ""} onChange={(e) => onMax(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full px-2 py-1.5 rounded bg-muted/40 border border-border text-xs font-mono outline-none focus:border-primary" />
      </div>
    </div>
  );
}

function RowDetail({ row, onClose, onWatch }: { row: ScreenerRow; onClose: () => void; onWatch: (t: string) => void }) {
  const navigate = useNavigate();
  const stats: { label: string; value: React.ReactNode }[] = [
    { label: "Close", value: row.close == null ? PENDING : `₹${row.close.toLocaleString("en-IN")}` },
    { label: "Day open", value: row.open == null ? PENDING : `₹${row.open}` },
    { label: "Day high", value: row.high == null ? PENDING : `₹${row.high}` },
    { label: "Day low", value: row.low == null ? PENDING : `₹${row.low}` },
    { label: "52W high", value: row.w52_high == null ? PENDING : `₹${row.w52_high}` },
    { label: "52W low", value: row.w52_low == null ? PENDING : `₹${row.w52_low}` },
    { label: "RSI 14", value: num(row.rsi14, 1) },
    { label: "50 DMA", value: num(row.dma50, 2) },
    { label: "200 DMA", value: num(row.dma200, 2) },
    { label: "Beta (1Y vs NIFTY)", value: num(row.beta, 2) },
    { label: "Volume", value: fmtVol(row.volume) },
    { label: "Vol vs 20d avg", value: num(row.volume_vs_20d_avg, 2, "×") },
    { label: "1M return", value: pct(row.ret_1m_pct) },
    { label: "3M return", value: pct(row.ret_3m_pct) },
    { label: "1Y return", value: pct(row.ret_1y_pct) },
    { label: "Market cap", value: row.market_cap_cr == null ? PENDING : `₹${row.market_cap_cr.toLocaleString("en-IN")} Cr` },
    { label: "Free float", value: row.free_float_pct == null ? PENDING : `${row.free_float_pct}%` },
    { label: "Delivery %", value: row.delivery_pct == null ? PENDING : `${row.delivery_pct}%` },
  ];

  return (
    <div className="fixed inset-0 z-[180] bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="min-h-screen sm:p-6 flex items-start justify-center">
        <div className="w-full max-w-3xl dx-glass rounded-xl overflow-hidden">
          <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="dx-pill">{row.ticker}</span>
                <span className="dx-pill">{row.exchange}</span>
                {row.sector && <span className="dx-pill">{row.sector}</span>}
                {row.index_membership?.slice(0, 2).map((i) => <span key={i} className="dx-pill text-[10px]">{i}</span>)}
              </div>
              <h2 className="text-xl font-semibold">{row.company_name}</h2>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">
                EOD {row.price_date ?? "—"} · source: official NSE index list + Yahoo Finance daily bars
                {row.technicals_as_of ? ` · computed ${new Date(row.technicals_as_of).toLocaleString("en-IN")}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="font-mono text-sm mt-1">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 px-5 pb-5">
            <button onClick={() => onWatch(row.ticker)} className="dx-pill inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> Watchlist</button>
            <button onClick={() => navigate({ to: "/forecast", search: { symbol: row.ticker } as never })} className="dx-pill inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Forecast</button>
          </div>
        </div>
      </div>
    </div>
  );
}
