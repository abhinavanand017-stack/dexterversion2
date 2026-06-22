import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Search as SearchIcon, ExternalLink } from "lucide-react";
import { getNews, type NewsItem } from "@/lib/news.functions";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — DEXTER" },
      { name: "description", content: "Live Indian market news from NewsAPI." },
    ],
  }),
  component: NewsPage,
});

const BULLISH = /\b(surge|rally|gain|rise|risen|soar|record|high|outperform|breakout|strong|beat|beats|upgrade|jump|bullish|profit)\b/i;
const BEARISH = /\b(crash|fall|falls|fell|slump|decline|drop|drops|weak|miss|misses|downgrade|selloff|concern|worry|risk|loss|bearish|plunge)\b/i;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function sentiment(text: string) {
  if (BULLISH.test(text)) return { tag: "Bullish", emoji: "📈", color: "#00ff88" };
  if (BEARISH.test(text)) return { tag: "Bearish", emoji: "📉", color: "#ff4466" };
  return { tag: "Neutral", emoji: "➖", color: "#94a3b8" };
}

function NewsPage() {
  const fetchNews = useServerFn(getNews);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [countdown, setCountdown] = useState(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchNews();
      if (res.ok) { setItems(res.items); } else { setError(res.error || "News unavailable"); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "News unavailable");
    } finally {
      setLoading(false); setCountdown(600);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { load(); return 600; } return c - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => !q || a.title.toLowerCase().includes(q));
  }, [items, search]);

  const cdMin = Math.floor(countdown / 60); const cdSec = String(countdown % 60).padStart(2, "0");

  return (
    <div className="space-y-4 dx-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Market News
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400 tracking-wider">LIVE</span>
          </h1>
          <p className="text-sm text-muted-foreground">Source: NewsAPI · Refreshing in {cdMin}:{cdSec}</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      {error && !loading && (
        <div className="p-4 rounded border text-sm flex items-center justify-between" style={{ borderColor: "#ff4466", background: "rgba(255,68,102,0.08)", color: "#ffb3c0" }}>
          <span>News unavailable – try again later. <span className="opacity-60">({error})</span></span>
          <button onClick={load} className="px-3 py-1 text-xs rounded border border-red-500/50 hover:bg-red-500/10">Retry</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-border bg-background/40">
          <SearchIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter headlines..."
            className="bg-transparent text-xs outline-none w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card/30 p-4 h-40 animate-pulse" />
        ))}
        {!loading && filtered.length === 0 && !error && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-12">No headlines match.</div>
        )}
        {!loading && filtered.map((a, i) => {
          const s = sentiment(`${a.title} ${a.description}`);
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border p-4 transition flex flex-col gap-2 hover:border-primary/50"
              style={{ borderColor: "rgba(0,212,255,0.15)", background: "#0d1117" }}>
              {a.image && (
                <img src={a.image} alt="" loading="lazy" className="w-full h-32 object-cover rounded -m-2 mb-0" style={{ width: "calc(100% + 1rem)" }} />
              )}
              <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                <span className="px-2 py-0.5 rounded" style={{ background: "rgba(0,128,255,0.2)", color: "#4dabff" }}>{a.source}</span>
                <span className="text-muted-foreground">{timeAgo(a.publishedAt)}</span>
              </div>
              <div className="font-semibold leading-snug line-clamp-3">{a.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
              <div className="mt-auto flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded" style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55` }}>
                  {s.emoji} {s.tag}
                </span>
                <span className="ml-auto text-primary flex items-center gap-1">Read <ExternalLink className="w-3 h-3" /></span>
              </div>
            </a>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Powered by NewsAPI.org. For research purposes only — verify before trading.
      </p>
    </div>
  );
}
