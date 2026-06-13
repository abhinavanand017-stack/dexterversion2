import { DataStatus } from "./DataStatus";

export function Footer() {
  return (
    <footer
      className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-4 px-4 border-t border-border bg-background/85 backdrop-blur"
      style={{ height: 36 }}
    >
      <div className="flex min-w-0 items-center gap-3 truncate">
        <DataStatus />
      </div>
      <div className="hidden md:block text-xs text-muted-foreground font-mono truncate">
        Built for Indian Markets · NSE/BSE
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground font-mono">
        <span className="hidden sm:inline">Dexter © 2026</span>
        <span className="dx-pill" style={{ padding: "2px 8px" }}>v1.0 Beta</span>
      </div>
    </footer>
  );
}
