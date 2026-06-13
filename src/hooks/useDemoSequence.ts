import { useEffect } from "react";
import { toast } from "sonner";
import { useDexterState } from "./useDexterState";

/**
 * 120-second auto-playing market stress demo.
 * T+0:   arousal 0.28, lambda 3.2
 * T+10:  Nifty drop toast
 * T+20:  arousal 0.58, lambda 5.5
 * T+30:  Elevated stress toast
 * T+45:  arousal 0.82, lambda 7.8, circuit breaker fires
 * T+105: cooldown — arousal 0.35, lambda 3.5
 * T+120: loop
 */
export function useDemoSequence() {
  const demoMode = useDexterState((s) => s.demoMode);
  const setArousal = useDexterState((s) => s.setArousal);
  const setLambda = useDexterState((s) => s.setLambda);
  const setScore = useDexterState((s) => s.setDexterScore);
  const setCB = useDexterState((s) => s.setCircuitBreaker);
  const bioSource = useDexterState((s) => s.bioSource);

  useEffect(() => {
    if (!demoMode || bioSource !== "demo") return;
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const at = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(t);
    };

    const animate = (
      from: number, to: number, durMs: number, apply: (v: number) => void,
    ) => {
      const steps = 30;
      const dt = durMs / steps;
      for (let i = 1; i <= steps; i++) {
        at(i * dt, () => apply(from + (to - from) * (i / steps)));
      }
    };

    const runCycle = () => {
      // T+0
      setArousal(0.28); setLambda(3.2); setScore(74); setCB(false);

      // Score pulse 71..76 throughout
      let scoreT = 0;
      const scoreIv = setInterval(() => {
        if (cancelled) return;
        scoreT += 1;
        const v = 73 + Math.round(Math.sin(scoreT / 3) * 2);
        useDexterState.getState().setDexterScore(v);
      }, 1500);
      timers.push(scoreIv as unknown as ReturnType<typeof setTimeout>);

      at(10_000, () => toast("📉 Market Event", {
        description: "Nifty drops 1.8% in 4 minutes",
      }));

      at(15_000, () => animate(0.28, 0.58, 5000, setArousal));
      at(15_000, () => animate(3.2, 5.5, 5000, setLambda));

      at(30_000, () => toast.warning("⚠ Elevated stress detected", {
        description: "HRV down 18%, override-risk rising",
      }));

      at(35_000, () => animate(0.58, 0.82, 10_000, setArousal));
      at(35_000, () => animate(5.5, 7.8, 10_000, setLambda));

      at(45_000, () => setCB(true));

      at(105_000, () => {
        setCB(false);
        animate(0.82, 0.35, 8000, setArousal);
        animate(7.8, 3.5, 8000, setLambda);
      });

      at(120_000, () => {
        clearInterval(scoreIv);
        runCycle();
      });
    };

    runCycle();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [demoMode, bioSource, setArousal, setLambda, setScore, setCB]);
}
