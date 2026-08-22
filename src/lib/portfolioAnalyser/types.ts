export type HoldingKind = "stock" | "fund" | "etf";

export interface AnalyserHolding {
  id: string;
  kind: HoldingKind;
  symbol: string;      // NSE symbol for stocks/ETFs, scheme code (string) for funds
  name: string;
  sector?: string;
  category?: string;   // fund / ETF category
  qty: number;         // shares or units
  avgCost: number;     // per share/unit
  buyDate: string;     // ISO
  currentPrice?: number;
  schemeCode?: number;
  sipMonthly?: number; // funds only
  notes?: string;
}

export interface PortfolioSettings {
  totalCapital?: number;
  horizon?: "1Y" | "3Y" | "5Y" | "10Y";
  risk?: "Conservative" | "Moderate" | "Aggressive";
  rebalance?: "Monthly" | "Quarterly" | "Yearly";
  benchmark?: string;
}

/** Where a displayed number came from. "live" = fetched this session, "reference" = user-supplied / cached / fallback. */
export type DataSource = "live" | "reference";

export interface EnrichedHolding extends AnalyserHolding {
  price: number;
  priceSource: DataSource;
  value: number;
  invested: number;
  pnl: number;
  pnlPct: number;
  weight: number;
  years: number;
  fundamentals?: {
    sector?: string | null;
    marketCap?: number | null;
    pe?: number | null;
    pb?: number | null;
    roePct?: number | null;
    beta?: number | null;
    w52High?: number | null;
    w52Low?: number | null;
  };
  fundamentalsSource?: DataSource;
  unresolved?: boolean;
}

/* ---------- analysis result contract (produced by analyzePortfolio) ---------- */

export type Verdict = "Add" | "Hold" | "Trim" | "Watch";
export type RiskLevel = "Low" | "Med" | "High";

export const RISK_CATEGORIES = [
  "Regulatory & Legal",
  "Competitive & Moat",
  "Operational",
  "Financial & Balance Sheet",
  "Macro",
  "Management & Governance",
] as const;
export type RiskCategory = typeof RISK_CATEGORIES[number];

export interface ScenarioCase {
  case: "Bull" | "Base" | "Bear";
  returnPct: number;      // 12-month forward % return
  targetPrice?: number | null;
  probability: number;    // 0-100
  trigger: string;
}

export interface HoldingAnalysis {
  symbol: string;
  name: string;
  verdict: Verdict;
  verdictLine: string;
  valuation: {
    method: string;
    low: number | null;
    base: number | null;
    high: number | null;
    note: string;
  };
  scenarios: ScenarioCase[];
  risks: { category: string; likelihood: RiskLevel; impact: RiskLevel; note: string }[];
  killerRisk: { risk: string; mitigant: string };
}

export interface PortfolioAnalysis {
  thesis: string;
  situation: string;
  complication: string;
  resolution: string;
  overlaps: { underlying: string; directPct: number; viaFundsPct: number; totalPct: number; note: string }[];
  diversificationNote: string;
  rollup: { bullPct: number; basePct: number; bearPct: number; expectedPct: number; note: string };
  topRisk: { risk: string; mitigant: string };
}

export interface AnalysisResult {
  portfolio: PortfolioAnalysis;
  holdings: HoldingAnalysis[];
}
