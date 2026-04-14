# POAST Platform Status Report
**v2.2.1 // April 14, 2026 // SemiAnalysis Content Command Center**

---

## WHAT'S LIVE AND WORKING

### Sidebar Sections (10 total)
| Section | Category | Status | Data Source |
|---------|----------|--------|-------------|
| Slob Top | PRODUCE (amber) | Live | Claude API |
| Carousel | PRODUCE (amber) | Live | Claude API + Canva (partial) |
| Capper | PRODUCE (amber) | Live | Claude API |
| Press to Premier | PRODUCE (amber) | Live | Claude + ElevenLabs + Grok + Kling |
| Fab Knowledge | PODCAST (coral) | Live | Supabase |
| SA Weekly | PODCAST (coral) | Live | localStorage |
| Outreach | PODCAST (coral) | Live | Supabase |
| Trends | PREPARE (blue) | Live | Supabase |
| News Flow | PREPARE (blue) | Live | RSS feeds |
| GTC Flow | PREPARE (blue) | Live | localStorage + API |
| Schedule | PREMIER (teal) | Live | Buffer API |

### API Routes (20 total)
All compiling, all with error handling, no hardcoded secrets.
- /api/generate, /api/fk, /api/slob-top, /api/carousel (Claude)
- /api/generate-voiceover, /api/generate-music (ElevenLabs)
- /api/generate-clip, /api/generate-thumbnail (Grok/Kling)
- /api/render-video (GitHub Actions dispatch + progress polling)
- /api/upload-asset (Vercel Blob)
- /api/buffer, /api/buffer/auth, /api/buffer/callback (Buffer GraphQL)
- /api/canva/auth, /api/canva/callback, /api/canva/autofill, /api/canva/export (Canva PKCE OAuth)
- /api/db (Supabase CRUD), /api/db-test
- /api/news (RSS), /api/state, /api/gtc-state

### Supabase Database
| Table | Records | Content |
|-------|---------|---------|
| prospects | 3 | Val Bercovici (WEKA), Will Eatherton (Cisco), Wes Cummins (Applied Digital) |
| episodes | 6 | FK episodes 1-6 (4 guest interviews + 2 Doug solo) |
| archive | 6 | Released episodes with categories |
| outreach | 61 | Full podcast target list across 6 sectors |
| trends | 0 | Empty (live-entry tool) |
| projects | 0 | Empty (P2P projects, not yet migrated) |
| weekly | 0 | Empty (SA Weekly, not yet migrated) |

### Fonts
- **Grift** (SA brand font): 6 weights loaded (Regular, Medium, SemiBold, Bold, ExtraBold, Black). Used on POAST branding and splash. Available in P2P video font picker.
- **Outfit** (primary UI font): All weights via Google Fonts. Used everywhere for body, labels, headings.
- **JetBrains Mono** (data/code font): 3 weights via Google Fonts. Used for labels, timestamps, monospace data.

### Design System
All 10 sections now use consistent tokens:
- Background: #060608 (base), #09090D (card), #0D0D12 (elevated)
- Borders: rgba(255,255,255,0.06) standard, rgba(255,255,255,0.12) hover
- Category accents: Amber (PRODUCE), Coral (PODCAST), Blue (PREPARE), Teal (PREMIER)
- Card radius: 10-12px, amber glow on active states
- Headers: 28-42px, fontWeight 900, letterSpacing -2

---

## WHAT CAN BE DONE NOW (No blockers)

### High Priority
1. **Migrate SA Weekly to Supabase** (~30 min)
   - Currently uses localStorage for episode data, guests, selections
   - Wire to /api/db with table "weekly" using same pattern as FK

2. **Migrate P2P projects to Supabase** (~30 min)
   - P2P stores project data in localStorage
   - Wire to /api/db with table "projects"
   - Ensures video projects survive across devices

3. **B-Roll Asset Library** (~1 hr)
   - New section from the platform spec
   - Upload, tag, search b-roll clips for reuse across Slob Top and P2P
   - Uses Vercel Blob for storage, Supabase for metadata

4. **SA Weekly rebuild to mirror FK** (~2 hr)
   - Platform spec says SA Weekly should match FK's 5-phase structure
   - Currently Episode 7, hosts: Dylan, Jordan, Kimbo, Cameron, Wega
   - Multi-host format (FK is single-host Doug)

5. **Outreach data mapping fix** (~15 min)
   - Same snake_case vs camelCase issue as FK had
   - Outreach component may need field mapping for Supabase data

### Medium Priority
6. **GTC Flow migrate to Supabase** (~20 min)
   - Currently uses /api/gtc-state + localStorage hybrid

7. **Slob Top history** (~20 min)
   - Save generated briefs to Supabase for reuse/reference
   - Currently ephemeral (lost on page reload)

8. **Carousel history** (~20 min)
   - Save generated carousels to Supabase
   - Currently ephemeral

9. **Remove db-test route** (~2 min)
   - Diagnostic endpoint, no longer needed

10. **Remove redundant Google Font imports** (~5 min)
    - buffer-schedule.tsx and news-flow.tsx import Google Fonts separately
    - poast-client.tsx already handles this globally

### Low Priority
11. **Shared design token file** (~30 min)
    - Extract D/C color objects into a shared module
    - Currently duplicated in every component file
    - Would prevent future color drift

12. **News Flow migrate to Supabase** (~20 min)
    - Widget configs and saved items

13. **Buffer Schedule migrate to Supabase** (~20 min)
    - Draft posts and scheduling preferences

---

## BLOCKED ON AKASH

### Clerk Authentication
- **What**: Protect the app behind login
- **Need**: Create account at clerk.com, provide CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
- **Effort**: ~20 min to wire up once keys are provided
- **Impact**: Currently anyone with the URL can access the app

### Canva Template Mapping
- **What**: Map Canva template IDs to carousel slide types (COVER, BODY_A, BODY_B, etc.)
- **Blocked by**: `folder:read` scope grayed out in Canva Developer Portal
- **Workaround**: Manually copy template IDs from Canva URL bar when viewing each template
- **How**: Open each of the 4 templates in your TEMPLATES folder, grab the design ID from the URL, paste here
- **Impact**: "Send to Canva" button in Carousel will autofill templates directly

### GitHub Actions Workflow Permissions
- **What**: Render video uploads fail because workflow can't create releases
- **Need**: Edit `.github/workflows/render-video.yml` on GitHub, add at the top level:
  ```yaml
  permissions:
    contents: write
  ```
- **Impact**: P2P video renders will upload MP4 as GitHub Release

### Vercel Blob Token
- **What**: P2P asset uploads (voiceover, music) before GitHub Actions render
- **Need**: Check if BLOB_READ_WRITE_TOKEN is set in Vercel env vars
- **Where**: Vercel Dashboard > Storage > Blob > should show token
- **Impact**: Without it, render uploads may fail

---

## DATA THAT COULD BE ADDED

### Fabricated Knowledge
- **Current**: 6 episodes, 3 prospects
- **Could add**: If Doug has more episodes beyond what's on the RSS feed, provide the list
- **Could add**: More guest prospects for upcoming episodes

### Outreach
- **Current**: 61 targets from the expanded spreadsheet
- **Could add**: Status updates (mark which ones have been contacted)
- **Could add**: Contact details for targets where you have them

### SA Weekly
- **Current**: Episode 7, no data in Supabase yet
- **Could add**: Episodes 1-7 metadata once migrated to Supabase
- **Could add**: Guest/host history

### Trends
- **Current**: Empty (live-entry tool)
- **Usage**: Team adds trends as they spot them on TikTok/YT/IG/X

---

## ENV VARS STATUS

| Variable | Vercel | Local | Used By |
|----------|--------|-------|---------|
| ANTHROPIC_API_KEY | Yes | Yes | Claude generation |
| BUFFER_API_KEY | Yes | Yes | Buffer scheduling |
| ELEVENLABS_API_KEY | Yes | Yes | Voiceover + music |
| XAI_API_KEY | Yes | Yes | Grok clips + thumbnails |
| KLING_ACCESS_KEY | Yes | Yes | Kling video |
| KLING_SECRET_KEY | Yes | Yes | Kling video |
| GITHUB_PAT | Yes | Yes | Render dispatch |
| CANVA_CLIENT_ID | Yes | Yes | Canva OAuth |
| CANVA_CLIENT_SECRET | Yes | Yes | Canva OAuth |
| CANVA_ACCESS_TOKEN | Yes | No | Canva API (auto-refresh) |
| CANVA_REFRESH_TOKEN | Yes | No | Canva token refresh |
| NEXT_PUBLIC_SUPABASE_URL | Yes | Yes | Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Yes | Supabase |
| BLOB_READ_WRITE_TOKEN | Check | No | Vercel Blob uploads |
| CLERK_PUBLISHABLE_KEY | No | No | Auth (not set up) |
| CLERK_SECRET_KEY | No | No | Auth (not set up) |

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| v2.2.1 | Apr 14 | Design consistency fix, Podcast sections use SA Coral |
| v2.2 | Apr 14 | Supabase wiring (FK/Outreach/Trends), SA Weekly aesthetic refresh |
| v2.1.1 | Apr 14 | Render progress polling, Supabase infrastructure |
| v2.1 | Apr 14 | Grift font, coral podcast, FK episodes, Remotion fonts, .docx export |
| v2.0.1 | Apr 13 | Carousel rewrite for SA Schema v1.0 |
| v2.0 | Apr 13 | FK, Trends, Slob Top, Outreach modules |
| v1.3.1 | Apr 13 | P2P chop sentences, caption styles, font controls |
| v1.3.0 | Apr 13 | Carousel section + Canva API routes |

---

*Generated by POAST // SemiAnalysis Content Command Center*
