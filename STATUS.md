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

## ✅ Done & verified (cont.) — theme-conditional navigation + full-width
- **Theme-conditional nav** in the main hub (`poast-client.tsx`):
  - **Glass** → fixed **top-nav** (`GlassTopNav`, `data-tour="glass-nav"`), **no
    sidebar**, content offset `left 0 / top 52`.
  - **Classic / Stock** → **smart sidebar** with hover-**peek** (72px rail expands
    to a 240px floating overlay on hover when docked-collapsed) and a **dock
    chevron** that toggles collapsed; persisted to `localStorage
    "poast-sidebar-collapsed"`. Content offset `left 72|240 / top 0`.
  - `AssetLibraryEmbed` now takes the same `left/top` offset (was hard-coded 240).
- **Full-width content in every theme** — the content wrapper fills to the right
  edge regardless of nav. Verified headless @1920px: classic/stock = sidebar,
  `gap 0`; glass = top-nav, `left 0`, `gap 0`; collapsed dock = `72px`, `gap 0`.
- **Stock full-width bug FIXED** (mockup `~/poast-welcome-3.0/index.html`):
  `.cmain2` was `max-width:1280px` (left-aligned) → dropped the cap, 48px gutter;
  the tool grid now fills the page (6 cols @1920). Committed in the mockup repo.
- **Entry gate is Stock-styled** (signed-out `/`): aurora corner radials + the
  amber→coral→violet "Welcome." gradient headline, two paths (Analyst / Marketing).
- `tsc` + `npm run build` green after the nav work.

## Flow status (per the signed-in/out spec)
- **Signed-out → Stock login (entry gate).** ✅ Done (restyled).
- **Returning user → straight in, to their role+theme home.** ✅ Works via
  `localStorage "poast-current-user"` (UserProvider hydrate) + Neon `user_prefs`
  (server wins on reconcile). Role derived server-side (`lib/roles.ts`).
- **New user → login → intro → selection → walkthrough → welcome.** ◑ Partial:
  `Intro` + `OnboardingHost` (welcome modal + coach-mark tours) exist; a dedicated
  *theme-selection* step is currently in Settings → Appearance, not yet a forced
  first-run gate. Wire it into the first-run chain to fully match the mockup.
- **⚠ Google SSO / cross-device per-user login = NOT wired.** Auth is still the
  custom password gate; identity is the chosen name, persisted locally + Neon by
  `owner`. True "sign in with Google, same everywhere" needs the OAuth provider
  (role map is already SSO-ready — `lib/roles.ts` keys on email). Long-tail.

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
