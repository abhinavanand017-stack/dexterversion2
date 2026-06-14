// Client-side data loaders used by /forecast and /funds Dexter signals.

import type { Bar } from "./features";
import { fetchYahooChart } from "@/lib/yahoo.functions";

export async function loadStock(symbol: string, exchange: "NS" | "BO" = "NS"): Promise<Bar[]> {
  const sym = `${symbol.trim().toUpperCase()}.${exchange}`;
  const res = await fetchYahooChart({ data: { symbol: sym, range: "2y", interval: "1d" } });
  if (!res.ok || !res.bars?.length) throw new Error(res.error || "No data");
  return res.bars;
}

export interface MfNavPoint { date: string; nav: string }
export interface MfApiResponse {
  meta?: { scheme_name?: string; fund_house?: string; scheme_category?: string };
  data?: MfNavPoint[];
}

function parseMfDate(d: string): number {
  const [day, month, year] = d.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export async function loadFundNav(code: number): Promise<{ meta: MfApiResponse["meta"]; bars: Bar[] }> {
  const res = await fetch(`https://api.mfapi.in/mf/${code}`);
  if (!res.ok) throw new Error("MF fetch failed");
  const json: MfApiResponse = await res.json();
  if (!json.data?.length) throw new Error("No NAV history");
  // mfapi returns latest first; reverse to chronological
  const bars: Bar[] = json.data
    .slice()
    .reverse()
    .map((d) => {
      const c = parseFloat(d.nav);
      const t = parseMfDate(d.date);
      return { t, o: c, h: c, l: c, c, v: 1 };
    })
    .filter((b) => Number.isFinite(b.c));
  return { meta: json.meta, bars };
}

// MFAPI scheme list (full ~2k schemes). Cached in localStorage for 24h.
export interface MfScheme { schemeCode: number; schemeName: string }
const MF_LIST_KEY = "dexter_mf_list_v1";
const MF_LIST_TTL = 24 * 3600 * 1000;

export async function loadMfList(): Promise<MfScheme[]> {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(MF_LIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number; data: MfScheme[] };
        if (Date.now() - parsed.ts < MF_LIST_TTL && Array.isArray(parsed.data)) return parsed.data;
      }
    } catch { /* ignore */ }
  }
  const res = await fetch("https://api.mfapi.in/mf");
  if (!res.ok) throw new Error("MF list failed");
  const data = (await res.json()) as MfScheme[];
  try { localStorage.setItem(MF_LIST_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
  return data;
}
