import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CANDIDATES_FILE = path.join(REPO_ROOT, 'data/source-discovery-candidates.json');
const AIRTABLE_BASE_ID = 'appallyGF2B2bkpIU';
const SEARCH_SOURCES_TABLE_ID = 'tblsQwva2y8ABugYH';

async function loadDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  const text = await fs.readFile(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^["']|["']$/g, '');
  }
}

function canonicalKey(url) {
  return String(url || '').toLowerCase().replace(/\/$/, '').trim();
}

function fieldsFromCandidate(candidate) {
  return {
    source_name: candidate.source_name,
    description: candidate.description,
    url: candidate.url,
    source_type: candidate.source_type,
    portal_type: candidate.portal_type,
    parser_strategy: candidate.parser_strategy,
    geo_tier: candidate.geo_tier,
    county: candidate.county || '',
    region: candidate.region || '',
    discovery_status: candidate.discovery_status,
    source_confidence: candidate.source_confidence,
    discovery_query: candidate.discovery_query,
    notes: candidate.notes,
    active: false
  };
}

async function airtableRequest(pathname, options = {}) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN is missing from .env');
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Airtable request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function fetchInactiveCandidateRecords() {
  const records = [];
  let offset = '';
  do {
    const params = new URLSearchParams({
      filterByFormula: 'AND(NOT({active}=TRUE()), OR({discovery_status}="needs_review", {discovery_status}="needs_manual_review"))',
      maxRecords: '100'
    });
    if (offset) params.set('offset', offset);
    const data = await airtableRequest(`${SEARCH_SOURCES_TABLE_ID}?${params.toString()}`);
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);
  return records;
}

async function main() {
  await loadDotEnv();
  const data = JSON.parse(await fs.readFile(CANDIDATES_FILE, 'utf8'));
  const candidatesByUrl = new Map();
  for (const candidate of data.records || []) {
    if (candidate.source_confidence < 85) continue;
    candidatesByUrl.set(canonicalKey(candidate.url), candidate);
  }

  const records = await fetchInactiveCandidateRecords();
  const updates = [];
  for (const record of records) {
    const candidate = candidatesByUrl.get(canonicalKey(record.fields.url));
    if (!candidate) continue;
    updates.push({ id: record.id, fields: fieldsFromCandidate(candidate) });
  }

  let updated = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const result = await airtableRequest(SEARCH_SOURCES_TABLE_ID, {
      method: 'PATCH',
      body: JSON.stringify({ typecast: true, records: batch })
    });
    updated += (result.records || []).length;
    await new Promise(resolve => setTimeout(resolve, 220));
  }

  console.log(`Synced metadata for ${updated} inactive source candidates.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
