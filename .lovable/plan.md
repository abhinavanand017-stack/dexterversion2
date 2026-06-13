## Dexter Dashboard — 12-Fix Overhaul

This is a large, multi-phase rebuild. I'll execute in the master sequence you specified, batching closely-related fixes into phases so each commit leaves the app in a working state.

### Current state recap
- Root `/` redirects to `/dashboard` (so the "blank root" is really the dashboard being sparse — I'll confirm and either kill the redirect or enrich the dashboard).
- Live ticker uses Angel One server fn + Finnhub WS fallback. You're now asking for a **browser-side Yahoo Finance** feed as the primary — I'll add it and keep Angel as a secondary server-side source.
- Tabs are a top nav. You want a **left sidebar** with a Pitch Tour.
- No demo mode, no error-status component, no lambda context, no shadow-portfolio story, no score breakdown, no biometric source selector.

### Phase A — P0 (Fixes 1, 7, 9)
**A1. Root + badge (Fix 1)**
- Remove `/` → `/dashboard` redirect; mount the dashboard directly at `/` (keep `/dashboard` as alias).
- Hide Lovable badge via `publish_settings--set_badge_visibility` (requires Pro — I'll attempt and report back if it fails).
- Add `v1.0 Beta` footer tag.

**A2. Error handling + DataStatus (Fix 7)**
- New `src/lib/safeFetch.ts` with 5s timeout + fallback pattern.
- New `src/components/DataStatus.tsx` in the bottom status bar with green/amber/grey states tracked via a `useDataHealth` zustand slice.
- New `src/components/Skeleton.tsx` with shimmer keyframe (added to `styles.css`); 3s max then fallback.
- Wrap funds + news + market fetches.

**A3. Demo Mode (Fix 9)**
- Extend `useDexterState` with `demoMode` (default `true`, persisted to localStorage), `demoEvent` log, and a 120s scripted sequence (arousal 0.28→0.58→0.82→0.35, circuit breaker auto-fire at T+45s, score pulse 71–76, lambda 3.2→7.8→3.2).
- New `DemoBanner.tsx` (amber, above StatusBar) with toggle.
- New `DemoPill.tsx` next to logo.
- New `EventToast.tsx` for the "Nifty drops 1.8%" + "Elevated stress" notifications.
- New `CircuitBreakerOverlay.tsx` (used by both demo + manual triggers).

### Phase B — P1 (Fixes 2, 11, 8)
**B1. Live market data (Fix 2)**
- New `src/hooks/useMarketData.ts` polling Yahoo `^NSEI`, `^BSESN`, `^INDIAVIX` every 30s with `safeFetch` + IN number formatting + flash animation.
- Wire into `TickerBar` (replacing/augmenting current Angel feed for the headline indices). Keep Angel server-fn alive but secondary.
- "Last updated HH:MM:SS IST" line under ticker.

**B2. Market hours (Fix 11)**
- New `src/hooks/useMarketStatus.ts` with NSE hours + 2025–2026 holiday list.
- Pause Yahoo polling when closed; show countdown to next open.
- Surface status in `DataStatus`.

**B3. Lambda slider wired everywhere (Fix 8)**
- Add `lambda` to `useDexterState` already exists — add `setLambda`, label derivation, and demo-mode auto-animation.
- New `src/components/LambdaSlider.tsx` with tooltip + dynamic label.
- New `src/components/EfficientFrontier.tsx` (Recharts) with interpolated dot, metrics readout, allocation bars.
- Wire to Dashboard.

### Phase C — Sidebar nav (Fix 10)
- Replace `TabNav` (top) with a collapsible left `AppSidebar` using shadcn Sidebar (64px ↔ 220px).
- Routes: Overview (`/`), Portfolio Optimizer (`/optimizer`), Biometrics Lab (`/biometrics`), Market News (`/news`), Fund Screener (`/funds`), Shadow Portfolio (`/shadow`), Dexter Score (`/score`), Settings (`/settings`).
- "Guided Pitch Tour" button → 5s/section auto-nav with progress bar + Exit Tour button.
- Mobile (<768px): bottom tab bar with Overview/Portfolio/Biometrics/News/Score.
- 200ms fade transition on route changes.
- Keep existing `/scanner`, `/watchlist`, `/backtester`, `/demat`, `/pitch` reachable from Settings or remove from primary nav.

### Phase D — Story panels (Fixes 5, 6)
**D1. Shadow Portfolio (Fix 5)** — new `/shadow` route with Recharts ComposedChart (algo solid blue / user dashed red / optional green "what-if"), override event markers + tooltips, 3-col summary bar, 1.5s draw animation.

**D2. Dexter Score breakdown (Fix 6)** — extend `ScoreHero` with expandable breakdown (3 progress bars: Risk-Adjusted 28/35, Override Discipline 24/35, Behavioral 22/30), percentile bar, color-coded ring tiers, weekly trend arrow.

### Phase E — Mobile + Biometrics (Fixes 3, 4)
**E1. Mobile responsiveness (Fix 3)** — sweep cards/grids/charts/overlay; bottom tab bar already from Phase C.

**E2. Biometric source selector (Fix 4)** — new `BiometricSource.tsx` dropdown (Demo / Manual / Apple Health / Garmin / Whoop with "coming soon" toasts). Manual mode reveals 4 sliders (HRV, HR, Sleep, Stress) that drive arousal/lambda live. Provenance label under each reading.

### Phase F — Branding + final polish (Fixes 12 + master)
- Update root `head()` (title, description, OG, theme-color, og:image once generated).
- Generate favicon "D" lettermark in `#378ADD` on dark (one image via imagegen → drop into `/public`).
- Footer (left/center/right + "Powered by" strip).
- Dynamic browser tab title per active section (`useDocumentTitle`).
- Final polish pass: unified card class, animated gradient background, 0.4s number transitions, "Engine Active" pulse, fixed bottom status bar (36px), `formatINR` utility for lakh/crore.

### Technical notes (for the technical-minded)
- Yahoo Finance CORS sometimes blocks browser fetches. If it fails in production, I'll proxy via a thin TanStack server fn (`getYahooQuote`) — `safeFetch` falls back to demo data either way so the UI never breaks.
- Recharts is already in shadcn-land; I'll add it via `bun add recharts` if not present.
- All new client state (demoMode, lambda, biometric source, sidebar open) lives in the existing zustand `useDexterState` to avoid React context boilerplate.
- Lovable badge hiding requires a Pro plan; if your workspace isn't on Pro, that single sub-item will be skipped with a note and I'll still add the `v1.0 Beta` footer.

### What I will NOT do unprompted
- Touch Supabase schemas or add auth.
- Wire real wearable SDKs (Apple Health/Garmin/Whoop) — they remain "coming soon" toasts per your spec.
- Rip out the existing `/scanner`, `/backtester`, etc. routes — they'll live under Settings or stay as-is.

### Delivery order
I'll ship Phase A → F sequentially in this thread. Each phase ends with a build verification before moving on. Roughly 6 message turns of implementation, batched heavily in parallel.

Reply **approve** to start with Phase A, or tell me to skip/reorder anything.