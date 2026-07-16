import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Check } from "lucide-react";

interface Props { storageKey: string; items: string[]; }

export function InvestorChecklist({ storageKey, items }: Props) {
  const [checked, setChecked] = useLocalStorage<Record<number, boolean>>(`dx_mc_check_${storageKey}`, {});
  const doneCount = items.filter((_, i) => checked[i]).length;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Investor Checklist</div>
        <div className="text-xs text-muted-foreground font-mono">{doneCount}/{items.length}</div>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i}>
            <button
              onClick={() => setChecked({ ...checked, [i]: !checked[i] })}
              className="flex items-start gap-2 text-left w-full text-sm hover:text-foreground text-muted-foreground group"
            >
              <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                checked[i] ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-border/60"
              }`}>
                {checked[i] && <Check className="h-3 w-3" />}
              </span>
              <span className={checked[i] ? "line-through opacity-60" : ""}>{it}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
