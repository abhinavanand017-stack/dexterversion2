import { createServerFn } from "@tanstack/react-start";

export interface InsightInput {
  symbol: string;
  name: string;
  currentPrice: number;
  horizon: string;
  compositeScore: number;
  signal: string;
  confidence: number;
  buyCount: number;
  factorLines: string[]; // "MA Alignment: Full bull …"
  targetPrice: number;
  upsidePct: number;
  s1: number;
  r1: number;
  atrPct: number;
  arousal?: number | null;
  circuitBreaker?: boolean;
}

export const generateDexterInsight = createServerFn({ method: "POST" })
  .inputValidator((i: InsightInput) => i)
  .handler(async ({ data }): Promise<{ ok: boolean; text: string; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, text: "", error: "LOVABLE_API_KEY not configured" };

    const prompt = `You are Dexter, a bio-algorithmic trading AI for Indian markets (NSE/BSE). Give a concise expert analysis.

Asset: ${data.name} (${data.symbol})
Current Price: ₹${data.currentPrice.toFixed(2)}
Forecast Horizon: ${data.horizon}

12-Factor Signal Summary:
- Composite Score: ${data.compositeScore.toFixed(3)} → ${data.signal}
- Confidence: ${data.confidence.toFixed(1)}%
- Factors agreeing Buy: ${data.buyCount}/12
${data.factorLines.map((l) => `- ${l}`).join("\n")}

Price Targets:
- Base: ₹${data.targetPrice.toFixed(2)} (${data.upsidePct.toFixed(2)}% in ${data.horizon})
- Support S1: ₹${data.s1.toFixed(2)}, Resistance R1: ₹${data.r1.toFixed(2)}
- ATR: ${data.atrPct.toFixed(2)}% (volatility)

User Biometric Context:
- Arousal: ${data.arousal ?? 0.4} (0=calm, 1=stressed)
- Circuit breaker: ${data.circuitBreaker ? "ACTIVE" : "inactive"}

Write exactly 3 short paragraphs:
1. Technical picture (2-3 sentences, specific to this stock).
2. Key risks as bullet points (max 3, Indian-market specific).
3. Personalized recommendation based on biometric state.

Rules: under 160 words. Speak directly ("you", "your portfolio"). Reference specific ₹ levels (S1, R1). No generic disclaimers. End with one actionable sentence.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "raw-fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return { ok: false, text: "", error: `AI ${res.status}: ${t.slice(0, 120)}` };
      }
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { ok: text.length > 0, text };
    } catch (e) {
      return { ok: false, text: "", error: e instanceof Error ? e.message : "unknown" };
    }
  });
