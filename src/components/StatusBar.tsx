import { useDexterState } from "@/hooks/useDexterState";
import { DemoPill } from "./DemoPill";

export function StatusBar() {
  const { arousalLevel, hrv, lambda, dexterScore, scoreTrend, uiMode, setMode } = useDexterState();
  return (
    <header className="flex items-center justify-between gap-3 px-3 md:px-4 py-2 border-b border-border bg-background/60 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <div className="font-display font-bold tracking-tight text-base md:text-lg flex items-center gap-2">
          <span className="dx-grad-text">DEXTER</span>
          <span className="dx-engine-dot" aria-hidden />
          <span className="hidden md:inline text-[11px] font-mono text-emerald-400">Engine Active</span>
          <DemoPill />
        </div>
      </div>
      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
        <span className="dx-pill hidden md:inline-flex"><span className="dx-pill-dot" /> HRV {hrv}ms</span>
        <span className="dx-pill hidden sm:inline-flex">λ {lambda.toFixed(2)}</span>
        <span className={`dx-pill ${arousalLevel === "low" ? "dx-pill-ok" : arousalLevel === "elevated" || arousalLevel === "critical" ? "dx-pill-warn" : ""}`}>
          {arousalLevel}
        </span>
        <span className="dx-pill dx-pill-ok">
          {dexterScore} {scoreTrend > 0 ? "↑" : scoreTrend < 0 ? "↓" : ""}
        </span>
        <button
          onClick={() => setMode(uiMode === "full" ? "minimal" : "full")}
          className="dx-pill cursor-pointer hover:opacity-80"
          aria-label="Toggle minimal UI"
        >
          {uiMode === "full" ? "Full" : "Min"}
        </button>
      </div>
    </header>
  );
}

