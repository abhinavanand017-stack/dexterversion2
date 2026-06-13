import { useDexterState } from "@/hooks/useDexterState";

function tierColor(s: number) {
  if (s > 80) return "#fbbf24";
  if (s >= 60) return "#3b82f6";
  if (s >= 40) return "#f59e0b";
  return "#ef4444";
}
function tierLabel(s: number) {
  if (s > 80) return "Elite Discipline";
  if (s >= 60) return "Strong Discipline";
  if (s >= 40) return "Developing";
  return "High Behavioral Risk";
}

export function ScoreHero() {
  const score = useDexterState((s) => s.dexterScore);
  const c = 490;
  const offset = c - (c * score) / 100;
  return (
    <div className="dx-glass dx-glow-violet p-4 md:p-6 flex flex-col sm:flex-row items-center gap-4 md:gap-6">
      <div className="relative w-[140px] h-[140px] md:w-[180px] md:h-[180px] shrink-0">
        <svg viewBox="0 0 180 180" width="100%" height="100%" className="-rotate-90">
          <circle cx="90" cy="90" r="78" stroke="rgba(255,255,255,0.06)" strokeWidth="14" fill="none" />
          <circle
            cx="90" cy="90" r="78"
            stroke={tierColor(score)} strokeWidth="14" fill="none" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1), stroke .4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-4xl md:text-5xl font-bold" style={{ transition: "all 0.4s ease" }}>{score}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest mt-1">Dexter Score</div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg md:text-xl font-display">Cognitive-Financial Health</h3>
        <div className="text-xs font-mono mt-1" style={{ color: tierColor(score) }}>{tierLabel(score)}</div>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Composite of risk-adjusted returns, override discipline, and behavioral improvement.
          Updated live as your biometric and trading signals stream in.
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
