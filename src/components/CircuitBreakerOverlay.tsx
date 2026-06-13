import { useEffect, useState } from "react";
import { useDexterState } from "@/hooks/useDexterState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CircuitBreakerOverlay() {
  const active = useDexterState((s) => s.circuitBreakerActive);
  const setCB = useDexterState((s) => s.setCircuitBreaker);
  const [seconds, setSeconds] = useState(60);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!active) {
      setSeconds(60);
      setReason("");
      return;
    }
    const iv = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: "rgba(20, 0, 0, 0.75)" }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="dx-glass max-w-lg w-full p-6 md:p-8 border-2" style={{ borderColor: "#ef4444" }}>
        <div className="text-xs font-mono uppercase tracking-widest text-red-400">Circuit Breaker Engaged</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-display font-bold">Cognitive override blocked</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Arousal critical · HRV destabilized. The engine has temporarily frozen all manual trade
          execution to prevent impulse-driven losses.
        </p>
        <div className="mt-6 text-center font-mono font-bold text-amber-400" style={{ fontSize: "48px" }}>
          00:{String(seconds).padStart(2, "0")}
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center">Cooldown remaining</div>
        <div className="mt-6">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Reflection (optional)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What were you about to do, and why?"
            rows={6}
            className="mt-2"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCB(false)}>
            Acknowledge & dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
