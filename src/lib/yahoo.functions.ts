import { createServerFn } from "@tanstack/react-start";

export interface YahooQuote {
  symbol: string;
  price: number;
  change: number;
  pct: number;
  prev: number;
}

export interface YahooBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type QuoteSource = "nse" | "yahoo" | "marketstack" | "twelvedata" | "cached" | "seed";

const NSE_INDEX_MAP: Record<string, string> = {
  nifty: "NIFTY 50",
  sensex: "S&P BSE SENSEX",
  vix: "INDIA VIX",
};

let nseCookie: { value: string; ts: number } | null = null;
async function getNseCookie(): Promise<string> {
  if (nseCookie && Date.now() - nseCookie.ts < 5 * 60 * 1000) return nseCookie.value;
  const r = await withTimeout(fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS }), 5000);
  const sc = r.headers.get("set-cookie") || "";
  const cookies = sc.split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  nseCookie = { value: cookies, ts: Date.now() };
  return cookies;
}

async function fetchNseIndices(): Promise<YahooQuote[]> {
  try {
    const cookie = await getNseCookie();
    const res = await withTimeout(fetch("https://www.nseindia.com/api/allIndices", {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.nseindia.com/", Cookie: cookie },
    }), 5000);
    if (!res.ok) return [];
    const json = await res.json() as { data?: Array<{ index: string; last: number; variation: number; percentChange: number; previousClose: number }> };
    const byName: Record<string, { last: number; variation: number; percentChange: number; previousClose: number }> = {};
    for (const d of json.data || []) byName[d.index] = d;
    const out: YahooQuote[] = [];
    for (const [k, idx] of Object.entries(NSE_INDEX_MAP)) {
      const d = byName[idx];
      if (!d) continue;
      out.push({ symbol: k, price: d.last, prev: d.previousClose, change: d.variation, pct: d.percentChange });
    }
    return out;
  } catch { return []; }
}

export async function fetchNseAllIndices(): Promise<Array<{ index: string; last: number; variation: number; percentChange: number; previousClose: number }>> {
  try {
    const cookie = await getNseCookie();
    const res = await withTimeout(fetch("https://www.nseindia.com/api/allIndices", {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.nseindia.com/", Cookie: cookie },
    }), 5000);
    if (!res.ok) return [];
    const json = await res.json() as { data?: Array<{ index: string; last: number; variation: number; percentChange: number; previousClose: number }> };
    return json.data || [];
  } catch { return []; }
}

// === Ticker indices (NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT, NIFTY MIDCAP 100, INDIA VIX) ===
export interface IndexQuote {
  symbol: string; name: string; price: number; prev: number; change: number; pct: number;
}
const TICKER_INDICES: Array<{ key: string; nse: string; yahoo?: string }> = [
  { key: "NIFTY 50",         nse: "NIFTY 50",         yahoo: "%5ENSEI" },
  { key: "SENSEX",           nse: "S&P BSE SENSEX",   yahoo: "%5EBSESN" },
  { key: "NIFTY BANK",       nse: "NIFTY BANK",       yahoo: "%5ENSEBANK" },
  { key: "NIFTY IT",         nse: "NIFTY IT" },
  { key: "NIFTY MIDCAP 100", nse: "NIFTY MIDCAP 100" },
  { key: "INDIA VIX",        nse: "INDIA VIX",        yahoo: "%5EINDIAVIX" },
];

type TickerCache = { ts: number; quotes: IndexQuote[]; source: "nse" | "yahoo" };
const tickerCache: { current?: TickerCache } = {};

async function fetchYahooIndex(sym: string): Promise<{ price: number; prev: number } | null> {
  try {
    const res = await withTimeout(
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`, { headers: BROWSER_HEADERS }),
      4000,
    );
    if (!res.ok) return null;
    const json = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number } }> } };
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.previousClose ?? meta?.chartPreviousClose;
    if (price == null || prev == null) return null;
    return { price, prev };
  } catch { return null; }
}

export const getIndicesTicker = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; quotes: IndexQuote[]; source: "nse" | "yahoo" | "cached"; ts: number }> => {
    const now = Date.now();
    if (tickerCache.current && now - tickerCache.current.ts < CACHE_TTL_MS) {
      return { ok: true, quotes: tickerCache.current.quotes, source: tickerCache.current.source, ts: tickerCache.current.ts };
    }
    // 1) NSE allIndices
    const nseAll = await fetchNseAllIndices();
    if (nseAll.length) {
      const byName: Record<string, typeof nseAll[number]> = {};
      for (const d of nseAll) byName[d.index] = d;
      const quotes: IndexQuote[] = [];
      for (const t of TICKER_INDICES) {
        const d = byName[t.nse];
        if (d) quotes.push({ symbol: t.key, name: t.key, price: d.last, prev: d.previousClose, change: d.variation, pct: d.percentChange });
      }
      if (quotes.length >= 3) {
        tickerCache.current = { ts: now, quotes, source: "nse" };
        return { ok: true, quotes, source: "nse", ts: now };
      }
    }
    // 2) Yahoo fallback (NIFTY 50, SENSEX, NIFTY BANK, INDIA VIX)
    const yEntries = TICKER_INDICES.filter((t) => t.yahoo);
    const yResults = await Promise.all(yEntries.map((t) => fetchYahooIndex(t.yahoo!)));
    const yquotes: IndexQuote[] = [];
    yEntries.forEach((t, i) => {
      const r = yResults[i];
      if (!r) return;
      yquotes.push({ symbol: t.key, name: t.key, price: r.price, prev: r.prev, change: r.price - r.prev, pct: ((r.price - r.prev) / r.prev) * 100 });
    });
    if (yquotes.length >= 2) {
      tickerCache.current = { ts: now, quotes: yquotes, source: "yahoo" };
      return { ok: true, quotes: yquotes, source: "yahoo", ts: now };
    }
    // 3) Stale cache
    if (tickerCache.current) {
      return { ok: true, quotes: tickerCache.current.quotes, source: "cached", ts: tickerCache.current.ts };
    }
    return { ok: false, quotes: [], source: "cached", ts: now };
  },
);

export const getNseStockIndex = createServerFn({ method: "GET" })
  .inputValidator((input: { index?: string }) => ({ index: input.index || "NIFTY 500" }))
  .handler(async ({ data }) => {
    try {
      const cookie = await getNseCookie();
      const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(data.index)}`;
      const res = await withTimeout(fetch(url, {
        headers: { ...BROWSER_HEADERS, Referer: "https://www.nseindia.com/", Cookie: cookie },
      }), 6000);
      if (!res.ok) return { ok: false, data: [] as Array<{ symbol: string; lastPrice: number; pChange: number; meta?: { industry?: string; companyName?: string } }> };
      const json = await res.json() as { data?: Array<{ symbol: string; lastPrice: number; pChange: number; meta?: { industry?: string; companyName?: string } }> };
      return { ok: true, data: json.data || [] };
    } catch { return { ok: false, data: [] as Array<{ symbol: string; lastPrice: number; pChange: number; meta?: { industry?: string; companyName?: string } }> }; }
  });

const SYMBOL_MAP: Record<string, string> = {
  nifty: "%5ENSEI",
  sensex: "%5EBSESN",
  vix: "%5EINDIAVIX",
};

const MS_MAP: Record<string, string> = {
  nifty: "NSEI.INDX",
  sensex: "BSESN.INDX",
};

const SEED: Record<string, { price: number; prev: number }> = {
  nifty: { price: 24832, prev: 24688.8 },
  sensex: { price: 81920, prev: 81507.2 },
  vix: { price: 14.2, prev: 14.5 },
};

// Server-side cache (per-isolate). 12s TTL = "near real-time" without hammering providers.
const CACHE_TTL_MS = 12_000;
type CacheEntry = { ts: number; quotes: YahooQuote[]; source: QuoteSource };
const cache: { current?: CacheEntry } = {};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function fetchYahooOne(key: string): Promise<YahooQuote | null> {
  const sym = SYMBOL_MAP[key];
  if (!sym) return null;
  try {
    const res = await withTimeout(
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`, { headers: BROWSER_HEADERS }),
      4000,
    );
    if (!res.ok) return null;
    const json = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number } }> } };
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.previousClose ?? meta?.chartPreviousClose;
    if (price == null || prev == null) return null;
    return { symbol: key, price, prev, change: price - prev, pct: ((price - prev) / prev) * 100 };
  } catch {
    return null;
  }
}

async function fetchMarketstack(): Promise<YahooQuote[]> {
  const KEY = process.env.MARKETSTACK_KEY;
  if (!KEY) return [];
  try {
    const symbols = Object.values(MS_MAP).join(",");
    const url = `https://api.marketstack.com/v1/eod/latest?access_key=${KEY}&symbols=${symbols}`;
    const res = await withTimeout(fetch(url), 4500);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ symbol: string; close: number; open: number }> };
    const inv: Record<string, string> = Object.fromEntries(Object.entries(MS_MAP).map(([k, v]) => [v, k]));
    return (json.data ?? []).flatMap((d) => {
      const key = inv[d.symbol];
      if (!key) return [];
      const change = d.close - d.open;
      return [{ symbol: key, price: d.close, prev: d.open, change, pct: (change / d.open) * 100 }];
    });
  } catch {
    return [];
  }
}

function fromSeed(): YahooQuote[] {
  return Object.entries(SEED).map(([k, v]) => ({
    symbol: k,
    price: v.price,
    prev: v.prev,
    change: v.price - v.prev,
    pct: ((v.price - v.prev) / v.prev) * 100,
  }));
}

/** Unified quote endpoint with provider fallback + short server cache. */
export const getYahooQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; quotes: YahooQuote[]; ts: number; source: QuoteSource; ageMs: number }> => {
    const now = Date.now();
    if (cache.current && now - cache.current.ts < CACHE_TTL_MS) {
      return { ok: true, quotes: cache.current.quotes, ts: cache.current.ts, source: cache.current.source, ageMs: now - cache.current.ts };
    }
    // 1) NSE official (cookie-bootstrapped)
    const nse = await fetchNseIndices();
    if (nse.length >= 2) {
      cache.current = { ts: now, quotes: nse, source: "nse" };
      return { ok: true, quotes: nse, ts: now, source: "nse", ageMs: 0 };
    }
    // 2) Yahoo (3 parallel)
    const yahoo = (await Promise.all(["nifty", "sensex", "vix"].map(fetchYahooOne))).filter((q): q is YahooQuote => q !== null);
    if (yahoo.length >= 2) {
      cache.current = { ts: now, quotes: yahoo, source: "yahoo" };
      return { ok: true, quotes: yahoo, ts: now, source: "yahoo", ageMs: 0 };
    }
    // 2) Marketstack (no VIX support — pad from seed)
    const ms = await fetchMarketstack();
    if (ms.length >= 1) {
      const haveKeys = new Set(ms.map((q) => q.symbol));
      const padded = [...ms, ...fromSeed().filter((q) => !haveKeys.has(q.symbol))];
      cache.current = { ts: now, quotes: padded, source: "marketstack" };
      return { ok: true, quotes: padded, ts: now, source: "marketstack", ageMs: 0 };
    }
    // 3) Stale cache if available
    if (cache.current) {
      return { ok: true, quotes: cache.current.quotes, ts: cache.current.ts, source: "cached", ageMs: now - cache.current.ts };
    }
    // 4) Seed fallback
    const seed = fromSeed();
    return { ok: false, quotes: seed, ts: now, source: "seed", ageMs: 0 };
  },
);

/** Historical OHLCV for any Yahoo symbol (e.g. RELIANCE.NS, TCS.NS, AAPL). */
export const fetchYahooChart = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; range?: string; interval?: string }) => ({
    symbol: String(input.symbol || "").slice(0, 32),
    range: input.range || "2y",
    interval: input.interval || "1d",
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; bars: YahooBar[]; currency?: string; longName?: string; price?: number; error?: string }> => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}?interval=${data.interval}&range=${data.range}`;
      const res = await withTimeout(fetch(url, { headers: BROWSER_HEADERS }), 6000);
      if (!res.ok) return { ok: false, bars: [], error: `HTTP ${res.status}` };
      const json = await res.json() as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; currency?: string; longName?: string; symbol?: string };
            timestamp?: number[];
            indicators?: { quote?: Array<{ open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }> };
          }>;
          error?: { description?: string };
        };
      };
      if (json.chart?.error) return { ok: false, bars: [], error: json.chart.error.description || "yahoo error" };
      const r = json.chart?.result?.[0];
      const ts = r?.timestamp;
      const q = r?.indicators?.quote?.[0];
      if (!ts || !q) return { ok: false, bars: [], error: "no series" };
      const bars: YahooBar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open[i]; const h = q.high[i]; const l = q.low[i]; const c = q.close[i]; const v = q.volume[i];
        if (o == null || h == null || l == null || c == null) continue;
        bars.push({ t: ts[i] * 1000, o, h, l, c, v: v ?? 0 });
      }
      return {
        ok: bars.length > 0,
        bars,
        currency: r?.meta?.currency,
        longName: r?.meta?.longName,
        price: r?.meta?.regularMarketPrice,
      };
    } catch (e) {
      return { ok: false, bars: [], error: e instanceof Error ? e.message : "unknown" };
    }
  });
