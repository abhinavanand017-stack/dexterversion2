# DEXTER v3 — Three Major Upgrades

This is a large build. Before I start coding, here's exactly what I'll ship and what I'll trim, so you can confirm scope.

## Scope confirmation needed

The spec is ~600 lines and the honest, no-BS picture is:

- **17 models in pure JS, client-side** — fully doable for the 9 statistical/ML ones (ARIMA, SARIMA, ETS, Linear, Ridge, RF-stump, GBM-stump, SVR-kernel, KNN, Prophet-decomp, Ensemble, Monte Carlo).
- **LSTM/GRU/Transformer/CNN/WaveNet "trained" in browser** — I will implement the math and a forward pass, but in-browser gradient descent on randomly initialized weights against 2y of daily data will produce mostly noise. I'll do what the spec says (Xavier init + a few GD steps) and **label them clearly as "Lightweight JS approximation — illustrative, not trained"**. They will not be meaningfully predictive. If you want real DL forecasts we need a server.
- **Yahoo Finance from the browser** — `query1.finance.yahoo.com` blocks CORS. I'll route through the existing `yahoo.functions.ts` server function (already in the repo) instead of `allorigins.win`, which is unreliable.
- **Sequential model run with live progress** — yes, using `requestIdleCallback`/`setTimeout` between models so the UI stays responsive.

If any of the above is a dealbreaker, tell me now.

## What I'll build

### 1. `/forecast` — 17-model Forecasting Engine
- New route `src/routes/forecast.tsx` + add to `AppSidebar` and mobile bottom nav.
- `src/lib/forecast/` module:
  - `features.ts` — SMA/EMA/MACD/RSI/BB/ATR/returns + MinMax scaler
  - `models/` — one file per model (17 files), each exporting `{ name, category, run(series, horizon) → { forecast[], rmse, signal, confidence, extra } }`
  - `consensus.ts` — weighted score → STRONG BUY/BUY/HOLD/SELL/STRONG SELL
  - `runner.ts` — sequential executor that yields after each model
- UI: search bar, stock/MF toggle, horizon selector, hero consensus card, 17-model grid, tabbed charts (Recharts), nuances + risk flags, disclaimer.
- Data source: stocks via existing `getYahooChart` server fn (extend to accept range/interval); MFs via `https://api.mfapi.in/mf/{code}` (CORS-OK).

### 2. `/funds` — Enhanced Mutual Fund Screener (rebuild)
- Fetch full scheme list from `api.mfapi.in/mf` once, cache in memory + `localStorage` for 24h.
- Compute CAGR 1Y/3Y/5Y, vol, max DD, Sharpe, Sortino, Calmar, star rating on demand (lazy per fund).
- Left sidebar filters (category, returns, stars, risk, Sharpe, AUM, expense). AUM/expense/category come from a static `funds-meta.json` for top ~200 funds; rest fall back to "—".
- Sortable results table, slide-in detail panel with NAV chart + lightweight Dexter signal (ETS + Ridge + KNN).
- Compare tray (max 3), 3 highlight cards on top, Value Research / ET Money / Morningstar deep links.

### 3. `/news` — Live Market News (rebuild)
- Try GNews → NewsData.io → placeholder fallback.
- API key stored in `localStorage` (`dexter_news_api_key` + provider), entered in `/settings` "Data Connections" section with show/hide + test button.
- Sentiment from keyword list, category tag from regex.
- Marquee ticker, category tabs, search filter, 3-col grid, 5-min auto-refresh with countdown, MoneyControl attribution footer.

### 4. `/settings` additions
- "Data Connections" card: News provider dropdown + key input + test + Forecaster info accordion.

### 5. Design tokens
- Extend `src/styles.css` with the BUY/HOLD/SELL/STRONG badges and `--accent-cyan/green/amber/red` mapped to the hex values in the spec, so all three pages share them.

## Non-goals / trims
- No backtesting harness — RMSE is computed on a 20% holdout as specified, nothing more.
- No persistent history of past forecasts.
- Existing pages (Overview, Optimizer, Biometrics, Shadow, Score, ticker) are untouched.

## Technical notes
- File layout follows TanStack file-based routing already in place.
- Heavy math files are pure functions, no React — easy to unit-test later.
- Each model file is <200 LOC; total new code ~4–5k LOC. Expect this to land across many parallel file writes.

## Confirm before I build
1. **OK with the DL models being labeled "illustrative approximation"?** (Real training needs a backend.)
2. **OK to route Yahoo through the existing server function** instead of `allorigins.win`?
3. **Static AUM/expense JSON for top ~200 funds is acceptable** (MFAPI doesn't expose AUM)?

Reply "go" (or with adjustments) and I'll ship it.
