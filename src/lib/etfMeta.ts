// Static, non-fabricated metadata that maps ETF benchmarks to a Yahoo symbol
// (for the benchmark overlay chart) and structural asset allocation that is
// true by construction (a gold ETF holds gold, a G-Sec ETF holds sovereign debt).
// Anything we cannot honestly derive is intentionally absent → UI shows
// "Not available" rather than an invented number.

export const BENCHMARK_YAHOO: Record<string, string> = {
  "Nifty 50": "^NSEI",
  "BSE Sensex": "^BSESN",
  "Nifty Bank": "^NSEBANK",
  "Nifty Next 50": "^NSMIDCP",
  "Nifty IT": "^CNXIT",
  "Nasdaq 100 (TRI, INR)": "^NDX",
  "NYSE FANG+ (INR)": "^NYFANG",
};

export interface AllocationSlice {
  label: string;
  weight: number;
}

/** Allocation that follows from the fund's mandate, not from a holdings feed. */
export function structuralAllocation(category: string): AllocationSlice[] | null {
  if (category.startsWith("Commodity - Gold")) return [{ label: "Physical gold", weight: 100 }];
  if (category.startsWith("Commodity - Silver")) return [{ label: "Physical silver", weight: 100 }];
  if (category === "Debt - Gilt") return [{ label: "Sovereign G-Sec", weight: 100 }];
  if (category === "Debt - Liquid") return [{ label: "Overnight / money market", weight: 100 }];
  if (category === "Debt - Target Maturity")
    return [
      { label: "PSU / AAA bonds", weight: 80 },
      { label: "State development loans", weight: 15 },
      { label: "Cash & equivalents", weight: 5 },
    ];
  return null;
}

/** Plain-English strategy note per category — descriptive, not predictive. */
export const STRATEGY_NOTE: Record<string, string> = {
  "Equity - Broad Index":
    "Fully replicates a large-cap benchmark. Returns track the index minus expenses and tracking error; there is no manager alpha by design.",
  "Equity - Sectoral (Banking)":
    "Concentrated exposure to listed banks. Performance is driven by credit growth, net interest margins and asset-quality cycles — far more volatile than a broad index.",
  "Equity - Sectoral (IT)":
    "Concentrated exposure to Indian IT services. Earnings are tied to global tech spend and the USD/INR rate.",
  "Equity - Thematic (PSU)":
    "Basket of state-owned enterprises. Returns depend heavily on government divestment policy, capex cycles and dividend payouts.",
  "Equity - Midcap":
    "Tracks a midcap benchmark. Higher growth potential with materially higher drawdowns and lower liquidity than large caps.",
  "Equity - Factor/Smart Beta":
    "Rules-based screen (e.g. low volatility) applied on top of a parent index, rebalanced periodically. Behaves differently from the parent index across regimes.",
  "Commodity - Gold":
    "Holds physical gold; NAV follows domestic gold prices including the INR effect. A portfolio diversifier, not a cash-flow asset.",
  "Commodity - Silver":
    "Holds physical silver. More volatile than gold because industrial demand dominates.",
  "Debt - Target Maturity":
    "Holds a defined-maturity bond basket to a fixed date. Held to maturity, interest-rate risk falls steadily toward zero.",
  "Debt - Gilt": "Holds sovereign paper around a 10-year point. No credit risk, meaningful duration risk.",
  "Debt - Liquid": "Overnight / money-market instruments used as a cash park. Return tracks short-term rates.",
  International:
    "Provides offshore equity exposure. Returns combine the underlying index with INR depreciation or appreciation.",
};

export const CATEGORY_CHIPS = [
  "All",
  "Broad Index",
  "Sectoral",
  "Thematic",
  "Factor/Smart Beta",
  "Gold",
  "Silver",
  "Debt",
  "International",
] as const;
export type CategoryChip = (typeof CATEGORY_CHIPS)[number];

export function matchesChip(category: string, chip: CategoryChip): boolean {
  switch (chip) {
    case "All": return true;
    case "Broad Index": return category === "Equity - Broad Index" || category === "Equity - Midcap";
    case "Sectoral": return category.startsWith("Equity - Sectoral");
    case "Thematic": return category.startsWith("Equity - Thematic");
    case "Factor/Smart Beta": return category === "Equity - Factor/Smart Beta";
    case "Gold": return category === "Commodity - Gold";
    case "Silver": return category === "Commodity - Silver";
    case "Debt": return category.startsWith("Debt");
    case "International": return category === "International";
  }
}
