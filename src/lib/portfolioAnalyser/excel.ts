import * as XLSX from "xlsx";
import type { AnalyserHolding } from "./types";

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  const stocksHeader = [
    ["#", "Stock Name", "NSE Symbol", "Quantity", "Avg Buy Price (INR)", "Buy Date (DD-MM-YYYY)", "Current Price (INR)", "Notes"],
    [1, "Reliance Industries", "RELIANCE", 50, 2850.00, "15-01-2023", "", "example row"],
    [2, "HDFC Bank", "HDFCBANK", 100, 1520.00, "10-03-2023", "", ""],
  ];
  const fundsHeader = [
    ["#", "Fund Name", "Scheme Code", "Units Held", "Avg Buy NAV (INR)", "Buy Date (DD-MM-YYYY)", "Current NAV (INR)", "Investment Type", "Monthly SIP (INR)", "Notes"],
    [1, "Parag Parikh Flexi Cap Fund - Direct Growth", 122639, 245.678, 42.50, "10-06-2022", "", "SIP", 5000, ""],
  ];
  const etfHeader = [
    ["#", "ETF Name", "NSE Symbol", "Units Held", "Avg Buy Price (INR)", "Buy Date (DD-MM-YYYY)", "Current Price (INR)", "Notes"],
    [1, "Nippon India ETF Nifty 50 BeES", "NIFTYBEES", 200, 245.30, "05-04-2023", "", ""],
  ];
  const settingsHeader = [
    ["Parameter", "Value"],
    ["Total Capital (INR)", 500000],
    ["Investment Horizon", "Long Term (5Y)"],
    ["Risk Appetite", "Moderate"],
    ["Rebalancing Frequency", "Quarterly"],
    ["Benchmark", "NIFTY 50"],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stocksHeader), "Stock Holdings");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fundsHeader), "Mutual Fund Holdings");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(etfHeader), "ETF Holdings");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settingsHeader), "Portfolio Settings");

  XLSX.writeFile(wb, "Dexter_Portfolio_Template.xlsx");
}

function parseDate(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Fuzzy column lookup: case/space/punctuation-insensitive, first matching candidate wins. */
function pick(row: Record<string, unknown>, candidates: string[]): unknown {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v);
  for (const c of candidates) {
    const hit = map.get(norm(c));
    if (hit !== undefined && hit !== "") return hit;
  }
  // partial contains match
  for (const c of candidates) {
    const nc = norm(c);
    for (const [k, v] of map.entries()) {
      if (k.includes(nc) && v !== undefined && v !== "") return v;
    }
  }
  return undefined;
}

const NAME_KEYS = ["Stock Name", "Fund Name", "ETF Name", "Name", "Instrument", "Security", "Scheme Name"];
const SYMBOL_KEYS = ["NSE Symbol", "Symbol", "Ticker", "Scheme Code", "ISIN", "Code"];
const QTY_KEYS = ["Quantity", "Units Held", "Units", "Qty", "Shares"];
const COST_KEYS = ["Avg Buy Price (INR)", "Avg Buy NAV (INR)", "Avg Buy Price", "Avg Buy NAV", "Avg Cost", "Buy Price", "Average Price", "Cost"];
const DATE_KEYS = ["Buy Date (DD-MM-YYYY)", "Buy Date", "Purchase Date", "Date"];
const PRICE_KEYS = ["Current Price (INR)", "Current NAV (INR)", "Current Price", "Current NAV", "LTP", "Market Price"];

function toRow(r: Record<string, unknown>, kind: AnalyserHolding["kind"]): AnalyserHolding | null {
  const name = String(pick(r, NAME_KEYS) ?? "").trim();
  const rawSym = String(pick(r, SYMBOL_KEYS) ?? "").trim();
  const qty = Number(pick(r, QTY_KEYS) ?? 0);
  const avgCost = Number(pick(r, COST_KEYS) ?? 0);
  const cur = Number(pick(r, PRICE_KEYS) ?? 0);
  if (!qty || !avgCost || (!name && !rawSym)) return null;

  const schemeCode = kind === "fund" && /^\d+$/.test(rawSym) ? Number(rawSym) : undefined;
  return {
    id: crypto.randomUUID(),
    kind,
    symbol: kind === "fund" ? (rawSym || name) : rawSym.toUpperCase() || name.toUpperCase(),
    name: name || rawSym,
    qty,
    avgCost,
    buyDate: parseDate(pick(r, DATE_KEYS)),
    currentPrice: cur > 0 ? cur : undefined,
    schemeCode,
    sipMonthly: Number(pick(r, ["Monthly SIP (INR)", "Monthly SIP", "SIP"]) ?? 0) || undefined,
    notes: String(pick(r, ["Notes", "Remarks"]) ?? ""),
  };
}

function kindFromType(v: unknown): AnalyserHolding["kind"] | null {
  const s = String(v ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("etf")) return "etf";
  if (s.includes("mutual") || s.includes("fund") || s.includes("mf")) return "fund";
  if (s.includes("stock") || s.includes("equity") || s.includes("share")) return "stock";
  return null;
}

export interface ParseResult {
  holdings: AnalyserHolding[];
  warnings: string[];
  errors: string[];
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] | null {
  const s = wb.Sheets[name];
  if (!s) return null;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(s, { defval: "" });
}

export async function parseWorkbook(file: File): Promise<ParseResult> {
  const holdings: AnalyserHolding[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  let wb: XLSX.WorkBook;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch {
    return { holdings: [], warnings: [], errors: [`"${file.name}" could not be read. It may be corrupt or password-protected.`] };
  }
  if (!wb.SheetNames.length) {
    return { holdings: [], warnings: [], errors: [`"${file.name}" contains no sheets.`] };
  }

  const named: [string, AnalyserHolding["kind"]][] = [
    ["Stock Holdings", "stock"],
    ["Mutual Fund Holdings", "fund"],
    ["ETF Holdings", "etf"],
  ];
  let matchedNamedSheet = false;

  for (const [sheet, kind] of named) {
    const rows = sheetRows(wb, sheet);
    if (!rows) continue;
    matchedNamedSheet = true;
    if (!rows.length) { warnings.push(`Sheet "${sheet}" is empty — skipped.`); continue; }
    let kept = 0;
    for (const r of rows) {
      const h = toRow(r, kind);
      if (h) { holdings.push(h); kept++; }
    }
    if (!kept) warnings.push(`Sheet "${sheet}" had ${rows.length} row(s) but none had a usable quantity and buy price.`);
  }

  // Flat fallback: single sheet with a Type column
  if (!matchedNamedSheet) {
    const first = wb.SheetNames[0];
    const rows = sheetRows(wb, first) ?? [];
    if (!rows.length) {
      return { holdings: [], warnings, errors: [`Sheet "${first}" is empty — nothing to analyse.`] };
    }
    let untyped = 0;
    for (const r of rows) {
      const kind = kindFromType(pick(r, ["Type", "Asset Type", "Instrument Type", "Category"]));
      if (!kind) untyped++;
      const h = toRow(r, kind ?? "stock");
      if (h) holdings.push(h);
    }
    if (untyped) warnings.push(`${untyped} row(s) had no recognisable Type column value — treated as stocks. Fix them in the preview below.`);
  }

  const unresolved = holdings.filter((h) => !h.symbol.trim()).length;
  if (unresolved) warnings.push(`${unresolved} row(s) have no symbol / scheme code and cannot be priced live.`);
  if (!holdings.length) {
    errors.push("No valid holdings found. Each row needs a name or symbol, a quantity and an average buy price.");
  }
  return { holdings, warnings, errors };
}

export function exportHoldings(rows: {
  name: string; kind: string; qty: number; avgCost: number;
  currentValue: number; pnl: number; pnlPct: number; cagr: number; weight: number;
}[]) {
  const wb = XLSX.utils.book_new();
  const header = ["Name", "Type", "Qty/Units", "Avg Cost (INR)", "Current Value (INR)", "P&L (INR)", "P&L %", "CAGR %", "Weight %"];
  const data = [header, ...rows.map((r) => [
    r.name, r.kind, r.qty, r.avgCost, r.currentValue, r.pnl,
    (r.pnlPct * 100).toFixed(2), (r.cagr * 100).toFixed(2), (r.weight * 100).toFixed(2),
  ])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Holdings");
  XLSX.writeFile(wb, `Dexter_Portfolio_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
