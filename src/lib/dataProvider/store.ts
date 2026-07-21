// Normalized in-memory store built from bundled JSON on app load.
// Supports client-side override via a CSV/JSON refresh in Settings.

import stocksJson from "@/data/nifty500.json";
import fundsJson from "@/data/mutual-funds.json";
import etfsJson from "@/data/etfs.json";
import type { StockQuote, FundQuote, EtfQuote } from "./types";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

interface RawStock { SYMBOL: string; OPEN?: number; HIGH?: number; LOW?: number; "PREV. CLOSE"?: number; LTP?: number; CHNG?: number; "%CHNG"?: number; "52W H"?: number; "52W L"?: number; "30 D   %CHNG"?: number; "365 D   %CHNG"?: number; "VOLUME (shares)"?: number }
interface RawFund { fund_name: string; category: string; rating?: number; ret_1yr_pct?: number; ret_3yr_pct?: number; ret_5yr_pct?: number; ret_10yr_pct?: number; sip_ret_1yr_pct?: number; sip_ret_3yr_pct?: number; sip_ret_5yr_pct?: number; sip_ret_10yr_pct?: number; expense_ratio_pct?: number; riskometer?: string; return_grade?: string }
interface RawEtf { etf_name: string; category: string; ltp_nav?: number; day_change_pct?: number; aum_cr?: number; volume?: number; w52_high?: number; w52_low?: number; ret_1m_pct?: number; ret_3m_pct?: number; ret_1yr_pct?: number; ret_3yr_pct?: number; ret_5yr_pct?: number; expense_ratio_pct?: number }

function normStock(r: RawStock): StockQuote {
  return {
    symbol: String(r.SYMBOL).toUpperCase().trim(),
    open: num(r.OPEN), high: num(r.HIGH), low: num(r.LOW),
    prevClose: num(r["PREV. CLOSE"]), ltp: num(r.LTP),
    chng: num(r.CHNG), chngPct: num(r["%CHNG"]),
    w52High: num(r["52W H"]), w52Low: num(r["52W L"]),
    chg30dPct: num(r["30 D   %CHNG"]), chg365dPct: num(r["365 D   %CHNG"]),
    volume: num(r["VOLUME (shares)"]),
  };
}
function normFund(r: RawFund): FundQuote {
  return {
    name: String(r.fund_name).trim(), category: String(r.category ?? ""),
    rating: num(r.rating),
    ret1y: num(r.ret_1yr_pct), ret3y: num(r.ret_3yr_pct), ret5y: num(r.ret_5yr_pct), ret10y: num(r.ret_10yr_pct),
    sipRet1y: num(r.sip_ret_1yr_pct), sipRet3y: num(r.sip_ret_3yr_pct), sipRet5y: num(r.sip_ret_5yr_pct), sipRet10y: num(r.sip_ret_10yr_pct),
    expenseRatio: num(r.expense_ratio_pct),
    riskometer: str(r.riskometer), returnGrade: str(r.return_grade),
  };
}
function normEtf(r: RawEtf): EtfQuote {
  return {
    name: String(r.etf_name).trim(), category: String(r.category ?? ""),
    nav: num(r.ltp_nav), dayChangePct: num(r.day_change_pct),
    aumCr: num(r.aum_cr), volume: num(r.volume),
    w52High: num(r.w52_high), w52Low: num(r.w52_low),
    ret1m: num(r.ret_1m_pct), ret3m: num(r.ret_3m_pct),
    ret1y: num(r.ret_1yr_pct), ret3y: num(r.ret_3yr_pct), ret5y: num(r.ret_5yr_pct),
    expenseRatio: num(r.expense_ratio_pct),
  };
}

export interface StoreState {
  stocks: Map<string, StockQuote>;
  funds: Map<string, FundQuote>;
  etfs: Map<string, EtfQuote>;
  asOf: string; // display label
  source: "bundled" | "user-upload";
}

const BUNDLED_ASOF = "Jun 19, 2026";
const LS_OVERRIDE = "dx_static_dataset_override_v1";

function buildFromRaw(stocks: RawStock[], funds: RawFund[], etfs: RawEtf[], asOf: string, source: StoreState["source"]): StoreState {
  const s = new Map<string, StockQuote>();
  stocks.forEach((r) => { const q = normStock(r); if (q.symbol) s.set(q.symbol, q); });
  const f = new Map<string, FundQuote>();
  funds.forEach((r) => { const q = normFund(r); if (q.name) f.set(q.name.toLowerCase(), q); });
  const e = new Map<string, EtfQuote>();
  etfs.forEach((r) => { const q = normEtf(r); if (q.name) e.set(q.name.toLowerCase(), q); });
  return { stocks: s, funds: f, etfs: e, asOf, source };
}

let _state: StoreState | null = null;

export function getStore(): StoreState {
  if (_state) return _state;
  // Try override
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(LS_OVERRIDE);
      if (raw) {
        const parsed = JSON.parse(raw) as { asOf: string; stocks: RawStock[]; funds: RawFund[]; etfs: RawEtf[] };
        _state = buildFromRaw(parsed.stocks ?? [], parsed.funds ?? [], parsed.etfs ?? [], parsed.asOf ?? "user upload", "user-upload");
        return _state;
      }
    } catch { /* fall through */ }
  }
  _state = buildFromRaw(stocksJson as unknown as RawStock[], fundsJson as unknown as RawFund[], etfsJson as unknown as RawEtf[], BUNDLED_ASOF, "bundled");
  return _state;
}

export function setOverride(kind: "stocks" | "funds" | "etfs", rows: unknown[], asOfLabel?: string): StoreState {
  const cur = getStore();
  const asOf = asOfLabel || new Date().toLocaleDateString();
  const stocksRaw: RawStock[] = kind === "stocks" ? (rows as RawStock[]) : Array.from(cur.stocks.values()).map(stockToRaw);
  const fundsRaw: RawFund[] = kind === "funds" ? (rows as RawFund[]) : Array.from(cur.funds.values()).map(fundToRaw);
  const etfsRaw: RawEtf[] = kind === "etfs" ? (rows as RawEtf[]) : Array.from(cur.etfs.values()).map(etfToRaw);
  _state = buildFromRaw(stocksRaw, fundsRaw, etfsRaw, asOf, "user-upload");
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(LS_OVERRIDE, JSON.stringify({ asOf, stocks: stocksRaw, funds: fundsRaw, etfs: etfsRaw })); } catch { /* ignore */ }
  }
  return _state;
}

export function resetOverride(): StoreState {
  if (typeof localStorage !== "undefined") localStorage.removeItem(LS_OVERRIDE);
  _state = null;
  return getStore();
}

function stockToRaw(q: StockQuote): RawStock { return { SYMBOL: q.symbol, OPEN: q.open ?? undefined, HIGH: q.high ?? undefined, LOW: q.low ?? undefined, "PREV. CLOSE": q.prevClose ?? undefined, LTP: q.ltp ?? undefined, CHNG: q.chng ?? undefined, "%CHNG": q.chngPct ?? undefined, "52W H": q.w52High ?? undefined, "52W L": q.w52Low ?? undefined, "30 D   %CHNG": q.chg30dPct ?? undefined, "365 D   %CHNG": q.chg365dPct ?? undefined, "VOLUME (shares)": q.volume ?? undefined }; }
function fundToRaw(q: FundQuote): RawFund { return { fund_name: q.name, category: q.category, rating: q.rating ?? undefined, ret_1yr_pct: q.ret1y ?? undefined, ret_3yr_pct: q.ret3y ?? undefined, ret_5yr_pct: q.ret5y ?? undefined, ret_10yr_pct: q.ret10y ?? undefined, sip_ret_1yr_pct: q.sipRet1y ?? undefined, sip_ret_3yr_pct: q.sipRet3y ?? undefined, sip_ret_5yr_pct: q.sipRet5y ?? undefined, sip_ret_10yr_pct: q.sipRet10y ?? undefined, expense_ratio_pct: q.expenseRatio ?? undefined, riskometer: q.riskometer ?? undefined, return_grade: q.returnGrade ?? undefined }; }
function etfToRaw(q: EtfQuote): RawEtf { return { etf_name: q.name, category: q.category, ltp_nav: q.nav ?? undefined, day_change_pct: q.dayChangePct ?? undefined, aum_cr: q.aumCr ?? undefined, volume: q.volume ?? undefined, w52_high: q.w52High ?? undefined, w52_low: q.w52Low ?? undefined, ret_1m_pct: q.ret1m ?? undefined, ret_3m_pct: q.ret3m ?? undefined, ret_1yr_pct: q.ret1y ?? undefined, ret_3yr_pct: q.ret3y ?? undefined, ret_5yr_pct: q.ret5y ?? undefined, expense_ratio_pct: q.expenseRatio ?? undefined }; }

// Simple CSV parser (comma, quoted fields, header row required)
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = []; let field = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c !== "")).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}
