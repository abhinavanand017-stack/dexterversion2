// Screener.in deeplink + symbol-encoding helpers.
// Screener.in blocks scraping; we only link out. Never fetch from here.

export function toScreenerUrl(symbol: string, consolidated = true): string {
  const clean = symbol.trim().toUpperCase().replace(/[^A-Z0-9&\-]/g, "");
  return `https://www.screener.in/company/${encodeURIComponent(clean)}/${consolidated ? "consolidated/" : ""}`;
}

// Encode symbols like "M&M", "GVT&D", "BAJAJ-AUTO" for price-feed URLs.
export function toYahooSymbol(symbol: string, exchange: "NS" | "BO" = "NS"): string {
  return `${encodeURIComponent(symbol.trim().toUpperCase())}.${exchange}`;
}
