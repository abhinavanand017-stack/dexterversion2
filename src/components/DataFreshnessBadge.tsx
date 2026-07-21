import { useEffect, useState } from "react";
import { Database, Radio } from "lucide-react";
import { getDataProvider, getDataMode } from "@/lib/dataProvider";

export function DataFreshnessBadge({ className = "" }: { className?: string }) {
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"static" | "live">("static");
  useEffect(() => {
    const p = getDataProvider();
    setLabel(p.asOf);
    setMode(getDataMode());
    const id = setInterval(() => setLabel(getDataProvider().asOf), 30000);
    return () => clearInterval(id);
  }, []);
  const color = mode === "live" ? "#22c55e" : "#f59e0b";
  const Icon = mode === "live" ? Radio : Database;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border ${className}`} style={{ borderColor: `${color}55`, background: `${color}12`, color }}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}
