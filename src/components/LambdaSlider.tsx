import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDexterState, lambdaLabel } from "@/hooks/useDexterState";

export function LambdaSlider() {
  const lambda = useDexterState((s) => s.lambda);
  const setLambda = useDexterState((s) => s.setLambda);
  return (
    <div className="dx-glass p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
            Risk Aversion · λ
          </div>
          <div className="font-display font-bold text-xl md:text-2xl" style={{ transition: "all 0.4s ease" }}>
            λ = {lambda.toFixed(2)}
          </div>
          <div className="text-xs text-amber-400 font-mono mt-0.5">{lambdaLabel(lambda)}</div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="dx-pill cursor-help">?</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              This value is set automatically by your biometrics. Higher = more defensive
              portfolio allocation.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Slider
        value={[lambda]}
        min={1}
        max={10}
        step={0.1}
        onValueChange={([v]) => setLambda(v)}
        className="mt-4"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-2">
        <span>1 · Aggressive</span>
        <span>5 · Balanced</span>
        <span>10 · Panic</span>
      </div>
    </div>
  );
}
