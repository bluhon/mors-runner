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
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const SYSTEM_PROMPT = `You are a BD research assistant for Bluhon, a California/Bay Area public engagement and consensus building firm. Return results in exactly this format:

---TRACK1_START---
[HTML here]
---TRACK1_END---
---TRACK2_START---
[HTML here]
---TRACK2_END---
---TRACK3_START---
[HTML here]
---TRACK3_END---

TRACK 1 — ACTIVE RFPs: Search for open RFPs/RFQs in California needing public engagement, outreach, or facilitation services (transit agencies, water districts, public works, state agencies). HTML table: Agency | Project | Due Date | Value | Source.

TRACK 2 — EMERGING ISSUES: Recent news (48hrs) on CA infrastructure entering CEQA/planning, Bay Area community controversies, new public participation policy, upcoming hearings. HTML bullet list with source.

TRACK 3 — PRIME FIRMS: Recent activity from AECOM, WSP, HDR, Jacobs, ICF, HNTB, Parsons, Stantec in California — contract wins, teaming announcements, public engagement job postings. HTML bullet list.`;

async function runMORSReport() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Los_Angeles"
  });

  console.log(`[${new Date().toISOString()}] Starting MORS report for ${today}`);

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today is ${today}. Run the MORS daily report for all three tracks.`
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
