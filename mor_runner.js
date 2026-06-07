import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cron from "node-cron";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = "appallyGF2B2bkpIU";
const AIRTABLE_REPORTS_TABLE  = "tblnaSbxkGaoscwZj";
const AIRTABLE_OPPS_TABLE     = "tbleIossei7FDqi9H";
const AIRTABLE_TRACK2_TABLE   = "tbl4f7N5EoaKRwRXK";

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

Return as HTML table with columns: Agency | Project / Scope | Due Date | Est. Value | Type | Source URL
- Bold due date if within 10 days (<b>DATE</b>)
- Flag prior clients with ✅
- Type column: "Prime" (engagement is primary scope) or "Sub/Team" (engagement is sub-scope)
- Include scope detail so Bluhon can quickly assess fit
- Minimum 5 real, verifiable opportunities

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
// Airtable helper
// ─────────────────────────────────────────────────────────────────────────────
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

async function runClaudeSearch(userPrompt, attempt = 1) {
  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      system: SYSTEM_PROMPT,
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
      return runClaudeSearch(userPrompt, attempt + 1);
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
  console.log(`[${new Date().toISOString()}] Call 1: Tracks 1+2`);

  // ── Call 1: Track 1 (RFPs) + Track 2 (Emerging Issues) ───────────────────
  const text1 = await runClaudeSearch(`Today is ${today}.

Run MORS Tracks 1 and 2 only. Search thoroughly.

CRITICAL DATE FILTER: Only include RFPs issued after ${cutoffStr} (last 45 days).

${geo.instructions}

TRACK 1 INSTRUCTIONS:
- Search caleprocure.ca.gov using: "public engagement", "community outreach", "facilitation", "consensus", "strategic plan", "organizational assessment"
- Search PlanetBids filtering to today's geographic focus agencies
- Search individual agency procurement pages for today's geographic focus
- Find at least 5 real, verifiable opportunities from today's geographic zone
- If today's zone yields fewer than 5, supplement with high-priority Tier 1 opportunities from any Bay Area county
- Flag prior Bluhon clients: ABAG ✅, BCDC ✅, SF Regional Water Board ✅, Cities of Berkeley/Oakland/Palo Alto/San Jose/San Mateo/Redwood City/Livermore/Novato/Half Moon Bay/Danville ✅, Contra Costa County ✅, Alameda County ✅, Marin County ✅, Santa Clara County ✅, Sonoma County ✅

TRACK 2 INSTRUCTIONS:
- Search news from the past 72 hours focused on today's geographic zone (but include major statewide items)
- Look for: projects entering CEQA, community opposition, governance disputes, facility siting conflicts, agricultural/mining controversies
- Note the specific Bluhon service needed and who to call

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
---OPPORTUNITIES_JSON_END---`);

  console.log(`[${new Date().toISOString()}] Call 1 complete — Call 2: Tracks 3+4`);

  // ── Call 2: Track 3 (Prime Firms) + Track 4 (Competitors) ────────────────
  const text2 = await runClaudeSearch(`Today is ${today}.

Run MORS Tracks 3 and 4 only.

TRACK 3 INSTRUCTIONS:
- Search for recent California contract wins and job postings from: AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Arup, Fehr & Peers, Kimley-Horn, GHD, EPS
- Focus on contracts that include public engagement sub-scopes where Bluhon could team

TRACK 4 INSTRUCTIONS:
- Search for recent activity from direct competitors: MIG, PlaceWorks, Circlepoint, Raimi+Associates, Rincon Consultants, Mintier Harnish, CONCUR
- Look for recent wins, new hires, press releases, and gaps Bluhon could fill

OUTPUT FORMAT — use exactly these delimiters:

---TRACK3_START---
[HTML unordered list]
---TRACK3_END---

---TRACK4_START---
[HTML unordered list]
---TRACK4_END---`);

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
  let oppCount = 0;
  for (const opp of opps) {
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
  console.log(`[${new Date().toISOString()}] Saved ${oppCount} opportunities`);

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
  try {
    const record = await runMORSReport();
    res.json({ success: true, recordId: record.id });
  } catch (err) {
    console.error("Report run failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MORS Runner", timestamp: new Date().toISOString() });
});

app.get("/config", (req, res) => {
  res.json({ airtable_token: AIRTABLE_TOKEN, base_id: AIRTABLE_BASE_ID });
});

// File upload — store on Render disk, serve via /files/
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const uploadDir = './public/files';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

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

// Cron: 9:30am PT Mon-Fri
cron.schedule("30 9 * * 1-5", () => {
  console.log("Cron triggered: running MORS report");
  runMORSReport().catch(err => console.error("Cron report failed:", err));
}, { timezone: "America/Los_Angeles" });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MORS Runner listening on port ${PORT}`);
  console.log("Cron scheduled: 9:30am PT Mon-Fri");
});
