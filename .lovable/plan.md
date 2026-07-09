# Dexter V2 — Phased Build Plan

This is a large spec (~3 parts, ~2000 lines of new code). I'll ship it in phases so the app stays working between turns. Each phase is a separate turn.

## Phase 1 — Foundation & Portfolio Analyser Core (this turn)
- Install `xlsx` (SheetJS) via `bun add xlsx`.
- Create `src/lib/portfolioAnalyser/` module: types, XIRR (Newton-Raphson), CAGR, GBM Monte Carlo, Holt-Winters, AR(1), Sharpe, portfolio metrics helpers.
- Create `src/routes/portfolio-analyser.tsx` with:
  - Tab A: Excel/CSV upload (drag-drop, SheetJS parse, validation, template download)
  - Tab B: Manual entry table (reusing existing `AssetCombobox` and fund combobox)
  - "Import from My Portfolio" (reads `dx_holdings_v2` localStorage)
  - Save/Load to `portfolioAnalyser_v1` localStorage
  - Multi-step progress indicator
- Add nav entry between "Portfolio" and "SIP" in `AppSidebar`.
- Sections A + B of the report: Portfolio Snapshot (value, P&L, XIRR, Sharpe, allocation donut, sector bar) + Individual Holdings Table.

## Phase 2 — Forecast, Risk, and AI Insights (next turn)
- Section C: Portfolio Monte Carlo forecast with confidence cones (Recharts AreaChart), horizon toggles, per-holding forecast summary.
- Section D: Risk Analysis — beta vs Nifty 50, max drawdown, correlation heatmap (SVG grid), concentration flags, volatility/return scatter.
- Section E: AI Insights via new `src/lib/ai-insights.functions.ts` server function using Lovable AI Gateway + `google/gemini-2.5-flash`, streamed into a neon card.
- Wire `/forecast?symbol=X&type=stock&horizon=long` deeplink handling in existing forecast route.

## Phase 3 — SIP, Tax, Exports + Forecaster Expansion (following turn)
- Section F: SIP Impact Simulator with slider.
- Section G: Tax Estimation (STCG 20% / LTCG 12.5% >₹1.25L, ELSS lock-in, tax-loss harvesting).
- Section H: Print-PDF, XLSX export, shareable URL.
- Extend `src/lib/nifty500.ts` bucket type + add Next 50 (50 tickers), Midcap 100 (~75 new tickers not already present), Smallcap 250 (~200 tickers) as new bucket groups; wire into Forecaster combobox as collapsible groups.

## Phase 4 — Python Backend Bridge & Model Info (final turn)
- Add "API Mode" toggle + backend URL input to Forecaster settings (persisted to localStorage).
- Client-side POST to `{backend_url}/forecast` when toggled on; overlay real model output alongside browser approximations, labelled.
- Add ⓘ info panel with 17 model descriptions next to each model toggle.

## Technical notes
- All heavy math runs client-side (no server compute cost) except the AI Insights call.
- AI Insights: single non-streaming `generateText` call via `createLovableAiGatewayProvider` in a `createServerFn`, `google/gemini-2.5-flash`, max ~800 tokens. Uses aggregated portfolio summary only (no PII).
- Historical price data reused from existing `yahoo.functions.ts` / `quotes.functions.ts` — no new data providers.
- Preserves dark cyberpunk theme (existing `dx-*` classes, neon cyan/green).
- Mobile-responsive with existing Tailwind breakpoints.
- Excel template + export use SheetJS's `XLSX.utils.book_new` + `XLSX.writeFile`.

## What's explicitly out of scope
- No changes to existing 17-model forecaster UI beyond adding the API toggle + info tooltips.
- No new Supabase tables — portfolios stay in localStorage per spec.
- Smallcap 250 will ship with the ~45 named seed tickers + a curated subset to reach ~200 (full 250 NSE list requires manual data entry; can extend later).

Confirm to proceed with Phase 1.