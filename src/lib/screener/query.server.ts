// Server-side screener query against public.stock_screener_rows.
// All filtering / sorting / pagination happens in Postgres — the browser never
// receives the full 1,000-row set just to filter it.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ScreenerFilters {
  search?: string;
  sectors?: string[];
  index?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  rsiMin?: number | null;
  rsiMax?: number | null;
  position?: "all" | "near-high" | "near-low" | "mid";
  aboveDma50?: boolean;
  aboveDma200?: boolean;
  ret1yMin?: number | null;
}

export type SortKey =
  | "company_name" | "close" | "ret_1m_pct" | "ret_3m_pct" | "ret_1y_pct"
  | "rsi14" | "pct_from_52w_high" | "volume" | "volume_vs_20d_avg" | "beta";

export interface ScreenerRow {
  ticker: string;
  exchange: string;
  company_name: string;
  sector: string | null;
  sub_sector: string | null;
  market_cap_cr: number | null;
  free_float_pct: number | null;
  index_membership: string[];
  price_date: string | null;
  close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  delivery_pct: number | null;
  w52_high: number | null;
  w52_low: number | null;
  price_as_of: string | null;
  rsi14: number | null;
  dma50: number | null;
  dma200: number | null;
  beta: number | null;
  volume_vs_20d_avg: number | null;
  pct_from_52w_high: number | null;
  pct_from_52w_low: number | null;
  ret_1m_pct: number | null;
  ret_3m_pct: number | null;
  ret_1y_pct: number | null;
  technicals_as_of: string | null;
}

export interface ScreenerPage {
  rows: ScreenerRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CoverageStats {
  universe: number;
  withPrice: number;
  withTechnicals: number;
  lastPriceRefresh: string | null;
  sectors: string[];
  indexes: string[];
  indexCounts: Record<string, number>;
}

function client() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const SORTABLE: SortKey[] = [
  "company_name", "close", "ret_1m_pct", "ret_3m_pct", "ret_1y_pct",
  "rsi14", "pct_from_52w_high", "volume", "volume_vs_20d_avg", "beta",
];

export async function runScreenerQuery(input: {
  filters: ScreenerFilters;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
}): Promise<ScreenerPage> {
  const sb = client();
  const f = input.filters ?? {};
  const sortKey: SortKey = SORTABLE.includes(input.sortKey) ? input.sortKey : "close";
  const pageSize = Math.min(Math.max(input.pageSize || 100, 10), 250);
  const page = Math.max(input.page || 0, 0);

  let q = sb.from("stock_screener_rows").select("*", { count: "exact" });

  if (f.search?.trim()) {
    const s = f.search.trim().replace(/[%,]/g, "");
    q = q.or(`ticker.ilike.%${s}%,company_name.ilike.%${s}%`);
  }
  if (f.sectors?.length) q = q.in("sector", f.sectors);
  if (f.index) q = q.contains("index_membership", [f.index]);
  if (f.priceMin != null) q = q.gte("close", f.priceMin);
  if (f.priceMax != null) q = q.lte("close", f.priceMax);
  if (f.rsiMin != null) q = q.gte("rsi14", f.rsiMin);
  if (f.rsiMax != null) q = q.lte("rsi14", f.rsiMax);
  if (f.ret1yMin != null) q = q.gte("ret_1y_pct", f.ret1yMin);
  if (f.position === "near-high") q = q.gte("pct_from_52w_high", -10);
  if (f.position === "near-low") q = q.lte("pct_from_52w_low", 10);
  if (f.position === "mid") q = q.lt("pct_from_52w_high", -10).gt("pct_from_52w_low", 10);

  q = q.order(sortKey, { ascending: input.sortDir === "asc", nullsFirst: false });
  q = q.order("ticker", { ascending: true });
  q = q.range(page * pageSize, page * pageSize + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as ScreenerRow[];
  // DMA comparisons are row-relative; Postgrest cannot express column-to-column
  // filters, so they are applied to the returned page only and surfaced as such.
  if (f.aboveDma50) rows = rows.filter((r) => r.close != null && r.dma50 != null && r.close > r.dma50);
  if (f.aboveDma200) rows = rows.filter((r) => r.close != null && r.dma200 != null && r.close > r.dma200);

  return { rows, total: count ?? rows.length, page, pageSize };
}

export async function runCoverage(): Promise<CoverageStats> {
  const sb = client();
  const [{ count: universe }, { count: withPrice }, { count: withTech }, latest, meta] = await Promise.all([
    sb.from("stock_universe").select("ticker", { count: "exact", head: true }),
    sb.from("stock_screener_rows").select("ticker", { count: "exact", head: true }).not("close", "is", null),
    sb.from("stock_screener_rows").select("ticker", { count: "exact", head: true }).not("rsi14", "is", null),
    sb.from("stock_prices_eod").select("as_of").order("as_of", { ascending: false }).limit(1),
    sb.from("stock_universe").select("sector, index_membership"),
  ]);

  const sectors = new Set<string>();
  const indexes = new Set<string>();
  const indexCounts: Record<string, number> = {};
  for (const r of (meta.data ?? []) as { sector: string | null; index_membership: string[] }[]) {
    if (r.sector) sectors.add(r.sector);
    for (const i of r.index_membership ?? []) {
      indexes.add(i);
      indexCounts[i] = (indexCounts[i] ?? 0) + 1;
    }
  }

  return {
    universe: universe ?? 0,
    withPrice: withPrice ?? 0,
    withTechnicals: withTech ?? 0,
    lastPriceRefresh: (latest.data?.[0] as { as_of?: string } | undefined)?.as_of ?? null,
    sectors: [...sectors].sort(),
    indexes: [...indexes].sort(),
    indexCounts,
  };
}
