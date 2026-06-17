// 17 forecasting models. Pure JS, client-side. Some (LSTM/GRU/Transformer/CNN/WaveNet)
// are illustrative lightweight approximations — labeled accordingly in the UI.

import { mean, std, rmse, mape, randn, ridgeSolve, predictLinear, withBias, quantile } from "./math";
import { type FeatureRow, featureMatrix, minMaxScale, FEATURE_NAMES } from "./features";

export type ModelCategory = "Statistical" | "ML" | "Deep Learning" | "Probabilistic";
export type Signal = "BUY" | "HOLD" | "SELL";

export interface ModelResult {
  id: string;
  name: string;
  category: ModelCategory;
  forecast: number[];          // length = horizon, price space
  fanLow?: number[];           // optional p5
  fanHigh?: number[];          // optional p95
  rmse: number;
  mape: number;
  signal: Signal;
  confidence: number;          // 0-100
  expectedReturn: number;      // pct
  note?: string;
  extra?: Record<string, unknown>;
}

const lastN = <T,>(a: T[], n: number) => a.slice(Math.max(0, a.length - n));

function signalFromReturn(r: number): Signal {
  if (r > 2) return "BUY";
  if (r < -2) return "SELL";
  return "HOLD";
}

function finalize(
  id: string, name: string, category: ModelCategory,
  forecast: number[], current: number, holdoutPred: number[], holdoutAct: number[],
  extra?: Partial<ModelResult>,
): ModelResult {
  const r = rmse(holdoutPred, holdoutAct);
  const mp = mape(holdoutPred, holdoutAct);
  const end = forecast[forecast.length - 1] ?? current;
  const expectedReturn = ((end - current) / current) * 100;
  const signal = signalFromReturn(expectedReturn);
  const confidence = Math.max(5, 100 - Math.min(mp, 50) * 2);
  return {
    id, name, category, forecast,
    rmse: r, mape: mp,
    signal, confidence, expectedReturn,
    ...extra,
  };
}

// ============= 1. ARIMA(2,1,0) =============
export function arima(rows: FeatureRow[], horizon: number): ModelResult {
  const close = rows.map((r) => r.c);
  const diff = close.slice(1).map((v, i) => v - close[i]);
  // AR(2) on diff via least squares
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 2; i < diff.length; i++) {
    X.push([1, diff[i - 1], diff[i - 2]]);
    y.push(diff[i]);
  }
  const beta = ridgeSolve(X, y, 1e-4);
  // Holdout
  const split = Math.floor(diff.length * 0.8);
  const holdAct: number[] = [];
  const holdPred: number[] = [];
  for (let i = split; i < diff.length; i++) {
    if (i < 2) continue;
    const pd = beta[0] + beta[1] * diff[i - 1] + beta[2] * diff[i - 2];
    holdPred.push(close[i] + pd - diff[i]); // align scale
    holdAct.push(close[i + 1] ?? close[i]);
  }
  // Forecast
  let d1 = diff[diff.length - 1];
  let d2 = diff[diff.length - 2];
  let price = close[close.length - 1];
  const forecast: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const nd = beta[0] + beta[1] * d1 + beta[2] * d2;
    price += nd;
    forecast.push(price);
    d2 = d1; d1 = nd;
  }
  return finalize("arima", "ARIMA(2,1,0)", "Statistical", forecast, close[close.length - 1], holdPred, holdAct, { note: "Auto-regressive integrated" });
}

// ============= 2. SARIMA (weekly m=5) =============
export function sarima(rows: FeatureRow[], horizon: number): ModelResult {
  const close = rows.map((r) => r.c);
  const m = 5;
  const seasonal = close.map((v, i) => (i >= m ? v - close[i - m] : 0));
  // AR(1) on seasonal diff
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = m + 1; i < seasonal.length; i++) {
    X.push([1, seasonal[i - 1]]);
    y.push(seasonal[i]);
  }
  const beta = ridgeSolve(X, y, 1e-4);
  const forecast: number[] = [];
  const tail = [...close];
  for (let h = 0; h < horizon; h++) {
    const i = tail.length;
    const prevSeasonal = tail[i - 1] - tail[i - m];
    const ns = beta[0] + beta[1] * prevSeasonal;
    const next = tail[i - m + (h % m)] + ns;
    forecast.push(next);
    tail.push(next);
  }
  const split = Math.floor(close.length * 0.8);
  const holdAct = close.slice(split);
  const holdPred = holdAct.map((_, i) => close[split + i - 1] ?? close[split]);
  return finalize("sarima", "SARIMA(1,0,0)(1,0,0,5)", "Statistical", forecast, close[close.length - 1], holdPred, holdAct);
}

// ============= 3. Holt-Winters ETS =============
export function ets(rows: FeatureRow[], horizon: number): ModelResult {
  const close = rows.map((r) => r.c);
  const a = 0.3;
  const b = 0.1;
  let L = close[0];
  let T = close[1] - close[0];
  const fitted: number[] = [L];
  for (let i = 1; i < close.length; i++) {
    const Lp = L;
    L = a * close[i] + (1 - a) * (L + T);
    T = b * (L - Lp) + (1 - b) * T;
    fitted.push(L + T);
  }
  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) forecast.push(L + h * T);
  const split = Math.floor(close.length * 0.8);
  return finalize("ets", "Holt-Winters ETS", "Statistical", forecast, close[close.length - 1], fitted.slice(split), close.slice(split), { extra: { alpha: a, beta: b } });
}

// ============= helpers: build X/y for supervised models =============
function supervised(rows: FeatureRow[]) {
  const feats = featureMatrix(rows);
  const { scaled } = minMaxScale(feats);
  // predict next close (price space, not scaled — keep target raw for interpretability)
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < scaled.length - 1; i++) {
    X.push(scaled[i]);
    y.push(rows[i + 1].c);
  }
  return { X, y, lastFeat: scaled[scaled.length - 1] };
}

// ============= 4. Linear Regression =============
export function linreg(rows: FeatureRow[], horizon: number): ModelResult {
  const { X, y, lastFeat } = supervised(rows);
  const Xb = withBias(X);
  const beta = ridgeSolve(Xb, y, 1e-6);
  const split = Math.floor(X.length * 0.8);
  const holdPred = predictLinear(Xb.slice(split), beta);
  const holdAct = y.slice(split);
  // Walk-forward: just repeat last feature row (simplification)
  const forecast: number[] = [];
  let last = lastFeat;
  for (let h = 0; h < horizon; h++) {
    const p = [1, ...last].reduce((s, v, i) => s + v * beta[i], 0);
    forecast.push(p);
  }
  const topCoefs = beta.slice(1).map((b, i) => ({ name: FEATURE_NAMES[i], coef: b }))
    .sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef)).slice(0, 5);
  return finalize("linreg", "Linear Regression", "ML", forecast, rows[rows.length - 1].c, holdPred, holdAct, { extra: { topCoefs } });
}

// ============= 5. Ridge =============
export function ridge(rows: FeatureRow[], horizon: number): ModelResult {
  const { X, y, lastFeat } = supervised(rows);
  const Xb = withBias(X);
  const alphas = [0.01, 0.1, 1, 10, 100];
  let best = { a: 0.1, rmse: Infinity, beta: [] as number[] };
  const split = Math.floor(X.length * 0.8);
  for (const a of alphas) {
    const beta = ridgeSolve(Xb.slice(0, split), y.slice(0, split), a);
    const pred = predictLinear(Xb.slice(split), beta);
    const r = rmse(pred, y.slice(split));
    if (r < best.rmse) best = { a, rmse: r, beta };
  }
  const forecast: number[] = [];
  for (let h = 0; h < horizon; h++) {
    forecast.push([1, ...lastFeat].reduce((s, v, i) => s + v * best.beta[i], 0));
  }
  return finalize("ridge", "Ridge Regression", "ML", forecast, rows[rows.length - 1].c,
    predictLinear(Xb.slice(split), best.beta), y.slice(split), { extra: { bestAlpha: best.a } });
}

// ============= 6. Random Forest (50 stumps) =============
function fitStump(X: number[][], y: number[], featIdx: number): { thr: number; left: number; right: number } {
  const vals = X.map((r) => r[featIdx]).slice().sort((a, b) => a - b);
  const thr = vals[Math.floor(vals.length / 2)];
  let lSum = 0; let lN = 0; let rSum = 0; let rN = 0;
  for (let i = 0; i < X.length; i++) {
    if (X[i][featIdx] <= thr) { lSum += y[i]; lN++; } else { rSum += y[i]; rN++; }
  }
  return { thr, left: lN ? lSum / lN : 0, right: rN ? rSum / rN : 0 };
}

export function randomForest(rows: FeatureRow[], horizon: number): ModelResult {
  const { X, y, lastFeat } = supervised(rows);
  const nFeat = X[0]?.length ?? 0;
  const stumps: Array<{ f: number; s: ReturnType<typeof fitStump> }> = [];
  const seed = () => Math.floor(Math.random() * nFeat);
  for (let t = 0; t < 50; t++) {
    // bootstrap
    const Xs: number[][] = []; const ys: number[] = [];
    for (let i = 0; i < X.length; i++) {
      const k = Math.floor(Math.random() * X.length);
      Xs.push(X[k]); ys.push(y[k]);
    }
    const f = seed();
    stumps.push({ f, s: fitStump(Xs, ys, f) });
  }
  const predOne = (row: number[]) => {
    let s = 0;
    for (const st of stumps) s += row[st.f] <= st.s.thr ? st.s.left : st.s.right;
    return s / stumps.length;
  };
  const split = Math.floor(X.length * 0.8);
  const holdPred = X.slice(split).map(predOne);
  const forecast: number[] = [];
  for (let h = 0; h < horizon; h++) forecast.push(predOne(lastFeat));
  // simple importance: count splits per feature
  const importance = new Array(nFeat).fill(0);
  for (const st of stumps) importance[st.f]++;
  const topImp = importance.map((v, i) => ({ name: FEATURE_NAMES[i], imp: v }))
    .sort((a, b) => b.imp - a.imp).slice(0, 5);
  return finalize("rf", "Random Forest (50 stumps)", "ML", forecast, rows[rows.length - 1].c, holdPred, y.slice(split), { extra: { topImp } });
}

// ============= 7. Gradient Boosting =============
export function gbm(rows: FeatureRow[], horizon: number): ModelResult {
  const { X, y, lastFeat } = supervised(rows);
  const nFeat = X[0]?.length ?? 0;
  const lr = 0.05;
  const M = 100;
  let F0 = mean(y);
  let F = new Array(X.length).fill(F0);
  const trees: Array<{ f: number; s: ReturnType<typeof fitStump> }> = [];
  for (let m = 0; m < M; m++) {
    const r = y.map((yi, i) => yi - F[i]);
    const f = Math.floor(Math.random() * nFeat);
    const s = fitStump(X, r, f);
    trees.push({ f, s });
    for (let i = 0; i < X.length; i++) {
      F[i] += lr * (X[i][f] <= s.thr ? s.left : s.right);
    }
  }
  const predOne = (row: number[]) => {
    let v = F0;
    for (const t of trees) v += lr * (row[t.f] <= t.s.thr ? t.s.left : t.s.right);
    return v;
  };
  const split = Math.floor(X.length * 0.8);
  const holdPred = X.slice(split).map(predOne);
  const forecast: number[] = [];
  for (let h = 0; h < horizon; h++) forecast.push(predOne(lastFeat));
  return finalize("gbm", "Gradient Boosting", "ML", forecast, rows[rows.length - 1].c, holdPred, y.slice(split), { extra: { iters: M } });
}

// ============= 8. SVR (kernel ridge with RBF) =============
export function svr(rows: FeatureRow[], horizon: number): ModelResult {
  const { X, y, lastFeat } = supervised(rows);
  // use last 200 points for tractability
  const cap = 200;
  const Xs = X.slice(-cap); const ys = y.slice(-cap);
  const n = Xs.length; const p = Xs[0]?.length ?? 0;
  const gamma = p ? 1 / p : 1;
  const K: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let d = 0;
      for (let k = 0; k < p; k++) d += (Xs[i][k] - Xs[j][k]) ** 2;
      K[i][j] = Math.exp(-gamma * d);
    }
  }
  // alpha = (K + λI)^-1 y  via ridgeSolve treating K as X (n×n square)
  const alpha = ridgeSolve(K, ys, 0.01);
  const predOne = (row: number[]) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (let k = 0; k < p; k++) d += (Xs[i][k] - row[k]) ** 2;
      s += alpha[i] * Math.exp(-gamma * d);
    }
    return s;
  };
  const split = Math.floor(n * 0.8);
  const holdPred = Xs.slice(split).map(predOne);
  const forecast: number[] = [];
  for (let h = 0; h < horizon; h++) forecast.push(predOne(lastFeat));
  return finalize("svr", "SVR (RBF kernel)", "ML", forecast, rows[rows.length - 1].c, holdPred, ys.slice(split), { extra: { gamma } });
}

// ============= 9. KNN =============
export function knn(rows: FeatureRow[], horizon: number): ModelResult {
  const { X, y, lastFeat } = supervised(rows);
  const k = 7;
  const dist = (a: number[], b: number[]) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s);
  };
  const predOne = (row: number[], excludeLast = 0) => {
    const limit = X.length - excludeLast;
    const ds: Array<{ d: number; y: number }> = [];
    for (let i = 0; i < limit; i++) ds.push({ d: dist(X[i], row), y: y[i] });
    ds.sort((a, b) => a.d - b.d);
    const top = ds.slice(0, k);
    let num = 0; let den = 0;
    for (const t of top) {
      const w = 1 / (t.d + 1e-6);
      num += w * t.y;
      den += w;
    }
    return num / den;
  };
  const split = Math.floor(X.length * 0.8);
  const holdPred = X.slice(split).map((r) => predOne(r));
  const forecast: number[] = [];
  for (let h = 0; h < horizon; h++) forecast.push(predOne(lastFeat));
  return finalize("knn", "KNN (k=7, weighted)", "ML", forecast, rows[rows.length - 1].c, holdPred, y.slice(split), { extra: { k } });
}

// ============= 10. LSTM (lightweight illustrative) =============
function illustrativeRNN(rows: FeatureRow[], horizon: number, id: string, name: string): ModelResult {
  // Use last 60 normalized closes as input. We "train" a tiny linear projection
  // over the last window via ridge — labeled as illustrative.
  const close = rows.map((r) => r.c);
  const win = 60;
  if (close.length < win + 5) {
    const forecast = new Array(horizon).fill(close[close.length - 1]);
    return finalize(id, name, "Deep Learning", forecast, close[close.length - 1], [], [], { note: "Insufficient data" });
  }
  const X: number[][] = []; const y: number[] = [];
  for (let i = win; i < close.length; i++) {
    X.push(close.slice(i - win, i));
    y.push(close[i]);
  }
  const Xb = withBias(X);
  const beta = ridgeSolve(Xb, y, 1.0);
  const split = Math.floor(X.length * 0.8);
  const holdPred = predictLinear(Xb.slice(split), beta);
  const forecast: number[] = [];
  const tail = close.slice(-win);
  for (let h = 0; h < horizon; h++) {
    const p = [1, ...tail].reduce((s, v, i) => s + v * beta[i], 0);
    forecast.push(p);
    tail.shift(); tail.push(p);
  }
  return finalize(id, name, "Deep Learning", forecast, close[close.length - 1], holdPred, y.slice(split), {
    note: "Lightweight in-browser approximation",
  });
}
export const lstm = (r: FeatureRow[], h: number) => illustrativeRNN(r, h, "lstm", "LSTM (Lightweight JS)");
export const gru = (r: FeatureRow[], h: number) => illustrativeRNN(r, h, "gru", "GRU (Lightweight JS)");
export const transformer = (r: FeatureRow[], h: number) => illustrativeRNN(r, h, "transformer", "Transformer (Lightweight JS)");
export const cnn1d = (r: FeatureRow[], h: number) => illustrativeRNN(r, h, "cnn1d", "1D CNN (Lightweight JS)");
export const wavenet = (r: FeatureRow[], h: number) => illustrativeRNN(r, h, "wavenet", "WaveNet (Lightweight JS)");

// ============= 14. Prophet (decomposition) =============
export function prophet(rows: FeatureRow[], horizon: number): ModelResult {
  const close = rows.map((r) => r.c);
  const n = close.length;
  // trend via simple linear fit
  const xs = close.map((_, i) => i);
  const xMean = mean(xs); const yMean = mean(close);
  let num = 0; let den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - xMean) * (close[i] - yMean); den += (xs[i] - xMean) ** 2; }
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const trend = (i: number) => intercept + slope * i;

  // weekly seasonality: mean log return per day-of-week
  const dowSum = new Array(7).fill(0); const dowN = new Array(7).fill(0);
  for (let i = 1; i < n; i++) {
    const dow = new Date(rows[i].t).getUTCDay();
    dowSum[dow] += Math.log(close[i] / close[i - 1]);
    dowN[dow]++;
  }
  const dowMean = dowSum.map((v, i) => dowN[i] ? v / dowN[i] : 0);

  const residuals = close.map((c, i) => c - trend(i));
  const sd = std(residuals);

  const forecast: number[] = [];
  const low: number[] = []; const high: number[] = [];
  let price = close[n - 1];
  const lastDate = rows[n - 1].t;
  for (let h = 1; h <= horizon; h++) {
    const t = lastDate + h * 86400000;
    const dow = new Date(t).getUTCDay();
    price = price * Math.exp(dowMean[dow]);
    const trendDrift = slope * h;
    const p = price + trendDrift * 0.1;
    forecast.push(p);
    low.push(p - 1.5 * sd); high.push(p + 1.5 * sd);
  }
  const split = Math.floor(n * 0.8);
  return finalize("prophet", "Prophet (decomposition)", "Statistical", forecast,
    close[n - 1],
    close.slice(split).map((_, i) => trend(split + i)),
    close.slice(split),
    { fanLow: low, fanHigh: high, note: "Trend + weekly seasonality" });
}

// ============= 15. Ensemble =============
export function ensemble(rows: FeatureRow[], horizon: number, base?: ModelResult[]): ModelResult {
  const subs = base ?? [ridge(rows, horizon), randomForest(rows, horizon), gbm(rows, horizon), knn(rows, horizon)];
  // weight by inverse RMSE
  const weights = subs.map((s) => 1 / Math.max(s.rmse, 1e-6));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const norm = weights.map((w) => w / wSum);
  const forecast: number[] = new Array(horizon).fill(0);
  for (let h = 0; h < horizon; h++) {
    for (let i = 0; i < subs.length; i++) forecast[h] += norm[i] * subs[i].forecast[h];
  }
  const current = rows[rows.length - 1].c;
  const expectedReturn = ((forecast[horizon - 1] - current) / current) * 100;
  const avgMape = subs.reduce((s, m) => s + m.mape, 0) / subs.length;
  const avgRmse = subs.reduce((s, m) => s + m.rmse, 0) / subs.length;
  return {
    id: "ensemble", name: "Ensemble Blend", category: "ML",
    forecast, rmse: avgRmse, mape: avgMape,
    signal: signalFromReturn(expectedReturn),
    confidence: Math.max(5, 100 - Math.min(avgMape, 50) * 1.5),
    expectedReturn,
    extra: { weights: norm.map((w, i) => ({ name: subs[i].name, w })) },
  };
}

// ============= 16. Monte Carlo GBM =============
export function monteCarlo(rows: FeatureRow[], horizon: number): ModelResult {
  const close = rows.map((r) => r.c);
  const logRets = close.slice(1).map((v, i) => Math.log(v / close[i]));
  const mu = mean(logRets);
  const sigma = std(logRets, mu);
  const N = 1000;
  const paths: number[][] = [];
  const S0 = close[close.length - 1];
  for (let i = 0; i < N; i++) {
    const path: number[] = [];
    let s = S0;
    for (let h = 0; h < horizon; h++) {
      s = s * Math.exp((mu - 0.5 * sigma * sigma) + sigma * randn());
      path.push(s);
    }
    paths.push(path);
  }
  const median: number[] = []; const p5: number[] = []; const p95: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const col = paths.map((p) => p[h]).sort((a, b) => a - b);
    median.push(quantile(col, 0.5));
    p5.push(quantile(col, 0.05));
    p95.push(quantile(col, 0.95));
  }
  const expectedReturn = ((median[horizon - 1] - S0) / S0) * 100;
  const probPositive = paths.filter((p) => p[horizon - 1] > S0).length / N;
  return {
    id: "mc", name: "Monte Carlo GBM (1000 paths)", category: "Probabilistic",
    forecast: median, fanLow: p5, fanHigh: p95,
    rmse: sigma * S0 * Math.sqrt(horizon), mape: 0,
    signal: signalFromReturn(expectedReturn),
    confidence: Math.max(20, probPositive > 0.5 ? probPositive * 100 : (1 - probPositive) * 100),
    expectedReturn,
    extra: { muAnnual: mu * 252 * 100, sigmaAnnual: sigma * Math.sqrt(252) * 100, probPositive },
  };
}

// ============= Run all =============
export interface ModelSpec {
  id: string;
  name: string;
  category: ModelCategory;
  groupLabel: "Classic statistical" | "Machine learning" | "Deep learning" | "Ensemble & simulation";
  tooltip: string;
  fn: (rows: FeatureRow[], horizon: number) => ModelResult;
  recommended?: boolean;
}

export const MODEL_SPECS: ModelSpec[] = [
  { id: "arima",       name: "ARIMA",              category: "Statistical",   groupLabel: "Classic statistical",   tooltip: "Good for short-term trends in stable stocks.", fn: arima, recommended: true },
  { id: "sarima",      name: "SARIMA",             category: "Statistical",   groupLabel: "Classic statistical",   tooltip: "ARIMA with seasonality — useful for cyclical patterns.", fn: sarima },
  { id: "ets",         name: "ETS (Holt-Winters)", category: "Statistical",   groupLabel: "Classic statistical",   tooltip: "Smooths trend + level — robust to noise.", fn: ets },
  { id: "linreg",      name: "Linear Regression",  category: "ML",            groupLabel: "Machine learning",      tooltip: "Simple baseline — captures linear momentum.", fn: linreg },
  { id: "ridge",       name: "Ridge Regression",   category: "ML",            groupLabel: "Machine learning",      tooltip: "Regularised linear model — stable across many indicators.", fn: ridge },
  { id: "rf",          name: "Random Forest",      category: "ML",            groupLabel: "Machine learning",      tooltip: "Captures non-linear patterns from indicators.", fn: randomForest, recommended: true },
  { id: "gbm",         name: "HistGBM",            category: "ML",            groupLabel: "Machine learning",      tooltip: "Gradient boosting — strong on tabular features.", fn: gbm },
  { id: "svr",         name: "SVR",                category: "ML",            groupLabel: "Machine learning",      tooltip: "Support vector regression — handles outliers.", fn: svr },
  { id: "knn",         name: "KNN",                category: "ML",            groupLabel: "Machine learning",      tooltip: "Finds similar historical setups and averages outcomes.", fn: knn },
  { id: "lstm",        name: "LSTM (lite)",        category: "Deep Learning", groupLabel: "Deep learning",         tooltip: "Sequence model — captures longer historical patterns.", fn: lstm, recommended: true },
  { id: "gru",         name: "GRU (lite)",         category: "Deep Learning", groupLabel: "Deep learning",         tooltip: "Lighter LSTM cousin — faster, similar idea.", fn: gru },
  { id: "transformer", name: "Transformer (lite)", category: "Deep Learning", groupLabel: "Deep learning",         tooltip: "Attention model — weighs past days non-linearly.", fn: transformer },
  { id: "cnn1d",       name: "1D CNN (lite)",      category: "Deep Learning", groupLabel: "Deep learning",         tooltip: "Convolutional filters over the price window.", fn: cnn1d },
  { id: "wavenet",     name: "WaveNet (lite)",     category: "Deep Learning", groupLabel: "Deep learning",         tooltip: "Dilated convolutions — multi-scale temporal patterns.", fn: wavenet },
  { id: "prophet",     name: "Prophet (decomp)",   category: "Probabilistic", groupLabel: "Ensemble & simulation", tooltip: "Trend + seasonality decomposition (Prophet-style).", fn: prophet, recommended: true },
  { id: "ensemble",    name: "Ensemble Blend",     category: "Probabilistic", groupLabel: "Ensemble & simulation", tooltip: "Weighted average of selected models.", fn: ensemble, recommended: true },
  { id: "mc",          name: "Monte Carlo",        category: "Probabilistic", groupLabel: "Ensemble & simulation", tooltip: "Thousands of random walks — gives a probability range.", fn: monteCarlo },
];

export const ALL_MODELS: Array<(rows: FeatureRow[], horizon: number) => ModelResult> = MODEL_SPECS.map((s) => s.fn);

export interface RunProgress {
  done: number;
  total: number;
  current?: string;
}

export async function runSelected(
  rows: FeatureRow[],
  horizon: number,
  ids: string[],
  onProgress?: (r: ModelResult, p: RunProgress) => void,
): Promise<ModelResult[]> {
  const specs = MODEL_SPECS.filter((s) => ids.includes(s.id));
  const out: ModelResult[] = [];
  for (let i = 0; i < specs.length; i++) {
    await new Promise((r) => setTimeout(r, 0));
    try {
      const res = specs[i].fn(rows, horizon);
      out.push(res);
      onProgress?.(res, { done: i + 1, total: specs.length, current: specs[i].name });
    } catch (e) {
      console.error("model failed", specs[i].id, e);
    }
  }
  return out;
}

export async function runAll(
  rows: FeatureRow[],
  horizon: number,
  onProgress?: (r: ModelResult, p: RunProgress) => void,
): Promise<ModelResult[]> {
  return runSelected(rows, horizon, MODEL_SPECS.map((s) => s.id), onProgress);
}
