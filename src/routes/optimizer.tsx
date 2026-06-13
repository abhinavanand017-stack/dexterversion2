import { createFileRoute } from "@tanstack/react-router";
import { EfficientFrontier } from "@/components/EfficientFrontier";
import { LambdaSlider } from "@/components/LambdaSlider";

export const Route = createFileRoute("/optimizer")({
  head: () => ({ meta: [{ title: "Dexter — Portfolio Optimizer" }] }),
  component: Optimizer,
});

function Optimizer() {
  return (
    <div className="grid gap-4 dx-fade-in">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><EfficientFrontier /></div>
        <LambdaSlider />
      </div>
      <div className="dx-glass p-6">
        <h3 className="font-display text-lg mb-2">Markowitz Optimization</h3>
        <p className="text-sm text-muted-foreground">
          The frontier is regenerated every time your biometrics shift λ. Move the slider on the
          right to preview how the engine would reallocate under different risk-aversion regimes.
        </p>
      </div>
    </div>
  );
}
