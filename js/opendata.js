// Open-data tools for the live agent: the Global LEI Index (GLEIF: legal entities and who
// consolidates them), Wikidata (ownership statements, a crowd-sourced reference) and the ECB euro
// reference rates (via Frankfurter). Results are compacted and joined with GlobalCorp's register and
// vendor master, so the agent sees evidence about its own accounts, not raw feeds.
// Every function resolves, never throws, except with an AbortError when the run is stopped: on
// failure it returns { error, fallback_hint }.

import { OPEN_DATA } from "./config.js";
import { recentFailure, remember } from "./source_health.js";

const timeOfDay = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * GET JSON from an open-data source. Returns { json } or { failed, error, notFound }.
 * A 404 is an answer ("no such record"), never a broken source. `signal` is the run's abort signal:
 * an aborted run cancels the request and is never remembered as a source failure.
 */
async function getJson(url, sourceId, { timeoutMs = 10000, allow404 = false, signal = null } = {}) {
  const label = OPEN_DATA[sourceId]?.label || sourceId;
  const prior = recentFailure(sourceId);
  if (prior) {
    const when = `${timeOfDay(prior.at)}: ${prior.detail}`;
    return { failed: true, error: prior.origin === "diagnostics"
      ? `${label} failed the Diagnostics check in this browser session (${when}), so it was skipped. Run Diagnostics again to retest it.`
      : `${label} failed earlier in this session (${when}), so it was skipped. Diagnostics can test it again.` };
  }
  if (signal?.aborted) throw abortError();
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal, cache: "no-store", credentials: "omit", headers: { accept: "application/json, application/vnd.api+json" } });
    } catch (e) {
      if (signal?.aborted) throw abortError();
      const why = timedOut ? "timed out" : "was blocked or unreachable from this browser (network, firewall or CORS)";
      remember(sourceId, "fail", why);
      return { failed: true, error: `${label} ${why}.` };
    }
    if (res.status === 404 && allow404) return { notFound: true };
    if (res.status === 429) {
      // A rate limit passes within a minute: not a broken source, so it is not remembered.
      return { failed: true, error: `${label} is limiting the request rate (HTTP 429). Wait a minute, or verify through another source.` };
    }
    if (!res.ok) {
      // Only a server error says the source is unwell; another 4xx comes from the request.
      if (res.status >= 500) remember(sourceId, "fail", `HTTP ${res.status}`);
      return { failed: true, error: `${label} answered HTTP ${res.status}${res.status < 500 ? " (check the input)" : ""}.`, inputError: res.status < 500 };
    }
    let json;
    try {
      json = await res.json();
    } catch {
      if (signal?.aborted) throw abortError();
      return { failed: true, error: `${label} answered with something that is not JSON (a proxy or captive portal page, perhaps).` };
    }
    remember(sourceId, "pass", "Used by the agent");
    return { json };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function abortError() {
  const e = new Error("The run was stopped.");
  e.name = "AbortError";
  return e;
}

/** A failed lookup: an input error is fixed by the agent; an unreachable source falls back to web search. */
function fail(r) {
  return r.inputError ? { error: r.error } : { error: r.error, fallback_hint: "use web_search" };
}

// ---- GLEIF ----------------------------------------------------------------------------------------

const LEI_RE = /^[A-Z0-9]{18}[0-9]{2}$/;

function compactRecord(rec) {
  const a = rec?.attributes || {};
  const e = a.entity || {};
  return {
    lei: a.lei || rec?.id || null,
    legal_name: e.legalName?.name || null,
    legal_address: [e.legalAddress?.city, e.legalAddress?.country].filter(Boolean).join(", ") || null,
    headquarters: [e.headquartersAddress?.city, e.headquartersAddress?.country].filter(Boolean).join(", ") || null,
    entity_status: e.status || null,
    registration_status: a.registration?.status || null
  };
}

/** What GlobalCorp's own data says about an LEI (register entry or group parent). */
function registerMatch(model, lei) {
  if (!lei) return null;
  const g = model.world.groups.find((x) => x.lei === lei);
  if (g) return `ultimate parent of register group ${g.id} (${g.short})`;
  const r = model.world.register.find((x) => x.lei === lei);
  if (r) return `register entry of vendor ${r.vendor} (${r.legal}), group ${r.group}`;
  return null;
}

/** GLEIF search by legal name (full text) or a single LEI record. */
export async function gleifSearch(model, { name = "", lei = "", country = "" } = {}, { signal = null } = {}) {
  const id = String(lei || "").trim().toUpperCase();
  if (id) {
    if (!LEI_RE.test(id)) return { error: `"${lei}" is not an LEI (20 characters: 18 letters or digits and two check digits).` };
    const r = await getJson(`${OPEN_DATA.gleif.base}/lei-records/${encodeURIComponent(id)}`, "gleif", { allow404: true, signal });
    if (r.notFound) return { source: OPEN_DATA.gleif.source, lei: id, found: false, note: "GLEIF has no record with this LEI." };
    if (r.failed) return fail(r);
    const rec = compactRecord(r.json?.data);
    return { source: OPEN_DATA.gleif.source, found: true, records: [{ ...rec, globalcorp: registerMatch(model, rec.lei) || undefined }] };
  }
  const q = String(name || "").trim();
  if (q.length < 2) return { error: "Give a legal name (at least two characters) or an LEI." };
  const cc = String(country || "").trim().toUpperCase();
  const url = `${OPEN_DATA.gleif.base}/lei-records?filter[fulltext]=${encodeURIComponent(q)}${/^[A-Z]{2}$/.test(cc) ? `&filter[entity.legalAddress.country]=${cc}` : ""}&page[size]=8`;
  const r = await getJson(url, "gleif", { signal });
  if (r.failed) return fail(r);
  const data = Array.isArray(r.json?.data) ? r.json.data : [];
  return {
    source: OPEN_DATA.gleif.source,
    query: q,
    total: r.json?.meta?.pagination?.total ?? data.length,
    records: data.map((d) => {
      const rec = compactRecord(d);
      return { ...rec, globalcorp: registerMatch(model, rec.lei) || undefined };
    }),
    note: data.length ? "Legal entities, not invoicing accounts: match by name and address, then ask open_gleif_parent who consolidates them." : "No GLEIF record matches this name. Fictional companies, and many small firms, have no LEI."
  };
}

/**
 * Who ultimately consolidates an LEI (GLEIF level-2 relationship data). The relationship period is
 * what the entity reported to GLEIF; it can start long before or after an acquisition (VMware's
 * reads 2017, Activision's 2001), so it is returned as reported, with a note, never as a deal date.
 */
export async function gleifParent(model, { lei = "" } = {}, { signal = null } = {}) {
  const id = String(lei || "").trim().toUpperCase();
  if (!LEI_RE.test(id)) return { error: `"${lei}" is not an LEI. Find it with open_gleif_search first.` };
  const base = `${OPEN_DATA.gleif.base}/lei-records/${encodeURIComponent(id)}`;
  const [self, parent, rel] = await Promise.all([
    getJson(base, "gleif", { allow404: true, signal }),
    getJson(`${base}/ultimate-parent`, "gleif", { allow404: true, signal }),
    getJson(`${base}/ultimate-parent-relationship`, "gleif", { allow404: true, signal })
  ]);
  const broken = [self, parent, rel].find((x) => x.failed);
  if (broken) return fail(broken);
  if (self.notFound) return { source: OPEN_DATA.gleif.source, lei: id, found: false, note: "GLEIF has no record with this LEI." };
  const entity = compactRecord(self.json?.data);
  if (parent.notFound) {
    return {
      source: OPEN_DATA.gleif.source, entity,
      ultimate_parent: null,
      note: "No ultimate parent is reported to GLEIF for this entity: it is its own ultimate parent, or it filed a reporting exception."
    };
  }
  const up = compactRecord(parent.json?.data);
  const r = rel.json?.data?.attributes?.relationship || {};
  const periods = Array.isArray(r.periods) ? r.periods : [];
  const since = periods.find((p) => p.type === "RELATIONSHIP_PERIOD")?.startDate || null;
  const acct = periods.find((p) => p.type === "ACCOUNTING_PERIOD") || null;
  return {
    source: OPEN_DATA.gleif.source,
    entity: { ...entity, globalcorp: registerMatch(model, entity.lei) || undefined },
    ultimate_parent: { ...up, globalcorp: registerMatch(model, up.lei) || undefined },
    relationship: rel.notFound ? null : {
      type: r.type || null,
      status: r.status || null,
      period_start: since ? String(since).slice(0, 10) : null,
      accounting_period: acct ? `${String(acct.startDate || "").slice(0, 10)} to ${String(acct.endDate || "").slice(0, 10)}` : null,
      note: "The relationship period as reported to GLEIF, not necessarily the acquisition date. Take acquisition dates from the register or the acquirer's announcement."
    }
  };
}

// ---- Wikidata -------------------------------------------------------------------------------------

function claimTargets(entity, prop) {
  return (entity?.claims?.[prop] || []).map((c) => {
    const id = c?.mainsnak?.datavalue?.value?.id || null;
    const start = c?.qualifiers?.P580?.[0]?.datavalue?.value?.time || null;
    const end = c?.qualifiers?.P582?.[0]?.datavalue?.value?.time || null;
    return id ? { id, since: start ? start.replace(/^\+/, "").slice(0, 10) : null, until: end ? end.replace(/^\+/, "").slice(0, 10) : null } : null;
  }).filter(Boolean);
}

/** Wikidata statements on who owns a company (P127 owned by, P749 parent organisation). */
export async function wikidataOwner(model, { name = "" } = {}, { signal = null } = {}) {
  const q = String(name || "").trim();
  if (q.length < 2) return { error: "Give a company name (at least two characters)." };
  const api = OPEN_DATA.wikidata.api;
  const found = await getJson(`${api}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&type=item&limit=3&format=json&origin=*`, "wikidata", { signal });
  if (found.failed) return fail(found);
  const hit = (found.json?.search || [])[0];
  if (!hit) return { source: OPEN_DATA.wikidata.source, query: q, found: false, note: "No Wikidata item matches this name." };
  const ent = await getJson(`${api}?action=wbgetentities&ids=${encodeURIComponent(hit.id)}&props=labels%7Cdescriptions%7Cclaims&languages=en&format=json&origin=*`, "wikidata", { signal });
  if (ent.failed) return fail(ent);
  const e = ent.json?.entities?.[hit.id] || {};
  const owners = claimTargets(e, "P127");
  const parents = claimTargets(e, "P749");
  const ids = [...new Set([...owners, ...parents].map((x) => x.id))].slice(0, 20);
  let labels = {};
  if (ids.length) {
    const lab = await getJson(`${api}?action=wbgetentities&ids=${ids.join("%7C")}&props=labels&languages=en&format=json&origin=*`, "wikidata", { signal });
    if (!lab.failed) labels = Object.fromEntries(Object.entries(lab.json?.entities || {}).map(([k, v]) => [k, v?.labels?.en?.value || k]));
  }
  const named = (list) => list.map((x) => ({ id: x.id, name: labels[x.id] || x.id, ...(x.since ? { since: x.since } : {}), ...(x.until ? { until: x.until } : {}) }));
  const lei = e?.claims?.P1278?.[0]?.mainsnak?.datavalue?.value || null;
  return {
    source: OPEN_DATA.wikidata.source,
    query: q,
    item: { id: hit.id, label: e?.labels?.en?.value || hit.label, description: e?.descriptions?.en?.value || hit.description || null, lei, globalcorp: registerMatch(model, lei) || undefined },
    owned_by: named(owners),
    parent_organization: named(parents),
    note: "Wikidata is edited by volunteers: a useful lead, never the only source for a merge."
  };
}

// ---- ECB reference rates --------------------------------------------------------------------------

/** ECB euro reference rate for a currency (latest or on a date), next to the contract rates. */
export async function ecbRate(model, { currency = "GBP", date = "" } = {}, { signal = null } = {}) {
  const cur = String(currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur) || cur === "EUR") return { error: "currency must be a three-letter code other than EUR, e.g. GBP or USD." };
  const d = String(date || "").trim();
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "date must be YYYY-MM-DD (or omit it for the latest rate)." };
  const r = await getJson(`${OPEN_DATA.frankfurter.base}/${d || "latest"}?base=EUR&symbols=${cur}`, "frankfurter", { signal });
  if (r.failed) return fail(r);
  const perEur = Number(r.json?.rates?.[cur]);
  if (!Number.isFinite(perEur) || perEur <= 0) return { error: `No ECB reference rate for ${cur}.` };
  const contracts = model.world.agreements.filter((a) => a.fx_to_eur?.[cur]).map((a) => ({ agreement_id: a.id, eur_per_unit: a.fx_to_eur[cur] }));
  return {
    source: OPEN_DATA.frankfurter.source,
    date: r.json?.date || d || null,
    currency: cur,
    per_eur: perEur,
    eur_per_unit: Math.round((1 / perEur) * 10000) / 10000,
    contract_rates: contracts,
    note: contracts.length ? "Agreements with a fixed rate convert at that rate, whatever the market rate (see their clause)." : "No agreement fixes a rate for this currency."
  };
}
