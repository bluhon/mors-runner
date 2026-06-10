import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const runnerPath = path.join(REPO_ROOT, 'mor_runner.js');
const frontendPath = path.join(REPO_ROOT, 'public/index.html');

function assertIncludes(text, needle, label, failures) {
  if (!text.includes(needle)) failures.push(label);
}

async function main() {
  const [runner, frontend] = await Promise.all([
    fs.readFile(runnerPath, 'utf8'),
    fs.readFile(frontendPath, 'utf8')
  ]);

  const failures = [];

  for (const marker of [
    '---TRACK1_START---',
    '---TRACK1_END---',
    '---TRACK2_START---',
    '---TRACK2_END---',
    '---TRACK3_START---',
    '---TRACK3_END---',
    '---TRACK4_START---',
    '---TRACK4_END---',
    '---OPPORTUNITIES_JSON_START---',
    '---OPPORTUNITIES_JSON_END---'
  ]) {
    assertIncludes(runner, marker, `missing runner marker ${marker}`, failures);
  }

  for (const field of ['track1_html', 'track2_html', 'track3_html', 'track4_html']) {
    assertIncludes(runner, field, `missing runner report field ${field}`, failures);
    assertIncludes(frontend, field, `missing frontend report field ${field}`, failures);
  }

  assertIncludes(runner, 'parseTrack2Items', 'missing Track 2 parser', failures);
  assertIncludes(runner, 'AIRTABLE_TRACK2_TABLE', 'missing Track 2 Airtable table', failures);
  assertIncludes(frontend, 'saveArticleToPipeline', 'missing Save to Pipeline frontend function', failures);
  assertIncludes(frontend, "formatTrackItems(clean(report.fields.track3_html), 'Track 3')", 'missing Track 3 frontend render', failures);
  assertIncludes(frontend, "formatTrackItems(clean(report.fields.track4_html), 'Track 4')", 'missing Track 4 frontend render', failures);
  assertIncludes(frontend, 'isUsableReport', 'missing frontend guard against placeholder reports', failures);
  assertIncludes(frontend, 'REPORT_SORT_QUERY', 'missing timestamp-aware report sort query', failures);
  assertIncludes(runner, 'saving deterministic Track 1 and continuing', 'missing runner fallback that preserves deterministic Track 1 when model summaries fail', failures);

  if (runner.includes('scrapeFindrfp') || runner.includes('FINDRFP_')) {
    failures.push('FindRFP still present in live runner');
  }

  if (failures.length) {
    console.error('Report contract audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log('Report contract audit passed: Track 1-4 delimiters, fields, frontend render hooks, and FindRFP removal look intact.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
