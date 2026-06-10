import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const AIRTABLE_BASE_ID = 'appallyGF2B2bkpIU';
const AIRTABLE_REPORTS_TABLE = 'tblnaSbxkGaoscwZj';

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

function summarizeHtml(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return {
    length: text.length,
    hasTable: /<table\b/i.test(text),
    hasList: /<(ul|ol)\b/i.test(text),
    placeholder: /^<p>No Track \d data\.<\/p>$/i.test(text) || /No new opportunities to review today/i.test(text),
    snippet: text.slice(0, 240)
  };
}

function isRunnerPlaceholder(value, trackNumber) {
  return String(value || '').trim() === `<p>No Track ${trackNumber} data.</p>`;
}

function isUsableReport(report) {
  const fields = report?.fields || {};
  return !isRunnerPlaceholder(fields.track1_html, 1) && !isRunnerPlaceholder(fields.track2_html, 2);
}

async function main() {
  await loadDotEnv();
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN is missing from .env');

  const params = new URLSearchParams({
    'sort[0][field]': 'report_date',
    'sort[0][direction]': 'desc',
    'sort[1][field]': 'run_timestamp',
    'sort[1][direction]': 'desc',
    maxRecords: (process.argv.includes('--list') || process.argv.includes('--usable')) ? '10' : '1'
  });

  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_REPORTS_TABLE}?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Airtable request failed: ${response.status} ${await response.text()}`);

  const data = await response.json();
  const records = data.records || [];
  if (!records.length) {
    console.log('No DAILY_REPORTS records found.');
    return;
  }

  if (process.argv.includes('--list')) {
    for (const report of records) {
      const fields = report.fields || {};
      const summaries = ['track1_html', 'track2_html', 'track3_html', 'track4_html']
        .map(field => `${field.replace('_html', '')}:${summarizeHtml(fields[field]).length}`)
        .join(' ');
      console.log(`${report.id} ${fields.report_date || ''} ${fields.run_timestamp || ''} ${summaries}`);
    }
    return;
  }

  const report = process.argv.includes('--usable')
    ? records.find(isUsableReport) || records[0]
    : records[0];
  const fieldArgIndex = process.argv.indexOf('--field');
  if (fieldArgIndex !== -1) {
    const fieldName = process.argv[fieldArgIndex + 1];
    if (!fieldName) throw new Error('--field requires a field name');
    console.log(String(report.fields[fieldName] || ''));
    return;
  }

  console.log(`Latest report: ${report.id}`);
  console.log(`report_date: ${report.fields.report_date || ''}`);
  console.log(`run_timestamp: ${report.fields.run_timestamp || ''}`);

  for (const field of ['track1_html', 'track2_html', 'track3_html', 'track4_html']) {
    const summary = summarizeHtml(report.fields[field]);
    console.log(`\n${field}`);
    console.log(`  length: ${summary.length}`);
    console.log(`  hasTable: ${summary.hasTable}`);
    console.log(`  hasList: ${summary.hasList}`);
    console.log(`  placeholder: ${summary.placeholder}`);
    console.log(`  snippet: ${summary.snippet || '(empty)'}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
