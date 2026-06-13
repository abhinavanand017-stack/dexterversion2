import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDexterState } from "@/hooks/useDexterState";

const COMPONENTS = [
  { label: "Risk-Adjusted Returns", score: 28, max: 35, note: "Sharpe 1.84 — top 22% of Indian retail traders" },
  { label: "Override Discipline",   score: 24, max: 35, note: "3 overrides made. Avg cost ₹15,773 each. 0 = perfect" },
  { label: "Behavioral Improvement", score: 22, max: 30, note: "Arousal-adjusted alpha improved 23% over last 90 days" },
];

const PERCENTILE = 68;

export function ScoreBreakdown() {
  const [open, setOpen] = useState(true);
  const score = useDexterState((s) => s.dexterScore);
  const trend = useDexterState((s) => s.scoreTrend);

  const tier =
    score > 80 ? { label: "Elite Discipline", color: "#fbbf24" } :
    score >= 60 ? { label: "Strong Discipline", color: "#3b82f6" } :
    score >= 40 ? { label: "Developing", color: "#f59e0b" } :
    { label: "High Behavioral Risk", color: "#ef4444" };

  return (
    <div className="dx-glass p-4 md:p-6">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between w-full">
        <div className="text-left">
          <h3 className="font-display text-lg">Dexter Score Breakdown</h3>
          <div className="text-xs font-mono" style={{ color: tier.color }}>
            {score}/100 · {tier.label} ·
            <span className={trend > 0 ? "text-emerald-400 ml-1" : trend < 0 ? "text-red-400 ml-1" : "ml-1"}>
              {trend > 0 ? "↑" : trend < 0 ? "↓" : ""} {Math.abs(trend)} this week
            </span>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {COMPONENTS.map((c) => (
            <div key={c.label}>
              <div className="flex justify-between text-xs font-mono">
                <span>{c.label}</span>
                <span className="text-muted-foreground">{c.score}/{c.max}</span>
              </div>
              <div className="mt-1 h-2 rounded bg-muted overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${(c.score / c.max) * 100}%`, background: tier.color, transition: "width 0.6s ease" }}
                />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{c.note}</div>
            </div>
          ))}
          <div className="pt-3 border-t border-border">
            <div className="flex justify-between text-xs font-mono">
              <span>Percentile vs. all users</span>
              <span>{PERCENTILE}th</span>
            </div>
            <div className="mt-1 h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${PERCENTILE}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
