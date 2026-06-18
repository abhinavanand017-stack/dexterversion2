import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { NIFTY500 } from "@/lib/nifty500";
import { Trophy, Flame, Brain } from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [
    { title: "Community & Leaderboard — DEXTER" },
    { name: "description", content: "Demo-mode community insights: where your Dexter Score lands, what stocks the crowd is forecasting, and which models score best for you." },
  ] }),
  component: CommunityPage,
});

// Bell-curve distribution of demo Dexter scores (mean 62, sd 14)
function buildDistribution(): Array<{ score: number; users: number }> {
  const out: Array<{ score: number; users: number }> = [];
  for (let s = 0; s <= 100; s += 5) {
    const z = (s - 62) / 14;
    const y = Math.exp(-(z * z) / 2);
    out.push({ score: s, users: Math.round(y * 1000) });
  }
  return out;
}

// Synthetic "most forecasted this week" leaderboard from the Nifty 500 universe.
function trendingStocks() {
  const picks = NIFTY500.slice(0, 80);
  return picks.map((s, i) => {
    let h = 0; for (const c of s.symbol) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const runs = 1500 - i * 12 + (h % 200);
    return { symbol: s.symbol, name: s.name, sector: s.sector, runs };
  }).sort((a, b) => b.runs - a.runs).slice(0, 12);
}

interface ForecastHistoryEntry {
  modelId: string;
  modelName: string;
  errorPct: number;     // absolute MAPE-style error from realized vs forecast
}

function CommunityPage() {
  // pretend user has a Dexter Score stored in localStorage (default 72)
  const [score] = useLocalStorage<number>("dx_score_v1", 72);
  const [history] = useLocalStorage<ForecastHistoryEntry[]>("dx_forecast_history_v1", []);
  const dist = useMemo(() => buildDistribution(), []);
  const trending = useMemo(() => trendingStocks(), []);

  // percentile rank
  const totalUsers = dist.reduce((s, d) => s + d.users, 0);
  const below = dist.filter((d) => d.score < score).reduce((s, d) => s + d.users, 0);
  const percentile = Math.round((below / totalUsers) * 100);

  // user's most-accurate model from local history
  const modelStats = useMemo(() => {
    const byModel = new Map<string, { name: string; total: number; count: number }>();
    for (const e of history) {
      const cur = byModel.get(e.modelId) ?? { name: e.modelName, total: 0, count: 0 };
      cur.total += e.errorPct; cur.count += 1;
      byModel.set(e.modelId, cur);
    }
    return Array.from(byModel.entries())
      .map(([id, v]) => ({ id, name: v.name, mape: v.total / v.count, runs: v.count }))
      .sort((a, b) => a.mape - b.mape);
  }, [history]);

  return (
    <div className="dx-fade-in space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight dx-grad-text">Community & Leaderboard</h1>
        <p className="text-xs text-muted-foreground font-mono">Anonymized demo benchmarks · your data never leaves the device</p>
      </header>

      {/* Score percentile */}
      <div className="dx-glass p-5 grid lg:grid-cols-[1fr_2fr] gap-5 items-center">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Dexter Score</div>
          <div className="text-6xl font-display dx-grad-text my-2">{score}</div>
          <div className="dx-pill"><Trophy className="h-3 w-3" /> Top {100 - percentile}%</div>
          <div className="text-[11px] text-muted-foreground mt-2">Beats {percentile}% of demo users</div>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={dist}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="score" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(0,212,255,0.3)", fontSize: 11 }} />
              <Bar dataKey="users" fill="rgba(0,212,255,0.5)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trending forecasts */}
      <div className="dx-glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-amber-400" />
          <h2 className="font-semibold">Most-Forecasted Nifty 500 Stocks This Week</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {trending.map((t, i) => (
            <div key={t.symbol} className="rounded border border-border bg-background/40 p-2 flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-mono font-semibold truncate">{t.symbol}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.sector}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-emerald-400">{t.runs.toLocaleString("en-IN")}</div>
                <div className="text-[9px] text-muted-foreground">runs</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personal model leaderboard */}
      <div className="dx-glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Your Model Accuracy Leaderboard</h2>
        </div>
        {modelStats.length === 0
          ? <p className="text-xs text-muted-foreground">Run a few forecasts on the Forecaster page — once we have realized prices to compare against, your most-accurate models will appear here.</p>
          : (
            <div className="space-y-1">
              {modelStats.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 text-xs border-t border-border py-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="flex-1 font-mono">{m.name}</span>
                  <span className="text-muted-foreground">{m.runs} forecasts</span>
                  <span className="font-mono text-emerald-400">MAPE {m.mape.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
      </div>

      <p className="text-[10px] text-muted-foreground italic">Community data is simulated for demonstration. No personal portfolio or biometric data is transmitted from your device.</p>

      <BellCurveContext />
    </div>
  );
}

// inert helper so Recharts treeshake doesn't drop LineChart import
function BellCurveContext() {
  return <div className="hidden"><ResponsiveContainer><LineChart data={[]}><Line dataKey="v" /></LineChart></ResponsiveContainer></div>;
}
