// Stub live provider — wired later to Kite Connect / NSE / broker feed.
// Reads endpoint from LIVE_DATA_ENDPOINT (env or localStorage). When empty,
// falls back to the StaticProvider so the app never breaks.

import type { DataProvider, AnyQuote, HistoricalBar, HistRange } from "./types";
import { StaticProvider } from "./staticProvider";

function endpoint(): string | null {
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem("dx_live_data_endpoint");
    if (ls) return ls;
  }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  return env?.VITE_LIVE_DATA_ENDPOINT ?? null;
}

export class LiveProvider implements DataProvider {
  readonly mode = "live" as const;
  private fallback = new StaticProvider();
  get asOf(): string { return endpoint() ? `Live • ${new Date().toLocaleTimeString()}` : `Live endpoint not configured — static fallback (${this.fallback.asOf})`; }

  async getQuote(symbol: string): Promise<AnyQuote | null> {
    const url = endpoint();
    if (!url) return this.fallback.getQuote(symbol);
    try {
      const r = await fetch(`${url.replace(/\/$/, "")}/quote?symbol=${encodeURIComponent(symbol)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as AnyQuote;
    } catch {
      return this.fallback.getQuote(symbol);
    }
  }

  async getHistorical(symbol: string, range: HistRange): Promise<HistoricalBar[]> {
    const url = endpoint();
    if (!url) return this.fallback.getHistorical(symbol, range);
    try {
      const r = await fetch(`${url.replace(/\/$/, "")}/historical?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as HistoricalBar[];
    } catch {
      return this.fallback.getHistorical(symbol, range);
    }
  }
}
