import { useDexterState } from "@/hooks/useDexterState";

export function StatusBar() {
  const { arousalLevel, hrv, lambda, dexterScore, uiMode, setMode } = useDexterState();
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/60 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="font-display font-bold tracking-tight text-lg">
          <span className="dx-grad-text">DEXTER</span>
          <span className="text-muted-foreground text-xs ml-2 font-mono">
            Bio-Algorithmic Trading Engine
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="dx-pill">
          <span className="dx-pill-dot" /> HRV {hrv} ms
        </span>
        <span className="dx-pill">λ {lambda.toFixed(2)}</span>
        <span className={`dx-pill ${arousalLevel === "low" ? "dx-pill-ok" : arousalLevel === "elevated" || arousalLevel === "critical" ? "dx-pill-warn" : ""}`}>
          Arousal · {arousalLevel}
        </span>
        <span className="dx-pill dx-pill-ok">Score {dexterScore}</span>
        <button
          onClick={() => setMode(uiMode === "full" ? "minimal" : "full")}
          className="dx-pill cursor-pointer hover:opacity-80"
          aria-label="Toggle minimal UI"
        >
          {uiMode === "full" ? "Full UI" : "Minimal UI"}
        </button>
      </div>
    </header>
  );
}
