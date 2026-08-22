import { Trash2 } from "lucide-react";
import type { AnalyserHolding, HoldingKind } from "@/lib/portfolioAnalyser/types";
import { formatINR } from "@/lib/formatINR";

const GROUPS: { kind: HoldingKind; label: string }[] = [
  { kind: "stock", label: "Stocks" },
  { kind: "etf", label: "ETFs" },
  { kind: "fund", label: "Mutual Funds" },
];

interface Props {
  holdings: AnalyserHolding[];
  onPatch: (id: string, patch: Partial<AnalyserHolding>) => void;
  onRemove: (id: string) => void;
}

/** Editable, grouped preview shown after parsing and before any analysis run. */
export function PreviewTable({ holdings, onPatch, onRemove }: Props) {
  if (!holdings.length) return null;

  return (
    <div className="space-y-4">
      {GROUPS.map(({ kind, label }) => {
        const rows = holdings.filter((h) => h.kind === kind);
        if (!rows.length) return null;
        const unit = kind === "stock" ? "Qty" : "Units";
        return (
          <div key={kind} className="dx-glass p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{label}</h3>
              <span className="text-xs text-muted-foreground font-mono">{rows.length} row(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left py-1.5 px-2">Name</th>
                    <th className="text-left py-1.5 px-2">{kind === "fund" ? "Scheme Code" : "Symbol"}</th>
                    <th className="text-right py-1.5 px-2">{unit}</th>
                    <th className="text-right py-1.5 px-2">Avg Cost</th>
                    <th className="text-left py-1.5 px-2">Buy Date</th>
                    <th className="text-left py-1.5 px-2">Type</th>
                    <th className="py-1.5 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => {
                    const bad = !h.symbol.trim() || !h.qty || !h.avgCost;
                    return (
                      <tr key={h.id} className={`border-b border-border/40 ${bad ? "bg-amber-500/5" : ""}`}>
                        <td className="py-1 px-2">
                          <input value={h.name} onChange={(e) => onPatch(h.id, { name: e.target.value })}
                            className="w-full min-w-[160px] rounded border border-border bg-background/40 px-2 py-1 text-sm" />
                        </td>
                        <td className="py-1 px-2">
                          <input value={h.symbol}
                            onChange={(e) => {
                              const v = e.target.value;
                              onPatch(h.id, {
                                symbol: h.kind === "fund" ? v : v.toUpperCase(),
                                schemeCode: h.kind === "fund" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined,
                              });
                            }}
                            className="w-28 rounded border border-border bg-background/40 px-2 py-1 font-mono text-sm" />
                        </td>
                        <td className="py-1 px-2">
                          <input type="number" value={h.qty || ""} onChange={(e) => onPatch(h.id, { qty: Number(e.target.value) })}
                            className="w-24 rounded border border-border bg-background/40 px-2 py-1 text-right font-mono text-sm" />
                        </td>
                        <td className="py-1 px-2">
                          <input type="number" value={h.avgCost || ""} onChange={(e) => onPatch(h.id, { avgCost: Number(e.target.value) })}
                            className="w-28 rounded border border-border bg-background/40 px-2 py-1 text-right font-mono text-sm" />
                        </td>
                        <td className="py-1 px-2">
                          <input type="date" value={h.buyDate.slice(0, 10)}
                            onChange={(e) => onPatch(h.id, { buyDate: new Date(e.target.value).toISOString() })}
                            className="rounded border border-border bg-background/40 px-2 py-1 text-sm" />
                        </td>
                        <td className="py-1 px-2">
                          <select value={h.kind} onChange={(e) => onPatch(h.id, { kind: e.target.value as HoldingKind })}
                            className="rounded border border-border bg-background/40 px-2 py-1 text-sm">
                            <option value="stock">Stock</option>
                            <option value="etf">ETF</option>
                            <option value="fund">Mutual Fund</option>
                          </select>
                        </td>
                        <td className="py-1 px-2 text-right">
                          <button onClick={() => onRemove(h.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-xs text-muted-foreground">
                    <td className="py-1.5 px-2" colSpan={2}>Invested in {label.toLowerCase()}</td>
                    <td className="py-1.5 px-2 text-right font-mono" colSpan={5}>
                      {formatINR(rows.reduce((s, h) => s + h.qty * h.avgCost, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
