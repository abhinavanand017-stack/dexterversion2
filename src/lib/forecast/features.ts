// Technical indicator computation for the Dexter forecasting engine.
// Pure functions over arrays of OHLCV bars.

export interface Bar {
  t: number; // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface FeatureRow {
  t: number;
  c: number;
  sma10: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  macd: number;
  macdSignal: number;
  rsi14: number;
  bbUpper: number;
  bbLower: number;
  bbWidth: number;
  atr14: number;
  volChange: number;
  logReturn: number;
}

const sma = (arr: number[], i: number, n: number): number => {
  if (i + 1 < n) return arr[i];
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
};

const stdev = (arr: number[], i: number, n: number, mean: number): number => {
  if (i + 1 < n) return 0;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += (arr[k] - mean) ** 2;
  return Math.sqrt(s / n);
};

function ema(arr: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const out = new Array<number>(arr.length);
  out[0] = arr[0];
  for (let i = 1; i < arr.length; i++) out[i] = arr[i] * k + out[i - 1] * (1 - k);
  return out;
}

function rsi(close: number[], period = 14): number[] {
  const out = new Array<number>(close.length).fill(50);
  let avgG = 0;
  let avgL = 0;
  for (let i = 1; i < close.length; i++) {
    const ch = close[i] - close[i - 1];
    const g = Math.max(ch, 0);
    const l = Math.max(-ch, 0);
    if (i <= period) {
      avgG += g / period;
      avgL += l / period;
    } else {
      avgG = (avgG * (period - 1) + g) / period;
      avgL = (avgL * (period - 1) + l) / period;
    }
    const rs = avgL === 0 ? 100 : avgG / avgL;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function atr(bars: Bar[], period = 14): number[] {
  const tr = bars.map((b, i) => {
    if (i === 0) return b.h - b.l;
    const pc = bars[i - 1].c;
    return Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
  });
  const out = new Array<number>(bars.length).fill(0);
  let prev = 0;
  for (let i = 0; i < tr.length; i++) {
    if (i < period) {
      prev += tr[i] / period;
      out[i] = prev;
    } else {
      prev = (prev * (period - 1) + tr[i]) / period;
      out[i] = prev;
    }
  }
  return out;
}

export function buildFeatures(bars: Bar[]): FeatureRow[] {
  const close = bars.map((b) => b.c);
  const vol = bars.map((b) => b.v);
  const e12 = ema(close, 12);
  const e26 = ema(close, 26);
  const macd = e12.map((v, i) => v - e26[i]);
  const macdSig = ema(macd, 9);
  const rsiArr = rsi(close, 14);
  const atrArr = atr(bars, 14);

  const out: FeatureRow[] = [];
  for (let i = 0; i < bars.length; i++) {
    const m20 = sma(close, i, 20);
    const sd20 = stdev(close, i, 20, m20);
    out.push({
      t: bars[i].t,
      c: close[i],
      sma10: sma(close, i, 10),
      sma20: m20,
      sma50: sma(close, i, 50),
      ema12: e12[i],
      ema26: e26[i],
      macd: macd[i],
      macdSignal: macdSig[i],
      rsi14: rsiArr[i],
      bbUpper: m20 + 2 * sd20,
      bbLower: m20 - 2 * sd20,
      bbWidth: 4 * sd20,
      atr14: atrArr[i],
      volChange: i === 0 ? 0 : (vol[i] - vol[i - 1]) / Math.max(vol[i - 1], 1),
      logReturn: i === 0 ? 0 : Math.log(close[i] / close[i - 1]),
    });
  }
  return out;
}

export function minMaxScale(matrix: number[][]): { scaled: number[][]; mins: number[]; maxs: number[] } {
  if (!matrix.length) return { scaled: [], mins: [], maxs: [] };
  const cols = matrix[0].length;
  const mins = new Array(cols).fill(Infinity);
  const maxs = new Array(cols).fill(-Infinity);
  for (const row of matrix) {
    for (let j = 0; j < cols; j++) {
      if (row[j] < mins[j]) mins[j] = row[j];
      if (row[j] > maxs[j]) maxs[j] = row[j];
    }
  }
  const scaled = matrix.map((row) =>
    row.map((v, j) => {
      const range = maxs[j] - mins[j];
      return range === 0 ? 0 : (v - mins[j]) / range;
    }),
  );
  return { scaled, mins, maxs };
}

export function featureMatrix(rows: FeatureRow[]): number[][] {
  return rows.map((r) => [
    r.sma10, r.sma20, r.sma50, r.ema12, r.ema26, r.macd, r.macdSignal,
    r.rsi14, r.bbUpper, r.bbLower, r.bbWidth, r.atr14, r.volChange, r.logReturn,
  ]);
}

export const FEATURE_NAMES = [
  "SMA10", "SMA20", "SMA50", "EMA12", "EMA26", "MACD", "MACD_Signal",
  "RSI14", "BB_Upper", "BB_Lower", "BB_Width", "ATR14", "Vol_Change", "Log_Return",
];
