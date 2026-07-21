// Bootstrap composite forecast from the static dataset only.
// Weighted blend of: (a) momentum (30D + 365D %chg), (b) relative strength vs
// the stock's category-equivalent fund/ETF universe, (c) mean-reversion signal
// from the 52W H/L band. Returns a normalized score, plain-English breakdown,
// and a target price. Does NOT fabricate fundamentals (P/E, ROCE, etc.).

import { getStore } from "./store";
import type { StockQuote, FundQuote, EtfQuote } from "./types";

export type Signal = "BUY" | "HOLD" | "SELL";
export interface ForecastBreakdown {
  label: string;
  score: number; // -1..+1
  weight: number;
  detail: string;
}
export interface CompositeForecast {
  symbol: string;
  price: number | null;
  score: number; // -1..+1
  signal: Signal;
  confidencePct: number;
  targetPrice: number | null;
  horizonDays: number;
  breakdown: ForecastBreakdown[];
  notes: string[]; // e.g. "P/E requires live data source"
  asOf: string;
}

const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
const tanh = (x: number) => Math.tanh(x);

function categoryOf(stockSymbol: string): "largecap" | "midcap" | "smallcap" | "unknown" {
  // Without market-cap in bundled data, infer from Nifty 500 heuristics: top 100
  // symbols in the JSON are broadly large-cap. This is coarse; live provider
  // will replace it with real classification.
  const s = getStore();
  const keys = Array.from(s.stocks.keys());
  const idx = keys.indexOf(stockSymbol.toUpperCase());
  if (idx < 0) return "unknown";
  if (idx < 100) return "largecap";
  if (idx < 250) return "midcap";
  return "smallcap";
}

function categoryFundAvg(cat: "largecap" | "midcap" | "smallcap" | "unknown"): number | null {
  if (cat === "unknown") return null;
  const wanted = cat === "largecap" ? "large cap" : cat === "midcap" ? "mid cap" : "small cap";
  const funds = Array.from(getStore().funds.values()).filter((f) => f.category.toLowerCase().includes(wanted));
  const rets = funds.map((f) => f.ret1y).filter((v): v is number => v !== null);
  if (!rets.length) return null;
  return rets.reduce((a, b) => a + b, 0) / rets.length;
}

export function forecastStock(symbol: string, horizonDays = 20): CompositeForecast {
  const store = getStore();
  const key = symbol.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
  const q = store.stocks.get(key);
  const asOf = store.asOf;

  if (!q) {
    return { symbol, price: null, score: 0, signal: "HOLD", confidencePct: 0, targetPrice: null, horizonDays, breakdown: [], notes: ["Symbol not found in static dataset"], asOf };
  }

  const price = q.ltp ?? q.prevClose;
  const breakdown: ForecastBreakdown[] = [];

  // 1) Momentum
  const m30 = q.chg30dPct ?? 0;
  const m365 = q.chg365dPct ?? 0;
  const momScore = clamp(tanh((m30 / 15) * 0.7 + (m365 / 40) * 0.3));
  breakdown.push({ label: "Momentum", score: momScore, weight: 0.4, detail: `30D ${m30.toFixed(2)}% · 365D ${m365.toFixed(2)}%` });

  // 2) Relative strength vs category fund average
  const cat = categoryOf(key);
  const catAvg = categoryFundAvg(cat);
  let rsScore = 0; let rsDetail = "category peer data unavailable";
  if (catAvg !== null) {
    const diff = (q.chg365dPct ?? 0) - catAvg;
    rsScore = clamp(tanh(diff / 20));
    rsDetail = `stock 365D ${(q.chg365dPct ?? 0).toFixed(1)}% vs ${cat} fund avg ${catAvg.toFixed(1)}%`;
  }
  breakdown.push({ label: "Relative strength", score: rsScore, weight: 0.35, detail: rsDetail });

  // 3) Volatility band / mean-reversion from 52W H/L
  let bandScore = 0; let bandDetail = "52W band unavailable";
  if (price && q.w52High && q.w52Low && q.w52High > q.w52Low) {
    const pos = (price - q.w52Low) / (q.w52High - q.w52Low); // 0..1
    // Contrarian: near lows => positive expected reversion, near highs => negative
    bandScore = clamp((0.5 - pos) * 2 * 0.6); // dampened
    bandDetail = `${(pos * 100).toFixed(0)}% of 52W range (L ₹${q.w52Low} · H ₹${q.w52High})`;
  }
  breakdown.push({ label: "Mean-reversion band", score: bandScore, weight: 0.25, detail: bandDetail });

  const total = breakdown.reduce((s, b) => s + b.score * b.weight, 0);
  const wSum = breakdown.reduce((s, b) => s + b.weight, 0);
  const score = clamp(total / (wSum || 1));

  const signal: Signal = score > 0.2 ? "BUY" : score < -0.2 ? "SELL" : "HOLD";
  const confidencePct = Math.round((Math.abs(score) * 60 + (catAvg !== null ? 25 : 10)) * 10) / 10;
  const expectedMovePct = score * 8 * Math.sqrt(horizonDays / 20); // scaled
  const targetPrice = price ? +(price * (1 + expectedMovePct / 100)).toFixed(2) : null;

  const notes = [
    "P/E, ROCE, dividend yield and quarterly variation are not in the static dataset — switch to live data source to enable those factors.",
  ];

  return { symbol: key, price, score, signal, confidencePct, targetPrice, horizonDays, breakdown, notes, asOf };
}

export function forecastFund(name: string): { ret1y: number | null; ret3y: number | null; ret5y: number | null; blendedCagr: number | null; source: FundQuote | null } {
  const f = getStore().funds.get(name.toLowerCase());
  if (!f) return { ret1y: null, ret3y: null, ret5y: null, blendedCagr: null, source: null };
  const parts = [f.ret1y, f.ret3y, f.ret5y].filter((v): v is number => v !== null);
  const blended = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  return { ret1y: f.ret1y, ret3y: f.ret3y, ret5y: f.ret5y, blendedCagr: blended, source: f };
}

export function forecastEtf(name: string): { ret1y: number | null; ret3y: number | null; ret5y: number | null; blendedCagr: number | null; source: EtfQuote | null } {
  const e = getStore().etfs.get(name.toLowerCase());
  if (!e) return { ret1y: null, ret3y: null, ret5y: null, blendedCagr: null, source: null };
  const parts = [e.ret1y, e.ret3y, e.ret5y].filter((v): v is number => v !== null);
  const blended = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  return { ret1y: e.ret1y, ret3y: e.ret3y, ret5y: e.ret5y, blendedCagr: blended, source: e };
}
