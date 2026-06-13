import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Dexter — Settings" }] }),
  component: SettingsPage,
});

const EXTRA = [
  { to: "/scanner", label: "Market Scanner" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/backtester", label: "Backtester" },
  { to: "/demat", label: "Demat" },
  { to: "/pitch", label: "Pitch Deck" },
] as const;

function SettingsPage() {
  return (
    <div className="grid gap-4 dx-fade-in">
      <div className="dx-glass p-6">
        <h2 className="font-display text-xl mb-2">Settings</h2>
        <p className="text-sm text-muted-foreground">Additional modules:</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          {EXTRA.map((e) => (
            <Link key={e.to} to={e.to} className="dx-pill hover:opacity-80">{e.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
