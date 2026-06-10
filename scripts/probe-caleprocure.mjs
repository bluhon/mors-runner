const EVENT_SEARCH_URL = 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx';

const HEADERS = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36'
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchText(url) {
  const response = await fetch(url, { headers: HEADERS });
  const text = await response.text();
  return { url, status: response.status, text };
}

function resolveUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return '';
  }
}

function extractScripts(html, baseUrl) {
  const scripts = [];
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) {
    scripts.push(resolveUrl(baseUrl, match[1]));
  }
  return unique(scripts);
}

function extractConfigFacts(text) {
  const facts = {};
  const baseName = text.match(/psPortalBaseName\s*=\s*['"]([^'"]+)['"]/);
  if (baseName) {
    facts.psPortalBaseName = baseName[1];
    facts.psPortalRoot = `/psp/${baseName[1]}/SUPPLIER/ERP`;
    facts.psPortalBase = `/psc/${baseName[1]}/SUPPLIER/ERP`;
  }

  const patterns = {
    searchComponent: /(AUC_MANAGE_BIDS\.AUC_RESP_INQ_AUC\.GBL)/,
    directLinkFunction: /_directLinkEventUrl/
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    if (facts[key]) continue;
    const match = text.match(pattern);
    if (match) facts[key] = match[1] || 'present';
  }

  return facts;
}

async function main() {
  const page = await fetchText(EVENT_SEARCH_URL);
  console.log(`Event search status: ${page.status}`);

  const scripts = extractScripts(page.text, page.url);
  const configScripts = scripts.filter(url => url.includes('InFlight') || url.includes('config'));
  console.log(`Script count: ${scripts.length}`);
  console.log(`Config-like scripts: ${configScripts.length}`);

  for (const scriptUrl of configScripts) {
    const script = await fetchText(scriptUrl);
    const facts = extractConfigFacts(script.text);
    if (!Object.keys(facts).length) continue;
    console.log(`\n${scriptUrl}`);
    for (const [key, value] of Object.entries(facts)) {
      console.log(`${key}: ${value}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
