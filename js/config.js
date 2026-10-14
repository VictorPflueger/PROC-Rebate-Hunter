// Central configuration. Every value here is documented and verified in TECH_NOTES.md.

export const APP = {
  id: "rh",
  name: "Rebate Hunter",
  fullName: "Procurement Rebate Hunter",
  version: "7.0.0"
};

export const ANTHROPIC = {
  messagesUrl: "https://api.anthropic.com/v1/messages",
  modelsUrl: "https://api.anthropic.com/v1/models?limit=100",
  apiVersion: "2023-06-01",
  // Header that enables CORS for direct browser calls (verified by live probe, TECH_NOTES §3).
  browserHeader: "anthropic-dangerous-direct-browser-access",
  webSearchTool: { type: "web_search_20250305", name: "web_search", max_uses: 5 },
  webSearchUsdPer1000: 10,
  // Spend limits are set per workspace (not per key, and not on the Default Workspace), so the
  // advice is: a dedicated workspace with a monthly spend limit, and a key scoped to it (TECH_NOTES §3).
  consoleKeysUrl: "https://platform.claude.com/settings/keys",
  consoleWorkspacesUrl: "https://platform.claude.com/settings/workspaces"
};

// Prices in USD per million tokens (TECH_NOTES §1, verified 12 Oct 2026). `probe` marks the cheap
// model Diagnostics uses for its one-off web-search test.
export const MODELS = [
  {
    id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "Balanced. Recommended for the demo.",
    effort: "medium", maxTokens: 16000,
    price: { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.1 }
  },
  {
    id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "Fastest and cheapest.", probe: true,
    effort: "medium", maxTokens: 12000,
    price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01,
      longPrompt: { thresholdTokens: 100000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 } }
  },
  {
    id: "claude-opus-5-5", label: "Opus 5.5", hint: "Deepest reasoning, highest cost.",
    effort: "high", maxTokens: 16000,
    price: { input: 4.0, output: 20.0, cacheWrite: 5.0, cacheRead: 0.2 }
  }
];
export const DEFAULT_MODEL = "claude-sonnet-5-5";

// Live-agent guardrails (TECH_NOTES §9). A run stops at whichever limit it reaches first.
export const AGENT = {
  maxSteps: 40,          // model calls per run
  budgetEur: 3.0,        // hard cost cap per run
  idleTimeoutMs: 90000,  // no streamed data for this long counts as a failed request
  maxOutputTokens: 128000
};

// ECB reference rate on 12 Oct 2026 (via api.frankfurter.dev). Fixed for a stable cost meter.
export const FX_USD_EUR = 0.894;

// Open data the live agent can read without a key (TECH_NOTES §4). The CSP in index.html allows
// exactly these hosts; js/diagnostics.js checks that the two lists match.
export const OPEN_DATA = {
  gleif: {
    label: "GLEIF (Global LEI Index)",
    source: "GLEIF Global LEI Index, level 1 and level 2 data (live)",
    base: "https://api.gleif.org/api/v1",
    origin: "https://api.gleif.org",
    probe: "https://api.gleif.org/api/v1/lei-records/549300LKFJ962MZ46593"
  },
  wikidata: {
    label: "Wikidata (ownership statements)",
    source: "Wikidata, a crowd-sourced knowledge base (live; a reference, not an authoritative source)",
    api: "https://www.wikidata.org/w/api.php",
    origin: "https://www.wikidata.org",
    probe: "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Cisco&language=en&type=item&limit=1&format=json&origin=*"
  },
  frankfurter: {
    label: "ECB reference rates (Frankfurter)",
    source: "European Central Bank euro reference rates via the Frankfurter API (live)",
    base: "https://api.frankfurter.dev/v1",
    origin: "https://api.frankfurter.dev",
    probe: "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP"
  }
};

export const BASEMAP = {
  // Optional: a free CARTO basemaps key enables the light Positron raster style (TECH_NOTES §5).
  cartoKey: "",
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    probeTile: "https://tile.openstreetmap.org/4/8/5.png"
  },
  carto: {
    url: "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key={key}",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
  }
};

// Leaflet: unpkg first, then jsDelivr, then the byte-identical copy in vendor/ (TECH_NOTES §6, D10).
// The same SRI hashes apply to all three sources.
export const LIBS = {
  leaflet: {
    version: "1.9.4",
    integrity: {
      js: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
      css: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    },
    sources: [
      { label: "unpkg", base: "https://unpkg.com/leaflet@1.9.4/dist/" },
      { label: "jsDelivr", base: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/" },
      { label: "local copy", base: "vendor/leaflet-1.9.4/" }
    ],
    timeoutMs: 7000
  }
};

// Every browser storage key, all under this app's own prefix. GitHub Pages serves all of an
// account's project sites from one origin, so a sister app (Navigator uses "nav.") must never
// share a key with this one: no shared API key, intro flag, cost total or failure memory.
const P = `${APP.id}.`;
export const STORAGE = {
  apiKey: `${P}anthropic.key`,          // sessionStorage: this tab only
  diagnostics: `${P}diag`,              // sessionStorage: data sources that failed recently
  model: `${P}model`,                   // sessionStorage
  speed: `${P}speed`,                   // sessionStorage
  sessionCost: `${P}sessionCostEur`,    // sessionStorage: live spend in this tab
  introSeen: `${P}introSeen`,           // localStorage: the intro opens by itself only on a first visit
  consoleText: `${P}consoleText`        // localStorage: larger console text for projectors
};

export const UI = {
  defaultScenario: "SC-CISCO-MA",
  networkView: { lat: 50.2, lon: 3.5, zoom: 5 },
  // "Accounts at risk" tone: a claim deadline this close is shown in the alarm colour.
  urgentDays: 30
};
