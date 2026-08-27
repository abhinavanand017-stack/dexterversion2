// Sector taxonomy for the 1,000-name screener universe.
// The original 16 Dexter sectors are preserved; the 10 extra buckets below are
// additive so the mid/small/micro-cap tail is representable.

export const LEGACY_SECTORS = [
  "Banking", "IT", "Auto", "FMCG", "Pharma", "Energy", "Telecom",
  "Capital Goods", "NBFC", "Cement", "Utilities", "Consumer", "Conglomerate",
  "Financial", "Metals", "Retail",
] as const;

export const EXTENDED_SECTORS = [
  "Healthcare/Hospitals", "Chemicals", "Textiles", "Media & Entertainment",
  "Realty", "Infrastructure", "Defence", "Renewable Energy",
  "Agri/Fertilizers", "Diversified/Others",
] as const;

export const ALL_SECTORS: string[] = [...LEGACY_SECTORS, ...EXTENDED_SECTORS];

/**
 * NSE publishes a macro "Industry" column on its official index constituent
 * files. That is the only sector attribution we can cite, so it is the only one
 * we map. Anything unmapped falls through to Diversified/Others rather than
 * being guessed into a narrower bucket.
 */
const NSE_INDUSTRY_MAP: Record<string, string> = {
  "financial services": "Financial",
  "information technology": "IT",
  "automobile and auto components": "Auto",
  "fast moving consumer goods": "FMCG",
  "healthcare": "Healthcare/Hospitals",
  "oil gas & consumable fuels": "Energy",
  "telecommunication": "Telecom",
  "capital goods": "Capital Goods",
  "construction materials": "Cement",
  "power": "Utilities",
  "consumer durables": "Consumer",
  "consumer services": "Retail",
  "metals & mining": "Metals",
  "chemicals": "Chemicals",
  "textiles": "Textiles",
  "media entertainment & publication": "Media & Entertainment",
  "realty": "Realty",
  "construction": "Infrastructure",
  "services": "Diversified/Others",
  "diversified": "Conglomerate",
  "forest materials": "Diversified/Others",
};

export function mapNseIndustry(industry: string | null | undefined): string {
  if (!industry) return "Diversified/Others";
  return NSE_INDUSTRY_MAP[industry.trim().toLowerCase()] ?? "Diversified/Others";
}
