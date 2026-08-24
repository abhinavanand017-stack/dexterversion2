import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, ReferenceLine, Cell, Legend,
} from "recharts";
import type { Bar as OHLC, Point } from "@/lib/indices/metrics";

const UP = "#00ff88";
const DOWN = "#ff4466";
const ACCENT = "#00d4ff";
const GRID = "rgba(255,255,255,0.05)";
const TICK = { fontSize: 10, fill: "#94a3b8" };
const TOOLTIP = { background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)", fontSize: 12 };

const PEER_COLORS = ["#00d4ff", "#f5c451", "#a78bfa", "#34d399", "#fb7185", "#60a5fa", "#f97316"];
export const peerColor = (i: number) => PEER_COLORS[i % PEER_COLORS.length];

const dateFmt = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
const shortFmt = (t: number) => new Date(t).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export function ChartFrame({ title, note, height = 260, children }: { title: string; note?: React.ReactNode; height?: number; children: React.ReactElement }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</h3>
        {note}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function PriceChart({ bars, intraday }: { bars: OHLC[]; intraday?: boolean }) {
  const up = bars.length > 1 && bars[bars.length - 1].c >= bars[0].c;
  const color = up ? UP : DOWN;
  return (
    <AreaChart data={bars}>
      <defs>
        <linearGradient id="pxg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="t" tick={TICK} tickFormatter={intraday ? (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : shortFmt} minTickGap={40} />
      <YAxis domain={["auto", "auto"]} tick={TICK} width={62} tickFormatter={(v) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} />
      <Tooltip contentStyle={TOOLTIP} labelFormatter={(t) => dateFmt(t as number)} formatter={(v) => [Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }), "Level"]} />
      <Area dataKey="c" stroke={color} strokeWidth={2} fill="url(#pxg)" dot={false} isAnimationActive={false} />
    </AreaChart>
  );
}

export function RebasedChart({ rows, series }: { rows: Record<string, number | string>[]; series: { key: string; name: string }[] }) {
  return (
    <LineChart data={rows}>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="date" tick={TICK} minTickGap={50} tickFormatter={(d) => new Date(d as string).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })} />
      <YAxis tick={TICK} width={46} domain={["auto", "auto"]} />
      <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [Number(v).toFixed(1), n as string]} />
      <Legend wrapperStyle={{ fontSize: 10 }} />
      <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
      {series.map((s, i) => (
        <Line key={s.key} dataKey={s.key} name={s.name} stroke={peerColor(i)} strokeWidth={i === 0 ? 2.4 : 1.3} dot={false} isAnimationActive={false} connectNulls />
      ))}
    </LineChart>
  );
}

export function CalendarReturnsChart({ data }: { data: { year: number; pct: number }[] }) {
  return (
    <BarChart data={data}>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="year" tick={TICK} />
      <YAxis tick={TICK} width={46} tickFormatter={(v) => `${v}%`} />
      <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Return"]} />
      <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
      <Bar dataKey="pct" isAnimationActive={false}>
        {data.map((d) => <Cell key={d.year} fill={d.pct >= 0 ? UP : DOWN} />)}
      </Bar>
    </BarChart>
  );
}

export function DrawdownChart({ series }: { series: Point[] }) {
  return (
    <AreaChart data={series}>
      <defs>
        <linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={DOWN} stopOpacity={0} />
          <stop offset="100%" stopColor={DOWN} stopOpacity={0.4} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="t" tick={TICK} tickFormatter={shortFmt} minTickGap={40} />
      <YAxis tick={TICK} width={46} tickFormatter={(v) => `${v}%`} />
      <Tooltip contentStyle={TOOLTIP} labelFormatter={(t) => dateFmt(t as number)} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Drawdown"]} />
      <Area dataKey="v" stroke={DOWN} strokeWidth={1.2} fill="url(#ddg)" dot={false} isAnimationActive={false} />
    </AreaChart>
  );
}

export function VolatilityChart({ series }: { series: { t: number; v30?: number; v90?: number; v365?: number }[] }) {
  return (
    <LineChart data={series}>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="t" tick={TICK} tickFormatter={shortFmt} minTickGap={40} />
      <YAxis tick={TICK} width={46} tickFormatter={(v) => `${v}%`} />
      <Tooltip contentStyle={TOOLTIP} labelFormatter={(t) => dateFmt(t as number)} formatter={(v, n) => [`${Number(v).toFixed(1)}%`, n as string]} />
      <Legend wrapperStyle={{ fontSize: 10 }} />
      <Line dataKey="v30" name="30d" stroke={ACCENT} strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls />
      <Line dataKey="v90" name="90d" stroke="#f5c451" strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls />
      <Line dataKey="v365" name="365d" stroke="#a78bfa" strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls />
    </LineChart>
  );
}

export function PeBandChart({ series, mean, upper, lower }: { series: Point[]; mean: number; upper: number; lower: number }) {
  const data = series.map((s) => ({ ...s, upper, lower, mean }));
  return (
    <LineChart data={data}>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="t" tick={TICK} tickFormatter={shortFmt} minTickGap={40} />
      <YAxis tick={TICK} width={46} domain={["auto", "auto"]} />
      <Tooltip contentStyle={TOOLTIP} labelFormatter={(t) => dateFmt(t as number)} formatter={(v, n) => [Number(v).toFixed(2), n as string]} />
      <Line dataKey="upper" name="+1σ" stroke="#ff4466" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />
      <Line dataKey="mean" name="Mean" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />
      <Line dataKey="lower" name="-1σ" stroke="#00ff88" strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} />
      <Line dataKey="v" name="P/E" stroke={ACCENT} strokeWidth={2} dot={false} isAnimationActive={false} />
      <Legend wrapperStyle={{ fontSize: 10 }} />
    </LineChart>
  );
}

export function ScenarioChart({ data }: { data: { name: string; target: number; prob: number }[] }) {
  return (
    <BarChart data={data}>
      <CartesianGrid stroke={GRID} />
      <XAxis dataKey="name" tick={TICK} />
      <YAxis tick={TICK} width={62} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} />
      <Tooltip contentStyle={TOOLTIP} formatter={(v, n, p) => [`${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${(p.payload as { prob: number }).prob}% prob)`, "Target"]} />
      <Bar dataKey="target" isAnimationActive={false}>
        {data.map((d) => <Cell key={d.name} fill={d.name === "Bull" ? UP : d.name === "Bear" ? DOWN : ACCENT} />)}
      </Bar>
    </BarChart>
  );
}

/** Correlation matrix heatmap (plain grid — no chart lib needed). */
export function CorrelationHeatmap({ labels, matrix }: { labels: string[]; matrix: (number | null)[][] }) {
  const cellColor = (v: number | null) => {
    if (v == null) return "rgba(255,255,255,0.04)";
    const a = Math.min(1, Math.abs(v));
    return v >= 0 ? `rgba(0,212,255,${0.12 + a * 0.55})` : `rgba(255,68,102,${0.12 + a * 0.55})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] font-mono border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th />
            {labels.map((l) => (
              <th key={l} className="px-1 py-1 text-muted-foreground font-normal whitespace-nowrap align-bottom">
                <span className="inline-block [writing-mode:vertical-rl] rotate-180">{l}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((row, i) => (
            <tr key={row}>
              <td className="pr-2 text-muted-foreground whitespace-nowrap">{row}</td>
              {labels.map((_, j) => (
                <td key={j} className="w-10 h-8 text-center rounded" style={{ background: cellColor(matrix[i]?.[j] ?? null) }}>
                  {matrix[i]?.[j] == null ? "–" : matrix[i][j]!.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sector treemap-style grid: tile area from weight, color from day change. */
export function SectorTreemap({ tiles }: { tiles: { name: string; weight: number; pct: number }[] }) {
  const total = tiles.reduce((a, b) => a + b.weight, 0) || 1;
  return (
    <div className="flex flex-wrap gap-1">
      {tiles.map((t) => {
        const share = t.weight / total;
        const a = Math.min(1, Math.abs(t.pct) / 2.5);
        const bg = t.pct >= 0 ? `rgba(0,255,136,${0.1 + a * 0.5})` : `rgba(255,68,102,${0.1 + a * 0.5})`;
        return (
          <div
            key={t.name}
            title={`${t.name}: ${t.pct.toFixed(2)}%`}
            className="rounded border border-white/5 p-2 min-w-[110px] flex flex-col justify-between"
            style={{ background: bg, flexGrow: share * 100, height: 64 + share * 90 }}
          >
            <div className="text-[10px] leading-tight font-medium truncate">{t.name}</div>
            <div className="text-xs font-mono">{t.pct >= 0 ? "+" : ""}{t.pct.toFixed(2)}%</div>
          </div>
        );
      })}
    </div>
  );
}
