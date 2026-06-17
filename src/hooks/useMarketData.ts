import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getYahooQuotes, type YahooQuote, type QuoteSource } from "@/lib/yahoo.functions";
import { useDexterState } from "./useDexterState";
import { useMarketStatus } from "./useMarketStatus";

const SEED: Record<string, YahooQuote> = {
  nifty:  { symbol: "nifty",  price: 24832, prev: 24688.8, change: 143.2, pct: 0.58 },
  sensex: { symbol: "sensex", price: 81920, prev: 81507.2, change: 412.8, pct: 0.51 },
  vix:    { symbol: "vix",    price: 14.2,  prev: 14.5,    change: -0.3,  pct: -2.1 },
};

export interface MarketData {
  nifty: YahooQuote;
  sensex: YahooQuote;
  vix: YahooQuote;
  lastUpdated: string | null;
  lastUpdatedMs: number | null;
  isLive: boolean;
  source: QuoteSource | "init";
  failed: boolean;
  retry: () => void;
}

export function useMarketData(pollMs = 15_000): MarketData {
  const [data, setData] = useState<Omit<MarketData, "retry">>({
    nifty: SEED.nifty, sensex: SEED.sensex, vix: SEED.vix,
    lastUpdated: null, lastUpdatedMs: null, isLive: false, source: "init", failed: false,
  });
  const fetchYahoo = useServerFn(getYahooQuotes);
  const setHealth = useDexterState((s) => s.setDataHealth);
  const market = useMarketStatus();
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetchYahoo();
        if (cancelled) return;
        const map = Object.fromEntries(res.quotes.map((q) => [q.symbol, q])) as Record<string, YahooQuote>;
        const now = Date.now();
        const isLive = res.source === "yahoo" || res.source === "marketstack" || res.source === "twelvedata";
        setData({
          nifty: map.nifty ?? SEED.nifty,
          sensex: map.sensex ?? SEED.sensex,
          vix: map.vix ?? SEED.vix,
          lastUpdated: new Date(now).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }),
          lastUpdatedMs: now,
          isLive,
          source: res.source,
          failed: res.source === "seed",
        });
        setHealth(isLive ? "live" : "degraded");
      } catch {
        if (!cancelled) {
          setHealth("degraded");
          setData((d) => ({ ...d, failed: !d.lastUpdatedMs, source: d.lastUpdatedMs ? "cached" : "seed" }));
        }
      } finally {
        if (!cancelled) {
          const next = market.status === "closed" ? pollMs * 4 : pollMs;
          timer = setTimeout(tick, next);
        }
      }
    };

    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [fetchYahoo, pollMs, market.status, setHealth, nonce]);

  return { ...data, retry };
}
