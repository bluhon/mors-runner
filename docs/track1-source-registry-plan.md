# Track 1 Source Registry Plan

Last updated: 2026-06-10

## Core Lesson

Track 1 cannot rely on AI search as the gatekeeper. The first gates must be deterministic:

1. Is this an actual solicitation, RFP, RFQ, RFQual, SOQ, RFS, bid, or equivalent procurement record?
2. Is the solicitation open/current?
3. Is the due date parseable and in the future?
4. Does the scope fit Bluhon's services?
5. Only after those gates should AI summarize, rank, or suggest pursuit posture.

This is the failure mode we are replacing from generic AI/web search and FindRFP-style aggregation.

The product rule: MORS can use search to discover candidate sources, but Track 1 opportunities must come from original procurement records, aggregator portal records, or official documents.

## Source Registry Role

`SEARCH_SOURCES` is the operational source registry. Each source should tell MORS how to collect, parse, and validate opportunities.

Operational convention:

- `active` unchecked means the source is a candidate that Peter has not manually tested.
- Live MORS runs only use sources where `active` is checked.
- New automated discovery records must be created with `active` unchecked.
- Use `discovery_status` to track candidate review: `needs_review`, `needs_manual_review`, `verified`, `parser_ready`, or `rejected`.

Minimum ground-truth fields:

- `source_name`
- `description` currently used as agency/source category
- `url`
- `source_type`
- `portal_type`
- `parser_strategy`
- `publicly_readable`
- `shows_active_status`
- `shows_due_date_in_listing`
- `must_click_detail_for_scope`
- `has_export_csv`
- `notes`
- `last_verified`
- `active`

Recommended future rename:

- `description` -> `agency_type` or `source_category`

Current agency/source category choices in Airtable:

- `CityCounty`
- `Special District`
- `Joint Powers Authority`
- `Regional Planning Agency`
- `State Agency`
- `State Conservancy`
- `State Commission`
- `Federal Agency`
- `City Department`
- `Regional Air District`
- `NGO`
- `City`
- `City & County`
- `County`
- `Procurement Portal`

Current source type choices in Airtable:

- `Procurement Portal`
- `Agency Procurement Page`
- `Aggregator Landing Page`
- `Planroom`
- `Agenda / Governing Body`
- `News / Issue Source`
- `Firm / Competitor Source`
- `Other`

## Parser Families

Primary parser strategies:

- `opengov`
- `planetbids`
- `bidnet`
- `bonfire`
- `civicengage`
- `planroom`
- `peoplesoft`
- `sfbid`
- `custom_html`
- `manual_review`
- `caleprocure`

`portal_type` should describe the vendor/platform. `parser_strategy` should describe the code path.

Example:

- `portal_type`: `OpenGov`
- `parser_strategy`: `opengov`

Example:

- `portal_type`: `Direct`
- `parser_strategy`: `custom_html`

## FindRFP Replacement Strategy

FindRFP appears to aggregate public solicitation sources, keyword-match them, and link through to source/detail pages. MORS should replace this by crawling the original sources directly:

- California state procurement: Cal eProcure / FI$Cal
- County/city portals: OpenGov, PlanetBids, BidNet, Bonfire, CivicEngage, planroom sites, PeopleSoft/eSupplier
- Direct agency pages: custom HTML parsers or manual-review fallback

MORS should store source links and detail links, not FindRFP member links.

Policy decision:

- FindRFP is not a production search source.
- Do not call FindRFP from the live run.
- If a FindRFP result reveals an opportunity, use it only as a clue to find and parse the original source.

## Cal eProcure Notes

Source added in Airtable:

- `source_name`: Cal eProcure
- `url`: `https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx`
- `source_type`: Procurement Portal
- `portal_type`: Cal eProcure
- `parser_strategy`: caleprocure

Initial technical findings:

- Plain `curl` returns `403`, but browser-like headers return `200`.
- The app is an InFlight/PeopleSoft portal.
- Public config includes:
  - `psfpd1`
  - PeopleSoft root: `/psp/psfpd1/SUPPLIER/ERP`
  - PeopleSoft component base: `/psc/psfpd1/SUPPLIER/ERP`
  - search component: `AUC_MANAGE_BIDS.AUC_RESP_INQ_AUC.GBL`
  - direct detail URL pattern uses `BUSINESS_UNIT` and `AUC_ID`.
- First parser path should extract result rows and event IDs, then build/follow detail URLs for fields and attachments.
- Cal eProcure blocks plain curl with `403`; requests need browser-like headers, and browser automation may be needed if the InFlight session state is required.
- Probe script added: `scripts/probe-caleprocure.mjs`.

Example FindRFP/Cal eProcure result to validate against:

- Solicitation: `74A1779`
- Title: `Connecting Communities to San Gabriel River Trail Study`
- Status: Open
- Due date: `6/16/2026 2:00 PM PST`
- Contact: Roberto Ramirez
- Attachment: `RFP_Solicitation_74A1779_5-5-26_Revisions.pdf`

This example passes the deterministic gates and is likely Bluhon-relevant.

## Google Search Reality

The configured Google Custom Search API key currently returns:

`This project does not have the access to Custom Search JSON API.`

Google's current docs state the Custom Search JSON API is closed to new customers and existing users must transition by January 1, 2027. Do not make Google Custom Search the only search dependency.

Use Google-like discovery as optional support only. The durable architecture is source registry plus direct parsers.

For source expansion, Google/Search can still be used manually or through another API provider as a discovery aide. It should find agency procurement pages and platform URLs, not be trusted to validate opportunities by itself.

## Current Code Gap

The existing runner still has old assumptions that need to be retired:

- Some older logic still references `{source_type}="Standalone"` for legacy seed/backfill paths.
- The report prompt still says Claude searches agency pages directly. That should become deterministic parser-first collection, with AI summarization after validation.
- FindRFP is removed from the live run path.

Near-term implementation order:

1. Done: source registry loader reads `source_type`, `portal_type`, `parser_strategy`, and ground-truth booleans.
2. Done: source-direct scraper output is normalized and hard-gated before the AI prompt.
3. Done: deterministic validation rejects missing due dates, expired due dates, weak/non-solicitation rows, and duplicates.
4. Next: add Cal eProcure parser/prototype.
5. Next: move each portal scraper toward richer normalized records with detail URLs and document URLs.
6. Next: add a review UI mode that can sort/group by relevance, geography, deadline, and source.

## Source Expansion

The next expansion target is 200-300 California cities, counties, JPAs, special districts, regional agencies, and state agencies.

Workflow:

1. Build/curate candidate agency lists by category.
2. Find procurement URL for each agency.
3. Classify platform/parser family.
4. Add or update `SEARCH_SOURCES`.
5. Let each parser produce normalized candidate records.
6. Apply deterministic solicitation and due-date gates.
7. Apply Bluhon relevance scoring.

Agency/source categories should govern search behavior. For example:

- City / County: procurement page plus council/agenda sources.
- Special District: procurement page plus board agendas.
- JPA / Regional Planning Agency: procurement, meeting agendas, and prime teaming signals.
- State Agency: Cal eProcure and agency-specific procurement pages.

Minimum Airtable fields to fill during manual ground-truthing:

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
- `notes` only when there is a caveat
- `last_verified`
- `active`

Do not over-collect contact fields during source ground-truthing unless the site clearly provides a procurement contact that affects access.

## Source Discovery Playbook

For each agency:

1. Search exact agency name plus `RFP`, `RFQ`, `bid`, `procurement`, `contract opportunities`, and `vendor portal`.
2. Prefer official agency pages or known procurement platform URLs.
3. If an agency page redirects to an aggregator, save the actual aggregator URL that lists opportunities.
4. Open the page and confirm it lists procurements, not just announcements or project pages.
5. Confirm whether current/open status and due dates are visible in the listing.
6. Click one plausible current item and confirm the detail page has solicitation details or documents.
7. Classify the parser strategy.
8. Add notes only for things the parser needs to know.

For California expansion, high-value buckets:

- Bay Area cities and counties
- Regional transportation and planning agencies
- Water, parks, air, waste, transit, and utility districts
- State agencies posting through Cal eProcure
- Conservancies and commissions with planning/community/environment work
- Large Southern California cities/counties with trail, mobility, housing, climate, and engagement work

## Candidate Normalized Record

Every parser should return:

- `source_name`
- `agency`
- `title`
- `solicitation_id`
- `status`
- `release_date`
- `due_date`
- `source_url`
- `detail_url`
- `document_urls`
- `contact_name`
- `contact_email`
- `scope_text`
- `raw_text`
- `parser_strategy`
- `validation_notes`

Only validated records should enter Track 1.

Validation fields computed by MORS:

- `is_solicitation`
- `is_open`
- `due_date_is_future`
- `scope_fit_score`
- `scope_fit_reasons`
- `reject_reason`

Rejected records should be logged for debugging but not saved as active opportunities.
