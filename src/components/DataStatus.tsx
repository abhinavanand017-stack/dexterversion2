import { useDexterState } from "@/hooks/useDexterState";

export function DataStatus() {
  const health = useDexterState((s) => s.dataHealth);
  const now = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  if (health === "live") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        All systems live <span className="text-muted-foreground">NSE · Biometrics · News</span>
      </span>
    );
  }
  if (health === "degraded") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-mono text-amber-400">
        ⚠ Using cached data — last updated {now} IST
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      Offline mode — demo data active
    </span>
  );
}
