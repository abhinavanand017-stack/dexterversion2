// Cron-invoked ETF refresh. Pulls live LTP / day change / volume / 52w range
// for every ticker in public.etfs from Yahoo Finance (NSE .NS symbols) and
// writes them back. Also records a daily AUM snapshot for the trend chart.
// Verified via `x-sync-secret` header matching SYNC_QUOTES_SECRET.
import { createFileRoute } from "@tanstack/react-router";

interface Meta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

async function fetchQuote(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.NS?interval=1d&range=1y`;
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; DexterEtfSync/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { chart?: { result?: { meta?: Meta }[] } };
    const m = json.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return null;
    const ltp = m.regularMarketPrice;
    const prev = m.previousClose ?? m.chartPreviousClose ?? ltp;
    return {
      ticker,
      ltp_nav: ltp,
      day_change_pct: prev ? +(((ltp - prev) / prev) * 100).toFixed(4) : 0,
      volume: typeof m.regularMarketVolume === "number" ? m.regularMarketVolume : null,
      w52_high: typeof m.fiftyTwoWeekHigh === "number" ? m.fiftyTwoWeekHigh : null,
      w52_low: typeof m.fiftyTwoWeekLow === "number" ? m.fiftyTwoWeekLow : null,
      price_updated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function inChunks<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export const Route = createFileRoute("/api/public/sync-etfs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SYNC_QUOTES_SECRET"];
        const provided = request.headers.get("x-sync-secret");
        if (!secret || provided !== secret) return new Response("Unauthorized", { status: 401 });

        const started = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: etfs, error: readErr } = await supabaseAdmin.from("etfs").select("ticker, aum_cr");
        if (readErr) {
          console.error("[sync-etfs] read error:", readErr.message);
          return Response.json({ ok: false, error: readErr.message }, { status: 500 });
        }

        const tickers = (etfs ?? []).map((e) => e.ticker as string);
        const quotes = (await inChunks(tickers, 10, fetchQuote)).filter(
          (q): q is NonNullable<typeof q> => q !== null,
        );

        let updated = 0;
        for (const q of quotes) {
          const { ticker, ...fields } = q;
          const { error } = await supabaseAdmin
            .from("etfs")
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq("ticker", ticker);
          if (error) console.error(`[sync-etfs] update ${ticker}:`, error.message);
          else updated++;
        }

        // Daily AUM snapshot (idempotent on ticker+date).
        const snapshots = (etfs ?? [])
          .filter((e) => e.aum_cr != null)
          .map((e) => ({ ticker: e.ticker as string, aum_cr: e.aum_cr as number }));
        if (snapshots.length) {
          const { error } = await supabaseAdmin
            .from("etf_aum_snapshots")
            .upsert(snapshots, { onConflict: "ticker,snapshot_date" });
          if (error) console.error("[sync-etfs] snapshot error:", error.message);
        }

        return Response.json({ ok: true, attempted: tickers.length, updated, ms: Date.now() - started });
      },
    },
  },
});
