import { Switch } from "@/components/ui/switch";
import { useDexterState } from "@/hooks/useDexterState";

export function DemoBanner() {
  const demoMode = useDexterState((s) => s.demoMode);
  const setDemoMode = useDexterState((s) => s.setDemoMode);
  if (!demoMode) return null;
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-xs md:text-sm"
      style={{ background: "#1a1200", borderBottom: "1px solid #f59e0b" }}
    >
      <div className="flex min-w-0 items-center gap-2 text-amber-200">
        <span className="shrink-0">⚡</span>
        <span className="truncate">
          <strong className="text-amber-400">LIVE DEMO</strong>
          <span className="hidden md:inline"> — Simulating a market stress event with synthetic biometrics. Real wearable integration available in production.</span>
        </span>
      </div>
      <label className="flex shrink-0 items-center gap-2 text-amber-300">
        <span className="hidden sm:inline text-xs">Demo Mode</span>
        <Switch checked={demoMode} onCheckedChange={setDemoMode} />
      </label>
    </div>
  );
}
