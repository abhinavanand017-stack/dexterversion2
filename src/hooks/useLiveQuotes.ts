import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuotes, type LiveQuote } from "@/lib/quotes.functions";
import { useMarketStatus } from "@/hooks/useMarketStatus";

const REFRESH_OPEN_MS = 30_000;
const REFRESH_CLOSED_MS = 300_000;

export interface UseLiveQuotesResult {
  quotes: Record<string, LiveQuote>;
  status: "live" | "delayed" | "stale" | "loading";
  fetchedAt: number | null;
  failedSymbols: string[];
  refresh: () => void;
}

/**
 * Polls the server-side get-quotes proxy for a list of symbols.
 * 30s during market hours, 5min after close. Keeps last good quotes on failure.
 */
export function useLiveQuotes(symbols: string[]): UseLiveQuotesResult {
  const fetchQuotes = useServerFn(getQuotes);
  const market = useMarketStatus();
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [status, setStatus] = useState<UseLiveQuotesResult["status"]>("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const key = symbols.slice().sort().join(",");
  const tick = useRef(0);

  useEffect(() => {
    if (!symbols.length) { setStatus("stale"); return; }
    let active = true;
    const interval = market.status === "open" ? REFRESH_OPEN_MS : REFRESH_CLOSED_MS;

    const run = async () => {
      try {
        const res = await fetchQuotes({ data: { symbols } });
        if (!active) return;
        setQuotes((prev) => ({ ...prev, ...res.quotes }));
        setStatus(res.status);
        setFetchedAt(res.fetchedAt);
        setFailed(res.failedSymbols);
      } catch (e) {
        if (!active) return;
        // keep last quotes; just downgrade status
        setStatus((s) => (s === "loading" ? "stale" : s === "live" ? "delayed" : s));
        console.warn("[useLiveQuotes] fetch failed:", (e as Error).message);
      }
    };

    run();
    const id = setInterval(run, interval);
    return () => { active = false; clearInterval(id); tick.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, market.status]);

  const refresh = () => { tick.current++; };
  return { quotes, status, fetchedAt, failedSymbols: failed, refresh };
}
