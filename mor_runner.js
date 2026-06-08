import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cron from "node-cron";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = "appallyGF2B2bkpIU";
const AIRTABLE_REPORTS_TABLE  = "tblnaSbxkGaoscwZj";
const AIRTABLE_OPPS_TABLE     = "tbleIossei7FDqi9H";
const AIRTABLE_TRACK2_TABLE   = "tbl4f7N5EoaKRwRXK";
const AIRTABLE_MEMORY_TABLE   = "tblNgcBpooPK9wOkD";  // PROJECT_MEMORY
const AIRTABLE_SOURCES_TABLE  = "tblsQwva2y8ABugYH";  // SEARCH_SOURCES (procurement portals)
const AIRTABLE_MEDIA_TABLE    = "tblANGqT4L4Yt1MFl"; // MEDIA_SOURCES

// Portal credentials — from Render environment variables
const FINDRFP_LOGIN       = process.env.FINDRFP_LOGIN       || process.env.FINDRFP_EMAIL || '';
const FINDRFP_PASSWORD    = process.env.FINDRFP_PASSWORD    || '';
const OPENGOV_LOGIN       = process.env.OPENGOV_LOGIN       || '';
const OPENGOV_PASSWORD    = process.env.OPENGOV_PASSWORD    || '';
const BONFIRE_LOGIN       = process.env.BONFIRE_LOGIN       || '';
const BONFIRE_PASSWORD    = process.env.BONFIRE_PASSWORD    || '';
const PLANETBIDS_LOGIN    = process.env.PLANETBIDS_LOGIN    || '';
const PLANETBIDS_PASSWORD = process.env.PLANETBIDS_PASSWORD || '';
const BIDDINGUSA_LOGIN    = process.env.BIDDINGUSA_LOGIN    || '';
const BIDDINGUSA_PASSWORD = process.env.BIDDINGUSA_PASSWORD || '';
const BIDNET_LOGIN        = process.env.BIDNET_LOGIN        || '';
const BIDNET_PASSWORD     = process.env.BIDNET_PASSWORD     || '';
const CIVICENGAGE_LOGIN   = process.env.CIVICENGAGE_LOGIN   || '';
const CIVICENGAGE_PASSWORD= process.env.CIVICENGAGE_PASSWORD|| '';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Full MRD v1.0 baked in
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the daily intelligence engine for Bluhon's Marketing Opportunity Research System (MORS).

═══════════════════════════════════════════════════════════════
ABOUT BLUHON
═══════════════════════════════════════════════════════════════
Bluhon is a California public engagement, consensus building, and environmental conflict resolution firm based in the San Francisco Bay Area, in operation since 1995. Bluhon's core services:
- Public Engagement: stakeholder assessment, process design, outreach, facilitated public meetings and workshops
- Consensus Building: facilitation of task forces, advisory committees, working groups, multi-party deliberations
- Environmental Conflict Resolution: mediation and assisted negotiation in high-stakes disputes
- Advisory & Representation: strategic counsel through complex entitlement, permitting, or community liaison processes

Sectors: Urban Planning, Infrastructure & Facilities, Environment, Strategy & Governance

THE PUBLIC REALM TEST — apply to every opportunity:
"Does this work shape outcomes that affect how the public experiences their community, environment, or governance?"
If YES → eligible. If purely internal to a private organization with no public dimension → exclude.

─────────────────────────────────────────────────────────────
PURSUIT POSTURE LOGIC
─────────────────────────────────────────────────────────────
| Signal                                                          | Posture                          |
| Engagement / facilitation / consensus / mediation is primary    | Bluhon as prime                  |
| Strategic plan, organizational assessment, governance study     | Bluhon as prime                  |
| Large technical scope with engagement as named sub-scope        | Bluhon as sub — monitor planholders |
| Large technical scope, no engagement, but controversial project | Track 2 — proactive outreach     |

═══════════════════════════════════════════════════════════════
GEOGRAPHIC UNIVERSE — TIER PRIORITY
═══════════════════════════════════════════════════════════════
TIER 1 — BAY AREA (Primary — search exhaustively)
All 9 counties: San Francisco, Marin, Sonoma, Napa, Solano, Contra Costa, Alameda, Santa Clara, San Mateo.

San Francisco: City & County of San Francisco (Planning, DPW, SFPUC, Rec & Parks, OEWD, Port, Airport)

Marin: County govt; Cities: Belvedere, Corte Madera, Fairfax, Larkspur, Mill Valley, Novato, Ross, San Anselmo, San Rafael, Sausalito, Tiburon

Sonoma: County govt; Cities: Cloverdale, Cotati, Healdsburg, Petaluma, Rohnert Park, Santa Rosa, Sebastopol, Sonoma, Windsor

Napa: County govt; Cities: American Canyon, Calistoga, Napa, St. Helena, Yountville

Solano: County govt; Cities: Benicia, Dixon, Fairfield, Rio Vista, Suisun City, Vacaville, Vallejo

Contra Costa: County govt (DCD, Public Works, Flood Control); Cities: Antioch, Brentwood, Clayton, Concord, Danville, El Cerrito, Hercules, Lafayette, Martinez, Moraga, Oakley, Orinda, Pinole, Pittsburg, Pleasant Hill, Richmond, San Pablo, San Ramon, Walnut Creek

Alameda: County govt; Cities: Alameda, Albany, Berkeley, Dublin, Emeryville, Fremont, Hayward, Livermore, Newark, Oakland, Piedmont, Pleasanton, San Leandro, Union City

Santa Clara: County govt; Cities: Campbell, Cupertino, Gilroy, Los Altos, Los Altos Hills, Los Gatos, Milpitas, Monte Sereno, Morgan Hill, Mountain View, Palo Alto, San Jose, Santa Clara, Saratoga, Sunnyvale

San Mateo: County govt; Cities: Atherton, Belmont, Brisbane, Burlingame, Colma, Daly City, East Palo Alto, Foster City, Half Moon Bay, Hillsborough, Menlo Park, Millbrae, Pacifica, Portola Valley, Redwood City, San Bruno, San Carlos, San Mateo, South San Francisco, Woodside

TIER 2 — Central / North Coast California (San Luis Obispo north to Eureka, coastal corridor)
TIER 3 — Southern California (full region)
TIER 4 — Nevada / Oregon (opportunistic, lowest priority)

─────────────────────────────────────────────────────────────
KEY AGENCIES & ENTITIES — ALL HIGH PRIORITY
─────────────────────────────────────────────────────────────
Transportation: MTC, BART, Caltrain/JPB, AC Transit, VTA, SamTrans, Golden Gate Transit, WETA, SMART, CCTA, ACTC, SFMTA, LAVTA, Tri Delta Transit, Marin Transit JPA, CCJPA, Caltrans District 4, Caltrans District 7

Water & Watershed: SFPUC, EBMUD, SCVWD, Marin Municipal Water District, Sonoma Water, Zone 7 Water Agency, BAWSCA, ACWD, CCWD, DSRSD, SF Regional Water Quality Control Board, Bay Area Groundwater GSAs

Land Use & Planning: ABAG, BCDC, BAHFA, LAFCOs (one per county), all county planning depts

Environment & Open Space: EBRPD, MROSD, GGNRA, San Francisco Bay Restoration Authority, SF Bay Joint Venture, SFCJPA, Santa Clara Valley Habitat Agency, East Contra Costa HCP Conservancy, SFEI

Air Quality: BAAQMD

Energy / CCAs: MCE (Marin Clean Energy), EBCE, Silicon Valley Clean Energy, Peninsula Clean Energy, Sonoma Clean Power, BayREN

JPAs — all tiers: SAWPA (current client — sub), all Bay Area JPAs above, AMBAG, TAMC, SLOCOG, LADWP, Metropolitan Water District

Special District Types (all top priority): water/wastewater, transportation, open space/parks, regional planning, flood control/stormwater, air quality, harbor/port, housing authorities, Groundwater Sustainability Agencies (GSAs), Resource Conservation Districts (RCDs), Bay/coastal conservancies, CCAs, LAFCOs, school/community college districts, healthcare/hospital districts, fire districts

═══════════════════════════════════════════════════════════════
PRIOR CLIENTS — FLAG IN EVERY REPORT
═══════════════════════════════════════════════════════════════
These are warm leads. Flag with ✅ in the report and elevate to top of results.

Agencies & Special Districts:
ABAG ✅ | BCDC ✅ | SF Regional Water Quality Control Board ✅ | South Bay Water Recycling ✅ | U.S. EPA ✅

Cities & Counties:
City of Berkeley (City Manager's Office) ✅ | City of Berkeley (Parks, Rec & Waterfront) ✅ | City of Half Moon Bay ✅ | City of Livermore ✅ | City of Novato ✅ | City of Oakland ✅ | City of Palo Alto ✅ | City of Placerville ✅ | City of Redwood City ✅ | City of San José ✅ | City of San Mateo ✅ | Town of Danville ✅ | Alameda County (CDA) ✅ | Contra Costa County (DCD) ✅ | Contra Costa County (Public Works) ✅ | Contra Costa County (Supervisor Gioia) ✅ | Marin County (County Executive) ✅ | Santa Clara County (County Executive) ✅ | Sonoma County (Supervisor Hopkins) ✅

Organizations: Kaiser Permanente ✅ | Trust for Public Land ✅ | SF Bay Area Ridge Trail Council ✅ | UC Berkeley ✅ | Center for Eco-Literacy ✅ | Rosie the Riveter Trust ✅ | Spanish Speaking Unity Council ✅ | Planning & Conservation League ✅ | AIA Redwood Empire ✅

═══════════════════════════════════════════════════════════════
PARTNER FIRMS TO MONITOR FOR TEAMING (Track 1B)
═══════════════════════════════════════════════════════════════
Alta Planning & Design | Blue Sky Consulting | Catalyst Group | CONCUR Inc | EPS | EDAW/AECOM | GHD | Hargreaves Jones | Interactive Resources | Brion & Associates | Lamphier-Gregory | Jacobs | WSP | Kimley-Horn | Fehr & Peers | Kittelson | Arup | HDR | Stantec | MIG | Dyett & Bhatia | PlaceWorks | Mintier Harnish | Raimi + Associates | Circlepoint | ICF | Rincon Consultants | Dudek | SWCA

═══════════════════════════════════════════════════════════════
MASTER KEYWORD LIBRARY
═══════════════════════════════════════════════════════════════
SERVICES (Track 1 — primary scope terms):
public engagement | stakeholder engagement | community engagement | public participation | outreach | facilitation | public facilitation | consensus building | consensus | dialogue | mediation | dispute resolution | conflict resolution | public dispute | assisted negotiation | negotiation | community liaison | public process | civic engagement | charrette | task force | advisory committee | working group | participation

PROJECT TYPE KEYWORDS:
General & Strategic Planning: general plan | specific plan | master plan | strategic plan | strategic planning | agency strategic plan | organizational strategic plan | multi-agency strategic plan | interagency strategic plan | long-range plan | community planning | neighborhood planning | urban planning | urban design | land use planning | zoning | zoning update | housing element | feasibility study | governance study | organizational assessment | organizational development | organizational effectiveness | mission/vision/values process | program strategic plan

Transportation: Regional Transportation Plan (RTP) | Active Transportation Plan (ATP) | Complete Streets Plan | Vision Zero Action Plan | Safe Routes to School | Pedestrian Master Plan | Bicycle Master Plan | Trails Master Plan | First/Last Mile Plan | Transit Corridor Study | Bus Rapid Transit (BRT) | Ferry/Water Transit Plan | Transportation Demand Management (TDM) | Sustainable Communities Strategy (SCS) | transit-oriented development (TOD) | multimodal planning | mobility hub | traffic calming | road diet | micromobility | Vision Zero | transportation equity | high-injury network

Habitat & Conservation: Habitat Conservation Plan (HCP) | Natural Community Conservation Plan (NCCP) | Multiple Species Conservation Plan | wildlife corridor plan | biodiversity action plan | species recovery plan | preserve management plan | significant ecological areas

Wetlands / Coastal / Water: wetlands restoration | tidal wetland restoration | riparian corridor | living shorelines | coastal resilience plan | Local Coastal Program (LCP) | shoreline management plan | sea level rise adaptation | estuary management plan | floodplain management plan | stormwater management plan | urban greening | green infrastructure

Water Resources: Groundwater Sustainability Plan (GSP) | SGMA implementation | Integrated Regional Water Management Plan (IRWMP) | watershed management plan | urban water management plan (UWMP) | water recycling/reuse plan | stormwater master plan

Climate & Environment: climate action plan | climate adaptation | climate resilience | disaster preparedness | disaster mitigation | sea level rise | wildfire/urban interface | carbon sequestration | green infrastructure

Regulatory: CEQA | NEPA | CESA | ESA | environmental impact report (EIR) | environmental impact statement (EIS) | programmatic EIR | SMARA | mitigation monitoring

Open Space: trail master plan | open space plan | parks master plan | greenway | baylands | waterfront plan

Facility Siting — All Types: school siting | school expansion | campus master plan | university expansion | community college facilities | religious institution siting | church expansion | mosque siting | hospital siting | hospital expansion | medical campus | behavioral health facility | sobering center | homeless shelter | navigation center | transitional housing | correctional facility | re-entry facility | office campus | tech campus | corporate campus

Infrastructure & Utilities: substation siting | solar farm conflict | wind energy conflict | transmission line | warehouse/logistics facility | JPA formation | JPA strategic plan | multi-agency governance | shared services agreement | member agency coordination | inter-agency agreement | MOU

SECTOR KEYWORDS:
urban | environmental | community | neighborhood | land use | environmental policy | water policy | housing | affordable housing | transportation | mobility | infrastructure | open space | wetlands | habitat | biodiversity | wildfire | coastal | bay/estuary | groundwater | SGMA | governance | equity | environmental justice | agriculture | mining

TRACK 2 CONFLICT SIGNALS:
community opposition | neighborhood conflict | public controversy | stakeholder opposition | community pushback | community resistance | public dispute | failed process | stalled project | impasse | deadlock | contested plan | legal challenge | lawsuit | appeal | injunction | environmental lawsuit | governance dispute | inter-agency conflict | jurisdictional dispute | failed vote | council divided | board divided | planning commission dispute | JPA governance conflict | member agency conflict | JPA restructuring | cost sharing dispute | environmental justice | displacement | gentrification | disproportionate impact | agricultural conflict | ag/residential conflict | farming dispute | pesticide dispute | spray drift | quarry conflict | quarry expansion opposition | mining dispute | blasting opposition | aggregate mining conflict | SMARA conflict | transit opposition | highway controversy | bike lane opposition | trail conflict | port conflict | utility conflict | pipeline controversy | energy facility opposition | warehouse/logistics opposition | agency reorganization | special district consolidation | LAFCO dispute | annexation conflict | rate increase opposition

NEGATIVE KEYWORDS — exclude unless combined with engagement/planning:
web/internet | software | information technology | IT | construction (standalone) | engineering (standalone) | janitorial | fleet | maintenance (standalone) | legal services | accounting | pest control (not IPM policy)

═══════════════════════════════════════════════════════════════
VIABILITY CRITERIA — APPLY IN SEQUENCE
═══════════════════════════════════════════════════════════════
LAYER 1 — Auto-disqualify if any of:
- No public dimension (purely internal private org, no community impact)
- Pure construction/IT/engineering/maintenance with no engagement component
- Routine operations procurement (janitorial, fleet, accounting, legal services)
- Issued >45 days ago with deadline already passed

LAYER 2 — Public Realm Test: "Does the work shape outcomes that affect how the public experiences their community, environment, or governance?" If yes → proceed.

LAYER 3 — Fit Signals (more = higher ranking):
- Engagement/facilitation/consensus/mediation explicitly named ✓
- Strategic plan, organizational assessment, or governance study ✓
- Multi-stakeholder or multi-agency environment ✓
- History of controversy, opposition, or prior failed process ✓
- Environmental, land use, or governance subject matter ✓
- Community conflict or litigation mentioned ✓
- New policy mandate driving process (SGMA, RHNA, sea level rise, climate) ✓
- Prior Bluhon client → automatic elevation ✓
- Tier 1 Bay Area geography → elevated priority ✓
- JPA or special district client → strong fit signal ✓

LAYER 4 — Priority Flags (auto-elevate to top of report):
✅ Prior client issuing the RFP or experiencing the conflict
🔥 Active public controversy already in the news
📍 Tier 1 Bay Area geography
⏰ Submission deadline within 10 days
🤝 Known partner firm has downloaded the RFP

═══════════════════════════════════════════════════════════════
DIRECT COMPETITORS — TRACK 4
═══════════════════════════════════════════════════════════════
Firms that directly compete with Bluhon for public engagement and facilitation prime contracts in California:
MIG (Moore Iacofano Goltsman) | PlaceWorks | Circlepoint | Raimi + Associates | Rincon Consultants | Mintier Harnish | Dyett & Bhatia | Lamphier-Gregory | Blue Sky Consulting | Catalyst Group | CONCUR Inc | Alta Planning & Design

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — EXACTLY THIS FORMAT, ALL SIX DELIMITERS REQUIRED
═══════════════════════════════════════════════════════════════

---TRACK1_START---
[HTML table content for Track 1 — Active RFPs]
---TRACK1_END---

---TRACK2_START---
[HTML unordered list for Track 2 — Emerging Issues]
---TRACK2_END---

---TRACK3_START---
[HTML unordered list for Track 3 — Prime Firm Activity]
---TRACK3_END---

---TRACK4_START---
[HTML unordered list for Track 4 — Competitor Activity]
---TRACK4_END---

---OPPORTUNITIES_JSON_START---
[JSON array]
---OPPORTUNITIES_JSON_END---

─────────────────────────────────────────────────────────────
TRACK 1 — ACTIVE RFPs & PROCUREMENT
─────────────────────────────────────────────────────────────
Search for open RFPs, RFQs, and solicitations in California — Tier 1 Bay Area priority — where the scope matches Bluhon's services. Search these sources:
- caleprocure.ca.gov (California eProcure — search "public engagement", "facilitation", "outreach", "consensus", "strategic plan", "organizational assessment")
- PlanetBids (planetbids.com) — Bay Area agency listings
- Each county's procurement portal (Alameda, Contra Costa, Marin, San Mateo, Santa Clara, SF, Sonoma, Napa, Solano)
- Individual agency procurement pages: SFMTA, BART, MTC, ABAG, BCDC, EBMUD, SFPUC, SCVWD, EBRPD, VTA, WETA, SMART
- Caltrans procurement (dot.ca.gov/programs/procurement)
- Individual city procurement portals for key Tier 1 cities

Return as HTML table with columns: Agency | Solicitation # | Project / Scope | Due Date | Type | Source URL
- Solicitation # column: RFP/RFQ/IFB number (e.g. RFP 2026-01). If no number is identifiable, DO NOT include the row.
- Due Date: must be a future date. If unknown or already passed, DO NOT include the row.
- Bold due date if within 10 days (<b>DATE</b>)
- Flag prior clients with ✅
- Type column: "Prime" (engagement is primary scope) or "Sub/Team" (engagement is sub-scope)
- Source URL must link directly to the solicitation or its procurement portal listing page
- Only include rows where you can confirm a real open solicitation with a number and future deadline

─────────────────────────────────────────────────────────────
TRACK 2 — EMERGING ISSUES & INTELLIGENCE
─────────────────────────────────────────────────────────────
Search for news, meeting agendas, and public media from the past 72 hours about:
- California infrastructure projects entering CEQA/EIR/NEPA — these will need public engagement
- Bay Area housing, transit, water, or land use projects facing community opposition or controversy
- Agricultural conflicts (pesticide disputes, ag/residential conflicts, farmland conversion)
- Mining/quarry conflicts and opposition
- Facility siting controversies (homeless shelters, hospitals, religious institutions, tech campuses)
- New state legislation or executive orders affecting public participation requirements
- Agency budget approvals or bond measures that will trigger new procurements
- Governance breakdowns, inter-agency disputes, JPA conflicts
- LAFCo proceedings, annexation conflicts, special district restructuring
- Upcoming public comment periods, scoping meetings, or environmental hearings

Return as HTML unordered list. Each item: <strong>Bold headline</strong>, 2-3 sentence summary, <em>Bluhon angle:</em> sentence explaining BD relevance and suggested outreach action, Source: [linked URL].

─────────────────────────────────────────────────────────────
TRACK 3 — PRIME FIRM ACTIVITY (Teaming Intelligence)
─────────────────────────────────────────────────────────────
Search for recent activity (past 2 weeks) from these partner/prime firms: AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Mott MacDonald, LSA Associates, Arup, Fehr & Peers, Kimley-Horn, Alta Planning, EPS, GHD.

Look for: contract awards in California | job postings for public engagement/outreach/facilitation roles in CA | press releases about new CA projects | RFP teaming announcements | planholders list appearances on relevant RFPs

Return as HTML unordered list. Each item: <strong>Firm name</strong> | activity type | brief description | Bluhon action (contact for teaming, monitor planholders, etc.) | Source.

─────────────────────────────────────────────────────────────
TRACK 4 — COMPETITOR ACTIVITY
─────────────────────────────────────────────────────────────
Search for recent activity (past 2 weeks) from direct Bluhon competitors: MIG (Moore Iacofano Goltsman), PlaceWorks, Circlepoint, Raimi + Associates, Rincon Consultants, Mintier Harnish, Dyett & Bhatia, Lamphier-Gregory, Blue Sky Consulting, Catalyst Group, CONCUR Inc.

Look for: contract awards | RFP wins | new California project announcements | job postings for engagement/facilitation roles | press releases or case studies | LinkedIn announcements

Why it matters: Where competitors win, there may be next-cycle opportunities or teaming gaps. Where they are hiring, there is market growth.

Return as HTML unordered list. Each item: <strong>Firm name</strong> | activity type | brief description | Bluhon intelligence note | Source.

─────────────────────────────────────────────────────────────
OPPORTUNITIES JSON (for database ingestion)
─────────────────────────────────────────────────────────────
After all four track sections, output a JSON array of every distinct RFP/solicitation from Track 1. Each object:
{
  "title": "project name / scope",
  "agency": "agency name",
  "deadline": "YYYY-MM-DD or null",
  "track": "Track 1",
  "scope": "one sentence describing the engagement scope",
  "source_url": "https://...",
  "pursuit_type": "Prime or Sub/Team",
  "prior_client": true or false,
  "geo_tier": "Tier 1" or "Tier 2" or "Tier 3" or "Tier 4"
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate detection
// ─────────────────────────────────────────────────────────────────────────────
function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/\b(rfp|rfq|ifb|soq|for|the|of|a|an|and|to|in|at|by|with|services|consulting|professional)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Word overlap: if 70%+ of the shorter title's words appear in the longer, treat as duplicate
  const wa = new Set(na.split(' ').filter(w => w.length > 3));
  const wb = new Set(nb.split(' ').filter(w => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return false;
  const smaller = wa.size <= wb.size ? wa : wb;
  const larger  = wa.size <= wb.size ? wb : wa;
  const overlap = [...smaller].filter(w => larger.has(w)).length;
  return overlap / smaller.size >= 0.7;
}

async function fetchExistingOppTitles(cutoffDate) {
  try {
    const formula = encodeURIComponent(`IS_AFTER(CREATED_TIME(), '${cutoffDate}')`);
    const data = await atGet(AIRTABLE_OPPS_TABLE, `?filterByFormula=${formula}&fields[]=title&fields[]=agency&maxRecords=500`);
    return (data.records || []).map(r => ({ title: r.fields.title || '', agency: r.fields.agency || '' }));
  } catch (err) {
    console.warn(`[dedup] Could not fetch existing opps: ${err.message}`);
    return [];
  }
}


async function atPost(tableId, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable POST failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function atGet(tableId, params = '') {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}${params}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable GET failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function atPatch(tableId, recordId, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable PATCH failed: ${res.status} ${err}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// News RSS Aggregator
// Replaces "tell Claude to search newspapers" with systematic daily coverage.
// Google News RSS covers every outlet simultaneously; direct feeds add depth.
// Items are pre-filtered for relevance before touching Claude.
// ─────────────────────────────────────────────────────────────────────────────

const BLUHON_KEYWORDS = [
  'public engagement', 'community outreach', 'community engagement',
  'stakeholder', 'facilitation', 'consensus', 'mediation',
  'ceqa', 'environmental review', 'eir', 'environmental impact',
  'land use', 'planning commission', 'general plan', 'specific plan',
  'zoning', 'rezoning', 'entitlement', 'annexation',
  'facility siting', 'community opposition', 'neighborhood opposition', 'resident opposition',
  'housing project', 'development project', 'infrastructure project',
  'water rights', 'water project', 'wetlands', 'habitat',
  'public hearing', 'public comment', 'scoping meeting',
  'conflict resolution', 'dispute', 'controversy', 'contested',
  'board of supervisors', 'city council', 'planning commission', 'advisory committee',
  'request for proposals', 'rfp', 'rfq', 'contract award', 'professional services',
  'aecom', 'wsp', 'hdr', 'jacobs', 'icf', 'stantec', 'kimley',
  'mig consulting', 'placeworks', 'circlepoint', 'raimi'
];

// 24 targeted Google News RSS queries — topic+geo combinations
const GOOGLE_NEWS_QUERIES = [
  // Core Bluhon topics × Bay Area
  '"public engagement" "bay area"',
  '"community outreach" California planning',
  'CEQA "bay area" dispute OR opposition OR conflict',
  '"environmental review" "bay area" OR "Marin" OR "Alameda" OR "Contra Costa"',
  '"facility siting" California community',
  '"community opposition" California development OR project OR facility',
  '"land use" "planning commission" "bay area"',
  '"public hearing" "bay area" development OR project OR EIR',
  '"water rights" OR "water project" California conflict OR dispute',
  '"housing project" "bay area" opposition OR controversy',
  // County-level conflict searches
  '"Marin County" development OR planning OR dispute',
  '"Alameda County" project OR planning OR opposition',
  '"Contra Costa County" development OR facility OR siting',
  '"Santa Clara County" land use OR planning OR EIR',
  '"Sonoma County" environmental OR project OR dispute',
  '"San Mateo County" planning OR development',
  // City-level
  'Oakland Berkeley "community" development OR opposition OR dispute',
  '"San Jose" community engagement OR infrastructure OR planning',
  // Tier 2
  'Sacramento OR Fresno OR Stockton "public engagement" OR CEQA project',
  '"Monterey" OR "Santa Cruz" OR "Salinas" planning dispute OR environmental',
  // Track 3 — prime firm intel
  'AECOM OR WSP OR HDR OR Jacobs OR ICF "contract award" California',
  'AECOM OR Stantec OR "Fehr Peers" OR "Kimley-Horn" California planning',
  'MIG OR PlaceWorks OR Circlepoint OR Raimi California planning contract',
  // Track 4 — governing body pre-RFP signals
  '"board of supervisors" "request for proposals" OR "professional services" "bay area"',
];

// Direct RSS feeds for key outlets — fetched every day regardless of geography
const DIRECT_RSS_FEEDS = [
  { url: 'https://www.berkeleyside.org/feed',              source: 'Berkeleyside',             track: 'Track 2' },
  { url: 'https://oaklandside.org/feed',                   source: 'The Oaklandside',          track: 'Track 2' },
  { url: 'https://missionlocal.org/feed',                  source: 'Mission Local',            track: 'Track 2' },
  { url: 'https://marinpost.org/feed',                     source: 'Marin Post',               track: 'Track 2' },
  { url: 'https://sanjosespotlight.com/feed',              source: 'San Jose Spotlight',       track: 'Track 2' },
  { url: 'https://richmondstandard.com/feed',              source: 'Richmond Standard',        track: 'Track 2' },
  { url: 'https://eastcountytoday.net/feed',               source: 'East County Today (CCC)',  track: 'Track 2' },
  { url: 'https://www.marinij.com/feed',                   source: 'Marin IJ',                 track: 'Track 2' },
  { url: 'https://www.paloaltoonline.com/feed',            source: 'Palo Alto Weekly',         track: 'Track 2' },
  { url: 'https://www.mv-voice.com/feed',                  source: 'Mountain View Voice',      track: 'Track 2' },
  { url: 'https://www.hmbreview.com/feed',                 source: 'Half Moon Bay Review',     track: 'Track 2' },
  { url: 'https://www.smdailyjournal.com/feed',            source: 'San Mateo Daily Journal',  track: 'Track 2' },
  { url: 'https://www.pressdemocrat.com/feed',             source: 'Press Democrat',           track: 'Track 2' },
  { url: 'https://napavalleyregister.com/feed',            source: 'Napa Valley Register',     track: 'Track 2' },
  { url: 'https://www.eastbaytimes.com/feed',              source: 'East Bay Times',           track: 'Track 2' },
  { url: 'https://www.mercurynews.com/feed',               source: 'Mercury News',             track: 'Track 2' },
  { url: 'https://www.sfexaminer.com/feed',                source: 'SF Examiner',              track: 'Track 2' },
  { url: 'https://www.novatoadvance.com/feed',             source: 'Novato Advance',           track: 'Track 2' },
  { url: 'https://www.sacbee.com/news/politics-government/?widgetName=rssfeed&widgetContentId=710361&getXmlFeed=true', source: 'Sacramento Bee', track: 'Track 2' },
  { url: 'https://www.planetizen.com/rss.xml',             source: 'Planetizen',               track: 'Track 3' },
  { url: 'https://www.enr.com/rss/news',                   source: 'Engineering News-Record',  track: 'Track 3' },
];

function parseRSSXml(xml, sourceName) {
  const items = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const raw of itemMatches) {
    const get = (tag) => {
      const m = raw.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    };
    const title   = get('title');
    const link    = get('link') || (raw.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
    const pubDate = get('pubDate') || get('published') || get('dc:date') || '';
    const summary = get('description').slice(0, 400);
    const source  = get('source') || sourceName;
    if (title && link) items.push({ title, url: link.trim(), pubDate, summary, source });
  }
  return items;
}

const KEYWORD_WEIGHTS = {
  // Tier 1 — highest relevance to Bluhon's core work (3 pts)
  'public engagement': 3, 'community engagement': 3, 'facilitation': 3,
  'mediation': 3, 'consensus': 3, 'conflict resolution': 3,
  'community outreach': 3, 'stakeholder': 3, 'land use': 3,
  'facility siting': 3, 'community opposition': 3, 'neighborhood opposition': 3,
  'dispute': 3, 'opposition': 3,
  'land use dispute': 3, 'environmental conflict': 3,
  'environmental dispute': 3, 'development proposal': 3,
  // Tier 2 — strong signals (2 pts)
  'planning commission': 2, 'environmental review': 2, 'public hearing': 2,
  'general plan': 2, 'specific plan': 2, 'entitlement': 2, 'water rights': 2,
  'board of supervisors': 2, 'city council': 2, 'rezoning': 2,
  'annexation': 2, 'outreach': 2, 'controversy': 2, 'contested': 2,
  // Tier 3 — contextual signals (1 pt)
  'ceqa': 1, 'eir': 1, 'environmental impact report': 1,
  'zoning': 1, 'housing project': 1, 'development project': 1,
  'infrastructure': 1, 'advisory committee': 1, 'task force': 1,
  'contract award': 1, 'rfp': 1, 'professional services': 1,
};

const BAY_AREA_TERMS = [
  // Counties
  'marin', 'alameda', 'contra costa', 'santa clara', 'sonoma', 'napa',
  'san mateo', 'solano', 'bay area', 'east bay', 'north bay', 'south bay',
  // Marin / North Bay cities
  'novato', 'san rafael', 'san quentin', 'larkspur', 'corte madera',
  'mill valley', 'sausalito', 'tiburon', 'ignacio', 'lucas valley',
  'marinwood', 'terra linda', 'woodacre', 'bolinas', 'black point',
  'sears point',
  // Sonoma / Lake / Mendocino
  'santa rosa', 'petaluma', 'rohnert park', 'sebastopol', 'bodega bay',
  'duncans mills', 'cazadero', 'geyserville', 'cloverdale', 'hopland',
  'boonville', 'cobb', 'clearlake', 'lakeport', 'calistoga', 'angwin',
  'st helena',
  // Napa / Solano
  'napa', 'vallejo', 'benicia', 'fairfield', 'dixon', 'davis', 'woodland',
  // Sacramento
  'sacramento', 'elk grove', 'esparto',
  // East Bay — West
  'richmond', 'el cerrito', 'san pablo', 'el sobrante', 'pinole',
  'hercules', 'rodeo', 'crockett',
  // East Bay — Core
  'berkeley', 'oakland', 'emeryville', 'alameda', 'piedmont', 'albany',
  // East Bay — Inland
  'walnut creek', 'concord', 'pleasant hill', 'lafayette', 'orinda',
  'moraga', 'alamo', 'danville', 'san ramon', 'clayton', 'blackhawk',
  // East Contra Costa
  'martinez', 'antioch', 'pittsburg', 'brentwood', 'oakley', 'bay point',
  'pacheco', 'knightsen', 'byron', 'discovery bay', 'mountain house',
  // South / Southeast Alameda
  'san leandro', 'castro valley', 'hayward', 'fremont', 'livermore',
  'dublin', 'union city', 'newark',
  // San Francisco
  'san francisco',
  // Peninsula / San Mateo
  'daly city', 'san mateo', 'redwood city', 'east palo alto', 'menlo park',
  'portola valley', 'half moon bay', 'foster city', 'burlingame',
  'millbrae', 'san bruno', 'south san francisco', 'colma', 'pacifica',
  // South Bay / Santa Clara
  'palo alto', 'stanford', 'mountain view', 'sunnyvale', 'santa clara',
  'san jose', 'campbell', 'saratoga', 'los gatos', 'milpitas',
  'alum rock', 'cupertino', 'los altos', 'gilroy', 'morgan hill',
];

function scoreRelevance(item) {
  const title   = (item.title   || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  let score = 0;
  for (const [kw, pts] of Object.entries(KEYWORD_WEIGHTS)) {
    if (title.includes(kw))   score += pts * 2; // title match weighted double
    if (summary.includes(kw)) score += pts;
  }
  const fullText = `${title} ${summary}`;
  if (BAY_AREA_TERMS.some(t => fullText.includes(t))) score += 2;
  return score;
}

function isNewsRelevant(item) {
  return scoreRelevance(item) > 0;
}

async function fetchGoogleNewsRSS(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:3d')}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSXml(xml, 'Google News').map(item => ({ ...item, gnQuery: query }));
  } catch (err) {
    console.warn(`[RSS/GNews] Query failed "${query}": ${err.message}`);
    return [];
  }
}

async function fetchDirectRSS(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSXml(xml, feed.source).map(item => ({ ...item, track: feed.track }));
  } catch (err) {
    console.warn(`[RSS/Direct] Feed failed "${feed.source}": ${err.message}`);
    return [];
  }
}

async function fetchSeenNewsUrls() {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const formula = encodeURIComponent(`IS_AFTER({report_date}, '${since}')`);
    const data = await atGet(AIRTABLE_TRACK2_TABLE, `?filterByFormula=${formula}&fields[]=source_url&maxRecords=500`);
    return new Set((data.records || []).map(r => r.fields.source_url).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function fetchAllNewsItems() {
  console.log(`[RSS] Launching ${GOOGLE_NEWS_QUERIES.length} Google News queries + ${DIRECT_RSS_FEEDS.length} direct feeds in parallel...`);

  const [seenUrls, ...allBatches] = await Promise.all([
    fetchSeenNewsUrls(),
    ...GOOGLE_NEWS_QUERIES.map(q => fetchGoogleNewsRSS(q)),
    ...DIRECT_RSS_FEEDS.map(f => fetchDirectRSS(f))
  ]);

  // Deduplicate by URL, filter for relevance and freshness
  const seenThisRun = new Set();
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const items = [];

  for (const batch of allBatches) {
    for (const item of batch) {
      if (seenThisRun.has(item.url) || seenUrls.has(item.url)) continue;
      seenThisRun.add(item.url);
      // Freshness check
      if (item.pubDate) {
        const d = new Date(item.pubDate);
        if (!isNaN(d.getTime()) && d.getTime() < cutoff) continue;
      }
      if (isNewsRelevant(item)) items.push(item);
    }
  }

  // Score and sort by relevance to Bluhon's core work (desc), then freshness as tiebreaker
  items.forEach(item => { item._score = scoreRelevance(item); });
  items.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  console.log(`[RSS] ${items.length} relevant fresh items after dedup + keyword filter`);
  return items;
}

function formatNewsItemsForPrompt(items, trackFilter) {
  const filtered = trackFilter
    ? items.filter(i => !i.track || i.track === trackFilter)
    : items;
  if (!filtered.length) return 'No pre-fetched news items available.';
  return filtered.slice(0, 60).map((item, i) => {
    const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const src  = item.source || 'Unknown';
    const sum  = item.summary ? ` — ${item.summary.slice(0, 200)}` : '';
    return `${i + 1}. [${src}${date ? ' | ' + date : ''}] ${item.title}${sum}\n   URL: ${item.url}`;
  }).join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback/Learning Loop helpers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProjectMemory() {
  try {
    const data = await atGet(AIRTABLE_MEMORY_TABLE, `?maxRecords=50`);
    const records = data.records || [];
    return records.map(r => r.fields.description).filter(Boolean);
  } catch (err) {
    console.warn(`[fetchProjectMemory] Failed: ${err.message}`);
    return [];
  }
}

async function fetchSearchSources() {
  try {
    const formula = encodeURIComponent(`AND({active}=TRUE(), NOT({source_type}="Standalone"), NOT({source_type}="Prime Firm"), NOT({source_type}="Competitor"), NOT({source_type}="Governing Body"))`);
    const data = await atGet(AIRTABLE_SOURCES_TABLE, `?filterByFormula=${formula}&maxRecords=100`);
    const records = data.records || [];
    return records.map(r => ({
      site_name:   r.fields.source_name  || '',
      url:         r.fields.url         || '',
      portal_type: r.fields.source_type  || '',
      username:    r.fields.username    || '',
      notes:       r.fields.notes       || ''
    }));
  } catch (err) {
    console.warn(`[fetchSearchSources] Failed: ${err.message}`);
    return [];
  }
}

async function fetchStandaloneSourcesFromAirtable() {
  try {
    const formula = encodeURIComponent(`AND({source_type}="Standalone", {active}=TRUE())`);
    const data = await atGet(AIRTABLE_SOURCES_TABLE, `?filterByFormula=${formula}&maxRecords=200&sort[0][field]=source_name&sort[0][direction]=asc`);
    return (data.records || []).map(r => ({
      name:    r.fields.source_name || '',
      url:     r.fields.url || '',
      baseUrl: (() => { try { const u = new URL(r.fields.url||''); return `${u.protocol}//${u.hostname}`; } catch { return ''; } })()
    })).filter(r => r.name && r.url);
  } catch (err) {
    console.warn(`[fetchStandaloneSources] Failed: ${err.message}`);
    return [];
  }
}

async function fetchFirmsFromAirtable() {
  try {
    const formula = encodeURIComponent(`AND(OR({source_type}="Prime Firm", {source_type}="Competitor"), {active}=TRUE())`);
    const data = await atGet(AIRTABLE_SOURCES_TABLE, `?filterByFormula=${formula}&maxRecords=100`);
    return (data.records || []).map(r => ({ name: r.fields.source_name || '', type: r.fields.source_type || '' })).filter(r => r.name);
  } catch (err) {
    console.warn(`[fetchFirms] Failed: ${err.message}`);
    return [];
  }
}

async function fetchMediaSources() {
  // Hardcoded comprehensive Bay Area + Tier 2 media list — used as fallback and baseline
  const HARDCODED_MEDIA = [
    // ── Tier 1 Bay Area ──
    { name: 'SF Chronicle',           url: 'https://www.sfchronicle.com',              track: 'Track 2', geo: 'Bay Area' },
    { name: 'SF Examiner',            url: 'https://www.sfexaminer.com',               track: 'Track 2', geo: 'San Francisco' },
    { name: 'Mission Local',          url: 'https://missionlocal.org',                 track: 'Track 2', geo: 'San Francisco' },
    { name: 'Hoodline SF',            url: 'https://hoodline.com',                     track: 'Track 2', geo: 'San Francisco' },
    { name: 'East Bay Times',         url: 'https://www.eastbaytimes.com',             track: 'Track 2', geo: 'East Bay' },
    { name: 'Berkeleyside',           url: 'https://www.berkeleyside.org',             track: 'Track 2', geo: 'Berkeley' },
    { name: 'The Oaklandside',        url: 'https://oaklandside.org',                  track: 'Track 2', geo: 'Oakland' },
    { name: 'Alameda Sun',            url: 'https://www.alamedasun.com',               track: 'Track 2', geo: 'Alameda' },
    { name: 'Marin Independent Journal', url: 'https://www.marinij.com',              track: 'Track 2', geo: 'Marin' },
    { name: 'Marin Post',             url: 'https://marinpost.org',                    track: 'Track 2', geo: 'Marin' },
    { name: 'Novato Advance',         url: 'https://www.novatoadvance.com',            track: 'Track 2', geo: 'Novato' },
    { name: 'San Jose Mercury News',  url: 'https://www.mercurynews.com',              track: 'Track 2', geo: 'South Bay' },
    { name: 'San Jose Spotlight',     url: 'https://sanjosespotlight.com',             track: 'Track 2', geo: 'San Jose' },
    { name: 'The Palo Alto Weekly',   url: 'https://www.paloaltoonline.com',           track: 'Track 2', geo: 'Palo Alto' },
    { name: 'Mountain View Voice',    url: 'https://www.mv-voice.com',                 track: 'Track 2', geo: 'Mountain View' },
    { name: 'Sunnyvale Sun',          url: 'https://svcnews.com',                      track: 'Track 2', geo: 'Sunnyvale' },
    { name: 'Daily Post (Palo Alto)', url: 'https://padailypost.com',                  track: 'Track 2', geo: 'South Bay' },
    { name: 'The Daily Californian',  url: 'https://www.dailycal.org',                 track: 'Track 2', geo: 'Berkeley' },
    { name: 'Richmond Standard',      url: 'https://richmondstandard.com',             track: 'Track 2', geo: 'Richmond' },
    { name: 'Contra Costa Times',     url: 'https://www.eastbaytimes.com/tag/contra-costa', track: 'Track 2', geo: 'Contra Costa' },
    { name: 'East County Today (CCC)', url: 'https://eastcountytoday.net',             track: 'Track 2', geo: 'East Contra Costa' },
    { name: 'Antioch Herald',         url: 'https://www.antiochherald.com',            track: 'Track 2', geo: 'Antioch' },
    { name: 'Livermore Independent',  url: 'https://www.livermorenewsindependent.com', track: 'Track 2', geo: 'Livermore' },
    { name: 'Valley Times (Pleasanton)', url: 'https://www.eastbaytimes.com/tag/pleasanton', track: 'Track 2', geo: 'Tri-Valley' },
    { name: 'Half Moon Bay Review',   url: 'https://www.hmbreview.com',                track: 'Track 2', geo: 'Half Moon Bay' },
    { name: 'San Mateo Daily Journal', url: 'https://www.smdailyjournal.com',          track: 'Track 2', geo: 'San Mateo' },
    { name: 'Redwood City Pulse',     url: 'https://www.redwoodcitypulse.com',         track: 'Track 2', geo: 'Redwood City' },
    { name: 'Peninsula Press',        url: 'https://peninsulapress.com',               track: 'Track 2', geo: 'Peninsula' },
    { name: 'Napa Valley Register',   url: 'https://napavalleyregister.com',           track: 'Track 2', geo: 'Napa' },
    { name: 'Sonoma Index-Tribune',   url: 'https://www.sonomanews.com',               track: 'Track 2', geo: 'Sonoma' },
    { name: 'Santa Rosa Press Democrat', url: 'https://www.pressdemocrat.com',         track: 'Track 2', geo: 'Sonoma' },
    { name: 'North Bay Business Journal', url: 'https://www.northbaybusinessjournal.com', track: 'Track 2', geo: 'North Bay' },
    // ── Tier 2 geographies ──
    { name: 'Sacramento Bee',         url: 'https://www.sacbee.com',                   track: 'Track 2', geo: 'Sacramento' },
    { name: 'Sacramento Business Journal', url: 'https://www.bizjournals.com/sacramento', track: 'Track 2', geo: 'Sacramento' },
    { name: 'CapRadio News',          url: 'https://www.capradio.org/news',             track: 'Track 2', geo: 'Sacramento' },
    { name: 'Fresno Bee',             url: 'https://www.fresnobee.com',                 track: 'Track 2', geo: 'Fresno' },
    { name: 'Stockton Record',        url: 'https://www.recordnet.com',                 track: 'Track 2', geo: 'Stockton' },
    { name: 'Bakersfield Californian', url: 'https://www.bakersfield.com',              track: 'Track 2', geo: 'Bakersfield' },
    { name: 'Salinas Californian',    url: 'https://www.thecalifornian.com',            track: 'Track 2', geo: 'Salinas' },
    { name: 'Santa Cruz Sentinel',    url: 'https://www.santacruzsentinel.com',         track: 'Track 2', geo: 'Santa Cruz' },
    { name: 'Monterey Herald',        url: 'https://www.montereyherald.com',            track: 'Track 2', geo: 'Monterey' },
    // ── Agency Board / Governing Body ──
    // ── Agency Boards (state, regional, federal, special districts) ──
    { name: 'MTC/ABAG Agendas',       url: 'https://mtc.ca.gov/whats-happening/meetings', track: 'Track 4', geo: 'Bay Area' },
    { name: 'BAAQMD Board',           url: 'https://www.baaqmd.gov/about-the-air-district/board-of-directors', track: 'Track 4', geo: 'Bay Area' },
    { name: 'East Bay Regional Parks Board', url: 'https://www.ebparks.org/about/board', track: 'Track 4', geo: 'East Bay' },
    { name: 'BCDC Agendas',           url: 'https://bcdc.ca.gov/meetings/',              track: 'Track 4', geo: 'Bay Area' },
    { name: 'SF Bay RWQCB',           url: 'https://www.waterboards.ca.gov/sanfranciscobay/board_info/agendas/', track: 'Track 4', geo: 'Bay Area' },
    { name: 'CA Coastal Commission',  url: 'https://www.coastal.ca.gov/meetings.html',  track: 'Track 4', geo: 'Statewide' },
    { name: 'SFPUC Commission',       url: 'https://sfpuc.org/about-us/commissions-and-advisory-bodies', track: 'Track 4', geo: 'San Francisco' },
    { name: 'BART Board',             url: 'https://www.bart.gov/about/bod/agendas',    track: 'Track 4', geo: 'Bay Area' },
    { name: 'Caltrans District 4',    url: 'https://dot.ca.gov/caltrans-near-me/district-4', track: 'Track 4', geo: 'Bay Area' },
    // ── County Boards ──
    { name: 'Alameda County BOS',     url: 'https://www.acgov.org/board',               track: 'Track 4', geo: 'Alameda County' },
    { name: 'Contra Costa BOS',       url: 'https://www.contracosta.ca.gov/agendas',    track: 'Track 4', geo: 'Contra Costa' },
    { name: 'Marin County BOS',       url: 'https://www.marincounty.org/depts/bs/board-agendas', track: 'Track 4', geo: 'Marin' },
    { name: 'Santa Clara County BOS', url: 'https://www.sccgov.org/sites/bos/Pages/bos-agendas.aspx', track: 'Track 4', geo: 'Santa Clara' },
    { name: 'Sonoma County BOS',      url: 'https://sonomacounty.ca.gov/boardofSupervisors', track: 'Track 4', geo: 'Sonoma' },
    { name: 'San Mateo County BOS',   url: 'https://www.smcgov.org/board-supervisors',  track: 'Track 4', geo: 'San Mateo' },
    { name: 'Napa County BOS',        url: 'https://www.countyofnapa.org/agendas',      track: 'Track 4', geo: 'Napa' },
    { name: 'SF BOS',                 url: 'https://sfgov.org/bos/agendas',             track: 'Track 4', geo: 'San Francisco' },
    // ── City Boards ──
    { name: 'Oakland City Council',   url: 'https://www.oaklandca.gov/topics/city-council-agendas', track: 'Track 4', geo: 'Oakland' },
    { name: 'Berkeley City Council',  url: 'https://www.cityofberkeley.info/city-council-meetings', track: 'Track 4', geo: 'Berkeley' },
    { name: 'San Jose City Council',  url: 'https://www.sanjoseca.gov/your-government/departments/city-clerk/city-council/agendas-minutes', track: 'Track 4', geo: 'San Jose' },
    { name: 'Richmond City Council',  url: 'https://www.ci.richmond.ca.us/agendacenter', track: 'Track 4', geo: 'Richmond' },
    { name: 'Palo Alto City Council', url: 'https://www.cityofpaloalto.org/city-council', track: 'Track 4', geo: 'Palo Alto' },
    { name: 'San Mateo City Council', url: 'https://www.cityofsanmateo.org/agendacenter', track: 'Track 4', geo: 'San Mateo' },
    { name: 'Novato City Council',    url: 'https://www.cityofnovato.org/agendacenter',  track: 'Track 4', geo: 'Novato' },
    { name: 'Livermore City Council', url: 'https://www.cityoflivermore.net/agendacenter', track: 'Track 4', geo: 'Livermore' },
    { name: 'Danville Town Council',  url: 'https://www.danville.ca.gov/agendacenter',  track: 'Track 4', geo: 'Danville' },
    // ── Firm / contract news ──
    { name: 'Engineering News-Record', url: 'https://www.enr.com',                     track: 'Track 3', geo: 'National' },
    { name: 'Planetizen',             url: 'https://www.planetizen.com',                track: 'Track 3', geo: 'National' },
    { name: 'SF Business Times',      url: 'https://www.bizjournals.com/sanfrancisco',  track: 'Track 3', geo: 'Bay Area' },
    { name: 'Silicon Valley BJ',      url: 'https://www.bizjournals.com/sanjose',       track: 'Track 3', geo: 'South Bay' },
    { name: 'GovWin / Deltek',        url: 'https://iq.govwin.com',                    track: 'Track 3', geo: 'National' },
    { name: 'GovConWire',             url: 'https://www.govconwire.com',                track: 'Track 3', geo: 'National' },
  ];

  if (!AIRTABLE_MEDIA_TABLE) return HARDCODED_MEDIA;

  try {
    const formula = encodeURIComponent(`{active}=TRUE()`);
    const data = await atGet(AIRTABLE_MEDIA_TABLE, `?filterByFormula=${formula}&maxRecords=500`);
    const records = data.records || [];
    if (records.length === 0) return HARDCODED_MEDIA;
    return records.map(r => ({
      name:  r.fields.source_name || '',
      url:   r.fields.url         || '',
      track: r.fields.track       || 'Track 2',
      geo:   r.fields.geography   || ''
    })).filter(s => s.name);
  } catch (err) {
    console.warn(`[fetchMediaSources] Failed — using hardcoded list: ${err.message}`);
    return HARDCODED_MEDIA;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FindRFP.com authenticated scraper
// Logs in, searches California RFPs matching Bluhon's keywords, returns opps
// ─────────────────────────────────────────────────────────────────────────────
const FINDRFP_KEYWORDS = [
  'public engagement', 'community outreach', 'facilitation', 'consensus building',
  'stakeholder engagement', 'public participation', 'environmental planning',
  'strategic plan', 'organizational assessment', 'mediation'
];

async function scrapeFindrfp() {
  if (!FINDRFP_LOGIN || !FINDRFP_PASSWORD) {
    console.log('[FindRFP] No credentials — skipping');
    return [];
  }
  try {
    console.log('[FindRFP] Logging in...');
    // Step 1: GET login page to grab CSRF token
    const loginPage = await fetch('https://www.findrfp.com/login', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const loginHtml = await loginPage.text();
    const cookieHeader = loginPage.headers.get('set-cookie') || '';
    const cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    // Extract CSRF token from form
    const csrfMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';

    // Step 2: POST login
    const loginRes = await fetch('https://www.findrfp.com/login', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.findrfp.com/login'
      },
      body: new URLSearchParams({ email: FINDRFP_LOGIN, password: FINDRFP_PASSWORD, _token: csrf })
    });
    // Capture session cookie from login response
    const sessionCookie = [cookies, loginRes.headers.get('set-cookie') || '']
      .join('; ').split(',').map(c => c.split(';')[0].trim()).join('; ');

    if (loginRes.status !== 302 && loginRes.status !== 200) {
      console.warn(`[FindRFP] Login failed — status ${loginRes.status}`);
      return [];
    }
    console.log('[FindRFP] Logged in — searching...');

    const opps = [];
    // Step 3: Search each keyword, filter to California
    for (const keyword of FINDRFP_KEYWORDS.slice(0, 5)) { // limit to 5 to avoid rate limits
      try {
        const searchUrl = `https://www.findrfp.com/rfp-search?keyword=${encodeURIComponent(keyword)}&state=CA&status=open`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            'Cookie': sessionCookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.findrfp.com'
          }
        });
        const html = await searchRes.text();
        // Parse result rows — FindRFP uses table rows with bid details
        const rowMatches = html.match(/<tr[^>]*class="[^"]*bid[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const row of rowMatches.slice(0, 8)) {
          const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
            .map(td => td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
          const titleMatch = row.match(/href="([^"]*rfp[^"]*)"[^>]*>([^<]+)</i);
          const title = titleMatch ? titleMatch[2].trim() : cells[1] || '';
          const agency = cells[0] || '';
          const dueDateRaw = cells[2] || cells[3] || '';
          const urlPath = titleMatch ? titleMatch[1] : '';
          const source_url = urlPath.startsWith('http') ? urlPath : `https://www.findrfp.com${urlPath}`;
          const dateMatch = dueDateRaw.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
          let deadline = null;
          if (dateMatch) {
            const parsed = new Date(dateMatch[1]);
            if (!isNaN(parsed) && parsed > new Date()) deadline = parsed.toISOString().split('T')[0];
          }
          // Skip if no title or deadline already passed
          if (!title || (deadline === null && dueDateRaw)) continue;
          if (!opps.find(o => o.title === title)) {
            opps.push({ title, agency, deadline, scope: keyword, source_url, via: 'FindRFP' });
          }
        }
        await new Promise(r => setTimeout(r, 800)); // polite delay between searches
      } catch (e) {
        console.warn(`[FindRFP] Search for "${keyword}" failed: ${e.message}`);
      }
    }
    // Update last_searched on the SEARCH_SOURCES record
    try {
      const formula = encodeURIComponent(`{source_name}="FindRFP"`);
      const src = await atGet(AIRTABLE_SOURCES_TABLE, `?filterByFormula=${formula}&maxRecords=1`);
      if (src.records && src.records[0]) {
        await atPatch(AIRTABLE_SOURCES_TABLE, src.records[0].id, { last_searched: new Date().toISOString().split('T')[0] });
      }
    } catch(e) {}
    console.log(`[FindRFP] Found ${opps.length} opportunities`);
    return opps;
  } catch (err) {
    console.warn(`[FindRFP] Scraper error: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenGov authenticated scraper
// Searches procurement.opengov.com for California RFPs
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeOpengov() {
  if (!OPENGOV_LOGIN || !OPENGOV_PASSWORD) { console.log('[OpenGov] No credentials — skipping'); return []; }
  try {
    console.log('[OpenGov] Logging in...');
    // OpenGov uses OAuth/JWT — POST to their auth endpoint
    const authRes = await fetch('https://procurement.opengov.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ email: OPENGOV_LOGIN, password: OPENGOV_PASSWORD })
    });
    const authData = await authRes.json();
    const token = authData.token || authData.access_token || authData.data?.token || '';
    if (!token) {
      // Fallback: try session-based login
      console.warn('[OpenGov] JWT auth failed — trying session login');
      return await scrapeOpengovSession();
    }
    console.log('[OpenGov] Authenticated — searching...');
    const opps = [];
    const keywords = ['public engagement', 'community outreach', 'facilitation', 'strategic plan'];
    for (const kw of keywords) {
      try {
        const res = await fetch(`https://procurement.opengov.com/api/procurement/opportunities?q=${encodeURIComponent(kw)}&state=CA&status=open&per_page=20`, {
          headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await res.json();
        const items = data.data || data.opportunities || data.results || [];
        for (const item of items) {
          const title = item.title || item.name || '';
          const agency = item.department || item.agency || item.organization || '';
          const deadline = item.close_date || item.due_date || item.deadline || null;
          const id = item.id || item.slug || '';
          const source_url = id ? `https://procurement.opengov.com/portal/${id}` : 'https://procurement.opengov.com';
          if (title && !opps.find(o => o.title === title)) {
            const deadlineDate = deadline ? new Date(deadline) : null;
            if (!deadlineDate || deadlineDate > new Date()) {
              opps.push({ title, agency, deadline: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null, scope: kw, source_url, via: 'OpenGov' });
            }
          }
        }
        await new Promise(r => setTimeout(r, 600));
      } catch(e) { console.warn(`[OpenGov] Search "${kw}" failed: ${e.message}`); }
    }
    console.log(`[OpenGov] Found ${opps.length} opportunities`);
    return opps;
  } catch(err) { console.warn(`[OpenGov] Error: ${err.message}`); return []; }
}

async function scrapeOpengovSession() {
  // Session-based fallback — search the public portal filtered to CA
  try {
    const res = await fetch('https://procurement.opengov.com/opportunities?state=CA&keywords=engagement+facilitation&status=open', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/html' }
    });
    const text = await res.text();
    // Parse any JSON embedded in the page
    const jsonMatch = text.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});<\/script>/);
    if (!jsonMatch) return [];
    const state = JSON.parse(jsonMatch[1]);
    const items = state?.opportunities?.list || state?.data?.opportunities || [];
    return items.slice(0, 15).map(item => ({
      title: item.title || '',
      agency: item.department || '',
      deadline: item.close_date ? new Date(item.close_date).toISOString().split('T')[0] : null,
      scope: 'public engagement',
      source_url: `https://procurement.opengov.com/portal/${item.id || ''}`,
      via: 'OpenGov'
    })).filter(o => o.title);
  } catch(e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bonfire authenticated scraper
// Searches multiple Bay Area agency subdomains with one login
// ─────────────────────────────────────────────────────────────────────────────
const BONFIRE_SUBDOMAINS = [
  'baaqmd', 'mtc', 'vendor', 'weta',
  'alamedacounty', 'contracosta', 'marinwater', 'sfpuc',
  'samtrans', 'scvwd', 'ebmud', 'bart'
];

async function scrapeBonfire() {
  if (!BONFIRE_LOGIN || !BONFIRE_PASSWORD) { console.log('[Bonfire] No credentials — skipping'); return []; }
  const opps = [];
  try {
    console.log('[Bonfire] Authenticating...');
    // Bonfire uses per-subdomain auth — start with vendor portal then search public opportunities
    // First try the public opportunities API which is accessible after auth on vendor portal
    const loginRes = await fetch('https://vendor.bonfirehub.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ email: BONFIRE_LOGIN, password: BONFIRE_PASSWORD })
    });
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.access_token || '';
    const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

    for (const subdomain of BONFIRE_SUBDOMAINS) {
      try {
        const res = await fetch(`https://${subdomain}.bonfirehub.com/opportunities?status=open`, {
          headers: { ...authHeader, 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (!res.ok) continue;
        const data = await res.json();
        const items = data.opportunities || data.data || data.results || [];
        for (const item of items) {
          const title = item.title || item.name || '';
          const deadline = item.closingDate || item.closing_date || item.dueDate || null;
          const deadlineDate = deadline ? new Date(deadline) : null;
          if (!title || (deadlineDate && deadlineDate < new Date())) continue;
          if (!opps.find(o => o.title === title)) {
            opps.push({
              title,
              agency: item.organization || item.department || subdomain.toUpperCase(),
              deadline: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null,
              scope: item.category || item.type || '',
              source_url: item.url || `https://${subdomain}.bonfirehub.com/opportunities/${item.id || ''}`,
              via: 'Bonfire'
            });
          }
        }
        await new Promise(r => setTimeout(r, 400));
      } catch(e) { console.warn(`[Bonfire] ${subdomain} failed: ${e.message}`); }
    }
    console.log(`[Bonfire] Found ${opps.length} opportunities`);
    return opps;
  } catch(err) { console.warn(`[Bonfire] Error: ${err.message}`); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanetBids authenticated scraper
// Searches California agencies on the PlanetBids platform
// ─────────────────────────────────────────────────────────────────────────────
async function scrapePlanetbids() {
  if (!PLANETBIDS_LOGIN || !PLANETBIDS_PASSWORD) { console.log('[PlanetBids] No credentials — skipping'); return []; }
  try {
    console.log('[PlanetBids] Logging in to vendorline.planetbids.com...');
    const BASE = 'https://vendorline.planetbids.com';

    // Step 1: Get login page for CSRF token / cookies
    const loginPage = await fetch(`${BASE}/portal/portal.cfm`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const cookies = (loginPage.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');

    // Step 2: POST credentials
    const loginRes = await fetch(`${BASE}/portal/portal.cfm`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': `${BASE}/portal/portal.cfm`
      },
      body: new URLSearchParams({
        action: 'login',
        email: PLANETBIDS_LOGIN,
        password: PLANETBIDS_PASSWORD
      })
    });
    const sessionCookies = [cookies, loginRes.headers.get('set-cookie') || '']
      .join('; ').split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');

    // Step 3: Search for open bids in California
    const keywords = ['public engagement', 'facilitation', 'outreach', 'strategic plan', 'community engagement'];
    const opps = [];
    for (const kw of keywords.slice(0, 5)) {
      try {
        const res = await fetch(`${BASE}/portal/portal.cfm?action=search&state=CA&keyword=${encodeURIComponent(kw)}&status=open`, {
          headers: { 'Cookie': sessionCookies, 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();
        const rowMatches = html.match(/<tr[^>]*class="[^"]*bid[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const row of rowMatches.slice(0, 10)) {
          const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(td => td.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
          const linkMatch = row.match(/href="([^"]*bid[^"]*)"[^>]*>([^<]{5,})</i);
          const title = linkMatch ? linkMatch[2].trim() : cells[1] || '';
          const agency = cells[0] || '';
          const dueDateRaw = cells[3] || cells[2] || '';
          const dateMatch = dueDateRaw.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          let deadline = null;
          if (dateMatch) {
            const d = new Date(dateMatch[1]);
            if (!isNaN(d) && d > new Date()) deadline = d.toISOString().split('T')[0];
          }
          if (title && !opps.find(o => o.title === title)) {
            const urlPath = linkMatch ? linkMatch[1] : '';
            opps.push({ title, agency, deadline, scope: kw, source_url: urlPath.startsWith('http') ? urlPath : `${BASE}${urlPath}`, via: 'PlanetBids' });
          }
        }
        await new Promise(r => setTimeout(r, 700));
      } catch(e) { console.warn(`[PlanetBids] Search "${kw}" failed: ${e.message}`); }
    }
    console.log(`[PlanetBids] Found ${opps.length} opportunities`);
    return opps;
  } catch(err) { console.warn(`[PlanetBids] Error: ${err.message}`); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// BiddingUSA / Biddingo authenticated scraper
// Same platform, US-facing brand. Covers Santa Clara County, San Jose,
// and other Bay Area agencies on the Biddingo network.
// ─────────────────────────────────────────────────────────────────────────────
const BIDDINGUSA_AGENCIES = [
  { name: 'Santa Clara County', path: '/santaclaracounty' },
  { name: 'San Jose',           path: '/sanjose' },
];

const BIDDINGUSA_KEYWORDS = [
  'public engagement', 'community outreach', 'facilitation', 'consensus',
  'stakeholder', 'planning', 'environmental', 'strategic plan',
  'organizational assessment', 'mediation', 'land use'
];

async function scrapeBiddingusa() {
  if (!BIDDINGUSA_LOGIN || !BIDDINGUSA_PASSWORD) {
    console.log('[BiddingUSA] No credentials — skipping'); return [];
  }
  try {
    console.log('[BiddingUSA] Logging in...');
    // Step 1: GET login page for CSRF token
    const loginPage = await fetch('https://www.biddingousa.com/login', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const loginHtml = await loginPage.text();
    const cookies = (loginPage.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).join('; ');
    const csrf = (loginHtml.match(/name="_token"\s+value="([^"]+)"/) || [])[1] || '';

    // Step 2: POST credentials
    const loginRes = await fetch('https://www.biddingousa.com/login', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.biddingousa.com/login'
      },
      body: new URLSearchParams({ email: BIDDINGUSA_LOGIN, password: BIDDINGUSA_PASSWORD, _token: csrf })
    });
    const sessionCookie = [cookies, loginRes.headers.get('set-cookie') || '']
      .join('; ').split(',').map(c => c.split(';')[0].trim()).join('; ');

    if (loginRes.status !== 302 && loginRes.status !== 200) {
      console.warn(`[BiddingUSA] Login failed — status ${loginRes.status}`); return [];
    }
    console.log('[BiddingUSA] Logged in — searching agencies...');

    const opps = [];
    for (const agency of BIDDINGUSA_AGENCIES) {
      try {
        const url = `https://www.biddingousa.com${agency.path}/bids`;
        const res = await fetch(url, {
          headers: {
            'Cookie': sessionCookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        const html = await res.text();
        // Parse bid rows — Biddingo uses table or card layout
        const rowMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const row of rowMatches) {
          const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (!BIDDINGUSA_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) continue;
          const titleMatch = row.match(/href="([^"]*bid[^"]*)"[^>]*>([^<]{10,})</i);
          if (!titleMatch) continue;
          const title = titleMatch[2].trim();
          const link  = titleMatch[1].startsWith('http') ? titleMatch[1] : `https://www.biddingousa.com${titleMatch[1]}`;
          const deadlineMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
          opps.push({
            title, agency: agency.name,
            deadline: deadlineMatch ? deadlineMatch[1] : null,
            scope: text.slice(0, 200),
            source_url: link
          });
        }
        console.log(`[BiddingUSA] ${agency.name}: found ${opps.length} so far`);
        await new Promise(r => setTimeout(r, 800));
      } catch(e) { console.warn(`[BiddingUSA] ${agency.name} failed: ${e.message}`); }
    }
    console.log(`[BiddingUSA] Total: ${opps.length} opportunities`);
    return opps;
  } catch(err) { console.warn(`[BiddingUSA] Error: ${err.message}`); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// BidNet Direct authenticated scraper
// Covers: Fremont, Livermore, Pleasant Hill, Novato, Tiburon,
//         Santa Clara (city), Mountain View — add more as discovered
// ─────────────────────────────────────────────────────────────────────────────
const BIDNET_AGENCIES = [
  { name: 'Fremont',        slug: 'cityoffremont' },
  { name: 'Livermore',      slug: 'cityoflivermore' },
  { name: 'Pleasant Hill',  slug: 'cityofpleasanthill' },
  { name: 'Novato',         slug: 'cityofnovato' },
  { name: 'Tiburon',        slug: 'townoftiburon' },
  { name: 'Santa Clara',    slug: 'cityofsantaclara' },
  { name: 'Mountain View',  slug: 'cityofmountainview' },
];

async function scrapeBidnet() {
  if (!BIDNET_LOGIN || !BIDNET_PASSWORD) {
    console.log('[BidNet] No credentials — skipping'); return [];
  }
  try {
    console.log('[BidNet] Logging in...');
    const loginPage = await fetch('https://www.bidnetdirect.com/login', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    const loginHtml = await loginPage.text();
    const cookies = (loginPage.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).join('; ');
    const csrf = (loginHtml.match(/name="_token"\s+value="([^"]+)"/) ||
                  loginHtml.match(/name="csrf_token"\s+value="([^"]+)"/) || [])[1] || '';

    const loginRes = await fetch('https://www.bidnetdirect.com/login', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.bidnetdirect.com/login'
      },
      body: new URLSearchParams({ email: BIDNET_LOGIN, password: BIDNET_PASSWORD, _token: csrf })
    });
    const sessionCookie = [cookies, loginRes.headers.get('set-cookie') || '']
      .join('; ').split(',').map(c => c.split(';')[0].trim()).join('; ');

    if (loginRes.status !== 302 && loginRes.status !== 200) {
      console.warn(`[BidNet] Login failed — status ${loginRes.status}`); return [];
    }
    console.log('[BidNet] Logged in — searching agencies...');

    const opps = [];
    for (const agency of BIDNET_AGENCIES) {
      try {
        const url = `https://www.bidnetdirect.com/california/${agency.slug}`;
        const res = await fetch(url, {
          headers: {
            'Cookie': sessionCookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        const html = await res.text();
        const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        for (const row of rows) {
          const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (!BIDDINGUSA_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) continue;
          const titleMatch = row.match(/href="([^"]+)"[^>]*>([^<]{10,})</i);
          if (!titleMatch) continue;
          const title = titleMatch[2].trim();
          const link  = titleMatch[1].startsWith('http') ? titleMatch[1] : `https://www.bidnetdirect.com${titleMatch[1]}`;
          const deadlineMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
          opps.push({
            title, agency: agency.name,
            deadline: deadlineMatch ? deadlineMatch[1] : null,
            scope: text.slice(0, 200),
            source_url: link
          });
        }
        await new Promise(r => setTimeout(r, 800));
      } catch(e) { console.warn(`[BidNet] ${agency.name} failed: ${e.message}`); }
    }
    console.log(`[BidNet] Total: ${opps.length} opportunities`);
    return opps;
  } catch(err) { console.warn(`[BidNet] Error: ${err.message}`); return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// CivicEngage scraper — no login required, public bid listing pages
// Covers ~30 Bay Area cities that use the CivicEngage CMS (/Bids.aspx pattern)
// ─────────────────────────────────────────────────────────────────────────────
const CIVICENGAGE_AGENCIES = [
  { name: 'San Leandro',    url: 'https://www.sanleandro.org/Bids.aspx' },
  { name: 'Dublin',         url: 'https://dublin.ca.gov/Bids.aspx' },
  { name: 'Albany',         url: 'https://www.albanyca.gov/Departments/City-Clerk/RFP-RFQ-Bids' },
  { name: 'Antioch',        url: 'https://www.antiochca.gov/bids.aspx' },
  { name: 'Danville',       url: 'https://www.danville.ca.gov/Bids.aspx' },
  { name: 'El Cerrito',     url: 'https://www.elcerrito.gov/Bids.aspx' },
  { name: 'Moraga',         url: 'https://www.moraga.ca.us/Bids.aspx' },
  { name: 'Orinda',         url: 'https://www.cityoforinda.gov/bids.aspx' },
  { name: 'San Pablo',      url: 'https://www.sanpabloca.gov/Bids.aspx' },
  { name: 'Mill Valley',    url: 'https://www.cityofmillvalley.gov/772/Bids-RFPs' },
  { name: 'Larkspur',       url: 'https://www.ci.larkspur.ca.us/bids.aspx' },
  { name: 'San Mateo',      url: 'https://www.cityofsanmateo.org/Bids.aspx' },
  { name: 'Daly City',      url: 'https://www.dalycity.org/Bids.aspx' },
  { name: 'Burlingame',     url: 'https://www.burlingame.org/Bids.aspx' },
  { name: 'San Bruno',      url: 'https://www.sanbruno.ca.gov/Bids.aspx' },
  { name: 'Half Moon Bay',  url: 'https://www.halfmoonbay.gov/bids.aspx' },
  { name: 'Woodside',       url: 'https://www.woodsideca.gov/Bids.aspx' },
  { name: 'Atherton',       url: 'https://www.athertonca.gov/bids.aspx' },
  { name: 'Gilroy',         url: 'https://www.cityofgilroy.org/Bids.aspx' },
  { name: 'Morgan Hill',    url: 'https://www.morganhill.ca.gov/Bids.aspx' },
  { name: 'Campbell',       url: 'https://www.campbellca.gov/Bids.aspx' },
  { name: 'Saratoga',       url: 'https://www.saratoga.ca.us/Bids.aspx' },
  { name: 'Rohnert Park',   url: 'https://www.rpcity.org/bids.aspx' },
  { name: 'Cotati',         url: 'https://www.cotaticity.gov/Bids.aspx' },
  { name: 'Windsor',        url: 'https://www.townofwindsor.ca.gov/Bids.aspx' },
  { name: 'Healdsburg',     url: 'https://www.ci.healdsburg.ca.us/Bids.aspx' },
];

async function scrapeCivicengage() {
  console.log(`[CivicEngage] Scraping ${CIVICENGAGE_AGENCIES.length} public city bid pages...`);
  const opps = [];
  // Fetch all pages in parallel — no auth needed
  const results = await Promise.allSettled(
    CIVICENGAGE_AGENCIES.map(async agency => {
      const res = await fetch(agency.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const agencyOpps = [];
      // CivicEngage bid rows follow a consistent pattern
      const rows = html.match(/<tr[^>]*class="[^"]*listingRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi) ||
                   html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      for (const row of rows) {
        const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length < 20) continue;
        if (!BIDDINGUSA_KEYWORDS.some(kw => text.toLowerCase().includes(kw))) continue;
        const titleMatch = row.match(/href="([^"]+)"[^>]*>([^<]{10,})</i);
        if (!titleMatch) continue;
        const title = titleMatch[2].trim();
        if (title.length < 8) continue;
        const href = titleMatch[1];
        const link = href.startsWith('http') ? href : `${new URL(agency.url).origin}${href.startsWith('/') ? '' : '/'}${href}`;
        const deadlineMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
        agencyOpps.push({
          title, agency: agency.name,
          deadline: deadlineMatch ? deadlineMatch[1] : null,
          scope: text.slice(0, 200),
          source_url: link
        });
      }
      return agencyOpps;
    })
  );
  for (const result of results) {
    if (result.status === 'fulfilled') opps.push(...result.value);
  }
  console.log(`[CivicEngage] Total: ${opps.length} opportunities across ${CIVICENGAGE_AGENCIES.length} cities`);
  return opps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone city/agency procurement page scrapers
// These agencies run their own bid pages outside any portal.
// Add new entries to STANDALONE_PAGES — no other code change needed.
// ─────────────────────────────────────────────────────────────────────────────
const STANDALONE_PAGES = [
  // ── Ports & Harbors ──────────────────────────────────────────────────────
  { name: 'Port of Oakland',          url: 'https://www.portofoakland.com/business/bids-rfp-center',                                                 baseUrl: 'https://www.portofoakland.com' },
  { name: 'Port of San Francisco',    url: 'https://www.sfport.com/business/contract-opportunities',                                                  baseUrl: 'https://www.sfport.com' },
  // ── Regional Transit ─────────────────────────────────────────────────────
  { name: 'BART',                     url: 'https://www.bart.gov/about/business/procurement/contractsout',                                           baseUrl: 'https://www.bart.gov' },
  { name: 'AC Transit',               url: 'https://www.actransit.org/business-opportunities',                                                       baseUrl: 'https://www.actransit.org' },
  { name: 'Caltrain / JPB',           url: 'https://www.caltrain.com/about_caltrain/doing-business/bids-and-rfps.html',                              baseUrl: 'https://www.caltrain.com' },
  { name: 'VTA',                      url: 'https://www.vta.org/business-center/solicitations',                                                      baseUrl: 'https://www.vta.org' },
  { name: 'SMART Rail',               url: 'https://www.sonomamarintrain.org/business',                                                              baseUrl: 'https://www.sonomamarintrain.org' },
  { name: 'Golden Gate Transit',      url: 'https://www.goldengate.org/about/contracting-opportunities/',                                            baseUrl: 'https://www.goldengate.org' },
  { name: 'SamTrans',                 url: 'https://www.samtrans.com/about/contracting/current-opportunities.html',                                  baseUrl: 'https://www.samtrans.com' },
  { name: 'SFMTA',                    url: 'https://www.sfmta.com/services/business-services/doing-business-sfmta/upcoming-construction-contracts',  baseUrl: 'https://www.sfmta.com' },
  // ── Regional Planning & Environment ──────────────────────────────────────
  { name: 'MTC / ABAG',               url: 'https://mtc.ca.gov/about-mtc/doing-business-mtc',                                                       baseUrl: 'https://mtc.ca.gov' },
  { name: 'BCDC',                     url: 'https://www.bcdc.ca.gov/permits/',                                                                       baseUrl: 'https://www.bcdc.ca.gov' },
  { name: 'BAAQMD',                   url: 'https://www.baaqmd.gov/about-the-air-district/request-for-proposals-rfp-rfq',                           baseUrl: 'https://www.baaqmd.gov' },
  { name: 'EBRPD',                    url: 'https://www.ebparks.org/public-info/bids-rfps',                                                          baseUrl: 'https://www.ebparks.org' },
  { name: 'MROSD',                    url: 'https://www.openspace.org/about-us/district-administration/bids',                                        baseUrl: 'https://www.openspace.org' },
  // ── Water Agencies ───────────────────────────────────────────────────────
  { name: 'SFPUC',                    url: 'https://webapps.sfpuc.org/bids/',                                                                        baseUrl: 'https://webapps.sfpuc.org' },
  { name: 'EBMUD',                    url: 'https://www.ebmud.com/business-center/requests-proposal-rfps',                                           baseUrl: 'https://www.ebmud.com' },
  { name: 'Valley Water (SCVWD)',     url: 'https://www.valleywater.org/doing-business/active-solicitations',                                        baseUrl: 'https://www.valleywater.org' },
  { name: 'Sonoma Water',             url: 'https://www.sonomawater.org/rfp',                                                                        baseUrl: 'https://www.sonomawater.org' },
  { name: 'Marin Municipal Water',    url: 'https://www.marinwater.org/296/Bids-RFPs',                                                              baseUrl: 'https://www.marinwater.org' },
  { name: 'Zone 7 Water Agency',      url: 'https://zone7water.com/business/construction-business-opportunities',                                    baseUrl: 'https://zone7water.com' },
  // ── Counties ─────────────────────────────────────────────────────────────
  { name: 'Alameda County',           url: 'https://www.acgov.org/gsa/purchasing/bids.htm',                                                          baseUrl: 'https://www.acgov.org' },
  { name: 'Contra Costa County',      url: 'https://www.contracosta.ca.gov/Bids.aspx',                                                              baseUrl: 'https://www.contracosta.ca.gov' },
  { name: 'Marin County',             url: 'https://www.marincounty.org/depts/pur/bids-and-rfps',                                                    baseUrl: 'https://www.marincounty.org' },
  { name: 'Sonoma County',            url: 'https://sonomacounty.ca.gov/general-services/purchasing/bids/',                                          baseUrl: 'https://sonomacounty.ca.gov' },
  { name: 'Napa County',              url: 'https://www.countyofnapa.org/Bids.aspx',                                                                 baseUrl: 'https://www.countyofnapa.org' },
  { name: 'Solano County',            url: 'https://www.solanocounty.com/depts/genserv/purchasing/bids_rfps.asp',                                    baseUrl: 'https://www.solanocounty.com' },
  { name: 'San Mateo County',         url: 'https://www.smcgov.org/ceo/bid-opportunities-project-documents',                                        baseUrl: 'https://www.smcgov.org' },
  { name: 'City & County of SF',      url: 'https://sfcitypartner.sfgov.org/',                                                                       baseUrl: 'https://sfcitypartner.sfgov.org' },
  // ── Alameda County Cities ─────────────────────────────────────────────────
  { name: 'Oakland',                  url: 'https://apps.oaklandca.gov/ContractOpportunities/',                                                       baseUrl: 'https://apps.oaklandca.gov' },
  { name: 'Berkeley',                 url: 'https://www.berkeleyca.gov/doing-business/working-city/bid-proposal-opportunities',                       baseUrl: 'https://www.berkeleyca.gov' },
  { name: 'Pleasanton',               url: 'https://www.cityofpleasantonca.gov/business/bids/',                                                       baseUrl: 'https://www.cityofpleasantonca.gov' },
  { name: 'Emeryville',               url: 'https://www.emeryvilleplanroom.com/projects/public',                                                      baseUrl: 'https://www.emeryvilleplanroom.com' },
  { name: 'Alameda',                  url: 'https://www.alamedaca.gov/BUSINESS/Bid-on-City-Contracts',                                                baseUrl: 'https://www.alamedaca.gov' },
  { name: 'Piedmont',                 url: 'https://www.piedmontplanroom.com/projects/public',                                                        baseUrl: 'https://www.piedmontplanroom.com' },
  // ── Contra Costa County Cities ────────────────────────────────────────────
  { name: 'Richmond',                 url: 'https://www.ci.richmond.ca.us/3300/BidsOnline',                                                          baseUrl: 'https://www.ci.richmond.ca.us' },
  { name: 'Walnut Creek',             url: 'https://vendors.planetbids.com/portal/64254/bo/bo-search',                                               baseUrl: 'https://vendors.planetbids.com' },
  { name: 'San Ramon',                url: 'https://www.sanramon.ca.gov/our_city/bids___r_f_p',                                                      baseUrl: 'https://www.sanramon.ca.gov' },
  { name: 'Martinez',                 url: 'https://www.cityofmartinez.org/departments/engineering/rfq-rfp',                                         baseUrl: 'https://www.cityofmartinez.org' },
  { name: 'Hercules',                 url: 'https://www.herculesplanroom.com/projects/public',                                                        baseUrl: 'https://www.herculesplanroom.com' },
  { name: 'Lafayette',                url: 'https://www.lovelafayette.org/city-hall/components/rfp-postings',                                        baseUrl: 'https://www.lovelafayette.org' },
  // ── Marin County Cities ───────────────────────────────────────────────────
  { name: 'San Rafael',               url: 'https://www.cityofsanrafael.org/bids-and-proposals/',                                                    baseUrl: 'https://www.cityofsanrafael.org' },
  { name: 'Sausalito',                url: 'https://www.sausalito.gov/bids.aspx',                                                                    baseUrl: 'https://www.sausalito.gov' },
  { name: 'Corte Madera',             url: 'https://www.cortemadera.gov/625/Town-Bids-and-RFPs',                                                     baseUrl: 'https://www.cortemadera.gov' },
  // ── San Mateo County Cities ───────────────────────────────────────────────
  { name: 'Redwood City',             url: 'https://www.redwoodcity.org/business/bids-proposals',                                                    baseUrl: 'https://www.redwoodcity.org' },
  { name: 'South San Francisco',      url: 'https://www.ssfca.gov/Services/RFPs-and-Bids',                                                           baseUrl: 'https://www.ssfca.gov' },
  { name: 'Foster City',              url: 'https://www.fostercity.org/rfps',                                                                         baseUrl: 'https://www.fostercity.org' },
  { name: 'Belmont',                  url: 'https://www.belmont.gov/i-want-to/find/bidding-contract-opportunities',                                   baseUrl: 'https://www.belmont.gov' },
  { name: 'San Carlos',               url: 'https://www.cityofsancarlos.org/business/bids_and_proposals/',                                           baseUrl: 'https://www.cityofsancarlos.org' },
  { name: 'Menlo Park',               url: 'https://www.menlopark.gov/bids.aspx',                                                                    baseUrl: 'https://www.menlopark.gov' },
  { name: 'East Palo Alto',           url: 'https://www.cityofepa.org/rfps',                                                                         baseUrl: 'https://www.cityofepa.org' },
  { name: 'Pacifica',                 url: 'https://www.cityofpacifica.org/government/rfps-bids',                                                    baseUrl: 'https://www.cityofpacifica.org' },
  { name: 'Brisbane',                 url: 'https://www.brisbaneca.org/rfps',                                                                         baseUrl: 'https://www.brisbaneca.org' },
  { name: 'Colma',                    url: 'https://www.colma.ca.gov/rfp-and-bids/',                                                                 baseUrl: 'https://www.colma.ca.gov' },
  { name: 'Portola Valley',           url: 'https://www.portolavalley.net/departments/request-for-proposals',                                        baseUrl: 'https://www.portolavalley.net' },
  // ── Santa Clara County Cities ─────────────────────────────────────────────
  { name: 'Sunnyvale',                url: 'https://vendors.planetbids.com/portal/75302/bo/bo-search',                                               baseUrl: 'https://vendors.planetbids.com' },
  { name: 'Cupertino',                url: 'https://apps.cupertino.org/bidmanagement/index.aspx',                                                    baseUrl: 'https://apps.cupertino.org' },
  { name: 'Vallejo',                  url: 'https://vendors.planetbids.com/portal/42510/bo/bo-search',                                               baseUrl: 'https://vendors.planetbids.com' },
  // ── Solano County Cities ──────────────────────────────────────────────────
  { name: 'Benicia',                  url: 'https://www.ci.benicia.ca.us/bids.aspx',                                                                 baseUrl: 'https://www.ci.benicia.ca.us' },
  { name: 'Fairfield',                url: 'https://www.fairfield.ca.gov/our-city/advanced-components/list-detail-pages/rfp-posts-list',             baseUrl: 'https://www.fairfield.ca.gov' },
  { name: 'Vacaville',                url: 'https://www.cityofvacaville.gov/government/finance/purchasing/current-bids',                             baseUrl: 'https://www.cityofvacaville.gov' },
  { name: 'Dixon',                    url: 'https://www.cityofdixonca.gov/bids',                                                                      baseUrl: 'https://www.cityofdixonca.gov' },
  { name: 'Rio Vista',                url: 'https://www.riovistacity.com/rfps',                                                                       baseUrl: 'https://www.riovistacity.com' },
  // ── Sonoma County Cities ──────────────────────────────────────────────────
  { name: 'Santa Rosa',               url: 'https://vendors.planetbids.com/portal/20314/bo/bo-search',                                               baseUrl: 'https://vendors.planetbids.com' },
  { name: 'Petaluma',                 url: 'https://www.cityofpetaluma.org/bid-opportunities',                                                       baseUrl: 'https://www.cityofpetaluma.org' },
  { name: 'Sonoma',                   url: 'https://www.sonomacity.org/request-for-proposals/',                                                      baseUrl: 'https://www.sonomacity.org' },
];

// Procurement-specific terms — must appear in the link text to be considered a solicitation
const STANDALONE_KEYWORDS = [
  'rfp', 'rfq', 'request for proposal', 'request for qualification',
  'invitation to bid', 'invitation for bid', 'ifb', 'soq',
  'notice of intent', 'notice inviting bid', 'bid', 'solicit',
  'professional services', 'consultant', 'contract opportunity',
  'procurement', 'proposal'
];

// Secondary content filter — link must also relate to Bluhon's service areas
// (applied as an OR against STANDALONE_KEYWORDS, not separately)
const BLUHON_SCOPE_TERMS = [
  'engagement', 'outreach', 'facilitation', 'consensus', 'mediation',
  'strategic plan', 'environmental', 'planning', 'stakeholder',
  'community', 'public participation', 'conflict'
];

async function scrapeStandalonePages() {
  const airtablePages = await fetchStandaloneSourcesFromAirtable();
  const pages = airtablePages.length > 0 ? airtablePages : STANDALONE_PAGES;
  if (airtablePages.length > 0) console.log(`[Standalone] Using ${airtablePages.length} Airtable-managed pages`);
  const opps = [];
  await Promise.allSettled(pages.map(async page => {
    try {
      console.log(`[Standalone] Fetching ${page.name}...`);
      const res = await fetch(page.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.warn(`[Standalone] ${page.name} HTTP ${res.status}`); return; }
      const html = await res.text();

      // Extract all text blocks that look like bid titles
      // Strategy: find all links + surrounding text, filter by keyword
      const linkBlocks = [];
      const linkRe = /href="([^"]+)"[^>]*>([\s\S]{5,200}?)<\/a>/gi;
      let m;
      while ((m = linkRe.exec(html)) !== null) {
        const href = m[1];
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length < 8 || text.length > 300) continue;
        const lower = text.toLowerCase();

        // Must contain a procurement keyword
        if (!STANDALONE_KEYWORDS.some(kw => lower.includes(kw))) continue;

        // Must contain a solicitation number pattern OR explicit RFP/RFQ/IFB label
        // e.g. "RFP 2026-01", "RFQ-2025-003", "Bid No. 12345", "#2026-01", "IFB 24-001"
        const hasSolicitationNumber = /\b(rfp|rfq|ifb|soq|itb|rfi)\b[\s\-#]*\d/i.test(text)
          || /\bbid\s*(no|num|number|#)\.?\s*\d/i.test(text)
          || /\bsolicit\w*\s*(no|num|number|#)\.?\s*\d/i.test(text)
          || /\bcontract\s*(no|num|number|#)\.?\s*\d/i.test(text)
          || /#\s*\d{2,}/i.test(text)
          || /\d{2,}-\d{3,}/.test(text); // e.g. 2026-001, 24-0123

        // Hard-exclude community notices, meetings, announcements regardless
        const isMeetingNotice = /\b(meeting|workshop|hearing|open house|survey|newsletter|announcement|notice of|calendar|agenda|minutes|event|webinar)\b/i.test(text);

        if (!hasSolicitationNumber && isMeetingNotice) continue;
        if (isMeetingNotice && !STANDALONE_KEYWORDS.slice(0,9).some(kw => lower.includes(kw))) continue;

        const fullUrl = href.startsWith('http') ? href : (href.startsWith('/') ? page.baseUrl + href : page.url);
        linkBlocks.push({ title: text, source_url: fullUrl });
      }

      // Deduplicate by title within this page
      const seen = new Set();
      for (const item of linkBlocks) {
        const key = item.title.toLowerCase().slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);
        opps.push({
          title:      item.title,
          agency:     page.name,
          deadline:   null,
          scope:      'Direct procurement page',
          source_url: item.source_url,
          via:        'Standalone'
        });
      }
      console.log(`[Standalone] ${page.name}: found ${seen.size} keyword-matched items`);
    } catch(err) {
      console.warn(`[Standalone] ${page.name} failed: ${err.message}`);
    }
  }));
  return opps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geographic rotation — cycles through Bay Area zones + Tier 2/3/4 over time
// ─────────────────────────────────────────────────────────────────────────────
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getGeoFocus() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const dow = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  const week = getISOWeek(now);

  if (dow === 1) {
    return {
      label: "Monday — SF + North Bay (Marin, Sonoma, Napa)",
      instructions: `TODAY'S GEOGRAPHIC FOCUS — MONDAY: Search exhaustively within these jurisdictions only for Track 1:
- City & County of San Francisco (all departments: Planning, DPW, SFPUC, Rec & Parks, OEWD, Port, Airport, SFMTA)
- Marin County + all Marin cities (Belvedere, Corte Madera, Fairfax, Larkspur, Mill Valley, Novato, Ross, San Anselmo, San Rafael, Sausalito, Tiburon) + Marin Municipal Water District, Marin Transit
- Sonoma County + all Sonoma cities (Cloverdale, Cotati, Healdsburg, Petaluma, Rohnert Park, Santa Rosa, Sebastopol, Sonoma, Windsor) + Sonoma Water, SMART
- Napa County + all Napa cities (American Canyon, Calistoga, Napa, St. Helena, Yountville)
Also check caleprocure.ca.gov and PlanetBids filtering to these agencies. Track 2 news: also focus on SF + North Bay.`
  };

  } else if (dow === 2) {
    return {
      label: "Tuesday — Alameda County",
      instructions: `TODAY'S GEOGRAPHIC FOCUS — TUESDAY: Search exhaustively within these jurisdictions only for Track 1:
- Alameda County government (Community Development Agency, Public Works, General Services)
- All Alameda County cities: Alameda, Albany, Berkeley, Dublin, Emeryville, Fremont, Hayward, Livermore, Newark, Oakland, Piedmont, Pleasanton, San Leandro, Union City
- Regional agencies based in / serving Alameda County: AC Transit, BART, EBMUD, EBRPD, ACTC (Alameda CTC), LAVTA, Tri Delta Transit, Zone 7 Water Agency, DSRSD, ACWD, Livermore-Amador Valley Water Management Agency
Also check caleprocure.ca.gov and PlanetBids filtering to these agencies. Track 2 news: focus on Alameda County.`
    };

  } else if (dow === 3) {
    return {
      label: "Wednesday — Contra Costa + Solano",
      instructions: `TODAY'S GEOGRAPHIC FOCUS — WEDNESDAY: Search exhaustively within these jurisdictions only for Track 1:
- Contra Costa County government (DCD, Public Works, Flood Control, Health Services) + all CoCo cities: Antioch, Brentwood, Clayton, Concord, Danville, El Cerrito, Hercules, Lafayette, Martinez, Moraga, Oakley, Orinda, Pinole, Pittsburg, Pleasant Hill, Richmond, San Pablo, San Ramon, Walnut Creek
- Contra Costa agencies: CCTA (Contra Costa Transportation Authority), CCWD (Contra Costa Water District), CCJPA, Delta Diablo, ECCFPD
- Solano County government + all Solano cities: Benicia, Dixon, Fairfield, Rio Vista, Suisun City, Vacaville, Vallejo
- Solano agencies: SolTrans, Solano Transportation Authority, North Bay Water Recycling Program
Also check caleprocure.ca.gov and PlanetBids filtering to these agencies. Track 2 news: focus on Contra Costa + Solano.`
    };

  } else if (dow === 4) {
    return {
      label: "Thursday — Santa Clara + San Mateo",
      instructions: `TODAY'S GEOGRAPHIC FOCUS — THURSDAY: Search exhaustively within these jurisdictions only for Track 1:
- Santa Clara County government + all SCC cities: Campbell, Cupertino, Gilroy, Los Altos, Los Altos Hills, Los Gatos, Milpitas, Monte Sereno, Morgan Hill, Mountain View, Palo Alto, San Jose, Santa Clara, Saratoga, Sunnyvale
- Santa Clara agencies: VTA (Valley Transportation Authority), SCVWD (Santa Clara Valley Water District), SCVOSA, Santa Clara Valley Habitat Agency
- San Mateo County government + all SM cities: Atherton, Belmont, Brisbane, Burlingame, Colma, Daly City, East Palo Alto, Foster City, Half Moon Bay, Hillsborough, Menlo Park, Millbrae, Pacifica, Portola Valley, Redwood City, San Bruno, San Carlos, San Mateo, South San Francisco, Woodside
- San Mateo agencies: SamTrans, Caltrain/JPB, BAWSCA, CCWD, Peninsula Clean Energy
Also check caleprocure.ca.gov and PlanetBids filtering to these agencies. Track 2 news: focus on Santa Clara + San Mateo.`
    };

  } else if (dow === 5) {
    const fridaySlot = week % 3;
    if (fridaySlot === 0) {
      return {
        label: "Friday — Regional Bay Area agencies + Tier 2 peek",
        instructions: `TODAY'S GEOGRAPHIC FOCUS — FRIDAY (Regional): Search these regional / multi-county agencies for Track 1:
- MTC (Metropolitan Transportation Commission), ABAG, BCDC, BAAQMD, WETA, SFCJPA, BAHFA
- SF Bay Restoration Authority, SF Bay Joint Venture, SFEI
- All 9-county LAFCOs, all Bay Area Groundwater GSAs
- Caltrans District 4 and District 7
- Then do a TIER 2 PEEK: Central / North Coast California (San Luis Obispo north to Eureka) — search caleprocure.ca.gov and county portals for Santa Barbara, San Luis Obispo, Monterey, Santa Cruz, Santa Barbara, San Benito, Mendocino, Humboldt counties
Track 2 news: regional Bay Area + statewide policy news.`
      };
    } else if (fridaySlot === 1) {
      return {
        label: "Friday — Tier 3: Southern California",
        instructions: `TODAY'S GEOGRAPHIC FOCUS — FRIDAY (Tier 3 — Southern California): Search SoCal jurisdictions for Track 1:
- Los Angeles County + City of LA (major departments), plus key LA cities: Long Beach, Pasadena, Burbank, Glendale, Santa Monica, Culver City, El Monte, Pomona, Torrance, Carson, Inglewood, Downey
- LA County agencies: Metro (LA Metro), LADWP, LA County Flood Control, LA Sanitation, LACMTA
- Orange County + key OC cities: Anaheim, Santa Ana, Irvine, Huntington Beach, Garden Grove, Fullerton, Costa Mesa, Westminster
- San Diego County + City of San Diego + SANDAG, MTS, NCTD
- Inland Empire: San Bernardino County, Riverside County, key cities (Riverside, San Bernardino, Rancho Cucamonga, Ontario)
- SCAG (Southern California Association of Governments), SANBAG, WRCOG, CVAG
- Search caleprocure.ca.gov filtering to these Southern California agencies
Track 2 news: Southern California focus.`
      };
    } else {
      return {
        label: "Friday — Tier 4: Nevada + Oregon",
        instructions: `TODAY'S GEOGRAPHIC FOCUS — FRIDAY (Tier 4 — Nevada + Oregon): Search opportunistically for Track 1:
- Nevada: Clark County + City of Las Vegas, Henderson, North Las Vegas, Reno, Sparks, Washoe County, Carson City, Nevada DOT, Regional Transportation Commission of Southern Nevada (RTC), Regional Transportation Commission of Washoe County, Nevada Division of State Lands, Southern Nevada Water Authority
- Oregon: Portland Metro, City of Portland (BES, Planning), Multnomah County, Clackamas County, Washington County, TriMet, Eugene/Lane County, Salem/Marion County, Oregon DOT, Oregon DEQ, Oregon Department of Land Conservation and Development (DLCD)
- Focus on: public engagement, facilitation, consensus building, environmental planning scopes
- Note: These are lowest priority geographies — only flag truly strong fits (engagement/facilitation primary scope, competitive value estimate)
Track 2 news: Nevada + Oregon public controversy and planning news.`
      };
    }

  } else {
    // Weekend fallback (shouldn't trigger via cron but just in case)
    return {
      label: "Default — Full Bay Area",
      instructions: `Search all Tier 1 Bay Area geographies broadly per the system prompt.`
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getDateContext() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Los_Angeles"
  });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);
  const cutoffStr = cutoff.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles"
  });
  return { today, cutoffStr };
}

async function runClaudeSearch(userPrompt, attempt = 1, systemPromptOverride = null) {
  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      system: systemPromptOverride || SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    const response = await stream.finalMessage();
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }
    return text;
  } catch (err) {
    if (err.status === 429 && attempt <= 3) {
      const retryAfter = parseInt(err.headers?.get?.("retry-after") || "120", 10);
      const waitMs = (retryAfter + 10) * 1000;
      console.log(`[${new Date().toISOString()}] Rate limited — waiting ${retryAfter + 10}s before retry ${attempt}/3`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return runClaudeSearch(userPrompt, attempt + 1, systemPromptOverride);
    }
    // Retry on socket/connection errors from Anthropic API (HTTP/2 drops)
    const isSocketError = err.code === 'UND_ERR_SOCKET' || err.message?.includes('other side closed') || err.message?.includes('socket');
    if (isSocketError && attempt <= 3) {
      const waitMs = attempt * 15000;
      console.log(`[${new Date().toISOString()}] Socket error on Claude API — retrying in ${waitMs/1000}s (attempt ${attempt}/3)`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return runClaudeSearch(userPrompt, attempt + 1, systemPromptOverride);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main report runner — two sequential calls to stay within rate limits
// ─────────────────────────────────────────────────────────────────────────────
async function runMORSReport() {
  const { today, cutoffStr } = getDateContext();
  const reportDate = new Date().toISOString().split("T")[0];
  const geo = getGeoFocus();

  console.log(`[${new Date().toISOString()}] Starting MORS report for ${today} — ${geo.label}`);

  // ── Fetch everything in parallel — memory, sources, news RSS, portal scrapers ──
  const [memoryPatterns, searchSources, mediaSources, existingOpps, newsItems, findrfpOpps, opengovOpps, bonfireOpps, planetbidsOpps, biddingusaOpps, bidnetOpps, civicengageOpps, standaloneOpps] = await Promise.all([
    fetchProjectMemory(),
    fetchSearchSources(),
    fetchMediaSources(),
    fetchExistingOppTitles(cutoffStr),
    fetchAllNewsItems(),
    scrapeFindrfp(),
    scrapeOpengov(),
    scrapeBonfire(),
    scrapePlanetbids(),
    scrapeBiddingusa(),
    scrapeBidnet(),
    scrapeCivicengage(),
    scrapeStandalonePages()
  ]);

  // Seen-titles set — grows as we save, prevents within-run and cross-run duplicates
  const seenTitles = existingOpps.map(o => normalizeTitle(o.title));
  function isDuplicate(title) {
    const n = normalizeTitle(title);
    if (!n) return false;
    if (seenTitles.some(s => titlesMatch(title, s.replace(/\[via [^\]]+\]/gi, '').trim()))) return true;
    seenTitles.push(n);
    return false;
  }

  // Build dynamic system prompt additions
  let dynamicSystemPrompt = SYSTEM_PROMPT;
  if (memoryPatterns.length > 0) {
    const critical = memoryPatterns.filter(p => p.startsWith('CRITICAL:'));
    const other = memoryPatterns.filter(p => !p.startsWith('CRITICAL:'));
    let feedbackSection = `\n\n═══════════════════════════════════════════════════════════════\nQUALITY RULES LEARNED FROM USER FEEDBACK (MUST FOLLOW):\n═══════════════════════════════════════════════════════════════`;
    if (critical.length > 0) feedbackSection += `\n\n${critical.join('\n\n')}`;
    if (other.length > 0) feedbackSection += `\n\nOther feedback patterns:\n${other.join('\n')}`;
    dynamicSystemPrompt += feedbackSection;
  }

  // Build search sources injection for Track 1
  let sourcesInjection = '';
  if (searchSources.length > 0) {
    const sourceLines = searchSources.map(s => {
      let line = `- ${s.site_name}`;
      if (s.url) line += ` (${s.url})`;
      if (s.portal_type) line += ` [${s.portal_type}]`;
      if (s.username) line += ` — username: ${s.username}`;
      if (s.notes) line += ` — ${s.notes}`;
      return line;
    }).join('\n');
    sourcesInjection = `\n\nADDITIONAL SEARCH SOURCES (check these in addition to defaults):\n${sourceLines}`;
  }

  // Build portal scraped opps block for Track 1 prompt
  const allPortalOpps = [
    ...findrfpOpps,
    ...opengovOpps,
    ...bonfireOpps,
    ...planetbidsOpps,
    ...biddingusaOpps,
    ...bidnetOpps,
    ...civicengageOpps,
    ...standaloneOpps
  ];
  const portalBlock = allPortalOpps.length > 0
    ? `\n\nPRE-SCRAPED PORTAL OPPORTUNITIES (${allPortalOpps.length} items from procurement portals — use these as your PRIMARY Track 1 source):\n` +
      allPortalOpps.slice(0, 150).map((o, i) =>
        `${i+1}. ${o.title} | ${o.agency || ''} | Due: ${o.deadline || 'unknown'} | ${o.source_url || ''}`
      ).join('\n')
    : '';

  console.log(`[${new Date().toISOString()}] Memory patterns: ${memoryPatterns.length}, Search sources: ${searchSources.length}, Portal opps for prompt: ${allPortalOpps.length}`);
  console.log(`[${new Date().toISOString()}] Call 1: Tracks 1+2`);

  // ── Call 1: Track 1 (RFPs) + Track 2 (Emerging Issues) ───────────────────
  const prompt1 = `Today is ${today}.

Run MORS Tracks 1 and 2 only.

CRITICAL DATE FILTER: Only include RFPs issued after ${cutoffStr} (last 45 days).

CRITICAL SOLICITATION FILTER: Track 1 must contain ONLY active procurement solicitations where Bluhon could submit a formal proposal or qualifications package.

A VALID Track 1 item MUST have ALL of the following:
1. A solicitation number (e.g. RFP 2026-01, RFQ-24-003, Bid No. 12345, IFB #2026-002)
2. A proposal/submission due date in the future
3. A source URL that is a procurement or bids listing page — NOT a news article, project page, or agency home page
4. A contact person or contracting office listed

EXCLUDE everything that does not meet all 4 criteria — even if it came from the pre-scraped list:
- Community meeting notices, public hearings, workshops, open houses
- Project announcements, program descriptions, agency newsletters
- News articles or press releases about public engagement work
- Notices about an ongoing process Bluhon was not invited to bid on
- Any item where you cannot identify a solicitation number and future deadline

When in doubt, leave it out. 3 real RFPs is a far better result than 10 mixed entries.

CRITICAL URL RULE: Use only the exact source_url provided in the pre-scraped data below. NEVER construct, guess, or modify URLs.

${geo.instructions}

TRACK 1 INSTRUCTIONS:
Your PRIMARY source is the PRE-SCRAPED PORTAL OPPORTUNITIES list below — these were pulled from procurement portals this morning. Review each one and ONLY include it if it is a genuine open solicitation (RFP, RFQ, IFB, SOQ) with a formal submission deadline. If any item looks like a community meeting notice, project announcement, public hearing, or agency newsletter — EXCLUDE it even if it came from this list. Select the 8-12 most relevant genuine solicitations to Bluhon's services (public engagement, facilitation, mediation, community outreach, consensus building, environmental conflict resolution, strategic planning).

If the pre-scraped list has fewer than 5 strong matches, you may supplement by searching caleprocure.ca.gov for: "public engagement", "community outreach", "facilitation", "consensus", "strategic plan" — but ONLY add results you can verify are open solicitations with a direct procurement URL.

Flag prior Bluhon clients: ABAG ✅, BCDC ✅, SF Regional Water Board ✅, Cities of Berkeley/Oakland/Palo Alto/San Jose/San Mateo/Redwood City/Livermore/Novato/Half Moon Bay/Danville ✅, Contra Costa County ✅, Alameda County ✅, Marin County ✅, Santa Clara County ✅, Sonoma County ✅${sourcesInjection}${portalBlock}

TRACK 2 INSTRUCTIONS — LOCAL CONFLICTS & EMERGING ISSUES:
The news items below were pre-fetched this morning from ${newsItems.length} Bay Area and California local news outlets via RSS. You do NOT need to search the web for Track 2. Your job is to ANALYZE these pre-fetched items and identify the most relevant ones for Bluhon.

PROHIBITED: Do NOT include statewide legislation, Sacramento bills, or abstract policy debates.
REQUIRED: Every item you surface must name a SPECIFIC PLACE, specific PROJECT OR DISPUTE, and specific PARTIES involved.

PRE-FETCHED NEWS ITEMS (past 72 hours):
${formatNewsItemsForPrompt(newsItems, 'Track 2')}

For each item you select, write:
- The SPECIFIC project, facility, permit, or dispute (land use, CEQA, facility siting, infrastructure, environmental)
- WHO is in conflict (community groups, agencies, developers, environmental orgs)
- WHERE exactly (city/county/neighborhood)
- WHY Bluhon is relevant (public engagement, facilitation, CEQA, conflict resolution, stakeholder assessment)
- Who at the agency Bluhon should contact
- Link to the source article

Include up to 25 items. The pre-fetched items are already sorted by relevance score (most relevant to Bluhon's core work first). Maintain this ordering in your output, but use your judgment to elevate any item where the headline undersells its significance (e.g. a CEQA dispute buried in a general planning story).

TRACK 2 OUTPUT FORMAT: Group items under these <h2> headings based on the source outlet type:
<h2>Local News</h2>  — neighborhood/city-level outlets
<h2>Regional News</h2>  — county-wide or multi-county outlets
<h2>Agency Board</h2>  — special district or state/federal agency sources
<h2>County Board</h2>  — county BOS or county planning commission
<h2>City Board</h2>  — city council or city planning commission

OUTPUT FORMAT — you MUST output ALL THREE sections below in this exact order. Do not skip any section.

---TRACK1_START---
[HTML table]
---TRACK1_END---

---TRACK2_START---
[HTML unordered list]
---TRACK2_END---

---OPPORTUNITIES_JSON_START---
[JSON array — one object per Track 1 row, REQUIRED, do not omit this section]
[{"title":"...","agency":"...","deadline":"YYYY-MM-DD or null","track":"Track 1","scope":"...","source_url":"https://...","pursuit_type":"Prime or Sub/Team","prior_client":false,"geo_tier":"Tier 1"}]
---OPPORTUNITIES_JSON_END---`;
  const text1 = await runClaudeSearch(prompt1, 1, dynamicSystemPrompt);

  console.log(`[${new Date().toISOString()}] Call 1 complete — Call 2: Tracks 3+4`);

  const t4Media = mediaSources.filter(s => s.track === 'Track 4').map(s => `${s.name} (${s.url})`).join(', ');
  const t3NewsItems = formatNewsItemsForPrompt(newsItems, 'Track 3');
  const airtableFirms = await fetchFirmsFromAirtable();
  const primeFirmsStr = airtableFirms.filter(f => f.type === 'Prime Firm').map(f => f.name).join(', ') ||
    'AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Arup, Fehr & Peers, Kimley-Horn, GHD, EPS Group, Atkins, Burns & McDonnell, ARCADIS, Dudek';
  const competitorsStr = airtableFirms.filter(f => f.type === 'Competitor').map(f => f.name).join(', ') ||
    'MIG, PlaceWorks, Circlepoint, Raimi+Associates, Rincon Consultants, Mintier Harnish, CONCUR, DC&E, Civic Edge, Stakeholder Communications Group';

  // ── Call 2: Track 3 (Contract Awards + Firm News) + Track 4 (Governing Body Pipeline) ───
  const prompt2 = `Today is ${today}.

Run MORS Tracks 3 and 4 only.

TRACK 3 INSTRUCTIONS — CONTRACT AWARDS & PRIME FIRM INTELLIGENCE:
Goal: Find recent (past 30 days) California contract awards, RFP wins, and firm moves relevant to Bluhon teaming opportunities.

PRE-FETCHED ITEMS (from ENR, Planetizen, SF Business Times RSS — analyze these first):
${t3NewsItems}

Also search the web for:
- Bay Area board minutes and city council agendas (past 30 days) for contract awards to prime firms
- Firm press releases and LinkedIn announcements not captured in the RSS items above

PRIME FIRMS to track for teaming: ${primeFirmsStr}
For each award: firm name, agency, contract value if known, scope (flag if public engagement sub-scope exists), Bluhon teaming angle.

DIRECT COMPETITORS to monitor: ${competitorsStr}
For competitors: wins, new hires, press mentions that reveal where they are targeting.

Include up to 25 items total. Format each with firm name as heading, details, Bluhon angle on a new line.

TRACK 4 INSTRUCTIONS — GOVERNING BODY PIPELINE (pre-RFP signals):
Goal: Identify projects being DISCUSSED at Bay Area governing bodies that will produce RFPs in 3–18 months.
Use real-time web search to check agendas and minutes from the past 14 days:
${t4Media || 'MTC/ABAG, SF BOS, Oakland City Council, Berkeley City Council, all 9 Bay Area county BOS pages, San Jose/Richmond/Palo Alto/Novato/Livermore/Danville city councils'}

WHAT TO LOOK FOR:
- Authorization to issue an RFP ⭐ (most immediate)
- Approval of study/assessment requiring outside consultants
- Budget allocation for planning, engagement, or environmental project
- Direction to initiate stakeholder process or master plan
- Grant/federal funding approval for projects needing public involvement
- EIR or CEQA process authorization
- Community task force or advisory committee formation

For each: governing body, meeting date, agenda item title, what was directed, timeline to RFP, Bluhon service fit.
Include up to 25 items total. Flag ⭐ if RFP authorization was granted.

TRACK 4 OUTPUT FORMAT: Group under <h2> headings:
<h2>Agency Board</h2>  — MTC, BAAQMD, BCDC, RWQCB, Coastal Commission, BART, etc.
<h2>County Board</h2>  — board of supervisors, county planning commissions
<h2>City Board</h2>  — city councils, city planning commissions

OUTPUT FORMAT — use exactly these delimiters:

---TRACK3_START---
[HTML unordered list]
---TRACK3_END---

---TRACK4_START---
[HTML unordered list]
---TRACK4_END---`;
  const text2 = await runClaudeSearch(prompt2, 1, dynamicSystemPrompt);

  console.log(`[${new Date().toISOString()}] Call 2 complete — parsing and saving`);

  // ── Parse ─────────────────────────────────────────────────────────────────
  const track1Match = text1.match(/---TRACK1_START---([\s\S]*?)---TRACK1_END---/);
  const track2Match = text1.match(/---TRACK2_START---([\s\S]*?)---TRACK2_END---/);
  const track3Match = text2.match(/---TRACK3_START---([\s\S]*?)---TRACK3_END---/);
  const track4Match = text2.match(/---TRACK4_START---([\s\S]*?)---TRACK4_END---/);
  const oppsMatch   = text1.match(/---OPPORTUNITIES_JSON_START---([\s\S]*?)---OPPORTUNITIES_JSON_END---/);

  const track1_html = track1Match ? track1Match[1].trim() : "<p>No Track 1 data.</p>";
  const track2_html = track2Match ? track2Match[1].trim() : "<p>No Track 2 data.</p>";
  const track3_html = track3Match ? track3Match[1].trim() : "<p>No Track 3 data.</p>";
  const track4_html = track4Match ? track4Match[1].trim() : "<p>No Track 4 data.</p>";

  // ── Save report ───────────────────────────────────────────────────────────
  const saved = await atPost(AIRTABLE_REPORTS_TABLE, {
    report_date: reportDate,
    run_timestamp: new Date().toISOString(),
    track1_html,
    track2_html,
    track3_html,
    track4_html
  });
  console.log(`[${new Date().toISOString()}] Report saved — ID: ${saved.id}`);

  // ── Save individual opportunities — parsed from Track 1 HTML table ───────
  const opps = parseTrack1Opps(track1_html, reportDate);
  console.log(`[${new Date().toISOString()}] Parsed ${opps.length} opportunities from Track 1 HTML`);
  let oppCount = 0, oppSkipped = 0;
  for (const opp of opps) {
    if (isDuplicate(opp.title)) { oppSkipped++; continue; }
    try {
      await atPost(AIRTABLE_OPPS_TABLE, {
        title:      opp.title,
        agency:     opp.agency,
        deadline:   opp.deadline || null,
        track:      "1 — Active RFP",
        scope:      opp.scope,
        source_url: opp.source_url
      });
      oppCount++;
    } catch(e) {
      console.warn(`Opp save failed (${opp.title}):`, e.message);
    }
  }
  console.log(`[${new Date().toISOString()}] Saved ${oppCount} Claude opportunities (${oppSkipped} duplicates skipped)`);

  // ── Save FindRFP.com scraped opportunities ────────────────────────────────
  let findrfpCount = 0, findrfpSkipped = 0;
  for (const opp of findrfpOpps) {
    if (isDuplicate(opp.title)) { findrfpSkipped++; continue; }
    try {
      await atPost(AIRTABLE_OPPS_TABLE, {
        title:      `${opp.title} [via FindRFP]`,
        agency:     opp.agency,
        deadline:   opp.deadline || null,
        track:      "1 — Active RFP",
        scope:      opp.scope,
        source_url: opp.source_url
      });
      findrfpCount++;
    } catch(e) {
      console.warn(`FindRFP opp save failed (${opp.title}):`, e.message);
    }
  }
  if (findrfpCount > 0 || findrfpSkipped > 0) console.log(`[${new Date().toISOString()}] Saved ${findrfpCount} FindRFP opportunities (${findrfpSkipped} duplicates skipped)`);

  // ── Save portal-scraped opportunities ─────────────────────────────────────
  const portalOpps = [
    ...opengovOpps.map(o => ({ ...o, tag: '[via OpenGov]' })),
    ...bonfireOpps.map(o => ({ ...o, tag: '[via Bonfire]' })),
    ...planetbidsOpps.map(o => ({ ...o, tag: '[via PlanetBids]' })),
    ...biddingusaOpps.map(o => ({ ...o, tag: '[via BiddingUSA]' })),
    ...bidnetOpps.map(o => ({ ...o, tag: '[via BidNet]' })),
    ...civicengageOpps.map(o => ({ ...o, tag: '[via CivicEngage]' })),
    ...standaloneOpps.map(o => ({ ...o, tag: '[via Direct]' }))
  ];
  let portalCount = 0, portalSkipped = 0;
  for (const opp of portalOpps) {
    if (isDuplicate(opp.title)) { portalSkipped++; continue; }
    try {
      await atPost(AIRTABLE_OPPS_TABLE, {
        title:      `${opp.title} ${opp.tag}`,
        agency:     opp.agency,
        deadline:   opp.deadline || null,
        track:      "1 — Active RFP",
        scope:      opp.scope,
        source_url: opp.source_url
      });
      portalCount++;
    } catch(e) { console.warn(`Portal opp save failed (${opp.title}):`, e.message); }
  }
  if (portalCount > 0 || portalSkipped > 0) console.log(`[${new Date().toISOString()}] Saved ${portalCount} portal opportunities (${portalSkipped} duplicates skipped — OpenGov/Bonfire/PlanetBids/BiddingUSA/BidNet/CivicEngage/Direct)`);

  // ── Parse and save Track 2 items individually ─────────────────────────────
  if (track2_html && track2_html !== "<p>No Track 2 data.</p>") {
    const items = parseTrack2Items(track2_html);
    let t2Count = 0;
    for (const item of items) {
      try {
        await atPost(AIRTABLE_TRACK2_TABLE, {
          headline:     item.headline    || "Untitled",
          summary:      item.summary     || "",
          bluhon_angle: item.bluhon_angle || "",
          source_url:   item.source_url  || "",
          report_date:  reportDate,
          geo_focus:    geo.label,
          interested:   false
        });
        t2Count++;
      } catch(e) {
        console.warn(`Track2 item save failed (${item.headline}):`, e.message);
      }
    }
    console.log(`[${new Date().toISOString()}] Saved ${t2Count} Track 2 items`);
  }

  return saved;
}

// Parse Track 1 HTML table rows into opportunity objects
function parseTrack1Opps(html, reportDate) {
  const opps = [];
  const rowMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const row of rowMatches) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue; // skip header rows
    const agency = cells[0] || '';
    const title  = cells[1] || '';
    const due    = cells[2] || '';
    const scope  = cells[3] || '';
    const type   = cells[4] || '';
    // Extract URL from the row
    const urlMatch = row.match(/href="([^"]+)"/i);
    const source_url = urlMatch ? urlMatch[1] : '';
    // Parse deadline — look for date patterns
    const dateMatch = due.match(/(\d{4}-\d{2}-\d{2})|(\w+ \d{1,2},? \d{4})/);
    let deadline = null;
    if (dateMatch) {
      const parsed = new Date(dateMatch[0]);
      if (!isNaN(parsed)) deadline = parsed.toISOString().split('T')[0];
    }
    if (!agency && !title) continue;
    opps.push({ title: title || 'Untitled', agency, deadline, scope: scope || type, source_url });
  }
  return opps;
}

// Parse Track 2 HTML list items into structured objects
function parseTrack2Items(html) {
  const items = [];
  // Match each <li>...</li>
  const liMatches = html.match(/<li>([\s\S]*?)<\/li>/gi) || [];
  for (const li of liMatches) {
    const stripped = li.replace(/<li>/i, '').replace(/<\/li>/i, '');
    // Headline is in <strong>...</strong>
    const headlineMatch = stripped.match(/<strong>([\s\S]*?)<\/strong>/i);
    const headline = headlineMatch ? headlineMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    // Bluhon angle is after <em>Bluhon angle:</em>
    const angleMatch = stripped.match(/<em>Bluhon angle:<\/em>([\s\S]*?)(?:Source:|$)/i);
    const bluhon_angle = angleMatch ? angleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    // Source URL
    const urlMatch = stripped.match(/href="([^"]+)"/i);
    const source_url = urlMatch ? urlMatch[1] : '';
    // Summary is everything between headline and bluhon angle
    const summaryRaw = stripped
      .replace(/<strong>[\s\S]*?<\/strong>/i, '')
      .replace(/<em>Bluhon angle:<\/em>[\s\S]*/i, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    items.push({ headline, summary: summaryRaw, bluhon_angle, source_url });
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.post("/run", async (req, res) => {
  // Respond immediately so the frontend can poll for completion
  res.json({ success: true, status: 'started' });
  try {
    await runMORSReport();
    console.log(`[${new Date().toISOString()}] Manual run complete`);
  } catch (err) {
    console.error("Report run failed:", err);
  }
});

// ─── POST /seed-standalone-sources ───────────────────────────────────────────
app.post("/seed-standalone-sources", async (req, res) => {
  try {
    const existing = await atGet(AIRTABLE_SOURCES_TABLE, `?filterByFormula=${encodeURIComponent('{source_type}="Standalone"')}&fields[]=source_name&maxRecords=300`);
    const existingNames = new Set((existing.records || []).map(r => (r.fields.source_name||'').toLowerCase()));
    let added = 0;
    for (const page of STANDALONE_PAGES) {
      if (existingNames.has(page.name.toLowerCase())) continue;
      await atPost(AIRTABLE_SOURCES_TABLE, {
        source_name: page.name,
        url:         page.url,
        source_type: 'Standalone',
        active:      true
      });
      added++;
    }
    res.json({ success: true, added, skipped: STANDALONE_PAGES.length - added });
  } catch (err) {
    console.error('[/seed-standalone-sources]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MORS Runner", timestamp: new Date().toISOString() });
});

app.get("/config", (req, res) => {
  res.json({ airtable_token: AIRTABLE_TOKEN, base_id: AIRTABLE_BASE_ID });
});

// File upload — write to /tmp (writable on Render), serve via /files/
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const uploadDir = '/tmp/mors-files';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.use('/files', express.static(uploadDir));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const url = 'https://mors-runner.onrender.com/files/' + req.file.filename;
  res.json({ url, name: req.file.originalname, size: req.file.size });
});

app.use(express.static("public"));

app.post("/test-run", async (req, res) => {
  res.json({ success: true, status: "Test run started — check Airtable in 3-4 minutes" });
  const { today, cutoffStr } = getDateContext();
  const reportDate = new Date().toISOString().split("T")[0];
  console.log(`[${new Date().toISOString()}] TEST RUN starting — SF + Marin + Oakland only`);
  try {
    const text = await runClaudeSearch(`Today is ${today}.

This is a TEST run — search only these 3 jurisdictions for Track 1:
- City & County of San Francisco (Planning, DPW, SFPUC)
- Marin County + City of San Rafael + City of Novato
- City of Oakland + Alameda County

Search caleprocure.ca.gov and PlanetBids for these agencies only.
Find at least 3 real verifiable opportunities.
Flag prior Bluhon clients: ABAG ✅, Cities of Oakland/Novato ✅, Marin County ✅

Also do a brief Track 2: 3 emerging issues from SF Bay Area news in past 48 hours.

CRITICAL DATE FILTER: Only include RFPs issued after ${cutoffStr}.

OUTPUT FORMAT — use exactly these delimiters:

---TRACK1_START---
[HTML table]
---TRACK1_END---

---TRACK2_START---
[HTML unordered list]
---TRACK2_END---

---OPPORTUNITIES_JSON_START---
[JSON array]
---OPPORTUNITIES_JSON_END---`);

    const track1Match = text.match(/---TRACK1_START---([\s\S]*?)---TRACK1_END---/);
    const track2Match = text.match(/---TRACK2_START---([\s\S]*?)---TRACK2_END---/);
    const oppsMatch   = text.match(/---OPPORTUNITIES_JSON_START---([\s\S]*?)---OPPORTUNITIES_JSON_END---/);
    const track1_html = track1Match ? track1Match[1].trim() : "<p>No Track 1 data.</p>";
    const track2_html = track2Match ? track2Match[1].trim() : "<p>No Track 2 data.</p>";

    const saved = await atPost(AIRTABLE_REPORTS_TABLE, {
      report_date: reportDate, track1_html, track2_html,
      track3_html: "<p>Test run — Tracks 3+4 skipped.</p>",
      track4_html: "<p>Test run — Tracks 3+4 skipped.</p>"
    });
    console.log(`[${new Date().toISOString()}] TEST RUN report saved — ID: ${saved.id}`);

    if (oppsMatch) {
      let opps = [];
      try { opps = JSON.parse(oppsMatch[1].trim().replace(/^```json\s*/, '').replace(/```\s*$/, '')); } catch(e) {}
      for (const opp of opps) {
        try { await atPost(AIRTABLE_OPPS_TABLE, { title: opp.title||'Untitled', agency: opp.agency||'', deadline: opp.deadline||null, track: '1 — Active RFP', scope: opp.scope||'', source_url: opp.source_url||'' }); } catch(e) {}
      }
    }
    if (track2_html && track2_html !== "<p>No Track 2 data.</p>") {
      const items = parseTrack2Items(track2_html);
      for (const item of items) {
        try { await atPost(AIRTABLE_TRACK2_TABLE, { headline: item.headline||'', summary: item.summary||'', bluhon_angle: item.bluhon_angle||'', source_url: item.source_url||'', report_date: reportDate, geo_focus: 'Test — SF+Marin+Oakland', interested: false }); } catch(e) {}
      }
    }
    console.log(`[${new Date().toISOString()}] TEST RUN complete`);
  } catch(err) {
    console.error("Test run failed:", err.message);
  }
});

// ─── GET /seed-media — one-time seed of MEDIA_SOURCES table ─────────────────
app.get("/seed-media", async (req, res) => {
  const MEDIA_SEED = [
    // Track 2 — Local News (Bay Area Tier 1)
    { source_name: 'SF Chronicle',              url: 'https://www.sfchronicle.com',                   track: 'Track 2', geography: 'Bay Area',          county: '',              source_type: 'Regional News' },
    { source_name: 'SF Examiner',               url: 'https://www.sfexaminer.com',                    track: 'Track 2', geography: 'San Francisco',    county: 'San Francisco', source_type: 'Local News' },
    { source_name: 'Mission Local',             url: 'https://missionlocal.org',                      track: 'Track 2', geography: 'San Francisco',    county: 'San Francisco', source_type: 'Local News' },
    { source_name: 'Hoodline SF',               url: 'https://hoodline.com',                          track: 'Track 2', geography: 'San Francisco',    county: 'San Francisco', source_type: 'Local News' },
    { source_name: 'East Bay Times',            url: 'https://www.eastbaytimes.com',                  track: 'Track 2', geography: 'East Bay',          county: '',              source_type: 'Regional News' },
    { source_name: 'Berkeleyside',              url: 'https://www.berkeleyside.org',                  track: 'Track 2', geography: 'Berkeley',          county: 'Alameda',       source_type: 'Local News' },
    { source_name: 'The Oaklandside',           url: 'https://oaklandside.org',                       track: 'Track 2', geography: 'Oakland',           county: 'Alameda',       source_type: 'Local News' },
    { source_name: 'Alameda Sun',               url: 'https://www.alamedasun.com',                    track: 'Track 2', geography: 'Alameda',           county: 'Alameda',       source_type: 'Local News' },
    { source_name: 'Marin Independent Journal', url: 'https://www.marinij.com',                       track: 'Track 2', geography: 'Marin',             county: 'Marin',         source_type: 'Regional News' },
    { source_name: 'Marin Post',                url: 'https://marinpost.org',                         track: 'Track 2', geography: 'Marin',             county: 'Marin',         source_type: 'Local News' },
    { source_name: 'Novato Advance',            url: 'https://www.novatoadvance.com',                 track: 'Track 2', geography: 'Novato',            county: 'Marin',         source_type: 'Local News' },
    { source_name: 'San Jose Mercury News',     url: 'https://www.mercurynews.com',                   track: 'Track 2', geography: 'South Bay',         county: 'Santa Clara',   source_type: 'Regional News' },
    { source_name: 'San Jose Spotlight',        url: 'https://sanjosespotlight.com',                  track: 'Track 2', geography: 'San Jose',          county: 'Santa Clara',   source_type: 'Local News' },
    { source_name: 'The Palo Alto Weekly',      url: 'https://www.paloaltoonline.com',                track: 'Track 2', geography: 'Palo Alto',         county: 'Santa Clara',   source_type: 'Local News' },
    { source_name: 'Mountain View Voice',       url: 'https://www.mv-voice.com',                      track: 'Track 2', geography: 'Mountain View',     county: 'Santa Clara',   source_type: 'Local News' },
    { source_name: 'Sunnyvale Sun',             url: 'https://svcnews.com',                           track: 'Track 2', geography: 'Sunnyvale',         county: 'Santa Clara',   source_type: 'Local News' },
    { source_name: 'Daily Post (Palo Alto)',    url: 'https://padailypost.com',                       track: 'Track 2', geography: 'South Bay',         county: 'Santa Clara',   source_type: 'Local News' },
    { source_name: 'The Daily Californian',     url: 'https://www.dailycal.org',                      track: 'Track 2', geography: 'Berkeley',          county: 'Alameda',       source_type: 'Local News' },
    { source_name: 'Richmond Standard',         url: 'https://richmondstandard.com',                  track: 'Track 2', geography: 'Richmond',          county: 'Contra Costa',  source_type: 'Local News' },
    { source_name: 'Contra Costa Times',        url: 'https://www.eastbaytimes.com/tag/contra-costa', track: 'Track 2', geography: 'Contra Costa',      county: 'Contra Costa',  source_type: 'Local News' },
    { source_name: 'East County Today (CCC)',   url: 'https://eastcountytoday.net',                   track: 'Track 2', geography: 'East Contra Costa', county: 'Contra Costa',  source_type: 'Local News' },
    { source_name: 'Antioch Herald',            url: 'https://www.antiochherald.com',                 track: 'Track 2', geography: 'Antioch',           county: 'Contra Costa',  source_type: 'Local News' },
    { source_name: 'Livermore Independent',     url: 'https://www.livermorenewsindependent.com',      track: 'Track 2', geography: 'Livermore',         county: 'Alameda',       source_type: 'Local News' },
    { source_name: 'Valley Times (Pleasanton)', url: 'https://www.eastbaytimes.com/tag/pleasanton',   track: 'Track 2', geography: 'Tri-Valley',        county: 'Alameda',       source_type: 'Local News' },
    { source_name: 'Half Moon Bay Review',      url: 'https://www.hmbreview.com',                     track: 'Track 2', geography: 'Half Moon Bay',     county: 'San Mateo',     source_type: 'Local News' },
    { source_name: 'San Mateo Daily Journal',   url: 'https://www.smdailyjournal.com',                track: 'Track 2', geography: 'San Mateo',         county: 'San Mateo',     source_type: 'Local News' },
    { source_name: 'Redwood City Pulse',        url: 'https://www.redwoodcitypulse.com',              track: 'Track 2', geography: 'Redwood City',      county: 'San Mateo',     source_type: 'Local News' },
    { source_name: 'Peninsula Press',           url: 'https://peninsulapress.com',                    track: 'Track 2', geography: 'Peninsula',         county: 'San Mateo',     source_type: 'Local News' },
    { source_name: 'Napa Valley Register',      url: 'https://napavalleyregister.com',                track: 'Track 2', geography: 'Napa',              county: 'Napa',          source_type: 'Local News' },
    { source_name: 'Sonoma Index-Tribune',      url: 'https://www.sonomanews.com',                    track: 'Track 2', geography: 'Sonoma',            county: 'Sonoma',        source_type: 'Local News' },
    { source_name: 'Santa Rosa Press Democrat', url: 'https://www.pressdemocrat.com',                 track: 'Track 2', geography: 'Sonoma',            county: 'Sonoma',        source_type: 'Regional News' },
    { source_name: 'North Bay Business Journal',url: 'https://www.northbaybusinessjournal.com',       track: 'Track 2', geography: 'North Bay',         county: '',              source_type: 'Regional News' },
    // Track 2 — Tier 2 geographies
    { source_name: 'Sacramento Bee',            url: 'https://www.sacbee.com',                        track: 'Track 2', geography: 'Sacramento',        county: 'Sacramento',    source_type: 'Regional News' },
    { source_name: 'Sacramento Business Journal', url: 'https://www.bizjournals.com/sacramento',      track: 'Track 2', geography: 'Sacramento',        county: 'Sacramento',    source_type: 'Regional News' },
    { source_name: 'CapRadio News',             url: 'https://www.capradio.org/news',                 track: 'Track 2', geography: 'Sacramento',        county: 'Sacramento',    source_type: 'Local News' },
    { source_name: 'Fresno Bee',                url: 'https://www.fresnobee.com',                     track: 'Track 2', geography: 'Fresno',            county: 'Fresno',        source_type: 'Regional News' },
    { source_name: 'Stockton Record',           url: 'https://www.recordnet.com',                     track: 'Track 2', geography: 'Stockton',          county: 'San Joaquin',   source_type: 'Local News' },
    { source_name: 'Bakersfield Californian',   url: 'https://www.bakersfield.com',                   track: 'Track 2', geography: 'Bakersfield',       county: 'Kern',          source_type: 'Local News' },
    { source_name: 'Salinas Californian',       url: 'https://www.thecalifornian.com',                track: 'Track 2', geography: 'Salinas',           county: 'Monterey',      source_type: 'Local News' },
    { source_name: 'Santa Cruz Sentinel',       url: 'https://www.santacruzsentinel.com',             track: 'Track 2', geography: 'Santa Cruz',        county: 'Santa Cruz',    source_type: 'Local News' },
    { source_name: 'Monterey Herald',           url: 'https://www.montereyherald.com',                track: 'Track 2', geography: 'Monterey',          county: 'Monterey',      source_type: 'Local News' },
    // Track 3 — Firm/contract news
    { source_name: 'Engineering News-Record',   url: 'https://www.enr.com',                           track: 'Track 3', geography: 'National',          county: '',              source_type: 'Regional News' },
    { source_name: 'Planetizen',                url: 'https://www.planetizen.com',                    track: 'Track 3', geography: 'National',          county: '',              source_type: 'Regional News' },
    { source_name: 'SF Business Times',         url: 'https://www.bizjournals.com/sanfrancisco',      track: 'Track 3', geography: 'Bay Area',          county: '',              source_type: 'Regional News' },
    { source_name: 'Silicon Valley Biz Journal',url: 'https://www.bizjournals.com/sanjose',           track: 'Track 3', geography: 'South Bay',         county: 'Santa Clara',   source_type: 'Regional News' },
    { source_name: 'GovWin / Deltek',           url: 'https://iq.govwin.com',                         track: 'Track 3', geography: 'National',          county: '',              source_type: 'Regional News' },
    { source_name: 'GovConWire',                url: 'https://www.govconwire.com',                    track: 'Track 3', geography: 'National',          county: '',              source_type: 'Regional News' },
    // Track 4 — Agency Boards
    { source_name: 'MTC/ABAG Agendas',          url: 'https://mtc.ca.gov/whats-happening/meetings',   track: 'Track 4', geography: 'Bay Area',          county: '',              source_type: 'Agency Board' },
    { source_name: 'BAAQMD Board',              url: 'https://www.baaqmd.gov/about-the-air-district/board-of-directors', track: 'Track 4', geography: 'Bay Area', county: '', source_type: 'Agency Board' },
    { source_name: 'East Bay Regional Parks Board', url: 'https://www.ebparks.org/about/board',       track: 'Track 4', geography: 'East Bay',          county: '',              source_type: 'Agency Board' },
    { source_name: 'BCDC Agendas',              url: 'https://bcdc.ca.gov/meetings/',                 track: 'Track 4', geography: 'Bay Area',          county: '',              source_type: 'Agency Board' },
    { source_name: 'SF Bay RWQCB',              url: 'https://www.waterboards.ca.gov/sanfranciscobay/board_info/agendas/', track: 'Track 4', geography: 'Bay Area', county: '', source_type: 'Agency Board' },
    { source_name: 'CA Coastal Commission',     url: 'https://www.coastal.ca.gov/meetings.html',      track: 'Track 4', geography: 'Statewide',         county: '',              source_type: 'Agency Board' },
    { source_name: 'SFPUC Commission',          url: 'https://sfpuc.org/about-us/commissions-and-advisory-bodies', track: 'Track 4', geography: 'San Francisco', county: 'San Francisco', source_type: 'Agency Board' },
    { source_name: 'BART Board',                url: 'https://www.bart.gov/about/bod/agendas',        track: 'Track 4', geography: 'Bay Area',          county: '',              source_type: 'Agency Board' },
    { source_name: 'Caltrans District 4',       url: 'https://dot.ca.gov/caltrans-near-me/district-4', track: 'Track 4', geography: 'Bay Area',         county: '',              source_type: 'Agency Board' },
    // Track 4 — County Boards
    { source_name: 'SF BOS',                    url: 'https://sfgov.org/bos/agendas',                 track: 'Track 4', geography: 'San Francisco',    county: 'San Francisco', source_type: 'County Board' },
    { source_name: 'Alameda County BOS',        url: 'https://www.acgov.org/board',                   track: 'Track 4', geography: 'Alameda County',   county: 'Alameda',       source_type: 'County Board' },
    { source_name: 'Contra Costa BOS',          url: 'https://www.contracosta.ca.gov/agendas',        track: 'Track 4', geography: 'Contra Costa',     county: 'Contra Costa',  source_type: 'County Board' },
    { source_name: 'Marin County BOS',          url: 'https://www.marincounty.org/depts/bs/board-agendas', track: 'Track 4', geography: 'Marin',       county: 'Marin',         source_type: 'County Board' },
    { source_name: 'Santa Clara County BOS',    url: 'https://www.sccgov.org/sites/bos/Pages/bos-agendas.aspx', track: 'Track 4', geography: 'Santa Clara', county: 'Santa Clara', source_type: 'County Board' },
    { source_name: 'Sonoma County BOS',         url: 'https://sonomacounty.ca.gov/boardofSupervisors', track: 'Track 4', geography: 'Sonoma',          county: 'Sonoma',        source_type: 'County Board' },
    { source_name: 'San Mateo County BOS',      url: 'https://www.smcgov.org/board-supervisors',      track: 'Track 4', geography: 'San Mateo',        county: 'San Mateo',     source_type: 'County Board' },
    { source_name: 'Napa County BOS',           url: 'https://www.countyofnapa.org/agendas',          track: 'Track 4', geography: 'Napa',             county: 'Napa',          source_type: 'County Board' },
    // Track 4 — City Boards
    { source_name: 'Oakland City Council',      url: 'https://www.oaklandca.gov/topics/city-council-agendas', track: 'Track 4', geography: 'Oakland',  county: 'Alameda',       source_type: 'City Board' },
    { source_name: 'Berkeley City Council',     url: 'https://www.cityofberkeley.info/city-council-meetings', track: 'Track 4', geography: 'Berkeley', county: 'Alameda',       source_type: 'City Board' },
    { source_name: 'San Jose City Council',     url: 'https://www.sanjoseca.gov/your-government/departments/city-clerk/city-council/agendas-minutes', track: 'Track 4', geography: 'San Jose', county: 'Santa Clara', source_type: 'City Board' },
    { source_name: 'Richmond City Council',     url: 'https://www.ci.richmond.ca.us/agendacenter',    track: 'Track 4', geography: 'Richmond',         county: 'Contra Costa',  source_type: 'City Board' },
    { source_name: 'Palo Alto City Council',    url: 'https://www.cityofpaloalto.org/city-council',   track: 'Track 4', geography: 'Palo Alto',        county: 'Santa Clara',   source_type: 'City Board' },
    { source_name: 'San Mateo City Council',    url: 'https://www.cityofsanmateo.org/agendacenter',   track: 'Track 4', geography: 'San Mateo',        county: 'San Mateo',     source_type: 'City Board' },
    { source_name: 'Novato City Council',       url: 'https://www.cityofnovato.org/agendacenter',     track: 'Track 4', geography: 'Novato',           county: 'Marin',         source_type: 'City Board' },
    { source_name: 'Livermore City Council',    url: 'https://www.cityoflivermore.net/agendacenter',  track: 'Track 4', geography: 'Livermore',        county: 'Alameda',       source_type: 'City Board' },
    { source_name: 'Danville Town Council',     url: 'https://www.danville.ca.gov/agendacenter',      track: 'Track 4', geography: 'Danville',         county: 'Contra Costa',  source_type: 'City Board' },
  ];

  try {
    let total = 0;
    for (let i = 0; i < MEDIA_SEED.length; i += 10) {
      const batch = MEDIA_SEED.slice(i, i + 10);
      const batchRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_MEDIA_TABLE}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: batch.map(s => ({ fields: { ...s, active: true } })), typecast: true })
      });
      if (!batchRes.ok) throw new Error(`Airtable batch POST failed: ${batchRes.status} ${await batchRes.text()}`);
      total += batch.length;
      console.log(`[seed-media] Batch ${Math.floor(i/10)+1}: ${batch.length} records posted (${total} total)`);
      await new Promise(r => setTimeout(r, 250));
    }
    res.json({ success: true, total, message: `Seeded ${total} records into MEDIA_SOURCES` });
  } catch (err) {
    console.error('[seed-media] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /feedback ───────────────────────────────────────────────────────────
app.post("/feedback", async (req, res) => {
  const { opp_id, reason, title, agency, source_url } = req.body || {};
  if (!opp_id) return res.status(400).json({ success: false, error: 'opp_id required' });
  try {
    // 1. Update the OPPORTUNITIES record
    await atPatch(AIRTABLE_OPPS_TABLE, opp_id, {
      interest: 'No'
    });

    // 2. Upsert PROJECT_MEMORY record
    const today = new Date().toISOString().split('T')[0];

    // Critical reasons get strong instructional language injected into system prompt
    let description;
    if (reason === 'News / Article (not a solicitation)') {
      description = `CRITICAL: "${title}" (${agency}) was flagged as a NEWS ARTICLE or PROJECT ANNOUNCEMENT — not an actual procurement solicitation. This is the most common Track 1 error. Track 1 must ONLY include open solicitations (RFP/RFQ/IFB/SOQ) with a formal submission deadline and a procurement portal link. Agency web pages, press releases, project announcements, and news articles about public engagement processes must NEVER appear in Track 1.`;
    } else if (reason === 'Not an RFP') {
      description = `CRITICAL: "${title}" (${agency}) was flagged as NOT an RFP — it was a meeting agenda, announcement, or non-procurement document, not an actual solicitation. Track 1 must ONLY include open solicitations with a procurement URL, RFP/RFQ number, or direct bid portal link.`;
    } else if (reason === 'Due date past') {
      description = `CRITICAL: "${title}" (${agency}) was flagged because the due date had already passed. Always verify the proposal deadline is in the future before including any opportunity in Track 1. Expired RFPs are useless and waste the user's time.`;
    } else {
      description = [reason, title, agency].filter(Boolean).join(' — ');
    }

    // Look for existing record with matching example_title
    let existingId = null;
    if (title) {
      const formula = encodeURIComponent(`{example_title}="${title.replace(/"/g, '\\"')}"`);
      const existing = await atGet(AIRTABLE_MEMORY_TABLE, `?filterByFormula=${formula}&maxRecords=1`);
      if (existing.records && existing.records.length > 0) {
        existingId = existing.records[0].id;
        const currentFreq = existing.records[0].fields.frequency || 0;
        await atPatch(AIRTABLE_MEMORY_TABLE, existingId, {
          frequency: currentFreq + 1,
          last_seen: today
        });
      }
    }

    if (!existingId) {
      await atPost(AIRTABLE_MEMORY_TABLE, {
        pattern_type:  'poor_result',
        description:   description,
        example_title: title || '',
        example_url:   source_url || '',
        frequency:     1,
        created_date:  today,
        last_seen:     today
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[/feedback] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cron: 9:30am PT Mon-Fri
cron.schedule("30 9 * * 1-5", () => {
  console.log("Cron triggered: running MORS report");
  runMORSReport().catch(err => console.error("Cron report failed:", err));
}, { timezone: "America/Los_Angeles" });

// Prevent socket errors from crashing the process — log and continue
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception (process kept alive):`, err.message, err.code || '');
});
process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled rejection (process kept alive):`, reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MORS Runner listening on port ${PORT}`);
  console.log("Cron scheduled: 9:30am PT Mon-Fri");
});
