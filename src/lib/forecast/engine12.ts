// 12-factor short-term forecasting engine. Pure functions over OHLCV bars.
// All indicators computed from real historical data — no hardcoded numbers.

export interface OHLCV { date: string; open: number; high: number; low: number; close: number; volume: number }

export type Horizon = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y";
export const HORIZON_DAYS: Record<Horizon, number> = {
  "1D": 1, "5D": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "3Y": 756, "5Y": 1260,
};

// ─── indicators ─────────────────────────────────────────────────────────
export function sma(a: number[], p: number): number {
  const s = a.slice(-p);
  return s.reduce((x, y) => x + y, 0) / s.length;
}

export function calcEMA(a: number[], p: number): number[] {
  const k = 2 / (p + 1);
  let e = a[0];
  return a.map((v) => (e = v * k + e * (1 - k)));
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = []; const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  let avgG = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgL = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
  }
  const rs = avgG / (avgL || 1e-9);
  return 100 - 100 / (1 + rs);
}

export function calcMACD(closes: number[]) {
  const e12 = calcEMA(closes, 12);
  const e26 = calcEMA(closes, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const signal = calcEMA(line.slice(25), 9);
  const macd = line[line.length - 1];
  const sig = signal[signal.length - 1];
  return { macd, signal: sig, hist: macd - sig, trend: macd > sig ? "Bullish" : "Bearish" as const };
}

export function calcBollinger(closes: number[], period = 20) {
  const s = closes.slice(-period);
  const mid = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.map((v) => (v - mid) ** 2).reduce((a, b) => a + b, 0) / s.length);
  const upper = mid + 2 * sd; const lower = mid - 2 * sd;
  const last = closes[closes.length - 1];
  return { upper, mid, lower, bPct: ((last - lower) / (upper - lower)) * 100 };
}

export function calcATR(h: number[], l: number[], c: number[], period = 14): number {
  const trs = h.map((hi, i) => i === 0 ? hi - l[i] : Math.max(hi - l[i], Math.abs(hi - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function calcStoch(h: number[], l: number[], c: number[], k = 14): number {
  const hh = Math.max(...h.slice(-k));
  const ll = Math.min(...l.slice(-k));
  return ((c[c.length - 1] - ll) / (hh - ll || 1e-9)) * 100;
}

export function calcWilliamsR(h: number[], l: number[], c: number[], period = 14): number {
  const hh = Math.max(...h.slice(-period));
  const ll = Math.min(...l.slice(-period));
  return ((hh - c[c.length - 1]) / (hh - ll || 1e-9)) * -100;
}

export function calcCCI(h: number[], l: number[], c: number[], period = 20): number {
  const tp = c.map((v, i) => (h[i] + l[i] + v) / 3);
  const slice = tp.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const md = slice.map((v) => Math.abs(v - mean)).reduce((a, b) => a + b, 0) / period;
  return (tp[tp.length - 1] - mean) / (0.015 * (md || 1e-9));
}

export function calcOBV(c: number[], v: number[]) {
  let obv = 0; const arr = [0];
  for (let i = 1; i < c.length; i++) {
    obv += c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0;
    arr.push(obv);
  }
  const tail = arr.length >= 10 ? arr[arr.length - 10] : arr[0];
  return { value: obv, trend: obv > tail ? "Rising" : "Falling" as const };
}

// ─── 12-factor engine ────────────────────────────────────────────────────
export interface Factor {
  key: string; label: string; score: number; detail: string; signal: "BUY" | "SELL" | "HOLD";
  /** normalised weight actually applied in this run (0 when the model is deselected) */
  weight?: number;
  /** score × weight — this factor's contribution to the composite */
  contribution?: number;
  /** whether the user has this model selected */
  enabled?: boolean;
}
export interface ForecastPoint { date: string; price: number; upper: number; lower: number }
export interface EngineResult {
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  compositeScore: number;
  confidence: number;
  factors: Factor[];
  buyCount: number; sellCount: number; holdCount: number;
  targetPrice: number; upsidePct: number; targetDate: string;
  bullTarget: number; bearTarget: number;
  supportLevels: { s1: number; s2: number; pivot: number };
  resistanceLevels: { r1: number; r2: number };
  atr: number; atrPct: number;
  rsi: number;
  macd: { macd: number; signal: number; hist: number };
  bollinger: { upper: number; mid: number; lower: number; bPct: number };
  ma: { ma20: number; ma50: number; ma200: number | null; ema9: number; ema21: number };
  forecastPath: ForecastPoint[];
  history90: { date: string; close: number; volume: number }[];
  rsi90: { date: string; rsi: number }[];
  macd90: { date: string; hist: number; signal: number }[];
  /** keys of the models actually included in this run */
  activeKeys: string[];
}

export const WEIGHTS = {
  rsi: 0.10, macd: 0.12, bollinger: 0.08, maAlignment: 0.15,
  volume: 0.10, stochastic: 0.08, momentum: 0.12, cci: 0.07,
  obv: 0.08, williamsR: 0.05, volatility: 0.05, supportResistance: 0.10,
};

export type FactorKey = keyof typeof WEIGHTS;

/** Canonical registry of every model/technical factor in the engine. */
export const FACTOR_REGISTRY: { key: FactorKey; label: string; weight: number; description: string }[] = [
  { key: "maAlignment", label: "MA Alignment", weight: WEIGHTS.maAlignment, description: "Price vs EMA9 / EMA21 / MA20 / MA50 trend stack, golden & death crosses" },
  { key: "macd", label: "MACD", weight: WEIGHTS.macd, description: "12/26 EMA convergence-divergence with 9-period signal line" },
  { key: "momentum", label: "Momentum", weight: WEIGHTS.momentum, description: "Blended 5D / 10D / 20D rate of change" },
  { key: "rsi", label: "RSI", weight: WEIGHTS.rsi, description: "14-period Relative Strength Index (overbought / oversold)" },
  { key: "volume", label: "Volume", weight: WEIGHTS.volume, description: "Latest volume vs 20-day average, direction-confirmed" },
  { key: "supportResistance", label: "S/R Position", weight: WEIGHTS.supportResistance, description: "Distance to classic pivot support (S1) and resistance (R1)" },
  { key: "bollinger", label: "Bollinger Bands", weight: WEIGHTS.bollinger, description: "20-period bands, %B mean-reversion position" },
  { key: "stochastic", label: "Stochastic Oscillator", weight: WEIGHTS.stochastic, description: "14-period %K oscillator" },
  { key: "obv", label: "OBV", weight: WEIGHTS.obv, description: "On-Balance Volume accumulation / distribution and divergence" },
  { key: "cci", label: "CCI", weight: WEIGHTS.cci, description: "20-period Commodity Channel Index" },
  { key: "williamsR", label: "Williams %R", weight: WEIGHTS.williamsR, description: "14-period Williams %R momentum extreme" },
  { key: "volatility", label: "Volatility (ATR)", weight: WEIGHTS.volatility, description: "14-period Average True Range as % of price — forecast band width" },
];

export const ALL_FACTOR_KEYS: FactorKey[] = FACTOR_REGISTRY.map((f) => f.key);

export function runShortTermForecast(bars: OHLCV[], horizon: Horizon, enabledKeys?: string[]): EngineResult {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const vols = bars.map((b) => b.volume);
  const n = closes.length;
  const last = closes[n - 1];

  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const bb = calcBollinger(closes);
  const atr = calcATR(highs, lows, closes);
  const atrPct = (atr / last) * 100;
  const stochK = calcStoch(highs, lows, closes);
  const cci = calcCCI(highs, lows, closes);
  const obv = calcOBV(closes, vols);
  const wR = calcWilliamsR(highs, lows, closes);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = closes.length >= 200 ? sma(closes, 200) : null;
  const ema9 = calcEMA(closes, 9).at(-1)!;
  const ema21 = calcEMA(closes, 21).at(-1)!;
  const vol20 = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;

  // pivot points from prior day
  const y = bars[n - 2] ?? bars[n - 1];
  const pivot = (y.high + y.low + y.close) / 3;
  const r1 = 2 * pivot - y.low;
  const r2 = pivot + (y.high - y.low);
  const s1 = 2 * pivot - y.high;
  const s2 = pivot - (y.high - y.low);

  const factors: Factor[] = [];

  // 1 RSI
  factors.push((() => {
    const r = rsi;
    if (r < 25) return { key: "rsi", label: "RSI", score: 0.9, detail: `RSI ${r.toFixed(1)} — Strongly Oversold`, signal: "BUY" as const };
    if (r < 35) return { key: "rsi", label: "RSI", score: 0.5, detail: `RSI ${r.toFixed(1)} — Oversold`, signal: "BUY" as const };
    if (r < 45) return { key: "rsi", label: "RSI", score: 0.2, detail: `RSI ${r.toFixed(1)} — Mild Oversold`, signal: "HOLD" as const };
    if (r < 55) return { key: "rsi", label: "RSI", score: 0, detail: `RSI ${r.toFixed(1)} — Neutral`, signal: "HOLD" as const };
    if (r < 65) return { key: "rsi", label: "RSI", score: -0.2, detail: `RSI ${r.toFixed(1)} — Mild Overbought`, signal: "HOLD" as const };
    if (r < 75) return { key: "rsi", label: "RSI", score: -0.5, detail: `RSI ${r.toFixed(1)} — Overbought`, signal: "SELL" as const };
    return { key: "rsi", label: "RSI", score: -0.9, detail: `RSI ${r.toFixed(1)} — Strongly Overbought`, signal: "SELL" as const };
  })());

  // 2 MACD
  factors.push((() => {
    const h = macd.hist;
    const score = Math.max(-0.8, Math.min(0.8, (h / last) * 500));
    return { key: "macd", label: "MACD", score, detail: `Hist ${h.toFixed(2)} — ${macd.trend}`, signal: h > 0 ? "BUY" : "SELL" };
  })());

  // 3 Bollinger
  factors.push((() => {
    const p = bb.bPct;
    if (p < 5) return { key: "bollinger", label: "Bollinger", score: 0.85, detail: `At lower band — mean reversion`, signal: "BUY" as const };
    if (p < 20) return { key: "bollinger", label: "Bollinger", score: 0.5, detail: `Near lower band — oversold`, signal: "BUY" as const };
    if (p < 40) return { key: "bollinger", label: "Bollinger", score: 0.2, detail: `Below midline`, signal: "HOLD" as const };
    if (p < 60) return { key: "bollinger", label: "Bollinger", score: 0, detail: `At midline — neutral`, signal: "HOLD" as const };
    if (p < 80) return { key: "bollinger", label: "Bollinger", score: -0.2, detail: `Above midline`, signal: "HOLD" as const };
    if (p < 95) return { key: "bollinger", label: "Bollinger", score: -0.5, detail: `Near upper — overbought`, signal: "SELL" as const };
    return { key: "bollinger", label: "Bollinger", score: -0.85, detail: `At upper band — mean reversion`, signal: "SELL" as const };
  })());

  // 4 MA alignment
  factors.push((() => {
    const bull = last > ema9 && ema9 > ema21 && ema21 > ma50;
    const bear = last < ema9 && ema9 < ema21 && ema21 < ma50;
    const golden = ma20 > ma50 && ma20 / ma50 < 1.005;
    const death = ma20 < ma50 && ma50 / ma20 < 1.005;
    if (bull) return { key: "maAlignment", label: "MA Alignment", score: 0.8, detail: `Full bull: Price > EMA9 > EMA21 > MA50`, signal: "BUY" as const };
    if (bear) return { key: "maAlignment", label: "MA Alignment", score: -0.8, detail: `Full bear: Price < EMA9 < EMA21 < MA50`, signal: "SELL" as const };
    if (golden) return { key: "maAlignment", label: "MA Alignment", score: 0.9, detail: `Golden cross — MA20 above MA50`, signal: "BUY" as const };
    if (death) return { key: "maAlignment", label: "MA Alignment", score: -0.9, detail: `Death cross — MA20 below MA50`, signal: "SELL" as const };
    if (last > ma20 && last > ma50) return { key: "maAlignment", label: "MA Alignment", score: 0.4, detail: `Above MA20 & MA50 — uptrend`, signal: "BUY" as const };
    if (last < ma20 && last < ma50) return { key: "maAlignment", label: "MA Alignment", score: -0.4, detail: `Below MA20 & MA50 — downtrend`, signal: "SELL" as const };
    return { key: "maAlignment", label: "MA Alignment", score: 0, detail: `Mixed — sideways`, signal: "HOLD" as const };
  })());

  // 5 Volume
  factors.push((() => {
    const ratio = vols[n - 1] / (vol20 || 1);
    const up = closes[n - 1] > closes[n - 2];
    const high = ratio > 1.3;
    if (up && high) return { key: "volume", label: "Volume", score: 0.7, detail: `Bullish move on ${ratio.toFixed(1)}× avg vol`, signal: "BUY" as const };
    if (!up && high) return { key: "volume", label: "Volume", score: -0.7, detail: `Bearish move on ${ratio.toFixed(1)}× avg vol`, signal: "SELL" as const };
    if (up) return { key: "volume", label: "Volume", score: 0.2, detail: `Up on ${ratio.toFixed(1)}× vol — unconfirmed`, signal: "HOLD" as const };
    return { key: "volume", label: "Volume", score: -0.2, detail: `Down on ${ratio.toFixed(1)}× vol — weak`, signal: "HOLD" as const };
  })());

  // 6 Stochastic
  factors.push((() => {
    const k = stochK;
    if (k < 15) return { key: "stochastic", label: "Stochastic", score: 0.8, detail: `Stoch ${k.toFixed(0)} — Deeply oversold`, signal: "BUY" as const };
    if (k < 30) return { key: "stochastic", label: "Stochastic", score: 0.4, detail: `Stoch ${k.toFixed(0)} — Oversold`, signal: "BUY" as const };
    if (k > 85) return { key: "stochastic", label: "Stochastic", score: -0.8, detail: `Stoch ${k.toFixed(0)} — Deeply overbought`, signal: "SELL" as const };
    if (k > 70) return { key: "stochastic", label: "Stochastic", score: -0.4, detail: `Stoch ${k.toFixed(0)} — Overbought`, signal: "SELL" as const };
    return { key: "stochastic", label: "Stochastic", score: 0, detail: `Stoch ${k.toFixed(0)} — Neutral`, signal: "HOLD" as const };
  })());

  // 7 Momentum
  factors.push((() => {
    const roc5 = n > 5 ? (closes[n - 1] / closes[n - 6] - 1) * 100 : 0;
    const roc10 = n > 10 ? (closes[n - 1] / closes[n - 11] - 1) * 100 : 0;
    const roc20 = n > 20 ? (closes[n - 1] / closes[n - 21] - 1) * 100 : 0;
    const s = Math.max(-1, Math.min(1, (roc5 * 0.5 + roc10 * 0.3 + roc20 * 0.2) / 10));
    return { key: "momentum", label: "Momentum", score: s, detail: `5D:${roc5.toFixed(1)}% 10D:${roc10.toFixed(1)}% 20D:${roc20.toFixed(1)}%`, signal: s > 0.2 ? "BUY" : s < -0.2 ? "SELL" : "HOLD" };
  })());

  // 8 CCI
  factors.push((() => {
    if (cci < -150) return { key: "cci", label: "CCI", score: 0.9, detail: `CCI ${cci.toFixed(0)} — Extreme oversold`, signal: "BUY" as const };
    if (cci < -100) return { key: "cci", label: "CCI", score: 0.5, detail: `CCI ${cci.toFixed(0)} — Oversold`, signal: "BUY" as const };
    if (cci > 150) return { key: "cci", label: "CCI", score: -0.9, detail: `CCI ${cci.toFixed(0)} — Extreme overbought`, signal: "SELL" as const };
    if (cci > 100) return { key: "cci", label: "CCI", score: -0.5, detail: `CCI ${cci.toFixed(0)} — Overbought`, signal: "SELL" as const };
    return { key: "cci", label: "CCI", score: (cci / 100) * 0.3, detail: `CCI ${cci.toFixed(0)} — Normal`, signal: "HOLD" };
  })());

  // 9 OBV
  factors.push((() => {
    const pUp = n > 20 && closes[n - 1] > closes[n - 20];
    if (obv.trend === "Rising" && pUp) return { key: "obv", label: "OBV", score: 0.7, detail: `Accumulation confirmed`, signal: "BUY" as const };
    if (obv.trend === "Falling" && !pUp) return { key: "obv", label: "OBV", score: -0.7, detail: `Distribution confirmed`, signal: "SELL" as const };
    if (obv.trend === "Rising" && !pUp) return { key: "obv", label: "OBV", score: 0.4, detail: `Bullish divergence`, signal: "BUY" as const };
    return { key: "obv", label: "OBV", score: -0.4, detail: `Bearish divergence`, signal: "SELL" as const };
  })());

  // 10 Williams %R
  factors.push((() => {
    if (wR < -90) return { key: "williamsR", label: "Williams %R", score: 0.8, detail: `%R ${wR.toFixed(0)} — Extreme oversold`, signal: "BUY" as const };
    if (wR < -80) return { key: "williamsR", label: "Williams %R", score: 0.4, detail: `%R ${wR.toFixed(0)} — Oversold`, signal: "BUY" as const };
    if (wR > -10) return { key: "williamsR", label: "Williams %R", score: -0.8, detail: `%R ${wR.toFixed(0)} — Extreme overbought`, signal: "SELL" as const };
    if (wR > -20) return { key: "williamsR", label: "Williams %R", score: -0.4, detail: `%R ${wR.toFixed(0)} — Overbought`, signal: "SELL" as const };
    return { key: "williamsR", label: "Williams %R", score: 0, detail: `%R ${wR.toFixed(0)} — Neutral`, signal: "HOLD" };
  })());

  // 11 Volatility
  factors.push((() => {
    if (atrPct > 3) return { key: "volatility", label: "Volatility", score: 0, detail: `ATR ${atrPct.toFixed(1)}% — Very high, forecast range wide`, signal: "HOLD" as const };
    if (atrPct > 2) return { key: "volatility", label: "Volatility", score: 0.1, detail: `ATR ${atrPct.toFixed(1)}% — Elevated`, signal: "HOLD" as const };
    return { key: "volatility", label: "Volatility", score: 0.3, detail: `ATR ${atrPct.toFixed(1)}% — Normal, forecast reliable`, signal: "HOLD" as const };
  })());

  // 12 S/R
  factors.push((() => {
    const dR1 = ((r1 - last) / last) * 100;
    const dS1 = ((last - s1) / last) * 100;
    if (dS1 < 0.5) return { key: "supportResistance", label: "S/R Position", score: 0.7, detail: `At S1 ₹${s1.toFixed(0)} — bounce expected`, signal: "BUY" as const };
    if (dR1 < 0.5) return { key: "supportResistance", label: "S/R Position", score: -0.7, detail: `At R1 ₹${r1.toFixed(0)} — breakout or rejection`, signal: "SELL" as const };
    if (dS1 < 2) return { key: "supportResistance", label: "S/R Position", score: 0.3, detail: `Near S1 ₹${s1.toFixed(0)}`, signal: "HOLD" as const };
    if (dR1 < 2) return { key: "supportResistance", label: "S/R Position", score: -0.3, detail: `Near R1 ₹${r1.toFixed(0)}`, signal: "HOLD" as const };
    return { key: "supportResistance", label: "S/R Position", score: 0, detail: `Pivot ₹${pivot.toFixed(0)} · R1 ₹${r1.toFixed(0)} · S1 ₹${s1.toFixed(0)}`, signal: "HOLD" as const };
  })());

  // composite — only the selected models contribute; weights are renormalised
  // across the active subset so the score stays on the same -1..1 scale.
  const active = new Set<string>(
    enabledKeys && enabledKeys.length ? enabledKeys : ALL_FACTOR_KEYS,
  );
  const activeWeightSum = factors
    .filter((f) => active.has(f.key))
    .reduce((s, f) => s + (WEIGHTS[f.key as FactorKey] ?? 0), 0) || 1;

  let composite = 0;
  for (const f of factors) {
    const on = active.has(f.key);
    const w = on ? (WEIGHTS[f.key as FactorKey] ?? 0) / activeWeightSum : 0;
    f.enabled = on;
    f.weight = w;
    f.contribution = f.score * w;
    composite += f.contribution;
  }

  const signal: EngineResult["signal"] =
    composite > 0.35 ? "STRONG BUY" :
    composite > 0.15 ? "BUY" :
    composite > -0.15 ? "HOLD" :
    composite > -0.35 ? "SELL" : "STRONG SELL";

  const activeFactors = factors.filter((f) => f.enabled);
  const denom = activeFactors.length || 1;
  const buyCount = activeFactors.filter((f) => f.signal === "BUY").length;
  const sellCount = activeFactors.filter((f) => f.signal === "SELL").length;
  const holdCount = activeFactors.filter((f) => f.signal === "HOLD").length;
  const confidence = (Math.max(buyCount, sellCount) / denom) * 100;

  // ── forecast path (signal-adjusted GBM) ──
  const days = HORIZON_DAYS[horizon];
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sig = Math.sqrt(rets.map((r) => (r - mu) ** 2).reduce((a, b) => a + b, 0) / rets.length);
  const adjMu = mu + composite * 0.002;
  const z80 = 1.282;

  // deterministic seed keyed on last bar + horizon
  let seed = Math.floor((closes[n - 1] * 1000) % 233280) + days;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const norm = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

  const forecastPath: ForecastPoint[] = [];
  let p = last;
  const start = new Date();
  for (let d = 0; d < days; d++) {
    p = p * Math.exp(adjMu + sig * norm());
    const dt = new Date(start);
    dt.setDate(dt.getDate() + d + 1);
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
    const step = d + 1;
    const upper = last * Math.exp(adjMu * step + z80 * sig * Math.sqrt(step));
    const lower = last * Math.exp(adjMu * step - z80 * sig * Math.sqrt(step));
    forecastPath.push({ date: dt.toISOString().slice(0, 10), price: +p.toFixed(2), upper: +upper.toFixed(2), lower: +lower.toFixed(2) });
  }

  const targetPrice = forecastPath[forecastPath.length - 1].price;
  const upsidePct = ((targetPrice - last) / last) * 100;

  // history & indicator series for mini charts
  const start90 = Math.max(0, n - 90);
  const history90 = bars.slice(start90).map((b) => ({ date: b.date, close: b.close, volume: b.volume }));
  const rsi90 = history90.map((h, i) => {
    const slice = closes.slice(0, start90 + i + 1);
    return { date: h.date, rsi: calcRSI(slice) };
  });
  const macd90 = history90.map((h, i) => {
    const slice = closes.slice(0, start90 + i + 1);
    if (slice.length < 35) return { date: h.date, hist: 0, signal: 0 };
    const m = calcMACD(slice);
    return { date: h.date, hist: m.hist, signal: m.signal };
  });

  return {
    signal, compositeScore: composite, confidence,
    factors, buyCount, sellCount, holdCount,
    targetPrice, upsidePct, targetDate: forecastPath[forecastPath.length - 1].date,
    bullTarget: +(targetPrice * 1.08).toFixed(2),
    bearTarget: +(targetPrice * 0.93).toFixed(2),
    supportLevels: { s1, s2, pivot },
    resistanceLevels: { r1, r2 },
    atr, atrPct,
    rsi, macd, bollinger: bb,
    ma: { ma20, ma50, ma200, ema9, ema21 },
    forecastPath, history90, rsi90, macd90,
  };
}

export function barsToOHLCV(bars: { t: number; o: number; h: number; l: number; c: number; v: number }[]): OHLCV[] {
  return bars.map((b) => ({
    date: new Date(b.t).toISOString().slice(0, 10),
    open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
  }));
}
