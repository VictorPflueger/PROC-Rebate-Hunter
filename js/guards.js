// Guardrail policy shared by the live tools (js/tools.js) and the simulation script checker
// (js/sim_check.js), so a live run and a scripted replay are held to the same rules:
//   - evidence: which tool results count, and for what (a lookup that found nothing never counts);
//   - verified alerts: two distinct sources, two kinds of evidence, every account's group membership
//     established (vendor master link, or the register plus an independent confirmation);
//   - figures: which tool results a text may quote, by where the text goes (a claim letter may quote
//     only the facts and the costed result the options rest on, never a what-if);
//   - drafts: only the kinds of action the approved option contains;
//   - the management summary's outcome follows the human decision.

import { registerEntry } from "./world.js";
import { FigureSet, collectFigures, unknownAmounts } from "./figures.js";

// ---- evidence --------------------------------------------------------------------------------------

// Tools whose successful results count as evidence for a verified alert, by kind.
export const EVIDENCE_KIND = {
  erp_family_tree: "register", erp_get_agreement: "contract", erp_get_spend: "ledger", erp_get_rebate_report: "report",
  open_gleif_search: "gleif", open_gleif_parent: "gleif", open_wikidata_owner: "wikidata", open_ecb_rate: "ecb",
  web_search: "web"
};

/** Does a successful result count as evidence? A lookup that found nothing does not. */
export function isEvidence(name, r) {
  if (!EVIDENCE_KIND[name] || !r || r.error || r.ok === false) return false;
  if (name === "erp_family_tree") return Array.isArray(r.members) && r.members.length > 0;
  if (name === "erp_get_spend") return Array.isArray(r.accounts) && r.accounts.some((a) => !a.error);
  if (name === "open_gleif_search") return Array.isArray(r.records) && r.records.length > 0;
  // A GLEIF record without a reported parent says who the entity is, not whom it belongs to.
  if (name === "open_gleif_parent") return !!r.entity && r.found !== false && !!r.ultimate_parent?.lei;
  if (name === "open_wikidata_owner") return !!r.item && r.found !== false;
  if (name === "web_search") return Array.isArray(r.results) && r.results.length > 0;
  return true;
}

/** The details of an evidence result that the alert rule needs. */
function evidenceDetail(name, input, r) {
  switch (name) {
    case "erp_family_tree": return { group_id: r.group?.id || null, members: (r.members || []).map((m) => String(m.vendor_id)) };
    case "open_gleif_parent": return { entity_lei: r.entity?.lei || null, parent_lei: r.ultimate_parent?.lei || null };
    case "open_wikidata_owner": return { owners: [...(r.owned_by || []), ...(r.parent_organization || [])].map((o) => String(o.name || "")) };
    case "web_search": return { results: (r.results || []).length };
    default: return {};
  }
}

/** Evidence gathered in one run, in order. */
export class EvidenceLog {
  constructor() { this.entries = []; }
  note(name, input, result) {
    if (!isEvidence(name, result)) return false;
    this.entries.push({ kind: EVIDENCE_KIND[name], tool: name, detail: evidenceDetail(name, input || {}, result) });
    return true;
  }
  kinds() { return [...new Set(this.entries.map((e) => e.kind))]; }
  clone() { const c = new EvidenceLog(); c.entries = this.entries.slice(); return c; }
  /** Plain-language list of what was checked, for the alert card. */
  describe(model) {
    const out = [];
    for (const e of this.entries) {
      let text;
      if (e.tool === "erp_family_tree") text = `register: ${model.groups.get(e.detail.group_id)?.short || e.detail.group_id} family tree`;
      else if (e.tool === "open_gleif_parent") text = `GLEIF: ${e.detail.entity_lei} consolidated by ${e.detail.parent_lei}`;
      else if (e.tool === "web_search") text = `web search (${e.detail.results} result${e.detail.results === 1 ? "" : "s"})`;
      else text = { contract: "contract clause", ledger: "ledger spend", report: "year-end report", gleif: "GLEIF record", wikidata: "Wikidata statements", ecb: "ECB reference rate" }[e.kind] || e.kind;
      if (!out.includes(text)) out.push(text);
    }
    return out;
  }
}

/** Sources that are really different: the same URL (or title, without a URL) counts once. */
export function distinctSources(list) {
  const seen = new Set();
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || !(s.title || s.url)) continue;
    let key = String(s.title || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "");
    try { if (s.url) { const u = new URL(String(s.url)); key = `${u.host}${u.pathname}`.replace(/\/+$/, "").toLowerCase(); } } catch { /* keep the title key */ }
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Checks a verified alert against the evidence of the run. Returns an error message, or null.
 * Every account the alert names must belong to the group by the vendor master (linked to an
 * agreement) or by the register, and a register-only membership needs an independent confirmation:
 * a GLEIF parent with the group's LEI, Wikidata naming the group as owner, or a web search.
 */
export function verifiedAlertError(model, alert, log) {
  const sources = distinctSources(alert.sources);
  if (sources.length < 2) {
    return "A verified alert needs at least two distinct sources (two different documents, not one cited twice). Gather a second, independent source first, narrate \"Not confirmed:\" and state the uncertainty, or raise it with basis \"what_if\".";
  }
  const kinds = log.kinds();
  if (kinds.length < 2) {
    return `A verified alert needs two kinds of evidence gathered in this run (for example the register and GLEIF, or the contract and the ledger); so far: ${kinds.join(", ") || "none"}. Check a second, independent source first, or raise it with basis "what_if".`;
  }
  const needConfirmation = new Map(); // group id -> vendor ids resting on the register alone
  for (const id of (alert.vendor_ids || []).map(String)) {
    const v = model.vendors.get(id);
    if (!v) continue;
    if ((model.agreementsOfVendor.get(id) || []).length) continue; // linked in the vendor master
    const reg = registerEntry(model, id);
    if (!reg) {
      return `${id} (${v.name}) has no entry in the subscription register, so no group membership is established. Leave it out of the alert, or raise the alert with basis "what_if".`;
    }
    const checked = log.entries.some((e) => e.tool === "erp_family_tree" && e.detail.members.includes(id));
    if (!checked) {
      return `${id} (${v.name}) is not linked to any agreement, and its group membership has not been checked in the subscription register in this run. Call erp_family_tree first.`;
    }
    if (!needConfirmation.has(reg.group)) needConfirmation.set(reg.group, []);
    needConfirmation.get(reg.group).push(id);
  }
  for (const [gid, vids] of needConfirmation) {
    const g = model.groups.get(gid);
    const short = String(g?.short || "").toLowerCase();
    const confirmed = log.entries.some((e) =>
      (e.tool === "open_gleif_parent" && g?.lei && e.detail.parent_lei === g.lei) ||
      (e.tool === "open_wikidata_owner" && short && e.detail.owners.some((o) => o.toLowerCase().includes(short))) ||
      e.tool === "web_search");
    if (!confirmed) {
      return `The membership of ${vids.join(", ")} in ${g?.name || gid} rests on the register alone. Confirm it with an independent source first (GLEIF level 2 showing ${g?.short || "the group"} as ultimate parent, Wikidata, or a web search), or raise the alert with basis "what_if".`;
    }
  }
  return null;
}

// ---- figures ---------------------------------------------------------------------------------------

/**
 * The figures a run's tools returned, kept apart by origin, so each kind of text can quote only what
 * it may: ERP and open-data facts, and engine results (verified, partial or what-if).
 */
export class FigureLedger {
  constructor() {
    this.facts = new FigureSet();
    this.engine = [];          // { res, basis, set }
    this.optionsSource = null; // the engine result the options were costed on
  }
  addFacts(result) { collectFigures(result, this.facts); }
  clone() {
    const c = new FigureLedger();
    c.facts.items = this.facts.items.slice();
    c.engine = this.engine.slice();
    c.optionsSource = this.optionsSource;
    return c;
  }
  addEngine(res) {
    const entry = { res, basis: res.basis, set: collectFigures(res) };
    this.engine.push(entry);
    return entry;
  }
  setOptionsSource(res) {
    this.optionsSource = this.engine.find((e) => e.res === res) || this.addEngine(res);
  }
  /**
   * narration: anything a tool returned; alert_verified and report: facts and every engine result
   * that is not a what-if; alert_what_if: also what-ifs; options and draft: facts and the result
   * the options were costed on.
   */
  scope(kind) {
    const all = this.engine.map((e) => e.set);
    const notWhatIf = this.engine.filter((e) => e.basis !== "what_if").map((e) => e.set);
    switch (kind) {
      case "narration": case "alert_what_if": return [this.facts, ...all];
      case "alert_verified": case "report": return [this.facts, ...notWhatIf];
      case "options": case "draft": return [this.facts, ...(this.optionsSource ? [this.optionsSource.set] : notWhatIf.slice(-1))];
      default: return [this.facts];
    }
  }
  unknown(text, kind, { labelled = false } = {}) {
    return [...new Map(unknownAmounts(text, this.scope(kind), { labelled }).map((a) => [a.raw, a])).values()];
  }
}

// ---- drafts and the summary ------------------------------------------------------------------------

const SUPPLIER_ACTIONS = ["claim", "set_off", "recovery_audit"];

/**
 * Which drafts an approval allows. approved: { id, letter? } or null; variant: the engine variant of
 * the approved option (with action_types). Returns an error message, or null.
 */
export function draftError({ type, approved, variant, agreement }) {
  if (!approved) return "Drafts follow a human decision. Propose options with ui_propose_options and wait for an approval first.";
  if (approved.id === "baseline") {
    return type === "memo" ? null : "The human accepted the loss: nothing goes to the supplier and nothing is posted. Draft one internal memo recording the decision (type memo).";
  }
  const acts = new Set(variant?.action_types || []);
  const name = approved.letter ? `Option ${approved.letter}` : "The approved option";
  if (type === "posting" && !acts.has("set_off")) {
    return `${name} contains no set-off, so there is nothing to post${agreement && !agreement.set_off_allowed ? ` (${agreement.id} does not allow set-off)` : ""}. Draft only what the option contains: ${describeActions(acts)}.`;
  }
  if (type === "email" && !SUPPLIER_ACTIONS.some((a) => acts.has(a))) {
    return `${name} contains no claim, set-off or recovery audit, so there is no letter to send. Draft internal memos for what it contains: ${describeActions(acts)}.`;
  }
  return null;
}

/** What the approved option's drafts are, in words, for the agent's next step. */
export function draftsForVariant(variant) {
  return describeActions(new Set(variant?.action_types || []));
}

function describeActions(acts) {
  const words = { claim: "a written claim (email)", set_off: "a set-off (notice email and posting)", recovery_audit: "a recovery-audit engagement (email)", link_accounts: "a vendor-master change (memo)", fix_report: "a report change request (memo)" };
  return [...acts].map((a) => words[a] || a).join(", ") || "nothing";
}

export const OUTCOMES = ["response_decided", "loss_accepted", "no_material_finding", "monitoring"];

/**
 * The outcome of the management summary, from the human decision. Returns { outcome } or { error }.
 * optionsShown: options were on screen; approved: { id } or null.
 */
export function reportOutcome({ requested, optionsShown, approved }) {
  const asked = OUTCOMES.includes(requested) ? requested : null;
  if (approved) {
    const outcome = approved.id === "baseline" ? "loss_accepted" : "response_decided";
    if (asked && asked !== outcome) {
      return { error: `The outcome is ${outcome}: the human ${approved.id === "baseline" ? "accepted the loss" : "approved an option"}. Write the summary for that decision and publish it with outcome "${outcome}".` };
    }
    return { outcome };
  }
  if (optionsShown) return { error: "The options are still waiting for a human decision. Call ui_await_decision first; the summary follows the decision." };
  if (asked === "no_material_finding" || asked === "monitoring") return { outcome: asked };
  return { error: "No options were proposed, so there is no decision to report. Publish the summary with outcome \"no_material_finding\" (nothing material found) or \"monitoring\" (a lead that is not confirmed yet), or verify, cost three options and propose them first." };
}
