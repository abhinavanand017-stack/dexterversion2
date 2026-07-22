import { useEffect, useState } from "react";
import { Database, Radio, Clock } from "lucide-react";
import { getDataProvider, getDataMode, getSymbolStatus, ensureLiveBootstrap, type SymbolStatus } from "@/lib/dataProvider";

export function DataFreshnessBadge({ className = "", symbol }: { className?: string; symbol?: string }) {
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<SymbolStatus | "static-mode">("static-mode");

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      const p = getDataProvider();
      if (cancelled) return;
      const mode = getDataMode();
      if (mode === "live" && symbol) {
        setStatus(getSymbolStatus(symbol));
        setLabel(p.asOf);
      } else if (mode === "live") {
        setStatus("live");
        setLabel(p.asOf);
      } else {
        setStatus("static-mode");
        setLabel(p.asOf);
      }
    };
    void ensureLiveBootstrap().then(tick);
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  const style = (() => {
    switch (status) {
      case "live":    return { color: "#22c55e", Icon: Radio,    text: symbol ? "Live" : label };
      case "delayed": return { color: "#f59e0b", Icon: Clock,    text: "Delayed" };
      case "static":  return { color: "#f59e0b", Icon: Database, text: "Snapshot" };
      default:        return { color: "#f59e0b", Icon: Database, text: label };
    }
  })();

  const { color, Icon, text } = style;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border ${className}`}
      style={{ borderColor: `${color}55`, background: `${color}12`, color }}
      title={label}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <Icon className="w-3 h-3" /> {text}
    </span>
  );
}
