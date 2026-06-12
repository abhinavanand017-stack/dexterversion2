import { Link, useRouterState } from "@tanstack/react-router";

const TABS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/scanner", label: "Market Scanner" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/backtester", label: "Backtester" },
  { to: "/demat", label: "Demat" },
  { to: "/pitch", label: "Pitch Deck" },
] as const;

export function TabNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex items-center gap-1 px-4 border-b border-border bg-background/40 backdrop-blur">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to} className="dx-tab" data-active={pathname === t.to}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
