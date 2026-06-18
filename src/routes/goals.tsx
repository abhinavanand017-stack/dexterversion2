import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePortfolio } from "@/hooks/usePortfolio";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [
    { title: "Goal Planner — DEXTER" },
    { name: "description", content: "Link holdings and SIPs to goals. See progress, gap analysis, and required top-up to stay on track." },
  ] }),
  component: GoalsPage,
});

interface Goal {
  id: string;
  name: string;
  category: string;
  target: number;          // ₹
  targetDate: string;      // ISO
  monthlySip: number;      // ₹
  expectedReturn: number;  // decimal, e.g. 0.12
  linkedHoldingIds: string[];
  createdAt: number;
}

const CATEGORIES = [
  { key: "home", icon: "🏠", label: "Home" },
  { key: "edu", icon: "🎓", label: "Education" },
  { key: "retire", icon: "🌴", label: "Retirement" },
  { key: "car", icon: "🚗", label: "Car" },
  { key: "wedding", icon: "💍", label: "Wedding" },
  { key: "travel", icon: "✈️", label: "Travel" },
  { key: "emergency", icon: "🛟", label: "Emergency Fund" },
  { key: "custom", icon: "🎯", label: "Custom" },
];

function fvAnnuity(monthly: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r <= 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

function requiredSip(target: number, currentValue: number, annualRate: number, years: number): number {
  if (years <= 0) return target - currentValue;
  const r = annualRate / 12;
  const n = years * 12;
  // remaining to accumulate via SIP after current value compounds
  const futureCurrent = currentValue * Math.pow(1 + annualRate, years);
  const gap = Math.max(0, target - futureCurrent);
  if (gap === 0) return 0;
  if (r <= 0) return gap / n;
  return gap / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

function inr(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.max(0, Math.round((d - Date.now()) / 86400000));
}

function GoalsPage() {
  const [goals, setGoals] = useLocalStorage<Goal[]>("dx_goals_v1", []);
  const { holdings } = usePortfolio();
  const [showForm, setShowForm] = useState(false);

  const linkedValue = (g: Goal): number => {
    if (!g.linkedHoldingIds.length) return 0;
    return holdings
      .filter((h) => g.linkedHoldingIds.includes(h.id))
      .reduce((s, h) => s + h.qty * h.avgCost, 0); // value at cost basis (no live price here)
  };

  const sorted = useMemo(() => [...goals].sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()), [goals]);

  return (
    <div className="dx-fade-in space-y-5">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Goal Planner</h1>
          <p className="text-xs text-muted-foreground font-mono">Plan, link, and track. Calculations use future-value-of-annuity math; for planning only — not advice.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="dx-pill cursor-pointer"><Plus className="h-3 w-3" /> New Goal</button>
      </header>

      {sorted.length === 0 && !showForm && (
        <div className="dx-glass p-8 text-center">
          <Target className="h-10 w-10 mx-auto text-primary/60" />
          <h2 className="font-semibold mt-3">No goals yet</h2>
          <p className="text-xs text-muted-foreground mt-1">Add your first goal — Dexter will show you the gap and required SIP.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 dx-pill cursor-pointer"><Plus className="h-3 w-3" /> Create Goal</button>
        </div>
      )}

      {showForm && <GoalForm onSave={(g) => { setGoals([...goals, g]); setShowForm(false); }} onCancel={() => setShowForm(false)} holdings={holdings} />}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((g) => {
          const current = linkedValue(g);
          const years = Math.max(0.1, (new Date(g.targetDate).getTime() - Date.now()) / (365.25 * 86400000));
          const projected = (current * Math.pow(1 + g.expectedReturn, years)) + fvAnnuity(g.monthlySip, g.expectedReturn, years);
          const pct = Math.max(0, Math.min(100, (projected / g.target) * 100));
          const shortfall = Math.max(0, g.target - projected);
          const req = requiredSip(g.target, current, g.expectedReturn, years);
          const cat = CATEGORIES.find((c) => c.key === g.category) ?? CATEGORIES[7];
          return (
            <div key={g.id} className="dx-glass p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl">{cat.icon}</div>
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{cat.label} · {daysUntil(g.targetDate)} days left</div>
                </div>
                <button onClick={() => setGoals(goals.filter((x) => x.id !== g.id))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Progress</span><span className="font-mono">{inr(projected)} / {inr(g.target)}</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-background/40 p-2"><div className="text-muted-foreground">Current SIP</div><div className="font-mono">{inr(g.monthlySip)}/mo</div></div>
                <div className="rounded bg-background/40 p-2"><div className="text-muted-foreground">Linked Value</div><div className="font-mono">{inr(current)}</div></div>
              </div>
              {shortfall > 0 ? (
                <div className="text-[11px] text-amber-400 rounded border border-amber-500/30 bg-amber-500/10 p-2">
                  Gap of <span className="font-mono">{inr(shortfall)}</span>. Increase SIP to <span className="font-mono">{inr(req)}/mo</span> to close it.
                </div>
              ) : (
                <div className="text-[11px] text-emerald-400 rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                  On pace. Projected surplus: {inr(projected - g.target)}.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Link to="/sip" className="text-[11px] text-primary hover:underline">Adjust SIP →</Link>
                <Link to="/optimizer" className="text-[11px] text-primary hover:underline">Optimize →</Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground italic">Projections use future-value-of-annuity math with constant expected return. Markets vary — results are for planning only, not investment advice.</p>
    </div>
  );
}

function GoalForm({ onSave, onCancel, holdings }: { onSave: (g: Goal) => void; onCancel: () => void; holdings: ReturnType<typeof usePortfolio>["holdings"] }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("retire");
  const [target, setTarget] = useState(1000000);
  const [date, setDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return d.toISOString().slice(0, 10); });
  const [sip, setSip] = useState(10000);
  const [er, setEr] = useState(12);
  const [linked, setLinked] = useState<string[]>([]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ id: crypto.randomUUID(), name, category, target, targetDate: date, monthlySip: sip, expectedReturn: er / 100, linkedHoldingIds: linked, createdAt: Date.now() }); }}
      className="dx-glass p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Goal name"><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Buy a flat in Bangalore" className="w-full px-2 py-1.5 rounded border border-border bg-background/40 text-sm" /></Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-2 py-1.5 rounded border border-border bg-background/40 text-sm">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
        </Field>
        <Field label="Target amount (₹)"><input type="number" min={10000} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full px-2 py-1.5 rounded border border-border bg-background/40 text-sm font-mono" /></Field>
        <Field label="Target date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-2 py-1.5 rounded border border-border bg-background/40 text-sm font-mono" /></Field>
        <Field label="Monthly SIP (₹)"><input type="number" min={0} value={sip} onChange={(e) => setSip(Number(e.target.value))} className="w-full px-2 py-1.5 rounded border border-border bg-background/40 text-sm font-mono" /></Field>
        <Field label="Expected return (% p.a.)"><input type="number" min={0} max={30} step={0.5} value={er} onChange={(e) => setEr(Number(e.target.value))} className="w-full px-2 py-1.5 rounded border border-border bg-background/40 text-sm font-mono" /></Field>
      </div>
      {holdings.length > 0 && (
        <Field label={`Link holdings (${linked.length} selected)`}>
          <div className="max-h-32 overflow-auto rounded border border-border bg-background/30 p-2 space-y-1">
            {holdings.map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-card/40 px-1 py-0.5 rounded">
                <input type="checkbox" checked={linked.includes(h.id)} onChange={(e) => { setLinked(e.target.checked ? [...linked, h.id] : linked.filter((x) => x !== h.id)); }} />
                <span className="font-mono">{h.symbol}</span>
                <span className="text-muted-foreground truncate">{h.name}</span>
              </label>
            ))}
          </div>
        </Field>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded border border-border">Cancel</button>
        <button type="submit" className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground font-semibold">Save Goal</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

// useEffect import used by other future hooks; silence unused warning
void useEffect;
