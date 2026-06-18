// Lightweight Markowitz utilities — runs entirely in the browser.
// Uses random-search over the constrained simplex to find optima under
// arbitrary box constraints + sector caps + locked weights. This is good
// enough for a UI demo and avoids pulling in a QP solver.

export type ObjectiveKind =
  | "maxSharpe"
  | "minVol"
  | "maxReturnAtRisk"
  | "minRiskAtReturn"
  | "riskParity";

export interface OptimizerInput {
  symbols: string[];
  expReturns: number[];       // annualised, decimal
  vols: number[];             // annualised stddev, decimal
  correlations?: number[][];  // n x n; default identity
  weightBounds?: Array<{ min: number; max: number }>; // per-asset, decimal
  lockedWeights?: Record<number, number>;             // index -> weight to freeze
  sectors?: string[];                                  // per-asset sector
  sectorCaps?: Record<string, number>;                 // sector -> max weight
  riskFreeRate?: number;       // annualised decimal, default 0.07
}

export interface OptimResult {
  weights: number[];
  expReturn: number;
  vol: number;
  sharpe: number;
}

function buildCov(vols: number[], corr?: number[][]): number[][] {
  const n = vols.length;
  const C = corr ?? Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0.2));
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => C[i][j] * vols[i] * vols[j])
  );
}

function portReturn(w: number[], mu: number[]): number {
  let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * mu[i]; return s;
}
function portVar(w: number[], cov: number[][]): number {
  let s = 0;
  for (let i = 0; i < w.length; i++)
    for (let j = 0; j < w.length; j++) s += w[i] * w[j] * cov[i][j];
  return Math.max(0, s);
}

function randomWeights(n: number, bounds: Array<{ min: number; max: number }>, locked: Record<number, number>): number[] {
  // Dirichlet-ish sampling honoring per-asset bounds and locked weights.
  const w = new Array(n).fill(0);
  let lockedSum = 0;
  const free: number[] = [];
  for (let i = 0; i < n; i++) {
    if (locked[i] !== undefined) { w[i] = locked[i]; lockedSum += locked[i]; }
    else free.push(i);
  }
  const remaining = Math.max(0, 1 - lockedSum);
  // assign each free index a random raw
  let raws = free.map(() => Math.random() + 0.01);
  let sum = raws.reduce((a, b) => a + b, 0);
  raws = raws.map((r) => (r / sum) * remaining);
  // clip to bounds and renormalize until stable
  for (let iter = 0; iter < 25; iter++) {
    let needRedo = false;
    let lockedExtra = 0;
    for (let k = 0; k < free.length; k++) {
      const i = free[k];
      const b = bounds[i];
      if (raws[k] < b.min) { raws[k] = b.min; needRedo = true; lockedExtra += b.min; }
      else if (raws[k] > b.max) { raws[k] = b.max; needRedo = true; lockedExtra += b.max; }
    }
    if (!needRedo) break;
    const overshoot = raws.reduce((a, b) => a + b, 0) - remaining;
    if (Math.abs(overshoot) < 1e-6) break;
    // scale unclipped indices to absorb overshoot
    const adjustable = free.map((_, k) => raws[k] > bounds[free[k]].min + 1e-9 && raws[k] < bounds[free[k]].max - 1e-9);
    const adjSum = raws.reduce((s, v, k) => adjustable[k] ? s + v : s, 0);
    if (adjSum <= 0) break;
    const factor = (adjSum - overshoot) / adjSum;
    raws = raws.map((v, k) => adjustable[k] ? v * factor : v);
  }
  free.forEach((i, k) => { w[i] = Math.max(0, raws[k]); });
  // final renormalisation to 1 honoring locked weights
  const free_sum = free.reduce((s, i) => s + w[i], 0);
  const target = Math.max(0, 1 - lockedSum);
  if (free_sum > 1e-9) free.forEach((i) => { w[i] = (w[i] / free_sum) * target; });
  return w;
}

function violatesSector(w: number[], sectors: string[] | undefined, caps: Record<string, number> | undefined): boolean {
  if (!sectors || !caps) return false;
  const totals: Record<string, number> = {};
  for (let i = 0; i < w.length; i++) totals[sectors[i]] = (totals[sectors[i]] ?? 0) + w[i];
  for (const sec in caps) if ((totals[sec] ?? 0) > caps[sec] + 1e-6) return true;
  return false;
}

export function optimize(input: OptimizerInput, objective: ObjectiveKind, opts?: { targetRisk?: number; targetReturn?: number; iterations?: number }): OptimResult {
  const n = input.symbols.length;
  const mu = input.expReturns;
  const cov = buildCov(input.vols, input.correlations);
  const rf = input.riskFreeRate ?? 0.07;
  const bounds = input.weightBounds ?? Array.from({ length: n }, () => ({ min: 0, max: 1 }));
  const locked = input.lockedWeights ?? {};
  const iters = opts?.iterations ?? 6000;

  let best: OptimResult | null = null;
  let bestScore = -Infinity;
  let fallback: OptimResult | null = null;

  const scoreFn = (w: number[]): number => {
    const r = portReturn(w, mu);
    const v = Math.sqrt(portVar(w, cov));
    switch (objective) {
      case "maxSharpe":   return (r - rf) / Math.max(v, 1e-6);
      case "minVol":      return -v;
      case "maxReturnAtRisk": {
        const tgt = opts?.targetRisk ?? 0.15;
        return v <= tgt ? r : r - (v - tgt) * 10;
      }
      case "minRiskAtReturn": {
        const tgt = opts?.targetReturn ?? 0.12;
        return r >= tgt ? -v : -v - (tgt - r) * 10;
      }
      case "riskParity": {
        // approximate via product of weights (encourages even spread)
        const k = w.reduce((s, x) => s + (x > 0 ? Math.log(x + 1e-6) : -10), 0);
        return k - v;
      }
    }
  };

  for (let i = 0; i < iters; i++) {
    const w = randomWeights(n, bounds, locked);
    if (violatesSector(w, input.sectors, input.sectorCaps)) {
      // keep but penalise
      const r = portReturn(w, mu);
      const v = Math.sqrt(portVar(w, cov));
      const candidate: OptimResult = { weights: w, expReturn: r, vol: v, sharpe: (r - rf) / Math.max(v, 1e-6) };
      if (!fallback) fallback = candidate;
      continue;
    }
    const s = scoreFn(w);
    if (s > bestScore) {
      bestScore = s;
      const r = portReturn(w, mu);
      const v = Math.sqrt(portVar(w, cov));
      best = { weights: w, expReturn: r, vol: v, sharpe: (r - rf) / Math.max(v, 1e-6) };
    }
  }
  return best ?? fallback ?? { weights: new Array(n).fill(1 / n), expReturn: 0, vol: 0, sharpe: 0 };
}

// Build a frontier (return vs vol scatter) under the same constraints.
export function frontier(input: OptimizerInput, samples = 1500): Array<{ ret: number; vol: number; sharpe: number; weights: number[] }> {
  const n = input.symbols.length;
  const mu = input.expReturns;
  const cov = buildCov(input.vols, input.correlations);
  const rf = input.riskFreeRate ?? 0.07;
  const bounds = input.weightBounds ?? Array.from({ length: n }, () => ({ min: 0, max: 1 }));
  const locked = input.lockedWeights ?? {};
  const out: Array<{ ret: number; vol: number; sharpe: number; weights: number[] }> = [];
  for (let i = 0; i < samples; i++) {
    const w = randomWeights(n, bounds, locked);
    if (violatesSector(w, input.sectors, input.sectorCaps)) continue;
    const r = portReturn(w, mu);
    const v = Math.sqrt(portVar(w, cov));
    out.push({ ret: r, vol: v, sharpe: (r - rf) / Math.max(v, 1e-6), weights: w });
  }
  return out;
}

// Generate a quick "rebased to 100" backtest from synthetic returns.
// Deterministic per-symbol-set so users see consistent comparisons.
export function syntheticBacktest(weights: number[], expReturns: number[], vols: number[], years: number, label: string): Array<{ d: number; v: number }> {
  const days = Math.round(years * 252);
  const muDaily = expReturns.map((r) => r / 252);
  const sigDaily = vols.map((s) => s / Math.sqrt(252));
  // seeded RNG
  let seed = 0;
  for (const c of label) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xFFFFFFFF; };
  const norm = () => { const u1 = Math.max(rand(), 1e-9); const u2 = rand(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  let v = 100;
  const series: Array<{ d: number; v: number }> = [{ d: 0, v }];
  for (let t = 1; t <= days; t++) {
    let dailyR = 0;
    for (let i = 0; i < weights.length; i++) dailyR += weights[i] * (muDaily[i] + sigDaily[i] * norm());
    v *= 1 + dailyR;
    if (t % 5 === 0) series.push({ d: t, v });
  }
  return series;
}

export function backtestStats(series: Array<{ d: number; v: number }>): { cagr: number; maxDD: number; sharpe: number } {
  if (series.length < 2) return { cagr: 0, maxDD: 0, sharpe: 0 };
  const v0 = series[0].v, vN = series[series.length - 1].v;
  const years = series[series.length - 1].d / 252;
  const cagr = years > 0 ? Math.pow(vN / v0, 1 / years) - 1 : 0;
  let peak = -Infinity, maxDD = 0;
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    rets.push(series[i].v / series[i - 1].v - 1);
    peak = Math.max(peak, series[i].v);
    maxDD = Math.min(maxDD, series[i].v / peak - 1);
  }
  const mean = rets.reduce((s, x) => s + x, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  const annSharpe = sd > 0 ? (mean * 252 - 0.07) / (sd * Math.sqrt(252)) : 0;
  return { cagr, maxDD, sharpe: annSharpe };
}
