import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatINR } from "@/lib/formatINR";

interface Props { defaultCAGR: number; label?: string; }

export function CompoundingSandbox({ defaultCAGR, label }: Props) {
  const [capital, setCapital] = useState(100000);
  const [sip, setSip] = useState(10000);
  const [years, setYears] = useState(20);
  const [cagr, setCagr] = useState(Math.max(4, Math.round(defaultCAGR)));

  const { data, final } = useMemo(() => {
    const r = cagr / 100;
    const monthly = r / 12;
    let bal = capital;
    const pts: Array<{ year: number; value: number }> = [{ year: 0, value: bal }];
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) bal = bal * (1 + monthly) + sip;
      pts.push({ year: y, value: Math.round(bal) });
    }
    return { data: pts, final: Math.round(bal) };
  }, [capital, sip, years, cagr]);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
          Compounding Sandbox {label ? `· ${label}` : ""}
        </div>
        <div className="text-xs text-muted-foreground">Educational only</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
        <label className="space-y-1">
          <div className="text-muted-foreground">Starting ₹</div>
          <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value || 0)}
            className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" />
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">Monthly SIP ₹</div>
          <input type="number" value={sip} onChange={(e) => setSip(+e.target.value || 0)}
            className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" />
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">Years</div>
          <input type="number" value={years} min={1} max={50}
            onChange={(e) => setYears(Math.min(50, Math.max(1, +e.target.value || 1)))}
            className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" />
        </label>
        <label className="space-y-1">
          <div className="text-muted-foreground">CAGR %</div>
          <input type="number" value={cagr} min={0} max={50}
            onChange={(e) => setCagr(Math.min(50, Math.max(0, +e.target.value || 0)))}
            className="w-full bg-background/60 border border-border/60 rounded px-2 py-1 font-mono" />
        </label>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${(v / 1e5).toFixed(0)}L`} />
            <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", fontSize: 12 }}
              formatter={(v: number) => formatINR(v)} />
            <Line type="monotone" dataKey="value" stroke="#00d4ff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 text-sm">
        In <span className="font-mono text-primary">{years}</span> years this becomes{" "}
        <span className="font-mono text-[color:var(--primary)] font-semibold">{formatINR(final)}</span>.
      </div>
    </div>
  );
}
