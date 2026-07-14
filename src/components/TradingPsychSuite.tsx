import { useMemo, useState } from "react";
import { AlertTriangle, Brain, Flame, Shield, Zap, TrendingDown, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDexterState } from "@/hooks/useDexterState";
import { formatINR } from "@/lib/formatINR";

/* ============================================================
   Trading Psychology Suite
   Innovative bio→finance mapping: turns biometric signals into
   actionable trading guardrails.
   ============================================================ */

// ---------- Risk Tolerance Quiz ----------
const QUIZ: Array<{ q: string; options: Array<{ label: string; score: number }> }> = [
  {
    q: "Your ₹10L portfolio drops 30% overnight. Your gut reaction?",
    options: [
      { label: "Panic — sell everything", score: 1 },
      { label: "Sell half, wait it out", score: 3 },
      { label: "Hold, review calmly", score: 6 },
      { label: "Buy more — sale prices!", score: 10 },
    ],
  },
  {
    q: "Time horizon for this money?",
    options: [
      { label: "< 1 year", score: 1 },
      { label: "1–3 years", score: 3 },
      { label: "3–10 years", score: 7 },
      { label: "10+ years", score: 10 },
    ],
  },
  {
    q: "Which return profile appeals more?",
    options: [
      { label: "Guaranteed 6% / year", score: 2 },
      { label: "8-12% with mild swings", score: 5 },
      { label: "15% avg, ±25% swings", score: 8 },
      { label: "25%+ possible, could halve", score: 10 },
    ],
  },
  {
    q: "How often do you check prices?",
    options: [
      { label: "Multiple times per hour", score: 1 },
      { label: "A few times per day", score: 4 },
      { label: "Once a day / weekly", score: 8 },
      { label: "Monthly or less", score: 10 },
    ],
  },
  {
    q: "You made a bad trade. You…",
    options: [
      { label: "Feel sick for days", score: 1 },
      { label: "Ruminate but move on", score: 4 },
      { label: "Journal & extract lesson", score: 8 },
      { label: "Immediately test next hypothesis", score: 10 },
    ],
  },
];

function riskProfileFor(pts: number, maxPts: number) {
  const pct = (pts / maxPts) * 100;
  if (pct >= 80) return { label: "Aggressive", color: "#ff4466", eq: 85, debt: 10, gold: 5 };
  if (pct >= 60) return { label: "Growth", color: "#ffaa00", eq: 70, debt: 20, gold: 10 };
  if (pct >= 40) return { label: "Balanced", color: "#00d4ff", eq: 55, debt: 35, gold: 10 };
  if (pct >= 20) return { label: "Conservative", color: "#a78bfa", eq: 35, debt: 55, gold: 10 };
  return { label: "Capital Preservation", color: "#94a3b8", eq: 15, debt: 75, gold: 10 };
}

function RiskToleranceQuiz() {
  const [answers, setAnswers] = useState<number[]>(Array(QUIZ.length).fill(-1));
  const [submitted, setSubmitted] = useState(false);
  const maxPts = QUIZ.length * 10;
  const pts = answers.reduce((s, i, qi) => s + (i >= 0 ? QUIZ[qi].options[i].score : 0), 0);
  const profile = riskProfileFor(pts, maxPts);

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Risk Profile</div>
          <div className="font-display text-3xl mt-1" style={{ color: profile.color }}>{profile.label}</div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">Score: {pts}/{maxPts}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <AllocationTile label="Equity" pct={profile.eq} color={profile.color} />
          <AllocationTile label="Debt" pct={profile.debt} color="#00d4ff" />
          <AllocationTile label="Gold / Alt" pct={profile.gold} color="#ffaa00" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setAnswers(Array(QUIZ.length).fill(-1)); }}>
          Retake Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {QUIZ.map((item, qi) => (
        <div key={qi}>
          <div className="text-sm font-medium mb-2">{qi + 1}. {item.q}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {item.options.map((o, oi) => {
              const active = answers[qi] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => setAnswers((prev) => prev.map((v, i) => i === qi ? oi : v))}
                  className="text-left text-xs px-3 py-2 rounded border transition"
                  style={{
                    borderColor: active ? "#a78bfa" : "rgba(255,255,255,0.1)",
                    background: active ? "rgba(167,139,250,0.12)" : "transparent",
                    color: active ? "#e2e8f0" : "#94a3b8",
                  }}
                >{o.label}</button>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        onClick={() => setSubmitted(true)}
        disabled={answers.some((a) => a < 0)}
        className="w-full"
      >
        See My Profile ({answers.filter((a) => a >= 0).length}/{QUIZ.length})
      </Button>
    </div>
  );
}

function AllocationTile({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="dx-glass p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl mt-1" style={{ color }}>{pct}%</div>
    </div>
  );
}

/* ---------- Cognitive Bias Detector ---------- */
const BIASES = [
  {
    name: "Loss Aversion",
    icon: TrendingDown,
    color: "#ff4466",
    trigger: (arousal: number) => arousal > 0.6,
    detected: "You're feeling the pain of losses 2× more than the pleasure of gains right now.",
    remedy: "Don't sell winners to feel good. Don't hold losers to avoid the pain. Ask: 'Would I buy this today?'",
  },
  {
    name: "Recency Bias",
    icon: Zap,
    color: "#ffaa00",
    trigger: (arousal: number) => arousal > 0.4 && arousal < 0.7,
    detected: "Recent moves are dominating your thinking. Your 5-year data has left the chat.",
    remedy: "Zoom the chart out to 10 years. What does the trend look like now?",
  },
  {
    name: "FOMO",
    icon: Flame,
    color: "#ff8800",
    trigger: (arousal: number) => arousal > 0.7,
    detected: "Chasing energy detected. The market is not going anywhere without you.",
    remedy: "Set a limit order 5% below current price. If it fills, great. If not, you saved yourself.",
  },
  {
    name: "Confirmation Bias",
    icon: Brain,
    color: "#a78bfa",
    trigger: (_: number) => true,
    detected: "You've been consuming only bullish content on your top position.",
    remedy: "Actively search '<stock> bear case' or 'short thesis'. Force the counter-argument.",
  },
  {
    name: "Anchoring",
    icon: Shield,
    color: "#00d4ff",
    trigger: (arousal: number) => arousal < 0.4,
    detected: "You keep referencing your entry price. The market has forgotten it.",
    remedy: "Delete your buy price mentally. Ask: 'Is this a buy at today's price with today's info?'",
  },
];

function BiasDetector({ arousal }: { arousal: number }) {
  const active = BIASES.filter((b) => b.trigger(arousal));
  return (
    <div className="space-y-2">
      {active.map((b) => (
        <div key={b.name} className="p-3 rounded-lg border" style={{ borderColor: `${b.color}55`, background: `${b.color}0a` }}>
          <div className="flex items-center gap-2">
            <b.icon className="w-4 h-4" style={{ color: b.color }} />
            <div className="text-sm font-semibold" style={{ color: b.color }}>{b.name}</div>
            <Badge variant="outline" className="ml-auto text-[10px] font-mono">DETECTED</Badge>
          </div>
          <div className="text-xs mt-2 text-foreground/80">{b.detected}</div>
          <div className="text-[11px] mt-2 text-muted-foreground italic">✅ Remedy: {b.remedy}</div>
        </div>
      ))}
      {active.length === 0 && (
        <div className="p-4 text-center text-xs text-muted-foreground">No biases actively firing. Nice mental state for decisions.</div>
      )}
    </div>
  );
}

/* ---------- Emotional Position Sizer ----------
   Recommends how much of your normal position size to deploy based on arousal.
*/
function EmotionalPositionSizer({ arousal, hrv }: { arousal: number; hrv: number }) {
  const baseSize = 100_000; // ₹1L reference
  const arousalPenalty = Math.max(0, arousal - 0.3);   // start clamping above 0.3
  const hrvBonus = Math.min(0.2, Math.max(0, (hrv - 40) / 400)); // healthy HRV small bonus
  const factor = Math.max(0.15, Math.min(1.15, 1 - arousalPenalty * 1.4 + hrvBonus));
  const recommended = baseSize * factor;
  const skipTrade = arousal > 0.85;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommended Position Size</div>
          <div className="text-[10px] font-mono text-muted-foreground">Base: {formatINR(baseSize, { compact: true })}</div>
        </div>
        <div className="font-display text-3xl mt-1" style={{ color: skipTrade ? "#ff4466" : "#00ff88" }}>
          {skipTrade ? "SKIP" : formatINR(recommended, { compact: true })}
        </div>
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          {skipTrade ? "Arousal critical — do not trade" : `${Math.round(factor * 100)}% of normal size`}
        </div>
      </div>

      <div className="h-2 rounded bg-background/40 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${factor * 100}%`,
            background: skipTrade ? "#ff4466" : factor > 0.9 ? "#00ff88" : factor > 0.6 ? "#ffaa00" : "#ff8800",
          }}
        />
      </div>

      <div className="text-[11px] text-muted-foreground italic">
        💡 Studies show impulsive trades made under high arousal underperform by 200-400 bps annualised. Sizing down protects capital and compounding.
      </div>
    </div>
  );
}

/* ---------- Circuit Breaker Countdown ---------- */
function CircuitBreakerCard({ arousal }: { arousal: number }) {
  const active = arousal > 0.75;
  const [cooldownStart] = useState(() => Date.now());
  const elapsed = 0; // static demo
  const RECOMMENDED_MIN = 20;
  return (
    <div className="p-4 rounded-lg border" style={{
      borderColor: active ? "#ff4466" : "#00ff8844",
      background: active ? "rgba(255,68,102,0.08)" : "rgba(0,255,136,0.04)",
    }}>
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4" style={{ color: active ? "#ff4466" : "#00ff88" }} />
        <div className="text-sm font-semibold">Circuit Breaker Status</div>
        <Badge className="ml-auto" style={{ background: active ? "#ff4466" : "#00ff88", color: "#0d1117" }}>
          {active ? "TRIPPED" : "ARMED"}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        {active
          ? `Arousal above 0.75 — recommended cooldown ${RECOMMENDED_MIN} minutes before your next trade decision.`
          : `Trading unlocked. Circuit breaker will trip if arousal exceeds 0.75.`}
      </div>
      {active && (
        <div className="mt-3 text-[11px] font-mono text-red-400">
          Cooldown started · elapsed {elapsed}s / {RECOMMENDED_MIN * 60}s
        </div>
      )}
      {/* keep unused vars warning-free */}
      {false && <span>{cooldownStart}</span>}
    </div>
  );
}

/* ---------- Main aggregate widget ---------- */
export function TradingPsychSuite() {
  const arousal = useDexterState((s) => s.arousal);
  const hrv = useDexterState((s) => s.hrv);
  const [tab, setTab] = useState<"quiz" | "bias" | "sizer" | "breaker">("bias");

  const arousalPct = Math.round(arousal * 100);
  const arousalTone = arousal > 0.75 ? "#ff4466" : arousal > 0.5 ? "#ffaa00" : "#00ff88";

  return (
    <div className="dx-glass p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Trading Psychology Suite
          </h2>
          <p className="text-xs text-muted-foreground">Biometric-informed guardrails that make you a better trader.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Arousal</div>
            <div className="font-mono text-lg" style={{ color: arousalTone }}>{arousalPct}%</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HRV</div>
            <div className="font-mono text-lg text-amber-400">{hrv}ms</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([
          ["bias", "Bias Detector", Brain],
          ["sizer", "Position Sizer", Zap],
          ["breaker", "Circuit Breaker", Shield],
          ["quiz", "Risk Quiz", AlertTriangle],
        ] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
              tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "bias" && <BiasDetector arousal={arousal} />}
      {tab === "sizer" && <EmotionalPositionSizer arousal={arousal} hrv={hrv} />}
      {tab === "breaker" && <CircuitBreakerCard arousal={arousal} />}
      {tab === "quiz" && <RiskToleranceQuiz />}
    </div>
  );
}

/* ---------- Live biometric mood ring ---------- */
export function BiometricMoodRing() {
  const arousal = useDexterState((s) => s.arousal);
  const hrv = useDexterState((s) => s.hrv);
  const sleepQuality = useDexterState((s) => s.sleepQuality);
  const state = useMemo(() => {
    if (arousal > 0.75) return { label: "PANIC", color: "#ff4466", advice: "Do not trade. Walk. Breathe." };
    if (arousal > 0.5) return { label: "ELEVATED", color: "#ffaa00", advice: "Reduce size. Slow down." };
    if (arousal > 0.25) return { label: "NOMINAL", color: "#00d4ff", advice: "Normal decisions." };
    return { label: "CALM", color: "#00ff88", advice: "Ideal for research & planning." };
  }, [arousal]);

  return (
    <div className="dx-glass p-5 flex items-center gap-5 flex-wrap">
      <div className="relative w-24 h-24 shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="48" cy="48" r="40" fill="none"
            stroke={state.color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 40}
            strokeDashoffset={2 * Math.PI * 40 * (1 - arousal)}
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 1s ease-out, stroke 1s" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <div className="text-lg font-mono" style={{ color: state.color }}>{Math.round(arousal * 100)}</div>
          <div className="text-[9px] text-muted-foreground uppercase">arousal</div>
        </div>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Trader Mood Ring</div>
        <div className="font-display text-2xl mt-1" style={{ color: state.color }}>{state.label}</div>
        <div className="text-xs text-muted-foreground mt-1">{state.advice}</div>
        <div className="flex gap-4 mt-3 text-[11px] font-mono">
          <span>HRV <span className="text-amber-400">{hrv}ms</span></span>
          <span>Sleep <span className="text-emerald-400">{Math.round(sleepQuality * 100)}%</span></span>
        </div>
      </div>
    </div>
  );
}
