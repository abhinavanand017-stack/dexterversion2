import { createServerFn } from "@tanstack/react-start";

export interface TickerQuote {
  symbol: string;
  exchange: string;
  ltp: number;
  change: number;
  percentChange: number;
  ts: number;
}

export interface QuotesResponse {
  ok: boolean;
  source: "angel" | "error";
  quotes: TickerQuote[];
  error?: string;
}

export const getAngelQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuotesResponse> => {
    try {
      const { fetchAngelQuotes } = await import("./market.server");
      const quotes = await fetchAngelQuotes();
      return { ok: true, source: "angel", quotes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[getAngelQuotes] failed:", msg);
      return { ok: false, source: "error", quotes: [], error: msg };
    }
  },
);

export const getFinnhubToken = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ token: string | null }> => {
    const token = process.env.FINNHUB_KEY ?? null;
    return { token };
  },
);
