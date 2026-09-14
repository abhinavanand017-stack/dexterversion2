# Quant-Desk Forecast Workbench Upgrade

## Scope

Upgrade only `/forecast` and forecast-specific computation/data helpers. Keep the current asset search, comparison flow, dark terminal/glass styling, navigation, other routes, existing providers, and SEBI disclaimer. Use the installed Recharts package; add no npm packages, backend services, API keys, or fabricated data.

## Build

### 1. Real three-layer ensemble
- Preserve the selectable 12-factor technical engine and expose its normalized score, signal, target path, and per-factor contribution.
- Add a 500–1000 path Monte Carlo statistical layer using fetched OHLCV returns and volatility, producing median, 68%, and 95% quantile paths.
- Add a valuation layer only when enough real fundamentals exist. Compare current P/E or P/B with the asset's available history/reference data and a computed sector median from the bundled/live universe; otherwise disable it with a clear reason.
- Combine only available layers. Start available layers equally weighted until enough resolved records exist, then derive weights from smoothed per-layer hit rates for the ticker, falling back to sector history and then equal weights. Display weight source and current percentages beside the ensemble result.
- Ensure Bull/Base/Bear probabilities come from Monte Carlo terminal-path counts and sum to exactly 100 after rounding.

### 2. Catalyst-aware forecast
- Extend the existing Yahoo and RSS-backed forecast data flow only: use Yahoo calendar/corporate-action fields when returned, plus future-dated events that can be explicitly identified from existing news text.
- Normalize catalysts into earnings, ex-dividend, corporate action, and index rebalance records. Never infer a date, direction, or magnitude that is not supported by source data.
- Estimate magnitude from matching historical event moves when those events and prices exist; otherwise use an actually computable sector sample; otherwise show `Magnitude unknown`.
- Rank by estimated absolute impact, with dated unknown-impact events below measured events. Mark the highest-impact catalyst in the headline.
- Widen both confidence bands progressively before a measured high-impact event and label the widening on the chart. Quiet periods retain the normal volatility cone.

### 3. Native visual analysis
- Replace the current single-band projection with a Recharts fan chart anchored at the latest fetched price, showing median, 68%, and 95% bands plus catalyst markers.
- Add a 12-axis radar chart using the real factor scores while keeping the detailed collapsible model selection/contribution panel.
- Add a compact scenario bridge for Bear, Base, and Bull targets, with each move decomposed into the available technical, statistical, valuation, and catalyst contributions.
- Add mini sparklines beside Technical, Statistical, and Valuation weights using each layer's computed path/history. Disabled layers show the reason instead of a chart.

### 4. Track record and automatic resolution
- Add a forecast-specific browser storage module, reusing the app's existing local-history approach and requiring no auth or new tables.
- Log one deduplicated record per ticker, horizon, model selection, and generated forecast: timestamp, maturity date, starting price, each available layer call/target, ensemble call/target, and weight source.
- On future page loads, resolve matured records against fetched historical closes on or immediately after the maturity trading date. Record directional correctness and target error for each layer and the ensemble.
- Require a minimum resolved sample before displaying or using hit rates; until then show `Track record building — check back after your first resolved forecasts` and equal-weight available layers.
- Surface overall and per-layer hit rate, sample size, and recent resolved rows in the Track Record tab. Never display baseline or invented accuracy percentages.

### 5. Robustness score and failure states
- Compute a 0–100 robustness score from factor agreement, required-data completeness, fetched-data freshness, and volatility-regime stability, with a clickable breakdown.
- Detect a regime shift by comparing current trailing volatility with the distribution of rolling volatility over the prior 90 sessions; when above two standard deviations, reduce robustness and widen the cone.
- Increase historical data requests where needed. If fewer than 90 valid sessions are available, disable unsupported layers explicitly rather than silently assigning zero.
- Preserve the last successful cached dataset without expiring it away. If a live refresh fails, continue with that data and show `Showing last available data as of …`; if no real data has ever loaded, show an honest error state and no forecast.

### 6. Tabs below the chart
- Add `Forecast | Scenarios | Catalysts | Confidence | Track Record` directly below the upgraded chart.
- Forecast: ensemble summary, visible dynamic weights/sparklines, radar, and existing model controls.
- Scenarios: probability cards and scenario bridge.
- Catalysts: ranked events with source, date, bias, magnitude provenance, and unavailable states.
- Confidence: robustness score and its four-part calculation, regime status, and formula disclosure.
- Track Record: building state or resolved performance based only on logged forecasts.
- Keep Fundamentals available within the Forecast content and preserve compare mode without changing the surrounding layout.

## Technical details

- Extend `src/lib/forecast/engine12.ts` for stable technical outputs and remove unsafe assumptions on missing arrays.
- Add focused pure modules under `src/lib/forecast/` for ensemble/Monte Carlo, catalysts, confidence, and track-record persistence/resolution.
- Extend `src/lib/yahoo.functions.ts` only for calendar/corporate-action data available from Yahoo's existing unauthenticated feed; preserve current server-side request boundaries and failure handling.
- Reuse `src/lib/news.functions.ts` without its demo fallback for forecast catalysts: forecast calculations accept only successfully fetched, source-linked items.
- Update `src/routes/forecast.tsx` only for orchestration and the requested charts/tabs; no changes to other routes or global navigation.

## Verification

- Check stock, index, and ETF forecasts with real history; verify unavailable valuation/catalyst states where data is absent.
- Verify 68%/95% bands, catalyst widening, radar, bridge, component sparklines, and mobile tab behavior.
- Verify scenario probabilities total 100 and every displayed metric has source/formula text.
- Simulate stale-cache and insufficient-history cases and confirm there is no blank screen or mock fallback.
- Verify track-record deduplication, maturity-date resolution, minimum-sample gating, and automatic weight changes using controlled local test records.
