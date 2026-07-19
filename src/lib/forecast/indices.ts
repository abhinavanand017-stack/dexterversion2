// Major Indian indices for the Forecaster
export interface IndexRow {
  symbol: string;   // Yahoo symbol
  name: string;
  cat: "Broad" | "Sectoral" | "Thematic" | "Strategy";
}

export const INDICES_UNIVERSE: IndexRow[] = [
  { symbol: "^NSEI",       name: "Nifty 50",              cat: "Broad" },
  { symbol: "^NSEBANK",    name: "Nifty Bank",            cat: "Sectoral" },
  { symbol: "^BSESN",      name: "BSE Sensex",            cat: "Broad" },
  { symbol: "^CNXIT",      name: "Nifty IT",              cat: "Sectoral" },
  { symbol: "NIFTY_FIN_SERVICE.NS", name: "Nifty Fin Services", cat: "Sectoral" },
  { symbol: "^CNXAUTO",    name: "Nifty Auto",            cat: "Sectoral" },
  { symbol: "^CNXPHARMA",  name: "Nifty Pharma",          cat: "Sectoral" },
  { symbol: "^CNXFMCG",    name: "Nifty FMCG",            cat: "Sectoral" },
  { symbol: "^CNXMETAL",   name: "Nifty Metal",           cat: "Sectoral" },
  { symbol: "^CNXENERGY",  name: "Nifty Energy",          cat: "Sectoral" },
  { symbol: "^CNXREALTY",  name: "Nifty Realty",          cat: "Sectoral" },
  { symbol: "^CNXPSUBANK", name: "Nifty PSU Bank",        cat: "Sectoral" },
  { symbol: "NIFTY_MIDCAP_100.NS", name: "Nifty Midcap 100", cat: "Broad" },
  { symbol: "^CNXSC",      name: "Nifty Smallcap 100",    cat: "Broad" },
  { symbol: "^CNX500",     name: "Nifty 500",             cat: "Broad" },
  { symbol: "^INDIAVIX",   name: "India VIX",             cat: "Thematic" },
  { symbol: "NIFTY_ALPHA_50.NS", name: "Nifty Alpha 50", cat: "Strategy" },
  { symbol: "NIFTY_QUALITY_30.NS", name: "Nifty Quality 30", cat: "Strategy" },
];
