// Long-term forecasting toolkit for the Forecaster.
//
// The 17-model short-term engine is tuned for 1–90 day pattern detection
// and is meaningless beyond a few months. The Long-Term tier replaces those
// models with two things that ARE statistically appropriate for multi-year
// horizons:
//
//   1. CAGR Extrapolation — compound the asset's own trailing CAGR forward
//   2. Monte Carlo (lognormal random walk) — N simulated paths using the
//      asset's historical annualised return + volatility, producing a
//      confidence cone that correctly widens with σ√t
//
// Everything here is pure JS, deterministic up to the Monte Carlo seed,
// and runs entirely in the browser.

import type { Bar as PriceBar } from "./features";
import { randn } from "./math";

export type LongHorizon = "6m" | "1y" | "3y" | "5y" | "10y";

export const LONG_HORIZONS: { id: LongHorizon; label: string; years: number; steps: number; stepLabel: string }[] = [
  { id: "6m",  label: "6 Months", years: 0.5, steps: 26,  stepLabel: "week" },
  { id: "1y",  label: "1 Year",   years: 1,   steps: 52,  stepLabel: "week" },
  { id: "3y",  label: "3 Years",  years: 3,   steps: 36,  stepLabel: "month" },
  { id: "5y",  label: "5 Years",  years: 5,   steps: 60,  stepLabel: "month" },
  { id: "10y", label: "10 Years", years: 10,  steps: 40,  stepLabel: "quarter" },
];

export interface LongTermInputs {
  bars: PriceBar[];           // historical price/NAV series, oldest first
  horizon: LongHorizon;
  confidence: 80 | 90 | 95;   // band width
  mcPaths?: number;
  cagrOverride?: number | null; // user nudge to the historical CAGR drift (as %, e.g. +2.5)
  fundCagr?: {                // optional — funds give us these directly
    r1?: number | null;
    r3?: number | null;
    r5?: number | null;
    r10?: number | null;
  };
}

export interface LongTermResult {
  horizonId: LongHorizon;
  horizonLabel: string;
  years: number;
  steps: number;
  stepMs: number;              // ms per simulated step
  // Time series (steps + 1 points, first = today)
  timestamps: number[];
  cagrPath: number[];          // CAGR extrapolation (the central deterministic line)
  mcMedian: number[];          // Monte Carlo median per step
  mcLow: number[];             // lower confidence bound
  mcHigh: number[];            // upper confidence bound
  // Headline stats
  currentPrice: number;
  endCagr: number;             // CAGR-extrapolated end value
  endMedian: number;           // MC median end value
  endLow: number;
  endHigh: number;
  cagrUsed: number;            // %; assumption that drove the central line
  cagrSource: "fund_5y" | "fund_3y" | "fund_10y" | "fund_1y" | "price_5y" | "price_3y" | "price_1y" | "fallback";
  sigmaAnnual: number;         // %; annualised vol used for MC
  probPositive: number;        // % of MC paths ending above today
  paths: number;
}

// ---------- helpers ----------

function annualisedFromDaily(bars: PriceBar[]) {
  if (bars.length < 30) return { mu: 0, sigma: 0.2 };
  const close = bars.map((b) => b.c);
  const logRets: number[] = [];
  for (let i = 1; i < close.length; i++) logRets.push(Math.log(close[i] / close[i - 1]));
  const m = logRets.reduce((s, v) => s + v, 0) / logRets.length;
  const v = logRets.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, logRets.length - 1);
  return { mu: m * 252, sigma: Math.sqrt(v * 252) };
}

function trailingCagr(bars: PriceBar[], years: number): number | null {
  if (!bars.length) return null;
  const bpy = 252;
  const need = Math.floor(years * bpy);
  if (bars.length < need + 1) return null;
  const start = bars[bars.length - 1 - need].c;
  const end = bars[bars.length - 1].c;
  if (start <= 0 || end <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

function pickFundCagr(fund: NonNullable<LongTermInputs["fundCagr"]>): { value: number; source: LongTermResult["cagrSource"] } | null {
  if (typeof fund.r5  === "number") return { value: fund.r5  / 100, source: "fund_5y" };
  if (typeof fund.r3  === "number") return { value: fund.r3  / 100, source: "fund_3y" };
  if (typeof fund.r10 === "number") return { value: fund.r10 / 100, source: "fund_10y" };
  if (typeof fund.r1  === "number") return { value: fund.r1  / 100, source: "fund_1y" };
  return null;
}

function zFor(conf: 80 | 90 | 95) {
  return conf === 80 ? 1.282 : conf === 90 ? 1.645 : 1.96;
}

function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

// ---------- main entry ----------

export function runLongTermForecast(inputs: LongTermInputs): LongTermResult {
  const spec = LONG_HORIZONS.find((h) => h.id === inputs.horizon)!;
  const years = spec.years;
  const steps = spec.steps;
  const stepYears = years / steps;

  const today = inputs.bars[inputs.bars.length - 1]?.c ?? 100;
  const todayT = inputs.bars[inputs.bars.length - 1]?.t ?? Date.now();
  const stepMs = (years * 365.25 * 86400000) / steps;

  // 1. Pick a CAGR source
  let cagrUsed = 0.10; // 10% fallback
  let cagrSource: LongTermResult["cagrSource"] = "fallback";
  if (inputs.fundCagr) {
    const f = pickFundCagr(inputs.fundCagr);
    if (f) { cagrUsed = f.value; cagrSource = f.source; }
  } else {
    const c5 = trailingCagr(inputs.bars, 5);
    const c3 = trailingCagr(inputs.bars, 3);
    const c1 = trailingCagr(inputs.bars, 1);
    if (c5 !== null) { cagrUsed = c5; cagrSource = "price_5y"; }
    else if (c3 !== null) { cagrUsed = c3; cagrSource = "price_3y"; }
    else if (c1 !== null) { cagrUsed = c1; cagrSource = "price_1y"; }
  }

  // Optional user nudge (in %)
  if (typeof inputs.cagrOverride === "number" && Number.isFinite(inputs.cagrOverride)) {
    cagrUsed += inputs.cagrOverride / 100;
  }

  // Clamp insanely large/small CAGRs so the chart stays readable
  cagrUsed = Math.max(-0.5, Math.min(0.6, cagrUsed));

  // 2. Annualised volatility from full price history
  const { sigma: sigmaAnnual } = annualisedFromDaily(inputs.bars);
  const sigmaUsed = Math.max(0.05, Math.min(1.5, sigmaAnnual));

  // 3. Build CAGR deterministic line
  const cagrPath: number[] = [];
  const timestamps: number[] = [];
  for (let i = 0; i <= steps; i++) {
    cagrPath.push(today * Math.pow(1 + cagrUsed, i * stepYears));
    timestamps.push(todayT + i * stepMs);
  }

  // 4. Monte Carlo (lognormal random walk; drift = ln(1 + CAGR))
  const N = Math.max(200, Math.min(10000, inputs.mcPaths ?? 2000));
  const drift = Math.log(1 + cagrUsed);
  const dt = stepYears;
  const paths: number[][] = [];
  let endPositive = 0;
  for (let p = 0; p < N; p++) {
    const path: number[] = [today];
    let s = today;
    for (let i = 1; i <= steps; i++) {
      s = s * Math.exp((drift - 0.5 * sigmaUsed * sigmaUsed) * dt + sigmaUsed * Math.sqrt(dt) * randn());
      path.push(s);
    }
    paths.push(path);
    if (path[steps] > today) endPositive++;
  }

  const z = zFor(inputs.confidence);
  const lowP = 0.5 - z * 0.5 / 1.96 * 0.475; // approximate via quantiles below
  // Use actual quantiles for accuracy
  const lowQ = inputs.confidence === 80 ? 0.10 : inputs.confidence === 90 ? 0.05 : 0.025;
  const highQ = 1 - lowQ;
  void lowP;

  const mcMedian: number[] = [];
  const mcLow: number[] = [];
  const mcHigh: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const col = paths.map((pp) => pp[i]).sort((a, b) => a - b);
    mcMedian.push(quantile(col, 0.5));
    mcLow.push(quantile(col, lowQ));
    mcHigh.push(quantile(col, highQ));
  }

  return {
    horizonId: spec.id,
    horizonLabel: spec.label,
    years,
    steps,
    stepMs,
    timestamps,
    cagrPath,
    mcMedian,
    mcLow,
    mcHigh,
    currentPrice: today,
    endCagr: cagrPath[steps],
    endMedian: mcMedian[steps],
    endLow: mcLow[steps],
    endHigh: mcHigh[steps],
    cagrUsed: cagrUsed * 100,
    cagrSource,
    sigmaAnnual: sigmaUsed * 100,
    probPositive: (endPositive / N) * 100,
    paths: N,
  };
}

export function cagrSourceLabel(s: LongTermResult["cagrSource"]): string {
  switch (s) {
    case "fund_5y": return "Fund 5Y CAGR";
    case "fund_3y": return "Fund 3Y CAGR";
    case "fund_10y": return "Fund 10Y CAGR";
    case "fund_1y": return "Fund 1Y CAGR";
    case "price_5y": return "Trailing 5Y price CAGR";
    case "price_3y": return "Trailing 3Y price CAGR";
    case "price_1y": return "Trailing 1Y price CAGR";
    case "fallback": return "Generic 10% assumption (insufficient history)";
  }
}
