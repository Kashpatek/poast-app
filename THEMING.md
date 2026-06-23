# POAST theming — Classic · Stock · Glass

A per-user theme system. Three themes, selected in **Settings** (gear in the
MarketingSUITE top bar), persisted to localStorage + Neon, and applied before
first paint (no flash).

## How it works

1. **Token contract — `src/app/tokens.css`**
   CSS variables for **surface** tokens (`--bg --card --surface --hover --border`),
   composites (`--glow --glow-hover --card-grad --surf-grad`), and a full-screen
   `--app-backdrop`, scoped per theme via `[data-theme="classic|stock|glass"]` on
   `<html>`. Background variants use `[data-bg="aurora|cockpit|iridescent"]`.
   - **classic** = byte-identical to the previous hardcoded palette → zero regression.
   - **stock** = same dark surfaces, translucent enough to reveal an aurora backdrop.
   - **glass** = translucent surfaces + tinted backdrop; opt-in blur via `.lg`/`[data-glass]`.

2. **The bridge — `src/app/shared-constants.ts`**
   `D.bg/card/surface/hover/border` and the composites read `var(--…)`. **Brand
   accents** (`amber/blue/teal/coral/violet/cyan/crimson`) and **text**
   (`tx/txm/txd`) stay **hex on purpose** — they're constant across themes and are
   concatenated with alpha suffixes in ~800 call-sites (`D.amber + "1c"`), which
   would break under `var()`. The 6 *surface* alpha-concat sites were converted to
   `color-mix()` (slop-top, sa-weekly, press-to-premier, morning-brief, test/poast-status).

3. **Provider + anti-flash — `src/app/theme-context.tsx` + `src/app/layout.tsx`**
   `ThemeProvider` (inside `UserProvider`) holds `{theme,bg}`, writes the `<html>`
   attributes, exposes `useTheme()`. A blocking inline script in `layout.tsx`
   (`THEME_BOOT`) sets `data-theme/data-bg` from localStorage before paint. SSR
   defaults are `classic`/`aurora` on `<html>`.

4. **Persistence — `src/app/api/prefs/route.ts` + `src/lib/user-prefs.ts`**
   localStorage `poast-theme` (instant) + Neon `user_prefs(owner, theme, bg,
   tour_seen, updated_at)` (durable, cross-device). Migration:
   `sql/2026-06-23_user_prefs.sql` (already applied). The GET returns `stored:false`
   when no row exists so the client never clobbers a local choice with the default.

5. **Roles — `src/app/lib/roles.ts`**
   Identity → `admin | marketing | analyst` (akash=admin; daksh/michelle/vansh=
   marketing; everyone else analyst). Derived server-side, returned by `/api/prefs`.
   Separate from `user-context.tsx`'s feature-role strings. SSO-ready (email map).

6. **Guided tour — `src/app/marketing-suite/components/tour.tsx`**
   Spotlight/coach-marks over shell elements tagged `data-tour="wordmark|assistant|
   rail|panel|settings"`. First-run only (`localStorage poast3.tour.marketing.v1` +
   `user_prefs.tour_seen`), skippable, relaunch via the `poast:replay-tour` window
   event (fired by Settings → "Replay the guided tour").

## Extending to another suite
1. Tag the suite's shell nav/header/settings with `data-tour="…"` and render a
   `<MarketingTour>`-style component with a suite-specific `storageKey`.
2. Make sure the suite's surfaces use `D.bg/card/surface/...` (most already do via
   the shared `D`). Audit any **local `D` copies** (see below) and point them at the
   shared `D` or `var(--…)`.
3. Add a Settings entry (reuse `AppearanceSettings`).

## Known follow-ups (out of scope for the foundation)
- **Local-`D` files** keep private palettes and won't theme until rewired:
  `slop-top`, `sa-weekly`, `fabricated-knowledge`, `buffer-schedule`,
  `ideation-nation`, `outreach`, `trends`, `broll-library`, `gtc-flow`.
- **Full liquid-glass material**: cards are inline-styled (no class), so per-card
  `backdrop-filter` blur isn't applied globally — Glass currently reads as
  translucent surfaces + tinted backdrop. Add `data-glass` to card wrappers for
  true blur.
- **Decorative bg layers** (animated aurora/cockpit/iridescent): only the
  `data-bg` + `--bg0/1/2` contract ships; the animated layer is a later add.
- **Google SSO**: role map is SSO-ready; auth is still the custom gate.
