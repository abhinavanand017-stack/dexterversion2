export interface Stock {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  marketCap: number; // ₹ Cr
  price: number;
  pe: number;
  pb: number;
  roe: number;
  dividendYield: number;
  week52High: number;
  week52Low: number;
  debtEquity: number;
  revenueGrowth: number;
  eps: number;
  rating: number;
}

export const SECTORS = [
  "Banking", "IT", "Auto", "FMCG", "Pharma", "Energy", "Telecom",
  "Capital Goods", "NBFC", "Cement", "Utilities", "Consumer", "Conglomerate",
  "Financial", "Metals", "Retail",
];

const baseStocks: Stock[] = [
  { symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries Ltd", sector: "Energy", marketCap: 1920000, price: 2950, pe: 28.4, pb: 2.1, roe: 9.8, dividendYield: 0.4, week52High: 3217, week52Low: 2220, debtEquity: 0.42, revenueGrowth: 8.2, eps: 103.8, rating: 4 },
  { symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services", sector: "IT", marketCap: 1450000, price: 4020, pe: 32.1, pb: 14.2, roe: 47.3, dividendYield: 1.6, week52High: 4592, week52Low: 3311, debtEquity: 0.0, revenueGrowth: 5.8, eps: 125.2, rating: 5 },
  { symbol: "HDFCBANK", exchange: "NSE", name: "HDFC Bank Ltd", sector: "Banking", marketCap: 1230000, price: 1640, pe: 19.2, pb: 2.8, roe: 15.9, dividendYield: 1.1, week52High: 1880, week52Low: 1363, debtEquity: 6.9, revenueGrowth: 22.1, eps: 85.4, rating: 5 },
  { symbol: "INFY", exchange: "NSE", name: "Infosys Ltd", sector: "IT", marketCap: 760000, price: 1840, pe: 26.8, pb: 8.4, roe: 32.1, dividendYield: 2.3, week52High: 2006, week52Low: 1358, debtEquity: 0.0, revenueGrowth: 3.2, eps: 68.7, rating: 4 },
  { symbol: "ICICIBANK", exchange: "NSE", name: "ICICI Bank Ltd", sector: "Banking", marketCap: 890000, price: 1270, pe: 18.6, pb: 2.9, roe: 17.4, dividendYield: 0.8, week52High: 1388, week52Low: 970, debtEquity: 5.8, revenueGrowth: 19.6, eps: 68.3, rating: 5 },
  { symbol: "WIPRO", exchange: "NSE", name: "Wipro Ltd", sector: "IT", marketCap: 295000, price: 480, pe: 22.4, pb: 4.1, roe: 14.8, dividendYield: 0.2, week52High: 571, week52Low: 418, debtEquity: 0.1, revenueGrowth: 1.1, eps: 21.4, rating: 3 },
  { symbol: "BHARTIARTL", exchange: "NSE", name: "Bharti Airtel Ltd", sector: "Telecom", marketCap: 940000, price: 1680, pe: 58.2, pb: 9.6, roe: 15.2, dividendYield: 0.3, week52High: 1779, week52Low: 1100, debtEquity: 1.42, revenueGrowth: 16.3, eps: 28.9, rating: 4 },
  { symbol: "LT", exchange: "NSE", name: "Larsen & Toubro Ltd", sector: "Capital Goods", marketCap: 490000, price: 3580, pe: 36.4, pb: 5.2, roe: 14.6, dividendYield: 1.0, week52High: 3963, week52Low: 2845, debtEquity: 1.8, revenueGrowth: 17.9, eps: 98.4, rating: 4 },
  { symbol: "AXISBANK", exchange: "NSE", name: "Axis Bank Ltd", sector: "Banking", marketCap: 360000, price: 1170, pe: 15.8, pb: 2.1, roe: 14.2, dividendYield: 0.1, week52High: 1339, week52Low: 952, debtEquity: 7.1, revenueGrowth: 12.8, eps: 74.1, rating: 4 },
  { symbol: "KOTAKBANK", exchange: "NSE", name: "Kotak Mahindra Bank Ltd", sector: "Banking", marketCap: 380000, price: 1920, pe: 22.4, pb: 3.1, roe: 13.9, dividendYield: 0.1, week52High: 2193, week52Low: 1544, debtEquity: 5.2, revenueGrowth: 15.2, eps: 85.7, rating: 4 },
  { symbol: "SBIN", exchange: "NSE", name: "State Bank of India", sector: "Banking", marketCap: 720000, price: 810, pe: 10.2, pb: 1.7, roe: 17.4, dividendYield: 1.9, week52High: 912, week52Low: 620, debtEquity: 14.2, revenueGrowth: 20.1, eps: 79.4, rating: 4 },
  { symbol: "MARUTI", exchange: "NSE", name: "Maruti Suzuki India Ltd", sector: "Auto", marketCap: 360000, price: 12150, pe: 27.8, pb: 5.1, roe: 17.2, dividendYield: 1.2, week52High: 13680, week52Low: 10000, debtEquity: 0.0, revenueGrowth: 14.6, eps: 436.9, rating: 4 },
  { symbol: "TITAN", exchange: "NSE", name: "Titan Company Ltd", sector: "Consumer", marketCap: 310000, price: 3490, pe: 92.1, pb: 23.4, roe: 26.8, dividendYield: 0.3, week52High: 3888, week52Low: 2810, debtEquity: 0.1, revenueGrowth: 19.2, eps: 37.9, rating: 4 },
  { symbol: "SUNPHARMA", exchange: "NSE", name: "Sun Pharmaceutical Industries", sector: "Pharma", marketCap: 380000, price: 1590, pe: 34.6, pb: 5.8, roe: 18.1, dividendYield: 0.7, week52High: 1960, week52Low: 1350, debtEquity: 0.1, revenueGrowth: 9.4, eps: 45.9, rating: 4 },
  { symbol: "ULTRACEMCO", exchange: "NSE", name: "UltraTech Cement Ltd", sector: "Cement", marketCap: 290000, price: 10200, pe: 38.2, pb: 5.9, roe: 15.8, dividendYield: 0.5, week52High: 11400, week52Low: 8250, debtEquity: 0.4, revenueGrowth: 7.1, eps: 267.0, rating: 4 },
  { symbol: "ADANIENT", exchange: "NSE", name: "Adani Enterprises Ltd", sector: "Conglomerate", marketCap: 340000, price: 2950, pe: 76.4, pb: 8.2, roe: 9.4, dividendYield: 0.1, week52High: 3743, week52Low: 2025, debtEquity: 1.2, revenueGrowth: 22.8, eps: 38.6, rating: 3 },
  { symbol: "POWERGRID", exchange: "NSE", name: "Power Grid Corporation", sector: "Utilities", marketCap: 280000, price: 305, pe: 18.4, pb: 3.2, roe: 18.2, dividendYield: 3.9, week52High: 366, week52Low: 248, debtEquity: 1.8, revenueGrowth: 5.4, eps: 16.6, rating: 4 },
  { symbol: "NTPC", exchange: "NSE", name: "NTPC Ltd", sector: "Utilities", marketCap: 330000, price: 340, pe: 17.2, pb: 2.4, roe: 13.1, dividendYield: 2.8, week52High: 448, week52Low: 287, debtEquity: 1.6, revenueGrowth: 8.9, eps: 19.8, rating: 4 },
  { symbol: "BAJFINANCE", exchange: "NSE", name: "Bajaj Finance Ltd", sector: "NBFC", marketCap: 470000, price: 7620, pe: 32.8, pb: 6.8, roe: 21.6, dividendYield: 0.4, week52High: 8192, week52Low: 6187, debtEquity: 3.8, revenueGrowth: 29.4, eps: 232.3, rating: 5 },
  { symbol: "HINDUNILVR", exchange: "NSE", name: "Hindustan Unilever Ltd", sector: "FMCG", marketCap: 560000, price: 2380, pe: 54.2, pb: 11.4, roe: 21.6, dividendYield: 1.8, week52High: 2862, week52Low: 2172, debtEquity: 0.0, revenueGrowth: 2.4, eps: 43.9, rating: 4 },
  { symbol: "ITC", exchange: "NSE", name: "ITC Ltd", sector: "FMCG", marketCap: 540000, price: 430, pe: 26.2, pb: 7.2, roe: 27.8, dividendYield: 3.4, week52High: 528, week52Low: 390, debtEquity: 0.0, revenueGrowth: 6.4, eps: 16.4, rating: 4 },
  { symbol: "ONGC", exchange: "NSE", name: "Oil & Natural Gas Corp", sector: "Energy", marketCap: 340000, price: 270, pe: 8.2, pb: 1.2, roe: 14.2, dividendYield: 4.6, week52High: 345, week52Low: 215, debtEquity: 0.4, revenueGrowth: -3.2, eps: 32.9, rating: 3 },
  { symbol: "M&M", exchange: "NSE", name: "Mahindra & Mahindra Ltd", sector: "Auto", marketCap: 370000, price: 3010, pe: 28.4, pb: 5.8, roe: 20.8, dividendYield: 0.7, week52High: 3238, week52Low: 1970, debtEquity: 0.2, revenueGrowth: 21.4, eps: 105.9, rating: 5 },
  { symbol: "TATAMOTORS", exchange: "NSE", name: "Tata Motors Ltd", sector: "Auto", marketCap: 290000, price: 790, pe: 8.2, pb: 2.4, roe: 29.2, dividendYield: 0.6, week52High: 1180, week52Low: 724, debtEquity: 1.4, revenueGrowth: 14.2, eps: 96.3, rating: 4 },
  { symbol: "DRREDDY", exchange: "NSE", name: "Dr. Reddy's Laboratories", sector: "Pharma", marketCap: 210000, price: 1260, pe: 18.6, pb: 3.8, roe: 22.4, dividendYield: 0.6, week52High: 1460, week52Low: 1075, debtEquity: 0.1, revenueGrowth: 13.8, eps: 67.7, rating: 4 },
  { symbol: "CIPLA", exchange: "NSE", name: "Cipla Ltd", sector: "Pharma", marketCap: 195000, price: 1540, pe: 26.2, pb: 5.2, roe: 18.6, dividendYield: 0.4, week52High: 1702, week52Low: 1271, debtEquity: 0.1, revenueGrowth: 8.2, eps: 58.8, rating: 4 },
  { symbol: "HCLTECH", exchange: "NSE", name: "HCL Technologies Ltd", sector: "IT", marketCap: 490000, price: 1810, pe: 28.4, pb: 7.2, roe: 24.6, dividendYield: 3.6, week52High: 2011, week52Low: 1235, debtEquity: 0.0, revenueGrowth: 4.8, eps: 63.7, rating: 4 },
  { symbol: "TECHM", exchange: "NSE", name: "Tech Mahindra Ltd", sector: "IT", marketCap: 180000, price: 1680, pe: 46.8, pb: 6.4, roe: 10.8, dividendYield: 1.5, week52High: 1807, week52Low: 1110, debtEquity: 0.1, revenueGrowth: -3.4, eps: 35.9, rating: 3 },
  { symbol: "ASIANPAINT", exchange: "NSE", name: "Asian Paints Ltd", sector: "Consumer", marketCap: 260000, price: 2710, pe: 46.2, pb: 14.2, roe: 27.8, dividendYield: 1.2, week52High: 3395, week52Low: 2210, debtEquity: 0.0, revenueGrowth: -2.4, eps: 58.7, rating: 3 },
  { symbol: "BAJAJFINSV", exchange: "NSE", name: "Bajaj Finserv Ltd", sector: "Financial", marketCap: 240000, price: 1980, pe: 20.4, pb: 3.1, roe: 10.2, dividendYield: 0.1, week52High: 2030, week52Low: 1419, debtEquity: 1.4, revenueGrowth: 22.6, eps: 97.1, rating: 4 },
  { symbol: "NESTLEIND", exchange: "NSE", name: "Nestle India Ltd", sector: "FMCG", marketCap: 240000, price: 2480, pe: 75.1, pb: 60.2, roe: 80.1, dividendYield: 0.9, week52High: 2778, week52Low: 2145, debtEquity: 0.1, revenueGrowth: 9.4, eps: 33.0, rating: 4 },
  { symbol: "BRITANNIA", exchange: "NSE", name: "Britannia Industries Ltd", sector: "FMCG", marketCap: 130000, price: 5410, pe: 60.4, pb: 27.1, roe: 45.2, dividendYield: 1.3, week52High: 6473, week52Low: 4640, debtEquity: 0.5, revenueGrowth: 4.8, eps: 89.6, rating: 4 },
  { symbol: "DABUR", exchange: "NSE", name: "Dabur India Ltd", sector: "FMCG", marketCap: 100000, price: 565, pe: 48.2, pb: 9.4, roe: 19.4, dividendYield: 1.0, week52High: 672, week52Low: 489, debtEquity: 0.1, revenueGrowth: 5.6, eps: 11.7, rating: 3 },
  { symbol: "GODREJCP", exchange: "NSE", name: "Godrej Consumer Products", sector: "FMCG", marketCap: 110000, price: 1080, pe: 52.4, pb: 7.8, roe: 14.8, dividendYield: 0.9, week52High: 1535, week52Low: 998, debtEquity: 0.2, revenueGrowth: 8.4, eps: 20.6, rating: 4 },
  { symbol: "PIDILITIND", exchange: "NSE", name: "Pidilite Industries Ltd", sector: "Consumer", marketCap: 150000, price: 2940, pe: 87.2, pb: 18.4, roe: 22.1, dividendYield: 0.5, week52High: 3402, week52Low: 2470, debtEquity: 0.0, revenueGrowth: 8.8, eps: 33.7, rating: 4 },
  { symbol: "BERGEPAINT", exchange: "NSE", name: "Berger Paints India Ltd", sector: "Consumer", marketCap: 65000, price: 555, pe: 56.4, pb: 12.1, roe: 21.4, dividendYield: 0.6, week52High: 656, week52Low: 462, debtEquity: 0.1, revenueGrowth: 3.1, eps: 9.8, rating: 3 },
  { symbol: "HAVELLS", exchange: "NSE", name: "Havells India Ltd", sector: "Consumer", marketCap: 110000, price: 1750, pe: 75.4, pb: 13.2, roe: 18.2, dividendYield: 0.6, week52High: 2106, week52Low: 1400, debtEquity: 0.0, revenueGrowth: 14.2, eps: 23.2, rating: 4 },
  { symbol: "VOLTAS", exchange: "NSE", name: "Voltas Ltd", sector: "Consumer", marketCap: 56000, price: 1700, pe: 95.6, pb: 8.4, roe: 8.8, dividendYield: 0.3, week52High: 1944, week52Low: 1097, debtEquity: 0.2, revenueGrowth: 28.4, eps: 17.8, rating: 4 },
  { symbol: "TATACONSUM", exchange: "NSE", name: "Tata Consumer Products", sector: "FMCG", marketCap: 105000, price: 1060, pe: 88.2, pb: 5.4, roe: 6.5, dividendYield: 1.0, week52High: 1255, week52Low: 880, debtEquity: 0.1, revenueGrowth: 9.1, eps: 12.0, rating: 4 },
  { symbol: "ZOMATO", exchange: "NSE", name: "Zomato Ltd", sector: "Retail", marketCap: 230000, price: 268, pe: 320.4, pb: 12.4, roe: 4.2, dividendYield: 0, week52High: 304, week52Low: 144, debtEquity: 0.0, revenueGrowth: 71.4, eps: 0.84, rating: 4 },
  { symbol: "PAYTM", exchange: "NSE", name: "One 97 Communications", sector: "Financial", marketCap: 50000, price: 790, pe: -42.1, pb: 4.2, roe: -10.4, dividendYield: 0, week52High: 1063, week52Low: 310, debtEquity: 0.0, revenueGrowth: -8.4, eps: -18.8, rating: 2 },
  { symbol: "NYKAA", exchange: "NSE", name: "FSN E-Commerce (Nykaa)", sector: "Retail", marketCap: 50000, price: 175, pe: 580.2, pb: 22.4, roe: 3.8, dividendYield: 0, week52High: 224, week52Low: 142, debtEquity: 0.1, revenueGrowth: 24.6, eps: 0.3, rating: 3 },
  { symbol: "DMART", exchange: "NSE", name: "Avenue Supermarts (DMart)", sector: "Retail", marketCap: 290000, price: 4470, pe: 95.4, pb: 14.2, roe: 14.8, dividendYield: 0, week52High: 5485, week52Low: 3553, debtEquity: 0.0, revenueGrowth: 17.4, eps: 46.8, rating: 4 },
  { symbol: "TRENT", exchange: "NSE", name: "Trent Ltd", sector: "Retail", marketCap: 240000, price: 6800, pe: 175.4, pb: 38.2, roe: 22.4, dividendYield: 0.1, week52High: 8345, week52Low: 3850, debtEquity: 0.3, revenueGrowth: 56.4, eps: 38.8, rating: 5 },
  { symbol: "VEDL", exchange: "NSE", name: "Vedanta Ltd", sector: "Metals", marketCap: 170000, price: 460, pe: 12.4, pb: 3.8, roe: 24.6, dividendYield: 6.8, week52High: 526, week52Low: 250, debtEquity: 2.4, revenueGrowth: 4.2, eps: 37.1, rating: 3 },
  { symbol: "HINDALCO", exchange: "NSE", name: "Hindalco Industries Ltd", sector: "Metals", marketCap: 160000, price: 720, pe: 14.8, pb: 1.9, roe: 12.8, dividendYield: 0.5, week52High: 772, week52Low: 547, debtEquity: 0.8, revenueGrowth: 8.6, eps: 48.6, rating: 4 },
  { symbol: "JSWSTEEL", exchange: "NSE", name: "JSW Steel Ltd", sector: "Metals", marketCap: 230000, price: 950, pe: 28.4, pb: 2.8, roe: 9.8, dividendYield: 0.8, week52High: 1074, week52Low: 760, debtEquity: 1.2, revenueGrowth: 2.4, eps: 33.5, rating: 4 },
  { symbol: "TATASTEEL", exchange: "NSE", name: "Tata Steel Ltd", sector: "Metals", marketCap: 200000, price: 165, pe: 32.4, pb: 2.2, roe: 6.4, dividendYield: 2.2, week52High: 184, week52Low: 122, debtEquity: 0.9, revenueGrowth: 1.2, eps: 5.1, rating: 3 },
  { symbol: "SAIL", exchange: "NSE", name: "Steel Authority of India", sector: "Metals", marketCap: 50000, price: 120, pe: 18.4, pb: 0.8, roe: 4.4, dividendYield: 1.7, week52High: 175, week52Low: 100, debtEquity: 0.7, revenueGrowth: -1.4, eps: 6.5, rating: 3 },
  { symbol: "COALINDIA", exchange: "NSE", name: "Coal India Ltd", sector: "Energy", marketCap: 290000, price: 470, pe: 7.4, pb: 3.4, roe: 47.2, dividendYield: 5.4, week52High: 545, week52Low: 350, debtEquity: 0.2, revenueGrowth: 3.8, eps: 63.5, rating: 4 },
  { symbol: "GRASIM", exchange: "NSE", name: "Grasim Industries Ltd", sector: "Cement", marketCap: 180000, price: 2700, pe: 32.1, pb: 1.6, roe: 5.4, dividendYield: 0.4, week52High: 2879, week52Low: 1955, debtEquity: 1.1, revenueGrowth: 12.4, eps: 84.1, rating: 4 },
  { symbol: "SHREECEM", exchange: "NSE", name: "Shree Cement Ltd", sector: "Cement", marketCap: 100000, price: 27500, pe: 65.4, pb: 5.2, roe: 8.4, dividendYield: 0.4, week52High: 31149, week52Low: 23500, debtEquity: 0.1, revenueGrowth: -1.2, eps: 420.5, rating: 3 },
  { symbol: "ACC", exchange: "NSE", name: "ACC Ltd", sector: "Cement", marketCap: 40000, price: 2100, pe: 18.4, pb: 2.4, roe: 13.2, dividendYield: 0.8, week52High: 2843, week52Low: 1797, debtEquity: 0.0, revenueGrowth: 4.4, eps: 114.1, rating: 4 },
  { symbol: "AMBUJACEM", exchange: "NSE", name: "Ambuja Cements Ltd", sector: "Cement", marketCap: 140000, price: 575, pe: 28.4, pb: 2.8, roe: 9.4, dividendYield: 0.4, week52High: 707, week52Low: 484, debtEquity: 0.0, revenueGrowth: 7.4, eps: 20.3, rating: 4 },
  { symbol: "INDUSINDBK", exchange: "NSE", name: "IndusInd Bank Ltd", sector: "Banking", marketCap: 80000, price: 1030, pe: 11.4, pb: 1.4, roe: 12.4, dividendYield: 1.5, week52High: 1694, week52Low: 938, debtEquity: 6.4, revenueGrowth: 8.4, eps: 90.4, rating: 3 },
  { symbol: "BANDHANBNK", exchange: "NSE", name: "Bandhan Bank Ltd", sector: "Banking", marketCap: 27000, price: 170, pe: 10.4, pb: 1.2, roe: 11.4, dividendYield: 0.9, week52High: 222, week52Low: 145, debtEquity: 6.8, revenueGrowth: 4.2, eps: 16.3, rating: 3 },
  { symbol: "FEDERALBNK", exchange: "NSE", name: "Federal Bank Ltd", sector: "Banking", marketCap: 47000, price: 195, pe: 9.8, pb: 1.4, roe: 13.8, dividendYield: 0.6, week52High: 217, week52Low: 138, debtEquity: 7.4, revenueGrowth: 19.4, eps: 19.9, rating: 4 },
  { symbol: "IDFCFIRSTB", exchange: "NSE", name: "IDFC First Bank Ltd", sector: "Banking", marketCap: 50000, price: 67, pe: 24.4, pb: 1.6, roe: 6.4, dividendYield: 0, week52High: 95, week52Low: 60, debtEquity: 8.1, revenueGrowth: 18.4, eps: 2.7, rating: 3 },
  { symbol: "RBLBANK", exchange: "NSE", name: "RBL Bank Ltd", sector: "Banking", marketCap: 14000, price: 230, pe: 8.4, pb: 0.9, roe: 10.8, dividendYield: 0.7, week52High: 304, week52Low: 187, debtEquity: 6.8, revenueGrowth: 14.4, eps: 27.4, rating: 3 },
];

export const STOCK_UNIVERSE: Stock[] = baseStocks;

export function dexterScore(s: Stock): number {
  const roeScore = Math.min(s.roe, 50) * 0.3;
  const peScore = Math.max(0, (50 - Math.min(s.pe, 100))) / 50 * 20;
  const divScore = Math.min(s.dividendYield, 8) * 1.25;
  const growthScore = Math.max(-10, Math.min(s.revenueGrowth, 30)) / 30 * 20;
  const safetyScore = Math.max(0, 1 - Math.min(s.debtEquity, 3) / 3) * 20;
  const raw = roeScore + peScore + divScore + growthScore + safetyScore;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function findStock(q: string): Stock[] {
  const Q = q.trim().toUpperCase();
  if (!Q) return STOCK_UNIVERSE.slice(0, 8);
  return STOCK_UNIVERSE.filter(
    (s) => s.symbol.includes(Q) || s.name.toUpperCase().includes(Q),
  ).slice(0, 12);
}
