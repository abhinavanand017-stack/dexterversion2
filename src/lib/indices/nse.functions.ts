import { createServerFn } from "@tanstack/react-start";

/**
 * Live valuation + breadth snapshot for an NSE index, from the same
 * nseindia.com /api/allIndices feed already used by the ticker and heatmap.
 */
export interface IndexSnapshot {
  indexName: string;
  last: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  variation: number;
  percentChange: number;
  yearHigh: number | null;
  yearLow: number | null;
  pe: number | null;
  pb: number | null;
  dy: number | null;
  advances: number | null;
  declines: number | null;
  unchanged: number | null;
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/market-data/live-market-indices",
  Connection: "keep-alive",
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let cookie: { value: string; ts: number } | null = null;
async function getCookie(): Promise<string> {
  if (cookie && Date.now() - cookie.ts < 5 * 60_000) return cookie.value;
  const r = await withTimeout(fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS }), 6000);
  const sc = r.headers.get("set-cookie") || "";
  const v = sc.split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  cookie = { value: v, ts: Date.now() };
  return v;
}

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
};

type Row = Record<string, unknown> & { index?: string };
const cache: { ts: number; rows: Row[] } | Record<string, never> = {} as never;
let allCache: { ts: number; rows: Row[] } | null = null;
const TTL = 20_000;
void cache;

export const getIndexSnapshot = createServerFn({ method: "GET" })
  .inputValidator((input: { nseName: string }) => ({ nseName: String(input.nseName || "").slice(0, 64) }))
  .handler(async ({ data }): Promise<{ ok: boolean; snapshot: IndexSnapshot | null; ts: number; error?: string }> => {
    const now = Date.now();
    try {
      if (!allCache || now - allCache.ts > TTL) {
        const c = await getCookie();
        const res = await withTimeout(fetch("https://www.nseindia.com/api/allIndices", {
          headers: { ...BROWSER_HEADERS, Cookie: c },
        }), 7000);
        if (!res.ok) throw new Error(`NSE HTTP ${res.status}`);
        const json = await res.json() as { data?: Row[] };
        allCache = { ts: now, rows: json.data || [] };
      }
      const want = data.nseName.toUpperCase();
      const r = allCache.rows.find((x) => String(x.index || "").toUpperCase() === want);
      if (!r) return { ok: false, snapshot: null, ts: now, error: "index not in NSE feed" };
      return {
        ok: true,
        ts: allCache.ts,
        snapshot: {
          indexName: String(r.index),
          last: n(r.last) ?? 0,
          open: n(r.open) ?? 0,
          high: n(r.high) ?? 0,
          low: n(r.low) ?? 0,
          previousClose: n(r.previousClose) ?? 0,
          variation: n(r.variation) ?? 0,
          percentChange: n(r.percentChange) ?? 0,
          yearHigh: n(r.yearHigh),
          yearLow: n(r.yearLow),
          pe: n(r.pe),
          pb: n(r.pb),
          dy: n(r.dy),
          advances: n(r.advances),
          declines: n(r.declines),
          unchanged: n(r.unchanged),
        },
      };
    } catch (e) {
      return { ok: false, snapshot: null, ts: now, error: e instanceof Error ? e.message : "NSE fetch failed" };
    }
  });
