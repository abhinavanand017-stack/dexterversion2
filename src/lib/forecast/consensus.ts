import type { ModelResult } from "./models";

export type ConsensusLabel = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";

export interface Consensus {
  label: ConsensusLabel;
  score: number;            // weighted expected return %
  confidence: number;       // 0-99
  agreement: number;        // 0..1
  targetLow: number;
  targetHigh: number;
}

export function computeConsensus(results: ModelResult[], currentPrice: number): Consensus {
  if (!results.length) {
    return { label: "HOLD", score: 0, confidence: 0, agreement: 0, targetLow: currentPrice, targetHigh: currentPrice };
  }
  const totalConf = results.reduce((s, r) => s + r.confidence, 0) || 1;
  let score = 0;
  for (const r of results) score += (r.confidence / totalConf) * r.expectedReturn;
  let label: ConsensusLabel = "HOLD";
  if (score > 5) label = "STRONG BUY";
  else if (score > 2) label = "BUY";
  else if (score < -5) label = "STRONG SELL";
  else if (score < -2) label = "SELL";

  const dominantSign = score >= 0 ? 1 : -1;
  const agree = results.filter((r) =>
    (r.expectedReturn >= 0 ? 1 : -1) === dominantSign,
  ).length / results.length;

  const finals = results.map((r) => r.forecast[r.forecast.length - 1]).filter((v) => Number.isFinite(v));
  finals.sort((a, b) => a - b);
  const targetLow = finals[Math.floor(finals.length * 0.1)] ?? currentPrice;
  const targetHigh = finals[Math.floor(finals.length * 0.9)] ?? currentPrice;

  const confidence = Math.min(99, Math.abs(score) * 8 + agree * 40);

  return { label, score, confidence, agreement: agree, targetLow, targetHigh };
}
