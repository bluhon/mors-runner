import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cron from "node-cron";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = "appallyGF2B2bkpIU";
const AIRTABLE_TABLE_ID = "tblnaSbxkGaoscwZj";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const app = express();
app.use(express.json());

const SYSTEM_PROMPT = `You are a business development research assistant for Bluhon, a California-based public engagement and consensus building firm. Your job is to research and compile a daily intelligence report covering three tracks of opportunity.

ABOUT BLUHON:
Bluhon specializes in public engagement, community outreach, consensus building, facilitation, and stakeholder relations for public agencies, infrastructure projects, transportation, water, energy, and environmental initiatives across California — with particular focus on the San Francisco Bay Area.

You must research and return results in exactly this format — three clearly labeled sections:

---TRACK1_START---
[HTML content here]
---TRACK1_END---

---TRACK2_START---
[HTML content here]
---TRACK2_END---

---TRACK3_START---
[HTML content here]
---TRACK3_END---

TRACK 1 — ACTIVE RFPs & PROCUREMENT:
Search for currently open RFPs, RFQs, and procurement opportunities in California (especially Bay Area) where public engagement, community outreach, stakeholder facilitation, or consensus building services are needed. Look at:
- Caltrans, BART, VTA, AC Transit, MTC, SFMTA, and other transit agencies
- Water districts (EBMUD, SFPUC, Zone 7, Santa Clara Valley Water)
- County and city public works departments
- State agencies (CalRecycle, CDFA, CARB, Caltrans District 4 and 7)
- Infrastructure projects (highway, rail, water, energy, environmental cleanup)
Format as an HTML table with columns: Agency, Project Name, Due Date, Estimated Value, Link/Source.

TRACK 2 — EMERGING ISSUES & INTELLIGENCE:
Research news from the past 48 hours about:
- Major California infrastructure projects entering planning or CEQA phases (where public engagement will be needed soon)
- Community controversies or NIMBYism around projects in Bay Area cities
- New legislation or policy affecting public participation requirements
- Agency budget approvals that could trigger new procurements
- Upcoming public hearings or comment periods
Format as an HTML list with brief summaries and source citations.

TRACK 3 — PRIME FIRM ACTIVITY:
Research activity from major consulting firms that Bluhon might partner with or compete against:
- AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec, Mott MacDonald, LSA Associates
- Look for: new contract wins in California, job postings for public engagement roles, RFP teaming announcements
- Also check: LinkedIn announcements, press releases, Caltrans/MTC award notices
Format as an HTML list with firm name, activity description, and source.

Be thorough and use web search to find current, real information. Today's date is included in the user message.`;

async function runMORSReport() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Los_Angeles"
  });

  console.log(`[${new Date().toISOString()}] Starting MORS report for ${today}`);

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today is ${today}. Please run the full MORS daily intelligence report covering all three tracks. Search thoroughly for current opportunities and intelligence.`
      }
    ]
  });

  const response = await stream.finalMessage();

  // Extract text content from response
  let fullText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      fullText += block.text;
    }
  }

  // Parse the three tracks
  const track1Match = fullText.match(/---TRACK1_START---([\s\S]*?)---TRACK1_END---/);
  const track2Match = fullText.match(/---TRACK2_START---([\s\S]*?)---TRACK2_END---/);
  const track3Match = fullText.match(/---TRACK3_START---([\s\S]*?)---TRACK3_END---/);

  const track1_html = track1Match ? track1Match[1].trim() : "<p>No Track 1 data found in response.</p>";
  const track2_html = track2Match ? track2Match[1].trim() : "<p>No Track 2 data found in response.</p>";
  const track3_html = track3Match ? track3Match[1].trim() : "<p>No Track 3 data found in response.</p>";

  // Build report date string
  const reportDate = new Date().toISOString().split("T")[0];

  // Save to Airtable
  const airtableRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          report_date: reportDate,
          track1_html,
          track2_html,
          track3_html,
          status: "complete",
          generated_at: new Date().toISOString()
        }
      })
    }
  );

  if (!airtableRes.ok) {
    const err = await airtableRes.text();
    throw new Error(`Airtable save failed: ${airtableRes.status} ${err}`);
  }

  const saved = await airtableRes.json();
  console.log(`[${new Date().toISOString()}] Report saved to Airtable — record ID: ${saved.id}`);
  return saved;
}

// POST /run — triggered by "Re-run now" button in MORS app
app.post("/run", async (req, res) => {
  try {
    const record = await runMORSReport();
    res.json({ success: true, recordId: record.id });
  } catch (err) {
    console.error("Report run failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /health — used by Render.com to confirm service is up
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MORS Runner", timestamp: new Date().toISOString() });
});

// Cron: 9:30am PT Mon-Fri
// PT is UTC-8 (PST) or UTC-7 (PDT). Using UTC-7 (PDT/summer):
//   9:30am PDT = 16:30 UTC  →  cron: "30 16 * * 1-5"
// Using UTC-8 (PST/winter):
//   9:30am PST = 17:30 UTC  →  cron: "30 17 * * 1-5"
// Render.com runs in UTC. Set TZ=America/Los_Angeles in Render env vars,
// then use local time directly:
cron.schedule("30 9 * * 1-5", () => {
  console.log("Cron triggered: running MORS report");
  runMORSReport().catch(err => console.error("Cron report failed:", err));
}, {
  timezone: "America/Los_Angeles"
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MORS Runner listening on port ${PORT}`);
  console.log("Cron scheduled: 9:30am PT Mon-Fri");
});
