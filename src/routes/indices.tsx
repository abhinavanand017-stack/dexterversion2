import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { INDIAN_INDICES, type IndexCategory } from "@/lib/indices/universe";
import { IndexDashboard } from "@/components/indices/IndexDashboard";

export const Route = createFileRoute("/indices")({
  head: () => ({
    meta: [
      { title: "Live Indian Indices — Valuation, Scenarios & Global Peers | Dexter" },
      { name: "description", content: "Live NSE and BSE indices with valuation bands, 12-month scenarios, risk matrix, drawdown history and global peer benchmarking." },
      { property: "og:title", content: "Live Indian Indices — Dexter" },
      { property: "og:description", content: "Live NSE and BSE indices with valuation bands, scenarios, risk matrix and global peer benchmarking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndicesPage,
});

const CATEGORIES: { key: IndexCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "broad", label: "Broad Market" },
  { key: "cap", label: "Cap-based" },
  { key: "sectoral", label: "Sectoral" },
  { key: "thematic", label: "Thematic" },
];

function IndicesPage() {
  const [cat, setCat] = useState<IndexCategory | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(INDIAN_INDICES[0]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return INDIAN_INDICES.filter(
      (i) => (cat === "all" || i.category === cat) && (!s || i.name.toLowerCase().includes(s) || i.key.includes(s)),
    );
  }, [cat, q]);

  return (
    <div className="space-y-4 dx-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Live Indices</h1>
        <p className="text-sm text-muted-foreground">
          Live NSE &amp; BSE index levels with valuation bands, scenarios, risk and global benchmarking.
          Every figure is computed from fetched data — AI writes the narrative only.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-start">
        <aside className="space-y-2 lg:sticky lg:top-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search indices"
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-border bg-background/60 focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                data-active={cat === c.key}
                className="px-2 py-0.5 text-[10px] rounded border border-border font-mono data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
            {list.map((i) => (
              <button
                key={i.key}
                onClick={() => setSelected(i)}
                data-active={selected.key === i.key}
                className="w-full text-left px-3 py-2 hover:bg-muted/40 data-[active=true]:bg-primary/10 data-[active=true]:border-l-2 data-[active=true]:border-primary"
              >
                <div className="text-xs font-medium truncate">{i.name}</div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{i.exchange} · {i.category}</div>
              </button>
            ))}
            {!list.length && <div className="px-3 py-4 text-xs text-muted-foreground">No indices match that search.</div>}
          </div>
        </aside>

        <IndexDashboard key={selected.key} index={selected} />
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
        Indian valuation and breadth data from the NSE live index feed; price history from Yahoo Finance.
        Global peers come from a separate public feed and are badged accordingly, with ETF proxies marked.
        Scenarios and valuation bands are statistical projections, not investment advice.
      </p>
    </div>
  );
}
