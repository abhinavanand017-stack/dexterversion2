import { createServerFn } from "@tanstack/react-start";

/**
 * Narrative layer for /indices. The LLM NEVER produces numbers — it receives the
 * fetched dataset and writes only the verdict, valuation read, scenario triggers
 * and risk commentary. Cached once per trading day per index.
 */
export interface IndexAnalysisInput {
  indexKey: string;
  indexName: string;
  category: string;
  peerCategory: string;
  price: number;
  pctChange: number;
  pe: number | null;
  pb: number | null;
  dy: number | null;
  peMean5y: number | null;
  peMean10y: number | null;
  peZScore: number | null;
  peerMedianPe: number | null;
  fairLow: number | null;
  fairBase: number | null;
  fairHigh: number | null;
  returns: { label: string; pct: number | null }[];
  vol1y: number | null;
  maxDrawdownPct: number | null;
  above200dmaPct: number | null;
  advances: number | null;
  declines: number | null;
  scenarioTargets: { bull: number; base: number; bear: number; probBull: number; probBase: number; probBear: number } | null;
  peers: { name: string; ret1y: number | null; pe: number | null; vol: number | null; corr: number | null }[];
}

export type Level = "Low" | "Medium" | "High";

export interface RiskCell { category: string; likelihood: Level; impact: Level; note: string }

export interface IndexAnalysis {
  verdict: string;
  valuationRead: string;
  triggers: { bull: string; base: string; bear: string };
  risks: RiskCell[];
  killerRisk: { risk: string; mitigant: string };
  relativeStrength: string;
}

const RISK_CATEGORIES = [
  "Regulatory & Policy",
  "Concentration",
  "Macro & Rate Sensitivity",
  "Valuation",
  "Liquidity & Breadth",
  "Global Correlation & Contagion",
];

const cache = new Map<string, { day: string; data: IndexAnalysis }>();
const today = () => new Date().toISOString().slice(0, 10);

const fmt = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "n/a" : v.toFixed(d));

export const analyzeIndex = createServerFn({ method: "POST" })
  .inputValidator((i: IndexAnalysisInput) => i)
  .handler(async ({ data }): Promise<{ ok: boolean; analysis: IndexAnalysis | null; cached?: boolean; error?: string }> => {
    const hit = cache.get(data.indexKey);
    if (hit && hit.day === today()) return { ok: true, analysis: hit.data, cached: true };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, analysis: null, error: "AI is not configured" };

    const facts = `INDEX: ${data.indexName} (${data.category}, global peer bucket: ${data.peerCategory})
Level: ${fmt(data.price)} (${fmt(data.pctChange)}% today)
Valuation: P/E ${fmt(data.pe)}, P/B ${fmt(data.pb)}, Div yield ${fmt(data.dy)}%
Own-history P/E band (price-implied approximation): 5y mean ${fmt(data.peMean5y)}, 10y mean ${fmt(data.peMean10y)}, current z-score ${fmt(data.peZScore)}
Global peer median P/E: ${fmt(data.peerMedianPe)}
Fair-value index range from the band: ${fmt(data.fairLow, 0)} – ${fmt(data.fairBase, 0)} – ${fmt(data.fairHigh, 0)}
Returns: ${data.returns.map((r) => `${r.label} ${fmt(r.pct)}%`).join(", ")}
Annualized 1Y volatility: ${fmt(data.vol1y)}%; max drawdown in window: ${fmt(data.maxDrawdownPct)}%
Level vs 200-DMA: ${fmt(data.above200dmaPct)}%; breadth advances/declines: ${data.advances ?? "n/a"}/${data.declines ?? "n/a"}
12-month scenarios (computed, do not restate different numbers): bull ${fmt(data.scenarioTargets?.bull ?? null, 0)} (${fmt(data.scenarioTargets?.probBull ?? null, 1)}%), base ${fmt(data.scenarioTargets?.base ?? null, 0)} (${fmt(data.scenarioTargets?.probBase ?? null, 1)}%), bear ${fmt(data.scenarioTargets?.bear ?? null, 0)} (${fmt(data.scenarioTargets?.probBear ?? null, 1)}%)
Global peers: ${data.peers.map((p) => `${p.name}: 1Y ${fmt(p.ret1y)}%, P/E ${fmt(p.pe)}, vol ${fmt(p.vol)}%, corr ${fmt(p.corr)}`).join(" | ") || "none available"}`;

    const prompt = `You are Dexter, an institutional equity strategist covering Indian markets.
Write the NARRATIVE ONLY for the index below. You must not invent, recompute or restate any figure that is not in the data block; refer to levels qualitatively or quote the given numbers verbatim.

${facts}

Return STRICT JSON with this exact shape and nothing else:
{
  "verdict": "one sentence, answer first, no hedging, e.g. 'NIFTY BANK: fairly valued vs its own 10-year average, expensive vs global banking peers, momentum turning positive.'",
  "valuationRead": "2-3 sentences triangulating own-history vs peer multiples. State clearly cheap / fair / expensive.",
  "triggers": { "bull": "one-line trigger", "base": "one-line trigger", "bear": "one-line trigger" },
  "risks": [ { "category": "<one of: ${RISK_CATEGORIES.join(" | ")}>", "likelihood": "Low|Medium|High", "impact": "Low|Medium|High", "note": "max 14 words, India-specific" } ],
  "killerRisk": { "risk": "the single risk that matters most, named plainly", "mitigant": "one concrete mitigant" },
  "relativeStrength": "one sentence: which index in the peer group is actually outperforming and roughly by how much, using only the given numbers."
}
"risks" must contain exactly 6 entries, one per category listed above, in that order. No markdown fences.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "raw-fetch" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const msg = res.status === 429
          ? "AI rate limit reached — try again shortly."
          : res.status === 402
            ? "AI credits exhausted for this workspace."
            : `AI request failed (${res.status}). ${t.slice(0, 120)}`;
        return { ok: false, analysis: null, error: msg };
      }
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned) as IndexAnalysis;
      if (!parsed.verdict || !Array.isArray(parsed.risks)) throw new Error("malformed analysis");
      cache.set(data.indexKey, { day: today(), data: parsed });
      return { ok: true, analysis: parsed };
    } catch (e) {
      return { ok: false, analysis: null, error: e instanceof Error ? e.message : "analysis failed" };
    }
  });
