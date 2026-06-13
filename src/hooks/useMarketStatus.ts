import { useEffect, useState } from "react";

// NSE holidays 2025-2026 (YYYY-MM-DD, IST)
const NSE_HOLIDAYS = new Set<string>([
  "2025-02-26", "2025-03-14", "2025-03-31", "2025-04-10", "2025-04-14",
  "2025-04-18", "2025-05-01", "2025-08-15", "2025-08-27", "2025-10-02",
  "2025-10-21", "2025-10-22", "2025-11-05", "2025-12-25",
  "2026-01-26", "2026-02-17", "2026-03-03", "2026-03-26", "2026-04-03",
  "2026-04-14", "2026-05-01", "2026-08-15", "2026-10-02", "2026-11-12",
  "2026-12-25",
]);

export interface MarketStatus {
  status: "open" | "closed" | "premarket";
  label: string;
  color: string;
  minutesToOpen: number | null;
}

function compute(): MarketStatus {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  const isoDate = `${yyyy}-${mm}-${dd}`;
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();

  if (day === 0 || day === 6)
    return { status: "closed", label: "Weekend — NSE Closed", color: "#6b7280", minutesToOpen: null };
  if (NSE_HOLIDAYS.has(isoDate))
    return { status: "closed", label: "Holiday — NSE Closed", color: "#6b7280", minutesToOpen: null };
  if (mins < 555)
    return { status: "premarket", label: `Pre-market — Opens in ${555 - mins}m`, color: "#f59e0b", minutesToOpen: 555 - mins };
  if (mins <= 930)
    return { status: "open", label: "NSE Open — Live", color: "#22c55e", minutesToOpen: 0 };
  return { status: "closed", label: "NSE Closed — Last: 15:30 IST", color: "#6b7280", minutesToOpen: null };
}

export function useMarketStatus(): MarketStatus {
  const [status, setStatus] = useState<MarketStatus>(() => compute());
  useEffect(() => {
    const iv = setInterval(() => setStatus(compute()), 60_000);
    return () => clearInterval(iv);
  }, []);
  return status;
}
