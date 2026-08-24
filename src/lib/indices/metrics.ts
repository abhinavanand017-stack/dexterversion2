// Pure math for the /indices dashboard. Every number the UI shows comes from
// here (computed on fetched bars) — never from the LLM.

export interface Bar { t: number; o: number; h: number; l: number; c: number; v: number }
export interface Point { t: number; v: number }

const TRADING_DAYS = 252;

export function lastClose(bars: Bar[]): number {
  return bars.length ? bars[bars.length - 1].c : 0;
}

/** Close n calendar-days back (nearest bar at or before the cutoff). */
function closeDaysAgo(bars: Bar[], days: number): number | null {
  if (!bars.length) return null;
  const cutoff = bars[bars.length - 1].t - days * 86_400_000;
  let found: Bar | null = null;
  for (const b of bars) { if (b.t <= cutoff) found = b; else break; }
  return found ? found.c : null;
}

export interface ReturnsRow { label: string; pct: number | null; annualized?: boolean }

export function returnsTable(bars: Bar[]): ReturnsRow[] {
  const last = lastClose(bars);
  if (!last) return [];
  const simple = (days: number, label: string): ReturnsRow => {
    const base = closeDaysAgo(bars, days);
    return { label, pct: base ? ((last - base) / base) * 100 : null };
  };
  const cagr = (years: number, label: string): ReturnsRow => {
    const base = closeDaysAgo(bars, Math.round(years * 365));
    return { label, pct: base ? (Math.pow(last / base, 1 / years) - 1) * 100 : null, annualized: true };
  };
  // YTD
  const lastT = new Date(bars[bars.length - 1].t);
  const jan1 = Date.UTC(lastT.getUTCFullYear(), 0, 1);
  let ytdBase: number | null = null;
  for (const b of bars) { if (b.t <= jan1) ytdBase = b.c; else break; }
  if (ytdBase == null && bars.length) ytdBase = bars.find((b) => b.t >= jan1)?.c ?? null;

  const first = bars[0];
  const yearsAll = (bars[bars.length - 1].t - first.t) / (365 * 86_400_000);

  return [
    simple(1, "1D"),
    simple(7, "1W"),
    simple(30, "1M"),
    simple(91, "3M"),
    simple(182, "6M"),
    { label: "YTD", pct: ytdBase ? ((last - ytdBase) / ytdBase) * 100 : null },
    simple(365, "1Y"),
    cagr(3, "3Y"),
    cagr(5, "5Y"),
    { label: `Since ${new Date(first.t).getUTCFullYear()}`, pct: yearsAll > 1 ? (Math.pow(last / first.c, 1 / yearsAll) - 1) * 100 : null, annualized: true },
  ];
}

export function calendarYearReturns(bars: Bar[], years = 10): { year: number; pct: number }[] {
  const byYear = new Map<number, { first: number; last: number }>();
  for (const b of bars) {
    const y = new Date(b.t).getUTCFullYear();
    const e = byYear.get(y);
    if (!e) byYear.set(y, { first: b.c, last: b.c });
    else e.last = b.c;
  }
  const out: { year: number; pct: number }[] = [];
  const sorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  let prevClose: number | null = null;
  for (const [year, v] of sorted) {
    const base = prevClose ?? v.first;
    out.push({ year, pct: ((v.last - base) / base) * 100 });
    prevClose = v.last;
  }
  return out.slice(-years);
}

export interface DrawdownResult {
  series: Point[];               // % below running peak (negative)
  maxDrawdownPct: number;
  peakDate: number | null;
  troughDate: number | null;
  recoveryDate: number | null;
  recoveryDays: number | null;
}

export function drawdown(bars: Bar[]): DrawdownResult {
  const series: Point[] = [];
  let peak = -Infinity, peakT = 0;
  let maxDd = 0, maxPeakT: number | null = null, maxTroughT: number | null = null;
  for (const b of bars) {
    if (b.c > peak) { peak = b.c; peakT = b.t; }
    const dd = ((b.c - peak) / peak) * 100;
    series.push({ t: b.t, v: dd });
    if (dd < maxDd) { maxDd = dd; maxPeakT = peakT; maxTroughT = b.t; }
  }
  let recoveryDate: number | null = null;
  if (maxPeakT != null && maxTroughT != null) {
    const peakClose = bars.find((b) => b.t === maxPeakT)?.c ?? 0;
    const after = bars.filter((b) => b.t > maxTroughT!);
    recoveryDate = after.find((b) => b.c >= peakClose)?.t ?? null;
  }
  return {
    series,
    maxDrawdownPct: maxDd,
    peakDate: maxPeakT,
    troughDate: maxTroughT,
    recoveryDate,
    recoveryDays: recoveryDate && maxTroughT ? Math.round((recoveryDate - maxTroughT) / 86_400_000) : null,
  };
}

export function dailyReturns(bars: Bar[]): { t: number; r: number }[] {
  const out: { t: number; r: number }[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    if (prev > 0) out.push({ t: bars[i].t, r: bars[i].c / prev - 1 });
  }
  return out;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Annualized volatility % over a trailing window of trading days. */
export function rollingVolatility(bars: Bar[], window: number): Point[] {
  const rets = dailyReturns(bars);
  const out: Point[] = [];
  for (let i = window; i < rets.length; i++) {
    const slice = rets.slice(i - window, i).map((r) => r.r);
    out.push({ t: rets[i].t, v: stdev(slice) * Math.sqrt(TRADING_DAYS) * 100 });
  }
  return out;
}

export function annualizedVol(bars: Bar[], lookback = TRADING_DAYS): number | null {
  const rets = dailyReturns(bars).slice(-lookback).map((r) => r.r);
  if (rets.length < 20) return null;
  return stdev(rets) * Math.sqrt(TRADING_DAYS) * 100;
}

/** Pearson correlation of daily returns aligned on calendar date. */
export function correlation(a: Bar[], b: Bar[], lookback = TRADING_DAYS): number | null {
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);
  const ma = new Map(dailyReturns(a).map((r) => [key(r.t), r.r]));
  const pairs: [number, number][] = [];
  for (const r of dailyReturns(b)) {
    const x = ma.get(key(r.t));
    if (x != null) pairs.push([x, r.r]);
  }
  const p = pairs.slice(-lookback);
  if (p.length < 20) return null;
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < p.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

/** Rebase multiple series to 100 at the first common date on/after `startMs`. */
export function rebase(series: { key: string; bars: Bar[] }[], startMs: number): Record<string, number | string>[] {
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const maps = series.map((s) => {
    const m = new Map<string, number>();
    for (const b of s.bars) if (b.t >= startMs) m.set(day(b.t), b.c);
    return { key: s.key, m };
  });
  const dates = [...new Set(maps.flatMap((s) => [...s.m.keys()]))].sort();
  const bases = new Map<string, number>();
  const rows: Record<string, number | string>[] = [];
  const lastSeen = new Map<string, number>();
  for (const d of dates) {
    const row: Record<string, number | string> = { date: d };
    let any = false;
    for (const s of maps) {
      const v = s.m.get(d) ?? lastSeen.get(s.key);
      if (v == null) continue;
      lastSeen.set(s.key, v);
      if (!bases.has(s.key)) bases.set(s.key, v);
      row[s.key] = (v / bases.get(s.key)!) * 100;
      any = true;
    }
    if (any) rows.push(row);
  }
  return rows;
}

/**
 * Price-implied P/E history: PE_t = PE_now × (price_t / price_now).
 * Holds earnings constant, so it is an APPROXIMATION (badged "Reference"),
 * used only to draw the historical valuation band.
 */
export function peBand(bars: Bar[], peNow: number, years: number): {
  series: Point[]; mean: number; sd: number; upper: number; lower: number; zScore: number;
} | null {
  if (!peNow || !bars.length) return null;
  const cutoff = bars[bars.length - 1].t - years * 365 * 86_400_000;
  const window = bars.filter((b) => b.t >= cutoff);
  if (window.length < 100) return null;
  const now = lastClose(bars);
  const series = window.map((b) => ({ t: b.t, v: peNow * (b.c / now) }));
  const vals = series.map((s) => s.v);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = stdev(vals);
  return { series, mean, sd, upper: mean + sd, lower: mean - sd, zScore: sd ? (peNow - mean) / sd : 0 };
}

/** Fair-value index range implied by the historical P/E band. */
export function fairValueRange(price: number, peNow: number, band: { mean: number; sd: number }) {
  const f = (targetPe: number) => (price * targetPe) / peNow;
  return { low: f(band.mean - band.sd), base: f(band.mean), high: f(band.mean + band.sd) };
}

/** Lognormal 12-month scenario set built from historical drift + vol. */
export function scenarios(bars: Bar[]) {
  const price = lastClose(bars);
  const rets = dailyReturns(bars).slice(-3 * TRADING_DAYS).map((r) => r.r);
  if (!price || rets.length < 60) return null;
  const mu = rets.reduce((a, b) => a + b, 0) / rets.length * TRADING_DAYS;
  const sigma = stdev(rets) * Math.sqrt(TRADING_DAYS);
  const base = price * Math.exp(mu);
  const bull = price * Math.exp(mu + sigma);
  const bear = price * Math.exp(mu - sigma);
  // Probabilities from the lognormal: split at the ±0.5σ boundaries.
  const cdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
  const pBear = cdf(-0.5);
  const pBull = 1 - cdf(0.5);
  const pBase = 1 - pBear - pBull;
  const r = (x: number) => Math.round(x * 1000) / 10;
  return {
    price, mu: mu * 100, sigma: sigma * 100,
    bull: { target: bull, prob: r(pBull), retPct: (bull / price - 1) * 100 },
    base: { target: base, prob: r(pBase), retPct: (base / price - 1) * 100 },
    bear: { target: bear, prob: r(pBear), retPct: (bear / price - 1) * 100 },
    weighted: ((pBull * bull + pBase * base + pBear * bear) / price - 1) * 100,
  };
}

function erf(x: number): number {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

export function pctAbove200dma(bars: Bar[]): number | null {
  if (bars.length < 200) return null;
  const ma = bars.slice(-200).reduce((a, b) => a + b.c, 0) / 200;
  return ((lastClose(bars) - ma) / ma) * 100;
}
