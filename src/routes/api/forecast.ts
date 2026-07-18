import { createFileRoute } from "@tanstack/react-router";
import { generateMockForecast, type Horizon, type ForecastRequest } from "@/lib/forecast/workbench";

export const Route = createFileRoute("/api/forecast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ForecastRequest;
        const upstream = process.env.FORECAST_API_URL;
        if (upstream) {
          try {
            const res = await fetch(upstream, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (res.ok) return new Response(await res.text(), { status: 200, headers: { "Content-Type": "application/json" } });
          } catch { /* fall through */ }
        }
        const demo = generateMockForecast(body.ticker || "RELIANCE.NS", (body.horizon || "5d") as Horizon, body.models || []);
        demo.demoReason = upstream ? "Upstream forecasting API unreachable — showing deterministic demo data." : "FORECAST_API_URL not configured — showing deterministic demo data.";
        return Response.json(demo);
      },
    },
  },
});
