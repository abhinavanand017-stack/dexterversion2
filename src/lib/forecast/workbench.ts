// Forecast Workbench — 35-model registry, types, mock data generator, API client.

export type Family =
  | "deep_learning"
  | "ensemble_hybrid"
  | "machine_learning"
  | "statistical"
  | "advanced_niche"
  | "next_gen";

export const FAMILY_LABEL: Record<Family, string> = {
  deep_learning: "Deep Learning",
  ensemble_hybrid: "Ensemble & Hybrid",
  machine_learning: "Machine Learning",
  statistical: "Statistical",
  advanced_niche: "Advanced & Niche",
  next_gen: "Next-Gen",
};

export interface ModelDef { name: string; family: Family }

export const MODEL_REGISTRY: ModelDef[] = [
  // Deep Learning (5)
  { name: "LSTM", family: "deep_learning" },
  { name: "GRU", family: "deep_learning" },
  { name: "BiLSTM", family: "deep_learning" },
  { name: "CNN", family: "deep_learning" },
  { name: "Transformer", family: "deep_learning" },
  // Ensemble & Hybrid (5)
  { name: "RF+XGB+LSTM", family: "ensemble_hybrid" },
  { name: "CNN-LSTM", family: "ensemble_hybrid" },
  { name: "ARIMA-LSTM", family: "ensemble_hybrid" },
  { name: "GRU-SVM", family: "ensemble_hybrid" },
  { name: "ARMA-MLP", family: "ensemble_hybrid" },
  // Machine Learning (5)
  { name: "SVM", family: "machine_learning" },
  { name: "Random Forest", family: "machine_learning" },
  { name: "XGBoost", family: "machine_learning" },
  { name: "KNN", family: "machine_learning" },
  { name: "Decision Tree", family: "machine_learning" },
  // Statistical (5)
  { name: "ARIMA", family: "statistical" },
  { name: "SARIMA", family: "statistical" },
  { name: "Prophet", family: "statistical" },
  { name: "Moving Averages", family: "statistical" },
  { name: "Exponential Smoothing", family: "statistical" },
  // Advanced & Niche (5)
  { name: "Deep RL (DQN)", family: "advanced_niche" },
  { name: "Sentiment Analysis", family: "advanced_niche" },
  { name: "Fuzzy-Neural Network", family: "advanced_niche" },
  { name: "Deep Belief Network", family: "advanced_niche" },
  { name: "MLP", family: "advanced_niche" },
  // Next-Gen (10)
  { name: "Temporal Fusion Transformer", family: "next_gen" },
  { name: "N-BEATS", family: "next_gen" },
  { name: "Graph Neural Network", family: "next_gen" },
  { name: "Kalman Filter", family: "next_gen" },
  { name: "Gaussian Process", family: "next_gen" },
  { name: "LightGBM", family: "next_gen" },
  { name: "CatBoost", family: "next_gen" },
  { name: "Wavelet-LSTM", family: "next_gen" },
  { name: "Echo State Network", family: "next_gen" },
  { name: "Quantile Regression", family: "next_gen" },
];

export type Horizon = "1d" | "5d" | "20d";
export const HORIZON_DAYS: Record<Horizon, number> = { "1d": 1, "5d": 5, "20d": 20 };

export interface RecentPrediction { date: string; predicted: number; actual: number }
export interface ModelForecast {
  name: string;
  family: Family;
  predictedPrice: number;
  rmse: number;
  mae: number;
  mapePct: number;
  directionalAccuracyPct: number;
  weight: number;
  lastBacktestDate: string;
  recentPredictions: RecentPrediction[];
}
export interface Consensus {
  signal: "BUY" | "HOLD" | "SELL";
  confidencePct: number;
  predictedRange: { low: number; median: number; high: number };
  reasoning: string;
  regime: "LOW_VOLATILITY" | "HIGH_VOLATILITY";
}
export interface BacktestPoint { date: string; rollingDirAccPct: number }
export interface ForecastResponse {
  ticker: string;
  asOf: string;
  consensus: Consensus;
  models: ModelForecast[];
  backtestHistory: BacktestPoint[];
  intervalCoverage: { targetPct: number; actualPct: number };
  validationMethod: string;
  historical: { date: string; close: number }[];
  forecastPath: { date: string; median: number; low: number; high: number }[];
  isDemo?: boolean;
  demoReason?: string;
}

// ---------- deterministic PRNG for mock ----------
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function generateMockForecast(ticker: string, horizon: Horizon, selectedModels: string[]): ForecastResponse {
  const rand = mulberry32(hash(`${ticker}|${horizon}`));
  const basePrice = 500 + rand() * 2500;
  const days = 180;
  const now = new Date();
  const historical: { date: string; close: number }[] = [];
  let p = basePrice * (0.85 + rand() * 0.3);
  for (let i = days; i > 0; i--) {
    p *= 1 + (rand() - 0.48) * 0.02;
    const d = new Date(now); d.setDate(d.getDate() - i);
    historical.push({ date: d.toISOString().slice(0, 10), close: +p.toFixed(2) });
  }
  const lastClose = historical[historical.length - 1].close;

  // regime: last 20d realized vol
  const recent = historical.slice(-20).map((h) => h.close);
  const rets: number[] = []; for (let i = 1; i < recent.length; i++) rets.push(Math.log(recent[i] / recent[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * Math.sqrt(252);
  const regime: Consensus["regime"] = vol > 0.28 ? "HIGH_VOLATILITY" : "LOW_VOLATILITY";

  const hDays = HORIZON_DAYS[horizon];
  const drift = (rand() - 0.45) * 0.04 * Math.sqrt(hDays);
  const medianTarget = lastClose * (1 + drift);
  const bandWidth = lastClose * vol * Math.sqrt(hDays / 252) * 1.28; // ~80% band
  const low = medianTarget - bandWidth;
  const high = medianTarget + bandWidth;

  // per-model
  const models: ModelForecast[] = MODEL_REGISTRY
    .filter((m) => selectedModels.includes(m.name))
    .map((m) => {
      const r = mulberry32(hash(`${ticker}|${horizon}|${m.name}`));
      const dirAcc = 45 + r() * 25;                  // 45–70
      const noise = (r() - 0.5) * bandWidth * 1.4;
      const predictedPrice = +(medianTarget + noise).toFixed(2);
      const rmse = +(lastClose * (0.005 + r() * 0.02)).toFixed(2);
      const mae = +(rmse * (0.6 + r() * 0.3)).toFixed(2);
      const mapePct = +((mae / lastClose) * 100).toFixed(2);
      const recentPredictions: RecentPrediction[] = [];
      for (let i = 30; i > 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const idx = historical.length - i;
        const actual = historical[idx]?.close ?? lastClose;
        const pred = actual * (1 + (r() - 0.5) * 0.02);
        recentPredictions.push({ date: d.toISOString().slice(0, 10), predicted: +pred.toFixed(2), actual: +actual.toFixed(2) });
      }
      const lastBt = new Date(now); lastBt.setDate(lastBt.getDate() - 1);
      return { name: m.name, family: m.family, predictedPrice, rmse, mae, mapePct, directionalAccuracyPct: +dirAcc.toFixed(1), weight: 0, lastBacktestDate: lastBt.toISOString().slice(0, 10), recentPredictions };
    });

  // performance-weighted votes
  let wSum = 0;
  for (const m of models) { const eff = Math.max(0, m.directionalAccuracyPct - 50); m.weight = eff; wSum += eff; }
  if (wSum > 0) models.forEach((m) => { m.weight = +(m.weight / wSum).toFixed(4); });
  else models.forEach((m) => { m.weight = +(1 / models.length).toFixed(4); });

  let upVotes = 0, downVotes = 0, upW = 0, downW = 0;
  for (const m of models) {
    const dir = m.predictedPrice >= lastClose ? "up" : "down";
    if (dir === "up") { upVotes++; upW += m.weight; } else { downVotes++; downW += m.weight; }
  }
  const netScore = (upW - downW);
  const signal: Consensus["signal"] = netScore > 0.15 ? "BUY" : netScore < -0.15 ? "SELL" : "HOLD";
  const bandRel = bandWidth / lastClose;
  const confidencePct = Math.max(30, Math.min(95, +((1 - bandRel * 2) * 100).toFixed(1)));

  const reasoning = `${Math.max(upVotes, downVotes)} of ${models.length} models agree on ${netScore >= 0 ? "upward" : "downward"} momentum; regime is ${regime === "HIGH_VOLATILITY" ? "high" : "low"} volatility; Kalman filter trend ${netScore >= 0 ? "positive" : "negative"}.`;

  // forecast path
  const forecastPath: ForecastResponse["forecastPath"] = [];
  for (let i = 1; i <= hDays; i++) {
    const t = i / hDays;
    const med = lastClose + (medianTarget - lastClose) * t;
    const bw = bandWidth * Math.sqrt(t);
    const d = new Date(now); d.setDate(d.getDate() + i);
    forecastPath.push({ date: d.toISOString().slice(0, 10), median: +med.toFixed(2), low: +(med - bw).toFixed(2), high: +(med + bw).toFixed(2) });
  }

  // backtest history (90d rolling directional accuracy)
  const backtestHistory: BacktestPoint[] = [];
  for (let i = 90; i > 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const r = mulberry32(hash(`${ticker}|bt|${i}`));
    backtestHistory.push({ date: d.toISOString().slice(0, 10), rollingDirAccPct: +(50 + (r() - 0.5) * 18).toFixed(1) });
  }

  return {
    ticker,
    asOf: now.toISOString(),
    consensus: { signal, confidencePct, predictedRange: { low: +low.toFixed(2), median: +medianTarget.toFixed(2), high: +high.toFixed(2) }, reasoning, regime },
    models,
    backtestHistory,
    intervalCoverage: { targetPct: 80, actualPct: +(72 + rand() * 12).toFixed(1) },
    validationMethod: "walk_forward_expanding_window",
    historical,
    forecastPath,
    isDemo: true,
    demoReason: "Live forecasting API not connected — displaying deterministic demo data.",
  };
}

export interface ForecastRequest { ticker: string; horizon: Horizon; models: string[] }

export async function fetchForecast(req: ForecastRequest): Promise<ForecastResponse> {
  try {
    const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as ForecastResponse;
    return j;
  } catch {
    return generateMockForecast(req.ticker, req.horizon, req.models);
  }
}
