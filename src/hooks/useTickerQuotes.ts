import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getIndicesTicker, type IndexQuote } from "@/lib/yahoo.functions";
import { useMarketStatus } from "./useMarketStatus";

export type TickerSource = "nse" | "yahoo" | "cached" | "init";

export function useTickerQuotes(pollMs = 15_000) {
  const fetchFn = useServerFn(getIndicesTicker);
  const market = useMarketStatus();
  const [quotes, setQuotes] = useState<IndexQuote[]>([]);
  const [source, setSource] = useState<TickerSource>("init");
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);
  const lastQuotes = useRef<IndexQuote[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const res = await fetchFn();
        if (cancelled) return;
        if (res.quotes.length) {
          setQuotes(res.quotes);
          lastQuotes.current = res.quotes;
          setSource(res.source);
          setLastUpdatedMs(res.ts);
        } else if (lastQuotes.current.length) {
          setSource("cached");
        }
      } catch {
        if (!cancelled && lastQuotes.current.length) setSource("cached");
      } finally {
        if (!cancelled) {
          // 15s during market hours, slower when closed
          const next = market.status === "open" ? pollMs : pollMs * 8;
          timer = setTimeout(tick, next);
        }
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [fetchFn, pollMs, market.status]);

  return { quotes, source, lastUpdatedMs, marketStatus: market.status };
}
