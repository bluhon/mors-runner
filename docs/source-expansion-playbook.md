# Source Expansion Playbook

Last updated: 2026-06-10

## Purpose

MORS needs to grow from the first Bay Area source list into a California-wide source registry without losing quality. The goal is not to collect every possible web page. The goal is to collect the official procurement and pre-RFP signal sources that can produce Bluhon-relevant opportunities.

## Scale

Useful public-sector source universe:

- California counties: 58
- California cities: roughly 480+
- Independent special districts: roughly 2,000
- Additional statewide/regional bodies: state agencies, conservancies, commissions, councils of governments, JPAs, transit agencies, water agencies, air districts, ports, and LAFCOs

MORS should not try to ingest all of this at once. The practical target is the next 200-300 high-yield sources.

Reference starting points:

- CSAC counties page: `https://www.counties.org/counties/`
- Cal Cities website: `https://www.calcities.org/`
- CSDA special districts page: `https://www.csda.net/about-special-districts/learn-about`
- Cal eProcure: `https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx`

## Expansion Principles

1. Prioritize likely Bluhon fit over population alone.
2. Prefer official procurement portals and original agency pages.
3. Save the actual procurement URL, not the generic agency home page.
4. If an agency page redirects to OpenGov, PlanetBids, BidNet, Bonfire, Cal eProcure, or another aggregator, store the aggregator URL that actually lists opportunities.
5. Only mark a source as parser-ready after one real listing/detail page has been tested.
6. Keep agenda/news/issue sources separate from Track 1 procurement sources.

## Phases

### Phase 1: Bay Area Source Registry Cleanup

Goal: finish ground-truthing the current 80-90 Tier 1 sources.

Work:

- Correct source URLs.
- Classify `description`, `source_type`, `portal_type`, and `parser_strategy`.
- Set booleans for public readability, status, due date, detail-page scope, and CSV export.
- Fix obvious typos in source names.
- Identify parser families represented in the current list.

Done when:

- Every active source has a working procurement URL and parser strategy.
- Every source can be routed to a parser or `manual_review`.

### Phase 2: California Statewide Procurement Coverage

Goal: cover state-level sources that generate planning, transportation, trails, environmental, community engagement, governance, facilitation, and outreach RFPs.

Priority sources:

- Cal eProcure / FI$Cal
- Caltrans procurement and district-specific opportunities
- Department of Parks and Recreation
- Strategic Growth Council
- Coastal Commission
- State Coastal Conservancy
- Delta Conservancy
- Wildlife Conservation Board
- Department of Water Resources
- CalEPA boards/departments where procurement is public
- Housing and Community Development
- California Air Resources Board

Done when:

- Cal eProcure has a working parser or semi-automated candidate extractor.
- State agency-specific sources are recorded when they publish outside Cal eProcure.

### Phase 3: Large Non-Bay-Area Cities and Counties

Goal: add high-probability Tier 2/3 local agencies without boiling the ocean.

Priority geography:

- Sacramento region
- Monterey/Santa Cruz/San Benito/San Luis Obispo/Santa Barbara/Ventura coast
- Los Angeles County and major cities
- Orange County and major cities
- San Diego County and major cities
- Inland Empire cities/counties with transportation, housing, environmental, and community engagement needs

Target source count: 75-125.

Done when:

- Each target county and major city has one procurement source.
- Major portal/platform patterns are classified.

### Phase 4: Special Districts and JPAs

Goal: add agencies whose work naturally fits Bluhon.

Priority agency types:

- Transit agencies
- Councils of governments / regional planning agencies
- Transportation authorities
- Water districts and water agencies
- Open space, parks, and conservation districts
- Air districts
- Ports and harbors
- Flood control and stormwater agencies
- Community choice aggregators
- LAFCOs
- Resource conservation districts
- Groundwater sustainability agencies

Target source count: 75-125.

Done when:

- Each source has a procurement page or a board/agenda source.
- Track 1 procurement sources are separated from Track 4 agenda sources.

### Phase 5: Parser Coverage and Monitoring

Goal: reduce manual review and make results defensible.

Parser priority:

1. OpenGov
2. Cal eProcure
3. PlanetBids
4. BidNet
5. Bonfire
6. CivicEngage
7. PeopleSoft/eSupplier
8. Planroom
9. Custom HTML

Done when:

- Each parser returns normalized records.
- Every Track 1 candidate has a validation outcome.
- Expired and non-solicitation items are logged with reject reasons.

## Ground-Truth Checklist

For each source, fill these fields:

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
- `notes`
- `last_verified`
- `active`

## Search Templates

Use these when discovering new procurement URLs:

- `"AGENCY NAME" RFP`
- `"AGENCY NAME" RFQ`
- `"AGENCY NAME" "request for proposals"`
- `"AGENCY NAME" "bid opportunities"`
- `"AGENCY NAME" procurement`
- `"AGENCY NAME" "contract opportunities"`
- `"AGENCY NAME" "vendor portal"`
- `"AGENCY NAME" site:procurement.opengov.com`
- `"AGENCY NAME" site:vendors.planetbids.com`
- `"AGENCY NAME" site:bidnetdirect.com`
- `"AGENCY NAME" site:gobonfire.com`

## What Not To Add As Track 1

Do not classify these as Track 1 procurement sources unless they contain actual current solicitations:

- Project announcement pages
- Capital improvement project pages
- News releases
- Planning initiative pages
- General department pages
- Meeting agendas
- Consultant/firm blog posts
- Static PDF pages with no current procurement listings

These may still be useful for Tracks 2, 3, or 4.
