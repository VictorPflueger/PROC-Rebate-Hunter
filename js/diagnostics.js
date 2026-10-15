// Endpoint self-tests run from the presenter's browser. Results feed the data-source memory
// (js/source_health.js), so the agent's open_* tools skip a blocked source and fall back to web
// search at once.

import { ANTHROPIC, OPEN_DATA, APP, STORAGE } from "./config.js";
import { checkKey, probeEndpoint, networkMessage } from "./anthropic.js";
import { getKey, redactSecrets } from "./keystore.js";
import { checkWorld } from "./world_check.js";
import { buildAuditExport } from "./audit.js";
import { remember, memory as sourceMemory } from "./source_health.js";

export const TESTS = [
  { id: "anthropic", label: "Anthropic API", host: "api.anthropic.com", purpose: "Live agent (Claude) and web search" },
  { id: "gleif", label: OPEN_DATA.gleif.label, host: "api.gleif.org", purpose: "Legal entities and who consolidates them (LEI level 2)" },
  { id: "wikidata", label: OPEN_DATA.wikidata.label, host: "www.wikidata.org", purpose: "Ownership statements (a reference, never the only source)" },
  { id: "frankfurter", label: OPEN_DATA.frankfurter.label, host: "api.frankfurter.dev", purpose: "ECB euro reference rates for currency checks" },
  { id: "world", label: "World data integrity", host: "local", purpose: "Synthetic company, scenarios, reference cases, simulation scripts" },
  { id: "privacy", label: "Key and privacy", host: "local", purpose: "Key kept in this tab only, under this app's own name, never exported; connections limited by the page's security policy" }
];

// The only hosts the page may connect to (the CSP meta tag in index.html must match).
const ALLOWED_CONNECT = [new URL(ANTHROPIC.messagesUrl).origin, ...Object.values(OPEN_DATA).map((d) => d.origin)];
const KEY_LIKE = /sk-ant-(?!\[REDACTED\])[A-Za-z0-9_-]{8,}/;

/** Remembered results of this session (Diagnostics and tools), for the dialog. */
export function memory() {
  return sourceMemory();
}

// ---- individual probes --------------------------------------------------------------------------

async function fetchJson(url, validate, describe, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", credentials: "omit", headers: { accept: "application/json, application/vnd.api+json" } });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) return { status: "fail", ms, detail: `HTTP ${res.status}` };
    const json = await res.json();
    if (!validate(json)) return { status: "warn", ms, detail: "Reachable, but the response format was unexpected." };
    return { status: "pass", ms, detail: describe(json) };
  } catch (e) {
    return { status: "fail", ms: null, detail: networkMessage(e) };
  } finally {
    clearTimeout(timer);
  }
}

const RUNNERS = {
  async anthropic() {
    const key = getKey();
    if (!key) {
      const r = await probeEndpoint();
      return { status: r.ok ? "pass" : "fail", ms: r.ms, detail: r.ok ? `${r.detail} Add your key in Live mode to check it.` : r.detail };
    }
    const r = await checkKey(key);
    if (!r.ok) {
      const msg = r.status === 401 ? "Key rejected (401). Check that it is active and copied completely." : `${r.error?.type || "error"}: ${r.error?.message || ""}`;
      return { status: "fail", ms: r.ms, detail: msg };
    }
    const missing = r.missing.length ? ` Missing for this key: ${r.missing.join(", ")}.` : ` All three ${APP.name} models are available.`;
    return { status: r.missing.length ? "warn" : "pass", ms: r.ms, detail: `Key valid (free check, no tokens used).${missing}` };
  },
  gleif: () => fetchJson(OPEN_DATA.gleif.probe, (j) => !!j?.data?.attributes?.lei, (j) => `LEI record received: ${j.data.attributes.entity?.legalName?.name || j.data.id} (${j.data.attributes.registration?.status || "status unknown"}).`),
  wikidata: () => fetchJson(OPEN_DATA.wikidata.probe, (j) => Array.isArray(j?.search), (j) => `Search answered${j.search[0] ? `: ${j.search[0].label} (${j.search[0].id})` : ""}.`),
  frankfurter: () => fetchJson(OPEN_DATA.frankfurter.probe, (j) => typeof j?.rates?.GBP === "number", (j) => `ECB rate ${j.date}: €1 = £${j.rates.GBP}.`),
  async privacy() {
    const issues = [];
    const notes = [];
    // 1. The browser enforces where the page may connect.
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") || "";
    const connect = (/connect-src([^;]*)/.exec(csp)?.[1] || "").trim().split(/\s+/).filter(Boolean);
    const extra = connect.filter((x) => !ALLOWED_CONNECT.includes(x));
    const missing = ALLOWED_CONNECT.filter((x) => !connect.includes(x));
    if (!csp || !connect.length) issues.push("no connection policy found");
    else if (extra.length) issues.push(`the policy also allows ${extra.join(", ")}`);
    else notes.push(`connections limited to ${connect.length} hosts${missing.length ? ` (not allowed: ${missing.join(", ")})` : ""}`);
    // 2. The key lives in this tab's session storage only, under this app's own name.
    let inLocal = false;
    let foreign = 0;
    try { for (let i = 0; i < localStorage.length; i++) if (KEY_LIKE.test(localStorage.getItem(localStorage.key(i)) || "")) inLocal = true; } catch { /* storage unavailable */ }
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k !== STORAGE.apiKey && KEY_LIKE.test(sessionStorage.getItem(k) || "")) foreign += 1;
      }
    } catch { /* storage unavailable */ }
    if (inLocal) issues.push("an API key was found in local storage");
    notes.push(getKey() ? `your key is stored for this tab only (${STORAGE.apiKey})` : "no key stored");
    if (foreign) notes.push(`another app on this site address keeps ${foreign} key${foreign === 1 ? "" : "s"} in this tab under its own name`);
    // 3. Nothing exported can carry the key.
    const sample = getKey() || "sk-ant-EXAMPLE-not-a-real-key-0000";
    if (redactSecrets(`x ${sample} y`).includes(sample)) issues.push("key redaction failed");
    if (KEY_LIKE.test(buildAuditExport())) issues.push("the audit export contains a key");
    else notes.push("audit export checked");
    const text = issues.length ? `${issues.join("; ")}.` : `${notes.join("; ")}.`;
    return { status: issues.length ? "fail" : "pass", ms: null, detail: text.charAt(0).toUpperCase() + text.slice(1) };
  },
  async world() {
    const started = performance.now();
    const res = checkWorld(globalThis.WORLD, globalThis.SCENARIOS || [], globalThis.REFERENCE_CASES || {}, globalThis.SIM_RUNS || {});
    const passed = res.checks.filter((c) => c.ok).length;
    return { status: res.ok ? "pass" : "fail", ms: Math.round(performance.now() - started), detail: `${passed}/${res.checks.length} integrity checks passed.`, checks: res.checks };
  }
};

/** Run one test; network results are remembered for tool fallbacks. */
export async function runTest(id) {
  const fn = RUNNERS[id];
  if (!fn) return { status: "skip", detail: "Unknown test." };
  const r = await fn();
  if (!["world", "privacy"].includes(id)) remember(id, r.status, r.detail, "diagnostics");
  return r;
}

/** Run all tests in parallel, reporting each result as it arrives. */
export async function runAll(onResult) {
  const results = {};
  await Promise.all(TESTS.map(async (t) => {
    onResult?.(t.id, { status: "running" });
    const r = await runTest(t.id);
    results[t.id] = r;
    onResult?.(t.id, r);
  }));
  return results;
}
