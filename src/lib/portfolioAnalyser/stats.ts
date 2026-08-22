import type { EnrichedHolding } from "./types";

export interface AllocationSlice { label: string; value: number; pct: number }
export interface ConcentrationRow { name: string; value: number; pct: number; flagged: boolean }

const CAP_BUCKET = (mcapCr: number | null | undefined): string => {
  if (!mcapCr || mcapCr <= 0) return "Unknown";
  if (mcapCr >= 100_000) return "Large Cap";
  if (mcapCr >= 20_000) return "Mid Cap";
  return "Small Cap";
};

export function assetAllocation(rows: EnrichedHolding[]): AllocationSlice[] {
  const total = rows.reduce((s, h) => s + h.value, 0) || 1;
  const map: Record<string, number> = { Stocks: 0, "Mutual Funds": 0, ETFs: 0 };
  for (const h of rows) {
    const k = h.kind === "stock" ? "Stocks" : h.kind === "etf" ? "ETFs" : "Mutual Funds";
    map[k] += h.value;
  }
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }));
}

export function sectorConcentration(rows: EnrichedHolding[]): ConcentrationRow[] {
  const total = rows.reduce((s, h) => s + h.value, 0) || 1;
  const map = new Map<string, number>();
  for (const h of rows) {
    const sec = h.fundamentals?.sector || h.sector || (h.kind === "stock" ? "Unclassified" : h.category || "Diversified");
    map.set(sec, (map.get(sec) || 0) + h.value);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100, flagged: (value / total) * 100 > 30 }))
    .sort((a, b) => b.value - a.value);
}

export function capConcentration(rows: EnrichedHolding[]): ConcentrationRow[] {
  const total = rows.reduce((s, h) => s + h.value, 0) || 1;
  const map = new Map<string, number>();
  for (const h of rows) {
    const bucket = h.kind === "stock"
      ? CAP_BUCKET(h.fundamentals?.marketCap ? h.fundamentals.marketCap / 1e7 : null)
      : h.kind === "etf" ? "ETF / Passive" : "Fund / Pooled";
    map.set(bucket, (map.get(bucket) || 0) + h.value);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100, flagged: false }))
    .sort((a, b) => b.value - a.value);
}

export function positionConcentration(rows: EnrichedHolding[]): ConcentrationRow[] {
  const total = rows.reduce((s, h) => s + h.value, 0) || 1;
  return rows
    .map((h) => ({
      name: h.name || h.symbol,
      value: h.value,
      pct: (h.value / total) * 100,
      flagged: h.kind === "stock" && (h.value / total) * 100 > 15,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Sector-HHI based diversification score (0-100, higher = better diversified). */
export function diversificationScore(rows: EnrichedHolding[]): { score: number; hhi: number; drag: string } {
  const sectors = sectorConcentration(rows);
  const positions = positionConcentration(rows);
  if (!rows.length) return { score: 0, hhi: 1, drag: "No holdings" };
  const hhi = sectors.reduce((s, r) => s + (r.pct / 100) ** 2, 0);
  const sectorScore = Math.max(0, Math.min(100, (1 - hhi) * 111));
  const topPos = positions[0]?.pct ?? 0;
  const posPenalty = Math.max(0, topPos - 15) * 1.2;
  const countPenalty = rows.length < 8 ? (8 - rows.length) * 3 : 0;
  const score = Math.max(0, Math.round(sectorScore - posPenalty - countPenalty));

  let drag = "Balanced sector spread and position sizing.";
  const topSector = sectors[0];
  if (topSector && topSector.pct > 30) drag = `${topSector.name} is ${topSector.pct.toFixed(0)}% of the book — the single largest drag on the score.`;
  else if (topPos > 15) drag = `${positions[0].name} alone is ${topPos.toFixed(0)}% of the portfolio.`;
  else if (rows.length < 8) drag = `Only ${rows.length} positions — too few to diversify idiosyncratic risk.`;
  return { score, hhi, drag };
}
