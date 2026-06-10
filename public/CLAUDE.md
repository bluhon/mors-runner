# MORS — Marketing Opportunity Research System
## Legacy Context File

This file is historical and may be stale. Current implementation notes live in `/docs`.

Important current policy: FindRFP is not a production search source. MORS should search original procurement sources and official agency/portal pages.

This file gives Claude Code full context to continue building MORS without losing history.

---

## What is MORS?

MORS is a daily intelligence system for **Bluhon**, a California public engagement, consensus building, and environmental conflict resolution firm based in the San Francisco Bay Area (est. 1995). Bluhon's core services: public engagement, facilitation, mediation, consensus building, environmental conflict resolution.

MORS runs every weekday at 9:30am PT and produces a four-track intelligence report that the marketing team reads each morning to find new business opportunities.

---

## Tech Stack

- **Backend**: Node.js + Express, hosted on **Render** (mors-runner.onrender.com)
- **AI**: Anthropic Claude (`claude-opus-4-5` via `@anthropic-ai/sdk`) — two sequential API calls per run
- **Database**: Airtable (base ID: `appallyGF2B2bkpIU`)
- **Frontend**: Single-page HTML app at `/public/index.html` — no framework, vanilla JS
- **Scheduler**: `node-cron` — fires at 9:30am PT Mon–Fri
- **Auto-deploy**: Render pulls from GitHub `main` branch on every push

### Key files
- `mor_runner.js` — entire backend (~2300 lines): scraper functions, Claude prompts, Airtable writes, Express routes
- `public/index.html` — entire frontend (~1400 lines): login, report viewer, pipeline, canvas, contacts
- `public/mors.css` — shared styles (also inline in index.html)

---

## Airtable Tables

| Constant | Table ID | Purpose |
|---|---|---|
| `AIRTABLE_REPORTS_TABLE` | `tblnaSbxkGaoscwZj` | DAILY_REPORTS — one record per run |
| `AIRTABLE_OPPS_TABLE` | `tbleIossei7FDqi9H` | OPPORTUNITIES — Track 1 RFPs + saved articles |
| `AIRTABLE_TRACK2_TABLE` | `tbl4f7N5EoaKRwRXK` | TRACK2_ITEMS — individual Track 2 news items |
| `AIRTABLE_MEMORY_TABLE` | `tblNgcBpooPK9wOkD` | PROJECT_MEMORY — learning loop patterns |
| `AIRTABLE_SOURCES_TABLE` | `tblsQwva2y8ABugYH` | SEARCH_SOURCES — procurement portals |
| `AIRTABLE_MEDIA_TABLE` | `tblANGqT4L4Yt1MFl` | MEDIA_SOURCES — 73 Bay Area news outlets |
| (hardcoded) | `tblRFPCanvas` | RFP_CANVAS — pursuit canvases |
| (hardcoded) | `tblContacts` | CONTACTS |
| (hardcoded) | `tblPrimeFirms` | PRIME_FIRMS |
| (hardcoded) | `tblUsers` | USERS |

DAILY_REPORTS fields: `report_date`, `run_timestamp`, `track1_html`, `track2_html`, `track3_html`, `track4_html`

OPPORTUNITIES fields: `title`, `agency`, `deadline`, `track`, `scope`, `source_url`, `interest` (Yes/No), `geo_tier`, `prior_client`

RFP_CANVAS fields: `canvas_title`, `active`, `pursuit_status`, `issuer_agency`, `rfp_url`, `rfp_description`, `proposal_due`, `team_notes`, `notes_log`, `files_list`, `created_by`, `created_at`

---

## The Four Tracks

### Track 1 — Active RFPs
Claude searches procurement portals for open RFPs matching Bluhon's services. Displayed as an HTML table (Agency | Project/Scope | Due Date | Est. Value | Type | Source URL). Each row has Yes/No interest buttons. "Yes" creates an RFP Canvas and saves to OPPORTUNITIES.

**Portal scrapers (all run in parallel at startup):**
- `scrapeOpengov()` — procurement.opengov.com (authenticated)
- `scrapeBonfire()` — gobonfire.com (authenticated, multiple Bay Area subdomains)
- `scrapePlanetbids()` — **vendorline.planetbids.com** (authenticated — user has account)
- `scrapeBiddingusa()` — biddingousa.com (authenticated — Santa Clara County, San Jose)
- `scrapeBidnet()` — bidnetdirect.com (authenticated — Fremont, Livermore, Pleasant Hill, Novato, Tiburon, Santa Clara city, Mountain View)
- `scrapeCivicengage()` — 26 Bay Area cities using /Bids.aspx (public, no auth)
- `scrapeStandalonePages()` — 55 Bay Area agencies with their own bid pages (public, no auth)

**Standalone pages list includes:** Port of Oakland, Port of SF, BART, AC Transit, Caltrain, VTA, SMART, Golden Gate Transit, SamTrans, SFMTA, MTC/ABAG, BCDC, BAAQMD, EBRPD, MROSD, SFPUC, EBMUD, Valley Water, Sonoma Water, Marin MWD, Zone 7, all 9 Bay Area counties + SF, and ~26 cities (Oakland, Berkeley, Richmond, Hayward, Concord, Walnut Creek, San Ramon, Pleasanton, Vallejo, Fairfield, Vacaville, Napa, Petaluma, Santa Rosa, Redwood City, San Mateo, Palo Alto, Sunnyvale, Santa Clara, Milpitas, Cupertino, Los Gatos, Benicia, Emeryville, Piedmont, San Leandro).

### Track 2 — Emerging Issues & Local Conflicts
Pre-fetched Bay Area news via RSS aggregator (`fetchAllNewsItems()`), scored by relevance, passed to Claude for analysis. Claude identifies local conflicts, CEQA disputes, facility siting controversies, etc. that signal future Bluhon opportunities.

**RSS sources:** 24 Google News queries + 21 direct feeds (Berkeleyside, Oaklandside, Mission Local, Marin Post, SJ Spotlight, Richmond Standard, East County Today, Marin IJ, Palo Alto Weekly, Mountain View Voice, Half Moon Bay Review, San Mateo Daily Journal, Press Democrat, Napa Valley Register, East Bay Times, Mercury News, SF Examiner, Novato Advance, Sacramento Bee, Planetizen, ENR).

Output grouped under `<h2>` headings: Local News, Regional News, Agency Board, County Board, City Board.

Each article has a **"→ Save to Pipeline"** button — saves to OPPORTUNITIES (interest=Yes, track="2 — Emerging Issue") and creates a pre-populated Canvas.

### Track 3 — Prime Firm Activity
Contract awards, firm moves, teaming intelligence for: AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Arup, Fehr & Peers, Kimley-Horn, GHD, EPS Group, Atkins, Burns & McDonnell, ARCADIS, Dudek.

Also monitors direct competitors: MIG, PlaceWorks, Circlepoint, Raimi+Associates, Rincon Consultants, Mintier Harnish, CONCUR, DC&E, Civic Edge, Stakeholder Communications Group.

Each article has a **"→ Save to Pipeline"** button (same as Track 2).

### Track 4 — Governing Body Pipeline
Pre-RFP signals from Bay Area governing body agendas/minutes (past 14 days). Identifies projects being discussed that will produce RFPs in 3–18 months. Grouped under Agency Board / County Board / City Board headings. Flags ⭐ when RFP authorization was granted.

---

## RSS Relevance Scoring

Items scored before passing to Claude (25-item cap, sorted highest first):

```javascript
KEYWORD_WEIGHTS = {
  // Tier 1 (3pts): public engagement, community engagement, facilitation,
  //   mediation, consensus, conflict resolution, community outreach, stakeholder,
  //   land use, facility siting, community opposition, neighborhood opposition,
  //   dispute, opposition, land use dispute, environmental conflict,
  //   environmental dispute, development proposal
  // Tier 2 (2pts): planning commission, environmental review, public hearing,
  //   general plan, specific plan, entitlement, water rights, board of supervisors,
  //   city council, rezoning, annexation, outreach, controversy, contested
  // Tier 3 (1pt): ceqa, eir, zoning, housing project, development project,
  //   infrastructure, advisory committee, task force, contract award, rfp
}
// Title match = 2x weight. Bay Area geography match = +2pts.
```

BAY_AREA_TERMS: ~100 places covering all 9 counties and major cities.

---

## Duplicate Detection

```javascript
normalizeTitle(title)  // lowercases, strips stop words and punctuation
titlesMatch(a, b)      // exact OR 70%+ word overlap on words >3 chars
fetchExistingOppTitles(cutoffStr)  // pulls last 45 days from Airtable
isDuplicate(title)     // checks cross-run (Airtable) + within-run (Set)
```

Applied to all scraper save paths.

---

## PROJECT_MEMORY Learning Loop

When Track 1 RFPs are reviewed:
- "No" interest → writes a CRITICAL pattern to PROJECT_MEMORY table
- "Yes" interest → also logs a pattern
- At run time, all CRITICAL patterns are injected into the Claude system prompt

This teaches the system what to avoid (e.g. news articles that aren't RFPs, stale dates).

---

## Geographic Rotation

`getGeoContext()` rotates through Bay Area zones each weekday so Claude focuses search effort:
- Mon: SF + Marin + Sonoma
- Tue: Alameda + Contra Costa
- Wed: Santa Clara + San Mateo
- Thu: Napa + Solano + all special districts
- Fri: Full Bay Area sweep + Tier 2/3

---

## Frontend Architecture (public/index.html)

Single HTML file, ~1400 lines. Login-gated (checks USERS table in Airtable).

**Pages/tabs:** Today's Report | Active Pipeline | Canvas | Contacts

**Key functions:**
- `renderReport()` — renders all 4 tracks from latest DAILY_REPORTS record
- `formatTrackItems(html, track)` — parses Claude's HTML list output, formats with titles/bodies/source links, adds "Save to Pipeline" button for Track 2/3
- `loadProspects()` — loads Track 1 RFP cards with Yes/No interest buttons
- `triggerManualRun()` — POSTs to /run (fire-and-forget), fast-polls every 15s for new report, auto-loads when detected
- `startReportPolling()` — auto-polls every 90s, shows toast if newer report found
- `renderPipeline(opps)` — table view of OPPORTUNITIES where interest=Yes, max-width 960px
- `deleteOpportunity(id, btn)` — deletes from Airtable + removes row instantly
- `saveArticleToPipeline(title, url, summary, track, btn)` — saves Track 2/3 article to OPPORTUNITIES + creates Canvas
- `createCanvas(oppId)` — creates RFP_CANVAS record pre-populated from opportunity fields
- `openCanvas(canvasId)` — opens the canvas detail view

**Auto-poll toast:** slides up from bottom "New report ready [Load it] ×" every 90s check.

**Timestamps:** each track header shows "Refreshed Jun 8, 2026, 9:35 AM PDT" from `run_timestamp` field.

---

## Environment Variables (set in Render)

```
ANTHROPIC_API_KEY
AIRTABLE_TOKEN
OPENGOV_LOGIN / OPENGOV_PASSWORD
BONFIRE_LOGIN / BONFIRE_PASSWORD
PLANETBIDS_LOGIN / PLANETBIDS_PASSWORD       ← needs to be added
BIDDINGUSA_LOGIN / BIDDINGUSA_PASSWORD       ← already added
BIDNET_LOGIN / BIDNET_PASSWORD               ← user getting account
CIVICENGAGE_LOGIN / CIVICENGAGE_PASSWORD     ← user getting account (but public pages work without)
```

---

## Express Routes

| Route | Method | Description |
|---|---|---|
| `/run` | POST | Fire-and-forget: starts runMORSReport(), responds immediately |
| `/latest-report` | GET | Returns most recent DAILY_REPORTS record |
| `/seed-media` | POST | One-time: seeds 73 media sources to MEDIA_SOURCES table |
| `/health` | GET | Returns `{status:'ok'}` |
| Static | GET | Serves `/public/` |

Cron: `"30 9 * * 1-5"` → 9:30am PT Mon–Fri

---

## What's Built & Working

- ✅ Full four-track daily report generation
- ✅ RSS aggregator (24 Google News queries + 21 direct feeds) with relevance scoring
- ✅ Source-direct scrapers running in parallel (OpenGov, Bonfire, PlanetBids, BiddingUSA, BidNet, CivicEngage, Standalone)
- ✅ 55 standalone agency pages scraped (ports, transit, water, counties, cities)
- ✅ Duplicate detection across all scrapers
- ✅ PROJECT_MEMORY learning loop
- ✅ Fire-and-forget /run with frontend fast-polling + auto-load
- ✅ Auto-poll every 90s with toast notification
- ✅ Track 4 rendering (was missing, now fixed)
- ✅ Yes/No interest buttons on Track 1 RFPs → creates Canvas
- ✅ "→ Save to Pipeline" button on every Track 2 and Track 3 article
- ✅ Active Pipeline page with Canvas button + trash delete button (max-width 960px)
- ✅ Timestamp "Refreshed at…" on each track header
- ✅ MEDIA_SOURCES table seeded with 73 Bay Area outlets
- ✅ Geographic rotation (Mon–Fri zones)
- ✅ Prior client flagging (✅ emoji on ~20 warm accounts)
- ✅ CRITICAL solicitation filter (no news articles in Track 1)

---

## What's Pending / Next Steps

### High Priority
- **Test a full run** — hit "Wake up Runner" and verify all 4 tracks render correctly with timestamps
- **Add PLANETBIDS_LOGIN/PASSWORD** to Render env vars (user has vendorline.planetbids.com account)
- **BidNet account** — user is getting account; add BIDNET_LOGIN/PASSWORD to Render when ready
- **Verify standalone URL accuracy** — some of the 55 standalone page URLs are best-guess patterns (e.g. `/bids`) and may need correction after live testing
- **Port of Oakland** confirmed as standalone (not a portal) — already in STANDALONE_PAGES

### Medium Priority
- **Mock up Track 2/3 "Save to Pipeline" UI** — user is reviewing the design before finalizing
- **Per-track refresh buttons** — separate "re-run just Track 2" buttons (bigger lift, separate backend endpoints)
- **Pipeline page** — full canvas workflow, edit fields inline
- **Contacts page** — search + edit functionality

### Lower Priority
- **BiddingUSA agency expansion** — add more agencies once user confirms which Bay Area cities are on the platform
- **Verify CivicEngage pages** — 26 cities in list, confirm URLs are correct
- **Mobile polish**
- **Canvas → proposal workflow**
- **SEARCH_CONFIG table** (deferred)

---

## Known Issues / Watch Out For

1. **PlanetBids URL** — scraper now uses `vendorline.planetbids.com` (updated from old `www.planetbids.com`). Needs credentials in Render to activate.
2. **Standalone page URLs** — ~55 agencies, many URLs are pattern-guessed (`/bids`). Live run will log warnings for any that 404 — those need manual correction.
3. **GitHub push** — in this cloud session, `git push` via the local proxy was broken (403). Workaround: manually paste file content via GitHub web editor. On office Mac with normal git setup this should work fine.
4. **Context window** — two Claude API calls per run (Tracks 1+2, then Tracks 3+4) to stay within rate limits.
5. **CivicEngage** — 26 cities all use `/Bids.aspx` pattern, all public. No auth needed. Some cities also appear in the CivicEngage list AND other scrapers — duplicate detection handles this.

---

## How to Run Locally

```bash
cd mors-runner
npm install
# Set env vars (copy from Render dashboard)
node mor_runner.js
# Open http://localhost:3000
```

---

## Git History (recent)

- `Save to Pipeline buttons` — Track 2/3 articles get save button → Pipeline + Canvas
- `Pipeline width + trash button` — max-width 960px, trash icon deletes records
- `Add timestamp to track headers` — "Refreshed Jun 8, 2026 9:35 AM PDT" per track
- `Wire new scrapers + standalone pages` — BiddingUSA/BidNet/CivicEngage wired in, 55 standalone agencies
- `Update PlanetBids scraper to vendorline.planetbids.com` — new account URL
- `Fix syntax error in triggerManualRun breaking login`
- `Auto-load report after manual run; fix Track 4 missing from view`
