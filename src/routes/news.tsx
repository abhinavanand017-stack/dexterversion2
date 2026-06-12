import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getNews, type NewsItem } from "@/lib/news.functions";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — DEXTER" },
      { name: "description", content: "Live Indian market news aggregated from Moneycontrol." },
    ],
  }),
  component: NewsPage,
});

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "markets", label: "Markets" },
  { key: "economy", label: "Economy" },
  { key: "mutualfunds", label: "Mutual Funds" },
  { key: "ipo", label: "IPO" },
  { key: "commodities", label: "Commodities" },
];

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  if (isNaN(ms)) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getNews()
        .then((data) => { if (!cancelled) { setItems(data); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const filtered = useMemo(
    () => (cat === "all" ? items : items.filter((i) => i.category === cat)),
    [items, cat]
  );

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Market News
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400 tracking-wider">LIVE</span>
          </h1>
          <p className="text-sm text-muted-foreground">Auto-refreshes every 5 minutes · Moneycontrol RSS</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            data-active={cat === c.key}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-card/40 hover:bg-card data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary transition"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card/30 p-4 space-y-2">
            <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-muted/40 rounded animate-pulse" />
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">No headlines available.</div>
        )}
        {!loading && filtered.map((n, i) => (
          <a
            key={i}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-border bg-card/30 p-4 hover:bg-card/60 transition"
          >
            <div className="font-semibold leading-snug">{n.title}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">Moneycontrol</span>
              <span className="px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground capitalize">{n.category}</span>
              <span className="text-muted-foreground">{timeAgo(n.pubDate)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
