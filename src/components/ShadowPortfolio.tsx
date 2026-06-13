import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/formatINR";

interface Row { month: string; algo: number; user: number; whatif: number; event?: string; }

const BASE: Row[] = [
  { month: "Jan", algo: 1000000, user: 1000000, whatif: 1000000 },
  { month: "Feb", algo: 1082000, user: 1068000, whatif: 1082000 },
  { month: "Mar", algo: 1147000, user: 1134000, whatif: 1145000, event: "Override #1: Panic sold HDFC Bank · Cost ₹47,320 · Arousal 0.84" },
  { month: "Apr", algo: 1198000, user: 1089000, whatif: 1192000 },
  { month: "May", algo: 1261000, user: 1124000, whatif: 1248000, event: "Override #2: Sold ITC at low · Cost ₹38,910 · Arousal 0.79" },
  { month: "Jun", algo: 1318000, user: 1098000, whatif: 1308000 },
  { month: "Jul", algo: 1389000, user: 1143000, whatif: 1372000, event: "Override #3: Bought BTC top · Cost ₹52,800 · Arousal 0.91" },
  { month: "Aug", algo: 1442000, user: 1156000, whatif: 1428000 },
  { month: "Sep", algo: 1498000, user: 1189000, whatif: 1484000 },
  { month: "Oct", algo: 1521000, user: 1201000, whatif: 1509000 },
  { month: "Nov", algo: 1573000, user: 1223000, whatif: 1562000 },
  { month: "Dec", algo: 1621000, user: 1249000, whatif: 1612000 },
];

export function ShadowPortfolio() {
  const [showWhatIf, setShowWhatIf] = useState(false);
  const start = BASE[0].algo;
  const algoRet = ((BASE[BASE.length - 1].algo - start) / start) * 100;
  const userRet = ((BASE[BASE.length - 1].user - start) / start) * 100;
  const drag = BASE[BASE.length - 1].algo - BASE[BASE.length - 1].user;
  const whatIfRet = ((BASE[BASE.length - 1].whatif - start) / start) * 100;

  return (
    <div className="dx-glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-xl">Shadow Portfolio</h2>
          <p className="text-xs text-muted-foreground">Algorithm vs. your decisions · ₹10 L start · 2025</p>
        </div>
        <Button size="sm" variant={showWhatIf ? "default" : "outline"} onClick={() => setShowWhatIf((v) => !v)}>
          {showWhatIf ? "Hide" : "Show"} “What if?”
        </Button>
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={BASE} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis
              stroke="#64748b" tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1e5).toFixed(0)}L`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}
              formatter={(v: number, name) => [formatINR(v, { compact: true }), name]}
              labelFormatter={(label, payload) => {
                const ev = payload?.[0]?.payload?.event;
                return ev ? `${label} — ${ev}` : label;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="algo" name="Dexter Algorithm" stroke="#3b82f6" strokeWidth={2.5} dot={false} animationDuration={1500} />
            <Line type="monotone" dataKey="user" name="Your Decisions" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} animationDuration={1500} />
            {showWhatIf && (
              <Line type="monotone" dataKey="whatif" name="If you'd trusted Dexter" stroke="#22c55e" strokeWidth={2} dot={false} animationDuration={1200} />
            )}
            {BASE.filter((r) => r.event).map((r) => (
              <ReferenceLine key={r.month} x={r.month} stroke="#ef4444" strokeDasharray="3 3" />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat label="Algo" value={`+${algoRet.toFixed(1)}%`} color="#3b82f6" />
        <Stat label="You" value={`+${userRet.toFixed(1)}%`} color="#ef4444" />
        <Stat label="Drag" value={`-${formatINR(drag, { compact: true })}`} color="#f59e0b" />
      </div>
      {showWhatIf && (
        <div className="mt-3 text-center text-xs text-emerald-400 font-mono">
          Potential if all 3 overrides trusted: +{whatIfRet.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="dx-glass p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-base md:text-lg mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
