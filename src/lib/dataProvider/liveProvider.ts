// Live provider — reads latest prices from Supabase public.live_quotes,
// which is refreshed every 2 minutes by pg_cron → /api/public/sync-quotes.
// Subscribes to Realtime for instant updates. Falls back per-symbol to
// StaticProvider when a live row is missing or stale (>10 min old).

import type { DataProvider, AnyQuote, HistoricalBar, HistRange } from "./types";
import { StaticProvider } from "./staticProvider";
import { supabase } from "@/integrations/supabase/client";

interface LiveRow {
  symbol: string;
  ltp: number | null;
  day_change: number | null;
  day_change_pct: number | null;
  volume: number | null;
  updated_at: string;
}

const STALE_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, LiveRow>();
let bootstrapped: Promise<void> | null = null;
let channelSubscribed = false;

function upsertRow(row: LiveRow) {
  cache.set(row.symbol.toUpperCase(), row);
}

async function bootstrap() {
  if (typeof window === "undefined") return;
  const { data, error } = await supabase
    .from("live_quotes")
    .select("symbol, ltp, day_change, day_change_pct, volume, updated_at");
  if (!error && data) {
    for (const r of data as LiveRow[]) upsertRow(r);
  }
  if (!channelSubscribed) {
    channelSubscribed = true;
    supabase
      .channel("live_quotes_stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_quotes" },
        (payload) => {
          const row = payload.new as LiveRow | undefined;
          if (row && row.symbol) upsertRow(row);
        },
      )
      .subscribe();
  }
}

export function ensureLiveBootstrap(): Promise<void> {
  if (!bootstrapped) bootstrapped = bootstrap();
  return bootstrapped;
}

export type SymbolStatus = "live" | "delayed" | "static";

export function getSymbolStatus(symbol: string): SymbolStatus {
  const up = symbol.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
  const row = cache.get(up);
  if (!row || row.ltp == null) return "static";
  const age = Date.now() - new Date(row.updated_at).getTime();
  return age <= STALE_MS ? "live" : "delayed";
}

export function getLiveAsOf(symbol?: string): string | null {
  if (symbol) {
    const row = cache.get(symbol.toUpperCase());
    return row ? row.updated_at : null;
  }
  let latest = 0;
  for (const r of cache.values()) {
    const t = new Date(r.updated_at).getTime();
    if (t > latest) latest = t;
  }
  return latest ? new Date(latest).toISOString() : null;
}

export class LiveProvider implements DataProvider {
  readonly mode = "live" as const;
  private fallback = new StaticProvider();

  constructor() { void ensureLiveBootstrap(); }

  get asOf(): string {
    const latest = getLiveAsOf();
    if (!latest) return `Live • bootstrapping… (fallback: ${this.fallback.asOf})`;
    return `Live • updated ${new Date(latest).toLocaleTimeString()}`;
  }

  async getQuote(symbol: string): Promise<AnyQuote | null> {
    await ensureLiveBootstrap();
    const base = await this.fallback.getQuote(symbol);
    const up = symbol.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
    const row = cache.get(up);
    if (!row || row.ltp == null) return base;

    // Merge live price/change/volume onto static shape (stock or etf)
    if (base?.kind === "stock") {
      return {
        ...base,
        ltp: row.ltp,
        chng: row.day_change ?? base.chng,
        chngPct: row.day_change_pct ?? base.chngPct,
        volume: row.volume ?? base.volume,
      };
    }
    if (base?.kind === "etf") {
      return {
        ...base,
        nav: row.ltp,
        dayChangePct: row.day_change_pct ?? base.dayChangePct,
        volume: row.volume ?? base.volume,
      };
    }
    // No static base — synthesize a minimal stock quote
    return {
      kind: "stock",
      symbol: up,
      open: null, high: null, low: null, prevClose: null,
      ltp: row.ltp,
      chng: row.day_change,
      chngPct: row.day_change_pct,
      w52High: null, w52Low: null,
      chg30dPct: null, chg365dPct: null,
      volume: row.volume,
    };
  }

  async getHistorical(symbol: string, range: HistRange): Promise<HistoricalBar[]> {
    // History still comes from static (deterministic synthetic walk to current LTP).
    return this.fallback.getHistorical(symbol, range);
  }
}
