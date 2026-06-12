// Server-only helpers for Angel One SmartAPI. Not safe to import from client code.
import { generateSync } from "otplib";

const ANGEL_BASE = "https://apiconnect.angelbroking.com";

interface AngelSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  fetchedAt: number;
}

let cachedSession: AngelSession | null = null;
// JWTs from Angel last ~12h; refresh aggressively at 1h to be safe.
const SESSION_TTL_MS = 60 * 60 * 1000;

function commonHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": process.env.ANGEL_API_KEY ?? "",
    ...extra,
  };
}

async function login(): Promise<AngelSession> {
  const clientcode = process.env.ANGEL_CLIENT_CODE;
  const password = process.env.ANGEL_PASSWORD;
  const totpSecret = process.env.ANGEL_TOTP_SECRET;
  const apiKey = process.env.ANGEL_API_KEY;
  if (!clientcode || !password || !totpSecret || !apiKey) {
    throw new Error("Angel credentials missing (ANGEL_CLIENT_CODE / ANGEL_PASSWORD / ANGEL_TOTP_SECRET / ANGEL_API_KEY)");
  }
  const totp = generateSync({ secret: totpSecret });
  const res = await fetch(`${ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
    method: "POST",
    headers: commonHeaders(),
    body: JSON.stringify({ clientcode, password, totp }),
  });
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { jwtToken: string; refreshToken: string; feedToken: string };
  };
  if (!json.status || !json.data?.jwtToken) {
    throw new Error(`Angel login failed: ${json.message || "unknown"}`);
  }
  cachedSession = { ...json.data, fetchedAt: Date.now() };
  return cachedSession;
}

async function getSession(): Promise<AngelSession> {
  if (cachedSession && Date.now() - cachedSession.fetchedAt < SESSION_TTL_MS) {
    return cachedSession;
  }
  return login();
}

export interface AngelQuote {
  symbol: string;
  exchange: string;
  ltp: number;
  change: number;
  percentChange: number;
  ts: number;
}

export async function fetchAngelQuotes(): Promise<AngelQuote[]> {
  let session = await getSession();
  const body = {
    mode: "FULL",
    exchangeTokens: {
      NSE: ["99926000"], // NIFTY 50
      BSE: ["99919000"], // SENSEX
    },
  };
  const doFetch = async (s: AngelSession) =>
    fetch(`${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote/`, {
      method: "POST",
      headers: commonHeaders({ Authorization: `Bearer ${s.jwtToken}` }),
      body: JSON.stringify(body),
    });

  let res = await doFetch(session);
  if (res.status === 401 || res.status === 403) {
    cachedSession = null;
    session = await login();
    res = await doFetch(session);
  }
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      fetched?: Array<{
        exchange: string;
        tradingSymbol: string;
        symbolToken: string;
        ltp: number;
        close: number;
        netChange?: number;
        percentChange?: number;
      }>;
    };
  };
  if (!json.status || !json.data?.fetched) {
    throw new Error(`Angel quote failed: ${json.message || "unknown"}`);
  }
  const ts = Date.now();
  return json.data.fetched.map((q) => {
    const change = q.netChange ?? q.ltp - q.close;
    const percentChange = q.percentChange ?? (q.close ? (change / q.close) * 100 : 0);
    return {
      symbol: q.tradingSymbol,
      exchange: q.exchange,
      ltp: q.ltp,
      change,
      percentChange,
      ts,
    };
  });
}
