import { ScoreHero } from "@/components/ScoreHero";
import { LambdaSlider } from "@/components/LambdaSlider";
import { EfficientFrontier } from "@/components/EfficientFrontier";
import { useDexterState } from "@/hooks/useDexterState";

export function DashboardView() {
  const lambda = useDexterState((s) => s.lambda);
  const arousalLevel = useDexterState((s) => s.arousalLevel);
  return (
    <div className="grid gap-4 dx-fade-in">
      <ScoreHero />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card title="Free Capital" value="₹5.00 L" sub="Available margin" />
        <Card title="Used Margin" value="₹0" sub="Open positions" />
        <Card title="Collateral" value="₹3.20 L" sub="Pledged holdings" />
        <Card title="Lambda (λ)" value={lambda.toFixed(2)} sub={`Arousal · ${arousalLevel}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EfficientFrontier />
        </div>
        <LambdaSlider />
      </div>
      <div className="dx-glass p-6">
        <h3 className="text-lg font-display mb-2">Live indices</h3>
        <p className="text-sm text-muted-foreground">
          NIFTY 50, SENSEX, and India VIX stream from Yahoo Finance every 30 seconds. The cognitive
          firewall fires automatically when arousal crosses critical thresholds — watch the Demo
          banner above to see a full market stress event play out.
        </p>
      </div>
    </div>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="dx-glass p-4 md:p-5">
      <div className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="text-xl md:text-3xl font-display font-bold mt-2 dx-blur-sensitive" style={{ transition: "all 0.4s ease" }}>{value}</div>
      <div className="text-[10px] md:text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
