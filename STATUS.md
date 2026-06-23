# Overnight status — theme foundation + guided tour (branch `theme-foundation`)

_Branch only. Nothing pushed, no Vercel deploy (per your "keep local"). Each phase committed._

## ✅ Done & verified
- **Theme system** Classic · Stock · Glass — token contract (`tokens.css`), `D`
  bridge (surfaces → CSS vars; accents/text stay hex), 6 surface concat sites →
  `color-mix`. **Classic is byte-identical to before** (zero regression).
- **ThemeProvider + anti-flash** pre-hydration script in `layout.tsx`.
- **Persistence**: localStorage + Neon `user_prefs` (migration applied & round-tripped).
- **Roles** (`lib/roles.ts`): akash=admin; daksh/michelle/vansh=marketing; rest analyst.
- **Settings modal** (gear in MarketingSUITE top bar): theme switch + Stock backdrop
  + "Replay tour", wired to the provider.
- **Interactive guided tour** (`components/tour.tsx`): first-run, skip, persist, relaunch.
- **Build**: `npm run build` green (106/106). `tsc --noEmit` clean.
- **Verified** (dev server + headless Chrome): 8/8 settings+tour checks; theming holds
  across Today/Calendar/Board/Analytics in classic & glass; no page errors.

Mockup (`~/poast-welcome-3.0`, separate git repo) is also finalized: **no guest /
Google required**, **email→role map**, and the **theme-aware tour engine**
(`shared/tour.js`) on the Stock + Glass homes. Verified 10/10 (roles) + 12/12 (tour).

## ▶ Next (not started — deliberately deferred to avoid a risky overnight rewrite)
**B7 — new smart sidebar + Stock welcome screen in MarketingSUITE.**
These are net-new navigation surfaces; the design source of truth is the mockup:
- Smart sidebar: `~/poast-welcome-3.0/index.html` (`#srail` peek→expand→dock +
  category flyouts + dock persistence). Port as a React component; the suite's
  current left rail is *view* nav (Today/Schedule/…) — decide whether the smart
  sidebar replaces it or sits above it as POAST-level nav.
- Stock welcome screen: the `.chero` "Welcome back, {name}" hero — add as the
  suite's entry state.
Both should be themed via the existing tokens. Tour steps already reference a rail;
update selectors if the rail changes.

Other long-tail (see THEMING.md): local-`D` files, full glass blur, animated bg
layers, Google SSO.

## How to test
1. `npm run dev` → open `/marketing-suite`.
2. Click the **gear** (top bar) → Settings → switch Classic/Stock/Glass; pick a Stock
   backdrop. Reload — your choice persists. (Stored in Neon per `poast-current-user`.)
3. First visit auto-runs the tour; replay it from Settings → "Replay the guided tour".
4. Role check: `curl 'localhost:3000/api/prefs?owner=Akash'` → `role:"admin"`;
   `?owner=Vansh` → `marketing`; `?owner=Someone` → `analyst`.

## ⚠ Manual TODO (can't do autonomously)
Rotate the previously-exposed Google OAuth client secret + Neon/Supabase creds in
their consoles. `.env*` and `scripts/_*` stay gitignored.
