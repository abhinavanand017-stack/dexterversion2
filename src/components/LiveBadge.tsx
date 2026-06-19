import { useEffect, useState } from "react";
import { Info } from "lucide-react";

interface Props {
  status: "live" | "delayed" | "stale" | "loading";
  fetchedAt?: number | null;
  source?: string;
  compact?: boolean;
}

function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

/**
 * Three-state live data indicator. Live (<60s) · Delayed (1-15m) · Stale (>15m or unavailable).
 * Reused across header ticker, screener, indices, funds, portfolio, forecaster.
 */
export function LiveBadge({ status, fetchedAt, source, compact }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let effective = status;
  const age = fetchedAt ? now - fetchedAt : null;
  if (status === "live" && age !== null && age > 60_000) effective = "delayed";
  if (effective === "delayed" && age !== null && age > 15 * 60_000) effective = "stale";

  const cfg = {
    loading: { dot: "bg-muted-foreground animate-pulse", text: "text-muted-foreground", label: "Connecting…" },
    live: { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]", text: "text-emerald-400", label: "Live" },
    delayed: { dot: "bg-amber-400", text: "text-amber-400", label: age ? `Delayed ${fmtAge(age)}` : "Delayed" },
    stale: { dot: "bg-rose-400", text: "text-rose-400", label: "Stale" },
  }[effective];

  const tip = source
    ? `Source: ${source}${fetchedAt ? ` · Updated ${fmtAge(age ?? 0)} ago` : ""}`
    : fetchedAt
      ? `Updated ${fmtAge(age ?? 0)} ago`
      : "Awaiting first fetch";

  return (
    <span
      title={tip}
      className={`inline-flex items-center gap-1.5 font-mono ${compact ? "text-[10px]" : "text-xs"} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {!compact && <Info className="h-3 w-3 opacity-50" />}
    </span>
  );
}
