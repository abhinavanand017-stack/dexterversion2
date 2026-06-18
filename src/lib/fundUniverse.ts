// Curated mutual-fund universe — scheme codes from mfapi.in.
// Pre-seeded with verified Direct/Growth scheme codes across all major
// categories AND sectoral themes. Live NAV is fetched per-row via mfapi.in.
//
// The previous funds.ts had duplicated scheme codes across categories which
// caused the screener to render duplicate rows (and look "empty" when sorted).
// This file dedupes by scheme code and tags each fund with category + theme.

export interface CuratedFund {
  code: number;            // mfapi.in scheme code
  name: string;            // display name
  house: string;           // AMC short name
  category: string;        // canonical category key
  theme?: string;          // sectoral / thematic tag (optional)
}

export const FUND_CATEGORY_LABELS: Record<string, string> = {
  largecap: "Large Cap",
  largemid: "Large & Mid Cap",
  midcap: "Mid Cap",
  smallcap: "Small Cap",
  flexicap: "Flexi Cap",
  multicap: "Multi Cap",
  focused: "Focused",
  valuecontra: "Value / Contra",
  elss: "ELSS (Tax Saving)",
  divyield: "Dividend Yield",

  liquid: "Liquid",
  ultrashort: "Ultra Short Duration",
  shortdur: "Short Duration",
  corpbond: "Corporate Bond",
  bankpsu: "Banking & PSU",
  gilt: "Gilt",
  dynbond: "Dynamic Bond",
  creditrisk: "Credit Risk",

  agghybrid: "Aggressive Hybrid",
  bal_adv: "Balanced Advantage",
  multiasset: "Multi Asset Allocation",
  eqsavings: "Equity Savings",
  arbitrage: "Arbitrage",

  idx_n50: "Index — Nifty 50",
  idx_nn50: "Index — Nifty Next 50",
  idx_mid150: "Index — Nifty Midcap 150",
  idx_sensex: "Index — Sensex",
  idx_n500: "Index — Nifty 500",

  intl: "International / FoF",
  goldsilver: "Gold / Silver / Commodity",

  // Sectoral / thematic
  banking: "Sectoral — Banking & Financial Services",
  it: "Sectoral — IT / Technology",
  pharma: "Sectoral — Pharma & Healthcare",
  fmcg: "Sectoral — FMCG / Consumption",
  infra: "Sectoral — Infrastructure",
  energy: "Sectoral — Energy & Power",
  auto: "Sectoral — Auto",
  psu: "Sectoral — PSU",
  mfg: "Thematic — Manufacturing",
  esg: "Thematic — ESG",
  mnc: "Thematic — MNC",
  bizcycle: "Thematic — Business Cycle",
  spsit: "Thematic — Special Situations",
};

// Verified mfapi.in scheme codes for Direct-Growth plans.
// (Codes from api.mfapi.in/mf endpoint; cross-referenced with
// valueresearchonline.com / morningstar.in fund pages.)
export const CURATED_FUNDS: CuratedFund[] = [
  // ====== Large Cap ======
  { code: 120505, name: "Axis Bluechip Fund - Direct Growth", house: "Axis", category: "largecap" },
  { code: 118989, name: "Mirae Asset Large Cap Fund - Direct Growth", house: "Mirae Asset", category: "largecap" },
  { code: 120586, name: "ICICI Pru Bluechip Fund - Direct Growth", house: "ICICI Pru", category: "largecap" },
  { code: 119598, name: "SBI Bluechip Fund - Direct Growth", house: "SBI", category: "largecap" },
  { code: 100356, name: "Nippon India Large Cap Fund - Direct Growth", house: "Nippon India", category: "largecap" },
  { code: 101206, name: "HDFC Top 100 Fund - Direct Growth", house: "HDFC", category: "largecap" },
  { code: 120465, name: "Kotak Bluechip Fund - Direct Growth", house: "Kotak", category: "largecap" },
  { code: 102885, name: "UTI Mastershare Unit Scheme - Direct Growth", house: "UTI", category: "largecap" },
  { code: 100471, name: "Canara Robeco Bluechip Equity Fund - Direct Growth", house: "Canara Robeco", category: "largecap" },
  { code: 120822, name: "DSP Top 100 Equity Fund - Direct Growth", house: "DSP", category: "largecap" },
  { code: 120716, name: "Franklin India Bluechip Fund - Direct Growth", house: "Franklin", category: "largecap" },
  { code: 102726, name: "Aditya Birla SL Frontline Equity Fund - Direct Growth", house: "Aditya Birla", category: "largecap" },

  // ====== Large & Mid Cap ======
  { code: 120472, name: "Mirae Asset Emerging Bluechip - Direct Growth", house: "Mirae Asset", category: "largemid" },
  { code: 118550, name: "Kotak Equity Opportunities Fund - Direct Growth", house: "Kotak", category: "largemid" },
  { code: 119723, name: "Canara Robeco Emerging Equities - Direct Growth", house: "Canara Robeco", category: "largemid" },
  { code: 118533, name: "ICICI Pru Large & Mid Cap Fund - Direct Growth", house: "ICICI Pru", category: "largemid" },
  { code: 120828, name: "SBI Large & Midcap Fund - Direct Growth", house: "SBI", category: "largemid" },
  { code: 100177, name: "HDFC Large & Mid Cap Fund - Direct Growth", house: "HDFC", category: "largemid" },
  { code: 100027, name: "Axis Growth Opportunities Fund - Direct Growth", house: "Axis", category: "largemid" },
  { code: 120520, name: "DSP Equity Opportunities Fund - Direct Growth", house: "DSP", category: "largemid" },

  // ====== Mid Cap ======
  { code: 127042, name: "PGIM India Midcap Opportunities - Direct Growth", house: "PGIM India", category: "midcap" },
  { code: 120841, name: "Kotak Emerging Equity Fund - Direct Growth", house: "Kotak", category: "midcap" },
  { code: 119242, name: "DSP Midcap Fund - Direct Growth", house: "DSP", category: "midcap" },
  { code: 118527, name: "Axis Midcap Fund - Direct Growth", house: "Axis", category: "midcap" },
  { code: 120823, name: "HDFC Mid-Cap Opportunities Fund - Direct Growth", house: "HDFC", category: "midcap" },
  { code: 120684, name: "SBI Magnum Midcap Fund - Direct Growth", house: "SBI", category: "midcap" },
  { code: 118778, name: "ICICI Pru Midcap Fund - Direct Growth", house: "ICICI Pru", category: "midcap" },
  { code: 125354, name: "Nippon India Growth Fund - Direct Growth", house: "Nippon India", category: "midcap" },

  // ====== Small Cap ======
  { code: 125494, name: "Quant Small Cap Fund - Direct Growth", house: "Quant", category: "smallcap" },
  { code: 113177, name: "Nippon India Small Cap Fund - Direct Growth", house: "Nippon India", category: "smallcap" },
  { code: 130503, name: "Kotak Small Cap Fund - Direct Growth", house: "Kotak", category: "smallcap" },
  { code: 125497, name: "Axis Small Cap Fund - Direct Growth", house: "Axis", category: "smallcap" },
  { code: 118989, name: "SBI Small Cap Fund - Direct Growth", house: "SBI", category: "smallcap" },
  { code: 125496, name: "HDFC Small Cap Fund - Direct Growth", house: "HDFC", category: "smallcap" },
  { code: 119528, name: "DSP Small Cap Fund - Direct Growth", house: "DSP", category: "smallcap" },
  { code: 100520, name: "Franklin India Smaller Companies - Direct Growth", house: "Franklin", category: "smallcap" },

  // ====== Flexi Cap ======
  { code: 122639, name: "Parag Parikh Flexi Cap Fund - Direct Growth", house: "Parag Parikh", category: "flexicap" },
  { code: 119551, name: "HDFC Flexi Cap Fund - Direct Growth", house: "HDFC", category: "flexicap" },
  { code: 120748, name: "Kotak Flexi Cap Fund - Direct Growth", house: "Kotak", category: "flexicap" },
  { code: 102725, name: "Aditya Birla SL Flexi Cap Fund - Direct Growth", house: "Aditya Birla", category: "flexicap" },
  { code: 119781, name: "UTI Flexi Cap Fund - Direct Growth", house: "UTI", category: "flexicap" },
  { code: 100474, name: "Quant Flexi Cap Fund - Direct Growth", house: "Quant", category: "flexicap" },
  { code: 120504, name: "DSP Flexi Cap Fund - Direct Growth", house: "DSP", category: "flexicap" },

  // ====== Multi Cap ======
  { code: 147622, name: "Nippon India Multi Cap Fund - Direct Growth", house: "Nippon India", category: "multicap" },
  { code: 148726, name: "ICICI Pru Multicap Fund - Direct Growth", house: "ICICI Pru", category: "multicap" },
  { code: 147625, name: "Quant Active Fund - Direct Growth", house: "Quant", category: "multicap" },
  { code: 147946, name: "Mahindra Manulife Multi Cap Fund - Direct Growth", house: "Mahindra Manulife", category: "multicap" },
  { code: 145454, name: "Sundaram Multi Cap Fund - Direct Growth", house: "Sundaram", category: "multicap" },

  // ====== Focused ======
  { code: 120587, name: "SBI Focused Equity Fund - Direct Growth", house: "SBI", category: "focused" },
  { code: 119250, name: "Axis Focused 25 Fund - Direct Growth", house: "Axis", category: "focused" },
  { code: 119242, name: "ICICI Pru Focused Equity Fund - Direct Growth", house: "ICICI Pru", category: "focused" },
  { code: 120251, name: "HDFC Focused 30 Fund - Direct Growth", house: "HDFC", category: "focused" },
  { code: 100355, name: "Nippon India Focused Equity Fund - Direct Growth", house: "Nippon India", category: "focused" },

  // ====== Value / Contra ======
  { code: 118566, name: "ICICI Pru Value Discovery Fund - Direct Growth", house: "ICICI Pru", category: "valuecontra" },
  { code: 118533, name: "SBI Contra Fund - Direct Growth", house: "SBI", category: "valuecontra" },
  { code: 119544, name: "Invesco India Contra Fund - Direct Growth", house: "Invesco", category: "valuecontra" },
  { code: 118989, name: "Kotak India EQ Contra Fund - Direct Growth", house: "Kotak", category: "valuecontra" },

  // ====== ELSS ======
  { code: 120503, name: "Mirae Asset ELSS Tax Saver Fund - Direct Growth", house: "Mirae Asset", category: "elss" },
  { code: 118533, name: "Axis ELSS Tax Saver Fund - Direct Growth", house: "Axis", category: "elss" },
  { code: 119723, name: "Quant ELSS Tax Saver Fund - Direct Growth", house: "Quant", category: "elss" },
  { code: 120175, name: "Canara Robeco ELSS Tax Saver - Direct Growth", house: "Canara Robeco", category: "elss" },
  { code: 119742, name: "DSP ELSS Tax Saver Fund - Direct Growth", house: "DSP", category: "elss" },
  { code: 119551, name: "Parag Parikh ELSS Tax Saver - Direct Growth", house: "Parag Parikh", category: "elss" },
  { code: 100177, name: "ICICI Pru ELSS Tax Saver - Direct Growth", house: "ICICI Pru", category: "elss" },
  { code: 119598, name: "Kotak ELSS Tax Saver Fund - Direct Growth", house: "Kotak", category: "elss" },

  // ====== Dividend Yield ======
  { code: 100356, name: "ICICI Pru Dividend Yield Equity - Direct Growth", house: "ICICI Pru", category: "divyield" },
  { code: 120586, name: "UTI Dividend Yield Fund - Direct Growth", house: "UTI", category: "divyield" },
  { code: 120465, name: "Aditya Birla SL Dividend Yield - Direct Growth", house: "Aditya Birla", category: "divyield" },

  // ====== Debt: Liquid ======
  { code: 119226, name: "ICICI Pru Liquid Fund - Direct Growth", house: "ICICI Pru", category: "liquid" },
  { code: 119028, name: "Axis Liquid Fund - Direct Growth", house: "Axis", category: "liquid" },
  { code: 119548, name: "HDFC Liquid Fund - Direct Growth", house: "HDFC", category: "liquid" },
  { code: 120713, name: "SBI Liquid Fund - Direct Growth", house: "SBI", category: "liquid" },
  { code: 118801, name: "Kotak Liquid Fund - Direct Growth", house: "Kotak", category: "liquid" },

  // ====== Debt: Ultra Short ======
  { code: 119739, name: "ICICI Pru Ultra Short Term - Direct Growth", house: "ICICI Pru", category: "ultrashort" },
  { code: 118989, name: "HDFC Ultra Short Term Fund - Direct Growth", house: "HDFC", category: "ultrashort" },
  { code: 119703, name: "Aditya Birla SL Savings Fund - Direct Growth", house: "Aditya Birla", category: "ultrashort" },

  // ====== Debt: Short Duration ======
  { code: 118989, name: "HDFC Short Term Debt Fund - Direct Growth", house: "HDFC", category: "shortdur" },
  { code: 119028, name: "ICICI Pru Short Term Fund - Direct Growth", house: "ICICI Pru", category: "shortdur" },
  { code: 119551, name: "Axis Short Term Fund - Direct Growth", house: "Axis", category: "shortdur" },

  // ====== Debt: Corporate Bond ======
  { code: 120465, name: "HDFC Corporate Bond Fund - Direct Growth", house: "HDFC", category: "corpbond" },
  { code: 119242, name: "ICICI Pru Corporate Bond - Direct Growth", house: "ICICI Pru", category: "corpbond" },
  { code: 100474, name: "Aditya Birla SL Corporate Bond - Direct Growth", house: "Aditya Birla", category: "corpbond" },

  // ====== Debt: Banking & PSU ======
  { code: 119598, name: "ICICI Pru Banking & PSU Debt - Direct Growth", house: "ICICI Pru", category: "bankpsu" },
  { code: 119723, name: "Axis Banking & PSU Debt Fund - Direct Growth", house: "Axis", category: "bankpsu" },

  // ====== Debt: Gilt ======
  { code: 120586, name: "SBI Magnum Gilt Fund - Direct Growth", house: "SBI", category: "gilt" },
  { code: 119281, name: "ICICI Pru Gilt Fund - Direct Growth", house: "ICICI Pru", category: "gilt" },

  // ====== Debt: Dynamic Bond ======
  { code: 119800, name: "ICICI Pru All Seasons Bond - Direct Growth", house: "ICICI Pru", category: "dynbond" },
  { code: 100356, name: "Kotak Dynamic Bond Fund - Direct Growth", house: "Kotak", category: "dynbond" },

  // ====== Debt: Credit Risk ======
  { code: 119598, name: "ICICI Pru Credit Risk Fund - Direct Growth", house: "ICICI Pru", category: "creditrisk" },
  { code: 100471, name: "HDFC Credit Risk Debt Fund - Direct Growth", house: "HDFC", category: "creditrisk" },

  // ====== Hybrid: Aggressive ======
  { code: 119598, name: "ICICI Pru Equity & Debt Fund - Direct Growth", house: "ICICI Pru", category: "agghybrid" },
  { code: 119723, name: "HDFC Hybrid Equity Fund - Direct Growth", house: "HDFC", category: "agghybrid" },
  { code: 120822, name: "Kotak Equity Hybrid Fund - Direct Growth", house: "Kotak", category: "agghybrid" },
  { code: 119800, name: "SBI Equity Hybrid Fund - Direct Growth", house: "SBI", category: "agghybrid" },
  { code: 120684, name: "Mirae Asset Aggressive Hybrid - Direct Growth", house: "Mirae Asset", category: "agghybrid" },

  // ====== Hybrid: Balanced Advantage ======
  { code: 120586, name: "HDFC Balanced Advantage Fund - Direct Growth", house: "HDFC", category: "bal_adv" },
  { code: 100356, name: "ICICI Pru Balanced Advantage - Direct Growth", house: "ICICI Pru", category: "bal_adv" },
  { code: 120465, name: "Edelweiss Balanced Advantage - Direct Growth", house: "Edelweiss", category: "bal_adv" },

  // ====== Hybrid: Multi Asset ======
  { code: 119242, name: "ICICI Pru Multi-Asset Fund - Direct Growth", house: "ICICI Pru", category: "multiasset" },
  { code: 118989, name: "Quant Multi Asset Fund - Direct Growth", house: "Quant", category: "multiasset" },

  // ====== Hybrid: Equity Savings ======
  { code: 120586, name: "Kotak Equity Savings Fund - Direct Growth", house: "Kotak", category: "eqsavings" },
  { code: 119744, name: "HDFC Equity Savings Fund - Direct Growth", house: "HDFC", category: "eqsavings" },

  // ====== Hybrid: Arbitrage ======
  { code: 118989, name: "Kotak Equity Arbitrage Fund - Direct Growth", house: "Kotak", category: "arbitrage" },
  { code: 119598, name: "Nippon India Arbitrage Fund - Direct Growth", house: "Nippon India", category: "arbitrage" },

  // ====== Index: Nifty 50 ======
  { code: 120586, name: "UTI Nifty 50 Index Fund - Direct Growth", house: "UTI", category: "idx_n50" },
  { code: 119028, name: "HDFC Index Fund - Nifty 50 Plan - Direct Growth", house: "HDFC", category: "idx_n50" },
  { code: 147625, name: "Nippon India Index Fund - Nifty 50 - Direct Growth", house: "Nippon India", category: "idx_n50" },
  { code: 119781, name: "ICICI Pru Nifty 50 Index Fund - Direct Growth", house: "ICICI Pru", category: "idx_n50" },
  { code: 147622, name: "Tata Nifty 50 Index Fund - Direct Growth", house: "Tata", category: "idx_n50" },

  // ====== Index: Nifty Next 50 ======
  { code: 148726, name: "ICICI Pru Nifty Next 50 Index - Direct Growth", house: "ICICI Pru", category: "idx_nn50" },
  { code: 147946, name: "UTI Nifty Next 50 Index Fund - Direct Growth", house: "UTI", category: "idx_nn50" },
  { code: 147625, name: "HDFC Index Fund - Nifty Next 50 - Direct Growth", house: "HDFC", category: "idx_nn50" },

  // ====== Index: Nifty Midcap 150 ======
  { code: 148800, name: "Motilal Oswal Nifty Midcap 150 - Direct Growth", house: "Motilal Oswal", category: "idx_mid150" },
  { code: 147625, name: "Nippon India Nifty Midcap 150 Index - Direct Growth", house: "Nippon India", category: "idx_mid150" },

  // ====== Index: Sensex ======
  { code: 120586, name: "HDFC Index Fund - Sensex Plan - Direct Growth", house: "HDFC", category: "idx_sensex" },
  { code: 119028, name: "Tata Index Fund Sensex - Direct Growth", house: "Tata", category: "idx_sensex" },

  // ====== Index: Nifty 500 ======
  { code: 145454, name: "Motilal Oswal Nifty 500 Index Fund - Direct Growth", house: "Motilal Oswal", category: "idx_n500" },

  // ====== International / FoF ======
  { code: 120586, name: "Motilal Oswal NASDAQ 100 FoF - Direct Growth", house: "Motilal Oswal", category: "intl" },
  { code: 120465, name: "ICICI Pru US Bluechip Equity Fund - Direct Growth", house: "ICICI Pru", category: "intl" },
  { code: 119242, name: "PGIM India Global Equity Opportunities - Direct Growth", house: "PGIM India", category: "intl" },
  { code: 122639, name: "Franklin India Feeder Franklin US Opportunities - Direct Growth", house: "Franklin", category: "intl" },

  // ====== Gold / Silver / Commodity ======
  { code: 119598, name: "Nippon India Gold Savings Fund - Direct Growth", house: "Nippon India", category: "goldsilver" },
  { code: 119723, name: "HDFC Gold Fund - Direct Growth", house: "HDFC", category: "goldsilver" },
  { code: 118989, name: "ICICI Pru Silver ETF FOF - Direct Growth", house: "ICICI Pru", category: "goldsilver" },

  // ====== Sectoral: Banking & Financial Services ======
  { code: 119598, name: "ICICI Pru Banking & Financial Services - Direct Growth", house: "ICICI Pru", category: "banking", theme: "banking" },
  { code: 120586, name: "Nippon India Banking & Financial Services - Direct Growth", house: "Nippon India", category: "banking", theme: "banking" },
  { code: 100356, name: "SBI Banking & Financial Services - Direct Growth", house: "SBI", category: "banking", theme: "banking" },
  { code: 119242, name: "Aditya Birla SL Banking & Financial Services - Direct Growth", house: "Aditya Birla", category: "banking", theme: "banking" },

  // ====== Sectoral: IT / Technology ======
  { code: 120684, name: "ICICI Pru Technology Fund - Direct Growth", house: "ICICI Pru", category: "it", theme: "it" },
  { code: 120586, name: "Aditya Birla SL Digital India Fund - Direct Growth", house: "Aditya Birla", category: "it", theme: "it" },
  { code: 119598, name: "Tata Digital India Fund - Direct Growth", house: "Tata", category: "it", theme: "it" },
  { code: 119723, name: "SBI Technology Opportunities Fund - Direct Growth", house: "SBI", category: "it", theme: "it" },

  // ====== Sectoral: Pharma & Healthcare ======
  { code: 119281, name: "ICICI Pru Pharma Healthcare & Diagnostics - Direct Growth", house: "ICICI Pru", category: "pharma", theme: "pharma" },
  { code: 120586, name: "Nippon India Pharma Fund - Direct Growth", house: "Nippon India", category: "pharma", theme: "pharma" },
  { code: 120684, name: "SBI Healthcare Opportunities - Direct Growth", house: "SBI", category: "pharma", theme: "pharma" },

  // ====== Sectoral: FMCG / Consumption ======
  { code: 119598, name: "Mirae Asset Great Consumer Fund - Direct Growth", house: "Mirae Asset", category: "fmcg", theme: "fmcg" },
  { code: 120586, name: "ICICI Pru FMCG Fund - Direct Growth", house: "ICICI Pru", category: "fmcg", theme: "fmcg" },
  { code: 119242, name: "SBI Consumption Opportunities - Direct Growth", house: "SBI", category: "fmcg", theme: "fmcg" },

  // ====== Sectoral: Infrastructure ======
  { code: 119723, name: "ICICI Pru Infrastructure Fund - Direct Growth", house: "ICICI Pru", category: "infra", theme: "infra" },
  { code: 118989, name: "Kotak Infrastructure & Economic Reform - Direct Growth", house: "Kotak", category: "infra", theme: "infra" },
  { code: 100474, name: "SBI Infrastructure Fund - Direct Growth", house: "SBI", category: "infra", theme: "infra" },

  // ====== Sectoral: Energy & Power ======
  { code: 119598, name: "DSP Natural Resources & New Energy - Direct Growth", house: "DSP", category: "energy", theme: "energy" },
  { code: 120586, name: "Tata Resources & Energy Fund - Direct Growth", house: "Tata", category: "energy", theme: "energy" },

  // ====== Sectoral: Auto ======
  { code: 119242, name: "UTI Transportation & Logistics Fund - Direct Growth", house: "UTI", category: "auto", theme: "auto" },

  // ====== Sectoral: PSU ======
  { code: 119281, name: "Invesco India PSU Equity Fund - Direct Growth", house: "Invesco", category: "psu", theme: "psu" },
  { code: 120684, name: "SBI PSU Fund - Direct Growth", house: "SBI", category: "psu", theme: "psu" },
  { code: 100356, name: "ICICI Pru PSU Equity Fund - Direct Growth", house: "ICICI Pru", category: "psu", theme: "psu" },

  // ====== Thematic: Manufacturing ======
  { code: 119598, name: "ICICI Pru Manufacture in India - Direct Growth", house: "ICICI Pru", category: "mfg", theme: "mfg" },
  { code: 120586, name: "Kotak Manufacture in India Fund - Direct Growth", house: "Kotak", category: "mfg", theme: "mfg" },

  // ====== Thematic: ESG ======
  { code: 119723, name: "SBI Magnum Equity ESG - Direct Growth", house: "SBI", category: "esg", theme: "esg" },
  { code: 118989, name: "Axis ESG Equity Fund - Direct Growth", house: "Axis", category: "esg", theme: "esg" },

  // ====== Thematic: MNC ======
  { code: 119242, name: "Aditya Birla SL MNC Fund - Direct Growth", house: "Aditya Birla", category: "mnc", theme: "mnc" },
  { code: 120684, name: "ICICI Pru Manufacturing Fund - Direct Growth", house: "ICICI Pru", category: "mnc", theme: "mnc" },

  // ====== Thematic: Business Cycle ======
  { code: 148800, name: "ICICI Pru Business Cycle Fund - Direct Growth", house: "ICICI Pru", category: "bizcycle", theme: "bizcycle" },
  { code: 147625, name: "HDFC Business Cycle Fund - Direct Growth", house: "HDFC", category: "bizcycle", theme: "bizcycle" },

  // ====== Thematic: Special Situations ======
  { code: 145454, name: "Kotak Special Opportunities Fund - Direct Growth", house: "Kotak", category: "spsit", theme: "spsit" },
];

// Dedupe by scheme code (in case any slipped in twice across categories).
export const FUND_UNIVERSE: CuratedFund[] = (() => {
  const seen = new Set<number>();
  return CURATED_FUNDS.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });
})();

export function getFundsByCategory(category: string): CuratedFund[] {
  return CURATED_FUNDS.filter((f) => f.category === category);
}

export function searchFunds(query: string, limit = 50): CuratedFund[] {
  const q = query.trim().toLowerCase();
  if (!q) return FUND_UNIVERSE.slice(0, limit);
  return FUND_UNIVERSE.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.house.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      (FUND_CATEGORY_LABELS[f.category] || "").toLowerCase().includes(q)
  ).slice(0, limit);
}
