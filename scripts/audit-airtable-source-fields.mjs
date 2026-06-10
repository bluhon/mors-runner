import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AIRTABLE_BASE_ID = 'appallyGF2B2bkpIU';
const SEARCH_SOURCES_TABLE_ID = 'tblsQwva2y8ABugYH';

const REQUIRED_FIELDS = {
  geo_tier: 'singleSelect',
  county: 'singleLineText',
  region: 'singleSelect',
  discovery_status: 'singleSelect',
  source_confidence: 'number',
  discovery_query: 'multilineText'
};

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

async function main() {
  await loadDotEnv();
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN is missing from .env');

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Airtable metadata request failed: ${response.status} ${await response.text()}`);

  const data = await response.json();
  const table = (data.tables || []).find(item => item.id === SEARCH_SOURCES_TABLE_ID || item.name === 'SEARCH_SOURCES');
  if (!table) throw new Error('SEARCH_SOURCES table not found');

  const fields = new Map((table.fields || []).map(field => [field.name, field]));
  const failures = [];

  for (const [name, expectedType] of Object.entries(REQUIRED_FIELDS)) {
    const field = fields.get(name);
    if (!field) {
      failures.push(`${name}: missing`);
      continue;
    }
    if (field.type !== expectedType) {
      failures.push(`${name}: expected ${expectedType}, found ${field.type}`);
    }
  }

  if (failures.length) {
    console.error('SEARCH_SOURCES field audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log('SEARCH_SOURCES field audit passed.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
