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
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Dexter/1.0" } });
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
