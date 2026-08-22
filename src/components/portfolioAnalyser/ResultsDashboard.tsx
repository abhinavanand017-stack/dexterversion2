import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { SourceBadge } from "./SourceBadge";
import { formatINR } from "@/lib/formatINR";
import type { AnalysisResult, EnrichedHolding, HoldingAnalysis, RiskLevel } from "@/lib/portfolioAnalyser/types";
import { RISK_CATEGORIES } from "@/lib/portfolioAnalyser/types";
import {
  assetAllocation, sectorConcentration, capConcentration, positionConcentration, diversificationScore,
} from "@/lib/portfolioAnalyser/stats";

const COLORS = ["#f5c451", "#4f8cff", "#3ddc97", "#c77dff", "#ff7d7d", "#22d3ee", "#a3e635", "#f472b6"];
const TABS = ["overview", "holdings", "risk", "scenarios"] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview", holdings: "Holdings", risk: "Risk Matrix", scenarios: "Scenarios",
};

const LEVEL_SCORE: Record<RiskLevel, number> = { Low: 1, Med: 2, High: 3 };

function riskCellClass(l?: RiskLevel, i?: RiskLevel): string {
  if (!l || !i) return "bg-muted/20 text-muted-foreground";
  const s = LEVEL_SCORE[l] * LEVEL_SCORE[i];
  if (s >= 6) return "bg-rose-500/25 text-rose-200 border-rose-500/40";
  if (s >= 3) return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
}

function verdictClass(v: string): string {
  if (v === "Add") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (v === "Trim") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (v === "Watch") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-primary/15 text-primary border-primary/40";
}

interface Props {
  result: AnalysisResult;
  rows: EnrichedHolding[];
}

export function ResultsDashboard({ result, rows }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const byKey = new Map<string, HoldingAnalysis>();
  for (const h of result.holdings) byKey.set(h.symbol.toUpperCase(), h);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-mono ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview result={result} rows={rows} />}
      {tab === "holdings" && <Holdings rows={rows} byKey={byKey} />}
      {tab === "risk" && <RiskMatrix rows={rows} byKey={byKey} />}
      {tab === "scenarios" && <Scenarios result={result} rows={rows} byKey={byKey} />}
    </div>
  );
}

function Overview({ result, rows }: Props) {
  const alloc = assetAllocation(rows);
  const sectors = sectorConcentration(rows);
  const caps = capConcentration(rows);
  const positions = positionConcentration(rows);
  const div = diversificationScore(rows);
  const p = result.portfolio;
  const flagged = [...positions.filter((x) => x.flagged), ...sectors.filter((x) => x.flagged)];

  return (
    <div className="space-y-4">
      <section className="dx-glass border-l-4 border-primary p-4 md:p-6">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Working thesis</div>
        <p className="mt-1 text-lg font-semibold leading-snug">{p.thesis}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {([["Situation", p.situation], ["Complication", p.complication], ["Resolution", p.resolution]] as const).map(([k, v]) => (
            <div key={k} className="rounded border border-border bg-card/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
              <p className="mt-1 text-sm">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="dx-glass p-4">
          <h3 className="mb-2 text-sm font-semibold">Asset Allocation</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={alloc} dataKey="value" nameKey="label" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {alloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "#0a0a1a", border: "1px solid #333" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dx-glass p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Diversification Score</h3>
            <span className="font-mono text-3xl font-bold text-primary">{div.score}<span className="text-sm text-muted-foreground">/100</span></span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{div.drag}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.diversificationNote}</p>
          <div className="mt-3 space-y-1">
            {sectors.slice(0, 6).map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 truncate">{s.name}</span>
                <div className="h-2 flex-1 rounded bg-muted/30">
                  <div className={`h-full rounded ${s.flagged ? "bg-rose-400" : "bg-primary"}`} style={{ width: `${Math.min(100, s.pct)}%` }} />
                </div>
                <span className="w-12 text-right font-mono">{s.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="dx-glass p-4">
          <h3 className="mb-2 text-sm font-semibold">Concentration — flagged</h3>
          {flagged.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing breaches the 15% single-position / 30% single-sector thresholds.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {flagged.map((f) => (
                <li key={f.name} className="flex items-center justify-between rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1">
                  <span className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-rose-400" />{f.name}</span>
                  <span className="font-mono text-rose-300">{f.pct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          )}
          <h4 className="mt-3 mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">By market cap</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {caps.map((c) => (
              <span key={c.name} className="dx-pill">{c.name} · {c.pct.toFixed(1)}%</span>
            ))}
          </div>
        </section>

        <section className="dx-glass p-4">
          <h3 className="mb-2 text-sm font-semibold">Look-through Overlap</h3>
          {(!p.overlaps || p.overlaps.length === 0) ? (
            <p className="text-xs text-muted-foreground">No material duplicated underlying exposure detected across direct holdings and pooled vehicles.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 text-left">Underlying</th>
                  <th className="py-1 text-right">Direct</th>
                  <th className="py-1 text-right">Via funds</th>
                  <th className="py-1 text-right">True total</th>
                </tr>
              </thead>
              <tbody>
                {p.overlaps.map((o) => (
                  <tr key={o.underlying} className="border-b border-border/40">
                    <td className="py-1">{o.underlying}<div className="text-[11px] text-muted-foreground">{o.note}</div></td>
                    <td className="py-1 text-right font-mono">{o.directPct?.toFixed(1)}%</td>
                    <td className="py-1 text-right font-mono">{o.viaFundsPct?.toFixed(1)}%</td>
                    <td className="py-1 text-right font-mono text-primary">{o.totalPct?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Overlap is inferred from fund mandates, not published factsheet holdings <SourceBadge source="reference" title="Inferred, not from a live holdings feed" />
          </p>
        </section>
      </div>

      <section className="dx-glass p-4">
        <h3 className="mb-2 text-sm font-semibold">Portfolio Bull / Base / Bear (12-month)</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <RollupCard label="Bull" pct={p.rollup?.bullPct} tone="up" />
          <RollupCard label="Base" pct={p.rollup?.basePct} />
          <RollupCard label="Bear" pct={p.rollup?.bearPct} tone="down" />
          <RollupCard label="Probability-weighted" pct={p.rollup?.expectedPct} tone={(p.rollup?.expectedPct ?? 0) >= 0 ? "up" : "down"} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{p.rollup?.note}</p>
      </section>

      <section className="dx-glass border-l-4 border-rose-500 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
          <AlertTriangle className="h-4 w-4" /> The one risk that matters: {p.topRisk?.risk}
        </div>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {p.topRisk?.mitigant}
        </p>
      </section>
    </div>
  );
}

function RollupCard({ label, pct, tone }: { label: string; pct?: number; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded border border-border bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-bold ${color}`}>
        {pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
      </div>
    </div>
  );
}

function Holdings({ rows, byKey }: { rows: EnrichedHolding[]; byKey: Map<string, HoldingAnalysis> }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-2">
      {rows.map((h) => {
        const a = byKey.get(h.symbol.toUpperCase());
        const isOpen = !!open[h.id];
        return (
          <div key={h.id} className="dx-glass overflow-hidden">
            <button onClick={() => setOpen((p) => ({ ...p, [h.id]: !p[h.id] }))}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/20">
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{h.name || h.symbol}</div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono uppercase">{h.kind}</span> · {formatINR(h.value)} · {h.weight.toFixed(1)}% of book
                  <SourceBadge source={h.priceSource} />
                </div>
              </div>
              {a && <span className={`rounded border px-2 py-0.5 font-mono text-xs ${verdictClass(a.verdict)}`}>{a.verdict}</span>}
            </button>

            {isOpen && (
              <div className="space-y-3 border-t border-border p-4">
                {!a ? (
                  <p className="text-sm text-muted-foreground">No analysis was returned for this holding.</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">{a.verdictLine}</p>

                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Valuation cross-check — {a.valuation?.method}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-mono">Low {a.valuation?.low != null ? formatINR(a.valuation.low) : "—"}</span>
                        <span className="font-mono text-primary">Base {a.valuation?.base != null ? formatINR(a.valuation.base) : "—"}</span>
                        <span className="font-mono">High {a.valuation?.high != null ? formatINR(a.valuation.high) : "—"}</span>
                        <span className="text-xs text-muted-foreground">vs live {formatINR(h.price)}</span>
                        <SourceBadge source={h.priceSource} />
                      </div>
                      <FootballField low={a.valuation?.low} base={a.valuation?.base} high={a.valuation?.high} current={h.price} />
                      <p className="mt-1 text-xs text-muted-foreground">{a.valuation?.note}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                            <th className="py-1 text-left">12M Scenario</th>
                            <th className="py-1 text-right">Return</th>
                            <th className="py-1 text-right">Target</th>
                            <th className="py-1 text-right">Prob.</th>
                            <th className="py-1 text-left">Trigger</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(a.scenarios ?? []).map((s) => (
                            <tr key={s.case} className="border-b border-border/40">
                              <td className="py-1 font-medium">{s.case}</td>
                              <td className={`py-1 text-right font-mono ${s.returnPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {s.returnPct > 0 ? "+" : ""}{s.returnPct?.toFixed(1)}%
                              </td>
                              <td className="py-1 text-right font-mono">{s.targetPrice ? formatINR(s.targetPrice) : "—"}</td>
                              <td className="py-1 text-right font-mono">{s.probability}%</td>
                              <td className="py-1 text-xs text-muted-foreground">{s.trigger}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
                      {(a.risks ?? []).map((r) => (
                        <div key={r.category} className={`rounded border p-2 text-xs ${riskCellClass(r.likelihood, r.impact)}`}>
                          <div className="font-semibold">{r.category}</div>
                          <div className="font-mono text-[10px] opacity-80">L {r.likelihood} · I {r.impact}</div>
                          <div className="mt-0.5 opacity-90">{r.note}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded border-l-4 border-rose-500 bg-rose-500/5 p-2 text-sm">
                      <span className="font-semibold text-rose-300">Killer risk: </span>{a.killerRisk?.risk}
                      <div className="mt-0.5 text-xs text-muted-foreground">Mitigant — {a.killerRisk?.mitigant}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FootballField({ low, base, high, current }: { low?: number | null; base?: number | null; high?: number | null; current: number }) {
  if (low == null || high == null || high <= low) return null;
  const min = Math.min(low, current) * 0.95;
  const max = Math.max(high, current) * 1.05;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative mt-2 h-6">
      <div className="absolute top-2.5 h-1 w-full rounded bg-muted/30" />
      <div className="absolute top-2 h-2 rounded bg-primary/40"
        style={{ left: `${pos(low)}%`, width: `${pos(high) - pos(low)}%` }} />
      {base != null && <div className="absolute top-1 h-4 w-0.5 bg-primary" style={{ left: `${pos(base)}%` }} />}
      <div className="absolute top-0 h-6 w-0.5 bg-emerald-400" style={{ left: `${pos(current)}%` }} title="Current price" />
    </div>
  );
}

function RiskMatrix({ rows, byKey }: { rows: EnrichedHolding[]; byKey: Map<string, HoldingAnalysis> }) {
  return (
    <div className="dx-glass overflow-x-auto p-4">
      <h3 className="mb-2 text-sm font-semibold">Risk heat-map — Likelihood × Impact</h3>
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr>
            <th className="py-1 text-left text-[10px] uppercase tracking-wide text-muted-foreground">Holding</th>
            {RISK_CATEGORIES.map((c) => (
              <th key={c} className="px-1 py-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const a = byKey.get(h.symbol.toUpperCase());
            return (
              <tr key={h.id}>
                <td className="max-w-[180px] truncate py-1 pr-2 font-medium">{h.name || h.symbol}</td>
                {RISK_CATEGORIES.map((cat) => {
                  const r = a?.risks?.find((x) => x.category?.toLowerCase().startsWith(cat.split(" ")[0].toLowerCase()));
                  return (
                    <td key={cat} className="p-0.5">
                      <div title={r?.note ?? "No data"}
                        className={`rounded border px-1 py-2 text-center font-mono text-[10px] ${riskCellClass(r?.likelihood, r?.impact)}`}>
                        {r ? `${r.likelihood}/${r.impact}` : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
        <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5">Low exposure</span>
        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5">Watch</span>
        <span className="rounded border border-rose-500/40 bg-rose-500/25 px-2 py-0.5">Severe</span>
      </div>
    </div>
  );
}

function Scenarios({ result, rows, byKey }: { result: AnalysisResult; rows: EnrichedHolding[]; byKey: Map<string, HoldingAnalysis> }) {
  const data = rows.map((h) => {
    const a = byKey.get(h.symbol.toUpperCase());
    const get = (c: string) => a?.scenarios?.find((s) => s.case === c)?.returnPct ?? 0;
    const w = h.weight / 100;
    return {
      name: (h.name || h.symbol).slice(0, 16),
      Bull: +(get("Bull") * w).toFixed(2),
      Base: +(get("Base") * w).toFixed(2),
      Bear: +(get("Bear") * w).toFixed(2),
    };
  });
  const p = result.portfolio.rollup;

  return (
    <div className="space-y-4">
      <section className="dx-glass p-4">
        <h3 className="mb-1 text-sm font-semibold">Portfolio scenario roll-up</h3>
        <p className="mb-3 text-xs text-muted-foreground">{p?.note}</p>
        <div className="grid gap-3 md:grid-cols-4">
          <RollupCard label="Bull" pct={p?.bullPct} tone="up" />
          <RollupCard label="Base" pct={p?.basePct} />
          <RollupCard label="Bear" pct={p?.bearPct} tone="down" />
          <RollupCard label="Expected" pct={p?.expectedPct} tone={(p?.expectedPct ?? 0) >= 0 ? "up" : "down"} />
        </div>
      </section>

      <section className="dx-glass p-4">
        <h3 className="mb-2 text-sm font-semibold">Weighted contribution by holding (pp of portfolio return)</h3>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 10 }} height={70} />
              <YAxis tick={{ fontSize: 10 }} unit="pp" />
              <Tooltip contentStyle={{ background: "#0a0a1a", border: "1px solid #333" }} />
              <Legend />
              <Bar dataKey="Bear" fill="#ff7d7d" />
              <Bar dataKey="Base" fill="#4f8cff" />
              <Bar dataKey="Bull" fill="#3ddc97" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
