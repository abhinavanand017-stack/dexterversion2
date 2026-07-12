// Deep Research models 18–22. Pure functions, client-side.
// Consume features already built for the short-term engine + optional
// seed fundamentals from NIFTY500 + optional benchmark bar series for RS.

import type { FeatureRow, Bar } from "./features";
import type { NiftyStock } from "@/lib/nifty500";

export interface DeepOverrides {
  eps?: number | null;          // ₹ per share
  epsCagr5y?: number | null;    // %
  revGrowth?: number | null;    // %
}

export interface DcfLite {
  id: "dcf";
  name: "DCF-Lite (Model 18)";
  fairValue: number;
  mos: number;                  // % margin of safety = (FV - price)/FV * 100
  band: { low: number; high: number };
  targetHi: number[];           // per-day fair-value line for chart overlay (length = horizon)
  targetLo: number[];
  used: { eps: number; g: number; pe: number };
  note?: string;
}

export interface EarningsMomentum {
  id: "emom";
  name: "Earnings Momentum (Model 19)";
  score: number;                // 0–100
  targetShift: number;          // %-nudge applied to consensus
  breakdown: { profit: number; sales: number };
}

export interface BollingerReversion {
  id: "bbrev";
  name: "Bollinger Reversion (Model 20)";
  target: number;               // reversion target (SMA20)
  distance: number;             // % gap from price → target
  zone: "upper" | "lower" | "inside";
  bandUpper: number;
  bandLower: number;
}

export interface RelativeStrength {
  id: "rs";
  name: "Relative Strength (Model 21)";
  stockRet3m: number;           // %
  benchRet3m: number;           // %
  rs: number;                   // stock - bench, pp
  score: number;                // 0–100
  benchLabel: string;
}

export interface CompositeScore {
  id: "quant";
  name: "Composite Quant Score (Model 22)";
  score: number;                // 0–100
  axes: Array<{ label: string; value: number }>;   // 6 axes, 0–100
}

export interface DeepResearchResult {
  dcf: DcfLite;
  emom: EarningsMomentum;
  bbrev: BollingerReversion;
  rs: RelativeStrength;
  quant: CompositeScore;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const finite = (v: number | undefined | null, fallback = 0) =>
  v != null && Number.isFinite(v) ? v : fallback;

// ------------- Model 18: DCF-Lite -------------
function dcfLite(
  price: number,
  horizon: number,
  stock: NiftyStock | null,
  o: DeepOverrides,
): DcfLite {
  const pe = finite(stock?.pe, 22);
  const eps = o.eps != null ? o.eps : pe > 0 && price ? price / pe : 0;
  const g = o.epsCagr5y != null ? o.epsCagr5y : Math.max(-15, Math.min(35, finite(stock?.qtrProfitVar, 12)));
  // Fair value = EPS × (1+g)^5 × terminal PE (blended 18)
  const terminalPe = Math.max(10, Math.min(30, pe * 0.85 + 15 * 0.15));
  const proj = eps * Math.pow(1 + g / 100, 5) * terminalPe;
  // Discount back 5y at 12%
  const fv = proj / Math.pow(1.12, 5);
  const mos = fv ? ((fv - price) / fv) * 100 : 0;
  const targetHi: number[] = [];
  const targetLo: number[] = [];
  for (let i = 0; i < horizon; i++) {
    const w = (i + 1) / horizon;
    const mid = price + (fv - price) * w * 0.15; // slow drift toward FV
    targetHi.push(mid * 1.15);
    targetLo.push(mid * 0.85);
  }
  return {
    id: "dcf",
    name: "DCF-Lite (Model 18)",
    fairValue: fv,
    mos,
    band: { low: fv * 0.85, high: fv * 1.15 },
    targetHi,
    targetLo,
    used: { eps, g, pe: terminalPe },
    note: !stock?.pe ? "Using default P/E (no seed fundamentals)" : undefined,
  };
}

// ------------- Model 19: Earnings Momentum -------------
function earningsMomentum(stock: NiftyStock | null, o: DeepOverrides): EarningsMomentum {
  const profit = o.epsCagr5y != null ? o.epsCagr5y : finite(stock?.qtrProfitVar, 0);
  const sales = o.revGrowth != null ? o.revGrowth : finite(stock?.qtrSalesVar, 0);
  // Rescale to 0–100: 0% = 50, +30% = 100, −30% = 0
  const s = clamp(50 + (0.6 * profit + 0.4 * sales) * (50 / 30));
  const targetShift = ((s - 50) / 50) * 6; // ±6% nudge
  return {
    id: "emom",
    name: "Earnings Momentum (Model 19)",
    score: s,
    targetShift,
    breakdown: { profit, sales },
  };
}

// ------------- Model 20: Bollinger Mean Reversion -------------
function bollingerReversion(row: FeatureRow): BollingerReversion {
  const price = row.c;
  const target = row.sma20;
  const distance = target ? ((target - price) / price) * 100 : 0;
  const zone: BollingerReversion["zone"] =
    price >= row.bbUpper ? "upper" : price <= row.bbLower ? "lower" : "inside";
  return {
    id: "bbrev",
    name: "Bollinger Reversion (Model 20)",
    target,
    distance,
    zone,
    bandUpper: row.bbUpper,
    bandLower: row.bbLower,
  };
}

// ------------- Model 21: Relative Strength -------------
function relativeStrength(
  bars: Bar[],
  benchBars: Bar[] | null,
  benchLabel: string,
): RelativeStrength {
  const win = 63; // ~3 months
  const pct = (arr: Bar[]) => {
    if (arr.length < win + 1) return 0;
    const now = arr[arr.length - 1].c;
    const then = arr[arr.length - 1 - win].c;
    return then ? ((now - then) / then) * 100 : 0;
  };
  const s = pct(bars);
  const b = benchBars ? pct(benchBars) : 8; // fallback ~annual/4
  const rs = s - b;
  const score = clamp(50 + rs * 2.5); // ±20pp gap → saturates
  return {
    id: "rs",
    name: "Relative Strength (Model 21)",
    stockRet3m: s,
    benchRet3m: b,
    rs,
    score,
    benchLabel: benchBars ? benchLabel : `${benchLabel} (assumed)`,
  };
}

// ------------- Model 22: Composite Quant Score -------------
function compositeScore(
  price: number,
  stock: NiftyStock | null,
  row: FeatureRow,
  emom: EarningsMomentum,
  rs: RelativeStrength,
  dcf: DcfLite,
): CompositeScore {
  const pe = finite(stock?.pe, 22);
  const roce = finite(stock?.roce, 15);
  const de = finite(stock?.debtEquity, 0.8);
  const divYld = finite(stock?.divYld, 1);

  // Six axes, all normalised 0–100 (higher = better)
  const valuation = clamp(100 - (pe - 10) * 3);                       // low PE → high
  const growth   = emom.score;
  const quality  = clamp(roce * 3);                                    // 33% ROCE → 100
  const balance  = clamp(100 - de * 40);                               // low D/E → high
  const income   = clamp(divYld * 20);                                 // 5% yld → 100
  const trend    = clamp(
    50 +
      ((row.c > row.sma50 ? 15 : -15)) +
      ((row.c > row.sma20 ? 10 : -10)) +
      ((row.macd > row.macdSignal ? 10 : -10)),
  );
  const momentum = clamp(50 + rs.rs * 2.5);
  const value2   = clamp(50 + dcf.mos * 1.2);

  const axes = [
    { label: "Valuation",  value: (valuation + value2) / 2 },
    { label: "Growth",     value: growth },
    { label: "Quality",    value: quality },
    { label: "Trend",      value: trend },
    { label: "Momentum",   value: momentum },
    { label: "Balance/Yield", value: (balance + income) / 2 },
  ];
  const score = axes.reduce((s, a) => s + a.value, 0) / axes.length;
  return { id: "quant", name: "Composite Quant Score (Model 22)", score, axes };
}

export function runDeepResearch(
  bars: Bar[],
  rows: FeatureRow[],
  horizon: number,
  stock: NiftyStock | null,
  benchBars: Bar[] | null,
  benchLabel: string,
  overrides: DeepOverrides,
): DeepResearchResult | null {
  if (!rows.length || !bars.length) return null;
  const price = bars[bars.length - 1].c;
  const row = rows[rows.length - 1];
  const dcf = dcfLite(price, horizon, stock, overrides);
  const emom = earningsMomentum(stock, overrides);
  const bbrev = bollingerReversion(row);
  const rs = relativeStrength(bars, benchBars, benchLabel);
  const quant = compositeScore(price, stock, row, emom, rs, dcf);
  return { dcf, emom, bbrev, rs, quant };
}
