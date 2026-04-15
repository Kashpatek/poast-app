# POAST Platform Status Report
**v3.0 // April 14, 2026 // SemiAnalysis Content Command Center**

---

## WHAT'S LIVE (13 sections + shared constants)

| Section | Category | Supabase | V3 Changes |
|---------|----------|----------|------------|
| Slop Top | PRODUCE | No | Emoji cleanup (all unicode escapes → real chars) |
| Carousel | PRODUCE | No | **NEW: Browse B-Roll popover for slide images** |
| Capper | PRODUCE | No | **NEW: Send to Buffer (per-platform + Send All as drafts)** |
| Press to Premier | PRODUCE | Yes | **NEW: Browse B-Roll overlay in script step** |
| B-Roll Library | PRODUCE | Yes | Now accessible from P2P + Carousel |
| Fab Knowledge | PODCAST | Yes | **NEW: Add to Outreach button on prospects.** Imports TEAM from shared constants |
| SA Weekly | PODCAST | Yes | **NEW: Browse FK Guests panel for episode guest selection** |
| Outreach | PODCAST | Yes | **NEW: FK Guest badge cross-referencing.** Imports TEAM from shared constants |
| Trends | PREPARE | Yes | No changes (blocked on API keys) |
| IdeationNation | PREPARE | Yes | **NEW: Ideas persist to Supabase.** Receives news items from News Flow |
| News Flow | PREPARE | Yes | **NEW: Ideate button on news items routes to IdeationNation** |
| GTC Flow | PREPARE | Yes | **NEW: Add/edit/delete episodes from UI** (was hardcoded-only) |
| Schedule | PREMIER | No | **NEW: Full compose + posting flow.** Multi-channel, schedule or post now |

## NEW FILES

| File | LOC | Purpose |
|------|-----|---------|
| shared-constants.ts | 120 | TEAM roster, design tokens, fonts, platforms, utilities |

## SUPABASE DATA

| Table | Records | Content |
|-------|---------|---------|
| prospects | 40 | 7 past FK guests + 33 dream targets |
| episodes | 8 | All FK episodes from Spotify |
| archive | 8 | Released episodes across 6 categories |
| outreach | 61+ | Podcast targets + FK prospects via pipeline |
| trends | 8 | Seed trend entries across TikTok, YT, IG, X |
| projects | 6+ | P2P, B-Roll, News Flow, GTC, IdeationNation, SA Weekly state |

## V3 CROSS-MODULE DATA FLOWS

```
1. News Flow ──"Ideate"──→ IdeationNation
2. B-Roll Library ──"Browse"──→ P2P + Carousel
3. Capper ──"Send to Buffer"──→ Buffer Schedule
4. Fab Knowledge ──"Add to Outreach"──→ Outreach + "Browse FK"──→ SA Weekly
5. Outreach ←──"FK Guest badge"──→ Fab Knowledge
```

## V3 BUGS FIXED

| Bug | Section | Fix |
|-----|---------|-----|
| Ideas lost on refresh | IdeationNation | Persist to Supabase `projects` table |
| GTC episodes hardcoded | GTC Flow | Full add/edit/delete UI with Supabase sync |
| Buffer posting incomplete | Schedule | Compose modal: multi-channel, schedule/now |
| Emojis show unicode | Slop Top | All `\uD83D\uXXXX` replaced with real chars |
| Modules isolated | All | 5 cross-module data flows established |
| Team hardcoded 3x | Outreach/FK | Shared constants import |

## BLOCKED ON AKASH

| Item | What's Needed |
|------|---------------|
| Trend API keys | `YOUTUBE_API_KEY`, `NEWS_API_KEY`, `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` in Vercel |
| Clerk auth | Create account at clerk.com, provide keys |
| Canva template IDs | folder:read scope unlock, or manually copy template IDs from Canva URLs |
| GitHub Actions | Add `permissions: contents: write` to workflow YAML |

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| v3.0 | Apr 14 | Pipeline integration: 5 cross-module flows, Buffer compose, GTC CRUD, IdeationNation persistence, shared constants, emoji fixes |
| v2.9 | Apr 14 | FACTORY refine inputs, image/video gen fixes |
| v2.8.1 | Apr 14 | Full polish sweep across all 9 components |
| v2.8 | Apr 14 | Slop Top link-to-meme, Supabase everywhere |
| v2.7 | Apr 14 | Trends tabs, IdeationNation immersive, Chippy mascot |
| v2.6 | Apr 14 | SA Weekly rebuild, B-Roll Library, P2P Supabase, 40 FK prospects |
| v2.5.1 | Apr 14 | IdeationNation, Trends UI rebuild, Capper multi-platform/threads |
| v2.5 | Apr 14 | Trends aggregator API, FK cold email flow rebuild |
| v2.4 | Apr 14 | Slop Top rebuild, Carousel colors, Capper 4 tones, boot screen |
| v2.3 | Apr 14 | FK data overhaul, 8 episodes, 22 prospects, empty states |
| v2.2.1 | Apr 14 | Design consistency, Podcast coral accent |
| v2.2 | Apr 14 | Supabase wiring (FK/Outreach/Trends), SA Weekly aesthetic |

---

*POAST v3.0 // SemiAnalysis Content Command Center // 13 sections, 15,901 LOC, 5 data flows*
*Built with Claude Opus 4.6 // Deployed on Vercel*
