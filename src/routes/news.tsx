import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — DEXTER" },
      { name: "description", content: "Live Indian market news with AI sentiment tagging." },
    ],
  }),
  component: NewsPage,
});

type Provider = "gnews" | "newsdata" | "demo";

interface Article {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
}

const BULLISH = /\b(surge|rally|gain|rise|risen|soar|record|high|outperform|breakout|strong|beat|beats|upgrade|jump|bullish|profit)\b/i;
const BEARISH = /\b(crash|fall|falls|fell|slump|decline|drop|drops|weak|miss|misses|downgrade|selloff|concern|worry|risk|loss|bearish|plunge)\b/i;

const CATEGORIES: Array<{ k: string; label: string; rx: RegExp }> = [
  { k: "all", label: "All", rx: /.*/ },
  { k: "markets", label: "Markets", rx: /\b(nifty|sensex|stock|share|market|equit)/i },
  { k: "economy", label: "Economy", rx: /\b(gdp|inflation|economy|cpi|wpi|growth|fiscal)/i },
  { k: "mutualfunds", label: "Mutual Funds", rx: /\b(mutual fund|sip|nav|amc|amfi|elss)/i },
  { k: "ipo", label: "IPO", rx: /\b(ipo|listing|subscri|drhp)/i },
  { k: "commodities", label: "Commodities", rx: /\b(gold|silver|crude|oil|commodit)/i },
  { k: "rbi", label: "RBI/Policy", rx: /\b(rbi|sebi|repo|policy|regulator|cabinet)/i },
];

const DEMO: Article[] = Array.from({ length: 10 }).map((_, i) => ({
  title: [
    "Nifty hits record high on banking surge",
    "Inflation cools to 4.2%, RBI may hold rates",
    "HDFC AMC reports 18% AUM growth in Q3",
    "Reliance IPO of subsidiary draws ₹40,000 cr bids",
    "Gold prices fall as dollar strengthens",
    "Adani Group stocks rally after debt repayment",
    "Sensex slumps 600 points on global selloff",
    "SEBI tightens rules on F&O trading",
    "Mutual fund SIP inflows cross ₹20,000 cr",
    "TCS beats estimates, dividend declared",
  ][i],
  description: "Placeholder article — add a free API key in Settings → Data Connections to enable live news.",
  url: "#",
  source: "Demo",
  publishedAt: new Date(Date.now() - i * 3600_000).toISOString(),
}));

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

function sentiment(text: string): { tag: "Bullish" | "Bearish" | "Neutral"; emoji: string; color: string } {
  if (BULLISH.test(text)) return { tag: "Bullish", emoji: "📈", color: "#00ff88" };
  if (BEARISH.test(text)) return { tag: "Bearish", emoji: "📉", color: "#ff4466" };
  return { tag: "Neutral", emoji: "➖", color: "#94a3b8" };
}

function categorize(title: string): string {
  for (const c of CATEGORIES) if (c.k !== "all" && c.rx.test(title)) return c.k;
  return "markets";
}

async function fetchNews(provider: Provider, key: string): Promise<Article[]> {
  if (provider === "demo" || !key) return DEMO;
  try {
    if (provider === "gnews") {
      const r = await fetch(`https://gnews.io/api/v4/search?q=NSE%20OR%20BSE%20OR%20Nifty%20OR%20India%20stock%20market&lang=en&country=in&max=20&apikey=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { articles?: Array<{ title: string; description: string; url: string; image: string; publishedAt: string; source: { name: string } }> };
      return (j.articles || []).map((a) => ({
        title: a.title, description: a.description || "", url: a.url,
        image: a.image, publishedAt: a.publishedAt, source: a.source?.name || "GNews",
      }));
    }
    if (provider === "newsdata") {
      const r = await fetch(`https://newsdata.io/api/1/news?country=in&category=business&language=en&apikey=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { results?: Array<{ title: string; description: string; link: string; image_url: string; pubDate: string; source_id: string }> };
      return (j.results || []).map((a) => ({
        title: a.title, description: a.description || "", url: a.link,
        image: a.image_url, publishedAt: a.pubDate, source: a.source_id || "NewsData",
      }));
    }
  } catch (e) {
    console.warn("News fetch failed", e);
  }
  return DEMO;
}

function NewsPage() {
  const [provider, setProvider] = useState<Provider>("demo");
  const [key, setKey] = useState("");
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [countdown, setCountdown] = useState(300);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const p = (localStorage.getItem("dexter_news_provider") as Provider) || "demo";
    const k = localStorage.getItem("dexter_news_key") || "";
    setProvider(p); setKey(k);
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await fetchNews(provider, key);
    setItems(data);
    setLoading(false);
    setCountdown(300);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [provider, key]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { load(); return 300; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, key]);

  const filtered = useMemo(() => {
    const c = CATEGORIES.find((x) => x.k === cat) || CATEGORIES[0];
    const q = search.trim().toLowerCase();
    return items.filter((a) => (cat === "all" || c.rx.test(a.title)) && (!q || a.title.toLowerCase().includes(q)));
  }, [items, cat, search]);

  const banner = provider === "demo" || !key;
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
          <p className="text-sm text-muted-foreground">
            {provider === "demo" ? "Demo articles" : `Source: ${provider.toUpperCase()}`} · 🔄 Refreshing in {cdMin}:{cdSec}
          </p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      {banner && (
        <div className="p-3 rounded border text-sm" style={{ borderColor: "#ffaa00", background: "rgba(255,170,0,0.08)", color: "#ffd27a" }}>
          Add a free news API key in <strong>Settings → Data Connections</strong> to enable live market news.
          Get one free at <a className="underline" href="https://gnews.io" target="_blank" rel="noreferrer">gnews.io</a> or
          {" "}<a className="underline" href="https://newsdata.io" target="_blank" rel="noreferrer">newsdata.io</a>.
        </div>
      )}

      {/* Marquee */}
      {items.length > 0 && (
        <div className="overflow-hidden border-y border-border bg-background/40">
          <div className="flex gap-8 py-2 whitespace-nowrap animate-marquee text-xs font-mono">
            {items.slice(0, 5).concat(items.slice(0, 5)).map((a, i) => (
              <span key={i} className="text-muted-foreground">▸ {a.title}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {CATEGORIES.map((c) => (
          <button key={c.k} onClick={() => setCat(c.k)} data-active={cat === c.k}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-card/40 hover:bg-card data-[active=true]:bg-primary data-[active=true]:text-primary-foreground transition">
            {c.label}
          </button>
        ))}
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
        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-12">No headlines match.</div>
        )}
        {!loading && filtered.map((a, i) => {
          const s = sentiment(`${a.title} ${a.description}`);
          const c = categorize(a.title);
          const isMc = /moneycontrol\.com/i.test(a.url);
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border p-4 transition flex flex-col gap-2"
              style={{ borderColor: "rgba(0,212,255,0.15)", background: "#0d1117" }}>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                <span className="px-2 py-0.5 rounded" style={{ background: isMc ? "rgba(0,128,255,0.2)" : "rgba(255,255,255,0.06)", color: isMc ? "#4dabff" : "#94a3b8" }}>
                  {a.source}
                </span>
                <span className="text-muted-foreground">{timeAgo(a.publishedAt)}</span>
              </div>
              <div className="font-semibold leading-snug line-clamp-3">{a.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
              <div className="mt-auto flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded" style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55` }}>
                  {s.emoji} {s.tag}
                </span>
                <span className="px-2 py-0.5 rounded bg-muted/30 text-muted-foreground capitalize">{c}</span>
                <span className="ml-auto text-primary">Read more →</span>
              </div>
            </a>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Data sourced from licensed news APIs. For comprehensive market coverage, visit{" "}
        <a className="underline" href="https://www.moneycontrol.com" target="_blank" rel="noreferrer">MoneyControl.com</a>.
      </p>
    </div>
  );
}
