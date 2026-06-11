import express from "express";
import cron from "node-cron";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const MORS_USE_OPENAI = /^(1|true|yes)$/i.test(process.env.MORS_USE_OPENAI || '');
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = "appallyGF2B2bkpIU";
const AIRTABLE_REPORTS_TABLE  = "tblnaSbxkGaoscwZj";
const AIRTABLE_OPPS_TABLE     = "tbleIossei7FDqi9H";
const AIRTABLE_TRACK2_TABLE   = "tbl4f7N5EoaKRwRXK";
const AIRTABLE_MEMORY_TABLE   = "tblNgcBpooPK9wOkD";  // PROJECT_MEMORY
const AIRTABLE_SOURCES_TABLE  = "tblsQwva2y8ABugYH";  // SEARCH_SOURCES (procurement portals)
const AIRTABLE_MEDIA_TABLE    = "tblANGqT4L4Yt1MFl"; // MEDIA_SOURCES
const AIRTABLE_SEARCH_QUERIES_TABLE = "tblWft5ytQe3NHByq"; // RFP_SEARCH_QUERIES
const AIRTABLE_KEYWORDS_TABLE = "tblRKf4ftCpv1q65Z";  // RELEVANCE_KEYWORDS

// Portal credentials — from Render environment variables
const OPENGOV_LOGIN       = process.env.OPENGOV_LOGIN       || '';
const OPENGOV_PASSWORD    = process.env.OPENGOV_PASSWORD    || '';
const BONFIRE_LOGIN       = process.env.BONFIRE_LOGIN       || '';
const BONFIRE_PASSWORD    = process.env.BONFIRE_PASSWORD    || '';
const PLANETBIDS_LOGIN    = process.env.PLANETBIDS_LOGIN    || '';
const PLANETBIDS_PASSWORD = process.env.PLANETBIDS_PASSWORD || '';
const BIDDINGUSA_LOGIN    = process.env.BIDDINGOUSA_LOGIN    || process.env.BIDDINGUSA_LOGIN    || '';
const BIDDINGUSA_PASSWORD = process.env.BIDDINGOUSA_PASSWORD || process.env.BIDDINGUSA_PASSWORD || '';
const BIDNET_LOGIN        = process.env.BIDNET_LOGIN        || '';
const BIDNET_PASSWORD     = process.env.BIDNET_PASSWORD     || '';
const CIVICENGAGE_LOGIN   = process.env.CIVICENGAGE_LOGIN   || '';
const CIVICENGAGE_PASSWORD= process.env.CIVICENGAGE_PASSWORD|| '';

// Log which portal credentials are available at startup
console.log('[CREDS]',
  `OpenGov:${OPENGOV_LOGIN?'✓':'✗'}`,
  `Bonfire:${BONFIRE_LOGIN?'✓':'✗'}`,
  `PlanetBids:${PLANETBIDS_LOGIN?'✓':'✗'}`,
  `BiddingUSA:${BIDDINGUSA_LOGIN?'✓':'✗'}`,
  `BidNet:${BIDNET_LOGIN?'✓':'✗'}`
);

const POSTED_CUTOFF_DAYS = 45;
function withinCutoff(dateStr) {
  if (!dateStr) return true; // unknown post date — include by default
  const d = new Date(dateStr);
  if (isNaN(d)) return true;
  return (Date.now() - d.getTime()) <= POSTED_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
}

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
- Deadline already passed (ANY past deadline = immediate disqualification, no exceptions)

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
- Solicitation #: include the RFP/RFQ/IFB number if known (e.g. RFP 2026-01). If not visible in the pre-scraped data, write "see portal" — do NOT omit the row.
- Due Date: include if known. If unknown write "see portal". Do NOT omit portal rows for missing deadline.
- Bold due date if within 10 days (<b>DATE</b>)
- Flag prior clients with ✅
- Type: "Prime" (engagement is primary scope) or "Sub/Team" (engagement is sub-scope)
- Source URL: use the exact URL from the pre-scraped data — never modify or reconstruct it

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
    body: JSON.stringify({ fields, typecast: true })
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
// Replaces "tell the model to search newspapers" with systematic daily coverage.
// Google News RSS covers every outlet simultaneously; direct feeds add depth.
// Items are pre-filtered for relevance before touching the model.
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
    const pub
