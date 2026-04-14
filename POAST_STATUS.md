# POAST Platform Status Report
**v2.8.1 // April 14, 2026 // SemiAnalysis Content Command Center**

---

## WHAT'S LIVE (13 sections)

| Section | Category | Supabase | Description |
|---------|----------|----------|-------------|
| Slop Top | PRODUCE | No | Link-to-slop meme generator + brief generator + Grok image creator + canvas editor |
| Carousel | PRODUCE | No | SA Schema v1.0 carousel generator with Canva template mapping |
| Capper | PRODUCE | No | 4-tone caption maker (Dylan/Doug/SA Twitter/Oren), multi-platform, threads |
| Press to Premier | PRODUCE | Yes | 9-step video production suite with audio mix export |
| B-Roll Library | PRODUCE | Yes | Upload, tag, search b-roll clips for reuse |
| Fab Knowledge | PODCAST | Yes | 5-tab podcast lifecycle (Prospects/Development/Scheduled/Post-Prod/Released) |
| SA Weekly | PODCAST | Yes | 7-step guided flow (Setup/Generate/Review/Social/Clips/Export/Log) |
| Outreach | PODCAST | Yes | 7 team members, 61 targets, fit scoring, Kanban pipeline |
| Trends | PREPARE | Yes | TrendPulse aggregator (Google/YouTube/News/Apple/Reddit/Spotify), 3 tabs, wizard |
| IdeationNation | PREPARE | Yes | AI idea hub with immersive hero, 4-step wizard, trend-powered generation |
| News Flow | PREPARE | Yes | 16-widget dashboard with RSS feeds |
| GTC Flow | PREPARE | Yes | Conference episode tracker |
| Schedule | PREMIER | No | Buffer integration (sequential queries, 60s cache) |

## SUPABASE DATA

| Table | Records | Content |
|-------|---------|---------|
| prospects | 40 | 7 past FK guests + 33 dream targets (Jensen Huang, Lisa Su, Jim Keller, Dario Amodei, etc.) |
| episodes | 8 | All FK episodes from Spotify (Rajesh Vashist x2, Tony Pialis, Dan Kim & Hasan Khan, Wes Cummins, Val Bercovici x2, Will Eatherton) |
| archive | 8 | Released episodes across 6 categories |
| outreach | 61 | Full podcast target list across 6 sectors (Tech/VC, Investing, AI/Infra, Semis, Energy/DC, Geopolitics) |
| trends | 8 | Seed trend entries across TikTok, YT, IG, X |
| projects | 4+ | P2P projects, B-Roll assets, News Flow config, GTC Flow state, SA Weekly state |

## FEATURES

### Chippy (AI Mascot)
Interactive IC chip character in sidebar with animated faces, bouncing, moods, messages. "Ask Chippy" button opens Claude-powered chat with semiconductor personality.

### Fonts
- **Grift** (SA brand): 6 weights, used on branding headings, available in P2P video font picker
- **Outfit** (primary): All weights, body/labels/headings
- **JetBrains Mono** (data): 3 weights, labels/timestamps/code

### Design System
- bg: #06060C, card: #09090D, surface: #0D0D12
- border: rgba(255,255,255,0.06)
- Category accents: Amber (PRODUCE), Coral (PODCAST), Blue (PREPARE), Teal (PREMIER)
- All components polished with hover states, consistent border radius (12px), text readability passes

### Integrations
- **Claude API** (claude-sonnet-4-20250514): All content generation
- **ElevenLabs**: Voiceover + music generation (work account key)
- **Grok/xAI**: Video clips + image generation
- **Kling AI**: Video generation
- **Buffer**: Social scheduling (GraphQL, rate-limited with cache)
- **Canva**: OAuth + PKCE + auto-refresh tokens (template mapping pending)
- **Vercel Blob**: Asset uploads
- **GitHub Actions**: Remotion video rendering with progress polling
- **Supabase**: Database for all persistent data

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
| v2.1.1 | Apr 14 | Render progress polling, Supabase infrastructure |
| v2.1 | Apr 14 | Grift font, coral podcast, FK episodes, Remotion fonts, .docx export |
| v2.0.1 | Apr 13 | Carousel SA Schema v1.0 |
| v2.0 | Apr 13 | FK, Trends, Slob Top, Outreach modules |
| v1.3.1 | Apr 13 | P2P chop sentences, caption styles, font controls |
| v1.3.0 | Apr 13 | Carousel section + Canva API routes |

---

*POAST v2.8.1 // SemiAnalysis Content Command Center // 13 sections, 40 prospects, 61 outreach targets, 8 episodes*
