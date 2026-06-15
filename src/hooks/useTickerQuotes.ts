import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMarketstackTicker, type MSQuote } from "@/lib/marketstack.functions";

export function useTickerQuotes(pollMs = 60_000) {
  const fetchFn = useServerFn(getMarketstackTicker);
  const [quotes, setQuotes] = useState<MSQuote[]>([]);
  const [cached, setCached] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const res = await fetchFn();
        if (cancelled) return;
        setQuotes(res.quotes);
        setCached(res.cached);
      } catch {
        /* keep previous */
      } finally {
        if (!cancelled) timer = setTimeout(tick, pollMs);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchFn, pollMs]);

  return { quotes, cached };
}
