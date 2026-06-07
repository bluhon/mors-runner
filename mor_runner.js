import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cron from "node-cron";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = "appallyGF2B2bkpIU";
const AIRTABLE_REPORTS_TABLE  = "tblnaSbxkGaoscwZj";
const AIRTABLE_OPPS_TABLE     = "tbleIossei7FDqi9H";

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

const SYSTEM_PROMPT = `You are a senior business development researcher for Bluhon — a California public engagement, community outreach, consensus building, and stakeholder facilitation firm based in the San Francisco Bay Area. Bluhon's clients are public agencies running infrastructure, transportation, water, housing, energy, and environmental projects across California.

Your job is to produce a high-quality daily intelligence report. Search aggressively and specifically. Do not make up results — only report what you can verify with a source URL.

Return your report in EXACTLY this format (all six delimiters required):

---TRACK1_START---
[HTML content]
---TRACK1_END---

---TRACK2_START---
[HTML content]
---TRACK2_END---

---TRACK3_START---
[HTML content]
---TRACK3_END---

---OPPORTUNITIES_JSON_START---
[JSON array]
---OPPORTUNITIES_JSON_END---

═══════════════════════════════════════
TRACK 1 — ACTIVE RFPs & PROCUREMENT
═══════════════════════════════════════
Search specifically for open RFPs, RFQs, and solicitations where the primary or significant scope includes: public engagement, community outreach, stakeholder facilitation, consensus building, public participation, multilingual outreach, or communications planning.

Search these sources directly:
- caleprocure.ca.gov (California eProcure portal)
- PlanetBids listings for Bay Area agencies
- Caltrans procurement (dot.ca.gov/programs/procurement)
- MTC/ABAG (mtc.ca.gov)
- BART (bart.gov/about/business)
- SFMTA (sfmta.com/about-sfmta/procurement)
- EBMUD, SFPUC, Santa Clara Valley Water District procurement pages
- Bay Area county public works portals (Alameda, Contra Costa, Marin, San Mateo, Santa Clara, San Francisco)
- CalTrans District 4 and District 7 solicitations

Return as an HTML table with columns: Agency | Project / Scope | Due Date | Est. Value | Source URL
Bold the due date if within 30 days. Include scope detail so Bluhon can quickly assess fit.

═══════════════════════════════════════
TRACK 2 — EMERGING ISSUES & INTELLIGENCE
═══════════════════════════════════════
Search for news in the past 72 hours about:
- California infrastructure projects entering environmental review (CEQA/EIR/NEPA) — these will need public engagement services
- Bay Area housing, transit, or water projects facing community opposition or controversy
- New state legislation or executive orders affecting public participation requirements
- Agency budget approvals or bond measures that will trigger new procurements
- Upcoming public comment periods, scoping meetings, or environmental hearings

Return as an HTML unordered list. Each item: bold headline, 2-3 sentence summary, "Bluhon angle:" sentence explaining the BD relevance, Source: [linked citation].

═══════════════════════════════════════
TRACK 3 — PRIME FIRM ACTIVITY
═══════════════════════════════════════
Search for recent activity (past 2 weeks) from these firms that Bluhon partners with or competes against:
AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Mott MacDonald, LSA Associates, Arup, Fehr & Peers

Look for:
- Contract awards in California (search "[firm name] contract award California 2026")
- Job postings for public engagement / community outreach roles in CA
- Press releases about new California projects or office expansions
- RFP teaming announcements

Return as an HTML unordered list. Each item: Firm name in bold, activity type, brief description, Source.

═══════════════════════════════════════
OPPORTUNITIES JSON (for database)
═══════════════════════════════════════
After the three track sections, output a JSON array of every distinct RFP/solicitation from Track 1. Each object:
{
  "title": "project name / scope",
  "agency": "agency name",
  "deadline": "YYYY-MM-DD or null",
  "track": "Track 1",
  "scope": "one sentence describing the engagement scope",
  "source_url": "https://..."
}`;

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

async function runMORSReport() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Los_Angeles"
  });

  console.log(`[${new Date().toISOString()}] Starting MORS report for ${today}`);

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 45);
  const cutoffStr = cutoff.toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric", timeZone:"America/Los_Angeles" });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 9 }],
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Today is ${today}.

Run the full MORS daily intelligence report. Search thoroughly — use multiple targeted searches for each track.

CRITICAL DATE FILTER: Only include RFPs and solicitations issued after ${cutoffStr} (within the last 45 days). If you cannot confirm the issue date, flag it clearly but still include if it appears active.

For Track 1, prioritize Bay Area and California agencies. Search caleprocure.ca.gov and individual agency procurement portals. Find at least 5 real, verifiable opportunities.

For Track 2, focus on news from the past 72 hours. Look for projects entering CEQA, community opposition stories, and upcoming public hearings.

For Track 3, search for recent contract wins and job postings from the listed prime firms.`
    }]
  });

  const response = await stream.finalMessage();

  let fullText = "";
  for (const block of response.content) {
    if (block.type === "text") fullText += block.text;
  }

  // Parse tracks
  const track1Match = fullText.match(/---TRACK1_START---([\s\S]*?)---TRACK1_END---/);
  const track2Match = fullText.match(/---TRACK2_START---([\s\S]*?)---TRACK2_END---/);
  const track3Match = fullText.match(/---TRACK3_START---([\s\S]*?)---TRACK3_END---/);
  const oppsMatch   = fullText.match(/---OPPORTUNITIES_JSON_START---([\s\S]*?)---OPPORTUNITIES_JSON_END---/);

  const track1_html = track1Match ? track1Match[1].trim() : "<p>No Track 1 data.</p>";
  const track2_html = track2Match ? track2Match[1].trim() : "<p>No Track 2 data.</p>";
  const track3_html = track3Match ? track3Match[1].trim() : "<p>No Track 3 data.</p>";

  const reportDate = new Date().toISOString().split("T")[0];

  // Save daily report
  const saved = await atPost(AIRTABLE_REPORTS_TABLE, { report_date: reportDate, track1_html, track2_html, track3_html });
  console.log(`[${new Date().toISOString()}] Report saved — ID: ${saved.id}`);

  // Save individual opportunities
  if (oppsMatch) {
    let opps = [];
    try {
      const jsonStr = oppsMatch[1].trim().replace(/^```json\s*/,'').replace(/```\s*$/,'');
      opps = JSON.parse(jsonStr);
    } catch(e) {
      console.warn("Could not parse opportunities JSON:", e.message);
    }
    let oppCount = 0;
    for (const opp of opps) {
      try {
        await atPost(AIRTABLE_OPPS_TABLE, {
          title:      opp.title      || "Untitled",
          agency:     opp.agency     || "",
          deadline:   opp.deadline   || null,
          track:      opp.track      || "Track 1",
          scope:      opp.scope      || "",
          source_url: opp.source_url || "",
          report_date: reportDate,
          created_at: new Date().toISOString()
        });
        oppCount++;
      } catch(e) {
        console.warn(`Opp save failed (${opp.title}):`, e.message);
      }
    }
    console.log(`[${new Date().toISOString()}] Saved ${oppCount} opportunities`);
  }

  return saved;
}

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

cron.schedule("30 9 * * 1-5", () => {
  console.log("Cron triggered: running MORS report");
  runMORSReport().catch(err => console.error("Cron report failed:", err));
}, { timezone: "America/Los_Angeles" });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MORS Runner listening on port ${PORT}`);
  console.log("Cron scheduled: 9:30am PT Mon-Fri");
});
