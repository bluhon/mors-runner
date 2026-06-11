# MORS System Documentation

Last updated: 2026-06-11

## 1. Purpose

MORS is Bluhon's daily market intelligence and opportunity monitoring system.

Its core job is simple:

1. Search the trusted source list.
2. Match the configured search terms and relevance keywords.
3. Create a daily report.
4. Publish that report to the live MORS web page for review.

MORS is designed for Bluhon's public agency consulting practice, especially work involving public engagement, facilitation, consensus building, strategic planning, environmental conflict resolution, community outreach, governance, planning, parks, trails, transportation, housing, water, climate, and related public-sector services.

The system is not intended to be a generic web-search bot. Track 1 procurement results should come from official agency procurement pages, public procurement portals, or official solicitation documents. Search engines and third-party aggregators may help discover sources, but they should not be trusted as the final authority for whether an item is a real opportunity.

## 2. Operating Model

MORS uses four reporting tracks.

### Track 1: Active RFPs

Purpose: find currently open solicitations that Bluhon may pursue directly or through a prime firm.

Track 1 should return only real procurement opportunities, such as:

- RFP
- RFQ
- RFQual
- SOQ
- RFS
- Professional services solicitations
- Consultant pools
- On-call consultant opportunities
- Planning, facilitation, engagement, outreach, governance, trails, parks, water, transportation, and environmental consulting opportunities

Track 1 should not return:

- General agency web pages
- News announcements
- Program pages
- Meeting pages
- Resident application forms
- Expired solicitations
- Construction-only work with no Bluhon-relevant scope
- Generic public works bid listings that do not match the keyword/relevance criteria
- Third-party aggregator results that are not tied back to an official source or trusted procurement portal

The validation expectation is:

1. The source is active in Airtable.
2. The item is a real solicitation or procurement document.
3. The due date is present and in the future when available.
4. The title or description matches active Airtable search terms/relevance keywords.
5. The opportunity is relevant enough to Bluhon's work to appear in the review report.

### Track 2: Emerging Issues

Purpose: identify public issues, controversies, agency decisions, community disputes, policy debates, or upcoming projects that may lead to advisory, facilitation, outreach, mediation, planning, or strategic consulting work.

Track 2 is not limited to formal RFPs. It is intended to surface early signals, such as:

- Community opposition around public projects
- City or county policy conflicts
- Environmental review disputes
- Infrastructure, parks, trails, water, housing, climate, and transportation controversies
- Public engagement problems
- Board or council direction that suggests a future consulting need
- Community groups or agencies struggling with process, consensus, or outreach

Method:

- MORS pulls from Google News RSS queries and direct RSS feeds.
- Direct feeds include local and regional outlets configured in code and/or Airtable `MEDIA_SOURCES`.
- Items are deduplicated by URL.
- Items are filtered for freshness, currently focused on recent items.
- Items are relevance-scored against Bluhon keywords.
- OpenAI summarizes the strongest items into Track 2 narrative output when `OPENAI_API_KEY` is configured.
- Parsed Track 2 items are also saved into the Airtable Track 2 table for review and optional conversion into canvases.

Track 2 feeds are intended to answer: "What is happening in the public-sector environment that Bluhon should know about before it becomes an RFP?"

### Track 3: Prime Firm and Competitor Activity

Purpose: monitor firms that may become prime partners, teaming targets, competitors, or market signals.

Track 3 watches for:

- Contract awards to large prime firms
- New planning, environmental, engineering, transportation, parks, water, or infrastructure wins
- Firm press releases
- Relevant business journal or industry news
- Competitor wins or positioning
- New practice areas or hiring that indicate where firms are investing
- Public engagement sub-scope opportunities where Bluhon could team

Method:

- MORS collects pre-fetched news items tagged for Track 3.
- It uses Airtable-managed firm sources where available.
- It maintains lists of prime firms and competitors from Airtable or fallback defaults in code.
- OpenAI summarizes relevant firm activity into Track 3 when `OPENAI_API_KEY` is configured.

Track 3 feeds are intended to answer: "Which firms are winning, moving, teaming, or signaling upcoming work where Bluhon should pay attention?"

### Track 4: Governing Body Pipeline

Purpose: identify pre-RFP signals from boards, councils, commissions, and public agency governing bodies.

Track 4 is a forward-looking pipeline. It looks for public actions that may become formal solicitations in the next 3 to 18 months.

Signals include:

- Authorization to issue an RFP
- Approval of a study, assessment, master plan, strategic plan, or outreach process
- Budget allocation for consultant-supported work
- Direction to begin community engagement
- CEQA/EIR or environmental review authorization
- Grant funding that will require public process or consultant support
- Advisory committee or task force formation

Method:

- MORS uses Track 4 media/source records such as agency boards, county boards, city councils, and commissions.
- OpenAI is prompted to look for recent agenda/minute items and classify them by board type.
- Output is grouped under agency board, county board, and city board categories.

Track 4 feeds are intended to answer: "What public actions are happening now that could become procurement opportunities later?"

## 3. Main Product Features

### Today's Report

The public MORS page shows the latest daily report with date navigation.

Track 1 renders as a reviewable opportunity list with:

- Agency
- Opportunity title
- Short scope/description
- Source link
- Due date
- Pipeline button
- Reject button

Tracks 2, 3, and 4 render as issue, firm, and pipeline intelligence sections.

### Manual Runner

The web app can trigger a manual report run using the `/run` endpoint.

The backend responds immediately, then the frontend polls `/run-status` until the run completes. This prevents the browser from hanging while the report is generated.

### Pipeline

The Pipeline view stores and reviews opportunities that have been moved forward from the report.

### RFP Canvases

Canvases are working spaces for a specific RFP or opportunity. They support proposal review, files, teaming notes, and pursuit planning.

### Contacts and Lightweight CRM

MORS is intended to grow into a Bluhon contact and relationship database.

The contact system should support:

- Organizations
- People
- Departments
- Agency contacts
- Prime firms
- Partner/subconsultant firms
- Relationship to Bluhon
- Proposal canvases involving an agency, prime, and collaborating firms

Some records will be organization-only when no individual contact is known.

### Prime Firms

The Prime Firms view tracks potential teaming partners and competitors. It supports firm records, key contacts, sector focus, geography, recent wins, and teaming notes.

### Project Memory

Project Memory stores learning signals, feedback, exclusions, and patterns. It is intended to help MORS improve relevance over time.

### Search Settings

Search Settings manages the source lists and search inputs:

- Standalone bid pages
- News sources
- Firms to monitor
- Exclusions
- Keywords and search terms through Airtable

## 4. Data Model

MORS uses Airtable as its operational database.

Current key Airtable tables:

- `DAILY_REPORTS`: stores daily report HTML sections and timestamps.
- `OPPORTUNITIES`: stores individual Track 1 opportunities and pipeline-ready records.
- `TRACK2`: stores parsed Track 2 issue items.
- `PROJECT_MEMORY`: stores feedback, exclusions, and learning notes.
- `SEARCH_SOURCES`: source registry for procurement and official search sources.
- `MEDIA_SOURCES`: RSS feeds, news sources, firm sources, and governing body sources.
- `RFP_SEARCH_QUERIES`: configured search query phrases.
- `RELEVANCE_KEYWORDS`: keyword and phrase list with weights and active flags.

Important `SEARCH_SOURCES` fields:

- `source_name`
- `description`
- `url`
- `source_type`
- `portal_type`
- `parser_strategy`
- `publicly_readable`
- `shows_active_status`
- `shows_due_date_in_listing`
- `must_click_detail_for_scope`
- `has_export_csv`
- `geo_tier`
- `county`
- `region`
- `discovery_status`
- `source_confidence`
- `discovery_query`
- `active`

Operational rule:

- `active` checked means MORS may use the source in live runs.
- `active` unchecked means the source is a candidate or unverified record.

## 5. Search Source Architecture

MORS uses `SEARCH_SOURCES` as the source registry.

The preferred Track 1 path is:

1. Load active sources from Airtable.
2. Route each source by platform/parser family.
3. Extract normalized candidate opportunities.
4. Apply deterministic gates.
5. Apply keyword/relevance matching.
6. Save clean Track 1 report data.
7. Render on the public page.

Parser families include:

- OpenGov
- PlanetBids
- BidNet
- Bonfire
- BiddingUSA/Biddingo
- CivicEngage
- Cal eProcure
- PeopleSoft/eSupplier
- Planroom sites
- Custom/direct agency HTML pages

The source registry should store the actual procurement URL, not a generic agency home page. If an agency page redirects to OpenGov, PlanetBids, BidNet, Bonfire, or another portal, the registry should store the actual portal page that lists opportunities.

## 6. Track 1 Validation and Rendering

The current runner creates deterministic Track 1 report records as clean HTML articles:

```html
<div class="mors-track1-data">
  <article class="mors-track1-opportunity" ...>
    ...
  </article>
</div>
```

The frontend parses those structured articles and renders the visual report layout. This replaced older raw table HTML such as `<table border="1">`.

The current validation intent is:

- Do not trust a page merely because it contains a keyword.
- Do not render page-navigation gibberish as descriptions.
- Require a real solicitation signal.
- Require a due date when the candidate comes from broad keyword page scanning.
- Drop expired opportunities.
- Drop weak or unrelated bids even if they contain a generic word.

## 7. Track 2, 3, and 4 Feed Method

Tracks 2, 3, and 4 are intelligence feeds, not strict procurement scrapers.

### Input Sources

Track 2 uses:

- Google News RSS topic and geography queries.
- Direct RSS feeds from local/regional outlets.
- Airtable-managed `MEDIA_SOURCES` where configured.

Track 3 uses:

- Firm and industry news sources.
- Prime firm and competitor lists from Airtable.
- Fallback firm lists in code when Airtable is empty.
- Relevant pre-fetched news items.

Track 4 uses:

- Governing body and agency-board sources.
- County board and city council sources.
- Agenda/minute pages listed in `MEDIA_SOURCES`.

### Processing Steps

1. Fetch RSS/news/source items.
2. Deduplicate by URL.
3. Filter for recency.
4. Score for Bluhon relevance.
5. Format the highest-value items for OpenAI summarization.
6. Save the summarized HTML into the daily report.
7. Save parsed Track 2 items into the Track 2 Airtable table for follow-up.

### Current Dependency

Tracks 2, 3, and 4 require `OPENAI_API_KEY` in the Render environment for AI-written summaries. If the key is missing, MORS still saves a report, but Tracks 2-4 fall back to placeholder sections.

Track 1 deterministic extraction can still run without OpenAI.

## 8. Backend Stack

Runtime:

- Node.js, ESM modules
- Express web server
- `node-cron` scheduler
- `multer` for file uploads
- Airtable REST API
- OpenAI Responses API when `OPENAI_API_KEY` is configured

Main backend file:

- `mor_runner.js`

Key routes:

- `GET /health`: health check.
- `GET /run-status`: current manual-run state.
- `POST /run`: trigger a manual report run.
- `POST /seed-standalone-sources`: legacy/source seed helper.
- `POST /setup-airtable`: setup/seed helper.
- `POST /upload`: upload files to temporary storage.
- `GET /files/...`: serve uploaded files from `/tmp/mors-files`.
- `GET /config`: current frontend config route.

Scheduled run:

- Weekdays at 9:30am Pacific Time.

Manual run:

- Triggered from the public app through `/run`.

## 9. Frontend Stack

Frontend files:

- `public/index.html`
- `public/mors.css`

The frontend is currently a single-page app served by Express. It uses browser-side JavaScript to:

- Load daily reports from Airtable.
- Render report tracks.
- Trigger the manual runner.
- Poll run status.
- Move items to pipeline.
- Reject/exclude items.
- Manage contacts, canvases, prime firms, and search settings.

## 10. Deployment

Source control:

- GitHub repository: `bluhon/mors-runner`

Production hosting:

- Render web service

Deployment flow:

1. Code is committed locally.
2. Code is pushed to GitHub.
3. Render deploys the latest GitHub commit.
4. The live app runs `node mor_runner.js`.

Important environment variables:

- `AIRTABLE_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional, defaults to `gpt-5`
- `GOOGLE_API_KEY` optional/search support
- `GOOGLE_SEARCH_ENGINE_ID` optional/search support
- `BRAVE_SEARCH_API_KEY` optional/source discovery support
- `RENDER_API_KEY` optional/admin automation support
- `BIDDINGUSA_LOGIN`
- `BIDDINGUSA_PASSWORD`
- `BONFIRE_LOGIN`
- `BONFIRE_PASSWORD`
- `FINDRFP_EMAIL`
- `FINDRFP_PASSWORD`
- `OPENGOV_LOGIN`
- `OPENGOV_PASSWORD`
- `PLANETBIDS_LOGIN`
- `PLANETBIDS_PASSWORD`
- Any future portal credentials required for stable access

Secrets should remain in Render environment variables or the local `.env` file. They should not be committed to GitHub.

## 11. Latest Upgrades

Recent system upgrades include:

- Removed Anthropic usage from the runner.
- Moved AI-written summary work to OpenAI.
- Made deterministic Track 1 saving continue even when OpenAI is missing or fails.
- Added `/run-status` so the frontend can poll report generation progress.
- Updated the manual run flow so `/run` returns immediately and the backend completes the report asynchronously.
- Replaced raw Track 1 table output with structured `mors-track1-data` / `mors-track1-opportunity` report data.
- Updated the frontend to render Track 1 opportunities in the intended report-card style.
- Allowed Track 1-only reports to publish even when Tracks 2-4 are placeholders.
- Added public BidNet listing extraction without credentials.
- Sanitized BidNet title/scope extraction to avoid hidden tooltip text.
- Fixed Track 1 opportunity saving to avoid writing unknown Airtable fields.
- Added stricter Track 1 filtering for real solicitation signals.
- Added keyword source scanning across active source URLs.
- Added one-level detail/PDF following for likely source links.
- Tightened keyword-source matching so broad page-navigation text should not become a result.
- Required future due dates for broad keyword-source candidates.
- Added source expansion/audit scripts and source registry documentation.

## 12. Known Limitations

Track 1 is the most important and still needs the most parser hardening.

Known limitations:

- Some portals return `403` or heavily JavaScript-rendered pages from Render even though they open in a normal browser.
- OpenGov, Cal eProcure, PlanetBids, PeopleSoft, and some planroom sites need source-specific parser improvements.
- Some direct agency pages have messy HTML that requires custom extraction rules.
- Due dates may not appear on listing pages and may require detail-page extraction.
- If `OPENAI_API_KEY` is missing in Render, Tracks 2-4 will not generate rich narrative summaries.
- `/config` currently exposes Airtable config to the browser and should be replaced with safer server-side endpoints before broader production use.

## 13. Near-Term Priorities

Priority 1: Track 1 accuracy.

- Keep results constrained to active source URLs.
- Match active Airtable keywords/search terms in title or description.
- Require future due dates where possible.
- Avoid generic agency pages and irrelevant bids.
- Add parser-specific extraction for the highest-value portals.

Priority 2: Search term management.

- Ensure Airtable keywords distinguish broad concepts from exact phrases.
- Use high-weight phrases for strong relevance signals.
- Use lower-weight terms only when paired with agency type, geography, due date, and solicitation signals.

Priority 3: Platform parsers.

- OpenGov
- Cal eProcure
- PlanetBids
- BidNet
- Bonfire
- PeopleSoft/eSupplier
- Direct agency HTML

Priority 4: Report review workflow.

- Sort by relevance, geography, due date, and source confidence.
- Group results by geo tier or county.
- Show rejection reason and learning feedback.

Priority 5: Contacts and CRM.

- Build a serious Contacts database.
- Link contacts to agencies, prime firms, canvases, and opportunities.
- Support organization-only records when no person is known.

## 14. Manual Work Needed From Peter

Current useful manual work:

- Keep ground-truthing `SEARCH_SOURCES` records.
- Mark only verified sources as `active`.
- Maintain accurate source URLs.
- Add or adjust high-value keywords/search terms in Airtable.
- Add `OPENAI_API_KEY` to Render if Tracks 2-4 are not producing summaries.
- Add portal credentials when needed for stable access.

Not needed:

- Do not manually Google every city, county, and special district.
- Do not add untrusted third-party aggregators as production sources.
- Do not paste secrets into GitHub or public chat.

## 15. Engineering Commands

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

Audit report contract:

```bash
npm run audit:report
```

Audit Airtable source fields:

```bash
npm run audit:airtable
```

Inspect latest report:

```bash
npm run inspect:report
```

Discover candidate sources:

```bash
npm run discover:sources
```

## 16. Security Notes

- `.env` should stay local and ignored by Git.
- Render environment variables should hold production secrets.
- GitHub should never contain API keys, Airtable tokens, portal credentials, or Render keys.
- Any token pasted into an unsafe place should be rotated.
- The `/config` endpoint should be refactored so the browser does not receive sensitive credentials.

## 17. System Principle

MORS should be parser-first and source-first.

The durable rule is:

Trusted source URLs plus managed search terms should produce clean, current, relevant opportunities. AI may summarize and rank, but it should not be the first gatekeeper for whether an item is a real RFP.
