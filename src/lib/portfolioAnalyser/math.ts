// Portfolio Analyser math utilities — all client-side, pure functions.

export function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function mean(a: number[]): number {
  if (!a.length) return 0;
  let s = 0; for (const v of a) s += v; return s / a.length;
}

export function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  let s = 0; for (const v of a) s += (v - m) ** 2;
  return Math.sqrt(s / (a.length - 1));
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

// Compound annual growth rate given start, end, years.
export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

// XIRR via Newton-Raphson. cashflows: { amount, date } (amount negative for buys).
export interface CashFlow { amount: number; date: Date }

export function xnpv(rate: number, cf: CashFlow[]): number {
  if (!cf.length) return 0;
  const t0 = cf[0].date.getTime();
  let sum = 0;
  for (const c of cf) {
    const yrs = (c.date.getTime() - t0) / (365.25 * 86400_000);
    sum += c.amount / Math.pow(1 + rate, yrs);
  }
  return sum;
}

export function xirr(cf: CashFlow[], guess = 0.1): number | null {
  if (cf.length < 2) return null;
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = xnpv(rate, cf);
    const df = (xnpv(rate + 1e-6, cf) - f) / 1e-6;
    if (Math.abs(df) < 1e-12) break;
    const next = rate - f / df;
    if (!isFinite(next)) return null;
    if (Math.abs(next - rate) < 1e-7) return next;
    rate = next;
    if (rate < -0.999) rate = -0.999;
  }
  return isFinite(rate) ? rate : null;
}

// Geometric Brownian Motion Monte Carlo.
// mu, sigma are DAILY log-return params. days = trading days horizon.
export interface GbmResult {
  paths: number[][];  // sampled paths (subset for chart)
  p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[];
  finalP5: number; finalP50: number; finalP95: number;
}

export function runGBM(
  lastPrice: number, mu: number, sigma: number, days: number, nSims = 1000,
): GbmResult {
  const finals = new Float64Array(nSims);
  const quantileMatrix: number[][] = Array.from({ length: days + 1 }, () => new Array(nSims));
  const sampled: number[][] = [];
  const sampleEvery = Math.max(1, Math.floor(nSims / 40));

  for (let i = 0; i < nSims; i++) {
    let s = lastPrice;
    quantileMatrix[0][i] = s;
    const path = i % sampleEvery === 0 ? [s] : null;
    for (let d = 1; d <= days; d++) {
      const eps = boxMuller();
      const logRet = (mu - 0.5 * sigma * sigma) + sigma * eps;
      s = s * Math.exp(logRet);
      quantileMatrix[d][i] = s;
      if (path) path.push(s);
    }
    finals[i] = s;
    if (path) sampled.push(path);
  }

  const q = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  const p5: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p95: number[] = [];
  for (let d = 0; d <= days; d++) {
    p5.push(q(quantileMatrix[d], 0.05));
    p25.push(q(quantileMatrix[d], 0.25));
    p50.push(q(quantileMatrix[d], 0.50));
    p75.push(q(quantileMatrix[d], 0.75));
    p95.push(q(quantileMatrix[d], 0.95));
  }
  const finalsArr = Array.from(finals);
  return {
    paths: sampled,
    p5, p25, p50, p75, p95,
    finalP5: q(finalsArr, 0.05),
    finalP50: q(finalsArr, 0.50),
    finalP95: q(finalsArr, 0.95),
  };
}

// Compute daily log-return series' mu/sigma from a price series.
export function estimateMuSigma(prices: number[]): { mu: number; sigma: number } {
  if (prices.length < 2) return { mu: 0, sigma: 0.02 };
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) rets.push(Math.log(prices[i] / prices[i - 1]));
  }
  return { mu: mean(rets), sigma: std(rets) || 0.02 };
}

// AR(1) simple projection using OLS on lag-1.
export function ar1Project(prices: number[], steps: number): number[] {
  if (prices.length < 3) return new Array(steps).fill(prices[prices.length - 1] ?? 0);
  const y = prices.slice(1), x = prices.slice(0, -1);
  const mx = mean(x), my = mean(y);
  let num = 0, den = 0;
  for (let i = 0; i < x.length; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2; }
  const phi = den === 0 ? 1 : num / den;
  const c = my - phi * mx;
  const out: number[] = [];
  let last = prices[prices.length - 1];
  for (let i = 0; i < steps; i++) { last = c + phi * last; out.push(last); }
  return out;
}

// Holt-Winters double exponential smoothing (no season).
export function holtProject(prices: number[], steps: number, alpha = 0.6, beta = 0.2): number[] {
  if (prices.length < 2) return new Array(steps).fill(prices[prices.length - 1] ?? 0);
  let level = prices[0];
  let trend = prices[1] - prices[0];
  for (let i = 1; i < prices.length; i++) {
    const prevLevel = level;
    level = alpha * prices[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const out: number[] = [];
  for (let i = 1; i <= steps; i++) out.push(level + i * trend);
  return out;
}

// Max drawdown from a value series. Returns pct (negative).
export function maxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;
  let peak = values[0], maxDD = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

// Sharpe ratio: annualized excess return / annualized std. Assumes daily returns.
export function sharpeRatio(dailyReturns: number[], riskFreeAnnual = 0.065): number {
  if (dailyReturns.length < 2) return 0;
  const rfDaily = riskFreeAnnual / 252;
  const excess = dailyReturns.map((r) => r - rfDaily);
  const s = std(excess);
  if (s === 0) return 0;
  return (mean(excess) / s) * Math.sqrt(252);
}
