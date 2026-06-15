import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/sip")({
  head: () => ({
    meta: [
      { title: "SIP Calculator — DEXTER" },
      { name: "description", content: "Calculate SIP returns, lumpsum growth, goal-based investing, and inflation-adjusted corpus for Indian mutual funds." },
    ],
  }),
  component: SIPPage,
});

const TABS = ["SIP", "Lumpsum", "Goal", "Inflation", "XIRR"] as const;
type Tab = typeof TABS[number];

function SIPPage() {
  const [tab, setTab] = useState<Tab>("SIP");
  return (
    <div className="dx-fade-in space-y-4 pb-20">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Investment Calculator</h1>
        <p className="text-xs text-muted-foreground font-mono">Plan SIPs, lumpsum, goal-based investing & XIRR</p>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={"px-4 py-2 text-sm border-b-2 " + (tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>
      {tab === "SIP" && <SIPCalc />}
      {tab === "Lumpsum" && <LumpsumCalc />}
      {tab === "Goal" && <GoalCalc />}
      {tab === "Inflation" && <InflationCalc />}
      {tab === "XIRR" && <XIRRCalc />}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, unit }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="font-mono text-primary">{unit === "₹" ? `₹${value.toLocaleString("en-IN")}` : `${value}${unit ?? ""}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="dx-glass p-4 rounded-lg">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function SIPCalc() {
  const [monthly, setMonthly] = useState(10000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);
  const months = years * 12;
  const r = rate / 100 / 12;
  const fv = monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  const invested = monthly * months;
  const gain = fv - invested;
  const pieData = [
    { name: "Invested", value: invested },
    { name: "Gains", value: gain },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="dx-glass p-5 rounded-xl space-y-4">
        <Slider label="Monthly SIP" value={monthly} min={500} max={200000} step={500} onChange={setMonthly} unit="₹" />
        <Slider label="Duration (years)" value={years} min={1} max={40} onChange={setYears} unit="y" />
        <Slider label="Expected Return" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Invested" value={`₹${(invested / 100000).toFixed(1)}L`} />
          <StatCard label="Gains" value={`₹${(gain / 100000).toFixed(1)}L`} color="var(--bull)" />
          <StatCard label="Corpus" value={`₹${(fv / 100000).toFixed(1)}L`} color="var(--primary)" />
        </div>
        <div className="dx-glass p-4 rounded-xl">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={60} outerRadius={90} label={(d) => d.name}>
                <Cell fill="var(--muted)" />
                <Cell fill="var(--bull)" />
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function LumpsumCalc() {
  const [amount, setAmount] = useState(100000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);
  const fv = amount * Math.pow(1 + rate / 100, years);
  const gain = fv - amount;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="dx-glass p-5 rounded-xl space-y-4">
        <Slider label="Investment Amount" value={amount} min={1000} max={10000000} step={1000} onChange={setAmount} unit="₹" />
        <Slider label="Duration (years)" value={years} min={1} max={40} onChange={setYears} unit="y" />
        <Slider label="Expected Return" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Invested" value={`₹${(amount / 100000).toFixed(2)}L`} />
        <StatCard label="Gains" value={`₹${(gain / 100000).toFixed(2)}L`} color="var(--bull)" />
        <StatCard label="Final" value={`₹${(fv / 100000).toFixed(2)}L`} color="var(--primary)" />
      </div>
    </div>
  );
}

function GoalCalc() {
  const goals = ["🏠 Home", "🎓 Education", "🚗 Car", "💍 Wedding", "🌴 Retirement", "✈️ Travel"];
  const [goal, setGoal] = useState(goals[0]);
  const [target, setTarget] = useState(5000000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);
  const months = years * 12;
  const r = rate / 100 / 12;
  const monthly = (target * r) / ((Math.pow(1 + r, months) - 1) * (1 + r));
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="dx-glass p-5 rounded-xl space-y-4">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Goal</div>
          <div className="flex flex-wrap gap-2">{goals.map((g) => (
            <button key={g} onClick={() => setGoal(g)} className={"px-3 py-1.5 rounded-full border text-xs " + (goal === g ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card/40")}>{g}</button>
          ))}</div>
        </div>
        <Slider label="Target Amount" value={target} min={100000} max={100000000} step={100000} onChange={setTarget} unit="₹" />
        <Slider label="Horizon (years)" value={years} min={1} max={40} onChange={setYears} unit="y" />
        <Slider label="Expected Return" value={rate} min={1} max={30} step={0.5} onChange={setRate} unit="%" />
      </div>
      <div className="space-y-3">
        <StatCard label="Required Monthly SIP" value={`₹${Math.round(monthly).toLocaleString("en-IN")}`} color="var(--primary)" />
        <div className="dx-glass p-4 rounded-xl text-sm text-muted-foreground">
          To reach <span className="text-foreground font-semibold">₹{(target / 100000).toFixed(0)}L</span> for your <span className="text-foreground font-semibold">{goal}</span> goal in {years} years at {rate}% p.a., invest <span className="text-primary font-mono">₹{Math.round(monthly).toLocaleString("en-IN")}/month</span>.
        </div>
      </div>
    </div>
  );
}

function InflationCalc() {
  const [amount, setAmount] = useState(1000000);
  const [years, setYears] = useState(10);
  const [inflation, setInflation] = useState(6);
  const realValue = amount / Math.pow(1 + inflation / 100, years);
  const erosion = amount - realValue;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="dx-glass p-5 rounded-xl space-y-4">
        <Slider label="Today's Amount" value={amount} min={10000} max={50000000} step={10000} onChange={setAmount} unit="₹" />
        <Slider label="Years" value={years} min={1} max={40} onChange={setYears} unit="y" />
        <Slider label="Inflation" value={inflation} min={1} max={15} step={0.5} onChange={setInflation} unit="%" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Real Value in Future" value={`₹${(realValue / 100000).toFixed(2)}L`} color="var(--bull)" />
        <StatCard label="Purchasing Power Lost" value={`₹${(erosion / 100000).toFixed(2)}L`} color="var(--bear)" />
      </div>
    </div>
  );
}

function XIRRCalc() {
  const [rows, setRows] = useState([
    { date: "2023-01-01", amount: -100000 },
    { date: "2024-01-01", amount: -50000 },
    { date: "2026-06-15", amount: 200000 },
  ]);
  const xirr = useMemo(() => {
    // Newton-Raphson XIRR
    const f = (rate: number) => rows.reduce((acc, r) => {
      const t = (new Date(r.date).getTime() - new Date(rows[0].date).getTime()) / (365 * 86400000);
      return acc + r.amount / Math.pow(1 + rate, t);
    }, 0);
    let rate = 0.1;
    for (let i = 0; i < 60; i++) {
      const v = f(rate);
      const dv = (f(rate + 1e-5) - v) / 1e-5;
      if (Math.abs(dv) < 1e-12) break;
      rate -= v / dv;
      if (rate < -0.99) rate = -0.5;
    }
    return rate * 100;
  }, [rows]);
  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-4">
      <div className="dx-glass p-5 rounded-xl">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cashflows (− invested, + received)</div>
        <table className="w-full text-sm">
          <thead><tr className="text-muted-foreground text-[10px] uppercase"><th className="text-left">Date</th><th className="text-right">Amount (₹)</th><th></th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="py-1"><input type="date" value={r.date} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} className="bg-transparent border border-border rounded px-2 py-0.5 text-xs" /></td>
              <td className="py-1 text-right"><input type="number" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} className="bg-transparent border border-border rounded px-2 py-0.5 text-right font-mono w-32 text-xs" /></td>
              <td className="py-1 pl-2"><button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-red-400">×</button></td>
            </tr>
          ))}</tbody>
        </table>
        <button onClick={() => setRows([...rows, { date: new Date().toISOString().slice(0, 10), amount: 0 }])} className="mt-3 dx-pill cursor-pointer">+ Add row</button>
      </div>
      <StatCard label="XIRR" value={`${xirr.toFixed(2)}%`} color="var(--primary)" />
    </div>
  );
}
