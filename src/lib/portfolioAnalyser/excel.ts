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

export interface ParseResult {
  holdings: AnalyserHolding[];
  warnings: string[];
}

export async function parseWorkbook(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const holdings: AnalyserHolding[] = [];
  const warnings: string[] = [];

  const stockSheet = wb.Sheets["Stock Holdings"] || wb.Sheets[wb.SheetNames[0]];
  if (stockSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(stockSheet, { defval: "" });
    for (const r of rows) {
      const symbol = String(r["NSE Symbol"] || r["Symbol"] || "").trim().toUpperCase();
      const name = String(r["Stock Name"] || r["Name"] || "").trim();
      const qty = Number(r["Quantity"] || r["Qty"] || 0);
      const avgCost = Number(r["Avg Buy Price (INR)"] || r["Avg Buy Price"] || r["Avg Cost"] || 0);
      if (!symbol || !qty || !avgCost) continue;
      holdings.push({
        id: crypto.randomUUID(),
        kind: "stock",
        symbol, name: name || symbol,
        qty, avgCost,
        buyDate: parseDate(r["Buy Date (DD-MM-YYYY)"] || r["Buy Date"]),
        notes: String(r["Notes"] || ""),
      });
    }
  }

  const fundSheet = wb.Sheets["Mutual Fund Holdings"];
  if (fundSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(fundSheet, { defval: "" });
    for (const r of rows) {
      const code = Number(r["Scheme Code"] || 0);
      const name = String(r["Fund Name"] || "").trim();
      const units = Number(r["Units Held"] || 0);
      const nav = Number(r["Avg Buy NAV (INR)"] || r["Avg Buy NAV"] || 0);
      if (!name || !units || !nav) continue;
      holdings.push({
        id: crypto.randomUUID(),
        kind: "fund",
        symbol: code ? String(code) : name,
        name,
        qty: units,
        avgCost: nav,
        buyDate: parseDate(r["Buy Date (DD-MM-YYYY)"] || r["Buy Date"]),
        schemeCode: code || undefined,
        sipMonthly: Number(r["Monthly SIP (INR)"] || 0) || undefined,
        notes: String(r["Notes"] || ""),
      });
    }
  }

  if (!holdings.length) warnings.push("No valid holdings found. Ensure the sheet has the required columns and rows.");
  return { holdings, warnings };
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
