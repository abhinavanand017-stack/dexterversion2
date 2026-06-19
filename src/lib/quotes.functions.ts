import { createServerFn } from "@tanstack/react-start";

export interface LiveQuote {
  symbol: string;          // raw key the client asked for (e.g. "RELIANCE.NS" or "RELIANCE")
  price: number;
  change: number;
  pct: number;
  prev: number;
  dayHigh?: number;
  dayLow?: number;
  source: "yahoo" | "marketstack" | "cached" | "unavailable";
  status: "live" | "delayed" | "stale";
  fetchedAt: number;       // ms epoch
}

export interface QuotesResponse {
  ok: boolean;
  quotes: Record<string, LiveQuote>;
  status: "live" | "delayed" | "stale";
  fetchedAt: number;
  failedSymbols: string[];
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const CACHE_TTL_MS = 12_000;
const STALE_AFTER_MS = 15 * 60_000;

type Entry = { quote: LiveQuote; ts: number };
const cache = new Map<string, Entry>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Normalize a user symbol to a Yahoo symbol. NSE stocks default to `.NS`. */
function toYahoo(sym: string): string {
  const s = sym.trim().toUpperCase();
  if (!s) return s;
  // Already has an exchange suffix or is a Yahoo index symbol
  if (s.startsWith("^") || s.includes(".") || s.includes("=") || s.includes("%5E")) return s;
  return `${s}.NS`;
}

async function fetchYahooOne(rawSym: string): Promise<LiveQuote | null> {
  const ySym = toYahoo(rawSym);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1m&range=1d`;
    const res = await withTimeout(fetch(url, { headers: BROWSER_HEADERS }), 4500);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            previousClose?: number;
            chartPreviousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
          };
        }>;
      };
    };
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.previousClose ?? meta?.chartPreviousClose;
    if (price == null || prev == null) return null;
    return {
      symbol: rawSym,
      price,
      prev,
      change: price - prev,
      pct: prev ? ((price - prev) / prev) * 100 : 0,
      dayHigh: meta?.regularMarketDayHigh,
      dayLow: meta?.regularMarketDayLow,
      source: "yahoo",
      status: "live",
      fetchedAt: Date.now(),
    };
  } catch (e) {
    console.warn(`[get-quotes] yahoo fail ${rawSym}:`, (e as Error).message);
    return null;
  }
}

async function fetchMarketstackBatch(rawSyms: string[]): Promise<Record<string, LiveQuote>> {
  const KEY = process.env.MARKETSTACK_KEY || "027d0001e4266af178794333600e13f3";
  if (!KEY || !rawSyms.length) return {};
  try {
    // Marketstack uses XNSE prefix-less symbols like "RELIANCE.XNSE"
    const map: Record<string, string> = {};
    const msSyms = rawSyms.map((s) => {
      const root = s.replace(/\.NS$/i, "");
      const ms = `${root}.XNSE`;
      map[ms] = s;
      return ms;
    });
    const url = `https://api.marketstack.com/v1/eod/latest?access_key=${KEY}&symbols=${msSyms.join(",")}`;
    const res = await withTimeout(fetch(url), 5500);
    if (!res.ok) return {};
    const json = (await res.json()) as {
      data?: Array<{ symbol: string; close: number; open: number; high?: number; low?: number }>;
    };
    const out: Record<string, LiveQuote> = {};
    for (const d of json.data ?? []) {
      const raw = map[d.symbol];
      if (!raw) continue;
      const price = d.close;
      const prev = d.open;
      out[raw] = {
        symbol: raw,
        price,
        prev,
        change: price - prev,
        pct: prev ? ((price - prev) / prev) * 100 : 0,
        dayHigh: d.high,
        dayLow: d.low,
        source: "marketstack",
        status: "delayed",
        fetchedAt: Date.now(),
      };
    }
    return out;
  } catch (e) {
    console.warn("[get-quotes] marketstack batch fail:", (e as Error).message);
    return {};
  }
}

/** Batched live-quotes endpoint with provider fallback + short server cache + stale-marker. */
export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((input: { symbols: string[] }) => ({
    symbols: Array.from(
      new Set((input?.symbols ?? []).map((s) => String(s).trim()).filter(Boolean)),
    ).slice(0, 200),
  }))
  .handler(async ({ data }): Promise<QuotesResponse> => {
    const now = Date.now();
    const quotes: Record<string, LiveQuote> = {};
    const needFetch: string[] = [];

    // 1) Serve fresh from cache
    for (const sym of data.symbols) {
      const hit = cache.get(sym);
      if (hit && now - hit.ts < CACHE_TTL_MS) {
        quotes[sym] = { ...hit.quote, fetchedAt: hit.ts };
      } else {
        needFetch.push(sym);
      }
    }

    // 2) Yahoo first, in parallel chunks of 12
    const yahooResults: Record<string, LiveQuote> = {};
    const chunkSize = 12;
    for (let i = 0; i < needFetch.length; i += chunkSize) {
      const chunk = needFetch.slice(i, i + chunkSize);
      const res = await Promise.all(chunk.map(fetchYahooOne));
      res.forEach((q, idx) => {
        if (q) yahooResults[chunk[idx]] = q;
      });
    }
    Object.assign(quotes, yahooResults);

    // 3) Marketstack fallback for whatever's still missing
    const missing = needFetch.filter((s) => !yahooResults[s]);
    if (missing.length) {
      const ms = await fetchMarketstackBatch(missing);
      Object.assign(quotes, ms);
    }

    // 4) Cache successful fetches
    for (const sym of needFetch) {
      const q = quotes[sym];
      if (q) cache.set(sym, { quote: q, ts: now });
    }

    // 5) Last-known-good for symbols that still failed
    const failed: string[] = [];
    for (const sym of data.symbols) {
      if (quotes[sym]) continue;
      const hit = cache.get(sym);
      if (hit) {
        const age = now - hit.ts;
        const status: LiveQuote["status"] = age > STALE_AFTER_MS ? "stale" : "delayed";
        quotes[sym] = { ...hit.quote, source: "cached", status, fetchedAt: hit.ts };
      } else {
        failed.push(sym);
        quotes[sym] = {
          symbol: sym, price: 0, change: 0, pct: 0, prev: 0,
          source: "unavailable", status: "stale", fetchedAt: now,
        };
      }
    }

    // Aggregate status: live if all yahoo, delayed if any fallback/cached, stale if any unavailable
    let overall: "live" | "delayed" | "stale" = "live";
    for (const sym of data.symbols) {
      const s = quotes[sym].status;
      if (s === "stale") { overall = "stale"; break; }
      if (s === "delayed") overall = "delayed";
    }

    return { ok: failed.length === 0, quotes, status: overall, fetchedAt: now, failedSymbols: failed };
  });
