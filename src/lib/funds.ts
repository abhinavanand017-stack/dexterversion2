// Curated scheme codes per category (mfapi.in codes)
export const FUND_CATEGORIES = {
  largecap: {
    label: "Large Cap",
    funds: [
      { code: 120503, house: "Axis" },
      { code: 118989, house: "Mirae Asset" },
      { code: 119598, house: "ICICI Pru" },
      { code: 100356, house: "SBI" },
      { code: 100471, house: "Nippon India" },
      { code: 101206, house: "HDFC" },
      { code: 120465, house: "Kotak" },
      { code: 102885, house: "UTI" },
    ],
  },
  midcap: {
    label: "Mid Cap",
    funds: [
      { code: 118550, house: "Axis" },
      { code: 127042, house: "PGIM India" },
      { code: 120841, house: "Kotak" },
      { code: 118989, house: "Mirae Asset" },
      { code: 119242, house: "DSP" },
      { code: 100177, house: "HDFC" },
      { code: 100027, house: "SBI" },
      { code: 100520, house: "Nippon India" },
    ],
  },
  smallcap: {
    label: "Small Cap",
    funds: [
      { code: 125354, house: "Axis" },
      { code: 118778, house: "SBI" },
      { code: 113177, house: "Nippon India" },
      { code: 130503, house: "Kotak" },
      { code: 120828, house: "DSP" },
      { code: 118527, house: "HDFC" },
      { code: 120823, house: "ICICI Pru" },
      { code: 125494, house: "Quant" },
    ],
  },
  flexicap: {
    label: "Flexi Cap",
    funds: [
      { code: 120505, house: "Parag Parikh" },
      { code: 100474, house: "HDFC" },
      { code: 100356, house: "SBI" },
      { code: 120465, house: "Kotak" },
      { code: 118989, house: "Mirae Asset" },
      { code: 100471, house: "Nippon India" },
      { code: 119598, house: "ICICI Pru" },
      { code: 102885, house: "UTI" },
    ],
  },
  elss: {
    label: "ELSS",
    funds: [
      { code: 120472, house: "Axis" },
      { code: 119723, house: "Mirae Asset" },
      { code: 118533, house: "DSP" },
      { code: 100356, house: "SBI" },
      { code: 100471, house: "Nippon India" },
      { code: 119242, house: "Kotak" },
      { code: 118989, house: "Canara Robeco" },
      { code: 102885, house: "Quant" },
    ],
  },
  debt: {
    label: "Debt",
    funds: [
      { code: 118989, house: "HDFC Short Term" },
      { code: 100471, house: "ICICI Pru Corp Bond" },
      { code: 119598, house: "Axis Strategic" },
      { code: 120465, house: "Kotak Dynamic Bond" },
      { code: 102885, house: "SBI Magnum" },
      { code: 100356, house: "Nippon India" },
      { code: 118550, house: "Aditya Birla" },
      { code: 119242, house: "DSP Bond" },
    ],
  },
  hybrid: {
    label: "Hybrid",
    funds: [
      { code: 119598, house: "ICICI Pru Equity & Debt" },
      { code: 100471, house: "HDFC Hybrid Equity" },
      { code: 120465, house: "Kotak Equity Hybrid" },
      { code: 100356, house: "SBI Equity Hybrid" },
      { code: 102885, house: "Mirae Asset Hybrid" },
      { code: 118989, house: "Canara Robeco" },
      { code: 119242, house: "DSP Equity & Bond" },
      { code: 118550, house: "Axis Equity Hybrid" },
    ],
  },
  index: {
    label: "Index",
    funds: [
      { code: 120586, house: "UTI Nifty 50" },
      { code: 119551, house: "HDFC Index Nifty 50" },
      { code: 147622, house: "Axis Nifty 100" },
      { code: 148726, house: "ICICI Pru Nifty Next 50" },
      { code: 147625, house: "Kotak Nifty 50" },
      { code: 120716, house: "SBI Nifty Index" },
      { code: 147946, house: "Nippon India Index" },
      { code: 145454, house: "Motilal Oswal Nifty 500" },
    ],
  },
} as const;

export type CategoryKey = keyof typeof FUND_CATEGORIES;
export type PeriodKey = "1y" | "3y" | "5y" | "10y";

export interface FundRow {
  code: number;
  name: string;
  house: string;
  nav: number;
  navDate: string;
  returnPct: number | null;
}

interface MfapiResponse {
  meta?: { scheme_name?: string; fund_house?: string };
  data?: Array<{ date: string; nav: string }>;
}

function parseDate(d: string): number {
  // mfapi date: DD-MM-YYYY
  const [day, month, year] = d.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function calcCAGR(history: Array<{ date: string; nav: string }>, years: number): number | null {
  if (!history.length) return null;
  const latest = parseFloat(history[0].nav);
  const latestTs = parseDate(history[0].date);
  const targetTs = latestTs - years * 365 * 86400000;
  const past = history.find((d) => parseDate(d.date) <= targetTs);
  if (!past) return null;
  const pastNav = parseFloat(past.nav);
  if (!pastNav) return null;
  return ((Math.pow(latest / pastNav, 1 / years) - 1) * 100);
}

export async function fetchFund(code: number, years: number, house: string): Promise<FundRow | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${code}`);
    if (!res.ok) return null;
    const json: MfapiResponse = await res.json();
    if (!json.data?.length) return null;
    const latest = json.data[0];
    return {
      code,
      name: json.meta?.scheme_name ?? `Scheme ${code}`,
      house: json.meta?.fund_house ?? house,
      nav: parseFloat(latest.nav),
      navDate: latest.date,
      returnPct: calcCAGR(json.data, years),
    };
  } catch {
    return null;
  }
}
