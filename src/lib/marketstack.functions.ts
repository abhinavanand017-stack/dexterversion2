import { createServerFn } from "@tanstack/react-start";

const KEY = process.env.MARKETSTACK_KEY ?? "";

export interface MSQuote {
  symbol: string;
  name: string;
  price: number;
  prev: number;
  change: number;
  pct: number;
}

const FALLBACK: MSQuote[] = [
  { symbol: "NIFTY 50", name: "NIFTY 50", price: 24832, prev: 24688.8, change: 143.2, pct: 0.58 },
  { symbol: "SENSEX", name: "SENSEX", price: 81920, prev: 81507.2, change: 412.8, pct: 0.51 },
  { symbol: "NIFTY BANK", name: "NIFTY BANK", price: 55180, prev: 54920, change: 260, pct: 0.47 },
  { symbol: "NIFTY IT", name: "NIFTY IT", price: 41250, prev: 41105, change: 145, pct: 0.35 },
  { symbol: "NIFTY MIDCAP 100", name: "NIFTY MIDCAP 100", price: 58420, prev: 58210, change: 210, pct: 0.36 },
  { symbol: "GOLD", name: "GOLD ₹/10g", price: 73420, prev: 73180, change: 240, pct: 0.33 },
  { symbol: "USD/INR", name: "USD/INR", price: 83.42, prev: 83.51, change: -0.09, pct: -0.11 },
];

export const getMarketstackTicker = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; quotes: MSQuote[]; cached: boolean }> => {
    try {
      const url = `https://api.marketstack.com/v1/eod/latest?access_key=${KEY}&symbols=NSEI.INDX,BSESN.INDX,NSEBANK.INDX,CNXIT.INDX,NIFMDCP100.INDX`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return { ok: true, quotes: FALLBACK, cached: true };
      const json = (await res.json()) as { data?: Array<{ symbol: string; close: number; open: number }> };
      const data = json.data ?? [];
      const map: Record<string, string> = {
        "NSEI.INDX": "NIFTY 50",
        "BSESN.INDX": "SENSEX",
        "NSEBANK.INDX": "NIFTY BANK",
        "CNXIT.INDX": "NIFTY IT",
        "NIFMDCP100.INDX": "NIFTY MIDCAP 100",
      };
      const quotes: MSQuote[] = data.map((d) => {
        const change = d.close - d.open;
        const pct = (change / d.open) * 100;
        const name = map[d.symbol] ?? d.symbol;
        return { symbol: name, name, price: d.close, prev: d.open, change, pct };
      });
      // Append GOLD + USD/INR from fallback (Marketstack free tier doesn't cover them reliably)
      quotes.push(FALLBACK[5], FALLBACK[6]);
      if (quotes.length < 3) return { ok: true, quotes: FALLBACK, cached: true };
      return { ok: true, quotes, cached: false };
    } catch (e) {
      console.error("[marketstack] failed", e);
      return { ok: true, quotes: FALLBACK, cached: true };
    }
  },
);

export const getMarketstackEOD = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; limit?: number }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; bars: Array<{ date: string; open: number; high: number; low: number; close: number }>; cached: boolean }> => {
    try {
      const limit = data.limit ?? 252;
      const url = `https://api.marketstack.com/v1/eod?access_key=${KEY}&symbols=${encodeURIComponent(data.symbol)}&limit=${limit}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return { ok: false, bars: [], cached: true };
      const json = (await res.json()) as { data?: Array<{ date: string; open: number; high: number; low: number; close: number }> };
      const bars = (json.data ?? []).map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close })).reverse();
      return { ok: true, bars, cached: false };
    } catch (e) {
      console.error("[marketstack EOD] failed", e);
      return { ok: false, bars: [], cached: true };
    }
  });
