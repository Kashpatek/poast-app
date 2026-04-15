# POAST // Honest Spec & Status
**v2.9 // April 14, 2026 // 15,102 lines of code**

---

## AT A GLANCE

```
13 sidebar sections // 24 API routes // 7 Supabase tables
15 component files // 23 env vars // 0 tests
```

**Verdict: ~70% complete as polished MVP. Core content tools work. Integrations and cross-module flow need work.**

---

## EVERY SECTION -- HONEST STATUS

### PRODUCE (amber)

| Section | LOC | Works? | Honest Take |
|---------|-----|--------|-------------|
| **Slop Top** | 2,303 | YES | 4 tabs (Meme Maker, Brief Gen, arxiv.lol, FACTORY). Image gen works. Video gen calls correct API now. Brainrot presets, Italian brainrot, brainrot level slider all functional. FACTORY CRT aesthetic is cool. Brief generator works. arxiv.lol polls correctly. **Most complete section in the app.** |
| **Carousel** | 511 | YES | 5-step flow works. SA Schema v1.0 with typed slides. Image upload works. Canva autofill BLOCKED on folder:read scope. Export as JSON works. |
| **Capper** | ~200 (inline) | YES | 4 tones (Dylan/Doug/SA Twitter/Oren), 7 audience vibes, multi-platform, thread/epic thread lengths, custom prompt addition. All generate via Claude. Works well. |
| **Press to Premier** | 1,436 | MOSTLY | 9-step video pipeline. Script gen works. Chop toggle works. Font/caption style selection works. Audio mixer works in preview. Mix levels now export to render. **Render depends on GitHub Actions permissions (blocked).** Voiceover + music gen depend on ElevenLabs key (updated). |
| **B-Roll Library** | 286 | YES | Upload to Vercel Blob, tag, search, filter. Grid with hover preview. **Not accessible from other sections** (P2P, Carousel can't browse it). |

### PODCAST (coral)

| Section | LOC | Works? | Honest Take |
|---------|-----|--------|-------------|
| **Fab Knowledge** | 747 | YES | 5 tabs (Prospects/Development/Scheduled/Post-Prod/Released). 40 prospects in Supabase. Cold email generator works. Bio generator works. **Guest data only lives here -- not shared with Outreach or SA Weekly.** |
| **SA Weekly** | 892 | YES | 7-step flow (Setup through Log). Coral accent. Supabase sync. **Uses different data structure than FK. Should share guest database but doesn't.** |
| **Outreach** | 568 | YES | 7 team members, 61 podcast targets in Supabase. Fit scoring works. Kanban pipeline works. **Team roster hardcoded in 3 separate files.** |

### PREPARE (blue)

| Section | LOC | Works? | Honest Take |
|---------|-----|--------|-------------|
| **Trends** | 480 | PARTIAL | 3 tabs, horizontal scroll rows, wizard button. **Trend data only populates if API keys are set** (YouTube, NewsAPI, Spotify -- none currently on Vercel). Google Trends RSS and Apple/Reddit work without keys. Manual trends save to Supabase. |
| **IdeationNation** | 744 | PARTIAL | Immersive hero looks great. 4-step wizard works. **Ideas now route to correct tools** (P2P, Slop Top, Capper, Carousel, FK). But ideas aren't saved to Supabase -- lost on refresh. |
| **News Flow** | 963 | YES | 16-widget drag-and-drop dashboard. RSS feeds, stock tickers, notes, todos. Widget config syncs to Supabase. **Most mature section after Slop Top.** |
| **GTC Flow** | 307 | PARTIAL | Episode tracker with hardcoded episodes. Cadence selector. Timeline view. **All data hardcoded -- no way to add episodes without code.** |

### PREMIER (teal)

| Section | LOC | Works? | Honest Take |
|---------|-----|--------|-------------|
| **Schedule** | 743 | MOSTLY | Buffer integration with channels, scheduled/sent/drafts. Sequential queries with 60s cache (rate limit fix). **Actual posting to Buffer is incomplete.** |

---

## WHAT'S GENUINELY BROKEN

| Issue | Where | Impact |
|-------|-------|--------|
| ~~Image gen "MACHINE RETURNED NOTHING"~~ | Slop Top | **FIXED** -- was checking `d.url` instead of `d.images[0]` |
| ~~Video gen "Unknown action"~~ | Slop Top | **FIXED** -- was missing `action: "generate"` in request |
| Trend rows empty | Trends | Need API keys on Vercel: `YOUTUBE_API_KEY`, `NEWS_API_KEY`, `SPOTIFY_CLIENT_ID/SECRET` |
| GitHub Actions render fails | P2P | Need `permissions: contents: write` in workflow YAML |
| Canva autofill blocked | Carousel | `folder:read` scope grayed out in Canva dev portal |
| Buffer posting incomplete | Schedule | Can read channels/posts but posting flow unfinished |
| GTC episodes hardcoded | GTC Flow | No way to add/edit episodes from UI |
| Ideas lost on refresh | IdeationNation | Not saved to Supabase |
| Some emojis show unicode | Slop Top | A few deep in brainrot presets still render as `\uD83D\uDC80` |

---

## DATA IN SUPABASE

| Table | Records | Source |
|-------|---------|--------|
| prospects | 40 | 7 past FK guests + 33 dream targets |
| episodes | 8 | All FK episodes from Spotify |
| archive | 8 | Released episodes, 6 categories |
| outreach | 61 | Full expanded podcast target spreadsheet |
| trends | 8 | Seed entries (manual) |
| projects | ~4 | P2P, B-Roll, News Flow, GTC configs |
| weekly | ~1 | SA Weekly state |

---

## TEAM DATA PROBLEM (hardcoded 3x)

```
outreach.tsx line 16:   TEAM = [Dylan, Doug, Jordan, Dan, Kimbo, Cameron, Wega]
sa-weekly.tsx:          TEAM = [same 7 people, copy-pasted]
fabricated-knowledge:   references same people but different format
```

**Should be: ONE shared constant or Supabase table.**

---

## PLATFORM DATA PROBLEM (hardcoded 6x)

Platform colors/names/limits defined separately in:
1. carousel.tsx (CATEGORIES)
2. slop-top.tsx (PLATFORMS)
3. trends.tsx (SOURCE_META)
4. buffer-schedule.tsx (PLATS)
5. outreach.tsx (PIPELINE_COLS)
6. poast-client.tsx (PL, CAPPER_PLATFORMS)

**Should be: ONE shared platforms config.**

---

## CROSS-MODULE FLOW (what should connect but doesn't)

```
News Flow ──→ IdeationNation ──→ Slop Top / Carousel / Capper / P2P
    ↑              ↑
 Trends ───────────┘

B-Roll Library ──→ should be browsable from P2P + Carousel

Fab Knowledge guests ──→ should share with Outreach + SA Weekly

Buffer Schedule ──→ should receive captions from Capper + SA Weekly
```

**Currently: all 13 modules are isolated. Data flows nowhere between them.**

---

## ENV VARS STATUS

| Variable | On Vercel? | Working? |
|----------|-----------|----------|
| ANTHROPIC_API_KEY | YES | YES -- all Claude generation works |
| XAI_API_KEY | YES | YES -- Grok images work |
| ELEVENLABS_API_KEY | YES | YES -- updated to work account |
| KLING_ACCESS_KEY/SECRET | YES | UNTESTED in prod |
| BUFFER_API_KEY | YES | YES -- channels load, rate limited |
| GITHUB_PAT | YES | YES -- dispatch works |
| CANVA_CLIENT_ID/SECRET | YES | YES -- OAuth works, autofill blocked |
| CANVA_ACCESS/REFRESH_TOKEN | YES | Expires, cookie-based refresh |
| NEXT_PUBLIC_SUPABASE_URL | YES | YES |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | YES | YES |
| YOUTUBE_API_KEY | **NO** | Trends YouTube row empty |
| NEWS_API_KEY | **NO** | Trends News row empty |
| SPOTIFY_CLIENT_ID/SECRET | **NO** | Trends Spotify row empty |
| BLOB_READ_WRITE_TOKEN | **CHECK** | P2P asset uploads may fail |

---

## WHAT TO BUILD NEXT (priority order)

### Tier 1: Fix What's Broken
1. Add trend API keys to Vercel (YouTube, NewsAPI, Spotify)
2. GitHub Actions `permissions: contents: write`
3. Save IdeationNation ideas to Supabase
4. Fix remaining emoji rendering in Slop Top

### Tier 2: Connect the Pipeline
5. Shared constants file (team, platforms, colors)
6. B-Roll Library accessible from P2P and Carousel ("Browse B-Roll" button)
7. News Flow → IdeationNation "Generate idea from this" button
8. Capper → Buffer Schedule "Send to Buffer" button
9. Shared guest database for FK + Outreach + SA Weekly

### Tier 3: Complete Features
10. Buffer actual posting (not just reading)
11. GTC Flow dynamic episode management
12. Clerk auth (protect app behind login)
13. Mobile responsive pass

### Tier 4: Polish
14. Extract shared utilities (ask, copyText, etc.)
15. Performance optimization (memoize expensive renders)
16. Loading states on all async operations
17. Error recovery and retry patterns

---

## COMPONENT SIZE CHART

```
slop-top.tsx      ████████████████████████████████████████████████ 2,303
press-to-premier  ██████████████████████████████ 1,436
news-flow.tsx     ████████████████████ 963
sa-weekly.tsx     ██████████████████ 892
ideation-nation   ███████████████ 744
buffer-schedule   ███████████████ 743
fabricated-know   ███████████████ 747
outreach.tsx      ███████████ 568
carousel.tsx      ██████████ 511
trends.tsx        █████████ 480
gtc-flow.tsx      ██████ 307
broll-library     █████ 286
poast-client.tsx  ██████████████████████ ~940 (shell + Capper + Chippy)
```

---

## FONTS

| Font | Weights | Used For |
|------|---------|----------|
| **Grift** | 400-900 (6 woff2 files) | POAST branding, splash, P2P font picker option |
| **Outfit** | 300-900 (Google Fonts) | Everything else: body, labels, headings |
| **JetBrains Mono** | 400-700 (Google Fonts) | Code, timestamps, monospace data, terminal UI |

---

## INTEGRATIONS

| Service | Status | What It Does |
|---------|--------|-------------|
| **Claude** (Anthropic) | WORKING | All content generation, prompt crafting, email writing |
| **Grok** (xAI) | WORKING | Image generation, video generation |
| **Kling** | UNTESTED | Video generation fallback |
| **ElevenLabs** | WORKING | Voiceover + music generation |
| **Buffer** | PARTIAL | Read channels/posts, rate-limited. Posting incomplete |
| **Canva** | BLOCKED | OAuth works, autofill needs folder:read scope |
| **Vercel Blob** | WORKING | Asset uploads for B-Roll and P2P |
| **GitHub Actions** | BLOCKED | Render dispatch works, needs permissions fix |
| **Supabase** | WORKING | 7 tables, CRUD API, all major sections synced |
| **NewsAPI** | NEEDS KEY | Trend data aggregation |
| **YouTube API** | NEEDS KEY | Trending tech videos |
| **Spotify** | NEEDS KEY | Podcast/music trends |
| **Apple RSS** | WORKING | Top podcasts and music (no key needed) |
| **Reddit** | WORKING | Hot posts from tech subreddits (no key needed) |
| **Google Trends** | WORKING | Trending searches RSS (no key needed) |

---

## VERSION HISTORY (recent)

```
f9052b9  FACTORY: refine inputs at prompt and image stages
bdbf9a5  Fix image generation: API returns images[] not url
6bf2793  Fix video gen action params + FACTORY error handling
2cfcf53  Fix IdeationNation wizard/routing
25ac91e  SLOP TOP FACTORY: 2-phase CRT meme pipeline
9ebf6dd  Italian brainrot + brainrot level slider
f8d5bd7  arxiv.lol tab + notification system
4f5c155  Full brainrot overhaul + video gen + presets
42f9266  Capper audience/vibe selector + custom prompt
914d34e  Slop Top tabs: Meme Maker + Brief Generator
5408dba  POAST_STATUS.md update
f9109b4  Full polish sweep across all 9 components
8cfc92d  Slop Top link-to-meme, Supabase everywhere
975b83d  SA Weekly rebuild, B-Roll Library, P2P Supabase
755cb5f  IdeationNation + Trends UI + Capper multi-platform
99e62e0  Trends aggregator + FK cold email flow
```

---

*POAST v2.9 // 13 sections // 15,102 LOC // SemiAnalysis Content Command Center*
*Built with Claude Opus 4.6 // Deployed on Vercel*
