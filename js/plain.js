// Plain words for the screen. The engine, the tools, the guardrails and the six scripts keep their own
// forms (vendor 10003, RA-CISCO, CC-1000, an LEI, sim_rebate); this module, and only this module, turns
// them into what a visitor reads: names, places and words. Pure: the page and the tests share it.

import { shortName } from "./board_data.js";

const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** €2.14M, €437,500, €17,100: millions with two decimals, smaller amounts to the euro. */
export function eur(value) {
  const v = Number(value) || 0;
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  return a >= 1e6 ? `${sign}€${nf2.format(a / 1e6)}M` : `${sign}€${nf0.format(Math.round(a))}`;
}
/** €1,048,000: every euro. */
export const eurFull = (value) => `€${nf0.format(Math.round(Number(value) || 0))}`;
/** €52.4M, €50M: spend and thresholds, one decimal at most. */
export const eurSpend = (value) => `€${(Number(value) / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 })}M`;
/** €0.21: small amounts with cents. */
export const cents = (value) => `€${nf2.format(Number(value) || 0)}`;
export const plural = (n, one, many = `${one}s`) => `${nf0.format(n)} ${n === 1 ? one : many}`;
export const days = (n) => plural(n, "day");
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const count = (n) => WORDS[n] ?? nf0.format(n);
export const capital = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

/** "Meraki, Acacia and Splunk". */
export function list(items) {
  const a = items.filter(Boolean);
  return a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
}

/**
 * Short names for accounts in one breath: "Meraki, Acacia and Splunk". An account keeps its first word
 * unless that word is its group's or another account's in the same list ("Cisco Systems Germany",
 * "VMware International").
 */
export function nicknames(model, vendorIds) {
  const full = vendorIds.map((id) => { const v = model.vendors.get(String(id)); return v ? shortName(v.name) : String(id); });
  const first = full.map((n) => n.split(/\s+/)[0]);
  const groups = new Set(model.world.groups.map((g) => g.short.split(/\s+/)[0].toLowerCase()));
  return full.map((n, i) => {
    const clash = groups.has(first[i].toLowerCase()) || first.filter((f) => f === first[i]).length > 1;
    return clash ? n.split(/\s+/).slice(0, 2).join(" ") : first[i];
  });
}

const YEARS = { AY: "the closed year", PY: "the previous year", CY: "this year" };
const TOOLS = {
  erp_get_overview: "the company overview", erp_get_agreement: "the agreement", erp_list_vendors: "the vendor master",
  erp_get_vendor: "the vendor master", erp_get_spend: "the ledger", erp_find_duplicates: "the duplicate check",
  erp_family_tree: "the register", erp_get_rebate_report: "the year-end report", sim_rebate: "the engine",
  open_gleif_search: "GLEIF", open_gleif_parent: "GLEIF", open_wikidata_owner: "Wikidata", open_ecb_rate: "the ECB's rates",
  ui_report_alert: "the alert", ui_mark_board: "the page", ui_propose_options: "the options", ui_await_decision: "your decision",
  ui_draft_action: "a draft", ui_await_approvals: "your approval", ui_final_report: "the summary", web_search: "a web search"
};

/** Group key values (CISCO) to the supplier's name (Cisco), from the accounts linked to each agreement. */
const KEYS = new WeakMap();
function groupKeys(model) {
  if (!KEYS.has(model)) {
    const map = new Map();
    for (const a of model.agreements.values()) for (const id of a.linked || []) { const k = model.vendors.get(id)?.group_key; if (k && !map.has(k)) map.set(k, a.short); }
    KEYS.set(model, map);
  }
  return KEYS.get(model);
}

/**
 * A text the agent, a tool or a script wrote, in a visitor's words: record ids become names, codes
 * become places, tool names become what they read. ctx: { model, letters: { V1: "A", … } }.
 */
export function plain(text, { model, letters = {} } = {}) {
  if (!text) return "";
  let s = String(text);
  const m = model;
  const name = (id) => (m.vendors.get(id) ? shortName(m.vendors.get(id).name) : id);
  const isVendor = (id) => !!m.vendors.get(id);
  const agreement = (id) => (m.agreements.get(id) ? `the ${m.agreements.get(id).short} agreement` : id);
  const place = (id) => m.companyCodes.get(id)?.short || id;
  // A name followed by its account number in brackets keeps the name only: "Splunk Software EMEA (10005)".
  s = s.replace(/\s?\((\d{5})\)/g, (all, id) => (isVendor(id) ? "" : all));
  // Lists of account numbers: "vendor accounts 10003, 10004 and 10005", "on 10003 Meraki, 10004 Acacia".
  s = s.replace(/\b(?:vendor )?accounts? ((?:\d{5}(?:, | and )?)+)/g, (all, ids) => {
    const found = ids.match(/\d{5}/g).filter(isVendor);
    return found.length ? `${found.length === 1 ? "the account of" : "the accounts of"} ${list(nicknames(m, found))} ` : all;
  }).replace(/ +([.,;:])/g, "$1").replace(/ {2,}/g, " ");
  s = s.replace(/^(\s*[-•]\s*)(\d{5}) /gm, (all, lead, id) => (isVendor(id) ? lead : all));
  s = s.replace(/\b(Vendor:\s*)(\d{5}) /g, (all, lead, id) => (isVendor(id) ? lead : all));
  s = s.replace(/\b(\d{5}) (?=[A-Z])/g, (all, id) => (isVendor(id) ? "" : all));
  s = s.replace(/\b\d{5}\b/g, (id) => (isVendor(id) ? name(id) : id));
  s = s.replace(/\bL-(\d{5})\b/g, (all, id) => (isVendor(id) ? name(id) : all));
  // Agreements, company codes, groups, LEIs and the SAP field name.
  s = s.replace(/\b(?:agreement )?(RA-[A-Z]+)(?= §)/g, (all, id) => (m.agreements.get(id) ? `${m.agreements.get(id).short} agreement` : all));
  s = s.replace(/\b(?:the )?(?:agreement )?(RA-[A-Z]+)\b/g, (all, id) => agreement(id));
  s = s.replace(/\(company code (CC-\d{4})\)/g, (all, id) => `(${place(id)})`);
  s = s.replace(/\bCompany code: (CC-\d{4}) ([^\n]+)/g, (all, id, n) => `Company: ${n}, ${place(id)}`);
  s = s.replace(/\b(?:company code )?(CC-\d{4})\b/g, (all, id) => place(id));
  s = s.replace(/\bG-[A-Z]+(?:-[A-Z]+)?\b/g, (id) => (m.groups.get(id) ? m.groups.get(id).short : id));
  s = s.replace(/\s?\(?(?:LEI:?\s*)?\b([0-9A-Z]{18}[0-9]{2})\b\)?/g, (all, lei) => (/[0-9]/.test(lei) && /[A-Z]/.test(lei) ? "" : all));
  s = s.replace(/\s?\((?:SAP )?vendor master field KONZS\)/g, "").replace(/\bKONZS\b/g, "group key");
  // A group key's value in capitals, CISCO, is the supplier's name to a visitor: "the Cisco group key".
  s = s.replace(/\b(?:the )?group key ([A-Z][A-Z0-9]{2,})\b(?:\s*\(group key\))?/g, (all, key) => (groupKeys(m).has(key) ? `the ${groupKeys(m).get(key)} group key` : all));
  // Tools, options and years as the agent may name them in a live run.
  s = s.replace(/\b(erp|sim|ui|open)_[a-z_]+\b|\bweb_search\b/g, (t) => TOOLS[t] || "a tool");
  s = s.replace(/\bV([1-3])\b/g, (all, n) => (letters[`V${n}`] ? `option ${letters[`V${n}`]}` : all));
  s = s.replace(/\b([Tt]he )?(AY|PY|CY)\b(?!\.)/g, (all, the, y) => (the ? `${the}${YEARS[y].replace(/^the /, "")}` : YEARS[y]));
  // Dates as people write them, and the page's own words for where the drafts wait.
  s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y, mo, d) => new Date(`${y}-${mo}-${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace(/\bSept\b/, "Sep"));
  s = s.replace(/\bin the Outbox\b/g, "in step 5").replace(/\b(?:the )?Outbox\b/g, "step 5");
  return s.replace(/\(\s*\)/g, "").replace(/ {2,}/g, " ").replace(/ ([.,;:])/g, "$1");
}

/** The live agent's messages, in this page's words: Diagnostics and the console are gone. */
export function liveWords(text) {
  return String(text || "")
    .replace(/ ?Diagnostics (can test it again|tests it again)\.?/g, "")
    .replace(/Run Diagnostics again to retest it\.?/g, "")
    .replace(/(Check the network )?or run Diagnostics;? ?/g, "$1")
    .replace(/Simulation mode/g, "the simulation")
    .replace(/in the Outbox/g, "in step 5")
    .trim();
}
