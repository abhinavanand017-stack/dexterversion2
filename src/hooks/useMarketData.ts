import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getYahooQuotes, type YahooQuote } from "@/lib/yahoo.functions";
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
  isLive: boolean;
}

export function useMarketData(pollMs = 30_000): MarketData {
  const [data, setData] = useState<MarketData>({ ...SEED, lastUpdated: null, isLive: false });
  const fetchYahoo = useServerFn(getYahooQuotes);
  const setHealth = useDexterState((s) => s.setDataHealth);
  const market = useMarketStatus();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      // Pause polling when market closed; keep last values.
      if (market.status === "closed") {
        timer = setTimeout(tick, pollMs * 4);
        return;
      }
      try {
        const res = await fetchYahoo();
        if (cancelled) return;
        if (res.ok && res.quotes.length === 3) {
          const map = Object.fromEntries(res.quotes.map((q) => [q.symbol, q])) as Record<string, YahooQuote>;
          setData({
            nifty: map.nifty ?? SEED.nifty,
            sensex: map.sensex ?? SEED.sensex,
            vix: map.vix ?? SEED.vix,
            lastUpdated: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }),
            isLive: true,
          });
          setHealth("live");
        } else {
          setHealth("degraded");
        }
      } catch {
        if (!cancelled) setHealth("degraded");
      } finally {
        if (!cancelled) timer = setTimeout(tick, pollMs);
      }
    };

    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [fetchYahoo, pollMs, market.status, setHealth]);

  return data;
}
