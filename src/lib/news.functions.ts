import { createServerFn } from "@tanstack/react-start";

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
}

let cache: { ts: number; items: NewsItem[] } | null = null;
const TTL = 10 * 60 * 1000;

export const getNews = createServerFn({ method: "GET" }).handler(async (): Promise<{ ok: boolean; items: NewsItem[]; error?: string }> => {
  if (cache && Date.now() - cache.ts < TTL) return { ok: true, items: cache.items };
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  if (!NEWSAPI_KEY) {
    if (cache) return { ok: true, items: cache.items };
    return { ok: false, items: [], error: "NEWSAPI_KEY not configured" };
  }
  const NEWSAPI_URL = `https://newsapi.org/v2/everything?q=india+stock+market+NSE+BSE&language=en&sortBy=publishedAt&apiKey=${NEWSAPI_KEY}`;
  try {
    const res = await fetch(NEWSAPI_URL, { headers: { "User-Agent": "Dexter/1.0" } });
    if (!res.ok) {
      if (cache) return { ok: true, items: cache.items };
      return { ok: false, items: [], error: `HTTP ${res.status}` };
    }
    const json = await res.json() as { articles?: Array<{ title: string; description: string; url: string; urlToImage: string; publishedAt: string; source: { name: string } }> };
    const items: NewsItem[] = (json.articles || []).filter((a) => a.title && a.title !== "[Removed]").map((a) => ({
      title: a.title,
      description: a.description || "",
      url: a.url,
      image: a.urlToImage || undefined,
      publishedAt: a.publishedAt,
      source: a.source?.name || "NewsAPI",
    }));
    cache = { ts: Date.now(), items };
    return { ok: true, items };
  } catch (e) {
    if (cache) return { ok: true, items: cache.items };
    return { ok: false, items: [], error: e instanceof Error ? e.message : "fetch failed" };
  }
});
