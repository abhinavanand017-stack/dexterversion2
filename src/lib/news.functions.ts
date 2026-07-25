import { createServerFn } from "@tanstack/react-start";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceId: string;
  category: string;
  publishedAt: string; // ISO
  image?: string;
}

export interface NewsResponse {
  ok: boolean;
  items: NewsItem[];
  feedsOk: number;
  feedsTotal: number;
  fetchedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Source config (server-side; used to build the feed list)
// ---------------------------------------------------------------------------
interface FeedDef { sourceId: string; source: string; url: string }

const FEEDS: FeedDef[] = [
  // Moneycontrol
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/latestnews.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/marketreports.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/business.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/economy.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/mutualfunds.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/iponews.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/commodities.xml" },
  { sourceId: "moneycontrol", source: "Moneycontrol", url: "https://www.moneycontrol.com/rss/results.xml" },
  // Economic Times
  { sourceId: "economic_times", source: "Economic Times", url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms" },
  { sourceId: "economic_times", source: "Economic Times", url: "https://economictimes.indiatimes.com/economy/rssfeeds/1373380680.cms" },
  { sourceId: "economic_times", source: "Economic Times", url: "https://economictimes.indiatimes.com/wealth/rssfeeds/837555174.cms" },
  { sourceId: "economic_times", source: "Economic Times", url: "https://economictimes.indiatimes.com/mf/rssfeeds/13357270.cms" },
  { sourceId: "economic_times", source: "Economic Times", url: "https://economictimes.indiatimes.com/markets/ipo/rssfeeds/22977588.cms" },
  // Livemint
  { sourceId: "livemint", source: "Livemint", url: "https://www.livemint.com/rss/markets" },
  { sourceId: "livemint", source: "Livemint", url: "https://www.livemint.com/rss/companies" },
  { sourceId: "livemint", source: "Livemint", url: "https://www.livemint.com/rss/economy" },
  { sourceId: "livemint", source: "Livemint", url: "https://www.livemint.com/rss/mutual-fund" },
  { sourceId: "livemint", source: "Livemint", url: "https://www.livemint.com/rss/ipo" },
  // Business Standard
  { sourceId: "business_standard", source: "Business Standard", url: "https://www.business-standard.com/rss/markets-106.rss" },
  { sourceId: "business_standard", source: "Business Standard", url: "https://www.business-standard.com/rss/economy-policy-102.rss" },
  { sourceId: "business_standard", source: "Business Standard", url: "https://www.business-standard.com/rss/companies-101.rss" },
  // Financial Express
  { sourceId: "financial_express", source: "Financial Express", url: "https://www.financialexpress.com/market/feed/" },
  { sourceId: "financial_express", source: "Financial Express", url: "https://www.financialexpress.com/economy/feed/" },
  // CNBC-TV18
  { sourceId: "cnbctv18", source: "CNBC-TV18", url: "https://www.cnbctv18.com/commonfeeds/v1/eng/rss/market.xml" },
  { sourceId: "cnbctv18", source: "CNBC-TV18", url: "https://www.cnbctv18.com/commonfeeds/v1/eng/rss/economy.xml" },
  // Morningstar India
  { sourceId: "morningstar", source: "Morningstar India", url: "https://www.morningstar.in/rss/news.aspx" },
  { sourceId: "morningstar", source: "Morningstar India", url: "https://www.morningstar.in/rss/mutualfunds.aspx" },
];

// ---------------------------------------------------------------------------
// Fallback demo articles (always available so page is never empty)
// ---------------------------------------------------------------------------
const FALLBACK: NewsItem[] = [
  { title: "Nifty 50 closes at fresh record high; IT, banking stocks lead rally", source: "Moneycontrol", sourceId: "moneycontrol", category: "markets", url: "https://www.moneycontrol.com", description: "Indian equity benchmarks hit new all-time highs as buying across IT and banking sectors pushed the Nifty above 25,000.", hoursAgo: 2 },
  { title: "RBI monetary policy: Repo rate unchanged at 6.5% for sixth consecutive meeting", source: "Economic Times", sourceId: "economic_times", category: "economy", url: "https://economictimes.indiatimes.com", description: "The Reserve Bank of India kept its benchmark lending rate unchanged, maintaining focus on inflation control.", hoursAgo: 3 },
  { title: "SBI Mutual Fund launches new Nifty 500 Index Fund; NFO opens next week", source: "Livemint", sourceId: "livemint", category: "mutualfunds", url: "https://www.livemint.com", description: "SBI MF announced a new passive index fund tracking the Nifty 500, offering broad market exposure at low cost.", hoursAgo: 4 },
  { title: "Reliance Industries Q4 results: Net profit up 11.4% to ₹19,407 crore", source: "Business Standard", sourceId: "business_standard", category: "results", url: "https://www.business-standard.com", description: "Reliance reported strong quarterly earnings driven by telecom and retail, beating analyst estimates.", hoursAgo: 5 },
  { title: "IPO Watch: Upcoming listings this week — key dates and GMP tracker", source: "Moneycontrol", sourceId: "moneycontrol", category: "ipo", url: "https://www.moneycontrol.com", description: "Several major IPOs lined up this week. Everything you need to know about subscription dates and grey market premiums.", hoursAgo: 6 },
  { title: "Gold prices rise to ₹74,200 per 10g; silver at ₹89,500 per kg", source: "CNBC-TV18", sourceId: "cnbctv18", category: "commodities", url: "https://www.cnbctv18.com", description: "Precious metals surged as global safe-haven demand increased amid geopolitical uncertainty.", hoursAgo: 7 },
  { title: "FII net buyers at ₹3,240 crore; DII also buys ₹1,890 crore today", source: "Economic Times", sourceId: "economic_times", category: "markets", url: "https://economictimes.indiatimes.com", description: "FIIs turned net buyers for the third session, providing strong support to the broader market.", hoursAgo: 8 },
  { title: "Morningstar India: Top 5 large-cap funds ranked by 5-year risk-adjusted return", source: "Morningstar India", sourceId: "morningstar", category: "mutualfunds", url: "https://www.morningstar.in", description: "Latest analysis ranks the best performing large-cap mutual funds after accounting for volatility and drawdown risk.", hoursAgo: 9 },
  { title: "India VIX falls to 12.4; low volatility signals market confidence", source: "Moneycontrol", sourceId: "moneycontrol", category: "markets", url: "https://www.moneycontrol.com", description: "India's fear gauge touched a multi-month low, indicating stable trading conditions ahead.", hoursAgo: 10 },
  { title: "SEBI proposes new F&O rules: Weekly expiry limit per exchange", source: "Business Standard", sourceId: "business_standard", category: "economy", url: "https://www.business-standard.com", description: "SEBI has proposed restricting weekly options contracts per exchange to curb excessive speculation.", hoursAgo: 11 },
  { title: "Crude oil slips below $80; HPCL, BPCL, IOC shares gain on margin outlook", source: "Livemint", sourceId: "livemint", category: "commodities", url: "https://www.livemint.com", description: "OMCs rose sharply as falling crude prices improved refining margin outlook for the coming quarter.", hoursAgo: 12 },
  { title: "Parag Parikh Flexi Cap AUM crosses ₹80,000 crore; highest ever in category", source: "Financial Express", sourceId: "financial_express", category: "mutualfunds", url: "https://www.financialexpress.com", description: "The flagship flexi-cap scheme crossed a new AUM milestone, reflecting sustained investor confidence.", hoursAgo: 13 },
  { title: "Infosys raises FY26 revenue guidance after strong Q1 deal wins", source: "Moneycontrol", sourceId: "moneycontrol", category: "results", url: "https://www.moneycontrol.com", description: "India's second-largest IT company beat quarterly estimates and raised its annual revenue outlook.", hoursAgo: 14 },
  { title: "India retail inflation eases to 4.1% in June; food prices cool sharply", source: "Economic Times", sourceId: "economic_times", category: "economy", url: "https://economictimes.indiatimes.com", description: "CPI inflation fell to a five-month low as vegetable and cereal prices softened significantly.", hoursAgo: 15 },
  { title: "Adani Green Energy secures $1.2 billion green bond for solar expansion", source: "Business Standard", sourceId: "business_standard", category: "markets", url: "https://www.business-standard.com", description: "Adani Green priced a landmark green bond with strong oversubscription from global ESG investors.", hoursAgo: 16 },
  { title: "Budget 2026 expectations: Market hopes for capital gains tax relief", source: "Livemint", sourceId: "livemint", category: "economy", url: "https://www.livemint.com", description: "Investor bodies are lobbying for a rollback of the 2024 hike in long-term capital gains tax.", hoursAgo: 24 },
  { title: "Morningstar: Indian valuations stretched; prefer quality over growth", source: "Morningstar India", sourceId: "morningstar", category: "markets", url: "https://www.morningstar.in", description: "Morningstar recommends shifting toward quality-factor stocks as mid and small-cap valuations look expensive.", hoursAgo: 26 },
  { title: "Defence stocks rally 3.4%; HAL, BEL, BDL hit 52-week highs on export orders", source: "CNBC-TV18", sourceId: "cnbctv18", category: "markets", url: "https://www.cnbctv18.com", description: "Indian defence manufacturers surged after news of major export deals worth over $2 billion.", hoursAgo: 28 },
  { title: "HDFC AMC reports 28% profit jump; declares ₹70 per share dividend", source: "Financial Express", sourceId: "financial_express", category: "results", url: "https://www.financialexpress.com", description: "India's largest AMC by profitability reported a strong quarter, benefiting from rising AUM.", hoursAgo: 30 },
  { title: "Rupee strengthens to 83.20 against dollar; RBI intervention cited", source: "Moneycontrol", sourceId: "moneycontrol", category: "economy", url: "https://www.moneycontrol.com", description: "The rupee appreciated to a two-week high on FII dollar inflows and RBI dollar sales.", hoursAgo: 32 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
].map((a: any, i) => ({
  id: `fallback-${i}`,
  title: a.title,
  description: a.description,
  url: a.url,
  source: a.source,
  sourceId: a.sourceId,
  category: a.category,
  publishedAt: new Date(Date.now() - a.hoursAgo * 3600_000).toISOString(),
}));

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function detectCategory(text: string): string {
  const t = text.toLowerCase();
  if (/\b(ipo|listing|allotment|subscription|gmp)\b/.test(t)) return "ipo";
  if (/\b(mutual fund|mf|nav|sip|amc|scheme|nfo)\b/.test(t)) return "mutualfunds";
  if (/\b(rbi|repo|inflation|gdp|fiscal|budget|cpi|wpi)\b/.test(t)) return "economy";
  if (/\b(gold|silver|crude|oil|commodity|commodities)\b/.test(t)) return "commodities";
  if (/\b(result|results|profit|revenue|quarter|earnings|q1|q2|q3|q4)\b/.test(t)) return "results";
  if (/\b(rupee|dollar|forex|currency|fx)\b/.test(t)) return "economy";
  if (/\b(nifty|sensex|bse|nse|index|indices|fii|dii|midcap|smallcap)\b/.test(t)) return "markets";
  return "markets";
}

function stripHtml(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface Rss2JsonItem { title?: string; link?: string; guid?: string; pubDate?: string; description?: string; thumbnail?: string; enclosure?: { link?: string } }

async function fetchOneFeed(feed: FeedDef, apiKey: string | undefined, timeoutMs = 8000): Promise<NewsItem[]> {
  const params = new URLSearchParams({ rss_url: feed.url, count: "15" });
  if (apiKey) params.set("api_key", apiKey);
  const apiUrl = `https://api.rss2json.com/v1/api.json?${params.toString()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { status?: string; items?: Rss2JsonItem[]; message?: string };
    if (data.status !== "ok" || !Array.isArray(data.items)) throw new Error(data.message || "Feed error");
    return data.items
      .filter((it) => it.title && it.link)
      .map((it) => {
        const title = stripHtml(it.title).slice(0, 240);
        const description = stripHtml(it.description).slice(0, 220);
        const pub = it.pubDate ? new Date(it.pubDate) : new Date();
        const iso = isNaN(pub.getTime()) ? new Date().toISOString() : pub.toISOString();
        return {
          id: it.guid || it.link!,
          title,
          description,
          url: it.link!,
          source: feed.source,
          sourceId: feed.sourceId,
          category: detectCategory(`${title} ${description}`),
          publishedAt: iso,
          image: it.thumbnail || it.enclosure?.link || undefined,
        } as NewsItem;
      });
  } catch (e) {
    console.warn(`[news] feed failed ${feed.url}:`, e instanceof Error ? e.message : e);
    return [];
  } finally { clearTimeout(t); }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
let cache: { ts: number; payload: NewsResponse } | null = null;
const TTL = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------
export const getNews = createServerFn({ method: "GET" }).handler(async (): Promise<NewsResponse> => {
  if (cache && Date.now() - cache.ts < TTL) return cache.payload;

  const apiKey = process.env.RSS2JSON_KEY || undefined;

  const results = await Promise.allSettled(FEEDS.map((f) => fetchOneFeed(f, apiKey)));

  const feedsOk = results.filter((r) => r.status === "fulfilled" && (r.value as NewsItem[]).length > 0).length;
  const merged: NewsItem[] = [];
  for (const r of results) if (r.status === "fulfilled") merged.push(...r.value);

  // Dedup by normalized title prefix
  const seen = new Set<string>();
  const deduped = merged.filter((it) => {
    const k = it.title.slice(0, 60).toLowerCase().replace(/\s+/g, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  let payload: NewsResponse;
  if (deduped.length === 0) {
    payload = {
      ok: false,
      items: FALLBACK,
      feedsOk: 0,
      feedsTotal: FEEDS.length,
      fetchedAt: new Date().toISOString(),
      error: "All RSS feeds failed — showing demo articles.",
    };
  } else {
    payload = {
      ok: true,
      items: deduped.slice(0, 200),
      feedsOk,
      feedsTotal: FEEDS.length,
      fetchedAt: new Date().toISOString(),
    };
  }
  cache = { ts: Date.now(), payload };
  return payload;
});

// ---------------------------------------------------------------------------
// Dexter Daily Digest — Lovable AI Gateway (server-side)
// ---------------------------------------------------------------------------
export interface DigestInput { headlines: Array<{ title: string; source: string }> }
export interface DigestResponse { ok: boolean; text: string; mood?: string; generatedAt?: string; error?: string }

export const generateNewsDigest = createServerFn({ method: "POST" })
  .inputValidator((i: DigestInput) => i)
  .handler(async ({ data }): Promise<DigestResponse> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, text: "", error: "LOVABLE_API_KEY not configured" };
    if (!data.headlines?.length) return { ok: false, text: "", error: "No headlines" };

    const lines = data.headlines.slice(0, 10).map((h, i) => `${i + 1}. ${h.title} (${h.source})`).join("\n");
    const prompt = `You are Dexter, a bio-algorithmic trading AI for Indian markets. Based on these top market headlines from today, write a daily market digest.

Headlines:
${lines}

Write in EXACTLY this structure (keep total under 120 words):

MARKET MOOD: [One word: Bullish / Bearish / Cautious / Volatile]

TODAY IN 3 SENTENCES:
[3 sentences covering the most important market moves and why]

KEY THEMES TODAY:
• [Theme 1 with one-line explanation]
• [Theme 2 with one-line explanation]
• [Theme 3 with one-line explanation]

WHAT TO WATCH TOMORROW:
[One sentence about the most important upcoming event or data point]

Be specific to Indian markets (NSE, BSE, RBI, SEBI). Speak directly ("Markets today...", "Traders should watch...").`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "raw-fetch" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { ok: false, text: "", error: `AI ${res.status}: ${t.slice(0, 120)}` };
      }
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      const m = text.match(/MARKET MOOD:\s*(\w+)/i);
      return { ok: text.length > 0, text, mood: m?.[1], generatedAt: new Date().toISOString() };
    } catch (e) {
      return { ok: false, text: "", error: e instanceof Error ? e.message : "unknown" };
    }
  });
