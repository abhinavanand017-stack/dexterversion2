export type HoldingKind = "stock" | "fund";

export interface AnalyserHolding {
  id: string;
  kind: HoldingKind;
  symbol: string;      // NSE symbol for stocks, scheme code (string) for funds
  name: string;
  sector?: string;
  category?: string;   // fund category
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
