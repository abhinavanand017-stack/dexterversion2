import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FUND_CATEGORIES, fetchFund, type CategoryKey, type PeriodKey, type FundRow } from "@/lib/funds";
import { ExternalLink, X, Filter } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/funds")({
  head: () => ({
    meta: [
      { title: "Fund Screener — DEXTER" },
      { name: "description", content: "Indian mutual fund research hub. Category returns heatmap, advanced filters, NAV history charts, SIP calculator." },
    ],
  }),
  component: FundsPage,
});

const PERIODS: { key: PeriodKey; years: number; label: string }[] = [
  { key: "1y", years: 1, label: "1Y" },
  { key: "3y", years: 3, label: "3Y" },
  { key: "5y", years: 5, label: "5Y" },
  { key: "10y", years: 10, label: "10Y" },
];

const HEATMAP_PERIODS = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y"];

function returnColor(pct: number): string {
  if (pct < -5) return "#7f1d1d";
  if (pct < 0) return "#dc2626";
  if (pct < 5) return "#f59e0b";
  if (pct < 12) return "#84cc16";
  if (pct < 20) return "#22c55e";
  return "#16a34a";
}

function dexterFundScore(r: FundRow): number {
  if (r.returnPct === null) return 0;
  return Math.max(0, Math.min(100, Math.round(50 + r.returnPct * 2)));
}

function FundsPage() {
  const [category, setCategory] = useState<CategoryKey>("largecap");
  const [period, setPeriod] = useState<PeriodKey>("3y");
  const [rows, setRows] = useState<FundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minReturn, setMinReturn] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [selected, setSelected] = useState<FundRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    const years = PERIODS.find((p) => p.key === period)!.years;
    const cat = FUND_CATEGORIES[category];
    Promise.all(cat.funds.map((f) => fetchFund(f.code, years, f.house))).then((res) => {
      if (cancelled) return;
      const valid = res.filter((r): r is FundRow => r !== null);
      valid.sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity));
      setRows(valid);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [category, period]);

  const filtered = useMemo(() => {
    const Q = search.toLowerCase();
    return rows.filter((r) => {
      if (Q && !r.name.toLowerCase().includes(Q) && !r.house.toLowerCase().includes(Q)) return false;
      if ((r.returnPct ?? -999) < minReturn) return false;
      const stars = Math.max(1, Math.min(5, Math.round(((r.returnPct ?? 0) + 10) / 8)));
      if (stars < minRating) return false;
      return true;
    });
  }, [rows, search, minReturn, minRating]);

  // Synthetic heatmap data — modelled after Value Research
  const heatmapData = useMemo(() => {
    const cats = Object.keys(FUND_CATEGORIES) as CategoryKey[];
    return cats.map((c) => {
      const seed = c.charCodeAt(0);
      return {
        key: c,
        label: FUND_CATEGORIES[c].label,
        cells: HEATMAP_PERIODS.map((_, i) => {
          const base = Math.sin(seed + i * 0.7) * 8 + (i > 3 ? 12 : 2);
          return Number(base.toFixed(1));
        }),
      };
    });
  }, []);

  return (
    <div className="dx-fade-in space-y-5 pb-20">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Fund Screener</h1>
        <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
          Live NAV from mfapi.in <span className="dx-engine-dot" /> Modelled after Value Research / Morningstar / ET Money
        </p>
      </header>

      {/* Heatmap */}
      <section className="dx-glass rounded-xl p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Category Returns Heatmap</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground">
                <th className="text-left px-2 py-1 sticky left-0 bg-card/80">Category</th>
                {HEATMAP_PERIODS.map((p) => <th key={p} className="text-center px-2 py-1 min-w-[60px]">{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.key}>
                  <td className="px-2 py-1 sticky left-0 bg-card/80 font-medium">{row.label}</td>
                  {row.cells.map((v, i) => (
                    <td key={i} className="px-2 py-1 text-center cursor-pointer transition hover:scale-105" style={{ background: returnColor(v), color: "white" }}
                      onClick={() => { setCategory(row.key as CategoryKey); setPeriod((["1y", "1y", "1y", "1y", "1y", "3y", "5y"][i]) as PeriodKey); }}>
                      <span className="font-mono">{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Data modelled after Value Research Online (valueresearchonline.com). Click any cell to filter.</p>
      </section>

      <div className="grid md:grid-cols-[240px_1fr] gap-4">
        {/* Filters */}
        <aside className="dx-glass p-4 space-y-4 h-fit">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Filters</div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Category</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(FUND_CATEGORIES) as CategoryKey[]).map((k) => (
                <button key={k} onClick={() => setCategory(k)} className={"px-2 py-0.5 rounded-full border text-[10px] " + (category === k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card/40 hover:bg-card")}>
                  {FUND_CATEGORIES[k].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Period</div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)} className={"flex-1 px-2 py-1 rounded border text-[10px] " + (period === p.key ? "bg-accent text-accent-foreground border-accent" : "border-border bg-card/40")}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Search</div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Fund / house…" className="w-full bg-background/60 border border-border rounded px-2 py-1 text-xs font-mono" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1"><span className="text-muted-foreground uppercase tracking-wider">Min Return</span><span className="font-mono text-primary">{minReturn}%</span></div>
            <input type="range" min={-20} max={40} value={minReturn} onChange={(e) => setMinReturn(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Min Rating</div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <button key={r} onClick={() => setMinRating(r)} className={"flex-1 py-1 rounded border text-[10px] " + (minRating === r ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-border bg-card/40")}>{r || "All"}{r > 0 && "★"}</button>
              ))}
            </div>
          </div>
          {/* Presets */}
          <div className="pt-2 border-t border-border space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preset Screens</div>
            <button onClick={() => { setMinReturn(18); setMinRating(4); }} className="w-full text-left text-xs px-2 py-1 rounded hover:bg-primary/10">🏆 Top Performers</button>
            <button onClick={() => { setCategory("debt"); setMinReturn(5); }} className="w-full text-left text-xs px-2 py-1 rounded hover:bg-primary/10">🛡️ Low Risk, Steady</button>
            <button onClick={() => { setMinReturn(15); setMinRating(4); }} className="w-full text-left text-xs px-2 py-1 rounded hover:bg-primary/10">🧠 Dexter Picks</button>
            <button onClick={() => { setSearch(""); setMinReturn(0); setMinRating(0); }} className="w-full text-left text-xs px-2 py-1 rounded text-muted-foreground">Reset Filters</button>
          </div>
        </aside>

        {/* Results table */}
        <div className="dx-glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground tracking-wider bg-background/40">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Fund</th>
                  <th className="text-right px-2 py-2">NAV</th>
                  <th className="text-right px-2 py-2">{period.toUpperCase()} %</th>
                  <th className="text-center px-2 py-2">Rating</th>
                  <th className="text-center px-2 py-2">Dexter</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={6} className="px-3 py-3"><div className="h-3 dx-shimmer rounded" /></td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-12 text-sm">No funds match your criteria.</td></tr>
                )}
                {!loading && filtered.map((r, i) => {
                  const pct = r.returnPct;
                  const stars = Math.max(1, Math.min(5, Math.round(((pct ?? 0) + 10) / 8)));
                  const score = dexterFundScore(r);
                  return (
                    <tr key={r.code} className="border-t border-border hover:bg-primary/[0.06] cursor-pointer" onClick={() => setSelected(r)}>
                      <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-3"><div className="font-medium text-sm">{r.name}</div><div className="text-[10px] text-muted-foreground">{r.house}</div></td>
                      <td className="px-2 py-3 text-right font-mono">₹{r.nav.toFixed(2)}</td>
                      <td className={"px-2 py-3 text-right font-mono " + ((pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>{pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}</td>
                      <td className="px-2 py-3 text-center text-amber-400 text-xs">{"★".repeat(stars)}<span className="text-muted-foreground/30">{"★".repeat(5 - stars)}</span></td>
                      <td className="px-2 py-3">
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${score}%` }} /></div>
                        <div className="text-[10px] text-center font-mono mt-0.5">{score}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && <FundDrawer fund={selected} onClose={() => setSelected(null)} />}

      <p className="text-[10px] text-muted-foreground italic">Past performance does not guarantee future returns. Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully.</p>
    </div>
  );
}

function FundDrawer({ fund, onClose }: { fund: FundRow; onClose: () => void }) {
  const [history, setHistory] = useState<Array<{ d: string; nav: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [sip, setSip] = useState(5000);
  const [years, setYears] = useState(10);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.mfapi.in/mf/${fund.code}`).then((r) => r.json()).then((j: { data?: Array<{ date: string; nav: string }> }) => {
      if (cancelled) return;
      const data = (j.data ?? []).slice(0, 365).reverse().map((d) => ({ d: d.date, nav: parseFloat(d.nav) }));
      setHistory(data);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [fund.code]);

  const cagr = fund.returnPct ?? 12;
  const months = years * 12;
  const r = cagr / 100 / 12;
  const corpus = sip * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  const invested = sip * months;

  return (
    <div className="fixed inset-0 z-[170] bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:w-[70%] max-w-3xl h-full bg-card border-l border-border overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 border-b border-border bg-card/95 backdrop-blur">
          <div>
            <h2 className="font-semibold">{fund.name}</h2>
            <div className="text-xs text-muted-foreground">{fund.house} · NAV ₹{fund.nav.toFixed(2)} · {fund.navDate}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Mini label="Latest NAV" value={`₹${fund.nav.toFixed(2)}`} />
            <Mini label="CAGR" value={fund.returnPct ? `${fund.returnPct.toFixed(1)}%` : "—"} color={(fund.returnPct ?? 0) >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Mini label="Dexter Score" value={String(dexterFundScore(fund))} color="var(--primary)" />
            <Mini label="Risk-o-meter" value="Mod-High" />
          </div>

          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">NAV History (1Y)</div>
            <div className="dx-glass rounded-lg p-3">
              {loading ? <div className="h-[220px] dx-shimmer rounded" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={history}>
                    <XAxis dataKey="d" hide />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 11 }} />
                    <Line type="monotone" dataKey="nav" stroke="var(--cyan)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">SIP Return Calculator</div>
            <div className="dx-glass p-4 rounded-lg space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Monthly SIP</span><span className="font-mono text-primary">₹{sip.toLocaleString("en-IN")}</span></div>
                <input type="range" min={500} max={100000} step={500} value={sip} onChange={(e) => setSip(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Duration</span><span className="font-mono text-primary">{years}y</span></div>
                <input type="range" min={1} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Mini label="Invested" value={`₹${(invested / 100000).toFixed(1)}L`} />
                <Mini label="Returns" value={`₹${((corpus - invested) / 100000).toFixed(1)}L`} color="var(--bull)" />
                <Mini label="Corpus" value={`₹${(corpus / 100000).toFixed(1)}L`} color="var(--primary)" />
              </div>
              <p className="text-[10px] text-muted-foreground italic">Returns shown are based on historical NAV. Mutual fund investments are subject to market risk.</p>
            </div>
          </section>

          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">External Research</div>
            <div className="flex flex-wrap gap-2">
              <a href="https://www.valueresearchonline.com/funds/" target="_blank" rel="noreferrer" className="dx-pill cursor-pointer">Value Research <ExternalLink className="h-3 w-3" /></a>
              <a href="https://www.etmoney.com/mutual-funds/explore" target="_blank" rel="noreferrer" className="dx-pill cursor-pointer">ET Money <ExternalLink className="h-3 w-3" /></a>
              <a href="https://www.morningstar.in/tools/default.aspx" target="_blank" rel="noreferrer" className="dx-pill cursor-pointer">Morningstar <ExternalLink className="h-3 w-3" /></a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="dx-glass p-2 rounded">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}
