// Accuracy / consensus / history helpers for the Forecaster.
// Historical-accuracy figures below are indicative baselines from the spec,
// not live-computed. They're used to render a "±X%" badge per model.

import type { ModelResult } from "./models";
import type { Consensus } from "./consensus";

export const MODEL_ACCURACY: Record<string, { mape: number; hitRate: number }> = {
  arima:       { mape: 4.5, hitRate: 58 },
  sarima:      { mape: 5.1, hitRate: 55 },
  ets:         { mape: 4.2, hitRate: 60 },
  linreg:      { mape: 5.8, hitRate: 54 },
  ridge:       { mape: 5.4, hitRate: 56 },
  rf:          { mape: 4.9, hitRate: 61 },
  gbm:         { mape: 4.6, hitRate: 63 },
  svr:         { mape: 6.2, hitRate: 52 },
  knn:         { mape: 6.5, hitRate: 51 },
  lstm:        { mape: 5.0, hitRate: 59 },
  gru:         { mape: 5.1, hitRate: 58 },
  transformer: { mape: 5.3, hitRate: 57 },
  cnn1d:       { mape: 5.6, hitRate: 55 },
  wavenet:     { mape: 5.5, hitRate: 55 },
  prophet:     { mape: 4.8, hitRate: 60 },
  ensemble:    { mape: 3.9, hitRate: 65 },
  mc:          { mape: 6.0, hitRate: 62 },
};

export function accuracyColor(mape: number): string {
  if (mape <= 4.5) return "#00ff88";
  if (mape <= 5.5) return "#ffaa00";
  return "#ff4466";
}

export function plainConsensus(
  name: string,
  horizon: number,
  c: Consensus,
  currency = "₹",
): string {
  const dir = c.score >= 2 ? "higher" : c.score <= -2 ? "lower" : "roughly flat";
  const strength = c.agreement >= 0.75 ? "strong" : c.agreement >= 0.55 ? "moderate" : "weak";
  const rangeTxt = `${currency}${c.targetLow.toLocaleString("en-IN", { maximumFractionDigits: 2 })}–${currency}${c.targetHigh.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return `Across the models you ran, ${name} is expected to trend ${dir} over the next ${horizon} days (${c.score >= 0 ? "+" : ""}${c.score.toFixed(2)}% weighted). Model agreement is ${strength} (${Math.round(c.agreement * 100)}%); the P10–P90 target range is ${rangeTxt}.`;
}

// ---------------- History (localStorage) ----------------
export const HISTORY_KEY = "dx_forecast_history_v1";
export interface HistoryEntry {
  ts: number;
  asset: string;
  horizon: number;
  price: number;
  consensusLabel: string;
  score: number;             // %
  targetLow: number;
  targetHigh: number;
  models: number;
}
export function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}
export function pushHistory(entry: HistoryEntry, keep = 10): HistoryEntry[] {
  try {
    const all = [entry, ...readHistory()].slice(0, keep);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    return all;
  } catch { return readHistory(); }
}

// ---------------- Market Context ----------------
export interface MarketContext {
  vix: number | null;
  vixLabel: "Low" | "Normal" | "Elevated" | "High";
  vixColor: string;
  nifty200Trend: "above" | "below" | null;   // above/below 200 DMA
  nifty200Note: string;
}
export function assessVix(vix: number | null): { label: MarketContext["vixLabel"]; color: string } {
  if (vix == null || !Number.isFinite(vix)) return { label: "Normal", color: "#94a3b8" };
  if (vix < 12) return { label: "Low", color: "#00ff88" };
  if (vix < 18) return { label: "Normal", color: "#00d4ff" };
  if (vix < 25) return { label: "Elevated", color: "#ffaa00" };
  return { label: "High", color: "#ff4466" };
}

export function bucketBenchmark(bucket: string | undefined): { key: string; name: string } {
  switch (bucket) {
    case "nifty50":     return { key: "nifty50",     name: "NIFTY 50" };
    case "next50":      return { key: "niftynext50", name: "NIFTY Next 50" };
    case "midcap150":   return { key: "midcap150",   name: "NIFTY Midcap 150" };
    case "smallcap250": return { key: "smallcap250", name: "NIFTY Smallcap 250" };
    default:            return { key: "nifty50",     name: "NIFTY 50" };
  }
}

export function rmModelResults(r: ModelResult): string {
  return `${r.name} · ${r.expectedReturn.toFixed(2)}% · ${r.signal}`;
}

// Model result summary (unused externally but exported for future use)
export function summariseResults(rs: ModelResult[]): string {
  return rs.map(rmModelResults).join(" | ");
}
