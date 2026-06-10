import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEFAULT_SEEDS = path.join(REPO_ROOT, 'data/source-discovery-seeds.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'data/source-discovery-candidates.json');
const AIRTABLE_BASE_ID = 'appallyGF2B2bkpIU';
const SEARCH_SOURCES_TABLE_ID = 'tblsQwva2y8ABugYH';

const SEARCH_TEMPLATES = [
  '"{agency}" RFP procurement',
  '"{agency}" "request for proposals"',
  '"{agency}" "bid opportunities"',
  '"{agency}" "contract opportunities"',
  '"{agency}" "vendor portal"',
  '"{agency}" site:procurement.opengov.com',
  '"{agency}" site:vendors.planetbids.com',
  '"{agency}" site:bidnetdirect.com',
  '"{agency}" site:gobonfire.com'
];

const GENERIC_SEED_TOKENS = new Set([
  'city', 'county', 'town', 'of', 'the', 'and', 'district', 'agency',
  'authority', 'commission', 'department', 'public', 'works', 'area'
]);

const BLOCKED_PLATFORM_SLUGS = new Set([
  // Common false positives observed in California public-sector searches.
  'mpsaz'
]);

function parseArgs(argv) {
  const args = { write: false, limit: 0, minConfidence: 70, seeds: DEFAULT_SEEDS, output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--limit') args.limit = Number(argv[++i] || 0);
    else if (arg === '--min-confidence') args.minConfidence = Number(argv[++i] || 70);
    else if (arg === '--seeds') args.seeds = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
  }
  return args;
}

async function loadDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  try {
    const text = await fs.readFile(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!process.env[key]) process.env[key] = rest.join('=').replace(/^["']|["']$/g, '');
    }
  } catch {
    // Local .env is optional for dry-run mode.
  }
}

function queryFor(template, agency) {
  return template.replaceAll('{agency}', agency);
}

function detectPlatform(url) {
  const lower = url.toLowerCase();
  if (lower.includes('procurement.opengov.com')) return { portal_type: 'OpenGov', parser_strategy: 'opengov', source_type: 'Procurement Portal', confidence: 95 };
  if (lower.includes('vendors.planetbids.com')) return { portal_type: 'PlanetBids', parser_strategy: 'planetbids', source_type: 'Procurement Portal', confidence: 95 };
  if (lower.includes('bidnetdirect.com')) return { portal_type: 'BidNet', parser_strategy: 'bidnet', source_type: 'Procurement Portal', confidence: 95 };
  if (lower.includes('gobonfire.com') || lower.includes('bonfirehub.com')) return { portal_type: 'Bonfire', parser_strategy: 'bonfire', source_type: 'Procurement Portal', confidence: 95 };
  if (lower.includes('caleprocure.ca.gov')) return { portal_type: 'Cal eProcure', parser_strategy: 'caleprocure', source_type: 'Procurement Portal', confidence: 95 };
  if (lower.includes('/bids') || lower.includes('/rfp') || lower.includes('procurement') || lower.includes('contract-opportunities')) {
    return { portal_type: 'Direct', parser_strategy: 'custom_html', source_type: 'Agency Procurement Page', confidence: 70 };
  }
  if (lower.includes('planroom')) return { portal_type: 'Planroom', parser_strategy: 'planroom', source_type: 'Planroom', confidence: 85 };
  return { portal_type: 'Unknown', parser_strategy: 'manual_review', source_type: 'Other', confidence: 30 };
}

function canonicalSourceUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (host === 'procurement.opengov.com') {
      const portalIndex = parts.indexOf('portal');
      const slug = portalIndex >= 0 ? parts[portalIndex + 1] : '';
      if (!slug) return null;
      if (BLOCKED_PLATFORM_SLUGS.has(slug.toLowerCase())) return null;
      return `https://procurement.opengov.com/portal/${slug}`;
    }

    if (host === 'vendors.planetbids.com') {
      const portalIndex = parts.indexOf('portal');
      const portalId = portalIndex >= 0 ? parts[portalIndex + 1] : '';
      if (!portalId) return null;
      return `https://vendors.planetbids.com/portal/${portalId}/bo/bo-search`;
    }

    if (host === 'www.bidnetdirect.com' || host === 'bidnetdirect.com') {
      if (parts[0] !== 'california') return null;
      if (!parts[1] || parts[1] === 'solicitations') return null;
      return `https://www.bidnetdirect.com/california/${parts[1]}`;
    }

    if (host.endsWith('bonfirehub.com') || host === 'gobonfire.com') {
      return `${parsed.protocol}//${parsed.hostname}/portal/?tab=openOpportunities`;
    }

    return url.replace(/[?#].*$/, '').replace(/\/$/, '');
  } catch {
    return null;
  }
}

function titleCaseSlug(value) {
  const overrides = {
    contracostacounty: 'Contra Costa County',
    marinhousing: 'Marin Housing',
    zone7water: 'Zone 7 Water',
    'hayward-ca': 'Hayward CA'
  };
  if (overrides[value.toLowerCase()]) return overrides[value.toLowerCase()];
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\bca\b/gi, 'CA')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

function deriveSourceName(seed, result, canonicalUrl) {
  try {
    const parsed = new URL(canonicalUrl);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (host === 'procurement.opengov.com') {
      const slug = parts[1] || seed.name;
      return `${titleCaseSlug(slug)} OpenGov`;
    }

    if (host === 'vendors.planetbids.com') {
      const portalId = parts[1] || '';
      return portalId ? `${seed.name} PlanetBids ${portalId}` : `${seed.name} PlanetBids`;
    }

    if (host === 'www.bidnetdirect.com' || host === 'bidnetdirect.com') {
      const slug = parts[1] || seed.name;
      return `${titleCaseSlug(slug)} BidNet`;
    }

    if (host.endsWith('bonfirehub.com')) {
      return `${titleCaseSlug(host.split('.')[0])} Bonfire`;
    }
  } catch {
    // Fall through to seed name.
  }

  return seed.name;
}

function isLikelyProcurementUrl(url, title = '', snippet = '') {
  const text = `${url} ${title} ${snippet}`.toLowerCase();
  if (/\bclosed-bids\b|\bclosed solicitations\b/.test(text)) return false;
  return /\b(rfp|rfq|bid|bids|procurement|purchasing|solicitation|contract opportunities|vendor portal|planetbids|opengov|bidnet|bonfire|caleprocure|planroom)\b/.test(text);
}

function seedTokens(seed) {
  const raw = `${seed.name || ''} ${seed.county || ''}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && !GENERIC_SEED_TOKENS.has(token));
}

function isRelevantToSeed(seed, result, canonicalUrl) {
  const tokens = seedTokens(seed);
  if (!tokens.length) return true;
  const haystack = `${result.title || ''} ${result.snippet || ''} ${result.url || ''} ${canonicalUrl}`.toLowerCase();
  return tokens.some(token => haystack.includes(token));
}

function normalizedWords(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && !GENERIC_SEED_TOKENS.has(token));
}

function sourceNameMatchesSeed(sourceName, seed) {
  const sourceWords = new Set(normalizedWords(sourceName));
  const seedWords = normalizedWords(seed.name);
  if (!seedWords.length) return false;
  return seedWords.some(word => sourceWords.has(word));
}

function candidateFromResult(seed, result, query) {
  const canonicalUrl = canonicalSourceUrl(result.url);
  if (!canonicalUrl) return null;
  if (!isRelevantToSeed(seed, result, canonicalUrl)) return null;
  const platform = detectPlatform(canonicalUrl);
  const sourceName = deriveSourceName(seed, result, canonicalUrl);
  const directSeedMatch = sourceNameMatchesSeed(sourceName, seed);
  const discoveryStatus = platform.confidence >= 85
    ? (directSeedMatch ? 'needs_review' : 'needs_manual_review')
    : 'needs_manual_review';
  return {
    source_name: sourceName,
    description: directSeedMatch ? seed.agency_type : 'Procurement Portal',
    url: canonicalUrl,
    source_type: platform.source_type,
    portal_type: platform.portal_type,
    parser_strategy: platform.parser_strategy,
    geo_tier: seed.geo_tier,
    county: directSeedMatch ? seed.county : '',
    region: directSeedMatch ? seed.region : '',
    discovery_query: query,
    discovery_status: discoveryStatus,
    source_confidence: platform.confidence,
    notes: result.title ? `Discovered while expanding ${seed.name}. Search result: ${result.title}` : `Discovered while expanding ${seed.name}`,
    active: false
  };
}

async function braveSearch(query) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return null;
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '5');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key
    }
  });
  if (!response.ok) throw new Error(`Brave Search failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return (data.web?.results || []).map(item => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.description || ''
  }));
}

async function serpApiSearch(query) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return null;
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', key);
  url.searchParams.set('num', '5');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SerpAPI failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return (data.organic_results || []).map(item => ({
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || ''
  }));
}

async function googleCustomSearch(query) {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!key || !cx) return null;
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', key);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Custom Search failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return (data.items || []).map(item => ({
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || ''
  }));
}

async function search(query) {
  const providers = [braveSearch, serpApiSearch, googleCustomSearch];
  for (const provider of providers) {
    try {
      const results = await provider(query);
      if (results) return results;
    } catch (error) {
      console.warn(`[discover] ${provider.name} failed for "${query}": ${error.message.slice(0, 240)}`);
    }
  }
  return null;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const deduped = [];
  for (const candidate of candidates) {
    const key = `${candidate.source_name.toLowerCase()}|${candidate.url.toLowerCase().replace(/\/$/, '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped.sort((a, b) => {
    const tier = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3, 'Tier 4': 4 };
    if ((tier[a.geo_tier] || 9) !== (tier[b.geo_tier] || 9)) return (tier[a.geo_tier] || 9) - (tier[b.geo_tier] || 9);
    if (b.source_confidence !== a.source_confidence) return b.source_confidence - a.source_confidence;
    return a.source_name.localeCompare(b.source_name);
  });
}

function airtableValue(value) {
  return value === undefined || value === null ? '' : value;
}

function airtableFields(candidate) {
  return {
    source_name: candidate.source_name,
    description: candidate.description,
    url: candidate.url,
    source_type: candidate.source_type,
    portal_type: candidate.portal_type,
    parser_strategy: candidate.parser_strategy,
    geo_tier: candidate.geo_tier,
    county: airtableValue(candidate.county),
    region: candidate.region,
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
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${pathname}`, {
    ...options,
    headers
  });
  if (!response.ok) throw new Error(`Airtable request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function fetchExistingSourceKeys() {
  const keys = new Set();
  let offset = '';
  do {
    const params = new URLSearchParams({
      'fields[]': 'source_name',
      maxRecords: '100'
    });
    params.append('fields[]', 'url');
    if (offset) params.set('offset', offset);
    const data = await airtableRequest(`${SEARCH_SOURCES_TABLE_ID}?${params.toString()}`);
    for (const record of data.records || []) {
      const name = (record.fields.source_name || '').toLowerCase().trim();
      const url = (record.fields.url || '').toLowerCase().replace(/\/$/, '').trim();
      if (name && url) keys.add(`${name}|${url}`);
    }
    offset = data.offset || '';
  } while (offset);
  return keys;
}

async function writeCandidatesToAirtable(candidates, minConfidence) {
  const existingKeys = await fetchExistingSourceKeys();
  const eligible = candidates.filter(candidate => candidate.source_confidence >= minConfidence);
  const toCreate = eligible.filter(candidate => {
    const key = `${candidate.source_name.toLowerCase().trim()}|${candidate.url.toLowerCase().replace(/\/$/, '').trim()}`;
    return !existingKeys.has(key);
  });

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    const data = await airtableRequest(SEARCH_SOURCES_TABLE_ID, {
      method: 'POST',
      body: JSON.stringify({
        typecast: true,
        records: batch.map(candidate => ({ fields: airtableFields(candidate) }))
      })
    });
    created += (data.records || []).length;
    await new Promise(resolve => setTimeout(resolve, 220));
  }

  return {
    created,
    skippedExisting: eligible.length - toCreate.length,
    skippedLowConfidence: candidates.length - eligible.length
  };
}

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const seeds = JSON.parse(await fs.readFile(args.seeds, 'utf8'));
  const selectedSeeds = args.limit > 0 ? seeds.slice(0, args.limit) : seeds;
  const candidates = [];
  const dryRunQueries = [];
  let providerAvailable = false;

  for (const seed of selectedSeeds) {
    for (const template of SEARCH_TEMPLATES) {
      const query = queryFor(template, seed.name);
      const results = await search(query);
      if (!results) {
        dryRunQueries.push({ agency: seed.name, geo_tier: seed.geo_tier, query });
        continue;
      }
      providerAvailable = true;
      for (const result of results) {
        if (!result.url || !isLikelyProcurementUrl(result.url, result.title, result.snippet)) continue;
        const candidate = candidateFromResult(seed, result, query);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  if (!providerAvailable) {
    const output = {
      mode: 'dry_run',
      message: 'No supported search provider key found. Add BRAVE_SEARCH_API_KEY or SERPAPI_API_KEY to .env, or repair GOOGLE_API_KEY / GOOGLE_SEARCH_ENGINE_ID access.',
      supported_env_vars: ['BRAVE_SEARCH_API_KEY', 'SERPAPI_API_KEY', 'GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID'],
      queries: dryRunQueries
    };
    await fs.writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Dry run wrote ${dryRunQueries.length} discovery queries to ${args.output}`);
    return;
  }

  const deduped = dedupeCandidates(candidates);
  await fs.writeFile(args.output, `${JSON.stringify({ mode: 'candidates', records: deduped }, null, 2)}\n`);
  console.log(`Wrote ${deduped.length} source candidates to ${args.output}`);

  if (args.write) {
    const result = await writeCandidatesToAirtable(deduped, args.minConfidence);
    console.log(`Airtable write complete: ${result.created} created, ${result.skippedExisting} skipped as already present, ${result.skippedLowConfidence} skipped below confidence ${args.minConfidence}.`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
