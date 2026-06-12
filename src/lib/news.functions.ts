import { createServerFn } from "@tanstack/react-start";

const FEEDS: Record<string, string> = {
  markets: "https://www.moneycontrol.com/rss/marketreports.xml",
  economy: "https://www.moneycontrol.com/rss/economy.xml",
  mutualfunds: "https://www.moneycontrol.com/rss/mutualfunds.xml",
  ipo: "https://www.moneycontrol.com/rss/iponews.xml",
  commodities: "https://www.moneycontrol.com/rss/commodities.xml",
};

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  category: string;
}

function parseRss(xml: string, category: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`).exec(block);
      return r ? r[1].trim() : "";
    };
    items.push({
      title: get("title"),
      link: get("link"),
      pubDate: get("pubDate"),
      category,
    });
  }
  return items;
}

let cache: { ts: number; items: NewsItem[] } | null = null;
const TTL = 5 * 60 * 1000;

export const getNews = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.ts < TTL) return cache.items;
  const results = await Promise.all(
    Object.entries(FEEDS).map(async ([cat, url]) => {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRss(xml, cat);
      } catch {
        return [];
      }
    })
  );
  const merged = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  cache = { ts: Date.now(), items: merged };
  return merged;
});
