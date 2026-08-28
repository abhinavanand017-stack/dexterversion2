// Scheduled ingestion for the 1,000-name screener universe.
//
//   POST /api/public/data-refresh-eod   { "stage": "universe" }
//   POST /api/public/data-refresh-eod   { "stage": "prices", "limit": 250 }
//
// stage=universe : official NSE index constituent files (Nifty Total Market 750
//                  + Nifty Microcap 250 = 1,000 names) -> public.stock_universe
// stage=prices   : Yahoo daily OHLCV history -> public.stock_prices_eod and
//                  derived public.stock_technicals. Processes the staleset
//                  first so repeated cron hits rotate through the whole list.
//
// Nothing in here invents a value. Fields we cannot source (free float %,
// delivery %, market cap) are written as NULL and render as "Data pending".
import { createFileRoute } from "@tanstack/react-router";
import { mapNseIndustry } from "@/lib/screener/sectors";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const CONSTITUENT_FILES: { url: string; membership: string }[] = [
  {
    url: "https://nsearchives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv",
    membership: "NIFTY TOTAL MARKET",
  },
  {
    url: "https://nsearchives.nseindia.com/content/indices/ind_niftymicrocap250_list.csv",
    membership: "NIFTY MICROCAP 250",
  },
  {
    url: "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv",
    membership: "NIFTY 500",
  },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\n") { row.push(field.trim()); rows.push(row); row = []; field = ""; continue; }
    if (ch === "\r") continue;
    field += ch;
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

interface UniverseRow {
  ticker: string;
  exchange: string;
  isin: string | null;
  company_name: string;
  nse_industry: string | null;
  sector: string | null;
  index_membership: string[];
  source_tier: number;
  as_of: string;
}

async function ingestUniverse() {
  const byTicker = new Map<string, UniverseRow>();
  const asOf = new Date().toISOString();
  const fileStatus: Record<string, string> = {};

  for (const f of CONSTITUENT_FILES) {
    try {
      const res = await fetch(f.url, {
        headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { fileStatus[f.membership] = `HTTP ${res.status}`; continue; }
      const rows = parseCsv(await res.text());
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const ci = {
        name: header.indexOf("company name"),
        industry: header.indexOf("industry"),
        symbol: header.indexOf("symbol"),
        isin: header.indexOf("isin code"),
      };
      let n = 0;
      for (const r of rows.slice(1)) {
        const ticker = (r[ci.symbol] ?? "").trim().toUpperCase();
        if (!ticker) continue;
        const existing = byTicker.get(ticker);
        if (existing) {
          if (!existing.index_membership.includes(f.membership)) existing.index_membership.push(f.membership);
          continue;
        }
        const industry = (r[ci.industry] ?? "").trim() || null;
        byTicker.set(ticker, {
          ticker,
          exchange: "NSE",
          isin: (r[ci.isin] ?? "").trim() || null,
          company_name: (r[ci.name] ?? "").trim() || ticker,
          nse_industry: industry,
          sector: mapNseIndustry(industry),
          index_membership: [f.membership],
          source_tier: 1,
          as_of: asOf,
        });
        n++;
      }
      fileStatus[f.membership] = `ok (${n} new)`;
    } catch (e) {
      fileStatus[f.membership] = (e as Error).message;
    }
  }

  const rows = [...byTicker.values()];
  if (!rows.length) return { ok: false, fileStatus, upserted: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { error } = await supabaseAdmin.from("stock_universe").upsert(chunk, { onConflict: "ticker" });
    if (error) return { ok: false, fileStatus, upserted, error: error.message };
    upserted += chunk.length;
  }
  return { ok: true, fileStatus, upserted, universeSize: rows.length };
}

interface Bar { t: number; o: number | null; h: number | null; l: number | null; c: number | null; v: number | null }

async function fetchDaily(symbol: string): Promise<Bar[] | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<Record<string, (number | null)[]>> } }> };
    };
    const r = j.chart?.result?.[0];
    const ts = r?.timestamp;
    const q = r?.indicators?.quote?.[0];
    if (!ts?.length || !q) return null;
    const bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = q.close?.[i] ?? null;
      if (c == null) continue;
      bars.push({ t: ts[i], o: q.open?.[i] ?? null, h: q.high?.[i] ?? null, l: q.low?.[i] ?? null, c, v: q.volume?.[i] ?? null });
    }
    return bars.length ? bars : null;
  } catch {
    return null;
  }
}

function sma(vals: number[], n: number): number | null {
  if (vals.length < n) return null;
  const s = vals.slice(-n).reduce((a, b) => a + b, 0);
  return +(s / n).toFixed(4);
}

function rsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = (gain / 14) / (loss / 14);
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function pctChangeBack(closes: number[], back: number): number | null {
  if (closes.length <= back) return null;
  const past = closes[closes.length - 1 - back];
  const last = closes[closes.length - 1];
  if (!past) return null;
  return +(((last - past) / past) * 100).toFixed(2);
}

function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

function beta(stock: number[], index: number[]): number | null {
  const n = Math.min(stock.length, index.length);
  if (n < 60) return null;
  const s = stock.slice(-n), m = index.slice(-n);
  const ms = s.reduce((a, b) => a + b, 0) / n;
  const mm = m.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varm = 0;
  for (let i = 0; i < n; i++) { cov += (s[i] - ms) * (m[i] - mm); varm += (m[i] - mm) ** 2; }
  if (!varm) return null;
  return +(cov / varm).toFixed(3);
}

async function ingestPrices(limit: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: targets, error: selErr } = await supabaseAdmin
    .from("stock_screener_rows")
    .select("ticker, technicals_as_of")
    .order("technicals_as_of", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (selErr) return { ok: false, error: selErr.message };
  const tickers = (targets ?? []).map((t) => t.ticker as string);
  if (!tickers.length) return { ok: false, error: "universe empty — run stage=universe first" };

  const idxBars = await fetchDaily("^NSEI");
  const idxRets = idxBars ? logReturns(idxBars.map((b) => b.c as number)) : [];

  const priceRows: Record<string, unknown>[] = [];
  const techRows: Record<string, unknown>[] = [];
  const failed: string[] = [];
  const asOf = new Date().toISOString();

  for (let i = 0; i < tickers.length; i += 10) {
    const chunk = tickers.slice(i, i + 10);
    const bundles = await Promise.all(chunk.map(async (t) => ({ t, bars: await fetchDaily(`${t}.NS`) })));
    for (const { t, bars } of bundles) {
      if (!bars) { failed.push(t); continue; }
      const closes = bars.map((b) => b.c as number);
      const last = bars[bars.length - 1];
      const date = new Date(last.t * 1000).toISOString().slice(0, 10);
      const highs = bars.map((b) => b.h ?? b.c ?? 0);
      const lows = bars.map((b) => b.l ?? b.c ?? 0).filter((x) => x > 0);
      const w52High = highs.length ? +Math.max(...highs).toFixed(2) : null;
      const w52Low = lows.length ? +Math.min(...lows).toFixed(2) : null;
      const vols = bars.map((b) => b.v ?? 0);
      const avg20 = vols.length >= 20 ? vols.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;

      priceRows.push({
        ticker: t, date,
        open: last.o, high: last.h, low: last.l, close: last.c,
        volume: last.v == null ? null : Math.round(last.v),
        delivery_pct: null, // NSE delivery data is not available from this source
        w52_high: w52High, w52_low: w52Low,
        source_tier: 1, as_of: asOf,
      });

      const close = last.c as number;
      techRows.push({
        ticker: t, date,
        rsi14: rsi14(closes),
        dma50: sma(closes, 50),
        dma200: sma(closes, 200),
        beta: idxRets.length ? beta(logReturns(closes), idxRets) : null,
        volume_vs_20d_avg: avg20 && last.v ? +(last.v / avg20).toFixed(3) : null,
        pct_from_52w_high: w52High ? +(((close - w52High) / w52High) * 100).toFixed(2) : null,
        pct_from_52w_low: w52Low ? +(((close - w52Low) / w52Low) * 100).toFixed(2) : null,
        ret_1m_pct: pctChangeBack(closes, 21),
        ret_3m_pct: pctChangeBack(closes, 63),
        ret_1y_pct: pctChangeBack(closes, closes.length - 1),
        source_tier: 1, as_of: asOf,
      });
    }
  }

  for (let i = 0; i < priceRows.length; i += 400) {
    const { error } = await supabaseAdmin
      .from("stock_prices_eod")
      .upsert(priceRows.slice(i, i + 400) as never, { onConflict: "ticker,date" });
    if (error) return { ok: false, error: error.message, stage: "prices-upsert" };
  }
  for (let i = 0; i < techRows.length; i += 400) {
    const { error } = await supabaseAdmin
      .from("stock_technicals")
      .upsert(techRows.slice(i, i + 400) as never, { onConflict: "ticker,date" });
    if (error) return { ok: false, error: error.message, stage: "technicals-upsert" };
  }

  return { ok: true, attempted: tickers.length, priced: priceRows.length, failed: failed.length, failedSample: failed.slice(0, 10) };
}

export const Route = createFileRoute("/api/public/data-refresh-eod")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SYNC_QUOTES_SECRET;
        const provided = request.headers.get("x-sync-secret");
        if (!secret || provided !== secret) return new Response("Unauthorized", { status: 401 });

        let body: { stage?: string; limit?: number } = {};
        try { body = (await request.json()) as typeof body; } catch { /* default */ }
        const started = Date.now();

        if (body.stage === "universe") {
          const r = await ingestUniverse();
          return Response.json({ ...r, ms: Date.now() - started });
        }
        const limit = Math.min(Math.max(body.limit ?? 200, 1), 400);
        const r = await ingestPrices(limit);
        return Response.json({ ...r, ms: Date.now() - started });
      },
    },
  },
});
