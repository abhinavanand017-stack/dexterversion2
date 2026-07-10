# Forecaster V2 — Universe + Deep Research + Accuracy

Your pasted spec has 4 large parts. `src/lib/nifty500.ts` already ships **525 unique symbols** across Nifty 50 / Next 50 / Midcap 150 / Smallcap 250 buckets, so Part 1 is largely done and needs only a targeted top-up. The genuinely new work is Parts 2–4. Splitting into 3 turns keeps each turn under 1.5 credits.

## Turn A — Universe top-up + Screener deeplink + Fundamentals snapshot

Files touched: `src/lib/nifty500.ts`, `src/lib/screener.ts` (new), `src/routes/forecast.tsx`, `src/components/AssetCombobox.tsx`.

- Diff pasted spec against existing `NIFTY500`; append only missing symbols (est. 40–80 new). Keep the existing `NiftyStock` shape; add optional `cmp?`, `pe?`, `roce?`, `divYld?`, `marCap?`, `qtrProfitVar?`, `qtrSalesVar?`, `debtEquity?` fields on the seeded rows so Models 18–22 have data.
- New `src/lib/screener.ts` exports `toScreenerUrl(symbol)` and `toYahooSymbol(symbol)` (URL-encodes `&`, `.`).
- Forecast page: add "📊 Deep Research on Screener.in →" button next to the selected symbol (opens `screener.in/company/{SYMBOL}/consolidated/` in new tab), and a compact **Fundamentals Snapshot** card (PE / ROCE / DivYld / Qtr Profit Var / Debt/Equity) sourced from the seed data with graceful "—" when a field is missing.

## Turn B — Deep Research models 18–22

Files: `src/lib/forecast/deepResearch.ts` (new), `src/lib/forecast/models.ts` (register), `src/routes/forecast.tsx` (new "🔬 Deep Research" section in model grid + radar chart).

- Model 18 DCF-Lite: fair value line + margin-of-safety band on the existing chart.
- Model 19 Earnings Momentum: 0–100 gauge, adjusts price target.
- Model 20 Bollinger Mean Reversion: bands overlay + reversion target.
- Model 21 Relative Strength vs bucket index (Nifty 50 / Next 50 / Midcap 150).
- Model 22 Composite Quant Score: pure-SVG hexagonal radar (6 axes), integrates outputs from 18–21 + existing consensus.
- 3 manual override inputs (EPS, 5Y EPS CAGR %, Rev Growth %) that recompute Models 18/22 instantly.

## Turn C — Accuracy & realism layer

Files: `src/routes/forecast.tsx`, `src/lib/forecast/accuracy.ts` (new).

- Remove any synthetic OHLCV fallback in the current forecast path; surface an explicit "⚠️ Could not fetch historical data" state instead of silent seeded data.
- Per-model "±X%" historical-accuracy badge (static table from spec §4.2), colour-coded.
- **Model Consensus** summary card (direction, P10–P90 range, median, agreement strength, plain-language sentence).
- **Market Context** banner using existing VIX + Nifty 200 DMA signals.
- **"How accurate were past forecasts?"** collapsible reading last 5 runs from a new `dx_forecast_history_v1` localStorage key (write on every forecast run).
- Update disclaimer text per spec §technical notes.

## Out of scope (unless you say otherwise)

- Live scraping of Screener.in — spec explicitly forbids it; we deeplink + seed only.
- Peer Comparison panel (§3.3) — cheap add-on, roll into Turn A if you want it.
- Simple-Mode collapse of 18–22 into a single card — roll into Turn B if you want it.

## Technical notes

- Combobox already uses cmdk (virtualised) — no perf change needed at ~600 rows.
- Radar in Turn B stays pure SVG (no new dep), reusing existing neon CSS vars.
- All new localStorage writes wrapped in try/catch.
- Zero changes to sidebar, routing, other pages, dark cyberpunk theme.

Reply **"go A"** (or B / C / all) and I'll start. Say "add peer panel" or "add simple-mode collapse" to fold those into their turn.
