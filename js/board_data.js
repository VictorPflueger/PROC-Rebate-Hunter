// Data for the rebate board (pure: no DOM and no state). Who belongs to a supplier group and how
// each account relates to the agreement; what the year-end report counted against what the
// agreement counts, year by year; and which accounts a tool call or result concerns. Every euro comes
// from the rebate engine (js/rebate.js) or the ERP queries (js/erp.js): the board only arranges them.

import { simulateRebate, tierRate } from "./rebate.js";
import { registerEntry, groupMembers, contractRate, claimDeadline, dayToISO } from "./world.js";
import { erpRebateReport } from "./erp.js";
import { isEvidence } from "./guards.js";
import { appToday } from "./clock.js";
import { eurMillions } from "./format.js";

// Every row of the race is an agreement year; the names say which one. The closed year is the last
// agreement year that ended (its claim is due now), the look-back year the one before it (shown only
// while a look-back clause keeps it claimable), the current year the one that runs (projected).
export const YEAR_LABEL = { PY: "Look-back year", AY: "Closed year", CY: "Current year" };
export const CHECK_LABEL = { register: "Register", ledger: "Ledger", gleif: "GLEIF", wikidata: "Wikidata", web: "Web" };

// Legal forms dropped from the labels on the board ("Meraki Cloud Networks Ltd." → "Meraki Cloud
// Networks"); the popover keeps the full name.
const LEGAL = /\s*,?\s*\b(?:GmbH|Ltd\.?|Limited|Inc\.?|Co\.?|LLC|AG|SE|plc|SAS|Unlimited)(?=\s|$)/g;

/** The name without its legal form, for labels. */
export function shortName(name) {
  const s = String(name || "").replace(LEGAL, "").replace(/\s{2,}/g, " ").replace(/[,\s]+$/, "").trim();
  return s || String(name || "");
}

// ---- who belongs ----------------------------------------------------------------------------------

/** The agreement summary the board shows in its title, its race and its popovers. */
export function agreementSummary(model, agreementId) {
  const a = model.agreements.get(agreementId);
  if (!a) return null;
  return {
    id: a.id, short: a.short, title: a.title, counterparty: a.counterparty, group_id: a.group || null,
    tiers: (a.tiers || []).slice().sort((p, q) => p.from_eur - q.from_eur),
    // The tiers in the board's notation ("2 % from €50M"; the agent's tools write tierText's "€50m").
    tiers_text: (a.tiers || []).slice().sort((p, q) => p.from_eur - q.from_eur).map((t) => `${t.rate_pct} % from ${eurMillions(t.from_eur)}`).join(", "),
    retro: a.retro !== false,
    report_min_eur: a.report?.min_threshold_eur || 0,
    report_currencies: a.report?.currencies || null,
    statement: a.credited_basis === "linked",
    claim_window_days: a.claim_window_days, lookback_days: a.lookback_days || 0,
    linked: a.linked.slice()
  };
}

/** The agreement an account belongs to: the one it is linked to, or its register group's. */
export function agreementOfVendor(model, vendorId) {
  const linked = model.agreementsOfVendor.get(String(vendorId));
  if (linked?.length) return linked[0];
  const gid = registerEntry(model, String(vendorId))?.group;
  return gid ? agreementOfGroup(model, gid) : null;
}

/** The agreement of a supplier group (its first), or null. */
export function agreementOfGroup(model, groupId) {
  return (model.agreementsByGroup.get(groupId) || [])[0]?.id || null;
}

/**
 * The group view of an agreement: the supplier group (the hub), and every account the agreement
 * concerns: the accounts linked to it (on the ring) and the register members that are not (outside),
 * and GlobalCorp's company codes they bill (codes_info: each code's company name and city).
 */
export function groupView(model, agreementId) {
  const a = model.agreements.get(agreementId);
  if (!a) return null;
  const g = a.group ? model.groups.get(a.group) : null;
  const ids = [...new Set([...a.linked, ...(a.group ? groupMembers(model, a.group) : [])])];
  const accounts = ids.map((id) => accountView(model, a, id)).sort((p, q) =>
    (Number(q.linked) - Number(p.linked)) || ((q.spend_ay_eur ?? 0) - (p.spend_ay_eur ?? 0)) || p.id.localeCompare(q.id));
  const labels = distinctLabels(model, ids);
  for (const x of accounts) x.label = labels.get(x.id);
  const codes = [...new Set(accounts.map((x) => x.company_code))].sort();
  return {
    agreement: agreementSummary(model, a.id),
    group: g ? { id: g.id, name: g.name, short: g.short, lei: g.lei || null, real: !!g.real, city: g.city, country: g.country } : null,
    hub: { label: g ? g.name : a.counterparty, short: g ? g.short : a.short, lei: g?.lei || null },
    accounts,
    company_codes: codes,
    codes_info: Object.fromEntries(codes.map((id) => {
      const cc = model.companyCodes.get(id) || null;
      return [id, cc ? { name: cc.name, city: cc.short || cc.city } : null];
    }))
  };
}

/** One account as the board shows it: names, place, currency and size (the closed year's spend). */
export function accountView(model, a, id) {
  const v = model.vendors.get(id);
  const reg = registerEntry(model, id);
  const rate = contractRate(a, v.currency);
  return {
    id, name: v.name, label: shortName(v.name), city: v.city, country: v.country,
    currency: v.currency, company_code: v.company_code,
    spend_ay: v.spend.AY, spend_py: v.spend.PY,
    spend_ay_eur: rate === null ? null : Math.round(v.spend.AY * rate),
    spend_py_eur: rate === null ? null : Math.round(v.spend.PY * rate),
    linked: a.linked.includes(id),
    member: !!(reg && a.group && reg.group === a.group),
    group_id: reg?.group || null,
    relation: reg?.relation || null, since: reg?.since || null, lei: reg?.lei || null, legal: reg?.legal || null,
    group_key: v.group_key || null
  };
}

/**
 * Labels for a set of accounts: the short name, or the full name where two short names would read
 * the same ("Schneider Electric GmbH" and "Schneider Electric Ltd").
 */
function distinctLabels(model, ids) {
  const short = new Map(ids.map((id) => [id, shortName(model.vendors.get(id)?.name || id)]));
  const count = new Map();
  for (const label of short.values()) count.set(label, (count.get(label) || 0) + 1);
  return new Map(ids.map((id) => [id, count.get(short.get(id)) > 1 ? model.vendors.get(id)?.name || id : short.get(id)]));
}

// ---- the threshold race ------------------------------------------------------------------------------

const KIND_ORDER = { counted: 0, missed: 1, assumed: 2 };

/**
 * The threshold race of one agreement: one row per year, the accounts as segments, the tiers and what
 * is owed. Without an engine result it shows the year-end report's own view: the linked accounts in
 * the report's currencies, and what the report filed (the current year, which the report has not
 * run yet, projected from the linked accounts). With a result (the agent's latest sim_rebate), every
 * account the result counts, each counted (the report saw it), missed (it did not) or assumed (a
 * what-if account the register does not list).
 */
export function raceView(model, agreementId, result = null, { now = appToday() } = {}) {
  const a = model.agreements.get(agreementId);
  if (!a) return null;
  const info = agreementSummary(model, a.id);
  const report = !(result && result.ok !== false && Array.isArray(result.years));
  const res = report ? simulateRebate(model, { agreement_id: a.id }, { now }) : result;
  if (!res?.ok) return null;
  const cur = info.report_currencies;
  const visible = (m) => m.status === "linked" && (!cur || cur.includes(m.currency));
  const kindOf = (m) => (m.status === "unverified" ? "assumed" : visible(m) ? "counted" : "missed");
  const reasonOf = (m) => {
    if (m.status === "unverified") return "not a register member: a what-if";
    if (m.status === "register") return info.statement ? `not linked, so not on ${a.short}'s statement` : "not linked to the agreement";
    if (!visible(m)) return `${m.currency} invoices: not counted by the report`;
    return null;
  };
  const runs = report ? new Map((erpRebateReport(model, a.id, now).runs || []).map((r) => [r.year, r])) : null;
  const labels = distinctLabels(model, (res.members || []).map((m) => String(m.vendor_id)));
  const rows = [];
  for (const y of res.years || []) {
    // The closed year and the current year always; the look-back year only while a look-back clause
    // keeps it claimable (a lapsed year cannot be acted on).
    const show = y.year === "AY" || y.year === "CY"
      || (y.year === "PY" && info.lookback_days > 0 && y.claim_deadline_day >= 0 && (report || y.owed_eur > 0));
    if (!show) continue;
    const segments = (res.members || [])
      .map((m) => ({ vendor_id: String(m.vendor_id), name: labels.get(String(m.vendor_id)), currency: m.currency, eur: Math.round(m.spend_eur?.[y.year] || 0), kind: kindOf(m), reason: reasonOf(m), status: m.status }))
      .filter((s) => s.eur > 0 && (!report || s.kind === "counted"))
      .sort((p, q) => (KIND_ORDER[p.kind] - KIND_ORDER[q.kind]) || (q.eur - p.eur) || p.vendor_id.localeCompare(q.vendor_id));
    const total = report ? y.report_visible_spend_eur : y.spend_eur;
    const run = runs?.get(y.year) || null;
    rows.push({
      year: y.year, label: YEAR_LABEL[y.year], period: y.period, projected: !!y.projected,
      segments, total_eur: total, counted_eur: y.report_visible_spend_eur,
      tiers: info.tiers.map((t) => ({ ...t, reached: total + 1e-6 >= t.from_eur })),
      tier_pct: report ? tierRate(a, total) : y.tier_pct,
      deadline_day: y.claim_deadline_day, deadline_date: y.claim_deadline_date,
      out: report
        ? (y.year === "CY"
          ? { mode: "report", pending: true, report_after: String(y.period || "").split(" to ")[1] || null }
          : { mode: "report", listed: run ? run.listed === "yes" : false, listed_text: run?.listed || "no run", tier_shown_pct: run?.tier_shown_pct || 0, rebate_shown_eur: Math.round(run?.rebate_shown_eur || 0), claim_filed: run?.claim_filed || "no claim" })
        : { mode: "result", owed_eur: y.owed_eur, credited_eur: y.credited_by_supplier_eur, claimed_eur: y.claimed_by_report_eur, open_eur: y.open_eur, status: y.status }
    });
  }
  return {
    agreement: info,
    mode: report ? "report" : "result",
    basis: report ? "report" : res.basis,
    scale_max: scaleMax(model, a, rows, now),
    rows
  };
}

/**
 * The race's scale: room above the top tier and above the most the group could reach (every
 * register member counted), so the scale stays put while the agent counts more accounts, and the
 * bar's total fits past the end of the longest bar.
 */
function scaleMax(model, a, rows, now) {
  const top = Math.max(0, ...(a.tiers || []).map((t) => t.from_eur));
  const min = a.report?.min_threshold_eur || 0;
  const current = Math.max(0, ...rows.map((r) => r.total_eur || 0));
  return Math.round(Math.max(top * 1.25, min * 1.1, potentialMax(model, a, now) * 1.12, current * 1.12));
}

const potentialCache = new Map();
/** The most an agreement's group could reach in a year: every linked account and register member. */
function potentialMax(model, a, now) {
  const key = `${a.id}|${dayToISO(0, now)}|${model.world.meta?.world_version || ""}`;
  if (potentialCache.has(key)) return potentialCache.get(key);
  const ids = [...new Set([...a.linked, ...(a.group ? groupMembers(model, a.group) : [])])]
    .filter((id) => contractRate(a, model.vendors.get(id)?.currency) !== null);
  const r = simulateRebate(model, { agreement_id: a.id, members: ids }, { now });
  const max = r.ok ? Math.max(0, ...r.years.map((y) => y.spend_eur)) : 0;
  potentialCache.set(key, max);
  return max;
}

// ---- the portfolio --------------------------------------------------------------------------------

/**
 * All agreements, the next claim deadline first: each with the race of the year that deadline is for
 * (the report's view, or the agent's latest result for it; the closed year when no deadline is open)
 * and that deadline. A look-back year with money open is shown as such, not hidden behind the closed
 * year.
 */
export function portfolioView(model, results = new Map(), { now = appToday() } = {}) {
  return model.world.agreements.map((a) => {
    const race = raceView(model, a.id, results.get(a.id) || null, { now });
    // The next open claim deadline of a year the race shows (a look-back year with nothing owed is
    // not shown, so its deadline does not lead).
    const open = ["PY", "AY"].map((y) => ({ year: y, day: claimDeadline(a, y) }))
      .filter((d) => d.day >= 0 && race.rows.some((r) => r.year === d.year)).sort((p, q) => p.day - q.day);
    const next = open[0] || null;
    const row = (next && race.rows.find((r) => r.year === next.year)) || race.rows.find((r) => r.year === "AY") || null;
    return {
      id: a.id, short: a.short, title: a.title, counterparty: a.counterparty, group_id: a.group || null,
      tiers_text: race.agreement.tiers_text, mode: race.mode, basis: race.basis, scale_max: race.scale_max,
      report_min_eur: race.agreement.report_min_eur,
      row,
      next_deadline: next ? { year: next.year, day: next.day, date: dayToISO(next.day, now) } : null
    };
  }).sort((p, q) => ((p.next_deadline?.day ?? 1e9) - (q.next_deadline?.day ?? 1e9)) || p.id.localeCompare(q.id));
}

// ---- what a tool call is about -------------------------------------------------------------------------

/** Every account the scenarios and agreements concern (register members and linked accounts). */
function storyAccounts(model) {
  const ids = new Set(model.registerByVendor.keys());
  for (const a of model.world.agreements) for (const id of a.linked) ids.add(id);
  return [...ids].sort();
}

const firstWord = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] || null;

/** The first word of an account's name when it tells the account apart from its group ("meraki"). */
function distinctiveToken(model, vendorId) {
  const v = model.vendors.get(String(vendorId));
  if (!v) return null;
  const own = firstWord(v.name);
  const reg = registerEntry(model, v.id);
  const g = reg ? model.groups.get(reg.group) : null;
  if (!own || own.length < 3 || own === firstWord(g?.short || g?.name)) return null;
  return own;
}

/** Accounts whose distinctive name appears in a text (a search query, a company name). */
function accountsNamedIn(model, text) {
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return storyAccounts(model).filter((id) => {
    const k = distinctiveToken(model, id);
    return k && t.includes(` ${k} `);
  });
}

/** Accounts whose register entry carries this LEI. */
function accountsWithLei(model, lei) {
  const id = String(lei || "").trim().toUpperCase();
  if (!id) return [];
  return [...model.registerByVendor.values()].filter((r) => r.lei === id).map((r) => r.vendor);
}

function groupOfCall(model, input = {}) {
  if (input.group_id && model.groups.has(input.group_id)) return input.group_id;
  if (input.vendor_id) return registerEntry(model, String(input.vendor_id))?.group || null;
  if (input.name) {
    const t = String(input.name).toLowerCase();
    return model.world.groups.find((g) => g.name.toLowerCase().includes(t) || g.short.toLowerCase().includes(t))?.id || null;
  }
  return null;
}

/** The agreement a tool call (and, when given, its result) is about, or null. */
export function callAgreement(model, name, input = {}, result = null) {
  const direct = input?.agreement_id || result?.agreement_id;
  if (direct && model.agreements.has(direct)) return direct;
  if (name === "erp_family_tree") {
    const gid = result?.group?.id || groupOfCall(model, input);
    return gid ? agreementOfGroup(model, gid) : null;
  }
  if ((name === "erp_get_vendor" || name === "erp_find_duplicates") && input?.vendor_id && model.vendors.has(String(input.vendor_id))) {
    return agreementOfVendor(model, input.vendor_id);
  }
  return null;
}

/** The accounts a tool call is about, while it runs (the board shows them as being checked). */
export function callAccounts(model, name, input = {}) {
  const known = (list) => (Array.isArray(list) ? list : [list]).filter((x) => x !== undefined && x !== null).map(String).filter((id) => model.vendors.has(id));
  switch (name) {
    case "erp_get_vendor":
    case "erp_find_duplicates":
      return known(input.vendor_id);
    case "erp_get_spend":
      return known(input.vendor_ids);
    case "erp_family_tree": {
      const gid = groupOfCall(model, input);
      return gid ? groupMembers(model, gid) : known(input.vendor_id);
    }
    case "open_gleif_parent":
    case "open_gleif_search":
      return input.lei ? accountsWithLei(model, input.lei) : accountsNamedIn(model, input.name);
    case "open_wikidata_owner":
      return accountsNamedIn(model, input.name);
    case "web_search":
      return accountsNamedIn(model, input.query);
    default:
      return [];
  }
}

/**
 * What a successful tool result established about accounts, as [{ vendor_id, kind }]: the register
 * listed it, the ledger confirmed its spend, GLEIF shows the group as its ultimate parent, Wikidata
 * names the group as owner, or a web search found the group and the account together.
 */
export function resultChecks(model, name, input = {}, result = null) {
  if (!isEvidence(name, result)) return [];
  const groupShort = (id) => String(model.groups.get(registerEntry(model, id)?.group)?.short || "").toLowerCase();
  const out = (ids, kind) => [...new Set(ids)].map((vendor_id) => ({ vendor_id, kind }));
  switch (name) {
    case "erp_family_tree":
      return out((result.members || []).map((m) => String(m.vendor_id)).filter((id) => model.vendors.has(id)), "register");
    case "erp_get_spend":
      return out((result.accounts || []).filter((x) => !x.error).map((x) => String(x.vendor_id)).filter((id) => model.vendors.has(id)), "ledger");
    case "open_gleif_parent": {
      const parent = result.ultimate_parent?.lei;
      return out(accountsWithLei(model, result.entity?.lei).filter((id) => model.groups.get(registerEntry(model, id)?.group)?.lei === parent), "gleif");
    }
    case "open_wikidata_owner": {
      const owners = [...(result.owned_by || []), ...(result.parent_organization || [])].map((o) => String(o.name || "").toLowerCase());
      return out(accountsNamedIn(model, input.name || result.query).filter((id) => {
        const short = firstWord(groupShort(id));
        return short && owners.some((o) => o.includes(short));
      }), "wikidata");
    }
    case "web_search": {
      const titles = (result.results || []).map((r) => String(r.title || "")).join(" ").toLowerCase();
      return out(accountsNamedIn(model, `${input.query || ""} ${titles}`).filter((id) => {
        const short = firstWord(groupShort(id));
        return short && titles.includes(short) && titles.includes(distinctiveToken(model, id));
      }), "web");
    }
    default:
      return [];
  }
}

/**
 * Look-alikes from a duplicate check: candidates whose names look alike but whom the register puts in
 * another group, or that share a tax id or bank account. The board draws them apart, the link struck.
 */
export function lookalikes(model, result = null) {
  if (!result || result.error || !result.probe?.vendor_id) return [];
  const probe = String(result.probe.vendor_id);
  const own = registerEntry(model, probe)?.group || null;
  return (result.candidates || [])
    .filter((c) => model.vendors.has(String(c.vendor_id)))
    .filter((c) => {
      const other = registerEntry(model, String(c.vendor_id))?.group || null;
      return (c.shared || []).length > 0 || (other && own && other !== own && (c.name_similarity_pct || 0) >= 60);
    })
    .slice(0, 2)
    .map((c) => ({ probe, vendor_id: String(c.vendor_id), similarity_pct: c.name_similarity_pct, shared: c.shared || [], group_id: registerEntry(model, String(c.vendor_id))?.group || null, verdict: c.register }));
}
