import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FUND_CATEGORIES, fetchFund, type CategoryKey, type PeriodKey, type FundRow } from "@/lib/funds";

export const Route = createFileRoute("/funds")({
  head: () => ({
    meta: [
      { title: "Mutual Funds — DEXTER" },
      { name: "description", content: "Top Indian mutual funds across categories with CAGR returns." },
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

function FundsPage() {
  const [category, setCategory] = useState<CategoryKey>("largecap");
  const [period, setPeriod] = useState<PeriodKey>("3y");
  const [rows, setRows] = useState<FundRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mutual Funds</h1>
        <p className="text-sm text-muted-foreground">Top funds by trailing CAGR. Data: mfapi.in</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FUND_CATEGORIES) as CategoryKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setCategory(k)}
            data-active={category === k}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-card/40 hover:bg-card data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary transition"
          >
            {FUND_CATEGORIES[k].label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            data-active={period === p.key}
            className="px-4 py-1.5 text-sm rounded-md border border-border bg-card/40 hover:bg-card data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[active=true]:border-accent transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card/30 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-background/40">
            <tr>
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2">Fund Name</th>
              <th className="text-right px-3 py-2">Return ({period.toUpperCase()})</th>
              <th className="text-right px-3 py-2">NAV</th>
              <th className="text-right px-3 py-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-3"><div className="h-3 w-4 bg-muted/40 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-64 bg-muted/40 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-16 bg-muted/40 rounded animate-pulse ml-auto" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-16 bg-muted/40 rounded animate-pulse ml-auto" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-12 bg-muted/40 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              : rows.map((r, i) => {
                  const pct = r.returnPct;
                  const positive = (pct ?? 0) >= 0;
                  const stars = Math.max(1, Math.min(5, Math.round(((pct ?? 0) + 10) / 8)));
                  return (
                    <tr key={r.code} className="border-t border-border hover:bg-background/40">
                      <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium leading-tight">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.house}</div>
                      </td>
                      <td className={"px-3 py-3 text-right font-mono " + (positive ? "text-emerald-400" : "text-red-400")}>
                        {pct === null ? "—" : `${positive ? "+" : ""}${pct.toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">₹{r.nav.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-amber-400">{"★".repeat(stars)}<span className="text-muted-foreground/40">{"★".repeat(5 - stars)}</span></td>
                    </tr>
                  );
                })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Past performance does not guarantee future returns. SEBI registered.
      </p>
    </div>
  );
}
