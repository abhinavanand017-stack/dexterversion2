/** Live / Reference provenance chip — same convention as the rest of Dexter. */
export function SourceChip({ live, label, title }: { live: boolean; label?: string; title?: string }) {
  return (
    <span
      title={title ?? (live ? "Fetched this session from the live feed" : "Derived, approximated or fallback value — not a live fetch")}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
        live
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
      }`}
    >
      <span className={`h-1 w-1 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`} />
      {label ?? (live ? "Live" : "Reference")}
    </span>
  );
}
