import { DataStatus } from "./DataStatus";
import { ThemeToggle } from "./ThemeToggle";

export function Footer() {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-4 px-4 border-t border-border bg-background/85 backdrop-blur" style={{ height: 36 }}>
      <div className="flex min-w-0 items-center gap-3 truncate">
        <DataStatus />
        <ThemeToggle />
      </div>
      <div className="hidden md:block text-xs text-muted-foreground font-mono truncate">
        Built for Indian Markets · NSE/BSE · Cmd+K to search
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground font-mono">
        <span className="hidden sm:inline">Dexter © 2026</span>
        <span className="dx-pill" style={{ padding: "2px 8px" }}>v1.0 Beta</span>
      </div>
    </footer>
  );
}

export function FooterDataSources() {
  // Long-form footer rendered inside the home page or settings page
  return (
    <div className="dx-glass p-4 rounded-xl text-xs space-y-3">
      <div>
        <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-2">Data Sources</div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[11px]">
          <li>• Stock Data: <a className="text-primary hover:underline" href="https://marketstack.com" target="_blank" rel="noreferrer">Marketstack API</a></li>
          <li>• MF NAV: <a className="text-primary hover:underline" href="https://api.mfapi.in" target="_blank" rel="noreferrer">MFapi.in</a></li>
          <li>• Fund Research: <a className="text-primary hover:underline" href="https://www.valueresearchonline.com/funds/fund-category/" target="_blank" rel="noreferrer">Value Research</a></li>
          <li>• Fund Ratings: <a className="text-primary hover:underline" href="https://www.morningstar.in/tools/default.aspx" target="_blank" rel="noreferrer">Morningstar India</a></li>
          <li>• Fund Explore: <a className="text-primary hover:underline" href="https://www.etmoney.com/mutual-funds/explore" target="_blank" rel="noreferrer">ET Money</a></li>
          <li>• Equity Research: <a className="text-primary hover:underline" href="https://www.screener.in" target="_blank" rel="noreferrer">Screener.in</a></li>
          <li>• Equity Ratings: <a className="text-primary hover:underline" href="https://www.morningstar.in/equities.aspx" target="_blank" rel="noreferrer">Morningstar Equities</a></li>
        </ul>
      </div>
      <p className="text-[10px] text-muted-foreground italic leading-relaxed border-t border-border pt-2">
        Dexter is for informational purposes only. Data is sourced from public APIs and may be delayed. This is not investment advice. Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully.
      </p>
    </div>
  );
}
