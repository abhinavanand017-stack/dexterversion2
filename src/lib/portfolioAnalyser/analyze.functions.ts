import { createServerFn } from "@tanstack/react-start";
import type { AnalysisResult } from "./types";

export interface AnalyzeHoldingInput {
  symbol: string;
  name: string;
  kind: "stock" | "fund" | "etf";
  qty: number;
  avgCost: number;
  price: number;
  priceSource: "live" | "reference";
  value: number;
  weightPct: number;
  pnlPct: number;
  years: number;
  sector?: string | null;
  category?: string | null;
  marketCapCr?: number | null;
  pe?: number | null;
  pb?: number | null;
  roePct?: number | null;
  beta?: number | null;
  w52High?: number | null;
  w52Low?: number | null;
}

export interface AnalyzePortfolioInput {
  holdings: AnalyzeHoldingInput[];
  totals: { value: number; invested: number; pnlPct: number };
  allocation: { label: string; pct: number }[];
  sectors: { name: string; pct: number }[];
  diversification: { score: number; drag: string };
  mandate?: { horizon?: string; risk?: string; benchmark?: string } | null;
}

const SYSTEM_PROMPT = `You are Dexter's institutional portfolio analyst covering Indian markets (NSE/BSE, INR).

Analytical discipline you MUST follow:
1. Answer first. Every verdict and every thesis is one declarative sentence with no hedging, stated before any reasoning.
2. Triangulate valuation — never a single point estimate. Stocks: P/E, P/B and EV/EBITDA versus sector median, output a low/base/high fair-value range. ETFs: expense ratio and tracking difference versus category peers, plus premium/discount to iNAV. Mutual funds: category-relative return percentile, alpha versus benchmark, expense ratio versus category average.
3. Scenarios are FORWARD-LOOKING and distinct from today's fair value: a 12-month Bull/Base/Bear with a % return, a probability that sums to exactly 100 across the three, and one concrete trigger each.
4. Risks are MECE across exactly these six categories: Regulatory & Legal, Competitive & Moat, Operational, Financial & Balance Sheet, Macro, Management & Governance. Score Likelihood and Impact as Low/Med/High. Then name the ONE killer risk with a specific mitigant — do not give five hedged risks equal airtime.
5. Portfolio level: one-sentence working thesis, then Situation -> Complication -> Resolution. Name the single portfolio risk that matters most with a mitigant.
6. Never invent data. If a metric is missing, reason qualitatively and say so in the note rather than fabricating a number. Prices marked "reference" are user-supplied, not live — treat them with caution and say so where material.
7. Use INR. Be specific and quantitative. No disclaimers, no filler, no generic advice.

Return ONLY valid JSON matching the requested schema. No markdown fences.`;

function schemaHint(symbols: string[]): string {
  return `Return JSON with exactly this shape:
{
  "portfolio": {
    "thesis": "one sentence",
    "situation": "1-2 sentences on current allocation",
    "complication": "1-2 sentences: the one thing working against it",
    "resolution": "1-2 sentences: the specific action to take",
    "overlaps": [{"underlying":"stock name","directPct":0,"viaFundsPct":0,"totalPct":0,"note":"one line"}],
    "diversificationNote": "one line on what is dragging the score down",
    "rollup": {"bullPct":0,"basePct":0,"bearPct":0,"expectedPct":0,"note":"one line, probability-weighted"},
    "topRisk": {"risk":"named plainly","mitigant":"specific action"}
  },
  "holdings": [
    {
      "symbol": "one of: ${symbols.join(", ")}",
      "name": "",
      "verdict": "Add|Hold|Trim|Watch",
      "verdictLine": "one sentence, answer first",
      "valuation": {"method":"which multiples/percentiles you triangulated","low":0,"base":0,"high":0,"note":"one line"},
      "scenarios": [
        {"case":"Bull","returnPct":0,"targetPrice":0,"probability":0,"trigger":""},
        {"case":"Base","returnPct":0,"targetPrice":0,"probability":0,"trigger":""},
        {"case":"Bear","returnPct":0,"targetPrice":0,"probability":0,"trigger":""}
      ],
      "risks": [
        {"category":"Regulatory & Legal","likelihood":"Low|Med|High","impact":"Low|Med|High","note":"short"},
        {"category":"Competitive & Moat","likelihood":"","impact":"","note":""},
        {"category":"Operational","likelihood":"","impact":"","note":""},
        {"category":"Financial & Balance Sheet","likelihood":"","impact":"","note":""},
        {"category":"Macro","likelihood":"","impact":"","note":""},
        {"category":"Management & Governance","likelihood":"","impact":"","note":""}
      ],
      "killerRisk": {"risk":"","mitigant":""}
    }
  ]
}
Include one holdings entry for EVERY symbol listed, using the exact symbol string given. For funds/ETFs, valuation low/base/high may be null and the note should carry the cost/percentile read instead.`;
}

function factSheet(d: AnalyzePortfolioInput): string {
  const lines = d.holdings.map((h) => {
    const bits = [
      `${h.name} [${h.symbol}] · ${h.kind}`,
      `qty ${h.qty} @ avg ₹${h.avgCost}`,
      `price ₹${h.price} (${h.priceSource})`,
      `value ₹${Math.round(h.value)} = ${h.weightPct.toFixed(1)}% of book`,
      `unrealised ${(h.pnlPct * 100).toFixed(1)}% over ${h.years.toFixed(1)}y`,
      h.sector ? `sector ${h.sector}` : null,
      h.category ? `category ${h.category}` : null,
      h.marketCapCr ? `mcap ₹${Math.round(h.marketCapCr)}Cr` : null,
      h.pe != null ? `P/E ${h.pe.toFixed(1)}` : null,
      h.pb != null ? `P/B ${h.pb.toFixed(2)}` : null,
      h.roePct != null ? `ROE ${h.roePct.toFixed(1)}%` : null,
      h.beta != null ? `beta ${h.beta.toFixed(2)}` : null,
      h.w52High != null && h.w52Low != null ? `52w ₹${h.w52Low}–₹${h.w52High}` : null,
    ].filter(Boolean);
    return `- ${bits.join(" · ")}`;
  });

  return `PORTFOLIO FACTS (all figures INR)
Total value ₹${Math.round(d.totals.value)} · invested ₹${Math.round(d.totals.invested)} · unrealised ${(d.totals.pnlPct * 100).toFixed(1)}%
Asset allocation: ${d.allocation.map((a) => `${a.label} ${a.pct.toFixed(1)}%`).join(", ") || "n/a"}
Sector mix: ${d.sectors.slice(0, 10).map((s) => `${s.name} ${s.pct.toFixed(1)}%`).join(", ") || "n/a"}
Diversification score (sector-HHI + concentration heuristic): ${d.diversification.score}/100 — ${d.diversification.drag}
Mandate: ${d.mandate ? `horizon ${d.mandate.horizon ?? "n/a"}, risk ${d.mandate.risk ?? "n/a"}, benchmark ${d.mandate.benchmark ?? "n/a"}` : "not supplied"}

HOLDINGS
${lines.join("\n")}`;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("Model did not return JSON");
}

/** Institutional-grade portfolio analysis. Input: enriched holdings. Output: structured JSON for the UI. */
export const analyzePortfolio = createServerFn({ method: "POST" })
  .inputValidator((i: AnalyzePortfolioInput) => i)
  .handler(async ({ data }): Promise<{ ok: boolean; result?: AnalysisResult; error?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "Analysis service is not configured." };
    if (!data.holdings?.length) return { ok: false, error: "No holdings supplied." };

    const holdings = data.holdings.slice(0, 40);
    const prompt = `${factSheet({ ...data, holdings })}\n\n${schemaHint(holdings.map((h) => h.symbol))}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[analyze-portfolio] gateway ${res.status}: ${body.slice(0, 400)}`);
        if (res.status === 429) return { ok: false, error: "Rate limited — try again in a moment." };
        if (res.status === 402) return { ok: false, error: "AI credits exhausted for this workspace." };
        return { ok: false, error: `Analysis failed (${res.status})` };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) return { ok: false, error: "Analysis returned an empty response." };
      const parsed = extractJson(text) as AnalysisResult;
      if (!parsed?.portfolio || !Array.isArray(parsed?.holdings)) {
        return { ok: false, error: "Analysis returned an unexpected shape." };
      }
      return { ok: true, result: parsed };
    } catch (e) {
      console.error("[analyze-portfolio] error", e);
      return { ok: false, error: "Analysis service unreachable." };
    }
  });
