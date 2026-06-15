import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STOCK_UNIVERSE } from "@/lib/stockUniverse";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Download, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Tracker — DEXTER" },
      { name: "description", content: "Track your stock and mutual fund holdings with live P&L, XIRR, and sector allocation." },
    ],
  }),
  component: PortfolioPage,
});

interface Holding {
  id: string;
  type: "stock" | "fund";
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  buyDate: string;
}

function PortfolioPage() {
  const [holdings, setHoldings] = useLocalStorage<Holding[]>("dx_portfolio", []);
  const [showAdd, setShowAdd] = useState(false);

  const enriched = useMemo(() => holdings.map((h) => {
    const stock = STOCK_UNIVERSE.find((s) => s.symbol === h.symbol);
    const cmp = stock?.price ?? h.avgPrice;
    const invested = h.qty * h.avgPrice;
    const current = h.qty * cmp;
    const pnl = current - invested;
    const pnlPct = (pnl / invested) * 100;
    const sector = stock?.sector ?? "Other";
    return { ...h, cmp, invested, current, pnl, pnlPct, sector };
  }), [holdings]);

  const totals = useMemo(() => {
    const invested = enriched.reduce((a, h) => a + h.invested, 0);
    const current = enriched.reduce((a, h) => a + h.current, 0);
    const pnl = current - invested;
    return { invested, current, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0 };
  }, [enriched]);

  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    enriched.forEach((h) => map.set(h.sector, (map.get(h.sector) ?? 0) + h.current));
    return Array.from(map).map(([sector, value]) => ({ sector, value }));
  }, [enriched]);

  const remove = (id: string) => setHoldings(holdings.filter((h) => h.id !== id));

  const exportCsv = () => {
    const lines = ["Symbol,Name,Qty,AvgPrice,CMP,Invested,Current,PnL,PnL%"];
    enriched.forEach((h) => lines.push([h.symbol, `"${h.name}"`, h.qty, h.avgPrice, h.cmp, h.invested.toFixed(2), h.current.toFixed(2), h.pnl.toFixed(2), h.pnlPct.toFixed(2)].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "portfolio.csv"; a.click();
    toast.success("Portfolio exported");
  };

  const colors = ["#00ffcc", "#ff6b9d", "#ffaa00", "#a78bfa", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"];

  return (
    <div className="dx-fade-in space-y-4 pb-20">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Portfolio Tracker</h1>
          <p className="text-xs text-muted-foreground font-mono">Stored locally · Live CMP from Screener data</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="dx-pill cursor-pointer"><Download className="h-3 w-3" /> Export</button>
          <button onClick={() => setShowAdd(true)} className="dx-pill dx-pill-ok cursor-pointer"><Plus className="h-3 w-3" /> Add Holding</button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Invested" value={`₹${(totals.invested / 100000).toFixed(2)}L`} />
        <Stat label="Current Value" value={`₹${(totals.current / 100000).toFixed(2)}L`} color="var(--primary)" />
        <Stat label="Total P&L" value={`${totals.pnl >= 0 ? "+" : ""}₹${(totals.pnl / 100000).toFixed(2)}L`} color={totals.pnl >= 0 ? "var(--bull)" : "var(--bear)"} />
        <Stat label="Return %" value={`${totals.pnlPct >= 0 ? "+" : ""}${totals.pnlPct.toFixed(2)}%`} color={totals.pnlPct >= 0 ? "var(--bull)" : "var(--bear)"} />
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-4">
        <div className="dx-glass rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground tracking-wider bg-background/40">
              <tr>
                <th className="text-left px-3 py-2">Stock</th>
                <th className="text-right px-2 py-2">Qty</th>
                <th className="text-right px-2 py-2">Avg</th>
                <th className="text-right px-2 py-2">CMP</th>
                <th className="text-right px-2 py-2">P&L</th>
                <th className="text-right px-2 py-2">%</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-muted-foreground text-sm">No holdings yet. Click "Add Holding" to start tracking.</td></tr>
              )}
              {enriched.map((h) => {
                const up = h.pnl >= 0;
                return (
                  <tr key={h.id} className={"border-t border-border " + (up ? "bg-emerald-500/[0.03]" : "bg-red-500/[0.03]")}>
                    <td className="px-3 py-2"><div className="font-medium text-sm">{h.symbol}</div><div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{h.name}</div></td>
                    <td className="px-2 py-2 text-right font-mono">{h.qty}</td>
                    <td className="px-2 py-2 text-right font-mono">₹{h.avgPrice.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right font-mono">₹{h.cmp.toFixed(2)}</td>
                    <td className={"px-2 py-2 text-right font-mono " + (up ? "text-emerald-400" : "text-red-400")}>{up ? "+" : ""}₹{h.pnl.toFixed(0)}</td>
                    <td className={"px-2 py-2 text-right font-mono " + (up ? "text-emerald-400" : "text-red-400")}>{up ? "+" : ""}{h.pnlPct.toFixed(2)}%</td>
                    <td className="px-2 py-2"><button onClick={() => remove(h.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="dx-glass p-4 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sector Allocation</div>
          {sectors.length === 0 ? <div className="text-xs text-muted-foreground text-center py-8">Add holdings to view</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sectors} dataKey="value" nameKey="sector" innerRadius={45} outerRadius={80}>
                  {sectors.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {showAdd && <AddHoldingModal onClose={() => setShowAdd(false)} onAdd={(h) => { setHoldings([...holdings, h]); toast.success(`${h.symbol} added`); }} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="dx-glass p-4 rounded-lg">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="text-xl font-bold font-mono mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function AddHoldingModal({ onClose, onAdd }: { onClose: () => void; onAdd: (h: Holding) => void }) {
  const [q, setQ] = useState("");
  const [qty, setQty] = useState(10);
  const [avg, setAvg] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const results = useMemo(() => {
    const Q = q.toUpperCase();
    if (!Q) return STOCK_UNIVERSE.slice(0, 6);
    return STOCK_UNIVERSE.filter((s) => s.symbol.includes(Q) || s.name.toUpperCase().includes(Q)).slice(0, 8);
  }, [q]);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md dx-glass rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Add Holding</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock…" className="w-full bg-background/60 border border-border rounded px-3 py-2 text-sm font-mono" />
        <div className="max-h-40 overflow-y-auto border border-border rounded">
          {results.map((r) => (
            <button key={r.symbol} onClick={() => { setPicked(r.symbol); setAvg(r.price); }} className={"flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-primary/10 " + (picked === r.symbol ? "bg-primary/20" : "")}>
              <div><div className="font-mono">{r.symbol}</div><div className="text-[10px] text-muted-foreground">{r.name}</div></div>
              <span className="font-mono text-xs">₹{r.price}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs"><span className="text-muted-foreground uppercase tracking-wider">Qty</span>
            <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full bg-background/60 border border-border rounded px-2 py-1 mt-1 font-mono" /></label>
          <label className="text-xs"><span className="text-muted-foreground uppercase tracking-wider">Avg ₹</span>
            <input type="number" value={avg} onChange={(e) => setAvg(Number(e.target.value))} className="w-full bg-background/60 border border-border rounded px-2 py-1 mt-1 font-mono" /></label>
          <label className="text-xs"><span className="text-muted-foreground uppercase tracking-wider">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-background/60 border border-border rounded px-2 py-1 mt-1 font-mono" /></label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="dx-pill cursor-pointer">Cancel</button>
          <button
            disabled={!picked}
            onClick={() => {
              const s = STOCK_UNIVERSE.find((x) => x.symbol === picked!)!;
              onAdd({ id: crypto.randomUUID(), type: "stock", symbol: s.symbol, name: s.name, qty, avgPrice: avg, buyDate: date });
              onClose();
            }}
            className="dx-pill dx-pill-ok cursor-pointer disabled:opacity-50"
          >Add</button>
        </div>
      </div>
    </div>
  );
}
