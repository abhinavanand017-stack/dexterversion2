import { createServerFn } from "@tanstack/react-start";

export interface YahooQuote {
  symbol: string;
  price: number;
  change: number;
  pct: number;
  prev: number;
}

const SYMBOL_MAP: Record<string, string> = {
  nifty: "%5ENSEI",
  sensex: "%5EBSESN",
  vix: "%5EINDIAVIX",
};

async function fetchOne(key: string): Promise<YahooQuote | null> {
  const sym = SYMBOL_MAP[key];
  if (!sym) return null;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 Dexter/1.0" } },
    );
    if (!res.ok) return null;
    const json = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number } }> } };
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice || !meta?.previousClose) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose;
    return { symbol: key, price, prev, change: price - prev, pct: ((price - prev) / prev) * 100 };
  } catch {
    return null;
  }
}

/** Server-side proxy for Yahoo Finance quotes (avoids browser CORS). */
export const getYahooQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; quotes: YahooQuote[]; ts: number }> => {
    const results = await Promise.all(["nifty", "sensex", "vix"].map(fetchOne));
    const quotes = results.filter((q): q is YahooQuote => q !== null);
    return { ok: quotes.length > 0, quotes, ts: Date.now() };
  },
);
