import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAngelQuotes, type TickerQuote } from "@/lib/market.functions";

const SEED: TickerQuote[] = [
  { symbol: "NIFTY 50", exchange: "NSE", ltp: 23366.7, change: -49.2, percentChange: -0.21, ts: 0 },
  { symbol: "SENSEX", exchange: "BSE", ltp: 74243.34, change: -119.5, percentChange: -0.16, ts: 0 },
];

export type FeedSource = "angel" | "finnhub" | "offline" | "connecting";

interface LiveTickerState {
  quotes: TickerQuote[];
  source: FeedSource;
  lastUpdate: number;
  error?: string;
}

/**
 * Polls Angel One every 15s (server fn). On consecutive failures, degrades to
 * "offline" — the previous Finnhub WebSocket fallback was removed because it
 * required shipping the API key to the browser. A server-side proxy is needed
 * to restore live Finnhub data.
 */
export function useLiveTicker(intervalMs = 15_000) {
  const [state, setState] = useState<LiveTickerState>({
    quotes: SEED,
    source: "connecting",
    lastUpdate: 0,
  });
  const angelFailures = useRef(0);
  const fetchAngel = useServerFn(getAngelQuotes);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetchAngel();
        if (cancelled) return;
        if (res.ok && res.quotes.length) {
          angelFailures.current = 0;
          setState({ quotes: res.quotes, source: "angel", lastUpdate: Date.now() });
        } else {
          angelFailures.current += 1;
          setState((s) => ({
            ...s,
            source: angelFailures.current >= 2 ? "offline" : s.source,
            error: res.error,
          }));
        }
      } catch (err) {
        if (cancelled) return;
        angelFailures.current += 1;
        setState((s) => ({
          ...s,
          source: angelFailures.current >= 2 ? "offline" : s.source,
          error: err instanceof Error ? err.message : "fetch failed",
        }));
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, fetchAngel]);

  return state;
}
