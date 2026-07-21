import type { DataProvider, AnyQuote, HistoricalBar, HistRange } from "./types";
import { getStore } from "./store";

// Deterministic synthetic history seeded off the symbol + latest price.
// Static dataset has no time-series; we generate a plausible walk terminating
// at the current LTP/NAV so callers get a usable series without cloud calls.
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const RANGE_DAYS: Record<HistRange, number> = { "1m": 22, "3m": 66, "6m": 130, "1y": 260, "5y": 1300 };

function synthPath(symbol: string, endPrice: number, days: number, driftPctYear: number): HistoricalBar[] {
  const r = rnd(hash(symbol));
  const out: HistoricalBar[] = [];
  const now = Date.now();
  const drift = driftPctYear / 100 / 252;
  const vol = 0.015;
  // walk backwards from endPrice
  let p = endPrice;
  const back: number[] = [p];
  for (let i = 1; i < days; i++) { p = p / (1 + drift + (r() - 0.5) * vol); back.push(p); }
  back.reverse();
  for (let i = 0; i < days; i++) {
    const t = now - (days - 1 - i) * 86400000;
    out.push({ t, c: +back[i].toFixed(2) });
  }
  return out;
}

export class StaticProvider implements DataProvider {
  readonly mode = "static" as const;
  get asOf(): string { return `Static dataset (as of ${getStore().asOf})`; }

  async getQuote(symbol: string): Promise<AnyQuote | null> {
    const s = getStore();
    const up = symbol.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
    const stock = s.stocks.get(up);
    if (stock) return { kind: "stock", ...stock };
    const lc = symbol.toLowerCase().trim();
    const fund = s.funds.get(lc);
    if (fund) return { kind: "fund", ...fund };
    const etf = s.etfs.get(lc);
    if (etf) return { kind: "etf", ...etf };
    return null;
  }

  async getHistorical(symbol: string, range: HistRange): Promise<HistoricalBar[]> {
    const q = await this.getQuote(symbol);
    if (!q) return [];
    const days = RANGE_DAYS[range];
    if (q.kind === "stock") {
      const end = q.ltp ?? q.prevClose ?? 100;
      return synthPath(symbol, end, days, q.chg365dPct ?? 8);
    }
    if (q.kind === "etf") return synthPath(symbol, q.nav ?? 100, days, q.ret1y ?? 8);
    return synthPath(symbol, 100, days, q.ret1y ?? 10);
  }
}
