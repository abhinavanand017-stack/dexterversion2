import { createServerFn } from "@tanstack/react-start";

export interface HeatmapIndex {
  indexName: string;
  last: number;
  variation: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  advances?: number;
  declines?: number;
  unchanged?: number;
}

export type HeatmapCategory = "broad" | "sectoral" | "thematic" | "strategy";

const CATEGORY_INDICES: Record<HeatmapCategory, string[]> = {
  broad: [
    "NIFTY 50","NIFTY NEXT 50","NIFTY 100","NIFTY 200","NIFTY 500",
    "NIFTY MIDCAP 50","NIFTY MIDCAP 100","NIFTY MIDCAP 150",
    "NIFTY SMALLCAP 50","NIFTY SMALLCAP 100","NIFTY SMALLCAP 250",
    "NIFTY MICROCAP 250","NIFTY LARGEMIDCAP 250","NIFTY MIDSMALLCAP 400",
    "NIFTY TOTAL MARKET","INDIA VIX",
  ],
  sectoral: [
    "NIFTY AUTO","NIFTY BANK","NIFTY FINANCIAL SERVICES",
    "NIFTY FINANCIAL SERVICES 25/50","NIFTY FINANCIAL SERVICES EX-BANK",
    "NIFTY FMCG","NIFTY HEALTHCARE INDEX","NIFTY IT","NIFTY MEDIA",
    "NIFTY METAL","NIFTY OIL & GAS","NIFTY PHARMA","NIFTY PRIVATE BANK",
    "NIFTY PSU BANK","NIFTY REALTY","NIFTY CONSUMER DURABLES",
    "NIFTY INDIA DEFENCE",
  ],
  thematic: [
    "NIFTY COMMODITIES","NIFTY INDIA CONSUMPTION","NIFTY CPSE","NIFTY ENERGY",
    "NIFTY INFRASTRUCTURE","NIFTY MNC","NIFTY PSE","NIFTY SERVICES SECTOR",
    "NIFTY100 LIQUID 15","NIFTY INDIA DIGITAL","NIFTY INDIA MANUFACTURING",
    "NIFTY INDIA RAILWAYS & TRANSPORT","NIFTY NON-CYCLICAL CONSUMER",
    "NIFTY MOBILITY","NIFTY RURAL","NIFTY TOURISM INDIA",
  ],
  strategy: [
    "NIFTY DIVIDEND OPPORTUNITIES 50","NIFTY GROWTH SECTORS 15",
    "NIFTY100 QUALITY 30","NIFTY50 VALUE 20","NIFTY50 EQUAL WEIGHT",
    "NIFTY100 EQUAL WEIGHT","NIFTY100 LOW VOLATILITY 30","NIFTY ALPHA 50",
    "NIFTY200 QUALITY 30","NIFTY ALPHA LOW-VOLATILITY 30",
    "NIFTY200 MOMENTUM 30","NIFTY MIDCAP150 QUALITY 50",
    "NIFTY500 MULTICAP 50:25:25","NIFTY MIDCAP SELECT",
  ],
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/market-data/live-market-indices/heatmap",
  Connection: "keep-alive",
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let nseCookie: { value: string; ts: number } | null = null;
async function getNseCookie(): Promise<string> {
  if (nseCookie && Date.now() - nseCookie.ts < 5 * 60 * 1000) return nseCookie.value;
  const r = await withTimeout(fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS }), 6000);
  const sc = r.headers.get("set-cookie") || "";
  const cookies = sc.split(/,(?=[^;]+?=)/).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  nseCookie = { value: cookies, ts: Date.now() };
  return cookies;
}

type NseRow = {
  index: string; indexSymbol?: string; last: number; variation: number; percentChange: number;
  open: number; high: number; low: number; previousClose: number;
  advances?: string | number; declines?: string | number; unchanged?: string | number;
};

const cache: Record<string, { ts: number; rows: HeatmapIndex[] }> = {};
const CACHE_TTL = 15_000;

async function fetchAll(): Promise<NseRow[]> {
  const cookie = await getNseCookie();
  const res = await withTimeout(fetch("https://www.nseindia.com/api/allIndices", {
    headers: { ...BROWSER_HEADERS, Cookie: cookie },
  }), 7000);
  if (!res.ok) throw new Error(`NSE HTTP ${res.status}`);
  const json = await res.json() as { data?: NseRow[] };
  return json.data || [];
}

export const getNseHeatmap = createServerFn({ method: "GET" })
  .inputValidator((input: { category?: string }) => ({
    category: (["broad", "sectoral", "thematic", "strategy"].includes(input.category || "")
      ? input.category
      : "broad") as HeatmapCategory,
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; category: HeatmapCategory; rows: HeatmapIndex[]; ts: number; error?: string }> => {
    const now = Date.now();
    const c = cache[data.category];
    if (c && now - c.ts < CACHE_TTL) {
      return { ok: true, category: data.category, rows: c.rows, ts: c.ts };
    }
    try {
      const all = await fetchAll();
      const wanted = new Set(CATEGORY_INDICES[data.category].map((s) => s.toUpperCase()));
      const byName: Record<string, NseRow> = {};
      for (const r of all) byName[(r.index || "").toUpperCase()] = r;
      const rows: HeatmapIndex[] = [];
      for (const name of CATEGORY_INDICES[data.category]) {
        const r = byName[name.toUpperCase()];
        if (!r) continue;
        rows.push({
          indexName: r.index,
          last: Number(r.last) || 0,
          variation: Number(r.variation) || 0,
          percentChange: Number(r.percentChange) || 0,
          open: Number(r.open) || 0,
          high: Number(r.high) || 0,
          low: Number(r.low) || 0,
          previousClose: Number(r.previousClose) || 0,
          advances: r.advances != null ? Number(r.advances) : undefined,
          declines: r.declines != null ? Number(r.declines) : undefined,
          unchanged: r.unchanged != null ? Number(r.unchanged) : undefined,
        });
      }
      void wanted;
      cache[data.category] = { ts: now, rows };
      return { ok: true, category: data.category, rows, ts: now };
    } catch (e) {
      if (c) return { ok: true, category: data.category, rows: c.rows, ts: c.ts };
      return { ok: false, category: data.category, rows: [], ts: now, error: e instanceof Error ? e.message : "fetch failed" };
    }
  });
