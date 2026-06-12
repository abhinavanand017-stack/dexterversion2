import { createFileRoute } from "@tanstack/react-router";
import { ScoreHero } from "@/components/ScoreHero";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DEXTER" },
      { name: "description", content: "Live bio-algorithmic trading dashboard with NIFTY and SENSEX signals." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="grid gap-4">
      <ScoreHero />
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Free Capital" value="₹5.00 L" sub="Available margin" />
        <Card title="Used Margin" value="₹0" sub="Open positions" />
        <Card title="Collateral" value="₹3.20 L" sub="Pledged holdings" />
      </div>
      <div className="dx-glass p-6">
        <h3 className="text-lg font-display mb-2">Live indices</h3>
        <p className="text-sm text-muted-foreground">
          NIFTY 50 and SENSEX stream from Angel One every 15 seconds. If Angel is unreachable, the engine
          automatically falls back to a Finnhub WebSocket. Check the ticker bar above.
        </p>
      </div>
    </div>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="dx-glass p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="text-3xl font-display font-bold mt-2 dx-blur-sensitive">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
