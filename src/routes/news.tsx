import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Search as SearchIcon, ExternalLink, Sparkles, Star, X, LayoutGrid, List as ListIcon } from "lucide-react";
import { getNews, generateNewsDigest, type NewsItem } from "@/lib/news.functions";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — DEXTER" },
      { name: "description", content: "Live Indian market news aggregated from Moneycontrol, ET, Livemint, Business Standard, CNBC-TV18, Financial Express and Morningstar India." },
    ],
  }),
  component: NewsPage,
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
interface SourceMeta { id: string; name: string; color: string; logo: string }
const SOURCES: SourceMeta[] = [
  { id: "moneycontrol",       name: "Moneycontrol",       color: "#1a73e8", logo: "MC" },
  { id: "economic_times",     name: "Economic Times",     color: "#ff6600", logo: "ET" },
  { id: "livemint",           name: "Livemint",           color: "#b5062e", logo: "LM" },
  { id: "business_standard",  name: "Business Standard",  color: "#e31e24", logo: "BS" },
  { id: "financial_express",  name: "Financial Express",  color: "#003366", logo: "FE" },
  { id: "cnbctv18",           name: "CNBC-TV18",          color: "#e50000", logo: "CNBC" },
  { id: "morningstar",        name: "Morningstar India",  color: "#e8212c", logo: "★" },
];
const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

const CATEGORIES = [
  { id: "all",         label: "All" },
  { id: "markets",     label: "Markets" },
  { id: "economy",     label: "Economy" },
  { id: "mutualfunds", label: "Mutual Funds" },
  { id: "ipo",         label: "IPO" },
  { id: "results",     label: "Results" },
  { id: "commodities", label: "Commodities" },
] as const;

const CATEGORY_GRADIENT: Record<string, string> = {
  markets:     "linear-gradient(135deg,#1e3a5f,#2563eb)",
  economy:     "linear-gradient(135deg,#1e3a2f,#16a34a)",
  ipo:         "linear-gradient(135deg,#3a1e5f,#9333ea)",
  mutualfunds: "linear-gradient(135deg,#3a2a1e,#d97706)",
  commodities: "linear-gradient(135deg,#3a1e1e,#dc2626)",
  results:     "linear-gradient(135deg,#1e3a3a,#0891b2)",
};

const TIME_FILTERS = [
  { id: "all",  label: "All time",   ms: Infinity },
  { id: "1h",   label: "Last 1h",    ms: 60 * 60_000 },
  { id: "6h",   label: "Last 6h",    ms: 6 * 60 * 60_000 },
  { id: "today", label: "Today",     ms: 24 * 60 * 60_000 },
  { id: "week", label: "This week",  ms: 7 * 24 * 60 * 60_000 },
] as const;

const REFRESH_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(diff)) return "";
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q.trim()) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} style={{ background: "rgba(55,138,221,0.35)", color: "#f1f5f9", padding: "0 2px", borderRadius: 2 }}>{p}</mark> : <span key={i}>{p}</span>
  );
}

const MOOD_COLORS: Record<string, string> = {
  bullish: "#16a34a", bearish: "#dc2626", cautious: "#d97706", volatile: "#9333ea",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function NewsPage() {
  const fetchNews = useServerFn(getNews);
  const fetchDigest = useServerFn(generateNewsDigest);

  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [feedsOk, setFeedsOk] = useState<{ ok: number; total: number } | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(SOURCES.map((s) => s.id)));
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [trendingTopic, setTrendingTopic] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [showCount, setShowCount] = useState(30);
  const [watchlistMode, setWatchlistMode] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);

  const [digestText, setDigestText] = useState<string>("");
  const [digestMood, setDigestMood] = useState<string>("");
  const [digestAt, setDigestAt] = useState<string>("");
  const [digestLoading, setDigestLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchNews();
      setItems(res.items || []);
      setFeedsOk({ ok: res.feedsOk, total: res.feedsTotal });
      if (!res.ok && res.error) setError(res.error);
      setLastUpdated(new Date(res.fetchedAt || Date.now()));
      setCountdown(REFRESH_MS / 1000);
      try { sessionStorage.setItem("dexter_news_cache", JSON.stringify({ items: res.items, ts: Date.now(), feedsOk: res.feedsOk, feedsTotal: res.feedsTotal })); } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load news");
    } finally { setLoading(false); }
  }, [fetchNews]);

  // Bootstrap: cache first, then refresh
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dexter_news_cache");
      if (raw) {
        const v = JSON.parse(raw) as { items: NewsItem[]; ts: number; feedsOk?: number; feedsTotal?: number };
        if (v.items?.length && Date.now() - v.ts < REFRESH_MS) {
          setItems(v.items); setLoading(false); setLastUpdated(new Date(v.ts));
          if (typeof v.feedsOk === "number" && typeof v.feedsTotal === "number") setFeedsOk({ ok: v.feedsOk, total: v.feedsTotal });
        }
      }
    } catch { /* ignore */ }
    load();
  }, [load]);

  // Auto-refresh
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { void load(); return REFRESH_MS / 1000; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Watchlist stocks
  const watchlist = useMemo<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("dexter_watchlist");
      if (!raw) return [];
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v.map((x) => String(typeof x === "string" ? x : x?.symbol || "").toUpperCase()).filter(Boolean);
      return [];
    } catch { return []; }
  }, []);

  // Source counts
  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.sourceId] = (c[it.sourceId] || 0) + 1;
    return c;
  }, [items]);

  // Trending topics from titles
  const trending = useMemo<string[]>(() => {
    const freq: Record<string, number> = {};
    const stop = new Set(["the","a","an","and","or","for","to","of","in","on","at","by","is","are","was","were","this","that","from","with","as","be","up","down","new","after","over","its","not","has","have","will","says","said","market","stocks","stock","today"]);
    for (const it of items.slice(0, 100)) {
      for (const w of it.title.split(/[^A-Za-z0-9]+/)) {
        if (w.length < 3 || stop.has(w.toLowerCase())) continue;
        const k = w[0].toUpperCase() + w.slice(1).toLowerCase();
        freq[k] = (freq[k] || 0) + 1;
      }
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map((x) => x[0]);
  }, [items]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const now = Date.now();
    const tf = TIME_FILTERS.find((t) => t.id === timeFilter)?.ms ?? Infinity;
    let list = items.filter((a) => {
      if (!activeSources.has(a.sourceId)) return false;
      if (activeCategory !== "all" && a.category !== activeCategory) return false;
      if (tf !== Infinity && now - new Date(a.publishedAt).getTime() > tf) return false;
      if (trendingTopic && !`${a.title} ${a.description}`.toLowerCase().includes(trendingTopic.toLowerCase())) return false;
      if (q && !(a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))) return false;
      return true;
    });
    if (watchlistMode) {
      if (watchlist.length === 0) list = [];
      else list = list.filter((a) => watchlist.some((sym) => `${a.title} ${a.description}`.toUpperCase().includes(sym)));
    }
    return list;
  }, [items, debouncedSearch, activeCategory, activeSources, timeFilter, trendingTopic, watchlistMode, watchlist]);

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const it of items) c[it.category] = (c[it.category] || 0) + 1;
    return c;
  }, [items]);

  // Digest — restore from cache
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dexter_news_digest");
      if (raw) {
        const v = JSON.parse(raw) as { text: string; mood: string; at: string; ts: number };
        if (v.text && Date.now() - v.ts < 30 * 60_000) {
          setDigestText(v.text); setDigestMood(v.mood || ""); setDigestAt(v.at || "");
        }
      }
    } catch { /* ignore */ }
  }, []);

  const runDigest = async () => {
    if (items.length === 0) return;
    setDigestLoading(true);
    try {
      const top = items.slice(0, 10).map((h) => ({ title: h.title, source: h.source }));
      const res = await fetchDigest({ data: { headlines: top } });
      if (res.ok) {
        setDigestText(res.text); setDigestMood((res.mood || "").toLowerCase()); setDigestAt(res.generatedAt || new Date().toISOString());
        try { sessionStorage.setItem("dexter_news_digest", JSON.stringify({ text: res.text, mood: (res.mood || "").toLowerCase(), at: res.generatedAt, ts: Date.now() })); } catch { /* ignore */ }
      } else {
        setDigestText(""); setError(res.error || "Digest failed");
      }
    } finally { setDigestLoading(false); }
  };

  const cdMin = Math.floor(countdown / 60);
  const cdSec = String(countdown % 60).padStart(2, "0");
  const progress = 100 - (countdown / (REFRESH_MS / 1000)) * 100;

  const featured = filtered[0];
  const rest = filtered.slice(1, showCount);

  const toggleSource = (id: string) => {
    setActiveSources((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-4 dx-fade-in" style={{ background: "#0a0a1a", minHeight: "100%" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(10,10,26,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2" style={{ color: "#f1f5f9" }}>
            Market News
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Live</span>
          </h1>
          <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD" }}>{items.length} articles</span>
          {feedsOk && (
            <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>{feedsOk.ok}/{feedsOk.total} feeds</span>
          )}
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <SearchIcon className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search news, stocks, topics…"
            className="bg-transparent text-xs outline-none w-64" style={{ color: "#f1f5f9" }} />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs" style={{ color: "#94a3b8" }}><X className="w-3 h-3" /></button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
            {lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString())}` : "—"} · Next {cdMin}:{cdSec}
          </div>
          <button onClick={load} disabled={loading} className="px-2 py-1 text-xs rounded flex items-center gap-1" style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD", border: "1px solid rgba(55,138,221,0.3)" }}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-[2px] mt-1" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full transition-all" style={{ width: `${progress}%`, background: "#378ADD" }} />
        </div>
      </div>

      {/* BREAKING TICKER */}
      {items.length > 0 && (
        <div className="overflow-hidden py-2 rounded" style={{ background: "rgba(239,68,68,0.1)", borderLeft: "4px solid #ef4444" }}>
          <style>{`@keyframes dxTickerScroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } } .dx-ticker:hover .dx-ticker-track { animation-play-state: paused; }`}</style>
          <div className="dx-ticker whitespace-nowrap">
            <div className="dx-ticker-track inline-block" style={{ animation: "dxTickerScroll 90s linear infinite" }}>
              <span className="text-[11px] font-bold px-3 py-1 rounded mr-3" style={{ background: "#ef4444", color: "#fff" }}>🔴 BREAKING</span>
              {items.slice(0, 10).map((it, i) => (
                <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="text-xs mx-4 hover:underline" style={{ color: "#f1f5f9" }}>
                  {it.title}<span className="mx-2" style={{ color: "#ef4444" }}>·</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded text-xs flex items-center justify-between gap-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", color: "#ffb3c0" }}>
          <span>⚠ {error}</span>
          <button onClick={load} className="px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.2)", color: "#fff" }}>Retry</button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "240px 1fr" }}>
        {/* SIDEBAR */}
        <aside className="hidden lg:block space-y-4">
          <SidebarPanel title="Sources"
            action={<div className="flex gap-2 text-[10px]"><button onClick={() => setActiveSources(new Set(SOURCES.map((s) => s.id)))} style={{ color: "#378ADD" }}>All</button><button onClick={() => setActiveSources(new Set())} style={{ color: "#94a3b8" }}>Clear</button></div>}>
            <ul className="space-y-1">
              {SOURCES.map((s) => {
                const active = activeSources.has(s.id);
                return (
                  <li key={s.id}>
                    <button onClick={() => toggleSource(s.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition"
                      style={{ background: active ? "rgba(255,255,255,0.05)" : "transparent", opacity: active ? 1 : 0.5 }}>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold" style={{ background: s.color, color: "#fff" }}>{s.logo}</span>
                      <span className="flex-1 text-left" style={{ color: "#f1f5f9" }}>{s.name}</span>
                      <span className="text-[10px]" style={{ color: "#94a3b8" }}>{sourceCounts[s.id] || 0}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SidebarPanel>

          <SidebarPanel title="Time filter">
            <div className="space-y-1">
              {TIME_FILTERS.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#f1f5f9" }}>
                  <input type="radio" name="tf" checked={timeFilter === t.id} onChange={() => setTimeFilter(t.id)} />
                  {t.label}
                </label>
              ))}
            </div>
          </SidebarPanel>

          {trending.length > 0 && (
            <SidebarPanel title="Trending topics">
              <div className="flex flex-wrap gap-1">
                {trending.map((t) => (
                  <button key={t} onClick={() => setTrendingTopic(trendingTopic === t ? null : t)}
                    className="text-[11px] px-2 py-1 rounded"
                    style={{ background: trendingTopic === t ? "#378ADD" : "rgba(55,138,221,0.15)", color: trendingTopic === t ? "#fff" : "#378ADD" }}>
                    #{t}
                  </button>
                ))}
              </div>
            </SidebarPanel>
          )}
        </aside>

        {/* MAIN */}
        <main className="space-y-4">
          {/* DEXTER DIGEST */}
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(55,138,221,0.08), rgba(147,51,234,0.08))", border: "1px solid rgba(55,138,221,0.25)" }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: "#378ADD" }} />
                <span className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Dexter Daily Digest</span>
                {digestMood && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded" style={{ background: `${MOOD_COLORS[digestMood] || "#94a3b8"}22`, color: MOOD_COLORS[digestMood] || "#94a3b8", border: `1px solid ${MOOD_COLORS[digestMood] || "#94a3b8"}55` }}>{digestMood}</span>
                )}
              </div>
              <button onClick={runDigest} disabled={digestLoading || items.length === 0} className="text-xs px-3 py-1 rounded flex items-center gap-1" style={{ background: "#378ADD", color: "#fff", opacity: digestLoading ? 0.6 : 1 }}>
                {digestLoading ? "Generating…" : digestText ? "Regenerate ↻" : "Generate ▶"}
              </button>
            </div>
            {digestText ? (
              <>
                <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: "#cbd5e1", lineHeight: 1.6 }}>{digestText}</pre>
                {digestAt && <div className="text-[10px] mt-2" style={{ color: "#94a3b8" }}>Generated {timeAgo(digestAt)}</div>}
              </>
            ) : (
              <div className="text-xs" style={{ color: "#94a3b8" }}>AI-generated summary of today's top market stories.</div>
            )}
          </div>

          {/* CATEGORY TABS + MODE TOGGLE */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button onClick={() => setWatchlistMode(!watchlistMode)}
              className="text-xs px-3 py-1.5 rounded whitespace-nowrap flex items-center gap-1"
              style={{ background: watchlistMode ? "#f59e0b" : "rgba(245,158,11,0.15)", color: watchlistMode ? "#000" : "#f59e0b", border: `1px solid ${watchlistMode ? "#f59e0b" : "rgba(245,158,11,0.3)"}` }}>
              <Star className="w-3 h-3" /> My Stocks
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => { setActiveCategory(c.id); setShowCount(30); }}
                className="text-xs px-3 py-1.5 rounded whitespace-nowrap transition"
                style={{
                  background: activeCategory === c.id ? "rgba(55,138,221,0.2)" : "transparent",
                  color: activeCategory === c.id ? "#378ADD" : "#94a3b8",
                  borderBottom: activeCategory === c.id ? "2px solid #378ADD" : "2px solid transparent",
                  fontWeight: activeCategory === c.id ? 600 : 400,
                }}>
                {c.label} <span className="opacity-60">({catCounts[c.id] || 0})</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button onClick={() => setDisplayMode("grid")} className="p-1.5 rounded" style={{ background: displayMode === "grid" ? "rgba(55,138,221,0.2)" : "transparent", color: displayMode === "grid" ? "#378ADD" : "#94a3b8" }}><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDisplayMode("list")} className="p-1.5 rounded" style={{ background: displayMode === "list" ? "rgba(55,138,221,0.2)" : "transparent", color: displayMode === "list" ? "#378ADD" : "#94a3b8" }}><ListIcon className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {debouncedSearch && (
            <div className="text-xs flex items-center gap-2" style={{ color: "#94a3b8" }}>
              <span>{filtered.length} articles match "{debouncedSearch}"</span>
              <button onClick={() => setSearch("")} className="underline">Clear search</button>
            </div>
          )}

          {/* LOADING SKELETONS */}
          {loading && items.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl h-52" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)", backgroundSize: "200% 100%", animation: "dxShimmer 1.5s infinite", border: "1px solid rgba(255,255,255,0.08)" }} />
              ))}
              <style>{`@keyframes dxShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
            </div>
          )}

          {/* EMPTY */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-4xl mb-2">📡</div>
              <div className="text-sm mb-1" style={{ color: "#f1f5f9" }}>
                {watchlistMode && watchlist.length === 0 ? "Add stocks to your watchlist in the Portfolio page to see personalized news here." : "No headlines match your filters."}
              </div>
              <button onClick={() => { setSearch(""); setActiveCategory("all"); setTimeFilter("all"); setTrendingTopic(null); setActiveSources(new Set(SOURCES.map((s) => s.id))); setWatchlistMode(false); }} className="text-xs mt-2 px-3 py-1 rounded" style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD" }}>Reset filters</button>
            </div>
          )}

          {/* FEATURED */}
          {featured && displayMode === "grid" && (
            <FeaturedCard item={featured} query={debouncedSearch} />
          )}

          {/* CARDS */}
          {displayMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rest.map((it) => <ArticleCard key={it.id} item={it} query={debouncedSearch} />)}
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {filtered.slice(0, showCount).map((it) => (
                <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 border-b hover:bg-white/5 transition text-xs" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <SourcePill sourceId={it.sourceId} />
                  <span className="flex-1" style={{ color: "#f1f5f9" }}>{highlight(it.title, debouncedSearch)}</span>
                  <span className="text-[10px]" style={{ color: "#94a3b8" }}>{timeAgo(it.publishedAt)}</span>
                </a>
              ))}
            </div>
          )}

          {/* LOAD MORE */}
          {filtered.length > showCount && (
            <div className="text-center pt-2">
              <button onClick={() => setShowCount((c) => c + 20)} className="text-xs px-4 py-2 rounded" style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD", border: "1px solid rgba(55,138,221,0.3)" }}>
                Load 20 more articles ({filtered.length - showCount} remaining)
              </button>
            </div>
          )}

          {/* ATTRIBUTION */}
          <p className="text-[10px] italic pt-4" style={{ color: "#64748b" }}>
            News sourced from Moneycontrol, Economic Times, Livemint, Business Standard, Financial Express, CNBC-TV18 and Morningstar India via their public RSS feeds. All articles © their respective publishers. Click to read on source website. For research and informational purposes only.
          </p>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SidebarPanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SourcePill({ sourceId }: { sourceId: string }) {
  const s = SOURCE_BY_ID[sourceId];
  if (!s) return <span className="text-[10px]" style={{ color: "#94a3b8" }}>{sourceId}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55` }}>
      <span className="font-bold">{s.logo}</span> {s.name}
    </span>
  );
}

function FeaturedCard({ item, query }: { item: NewsItem; query: string }) {
  const s = SOURCE_BY_ID[item.sourceId];
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden group transition"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s?.color || "#378ADD"}44` }}>
      <div className="w-full h-40 md:h-48 flex items-center justify-center text-2xl font-bold uppercase" style={{ background: item.image ? `url(${item.image}) center/cover` : CATEGORY_GRADIENT[item.category] || CATEGORY_GRADIENT.markets, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        {!item.image && item.category}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase">
          <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#ef4444", color: "#fff" }}>Featured</span>
          <SourcePill sourceId={item.sourceId} />
          <span style={{ color: "#94a3b8" }}>· {timeAgo(item.publishedAt)}</span>
        </div>
        <div className="text-lg font-semibold leading-snug" style={{ color: "#f1f5f9" }}>{highlight(item.title, query)}</div>
        <div className="text-sm line-clamp-2" style={{ color: "#94a3b8" }}>{highlight(item.description, query)}</div>
        <div className="text-xs flex items-center gap-1 group-hover:translate-x-1 transition" style={{ color: s?.color || "#378ADD" }}>
          Read on {item.source} <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </a>
  );
}

function ArticleCard({ item, query }: { item: NewsItem; query: string }) {
  const s = SOURCE_BY_ID[item.sourceId];
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="rounded-xl overflow-hidden flex flex-col transition group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${s?.color || "#378ADD"}66`; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
      <div className="w-full h-28 flex items-center justify-center text-lg font-bold uppercase" style={{ background: item.image ? `url(${item.image}) center/cover` : CATEGORY_GRADIENT[item.category] || CATEGORY_GRADIENT.markets, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        {!item.image && item.category}
      </div>
      <div className="p-3 space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 text-[10px]">
          <SourcePill sourceId={item.sourceId} />
          <span style={{ color: "#94a3b8" }}>· {timeAgo(item.publishedAt)}</span>
        </div>
        <div className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "#f1f5f9" }}>{highlight(item.title, query)}</div>
        <div className="text-xs line-clamp-2 flex-1" style={{ color: "#94a3b8" }}>{highlight(item.description, query)}</div>
        <div className="text-[11px] flex items-center gap-1 mt-1 transition-transform group-hover:translate-x-1" style={{ color: s?.color || "#378ADD" }}>
          Read more <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </a>
  );
}
