import { useDexterState } from "@/hooks/useDexterState";

function tone(s: number) {
  if (s > 70) return "var(--bull)";
  if (s >= 40) return "var(--amber)";
  return "var(--bear)";
}

export function ScoreHero() {
  const score = useDexterState((s) => s.dexterScore);
  const c = 490;
  const offset = c - (c * score) / 100;
  return (
    <div className="dx-glass dx-glow-violet p-6 flex items-center gap-6">
      <div className="relative w-[180px] h-[180px]">
        <svg viewBox="0 0 180 180" width="180" height="180" className="-rotate-90">
          <circle cx="90" cy="90" r="78" stroke="rgba(255,255,255,0.06)" strokeWidth="14" fill="none" />
          <circle
            cx="90" cy="90" r="78"
            stroke={tone(score)} strokeWidth="14" fill="none" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1), stroke .4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-5xl font-bold">{score}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Dexter Score</div>
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-display">Cognitive-Financial Health</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Composite index of risk-adjusted returns, emotional discipline, and behavioral improvement.
          Updated in real time as your biometric and trading signals stream in.
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <span className="dx-pill">Sharpe 1.84</span>
          <span className="dx-pill">Max DD -7.2%</span>
          <span className="dx-pill">Win rate 62%</span>
          <span className="dx-pill dx-pill-ok">Stress overlap 11%</span>
        </div>
      </div>
    </div>
  );
}
