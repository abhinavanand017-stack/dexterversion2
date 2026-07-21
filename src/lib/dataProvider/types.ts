// Data provider abstraction — see src/lib/dataProvider/README below.

export interface StockQuote {
  symbol: string;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  ltp: number | null;
  chng: number | null;
  chngPct: number | null;
  w52High: number | null;
  w52Low: number | null;
  chg30dPct: number | null;
  chg365dPct: number | null;
  volume: number | null;
}

export interface FundQuote {
  name: string;
  category: string;
  rating: number | null;
  ret1y: number | null;
  ret3y: number | null;
  ret5y: number | null;
  ret10y: number | null;
  sipRet1y: number | null;
  sipRet3y: number | null;
  sipRet5y: number | null;
  sipRet10y: number | null;
  expenseRatio: number | null;
  riskometer: string | null;
  returnGrade: string | null;
}

export interface EtfQuote {
  name: string;
  category: string;
  nav: number | null;
  dayChangePct: number | null;
  aumCr: number | null;
  volume: number | null;
  w52High: number | null;
  w52Low: number | null;
  ret1m: number | null;
  ret3m: number | null;
  ret1y: number | null;
  ret3y: number | null;
  ret5y: number | null;
  expenseRatio: number | null;
}

export type AnyQuote =
  | ({ kind: "stock" } & StockQuote)
  | ({ kind: "fund" } & FundQuote)
  | ({ kind: "etf" } & EtfQuote);

export interface HistoricalBar { t: number; c: number }
export type HistRange = "1m" | "3m" | "6m" | "1y" | "5y";

export interface DataProvider {
  readonly mode: "static" | "live";
  readonly asOf: string; // ISO date or timestamp
  getQuote(symbol: string): Promise<AnyQuote | null>;
  getHistorical(symbol: string, range: HistRange): Promise<HistoricalBar[]>;
}
