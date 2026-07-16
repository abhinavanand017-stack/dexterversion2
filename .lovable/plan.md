## Investment Masterclass 2.0 — Rebuild Plan

Rebuild `/investment-masterclass` content only. Keep sidebar, ticker, footer, hero shell.

### Scope decisions (to confirm before I build)

1. **Backend**: You asked for Supabase tables + RLS + seed migration. That's a lot of migration surface for content that never changes per-user (investors, books, playbooks are static). I recommend:
   - **Static TS data** for `investors`, `books`, `playbooks` (shipped in `src/lib/masterclass/*.ts`) — instant load, no fetch, no RLS, easy to extend.
   - **Supabase tables only for user state**: `user_reading_list`, `user_checklist_progress`, `user_style_matches` (RLS by `auth.uid()`).
   - If you want everything in Supabase anyway, say so and I'll do all 6 tables.

2. **Auth**: User-state tables require login. The app currently has no auth surface I've wired for this page. Options:
   - **A**: Persist user state in `localStorage` only (no login needed, works today).
   - **B**: Add Supabase tables + require sign-in for reading list / checklist / quiz result save.
   - Recommend **A** for v1 (fast, no auth friction on an education page), migrate to B later.

### File plan

**New data (static seed):**
- `src/lib/masterclass/investors.ts` — 50 investors (30 global + 20 India) with all fields from §2
- `src/lib/masterclass/books.ts` — 25 core + 5 India shelf
- `src/lib/masterclass/playbooks.ts` — 8 frameworks with `interactive_config`
- `src/lib/masterclass/quotes.ts` — ~20 rotating hero quotes
- `src/lib/masterclass/types.ts`

**New components (under `src/components/masterclass/`):**
- `MasterclassPage.tsx` — top-level tabs (Legends / Reading Room / Playbooks / Style Matcher / Compare) + hero
- `LegendsTab.tsx` — filter bar (category chips, search, era slider), card grid
- `InvestorDetail.tsx` — full detail panel (philosophy, blueprint donut, framework, case study, quote, recommended books)
- `ReadingRoom.tsx` — book grid, tag filter, India shelf row, reading-list toggle
- `PlaybooksTab.tsx` — 8 interactive playbook cards (moat checklist, margin-of-safety calc, QGLP scorecard, SMILE, Kelly sizing, cycle gauge, compounder score, behavioral checklist)
- `StyleMatcher.tsx` — 6-question quiz + results screen with recommendations
- `CompareTab.tsx` — multi-select up to 3, side-by-side table
- `CompoundingSandbox.tsx` — shared, Recharts line chart with sliders
- `InvestorChecklist.tsx` — shared, tappable, persists to localStorage

**Route:**
- Rewrite `src/routes/investment-masterclass.tsx` to render new `MasterclassPage`
- Optional child route `/investment-masterclass/legends/$slug` for deep-links (or use in-page panel — recommend in-page for speed)

**Replace/deprecate:**
- Replace `src/components/InvestmentMasterclass.tsx` with a re-export of the new page (or delete and update the route import)

### Roster & seed content

I'll seed all 50 investors and 30 books exactly as you listed, with:
- Bios / principles / anti-patterns written from general public knowledge
- Every stat labeled "approx. / historical, educational only"
- Quotes marked `verified: false` unless well-documented — never fabricated attribution
- Placeholder avatars = gradient monogram (initials on teal/navy gradient), no scraped photos

### Design

Reuse existing dark-navy glass card + teal accent classes from `/heatmap` and `/screener`. Recharts for donuts + compounding chart, matching Optimizer's palette. Mobile: tab chip scroller + 1-col grid + full-screen detail sheet.

### Out of scope (unless you say otherwise)

- Wiring quiz result into Signal Engine tone personalization (mentioned as "later")
- Deep-link routes per investor (in-page panel instead — say the word and I'll add them)
- Book cover images (gradient monograms instead of external image fetches)

### Please confirm

**Q1**: Static TS data + localStorage user state (option A), or full Supabase tables (option B)?
**Q2**: In-page investor detail panel, or dedicated `/legends/$slug` routes?

Once you confirm, I'll ship it in one pass.
