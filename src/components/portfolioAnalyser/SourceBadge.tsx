import type { DataSource } from "@/lib/portfolioAnalyser/types";

/** Live / Reference provenance chip — mirrors Dexter's existing source: "live" | "demo" convention. */
export function SourceBadge({ source, title }: { source: DataSource; title?: string }) {
  const live = source === "live";
  return (
    <span
      title={title ?? (live ? "Fetched from live market data this session" : "User-supplied or fallback value — not fetched live")}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
        live
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`} />
      {live ? "Live" : "Reference"}
    </span>
  );
}
