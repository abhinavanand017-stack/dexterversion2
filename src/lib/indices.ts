// Curated NSE / BSE index universe for the /indices page and the Forecaster
// asset picker. Live values flow through the existing Yahoo Finance feed
// (fetchYahooChart) which already powers the rest of the app.

export type IndexGroup = "broad" | "sectoral" | "strategy";

export interface IndexDef {
  key: string;           // internal id
  name: string;          // display
  yahooSymbol: string;   // e.g. "^NSEI" — passed to fetchYahooChart
  group: IndexGroup;
  exchange: "NSE" | "BSE";
  short?: string;        // short label for compact cards
}

export const INDICES: IndexDef[] = [
  // === Broad market ===
  { key: "nifty50",      name: "NIFTY 50",            yahooSymbol: "^NSEI",      group: "broad",     exchange: "NSE", short: "N50" },
  { key: "niftynext50",  name: "NIFTY Next 50",       yahooSymbol: "^NSMIDCP",   group: "broad",     exchange: "NSE", short: "NN50" },
  { key: "nifty100",     name: "NIFTY 100",           yahooSymbol: "^CNX100",    group: "broad",     exchange: "NSE", short: "N100" },
  { key: "nifty200",     name: "NIFTY 200",           yahooSymbol: "^CNX200",    group: "broad",     exchange: "NSE", short: "N200" },
  { key: "nifty500",     name: "NIFTY 500",           yahooSymbol: "^CRSLDX",    group: "broad",     exchange: "NSE", short: "N500" },
  { key: "midcap150",    name: "NIFTY Midcap 150",    yahooSymbol: "NIFTY_MIDCAP_150.NS", group: "broad", exchange: "NSE" },
  { key: "smallcap250",  name: "NIFTY Smallcap 250",  yahooSymbol: "NIFTYSMLCAP250.NS", group: "broad", exchange: "NSE" },
  { key: "sensex",       name: "SENSEX",              yahooSymbol: "^BSESN",     group: "broad",     exchange: "BSE" },
  { key: "bse100",       name: "BSE 100",             yahooSymbol: "BSE-100.BO", group: "broad",     exchange: "BSE" },
  { key: "bsemidcap",    name: "BSE MidCap",          yahooSymbol: "BSE-MIDCAP.BO", group: "broad",  exchange: "BSE" },
  { key: "bsesmallcap",  name: "BSE SmallCap",        yahooSymbol: "BSE-SMLCAP.BO", group: "broad",  exchange: "BSE" },

  // === Sectoral ===
  { key: "nbank",        name: "NIFTY Bank",          yahooSymbol: "^NSEBANK",    group: "sectoral", exchange: "NSE" },
  { key: "nit",          name: "NIFTY IT",            yahooSymbol: "^CNXIT",      group: "sectoral", exchange: "NSE" },
  { key: "nauto",        name: "NIFTY Auto",          yahooSymbol: "^CNXAUTO",    group: "sectoral", exchange: "NSE" },
  { key: "npharma",      name: "NIFTY Pharma",        yahooSymbol: "^CNXPHARMA",  group: "sectoral", exchange: "NSE" },
  { key: "nfmcg",        name: "NIFTY FMCG",          yahooSymbol: "^CNXFMCG",    group: "sectoral", exchange: "NSE" },
  { key: "nmetal",       name: "NIFTY Metal",         yahooSymbol: "^CNXMETAL",   group: "sectoral", exchange: "NSE" },
  { key: "nenergy",      name: "NIFTY Energy",        yahooSymbol: "^CNXENERGY",  group: "sectoral", exchange: "NSE" },
  { key: "nrealty",      name: "NIFTY Realty",        yahooSymbol: "^CNXREALTY",  group: "sectoral", exchange: "NSE" },
  { key: "npsubank",     name: "NIFTY PSU Bank",      yahooSymbol: "^CNXPSUBANK", group: "sectoral", exchange: "NSE" },
  { key: "nfinserv",     name: "NIFTY Financial Svcs",yahooSymbol: "NIFTY_FIN_SERVICE.NS", group: "sectoral", exchange: "NSE" },
  { key: "nmedia",       name: "NIFTY Media",         yahooSymbol: "^CNXMEDIA",   group: "sectoral", exchange: "NSE" },

  // === Strategy / volatility ===
  { key: "indiavix",     name: "INDIA VIX",           yahooSymbol: "^INDIAVIX",   group: "strategy", exchange: "NSE" },
  { key: "nifty50ew",    name: "NIFTY 50 Equal Wt",   yahooSymbol: "NIFTY50_EQL_WGT.NS", group: "strategy", exchange: "NSE" },
];

export const INDEX_GROUP_LABEL: Record<IndexGroup, string> = {
  broad: "Broad Market",
  sectoral: "Sectoral",
  strategy: "Volatility & Strategy",
};

export const getIndex = (key: string) => INDICES.find((i) => i.key === key);
export function searchIndices(q: string, limit = 50): IndexDef[] {
  const s = q.trim().toLowerCase();
  if (!s) return INDICES.slice(0, limit);
  return INDICES.filter((i) =>
    i.name.toLowerCase().includes(s) || i.key.toLowerCase().includes(s) || (i.short ?? "").toLowerCase().includes(s)
  ).slice(0, limit);
}
