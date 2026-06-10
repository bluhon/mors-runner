import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AIRTABLE_BASE_ID = 'appallyGF2B2bkpIU';
const OPPS_TABLE_ID = 'tbleIossei7FDqi9H';

const SOLICITATION_RE = /\b(rfp|rfq|rfqual|soq|ifb|itb|bid\s*(no\.?|number|#)|solicitation|request for proposals?|request for qualifications?|statement of qualifications|invitation to bid|professional services|consultant services)\b/i;
const PORTAL_RE = /\b(opengov|planetbids|bidnetdirect|bonfirehub|caleprocure|cal\s*eprocure|bidsandtenders|procurement|solicitation|vendorportal|bids\.aspx)\b/i;
const NON_SOLICITATION_RE = /\b(meetings?|events?|public information portal|community centers?|community involvement|planning\s*&?\s*development|city council|agenda|minutes|open house|public hearing|press release|newsletter|calendar|application|rebate|resident|public art)\b/i;

async function loadDotEnv() {
  const text = await fs.readFile(path.join(REPO_ROOT, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^["']|["']$/g, '');
  }
}

function parseFutureDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed)) return null;
  parsed.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed >= today ? parsed : null;
}

function isValid(fields) {
  const title = fields.title || '';
  const scope = fields.scope || '';
  const url = fields.source_url || '';
  const text = `${title} ${scope} ${url}`;

  if (!url) return false;
  if (!parseFutureDate(fields.deadline || fields.proposal_due || '')) return false;
  if (NON_SOLICITATION_RE.test(`${title} ${scope}`) && !SOLICITATION_RE.test(`${title} ${scope}`)) return false;
  return SOLICITATION_RE.test(text) || PORTAL_RE.test(url);
}

async function airtableGetAll(token) {
  const records = [];
  let offset = '';
  do {
    const params = new URLSearchParams({
      maxRecords: '100',
      filterByFormula: 'AND({track}="1 — Active RFP", OR({interest}="", {interest}=BLANK()))'
    });
    if (offset) params.set('offset', offset);
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OPPS_TABLE_ID}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Airtable GET failed: ${response.status} ${await response.text()}`);
    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);
  return records;
}

async function airtablePatch(token, recordId, fields) {
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OPPS_TABLE_ID}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error(`Airtable PATCH failed: ${response.status} ${await response.text()}`);
}

async function main() {
  await loadDotEnv();
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN is missing from .env');
  const dryRun = !process.argv.includes('--write');

  const records = await airtableGetAll(token);
  const invalid = records.filter(record => !isValid(record.fields || {}));

  console.log(`Open Track 1 opportunities checked: ${records.length}`);
  console.log(`Invalid/non-solicitation records ${dryRun ? 'that would be quarantined' : 'quarantined'}: ${invalid.length}`);
  for (const record of invalid.slice(0, 50)) {
    console.log(`- ${record.id}: ${record.fields.title || '(untitled)'}`);
  }

  if (dryRun) {
    console.log('Dry run only. Re-run with --write to mark invalid records interest=No.');
    return;
  }

  for (const record of invalid) {
    await airtablePatch(token, record.id, { interest: 'No' });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
