// Static ETF universe (Groww snapshot, June 2026).
export interface ETF {
  name: string;
  ticker: string;
  category: "Nifty 50" | "Gold" | "Silver" | "International" | "Debt";
  price: number;
  expenseRatio: number;
  aum: string;
  trackingError: number | null;
}

export const ETFS: ETF[] = [
  // Nifty 50
  { name: "Nippon India ETF Nifty 50 BeES", ticker: "NIFTYBEES", category: "Nifty 50", price: 270.94, expenseRatio: 0.04, aum: "62881 Cr", trackingError: 0.02 },
  { name: "SBI-ETF NIFTY 50", ticker: "SETFNIF50", category: "Nifty 50", price: 255.88, expenseRatio: 0.04, aum: "208203 Cr", trackingError: 0.02 },
  { name: "UTI Nifty 50 ETF", ticker: "UTINIFTETF", category: "Nifty 50", price: 263.34, expenseRatio: 0.05, aum: "69606 Cr", trackingError: 0.02 },
  { name: "ICICI Prudential Nifty 50 ETF", ticker: "ICICINIFTY", category: "Nifty 50", price: 269.51, expenseRatio: 0.03, aum: "40626 Cr", trackingError: 0.02 },
  { name: "HDFC Nifty 50 ETF", ticker: "HDFCNIFETF", category: "Nifty 50", price: 268.08, expenseRatio: 0.05, aum: "5282 Cr", trackingError: 0.01 },
  { name: "Kotak Nifty 50 ETF", ticker: "KOTAKNIFTY", category: "Nifty 50", price: 263.50, expenseRatio: 0.06, aum: "3365 Cr", trackingError: 0.02 },
  { name: "Aditya Birla Sun Life Nifty 50 ETF", ticker: "ABSLNIFTY", category: "Nifty 50", price: 27.89, expenseRatio: 0.04, aum: "3102 Cr", trackingError: 0.05 },
  { name: "Axis Nifty 50 ETF", ticker: "AXISNIFTY", category: "Nifty 50", price: 263.35, expenseRatio: 0.04, aum: "1260 Cr", trackingError: 0.03 },
  { name: "Tata Nifty 50 ETF", ticker: "TATANIFTY", category: "Nifty 50", price: 258.57, expenseRatio: 0.09, aum: "709 Cr", trackingError: null },
  { name: "Mirae Asset Nifty 50 ETF", ticker: "MANETF", category: "Nifty 50", price: 258.86, expenseRatio: 0.07, aum: "5235 Cr", trackingError: 0.02 },
  { name: "Zerodha Nifty 50 ETF", ticker: "ZERODHANIFTY", category: "Nifty 50", price: 9.54, expenseRatio: 0.06, aum: "57 Cr", trackingError: 0.43 },
  { name: "Angel One Nifty 50 ETF", ticker: "ANGELONENIFTY", category: "Nifty 50", price: 9.82, expenseRatio: 0.09, aum: "21 Cr", trackingError: 0.05 },
  { name: "Groww Nifty 50 ETF", ticker: "GROWNIFTY", category: "Nifty 50", price: 9.60, expenseRatio: 0.39, aum: "30 Cr", trackingError: 0.13 },
  { name: "Motilal Oswal Nifty 50 ETF", ticker: "MONIFTY50", category: "Nifty 50", price: 248.43, expenseRatio: 0.06, aum: "56 Cr", trackingError: 0.04 },
  { name: "Bandhan Nifty 50 ETF", ticker: "BFNNIFTY", category: "Nifty 50", price: 262.47, expenseRatio: 0.08, aum: "22 Cr", trackingError: 0.03 },
  { name: "LIC MF ETF Nifty 50", ticker: "LICNETFN50", category: "Nifty 50", price: 266.27, expenseRatio: 0.08, aum: "858 Cr", trackingError: 0.07 },
  { name: "Quantum Nifty 50 ETF", ticker: "QNIFTY", category: "Nifty 50", price: 261.60, expenseRatio: 0.20, aum: "62 Cr", trackingError: 0.07 },
  { name: "Bajaj Finserv Nifty 50 ETF", ticker: "BAJNIFTY", category: "Nifty 50", price: 244.99, expenseRatio: 0.08, aum: "172 Cr", trackingError: 0.04 },
  { name: "DSP Nifty 50 ETF", ticker: "DSPNIFTY", category: "Nifty 50", price: 250.67, expenseRatio: 0.07, aum: "270 Cr", trackingError: 0.04 },
  { name: "Edelweiss Nifty 50 ETF", ticker: "EDELWEISSETF", category: "Nifty 50", price: 23.90, expenseRatio: 0.09, aum: "15 Cr", trackingError: 0.15 },
  // Gold
  { name: "Nippon India ETF Gold BeES", ticker: "GOLDBEES", category: "Gold", price: 78.5, expenseRatio: 0.79, aum: "18500 Cr", trackingError: 0.05 },
  { name: "SBI Gold ETF", ticker: "SBIGETS", category: "Gold", price: 78.4, expenseRatio: 0.73, aum: "4200 Cr", trackingError: 0.04 },
  { name: "HDFC Gold ETF", ticker: "HDFCGOLD", category: "Gold", price: 78.2, expenseRatio: 0.59, aum: "3100 Cr", trackingError: 0.04 },
  { name: "ICICI Prudential Gold ETF", ticker: "IPGETF", category: "Gold", price: 78.6, expenseRatio: 0.50, aum: "4800 Cr", trackingError: 0.03 },
  { name: "Kotak Gold ETF", ticker: "KOTAKGOLD", category: "Gold", price: 78.3, expenseRatio: 0.55, aum: "2900 Cr", trackingError: 0.05 },
  { name: "Axis Gold ETF", ticker: "AXISGOLD", category: "Gold", price: 78.1, expenseRatio: 0.56, aum: "1200 Cr", trackingError: 0.06 },
  { name: "Aditya Birla Sun Life Gold ETF", ticker: "BSLGOLDETF", category: "Gold", price: 78.0, expenseRatio: 0.54, aum: "650 Cr", trackingError: 0.07 },
  { name: "UTI Gold ETF", ticker: "GOLDSHARE", category: "Gold", price: 78.4, expenseRatio: 0.50, aum: "1100 Cr", trackingError: 0.05 },
  // Silver
  { name: "Nippon India Silver ETF", ticker: "SILVERBEES", category: "Silver", price: 96.2, expenseRatio: 0.55, aum: "3400 Cr", trackingError: 0.08 },
  { name: "HDFC Silver ETF", ticker: "HDFC_SILVER", category: "Silver", price: 96.0, expenseRatio: 0.40, aum: "1200 Cr", trackingError: 0.07 },
  { name: "ICICI Prudential Silver ETF", ticker: "ICICISILVER", category: "Silver", price: 96.3, expenseRatio: 0.40, aum: "2800 Cr", trackingError: 0.06 },
  { name: "Kotak Silver ETF", ticker: "KOTAKSILVER", category: "Silver", price: 96.1, expenseRatio: 0.45, aum: "850 Cr", trackingError: 0.08 },
  // International
  { name: "Motilal Oswal Nasdaq 100 ETF", ticker: "MOFSL_N100", category: "International", price: 175.4, expenseRatio: 0.58, aum: "8200 Cr", trackingError: 0.12 },
  { name: "Mirae Asset NYSE FANG+ ETF", ticker: "MAFANG", category: "International", price: 105.7, expenseRatio: 0.66, aum: "2100 Cr", trackingError: 0.15 },
  { name: "Nippon India ETF Hang Seng BeES", ticker: "HANGBEES", category: "International", price: 320.5, expenseRatio: 0.93, aum: "450 Cr", trackingError: 0.18 },
  // Debt
  { name: "Bharat Bond ETF April 2030", ticker: "BBETF0430", category: "Debt", price: 1245.6, expenseRatio: 0.0005, aum: "6800 Cr", trackingError: 0.02 },
  { name: "Bharat Bond ETF April 2032", ticker: "BBETF0432", category: "Debt", price: 1118.4, expenseRatio: 0.0005, aum: "5200 Cr", trackingError: 0.02 },
  { name: "Nippon India ETF Nifty CPSE Bond Plus SDL Sep 2024", ticker: "CPSEETF", category: "Debt", price: 1100.2, expenseRatio: 0.15, aum: "1900 Cr", trackingError: 0.03 },
];

export const ETF_CATEGORIES = ["Nifty 50", "Gold", "Silver", "International", "Debt"] as const;
