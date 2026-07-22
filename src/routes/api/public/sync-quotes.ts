// Cron-invoked sync endpoint. Fetches free Yahoo Finance chart quotes for the
// Nifty 500 universe + ETF tickers in parallel chunks, upserts into
// public.live_quotes. Verified via `x-sync-secret` header matching
// SYNC_QUOTES_SECRET env var.
import { createFileRoute } from "@tanstack/react-router";
import { NIFTY500 } from "@/lib/nifty500";
import { ETFS } from "@/lib/etfs";

interface YahooResult {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    regularMarketVolume?: number;
  };
}

async function fetchYahoo(sym: string): Promise<{
  symbol: string;
  ltp: number;
  day_change: number;
  day_change_pct: number;
  volume: number | null;
} | null> {
  // NSE tickers use .NS suffix on Yahoo
  const yahooSym = `${sym}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=2d`;
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; DexterQuoteSync/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { chart?: { result?: YahooResult[] } };
    const res = json.chart?.result?.[0]?.meta;
    if (!res || typeof res.regularMarketPrice !== "number") return null;
    const ltp = res.regularMarketPrice;
    const prev = res.previousClose ?? res.chartPreviousClose ?? ltp;
    const change = ltp - prev;
    const pct = prev ? (change / prev) * 100 : 0;
    return {
      symbol: sym.toUpperCase(),
      ltp,
      day_change: +change.toFixed(4),
      day_change_pct: +pct.toFixed(4),
      volume: typeof res.regularMarketVolume === "number" ? res.regularMarketVolume : null,
    };
  } catch {
    return null;
  }
}

async function runInChunks<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const results = await Promise.all(chunk.map(fn));
    out.push(...results);
  }
  return out;
}

export const Route = createFileRoute("/api/public/sync-quotes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SYNC_QUOTES_SECRET;
        const provided = request.headers.get("x-sync-secret");
        if (!secret || !provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const started = Date.now();
        const symbols = Array.from(
          new Set([
            ...NIFTY500.map((s) => s.symbol),
            ...ETFS.map((e) => e.ticker),
          ]),
        );

        const results = await runInChunks(symbols, 12, fetchYahoo);
        const rows = results.filter((r): r is NonNullable<typeof r> => r !== null);

        if (rows.length === 0) {
          return Response.json({ ok: false, attempted: symbols.length, upserted: 0, ms: Date.now() - started });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("live_quotes")
          .upsert(
            rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
            { onConflict: "symbol" },
          );

        if (error) {
          console.error("[sync-quotes] upsert error:", error.message);
          return Response.json({ ok: false, error: error.message, upserted: 0 }, { status: 500 });
        }

        return Response.json({
          ok: true,
          attempted: symbols.length,
          upserted: rows.length,
          ms: Date.now() - started,
        });
      },
    },
  },
});
