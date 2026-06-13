import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Line, Scatter, CartesianGrid,
} from "recharts";
import { useDexterState } from "@/hooks/useDexterState";

const POINTS = [
  { lambda: 1.0,  vol: 6.2,  ret: 7.8 },
  { lambda: 2.0,  vol: 8.4,  ret: 9.6 },
  { lambda: 3.0,  vol: 10.8, ret: 11.9 },
  { lambda: 4.0,  vol: 12.6, ret: 13.4 },
  { lambda: 5.0,  vol: 14.1, ret: 14.2 },
  { lambda: 6.0,  vol: 15.8, ret: 14.8 },
  { lambda: 8.0,  vol: 17.9, ret: 15.3 },
  { lambda: 10.0, vol: 20.2, ret: 15.6 },
];

function interp(lambda: number): { vol: number; ret: number } {
  const l = Math.max(POINTS[0].lambda, Math.min(POINTS[POINTS.length - 1].lambda, lambda));
  for (let i = 0; i < POINTS.length - 1; i++) {
    const a = POINTS[i], b = POINTS[i + 1];
    if (l >= a.lambda && l <= b.lambda) {
      const t = (l - a.lambda) / (b.lambda - a.lambda);
      return { vol: a.vol + (b.vol - a.vol) * t, ret: a.ret + (b.ret - a.ret) * t };
    }
  }
  return { vol: POINTS[0].vol, ret: POINTS[0].ret };
}

export function EfficientFrontier() {
  const lambda = useDexterState((s) => s.lambda);
  const cur = useMemo(() => interp(lambda), [lambda]);
  const sharpe = cur.ret / cur.vol;
  // Allocation shifts toward debt as lambda rises
  const equityPct = Math.max(20, Math.min(95, 100 - lambda * 7));
  const debtPct = 100 - equityPct;

  return (
    <div className="dx-glass p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base md:text-lg font-display">Efficient Frontier</h3>
        <span className="text-[10px] font-mono text-muted-foreground">Markowitz · live</span>
      </div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <ComposedChart data={POINTS} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="vol" type="number" domain={[5, 22]} stroke="#64748b" tick={{ fontSize: 10 }}
              label={{ value: "Volatility %", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
            <YAxis type="number" domain={[6, 17]} stroke="#64748b" tick={{ fontSize: 10 }}
              label={{ value: "Return %", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
            <Line type="monotone" dataKey="ret" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} isAnimationActive />
            <Scatter data={[{ vol: cur.vol, ret: cur.ret }]} fill="#f59e0b" shape="circle" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <Stat label="Expected Return" value={`${cur.ret.toFixed(1)}%`} />
        <Stat label="Volatility" value={`${cur.vol.toFixed(1)}%`} />
        <Stat label="Sharpe" value={sharpe.toFixed(2)} />
      </div>
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Allocation</div>
        <div className="flex h-3 rounded overflow-hidden">
          <div style={{ width: `${equityPct}%`, background: "#3b82f6", transition: "width 0.4s ease" }} title={`Equity ${equityPct.toFixed(0)}%`} />
          <div style={{ width: `${debtPct}%`, background: "#64748b", transition: "width 0.4s ease" }} title={`Debt ${debtPct.toFixed(0)}%`} />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
          <span>Equity {equityPct.toFixed(0)}%</span>
          <span>Debt {debtPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dx-glass p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-base" style={{ transition: "all 0.4s ease" }}>{value}</div>
    </div>
  );
}
