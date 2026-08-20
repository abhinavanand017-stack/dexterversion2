import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export interface EtfRow {
  ticker: string;
  etf_ticker: string | null;
  forecast_unavailable: boolean | null;
  etf_name: string;
  category: string;
  amc: string | null;
  benchmark: string | null;
  inception_date: string | null;
  ltp_nav: number | null;
  day_change_pct: number | null;
  aum_cr: number | null;
  volume: number | null;
  w52_high: number | null;
  w52_low: number | null;
  ret_1m_pct: number | null;
  ret_3m_pct: number | null;
  ret_1yr_pct: number | null;
  ret_3yr_pct: number | null;
  ret_5yr_pct: number | null;
  expense_ratio_pct: number | null;
  tracking_error_pct: number | null;
  inav: number | null;
  price_updated_at: string | null;
}

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Full ETF universe straight from the database (no hardcoded frontend data). */
export const listEtfs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean; rows: EtfRow[]; error?: string }> => {
    try {
      const { data, error } = await publicClient()
        .from("etfs")
        .select("*")
        .order("aum_cr", { ascending: false });
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: (data ?? []) as unknown as EtfRow[] };
    } catch (e) {
      return { ok: false, rows: [], error: e instanceof Error ? e.message : "unknown" };
    }
  },
);

/** Dated AUM history for the AUM-trend chart. */
export const getEtfAumHistory = createServerFn({ method: "GET" })
  .inputValidator((i: { ticker: string }) => ({ ticker: String(i.ticker).slice(0, 24) }))
  .handler(async ({ data }): Promise<{ ok: boolean; points: { date: string; aum: number }[] }> => {
    try {
      const { data: rows, error } = await publicClient()
        .from("etf_aum_snapshots")
        .select("snapshot_date, aum_cr")
        .eq("ticker", data.ticker)
        .order("snapshot_date", { ascending: true })
        .limit(400);
      if (error) return { ok: false, points: [] };
      return {
        ok: true,
        points: (rows ?? [])
          .filter((r) => r.aum_cr != null)
          .map((r) => ({ date: String(r.snapshot_date), aum: Number(r.aum_cr) })),
      };
    } catch {
      return { ok: false, points: [] };
    }
  });

export interface ResearchNoteInput {
  style: "banker" | "mckinsey";
  name: string;
  ticker: string;
  category: string;
  benchmark: string | null;
  amc: string | null;
  ltp: number | null;
  dayChangePct: number | null;
  aumCr: number | null;
  expenseRatio: number | null;
  categoryAvgExpense: number | null;
  trackingError: number | null;
  premiumDiscountPct: number | null;
  ret1m: number | null;
  ret1y: number | null;
  ret3y: number | null;
  ret5y: number | null;
  peers: { name: string; expense: number | null; aum: number | null; te: number | null }[];
}

export const generateEtfResearchNote = createServerFn({ method: "POST" })
  .inputValidator((i: ResearchNoteInput) => i)
  .handler(async ({ data }): Promise<{ ok: boolean; text: string; error?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, text: "", error: "Text generation service not configured" };

    const facts = `Fund: ${data.name} (${data.ticker}) · ${data.category}
AMC: ${data.amc ?? "Not available"} · Benchmark: ${data.benchmark ?? "Not available"}
LTP/NAV: ${data.ltp ?? "n/a"} (${data.dayChangePct ?? "n/a"}% today)
AUM: ${data.aumCr ?? "n/a"} Cr · Expense ratio: ${data.expenseRatio ?? "n/a"}% vs category average ${data.categoryAvgExpense ?? "n/a"}%
Tracking error: ${data.trackingError ?? "Not available"} · Premium/discount to iNAV: ${data.premiumDiscountPct ?? "Not available"}
Returns: 1M ${data.ret1m ?? "n/a"}%, 1Y ${data.ret1y ?? "n/a"}%, 3Y ${data.ret3y ?? "n/a"}%, 5Y ${data.ret5y ?? "n/a"}%
Peers: ${data.peers.map((p) => `${p.name} (ER ${p.expense ?? "n/a"}%, AUM ${p.aum ?? "n/a"} Cr, TE ${p.te ?? "n/a"})`).join("; ") || "none identified"}`;

    const styleBrief =
      data.style === "banker"
        ? `Write a sell-side style note with these exact headed sections: Thesis, Cost & Liquidity Positioning, Catalysts, Risks, Recommendation. End with a single bold-style recommendation line (Accumulate / Hold / Reduce).`
        : `Write a hypothesis-driven consulting note with these exact headed sections: The Question, Why Hold It, Why Not, Bottom Line. Keep the Why Hold / Why Not points MECE and mutually exclusive. End with a crisp bottom-line call.`;

    const prompt = `You are writing an ETF research note for Indian investors. Use ONLY the facts below — never invent holdings, dates or numbers that are not given; write "Not available" where data is missing.

${facts}

${styleBrief}
Hard rules: 200-300 words total. Plain markdown headings (###). No disclaimers, no filler. Use fund language (Accumulate / Hold / Reduce), never "Buy/Sell a stock".`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`AI gateway research note failed [${res.status}]: ${body}`);
        if (res.status === 429) return { ok: false, text: "", error: "Rate limited — try again in a moment." };
        if (res.status === 402) return { ok: false, text: "", error: "AI credits exhausted for this workspace." };
        return { ok: false, text: "", error: `Generation failed (${res.status})` };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      return text ? { ok: true, text } : { ok: false, text: "", error: "Empty response" };
    } catch (e) {
      console.error("research note error", e);
      return { ok: false, text: "", error: "Text generation service unreachable" };
    }
  });
