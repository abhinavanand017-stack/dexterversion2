// Config-driven index universe for the /indices dashboard.
// Extend by adding rows here — no UI changes required.

export type IndexCategory = "broad" | "cap" | "sectoral" | "thematic";
/** MECE peer buckets used for global benchmarking (§5). */
export type PeerCategory = "broad" | "banking" | "technology" | "smallmid";

export interface IndianIndex {
  key: string;
  name: string;
  /** Name as returned by NSE /api/allIndices (for P/E, P/B, div yield, breadth). */
  nseName?: string;
  /** Yahoo symbol used for OHLC history. */
  yahoo: string;
  category: IndexCategory;
  peer: PeerCategory;
  exchange: "NSE" | "BSE";
}

export interface GlobalIndex {
  key: string;
  name: string;
  yahoo: string;
  region: string;
  peer: PeerCategory;
  /** True when the series is an ETF proxy rather than the index itself. */
  proxy?: string;
}

export const INDIAN_INDICES: IndianIndex[] = [
  // Broad market
  { key: "nifty50", name: "NIFTY 50", nseName: "NIFTY 50", yahoo: "^NSEI", category: "broad", peer: "broad", exchange: "NSE" },
  { key: "sensex", name: "SENSEX", yahoo: "^BSESN", category: "broad", peer: "broad", exchange: "BSE" },
  { key: "nifty100", name: "NIFTY 100", nseName: "NIFTY 100", yahoo: "^CNX100", category: "broad", peer: "broad", exchange: "NSE" },
  { key: "nifty500", name: "NIFTY 500", nseName: "NIFTY 500", yahoo: "^CRSLDX", category: "broad", peer: "broad", exchange: "NSE" },
  // Cap-based
  { key: "midcap150", name: "NIFTY MIDCAP 150", nseName: "NIFTY MIDCAP 150", yahoo: "NIFTY_MIDCAP_150.NS", category: "cap", peer: "smallmid", exchange: "NSE" },
  { key: "smallcap250", name: "NIFTY SMALLCAP 250", nseName: "NIFTY SMALLCAP 250", yahoo: "NIFTYSMLCAP250.NS", category: "cap", peer: "smallmid", exchange: "NSE" },
  // Sectoral
  { key: "bank", name: "NIFTY BANK", nseName: "NIFTY BANK", yahoo: "^NSEBANK", category: "sectoral", peer: "banking", exchange: "NSE" },
  { key: "it", name: "NIFTY IT", nseName: "NIFTY IT", yahoo: "^CNXIT", category: "sectoral", peer: "technology", exchange: "NSE" },
  { key: "fmcg", name: "NIFTY FMCG", nseName: "NIFTY FMCG", yahoo: "^CNXFMCG", category: "sectoral", peer: "broad", exchange: "NSE" },
  { key: "pharma", name: "NIFTY PHARMA", nseName: "NIFTY PHARMA", yahoo: "^CNXPHARMA", category: "sectoral", peer: "broad", exchange: "NSE" },
  { key: "auto", name: "NIFTY AUTO", nseName: "NIFTY AUTO", yahoo: "^CNXAUTO", category: "sectoral", peer: "broad", exchange: "NSE" },
  { key: "metal", name: "NIFTY METAL", nseName: "NIFTY METAL", yahoo: "^CNXMETAL", category: "sectoral", peer: "broad", exchange: "NSE" },
  { key: "energy", name: "NIFTY ENERGY", nseName: "NIFTY ENERGY", yahoo: "^CNXENERGY", category: "sectoral", peer: "broad", exchange: "NSE" },
  { key: "realty", name: "NIFTY REALTY", nseName: "NIFTY REALTY", yahoo: "^CNXREALTY", category: "sectoral", peer: "broad", exchange: "NSE" },
  { key: "psubank", name: "NIFTY PSU BANK", nseName: "NIFTY PSU BANK", yahoo: "^CNXPSUBANK", category: "sectoral", peer: "banking", exchange: "NSE" },
  { key: "finservice", name: "NIFTY FIN SERVICE", nseName: "NIFTY FINANCIAL SERVICES", yahoo: "NIFTY_FIN_SERVICE.NS", category: "sectoral", peer: "banking", exchange: "NSE" },
  // Thematic
  { key: "infra", name: "NIFTY INFRA", nseName: "NIFTY INFRASTRUCTURE", yahoo: "^CNXINFRA", category: "thematic", peer: "broad", exchange: "NSE" },
  { key: "consumption", name: "NIFTY CONSUMPTION", nseName: "NIFTY INDIA CONSUMPTION", yahoo: "^CNXCONSUM", category: "thematic", peer: "broad", exchange: "NSE" },
];

/**
 * Global peers. NOTE: this is NEW data surface area for Dexter — it comes from
 * Yahoo Finance's public chart endpoint, NOT from the NSE/BSE pipeline that
 * powers Indian data. Every global figure is badged separately in the UI.
 */
export const GLOBAL_PEERS: GlobalIndex[] = [
  { key: "spx", name: "S&P 500", yahoo: "^GSPC", region: "US", peer: "broad" },
  { key: "ixic", name: "Nasdaq Composite", yahoo: "^IXIC", region: "US", peer: "broad" },
  { key: "ftse", name: "FTSE 100", yahoo: "^FTSE", region: "UK", peer: "broad" },
  { key: "n225", name: "Nikkei 225", yahoo: "^N225", region: "Japan", peer: "broad" },
  { key: "dax", name: "DAX", yahoo: "^GDAXI", region: "Germany", peer: "broad" },
  { key: "hsi", name: "Hang Seng", yahoo: "^HSI", region: "Hong Kong", peer: "broad" },
  { key: "em", name: "MSCI Emerging Markets", yahoo: "EEM", region: "Global EM", peer: "broad", proxy: "iShares MSCI EM ETF (EEM)" },
  { key: "kbw", name: "KBW Nasdaq Bank Index", yahoo: "KBWB", region: "US", peer: "banking", proxy: "Invesco KBW Bank ETF (KBWB)" },
  { key: "sx7p", name: "STOXX Europe 600 Banks", yahoo: "EXV1.DE", region: "Europe", peer: "banking", proxy: "iShares STOXX Europe 600 Banks ETF (EXV1.DE)" },
  { key: "ndx", name: "Nasdaq 100", yahoo: "^NDX", region: "US", peer: "technology" },
  { key: "rut", name: "Russell 2000", yahoo: "^RUT", region: "US", peer: "smallmid" },
  { key: "ftmc", name: "FTSE 250", yahoo: "^FTMC", region: "UK", peer: "smallmid" },
];

export const PEER_LABEL: Record<PeerCategory, string> = {
  broad: "Broad Market",
  banking: "Banking & Financials",
  technology: "Technology",
  smallmid: "Small / Mid Cap",
};

export const CATEGORY_LABEL: Record<IndexCategory, string> = {
  broad: "Broad Market",
  cap: "Cap-based",
  sectoral: "Sectoral",
  thematic: "Thematic",
};

export const getIndianIndex = (key: string) => INDIAN_INDICES.find((i) => i.key === key);
export const peersFor = (peer: PeerCategory) => GLOBAL_PEERS.filter((p) => p.peer === peer);
