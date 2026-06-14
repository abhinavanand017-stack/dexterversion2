// Small matrix and stats helpers used by multiple models.

export function mean(a: number[]): number {
  let s = 0;
  for (const v of a) s += v;
  return a.length ? s / a.length : 0;
}

export function std(a: number[], m = mean(a)): number {
  if (a.length < 2) return 0;
  let s = 0;
  for (const v of a) s += (v - m) ** 2;
  return Math.sqrt(s / (a.length - 1));
}

export function rmse(pred: number[], actual: number[]): number {
  const n = Math.min(pred.length, actual.length);
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += (pred[i] - actual[i]) ** 2;
  return Math.sqrt(s / n);
}

export function mape(pred: number[], actual: number[]): number {
  const n = Math.min(pred.length, actual.length);
  if (!n) return 0;
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (actual[i] !== 0) { s += Math.abs((pred[i] - actual[i]) / actual[i]); c++; }
  }
  return c ? (s / c) * 100 : 0;
}

// Box-Muller standard normal
let _spare: number | null = null;
export function randn(): number {
  if (_spare !== null) { const v = _spare; _spare = null; return v; }
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u));
  _spare = mag * Math.sin(2 * Math.PI * v);
  return mag * Math.cos(2 * Math.PI * v);
}

// Solve (XᵀX + αI) β = Xᵀy via Gauss-Jordan elimination.
// X is n×p, y is n.
export function ridgeSolve(X: number[][], y: number[], alpha: number): number[] {
  const n = X.length;
  if (!n) return [];
  const p = X[0].length;
  const A: number[][] = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += X[k][i] * X[k][j];
      A[i][j] = s + (i === j ? alpha : 0);
    }
    let s = 0;
    for (let k = 0; k < n; k++) s += X[k][i] * y[k];
    A[i][p] = s;
  }
  // Gauss-Jordan
  for (let i = 0; i < p; i++) {
    let maxRow = i;
    let maxV = Math.abs(A[i][i]);
    for (let k = i + 1; k < p; k++) {
      if (Math.abs(A[k][i]) > maxV) { maxRow = k; maxV = Math.abs(A[k][i]); }
    }
    if (maxV < 1e-12) continue;
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    const pivot = A[i][i];
    for (let j = i; j <= p; j++) A[i][j] /= pivot;
    for (let k = 0; k < p; k++) {
      if (k === i) continue;
      const f = A[k][i];
      if (f === 0) continue;
      for (let j = i; j <= p; j++) A[k][j] -= f * A[i][j];
    }
  }
  return A.map((r) => r[p]);
}

export function predictLinear(X: number[][], beta: number[]): number[] {
  return X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
}

export function withBias(X: number[][]): number[][] {
  return X.map((row) => [1, ...row]);
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
