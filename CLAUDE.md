# MORS — Marketing Opportunity Research System
## Bluhon · Technical Reference

---

## What is MORS?

MORS is a daily intelligence system for **Bluhon**, a California public engagement, consensus building, and environmental conflict resolution firm based in the San Francisco Bay Area (est. 1995). Core services: public engagement, facilitation, mediation, consensus building, environmental conflict resolution.

MORS runs every weekday at 9:30am PT and produces a four-track intelligence report that the marketing team reads each morning to find new business opportunities.

Live at: **https://mors-runner.onrender.com**

---

## Tech Stack

- **Backend**: Node.js (ESM — `import` syntax, not `require`) + Express
- **Hosting**: Render (mors-runner.onrender.com) — auto-deploy from GitHub `main` branch on push
- **AI**: Anthropic Claude (`claude-sonnet-4-6` via `@anthropic-ai/sdk`) with `web_search_20250305` tool (`max_uses: 40`)
- **Database**: Airtable (base ID: `appallyGF2B2bkpIU`)
- **Frontend**: Single-page HTML app at `/public/index.html` — vanilla JS, no framework
- **Scheduler**: `node-cron` — fires at `"30 9 * * 1-5"` (9:30am PT Mon–Fri)

### Key Files

| File | Size | Purpose |
|---|---|---|
| `mor_runner.js` | ~2700 lines | Entire backend: scrapers, Claude calls, Airtable writes, Express routes |
| `public/index.html` | ~1400 lines | Entire frontend: login, report viewer, pipeline, canvas, contacts |
| `public/mors.css` | — | Shared styles (also inlined in index.html) |

### Dependencies (package.json)

```
@anthropic-ai/sdk   — Claude API client
express             — HTTP server
node-cron           — Scheduler
multer              — File upload middleware
```

---

## Airtable Tables

| Constant | Table ID | Purpose |
|---|---|---|
| `AIRTABLE_REPORTS_TABLE` | `tblnaSbxkGaoscwZj` | `DAILY_REPORTS` — one record per run |
| `AIRTABLE_OPPS_TABLE` | `tbleIossei7FDqi9H` | `OPPORTUNITIES` — all saved opportunities |
| `AIRTABLE_TRACK2_TABLE` | `tbl4f7N5EoaKRwRXK` | `TRACK2_ITEMS` — individual Track 2 news items |
| `AIRTABLE_MEMORY_TABLE` | `tblNgcBpooPK9wOkD` | `PROJECT_MEMORY` — learning loop patterns |
| `AIRTABLE_SOURCES_TABLE` | `tblsQwva2y8ABugYH` | `SEARCH_SOURCES` — all agency/portal URLs + firm names |
| `AIRTABLE_MEDIA_TABLE` | `tblANGqT4L4Yt1MFl` | `MEDIA_SOURCES` — Bay Area news outlets |
| `AIRTABLE_SEARCH_QUERIES_TABLE` | `tblWft5ytQe3NHByq` | `RFP_SEARCH_QUERIES` — Track 1 search query strings |
| `AIRTABLE_KEYWORDS_TABLE` | `tblRKf4ftCpv1q65Z` | `RELEVANCE_KEYWORDS` — scoring keyword weights |
| (hardcoded) | `tblRFPCanvas` | `RFP_CANVAS` — pursuit canvases |
| (hardcoded) | `tblContacts` | `CONTACTS` |
| (hardcoded) | `tblPrimeFirms` | `PRIME_FIRMS` |
| (hardcoded) | `tblUsers` | `USERS` — login authentication |

### DAILY_REPORTS Fields
`report_date` (Date), `run_timestamp` (Date/time), `track1_html` (Long text), `track2_html`, `track3_html`, `track4_html`

### OPPORTUNITIES Fields
`title`, `agency`, `deadline` (Date), `track` (Single select), `scope` (Long text), `source_url` (URL), `interest` (Single select: Yes/No), `geo_tier`, `prior_client` (Checkbox), `report_date` (Date)

### SEARCH_SOURCES Fields
`source_name`, `url`, `source_type` (Single select: `Standalone`, `Portal`, `Prime Firm`, `Competitor`, `Governing Body`), `active` (Checkbox), `username`, `notes`

The system reads different `source_type` values for different purposes:
- `Standalone` → agency bid page URLs passed to Claude for web_search visits (Track 1 Source B)
- `Portal` → procurement portal metadata shown to Claude as additional search hints
- `Prime Firm` / `Competitor` → firm names injected into Track 3/4 prompts
- `Governing Body` → governing body sources for Track 4

### RFP_CANVAS Fields
`canvas_title`, `active`, `pursuit_status`, `issuer_agency`, `rfp_url`, `rfp_description`, `proposal_due`, `team_notes`, `notes_log`, `files_list`, `created_by`, `created_at`

### Airtable API Notes
- All `atPost()` calls use `typecast: true` — required for Single Select fields, or Airtable returns 422
- Airtable Metadata API (`POST /v0/meta/bases/{baseId}/tables`) used for table creation in `/setup-airtable`
- Rate limit: batch creates use 10 records per request (Airtable max)

---

## The Four Tracks

### Track 1 — Active RFPs

Goal: find open, current RFPs/RFQs/solicitations where the scope matches Bluhon's services.

**Two sources per run:**

**Source A — Pre-scraped portal data**: 7 portal scrapers run in parallel at startup and return structured opportunities. Results are injected into the Claude prompt as a pre-scraped block with `[via:portalname]` labels.

**Source B — Agency bid pages**: Claude uses `web_search` to visit 60+ Bay Area agency bid pages (stored in `SEARCH_SOURCES` Airtable table, `source_type=Standalone`). Falls back to hardcoded `STANDALONE_PAGES` array in JS if Airtable returns 0 records.

**Output format**: HTML `<table>` saved to `track1_html` in `DAILY_REPORTS`. Columns: Agency | Solicitation # | Project/Scope | Due Date | Type | Source URL.

**Persistent quality problem**: Claude's web_search interprets page content and frequently returns expired RFPs, project pages without solicitation numbers, meeting notices, and other non-RFP content. Two mitigation layers exist but are imperfect:
1. `stripExpiredTrack1Rows(html)` — strips any `<tr>` containing a date before today
2. `parseTrack1Opps(html, reportDate)` — re-filters parsed rows; drops any with a deadline before today

**Portal scrapers (run in parallel via `Promise.all`):**

| Scraper | Site | Auth |
|---|---|---|
| `scrapeFindrfp()` | findrfp.com | Authenticated — ASP.NET form login |
| `scrapeOpengov()` | procurement.opengov.com | Authenticated |
| `scrapeBonfire()` | gobonfire.com | Authenticated — multiple Bay Area subdomains |
| `scrapePlanetbids()` | vendorline.planetbids.com | Authenticated — login OK, returns portal URLs to Claude |
| `scrapeBiddingusa()` | biddingousa.com | Authenticated — Santa Clara County, San Jose |
| `scrapeBidnet()` | bidnetdirect.com | Authenticated — Fremont, Livermore, Pleasant Hill, Novato, Tiburon, Santa Clara city, Mountain View |
| `scrapeCivicengage()` | /Bids.aspx pattern | Public — 26 Bay Area cities |

All scrapers are currently returning 0 or near-0 results. Root causes: auth flow failures, HTML structure mismatches, or portal API changes. The portal scraping pipeline is the highest-value item to fix for Track 1 reliability.

**Standalone agency pages (Source B) — stored in SEARCH_SOURCES, `source_type=Standalone`:**
Port of Oakland, Port of SF, BART, AC Transit, Caltrain, VTA, SMART, Golden Gate Transit, SamTrans, SFMTA, MTC/ABAG, BCDC, BAAQMD, EBRPD, MROSD, SFPUC, EBMUD, Valley Water (vendors.planetbids.com/portal/48397/bo/bo-search), Sonoma Water, Marin MWD, Zone 7 (zone7waterca.gov/construction-business-opportunities), Pleasant Hill (vendors.planetbids.com/portal/80113/bo/bo-search), all 9 Bay Area counties + SF, and ~30 cities.

### Track 2 — Emerging Issues & Local Conflicts

Pre-fetched Bay Area news via RSS aggregator (`fetchAllNewsItems()`). Items are scored by relevance, deduplicated against `TRACK2_ITEMS` (7-day lookback), and the top-scored items are passed to Claude for analysis.

Claude identifies local conflicts, CEQA disputes, facility siting controversies, etc. that signal future Bluhon opportunities. Output grouped under `<h2>` headings: Local News | Regional News | Agency Board | County Board | City Board.

Each article in the frontend has a **"→ Save to Pipeline"** button.

**RSS sources (all fetched in parallel):**
- 24 Google News queries (topic + geography combinations)
- 21 direct feeds: Berkeleyside, Oaklandside, Mission Local, Marin Post, SJ Spotlight, Richmond Standard, East County Today, Marin IJ, Palo Alto Weekly, Mountain View Voice, Half Moon Bay Review, San Mateo Daily Journal, Press Democrat, Napa Valley Register, East Bay Times, Mercury News, SF Examiner, Novato Advance, Sacramento Bee, Planetizen, ENR

Google News URLs are resolved from redirect URLs to real article URLs via `resolveGoogleNewsUrl()`.

### Track 3 — Prime Firm Activity

Contract awards, firm moves, and teaming intelligence for ~16 prime firms (AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Arup, Fehr & Peers, Kimley-Horn, GHD, EPS Group, Atkins, Burns & McDonnell, ARCADIS, Dudek).

Firm list is read from `SEARCH_SOURCES` table (`source_type=Prime Firm`) at runtime; falls back to hardcoded list.

Each article has a **"→ Save to Pipeline"** button.

### Track 4 — Competitor Activity / Governing Body Pipeline

**Note**: The system prompt labels this "Competitor Activity" but the original intent included governing body pre-RFP signals. Current Track 4 searches for competitor firm activity (MIG, PlaceWorks, Circlepoint, Raimi+Associates, Rincon, Mintier Harnish, Dyett & Bhatia, etc.) from `SEARCH_SOURCES` (`source_type=Competitor`), with fallback to hardcoded list.

Flags ⭐ when RFP authorization was granted.

---

## Claude API Architecture

Two sequential API calls per MORS run (to manage context size):

**Call 1** — Tracks 1 + 2. Prompt includes:
- `SYSTEM_PROMPT` (full Bluhon MRD — ~300 lines covering services, geography, keywords, viability criteria, output format)
- `PROJECT_MEMORY` CRITICAL patterns injected dynamically
- Pre-scraped portal opps block (Source A)
- 60+ agency bid page URLs (Source B)
- Pre-fetched RSS news items (for Track 2)
- Geographic focus for the day
- Solicitation filter rules

**Call 2** — Tracks 3 + 4. Prompt includes:
- Today's date + prime firm / competitor lists
- Pre-fetched Track 3 RSS items (ENR, Planetizen)
- Governing body agenda URLs
- Track 4 instructions

Claude model: `claude-sonnet-4-6`
Tool: `web_search_20250305` with `max_uses: 40`

**Output delimiter format** (required, all six delimiters must be present):
```
---TRACK1_START--- ... ---TRACK1_END---
---TRACK2_START--- ... ---TRACK2_END---
---TRACK3_START--- ... ---TRACK3_END---
---TRACK4_START--- ... ---TRACK4_END---
---OPPORTUNITIES_JSON_START--- ... ---OPPORTUNITIES_JSON_END---
```

The JSON block contains one object per Track 1 row with fields: `title`, `agency`, `deadline` (YYYY-MM-DD or null), `track`, `scope`, `source_url`, `pursuit_type` (Prime / Sub/Team), `prior_client` (bool), `geo_tier`.

---

## RSS Relevance Scoring

Items scored before passing to Claude. Top 60 items passed to Track 2; `when:3d` appended to all Google News queries (72-hour freshness filter).

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

`BAY_AREA_TERMS`: ~100 places covering all 9 counties and major cities (hardcoded in JS).

Keywords also stored in `RELEVANCE_KEYWORDS` Airtable table and read at runtime. Airtable values take precedence over hardcoded if any records exist.

---

## Duplicate Detection

```javascript
normalizeTitle(title)  // lowercases, strips stop words (rfp, rfq, for, the, of, a, an, and, to, in, at, by, with, services, consulting, professional) and punctuation
titlesMatch(a, b)      // exact match OR 70%+ word overlap on words >3 chars
fetchExistingOppTitles(cutoffStr)  // pulls last 45 days from OPPORTUNITIES via Airtable
isDuplicate(title)     // checks cross-run (Airtable) + within-run (seenTitles Set)
```

`POSTED_CUTOFF_DAYS = 45` — used in portal scraper search queries and the Claude prompt date filter.

---

## PROJECT_MEMORY Learning Loop

When Track 1 RFPs are reviewed in the frontend:
- "Reject" → writes a `CRITICAL:` pattern to `PROJECT_MEMORY` table
- "Pipeline" → also logs a pattern

At run time, all patterns are fetched and injected into the Claude system prompt under `QUALITY RULES LEARNED FROM USER FEEDBACK`. `CRITICAL:` patterns are injected first and most prominently.

---

## Geographic Rotation

`getGeoFocus()` returns a `{ label, instructions }` object keyed to day of week (PT timezone):
- Mon: SF + Marin + Sonoma
- Tue: Alameda + Contra Costa
- Wed: Santa Clara + San Mateo
- Thu: Napa + Solano + all special districts
- Fri: Full Bay Area sweep + Tier 2/3

---

## Prior Clients (hardcoded in prompt)

Flagged with ✅ in all report output. List includes:
ABAG, BCDC, SF Regional Water Quality Control Board, South Bay Water Recycling, U.S. EPA, Cities of Berkeley (City Manager + Parks), Half Moon Bay, Livermore, Novato, Oakland, Palo Alto, Placerville, Redwood City, San José, San Mateo, Town of Danville, Alameda County (CDA), Contra Costa County (DCD + Public Works + Supervisor Gioia), Marin County (County Executive), Santa Clara County (County Executive), Sonoma County (Supervisor Hopkins), Kaiser Permanente, Trust for Public Land, SF Bay Area Ridge Trail Council, UC Berkeley, Center for Eco-Literacy, Rosie the Riveter Trust, Spanish Speaking Unity Council, Planning & Conservation League, AIA Redwood Empire.

---

## Frontend Architecture (`public/index.html`)

Single HTML file, login-gated (checks `USERS` Airtable table).

**Pages/tabs:** Today's Report | Active Pipeline | Canvas | Contacts

**Key frontend functions:**

| Function | Purpose |
|---|---|
| `renderReport()` | Fetches latest DAILY_REPORTS record, renders all 4 tracks |
| `parseTrack1Html(html)` | Parses Claude's HTML `<table>` into card format with Pipeline/Reject buttons |
| `loadProspects()` | **DISABLED** — was overwriting track1_html content; Track 1 now renders from `track1_html` in DAILY_REPORTS |
| `formatTrackItems(html, track)` | Parses Tracks 2/3 HTML list items, adds "→ Save to Pipeline" button |
| `triggerManualRun()` | POSTs to `/run` (fire-and-forget), fast-polls every 15s, auto-loads when new report detected |
| `startReportPolling()` | Auto-polls every 90s; shows slide-up toast if newer report exists |
| `renderPipeline(opps)` | Renders OPPORTUNITIES (interest=Yes) as a table |
| `deleteOpportunity(id, btn)` | DELETEs from Airtable + removes DOM row instantly |
| `saveArticleToPipeline(title, url, summary, track, btn)` | Saves Track 2/3 article to OPPORTUNITIES, creates Canvas |
| `createCanvas(oppId)` | Creates `RFP_CANVAS` record pre-populated from opportunity |
| `openCanvas(canvasId)` | Opens canvas detail view |

**Report navigation**: Forward/backward date buttons at top of report view to browse historical reports by `report_date`.

**Auto-poll toast**: slides up from bottom — "New report ready — [Load it] ×"

**Timestamps**: each track header shows "Refreshed Jun 10, 2026, 9:35 AM PDT" from `run_timestamp`.

---

## Express Routes

| Route | Method | Description |
|---|---|---|
| `/run` | POST | Fire-and-forget: starts `runMORSReport()`, responds `{success:true,status:'started'}` immediately |
| `/test-run` | POST | Abbreviated run — SF/Marin/Oakland only, Tracks 1+2 only, useful for debugging |
| `/latest-report` | GET | Returns most recent DAILY_REPORTS record |
| `/setup-airtable` | POST | One-time: creates `RFP_SEARCH_QUERIES` + `RELEVANCE_KEYWORDS` tables via Metadata API, seeds all hardcoded data |
| `/seed-standalone-sources` | POST | Seeds `STANDALONE_PAGES` JS array into `SEARCH_SOURCES` Airtable (skips existing names) |
| `/seed-media` | GET | Seeds hardcoded `HARDCODED_MEDIA` list into `MEDIA_SOURCES` Airtable |
| `/feedback` | POST | Writes user feedback (Pipeline/Reject) to `PROJECT_MEMORY` |
| `/upload` | POST | Multer file upload → writes to `/tmp/mors-files/`, served at `/files/` |
| `/config` | GET | Debug: returns AIRTABLE_TOKEN and base ID (should be disabled in production) |
| `/health` | GET | Returns `{status:'ok'}` |
| Static | — | Serves `/public/` |

**Cron**: `"30 9 * * 1-5"` → 9:30am PT Mon–Fri

---

## Environment Variables (set in Render dashboard)

```
ANTHROPIC_API_KEY             ✅ set
AIRTABLE_TOKEN                ✅ set
FINDRFP_LOGIN                 ✅ set
FINDRFP_PASSWORD              ✅ set
OPENGOV_LOGIN                 ✅ set
OPENGOV_PASSWORD              ✅ set
BONFIRE_LOGIN                 ✅ set
BONFIRE_PASSWORD              ✅ set
PLANETBIDS_LOGIN              ✅ set
PLANETBIDS_PASSWORD           ✅ set
BIDDINGUSA_LOGIN              ✅ set  (also reads BIDDINGOUSA_LOGIN)
BIDDINGUSA_PASSWORD           ✅ set  (also reads BIDDINGOUSA_PASSWORD)
BIDNET_LOGIN                  ⬜ account pending
BIDNET_PASSWORD               ⬜ account pending
CIVICENGAGE_LOGIN             ⬜ not needed — public pages work without auth
CIVICENGAGE_PASSWORD          ⬜ not needed
```

---

## Airtable Helper Functions

```javascript
atPost(tableId, fields)         // POST — creates record. typecast:true required for Single Select fields.
atGet(tableId, params)          // GET — params is query string (e.g. ?filterByFormula=...)
atPatch(tableId, recordId, fields) // PATCH — updates existing record
```

All three throw on non-2xx responses.

---

## Known Issues & Unresolved Problems

### 1. Track 1 Reliability — CRITICAL, UNRESOLVED

**Problem**: Track 1 consistently returns expired RFPs, project pages without solicitation numbers, meeting notices, community gardens, fire department pages, and other non-RFP content. This has persisted across multiple fix attempts.

**Root cause**: Claude's `web_search` tool visits pages and uses AI interpretation to identify RFPs. This is fundamentally unreliable — Claude confuses archived solicitations for current ones, ignores date instructions, and misidentifies project descriptions as solicitations.

**Mitigations in place** (partial, imperfect):
- `stripExpiredTrack1Rows(html)` — strips `<tr>` elements where any date found in cell text is before today
- `parseTrack1Opps(html)` — secondary filter; drops rows where parsed deadline < today
- Prompt includes: `ABSOLUTE RULE: If the deadline year is 2024 or earlier... DO NOT INCLUDE IT`
- Prompt includes: `CRITICAL SOLICITATION FILTER` with strict web-search verification rules

**What would actually fix it**: Reliable authenticated portal scrapers returning structured data. All 7 scrapers currently return 0 or near-0. The most valuable fix is getting FindRFP, BidNet, and/or PlanetBids returning real results. These are authenticated scrapers — auth flows may have changed.

### 2. Portal Scrapers All Returning 0

All 7 portal scrapers return 0 results or near-0. Known issues:
- `scrapeFindrfp()` — ASP.NET form login may be failing silently (status 302 doesn't guarantee auth success)
- `scrapePlanetbids()` — login succeeds but portal API removed; now just passes URLs to Claude
- `scrapeBidnet()` — no credentials yet
- Others — unknown, need live debugging

### 3. `/config` Route Exposes Token

`app.get("/config", ...)` returns `AIRTABLE_TOKEN` and `base_id` to any HTTP client. Should be removed or protected.

### 4. Standalone Page URLs — Some Unverified

~60 agency URLs in `SEARCH_SOURCES`. Some are pattern-guessed. Live runs log `[Standalone]` warnings for 404s — those need correction directly in Airtable (no code change required).

### 5. `loadProspects()` Disabled

Frontend function is disabled with `return;` at top. It was overwriting `track1_html`-rendered content with stale OPPORTUNITIES records. If Track 1 display ever needs to be re-wired to the OPPORTUNITIES table, this needs to be re-enabled carefully.

---

## What's Built and Working

- ✅ Full four-track daily report generation via two Claude API calls
- ✅ RSS aggregator (24 Google News queries + 21 direct feeds) with relevance scoring and URL resolution
- ✅ 7 portal scrapers wired up and running (auth works, results sparse)
- ✅ 60 standalone agency bid page URLs in SEARCH_SOURCES Airtable — read at runtime
- ✅ Duplicate detection (within-run + 45-day cross-run)
- ✅ PROJECT_MEMORY learning loop (feedback → CRITICAL patterns → injected into prompt)
- ✅ Fire-and-forget `/run` with frontend fast-polling + auto-load
- ✅ Auto-poll every 90s with toast notification
- ✅ All four tracks rendering in frontend with timestamps
- ✅ Track 1 rendered from `track1_html` in DAILY_REPORTS (not OPPORTUNITIES table)
- ✅ `parseTrack1Html()` converts Claude's table into card format with Pipeline/Reject buttons
- ✅ `stripExpiredTrack1Rows()` code-level expired row filter
- ✅ "→ Save to Pipeline" button on every Track 2 and Track 3 article
- ✅ Active Pipeline page with Canvas button + delete button
- ✅ Historical report navigation (forward/backward date buttons)
- ✅ RFP Canvas creation pre-populated from opportunity fields
- ✅ File upload (`/upload`) → served at `/files/`
- ✅ MEDIA_SOURCES seeded with 73 Bay Area outlets
- ✅ Search queries, relevance keywords, firm names, and agency URLs stored in Airtable
- ✅ Geographic rotation (Mon–Fri zones)
- ✅ Prior client flagging (~30 warm accounts, ✅ flag in output)
- ✅ `/setup-airtable` one-time endpoint for table creation + seeding

---

## What's Pending

### High Priority
- **Fix portal scrapers** — FindRFP, BidNet, PlanetBids returning 0; this is the only real fix for Track 1 reliability
- **BidNet account** — user getting account; add `BIDNET_LOGIN`/`BIDNET_PASSWORD` to Render when ready
- **Remove or protect `/config` route** — exposes AIRTABLE_TOKEN

### Medium Priority
- **Per-track refresh buttons** — separate endpoints to re-run individual tracks
- **Pipeline page** — full canvas workflow, edit fields inline
- **Contacts page** — search + edit functionality

### Lower Priority
- **Verify remaining standalone URLs** — check for 404s in Render logs and correct directly in SEARCH_SOURCES Airtable
- **Mobile polish**
- **Canvas → proposal workflow**

---

## How to Run Locally

```bash
cd mors-runner
npm install
# Copy env vars from Render dashboard into .env or export them:
export ANTHROPIC_API_KEY=...
export AIRTABLE_TOKEN=...
# (etc.)
node mor_runner.js
# Open http://localhost:3000
```

---

## Recent Git History

```
31a19d0  Restore exact original card/table format for Track 1 parsed from track1_html
         (parseTrack1Html, loadProspects disabled, report_date on opps)
         Add stripExpiredTrack1Rows filter
         Fix PlanetBids to pass portal URLs to Claude instead of direct API calls
         Fix standaloneOpps ReferenceError (removed stale reference at line 2194)
         Add report_date navigation (forward/backward date buttons in frontend)
         Add /setup-airtable endpoint — creates RFP_SEARCH_QUERIES + RELEVANCE_KEYWORDS tables
         Seed 60 agency URLs to SEARCH_SOURCES; system reads from Airtable at runtime
         Add typecast:true to atPost() — fixes Airtable 422 on Single Select fields
         Save to Pipeline buttons — Track 2/3 articles
         Pipeline width + trash button
         Add timestamp to track headers
         Wire BiddingUSA/BidNet/CivicEngage scrapers + 55 standalone agencies
         Update PlanetBids scraper to vendorline.planetbids.com
```
