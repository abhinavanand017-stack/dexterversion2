## Scope reality check

You're asking for two large pieces of work:

1. **Port DEXTER** — your uploads are a vanilla HTML/CSS/JS app: 1,356 lines of HTML, 2,716 lines of CSS, 3,687 lines of core JS, 545 lines of add-ons, plus a 668-line Python forecasting engine. Lovable's stack is React 19 + TanStack Start + Tailwind v4 (not vanilla HTML, not Python at runtime).
2. **Live market data** — Angel One SmartAPI (server-side, login + 15s poll) with Finnhub WebSocket as a fallback.

Done properly, this is multi-phase. I won't try to cram it into one turn.

## Proposed phases

### Phase 1 — Foundation & shell (this turn)
- Bring the DEXTER **design system** into `src/styles.css` (palette, fonts, glow tokens, arousal/mode variants).
- Port the **app shell**: neural canvas background, top status bar, tab navigation, ticker tape bar (the thing live data feeds into).
- Stub `State` as a React context / Zustand store.
- Land the dashboard panel with Dexter Score gauge + a couple of cards so the shell isn't empty.
- Other panels (Backtester, Pitch Deck, Market Scanner, Watchlist, Demat Gateway) get route stubs — wired but empty — to be filled in later phases.

### Phase 2 — Live market data backend (this turn, alongside Phase 1)
- Enable **Lovable Cloud** (needed to store secrets server-side).
- Add secrets: `ANGEL_CLIENT_CODE`, `ANGEL_PASSWORD`, `ANGEL_TOTP_SECRET` (TOTP **secret**, not a one-shot code — server generates the 6-digit code on demand via `otplib`), `ANGEL_API_KEY`, plus `FINNHUB_KEY`.
- Server function `getAngelQuotes` (`src/lib/market.functions.ts`):
  - Logs in via `loginByPassword` with freshly-generated TOTP, caches `jwtToken` in memory until expiry.
  - Calls `/market/v1/quote/` for NSE:NIFTY 50 (99926000) and BSE:SENSEX (99919000).
  - Returns `{ symbol, ltp, change, percentChange, ts }[]`.
  - On any error returns `{ ok: false, error }` so the client can fall back.
- Client hook `useLiveTicker`:
  - Polls `getAngelQuotes` every 15s.
  - If Angel returns an error or stale data twice in a row, opens a Finnhub WebSocket (`wss://ws.finnhub.io?token=…`) — token fetched from a tiny server fn `getFinnhubToken` so we don't ship `FINNHUB_KEY` in `VITE_`.
  - Falls back to seeded static prices if both fail.
- Ticker bar component reads from the hook and renders `ltp`, `change`, `%change` with up/down color + flash animation.

### Phase 3+ (separate turns, ask before starting)
- Backtester logic, Pitch Deck overlay, Market Scanner table, Watchlist CRUD, Circuit Breaker overlay + countdown.
- Add-ons: Dexter Score v2 hero, Shadow Portfolio, Portfolio Optimizer.
- Forecasting engine — Python won't run in the Cloudflare Worker runtime. Options: (a) rewrite the core models in TypeScript, (b) host the Python on Modal / Replicate / a separate FastAPI service and call it from a server fn. Decide later.

## Things you need to know / decide

- **Angel TOTP**: the SmartAPI login needs a 6-digit TOTP. To generate it server-side every 15s I need the **base32 TOTP secret** from your Angel profile (Profile → Enable TOTP shows the QR + secret). A one-time `123456` code won't work for a recurring poller.
- **Angel API key** is required in the `X-PrivateKey` header.
- **Finnhub Indian index coverage** on the free tier is limited — `NSE:NIFTY50` / `BSE:SENSEX` may not stream. Treating it strictly as fallback is the right call.
- **Browser CORS**: Angel's API blocks browser calls. All Angel traffic goes through our server function — never client-side.
- **Forecasting engine** stays out of scope until you decide where Python runs.

## Technical details (Phase 1 + 2 deliverables)

```
src/
  styles.css                                # DEXTER tokens + arousal/mode variants
  routes/
    __root.tsx                              # Update head() + neural canvas + status bar + ticker
    index.tsx                               # Redirect to /dashboard
    dashboard.tsx                           # Score hero + cards
    backtester.tsx                          # Stub
    pitch.tsx                               # Stub
    scanner.tsx                             # Stub
    watchlist.tsx                           # Stub
    demat.tsx                               # Stub
  components/
    NeuralCanvas.tsx
    StatusBar.tsx
    TickerBar.tsx                           # ← consumes useLiveTicker
    TabNav.tsx
    ScoreHero.tsx
  hooks/
    useLiveTicker.ts                        # Angel poll + Finnhub WS fallback
    useDexterState.ts                       # Zustand store mirroring window.State
  lib/
    market.functions.ts                     # getAngelQuotes, getFinnhubToken
    market.server.ts                        # Angel session cache + TOTP generation (otplib)
```

Dependencies to add: `zustand`, `otplib`.

## Ask

Reply with:
1. **Confirm Phase 1 + 2 scope** (or trim — e.g. "skip the route stubs, just shell + ticker").
2. **Angel TOTP secret availability** — do you have the base32 secret, or only short-lived codes? If only codes, we make TOTP a user input field instead of automating login.
3. **Approval to enable Lovable Cloud** (required for server secrets).