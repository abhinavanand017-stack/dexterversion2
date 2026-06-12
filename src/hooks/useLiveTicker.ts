import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAngelQuotes, getFinnhubToken, type TickerQuote } from "@/lib/market.functions";

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

const FINNHUB_SYMBOLS: Record<string, string> = {
  "NSE:NIFTY50": "NIFTY 50",
  "BSE:SENSEX": "SENSEX",
};

/**
 * Polls Angel One every 15s (server fn). On two consecutive Angel failures,
 * falls back to Finnhub WebSocket. Seeded data is shown until first success.
 */
export function useLiveTicker(intervalMs = 15_000) {
  const [state, setState] = useState<LiveTickerState>({
    quotes: SEED,
    source: "connecting",
    lastUpdate: 0,
  });
  const angelFailures = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const fetchAngel = useServerFn(getAngelQuotes);
  const fetchFinnhubToken = useServerFn(getFinnhubToken);

  // Angel polling loop
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetchAngel();
        if (cancelled) return;
        if (res.ok && res.quotes.length) {
          angelFailures.current = 0;
          // close fallback WS if open — Angel is healthy again
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          setState({ quotes: res.quotes, source: "angel", lastUpdate: Date.now() });
        } else {
          angelFailures.current += 1;
          setState((s) => ({ ...s, error: res.error }));
          if (angelFailures.current >= 2) await startFinnhub();
        }
      } catch (err) {
        if (cancelled) return;
        angelFailures.current += 1;
        if (angelFailures.current >= 2) await startFinnhub();
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    const startFinnhub = async () => {
      if (wsRef.current) return; // already open
      try {
        const { token } = await fetchFinnhubToken();
        if (!token) {
          setState((s) => ({ ...s, source: "offline" }));
          return;
        }
        const ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);
        wsRef.current = ws;
        ws.onopen = () => {
          Object.keys(FINNHUB_SYMBOLS).forEach((symbol) =>
            ws.send(JSON.stringify({ type: "subscribe", symbol })),
          );
          setState((s) => ({ ...s, source: "finnhub" }));
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type !== "trade" || !data.data?.length) return;
            const t = data.data[0];
            const display = FINNHUB_SYMBOLS[t.s] ?? t.s;
            setState((s) => {
              const prev = s.quotes.find((q) => q.symbol === display);
              const ref = prev?.ltp ?? t.p;
              const change = t.p - ref;
              const percentChange = ref ? (change / ref) * 100 : 0;
              const next = s.quotes.filter((q) => q.symbol !== display);
              next.push({
                symbol: display,
                exchange: t.s.startsWith("BSE") ? "BSE" : "NSE",
                ltp: t.p,
                change,
                percentChange,
                ts: t.t ?? Date.now(),
              });
              return { ...s, quotes: next, lastUpdate: Date.now() };
            });
          } catch {
            /* ignore parse errors */
          }
        };
        ws.onerror = () => setState((s) => ({ ...s, source: "offline" }));
        ws.onclose = () => {
          wsRef.current = null;
        };
      } catch {
        setState((s) => ({ ...s, source: "offline" }));
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [intervalMs, fetchAngel, fetchFinnhubToken]);

  return state;
}
