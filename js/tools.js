// The live agent's tools: JSON Schemas sent to the model, and executors that run in the browser.
// Every UI effect is emitted on the run-event bus, exactly as the simulation player does it.
//
// Guardrails enforced in code, not only in the prompt (the policy lives in js/guards.js and the
// simulation script checker applies the same rules to every scripted replay):
//   - group membership comes only from the subscription register: the engine rejects an account the
//     register does not list (unless the call is a labelled what-if), and so does linking;
//   - option € figures and times come from the latest sim_rebate result (by variant_id), never from
//     a what-if or a partial count, and the recommendation must be one of the three options;
//   - a decision belongs to the options it was taken on: a click on an older set is ignored, and
//     options cannot be proposed again once one was approved;
//   - a verified alert needs two distinct sources, two kinds of evidence gathered in this run, and
//     every account's membership established (vendor master link, or the register plus an
//     independent confirmation: GLEIF level 2, Wikidata or a web search);
//   - every outbound action is a draft carrying the AI footer; drafts only follow an approval and
//     only of the kinds the approved option contains (no posting without a set-off, nothing to the
//     supplier after the loss was accepted); the final report waits for every draft and its
//     outcome follows the decision;
//   - every money amount written into an alert, an option card, a draft or the report must match a
//     figure a tool returned, in the same currency, by scope: a claim letter may quote only the ERP
//     and open-data facts and the costed result the options rest on, never a what-if.

import { ACTION_TYPES, simulateRebate, compactForModel, DEFAULT_HORIZON_DAYS } from "./rebate.js";
import { ERP_TOOLS } from "./erp.js";
import { gleifSearch, gleifParent, wikidataOwner, ecbRate } from "./opendata.js";
import { summarizeToolResult } from "./summaries.js";
import { optionFigures, baselineFigures, decisionEffects, kpiFromResult } from "./payoff.js";
import { finalizeDraft, DRAFT_TYPES } from "./drafts.js";
import { EVIDENCE_KIND, isEvidence, EvidenceLog, FigureLedger, verifiedAlertError, draftError, reportOutcome, draftsForVariant, distinctSources, OUTCOMES } from "./guards.js";
import { isKnownId } from "./world.js";
import { ANTHROPIC } from "./config.js";
import { eurCompact } from "./format.js";

export { EVIDENCE_KIND, isEvidence, OUTCOMES };
export const LIVE_REPORT_FOOTER = "*Live agent run. GlobalCorp SE and its vendor accounts are fictional; the corporate groups are real (the Apex look-alikes are invented); figures come from the deterministic rebate engine.*";
const LETTERS = ["A", "B", "C"];
const ids = (description) => ({ type: "array", items: { type: "string" }, description });
const FIGURE_RETRIES = 2;

// ---- schemas ----------------------------------------------------------------------------------

const ACTION_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ACTION_TYPES },
    years: { type: "array", items: { type: "string", enum: ["PY", "AY"] }, description: "claim, set_off, recovery_audit: closed years to recover (default AY)." },
    start_in_days: { type: "integer", description: "Day the action starts. claim and set_off: at least the preparation days from erp_get_agreement (AY claim_preparation_days, PY look-back days); recovery_audit: any, the firm then needs its own lead time." },
    vendor_ids: ids("link_accounts: register members (from erp_family_tree) to link to the agreement; they must also be in members."),
    all_currencies: { type: "boolean", description: "fix_report: count invoices in every currency at the contract rates." },
    all_tiers: { type: "boolean", description: "fix_report: list the agreement at every tier, without a minimum." }
  },
  required: ["type"]
};

const DEFINITIONS = [
  {
    name: "erp_get_overview",
    description: "Company overview: company codes, every rebate agreement with tiers, linked accounts, agreement year and claim deadline, vendor master in figures, the year-end report rule. Call first when you need ids.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "erp_get_agreement",
    description: "One rebate agreement in full: clause text, tiers, linked accounts, periods and claim deadlines for PY, AY and CY (day numbers and dates), claim window and look-back, supplier statement basis, year-end report rule, set-off, credit-note days, claim preparation days, contract exchange rates.",
    input_schema: { type: "object", properties: { agreement_id: { type: "string" } }, required: ["agreement_id"] }
  },
  {
    name: "erp_list_vendors",
    description: "Vendor accounts filtered by text (name, city, country or category; several terms separated by commas), country code, company code, minimum spend or group key (\"none\" for accounts without one). Sorted by last year's spend.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "e.g. \"Meraki, Acacia\", \"VMware\", \"Ireland\"" },
        country: { type: "string", description: "Two-letter code, e.g. \"GB\"." },
        company_code: { type: "string", enum: ["CC-1000", "CC-2000", "CC-3000"] },
        min_spend_eur: { type: "number" },
        group_key: { type: "string", description: "Group key as in the vendor master (e.g. \"CISCO\"), or \"none\"." }
      }
    }
  },
  {
    name: "erp_get_vendor",
    description: "Full vendor master record: address, tax id, bank country, invoice currency, company code, category, group key, linked agreements, spend last year and the year before, open payables (for set-off).",
    input_schema: { type: "object", properties: { vendor_id: { type: "string" } }, required: ["vendor_id"] }
  },
  {
    name: "erp_get_spend",
    description: "Ledger spend of up to 12 accounts: last agreement year from the purchase orders (total, count, by quarter) and the year before, in the invoice currency. Periods follow agreement_id when given.",
    input_schema: {
      type: "object",
      properties: { vendor_ids: ids("Vendor ids."), agreement_id: { type: "string" } },
      required: ["vendor_ids"]
    }
  },
  {
    name: "erp_find_duplicates",
    description: "Duplicate-vendor check: accounts whose names look alike (difflib ratio) or that share a tax id or bank account, each with the register's verdict, and the register members a name rule would miss. Candidates only: never a reason to merge.",
    input_schema: {
      type: "object",
      properties: { vendor_id: { type: "string" }, name: { type: "string" }, min_similarity_pct: { type: "number", description: "Default 60." } }
    }
  },
  {
    name: "erp_family_tree",
    description: "Subscription register (corporate family-tree service): the ultimate parent of a group, every member account with legal entity, relation, LEI, acquisition date and evidence, and the group's agreements. The only merge authority. Query by group_id, vendor_id or group name.",
    input_schema: {
      type: "object",
      properties: { group_id: { type: "string" }, vendor_id: { type: "string" }, name: { type: "string" } }
    }
  },
  {
    name: "erp_get_rebate_report",
    description: "GlobalCorp's year-end rebate report as it ran for PY and AY: which accounts and currencies it counted, whether it listed the agreement and what claim it filed. Shows why money was missed.",
    input_schema: { type: "object", properties: { agreement_id: { type: "string" } }, required: ["agreement_id"] }
  },
  {
    name: "open_gleif_search",
    description: "Live GLEIF Global LEI Index: legal entities by name (full text, optionally a country code) or one LEI record, with legal address, status and whether GlobalCorp's register knows the LEI.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, lei: { type: "string" }, country: { type: "string", description: "Two-letter code of the legal address." } }
    }
  },
  {
    name: "open_gleif_parent",
    description: "Live GLEIF level-2 data for one LEI: its ultimate parent (who consolidates it) and the relationship period as reported to GLEIF, which is not necessarily the acquisition date. An independent check of the register.",
    input_schema: { type: "object", properties: { lei: { type: "string" } }, required: ["lei"] }
  },
  {
    name: "open_wikidata_owner",
    description: "Live Wikidata statements on a company: owned by (P127) and parent organisation (P749) with start dates where recorded, and its LEI. Crowd-sourced: always confirm with a second source.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
  },
  {
    name: "open_ecb_rate",
    description: "Live ECB euro reference rate for a currency (latest or on a date), next to the fixed contract rates. Agreements convert at their own fixed rate.",
    input_schema: {
      type: "object",
      properties: { currency: { type: "string", description: "e.g. GBP" }, date: { type: "string", description: "YYYY-MM-DD; omit for the latest rate." } },
      required: ["currency"]
    }
  },
  {
    name: "sim_rebate",
    description: [
      "Deterministic rebate engine (no LLM maths). For one agreement and the accounts you count (members), it returns per year (PY, AY, CY):",
      "spend at the contract rates, tier reached, rebate owed, what the supplier's statement credited, what GlobalCorp's year-end report claimed, the open amount and its claim deadline;",
      "then rebate_at_risk_eur (open amounts lost by their deadline within horizon_days), first_loss_day, the causes, and for each variant the response cost, rebate_still_lost_eur, expected total, net recovery and first cash day.",
      "members must be register members of the agreement's group (erp_family_tree) or linked accounts, and include every linked account (a count without one is partial); set what_if true only to size an unverified assumption (options can use neither).",
      "Action fields by type: claim / set_off: years, start_in_days ≥ preparation days; recovery_audit: years, start_in_days; link_accounts: vendor_ids; fix_report: all_currencies, all_tiers.",
      "Errors come back with the field to fix."
    ].join(" "),
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short description of what you assume." },
        agreement_id: { type: "string" },
        members: ids("Vendor accounts to count; default: only the linked accounts."),
        years: { type: "array", items: { type: "string", enum: ["PY", "AY", "CY"] }, description: "Optional: limit the calculation to these years (default all three)." },
        horizon_days: { type: "integer", minimum: 30, maximum: 800, description: `Default ${DEFAULT_HORIZON_DAYS}: long enough for the running year's claim.` },
        what_if: { type: "boolean", description: "Allow accounts the register does not list; the result is marked unverified." },
        variants: {
          type: "array",
          maxItems: 6,
          description: "Response options against the same position. For the decision, pass exactly three with variant_id V1, V2, V3.",
          items: {
            type: "object",
            properties: {
              variant_id: { type: "string" },
              name: { type: "string" },
              actions: { type: "array", items: ACTION_SCHEMA }
            },
            required: ["variant_id", "name", "actions"]
          }
        }
      },
      required: ["agreement_id"]
    }
  },
  {
    name: "ui_report_alert",
    description: "Raise a finding alert in the console and mark the accounts on the rebate board. basis \"verified\" needs two distinct sources, at least two kinds of evidence from this run (register, contract, ledger, report, GLEIF, Wikidata, ECB, web), and for every account not linked to an agreement a register check (erp_family_tree) plus an independent confirmation (GLEIF parent, Wikidata or web search); basis \"what_if\" labels the alert as an unverified exercise.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
        basis: { type: "string", enum: ["verified", "what_if"], description: "Default verified." },
        summary: { type: "string", description: "Two sentences: what was missed and why it matters to GlobalCorp." },
        sources: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title"] }
        },
        vendor_ids: ids("Accounts concerned."),
        group_ids: ids("Corporate groups (G-…).")
      },
      required: ["title", "severity", "summary"]
    }
  },
  {
    name: "ui_mark_board",
    description: "Colour entities on the rebate board: affected (red, rebate missed), at_risk (amber), resolved (green) or neutral. Links are register links \"L-<vendor id>\" from an account to its group. The board already follows your lookups, sim_rebate results, alerts and decisions by itself: mark only what those do not show (for example at_risk while you check a group, neutral for a look-alike you ruled out).",
    input_schema: {
      type: "object",
      properties: {
        vendor_ids: ids("Vendor accounts."),
        link_ids: ids("Register links, e.g. L-10003."),
        group_ids: ids("Corporate groups (G-…)."),
        company_code_ids: ids("Company codes (CC-…)."),
        agreement_ids: ids("Rebate agreements (RA-…), shown in the portfolio view."),
        state: { type: "string", enum: ["affected", "at_risk", "resolved", "neutral"] },
        agreement_id: { type: "string", description: "Optional: show this agreement's group view." }
      },
      required: ["state"]
    }
  },
  {
    name: "ui_propose_options",
    description: "Show exactly three response options plus the do-nothing baseline and wait for the human decision. Euro figures and days are filled in from your latest sim_rebate result by variant_id, so run sim_rebate with exactly these three variants first (verified members, not a what-if). On screen the options appear as A, B and C in the order you pass them. Returns the decision.",
    input_schema: {
      type: "object",
      properties: {
        options: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              variant_id: { type: "string", description: "V1, V2 or V3 from the latest sim_rebate call." },
              title: { type: "string", description: "Up to 8 words." },
              description: { type: "string", description: "One or two sentences: what we would do." },
              residual_risk: { type: "string", description: "One sentence: what can still go wrong." }
            },
            required: ["variant_id", "title", "description", "residual_risk"]
          }
        },
        recommended_variant_id: { type: "string" },
        baseline_description: { type: "string", description: "One sentence: what happens if we do nothing." }
      },
      required: ["options", "recommended_variant_id", "baseline_description"]
    }
  },
  {
    name: "ui_await_decision",
    description: "After an option was rejected, wait for the human's next decision on the remaining options or on accepting the loss. Returns the decision.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "ui_draft_action",
    description: "Queue one outbound action as a draft in the Outbox, pending human approval. Nothing is ever sent or posted. Only the kinds of action the approved option contains: a posting needs a set-off in the option; nothing goes to the supplier after the loss was accepted. Use names, amounts and dates from tool results only.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: DRAFT_TYPES, description: "email: claim letter or supplier email; posting: set-off or credit-memo posting (mock); memo: internal note, e.g. a vendor-master change request." },
        recipient: { type: "string", description: "Company and function, e.g. \"Cisco Systems, Inc., Global Rebates team\"." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text. Claim letters: the clause, the accounts, the amount and year, the deadline, signature \"Procurement Controlling, GlobalCorp SE\". Postings: company code, vendor, amount, reference." }
      },
      required: ["type", "recipient", "subject", "body"]
    }
  },
  {
    name: "ui_await_approvals",
    description: "Wait until the human has approved or rejected every draft in the Outbox. Returns each decision. Call after the last ui_draft_action and before ui_final_report.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "ui_final_report",
    description: "Publish the management summary (Markdown) and end the workflow. Every amount must come from tool results.",
    input_schema: {
      type: "object",
      properties: {
        markdown: { type: "string" },
        outcome: { type: "string", enum: ["response_decided", "loss_accepted", "no_material_finding", "monitoring"], description: "Follows the decision: response_decided after an approved option, loss_accepted after accepting the loss; without options, no_material_finding or monitoring." }
      },
      required: ["markdown"]
    }
  }
];

/** Tool list for a request; web search is omitted when the organisation has it switched off. */
export function toolDefinitions({ webSearch = true } = {}) {
  const tools = DEFINITIONS.map((d) => ({ ...d }));
  if (webSearch) tools.unshift({ ...ANTHROPIC.webSearchTool });
  return tools;
}

export const UI_BLOCKING_TOOLS = new Set(["ui_propose_options", "ui_await_decision", "ui_await_approvals"]);

// ---- executors ----------------------------------------------------------------------------------

/**
 * Creates the executor for one run.
 * ctx: { model, emit, waitUntil(test) → Promise, takeOptionDecision(pred) → ev|null, drafts: Map,
 *        onPhase(state), signal? (aborts open-data lookups) }
 * execute() resolves { content (string for tool_result), isError, result (object for the UI), summary }.
 */
export function createToolbox(ctx) {
  const run = {
    calculations: 0,
    lastResult: null,          // latest successful sim_rebate result
    lastWithVariants: null,    // latest successful result that costed variants
    optionsSource: null,       // the result the options on screen were costed on
    options: null,             // options shown to the human
    optionsPayload: null,      // the full "options" event payload (for the approval payoff)
    optionsSeq: 0,             // which set of options a decision belongs to
    rejected: new Set(),
    approvedOption: null,      // { id, label, letter }
    alertBasis: null,
    evidence: new EvidenceLog(),
    ledger: new FigureLedger(),
    figureRejections: { draft: 0, report: 0, options: 0, alert: 0 },
    reported: false,
    outcome: null
  };
  const io = { signal: ctx.signal };

  const handlers = {
    ...Object.fromEntries(Object.entries(ERP_TOOLS).map(([name, fn]) => [name, (i) => fn(ctx.model, i || {})])),
    open_gleif_search: (i) => gleifSearch(ctx.model, i, io),
    open_gleif_parent: (i) => gleifParent(ctx.model, i, io),
    open_wikidata_owner: (i) => wikidataOwner(ctx.model, i, io),
    open_ecb_rate: (i) => ecbRate(ctx.model, i, io),
    sim_rebate: simRebate,
    ui_report_alert: reportAlert,
    ui_mark_board: markBoard,
    ui_propose_options: proposeOptions,
    ui_await_decision: awaitDecision,
    ui_draft_action: draftAction,
    ui_await_approvals: awaitApprovals,
    ui_final_report: finalReport
  };

  async function execute(name, input = {}) {
    const fn = handlers[name];
    if (!fn) return done({ error: `Unknown tool "${name}".` }, true, name);
    let result;
    try {
      result = await fn(input || {});
    } catch (e) {
      // Cancellation (the agent's abort symbol or a fetch AbortError) ends the run, not the tool.
      if (typeof e === "symbol" || e?.name === "AbortError") throw e;
      console.error(`[Rebate Hunter] tool ${name} failed:`, e);
      result = { error: `The tool failed unexpectedly (${String(e?.message || "unknown error")}). Try different input or another tool.` };
    }
    const isError = !!(result && (result.error || result.ok === false));
    if (!isError && !name.startsWith("ui_") && name !== "sim_rebate") {
      run.ledger.addFacts(result);
      run.evidence.note(name, input, result);
    }
    return done(result, isError, name);
  }

  function done(result, isError, name) {
    const forModel = name === "sim_rebate" && result?.ok ? compactForModel(result) : result;
    return {
      content: JSON.stringify(forModel),
      isError,
      result: forModel,
      summary: summarizeToolResult(name, forModel)
    };
  }

  /**
   * Web search runs on Anthropic's side. The agent loop reports its results here once the response
   * that ran it is kept, so a search in a failed or discarded attempt never counts as evidence.
   * Search titles are not figures a text may quote.
   */
  function noteWebSearch(ok, results = []) {
    if (!ok) return;
    run.evidence.note("web_search", {}, { results });
  }

  // -- sim_rebate -------------------------------------------------------------------------------
  function simRebate(spec) {
    const res = simulateRebate(ctx.model, spec);
    if (!res.ok) return res;
    run.calculations += 1;
    run.lastResult = res;
    run.ledger.addEngine(res);
    if (res.variants?.length) run.lastWithVariants = res;
    ctx.emit("kpi_update", kpiFromResult(res, run.calculations === 1 ? "first estimate" : "verified"));
    return res;
  }

  // -- alerts and board ---------------------------------------------------------------------------
  function reportAlert(i) {
    const basis = i.basis === "what_if" ? "what_if" : "verified";
    if (basis === "verified") {
      const e = verifiedAlertError(ctx.model, i, run.evidence);
      if (e) return { error: e };
    }
    const scope = basis === "verified" ? "alert_verified" : "alert_what_if";
    let title = String(i.title || "Rebate finding").slice(0, 160);
    let summary = String(i.summary || "").slice(0, 600);
    const audit = figureCheck(`${title}\n${summary}`, "alert", scope, "ui_report_alert");
    if (audit.reject) return audit.reject;
    if (audit.flag) { title = strike(title, audit.bad); summary = strike(summary, audit.bad); }
    const unknown = unknownIds(i, ["vendor_ids", "group_ids"]);
    run.alertBasis = basis;
    const sources = distinctSources(i.sources);
    ctx.emit("alert", {
      title, basis,
      severity: ["critical", "high", "medium", "low"].includes(i.severity) ? i.severity : "high",
      summary,
      sources: sources.slice(0, 6).map((s) => ({ title: String(s.title || s.url).slice(0, 200), url: safeHttpUrl(s.url) })),
      evidence: run.evidence.describe(ctx.model),
      vendor_ids: knownIds(i.vendor_ids), group_ids: knownIds(i.group_ids),
      link_ids: knownIds((i.vendor_ids || []).map((v) => `L-${v}`))
    });
    return { ok: true, shown: true, evidence_kinds: run.evidence.kinds(), ...(unknown.length ? { ignored_unknown_ids: unknown } : {}) };
  }

  function markBoard(i) {
    const state = ["affected", "at_risk", "resolved", "neutral"].includes(i.state) ? i.state : "affected";
    const m = ctx.model;
    // Each list takes only ids of its own kind; anything else is reported back, not marked.
    const only = (list, ok) => [...new Set((Array.isArray(list) ? list : []).map(String))].filter(ok).slice(0, 40);
    const p = {
      vendor_ids: only(i.vendor_ids, (id) => m.vendors.has(id)),
      link_ids: only(i.link_ids, (id) => id.startsWith("L-") && isKnownId(m, id)),
      group_ids: only(i.group_ids, (id) => m.groups.has(id)),
      company_code_ids: only(i.company_code_ids, (id) => m.companyCodes.has(id)),
      agreement_ids: only(i.agreement_ids, (id) => m.agreements.has(id)),
      state
    };
    const focusId = i.agreement_id === undefined || i.agreement_id === null || i.agreement_id === "" ? null : String(i.agreement_id);
    if (focusId && m.agreements.has(focusId)) p.focus = focusId;
    ctx.emit("board_update", p);
    const left = (key) => (Array.isArray(i[key]) ? i[key] : []).map(String).filter((id) => !p[key].includes(id));
    const ignored = [...new Set([
      ...["vendor_ids", "link_ids", "group_ids", "company_code_ids", "agreement_ids"].flatMap(left),
      ...(focusId && !p.focus ? [focusId] : [])
    ])];
    return {
      ok: true,
      marked: p.vendor_ids.length + p.link_ids.length + p.group_ids.length + p.company_code_ids.length + p.agreement_ids.length,
      ...(ignored.length ? { ignored_unknown_ids: ignored, hint: "Unknown ids, or ids in the wrong list (vendor_ids take vendor accounts, group_ids G-…, company_code_ids CC-…, agreement_ids and agreement_id RA-…, link_ids L-<vendor id>)." } : {})
    };
  }

  function knownIds(list) {
    return (Array.isArray(list) ? list : []).map(String).filter((id) => isKnownId(ctx.model, id)).slice(0, 40);
  }
  function unknownIds(i, keys) {
    return keys.flatMap((k) => (Array.isArray(i[k]) ? i[k] : []).map(String).filter((id) => !isKnownId(ctx.model, id)));
  }

  // -- options and decisions --------------------------------------------------------------------------
  async function proposeOptions(i) {
    if (run.approvedOption) return { error: `A decision was already taken: ${run.approvedOption.label}. Continue with its drafts; the options cannot be proposed again.` };
    const src = run.lastWithVariants;
    const list = Array.isArray(i.options) ? i.options : [];
    if (list.length !== 3) return { error: "Exactly three options are required (plus the automatic do-nothing baseline)." };
    if (!src) return { error: "No costed variants yet. Call sim_rebate with the verified members and exactly three variants (V1, V2, V3) first." };
    if (run.lastResult !== src) {
      return { error: "Your latest sim_rebate call has no variants, so the options would be costed against an earlier position. Call sim_rebate again with the current members and exactly three variants (V1, V2, V3), then propose the options." };
    }
    if (src.basis === "what_if") {
      return { error: "Your latest sim_rebate result is a what-if with accounts the register does not list. Options must rest on verified members: call sim_rebate without what_if, counting only register members, then propose the options." };
    }
    if (src.basis === "partial") {
      return { error: "Your latest sim_rebate result leaves out linked accounts (a partial count). Options must rest on the full position: call sim_rebate again with every linked account in members, then propose the options." };
    }
    const seen = new Set();
    const options = [];
    for (const [k, o] of list.entries()) {
      const v = src.variants.find((x) => x.variant_id === o.variant_id);
      if (!v) return { error: `variant_id "${o.variant_id}" is not in the latest sim_rebate result (has: ${src.variants.map((x) => x.variant_id).join(", ")}).` };
      if (seen.has(v.variant_id)) return { error: `variant_id "${v.variant_id}" is used twice.` };
      seen.add(v.variant_id);
      options.push({
        id: v.variant_id, letter: LETTERS[k],
        title: String(o.title || v.name).slice(0, 90),
        description: String(o.description || v.actions.join("; ")).slice(0, 400),
        residual_risk: String(o.residual_risk || "").slice(0, 300),
        ...optionFigures(v),
        recommended: v.variant_id === i.recommended_variant_id
      });
    }
    if (!options.some((o) => o.recommended)) {
      return { error: `recommended_variant_id "${i.recommended_variant_id ?? ""}" is not one of the options (${options.map((o) => o.id).join(", ")}).` };
    }
    // The texts on the cards may quote only the facts and the figures of this result.
    run.ledger.setOptionsSource(src);
    let baselineText = String(i.baseline_description || "");
    const audit = figureCheck([baselineText, ...options.flatMap((o) => [o.title, o.description, o.residual_risk])].join("\n"), "options", "options", "ui_propose_options");
    if (audit.reject) return audit.reject;
    if (audit.flag) {
      for (const o of options) { o.title = strike(o.title, audit.bad); o.description = strike(o.description, audit.bad); o.residual_risk = strike(o.residual_risk, audit.bad); }
      baselineText = strike(baselineText, audit.bad);
    }
    // Decisions queued for an earlier set of options (a click just before this one replaced them) are dropped.
    while (ctx.takeOptionDecision(() => true)) { /* discard stale decisions */ }
    run.optionsSeq += 1;
    run.optionsSource = src;
    run.options = options;
    run.rejected.clear();
    run.optionsPayload = {
      options_seq: run.optionsSeq,
      horizon_days: src.horizon_days,
      agreement_id: src.agreement_id,
      group_id: src.group_id || null,
      member_vendor_ids: (src.members || []).map((m) => m.vendor_id),
      recommended: i.recommended_variant_id,
      options,
      baseline: baselineFigures(src, baselineText)
    };
    ctx.onPhase("options");
    ctx.emit("options", run.optionsPayload);
    return waitForDecision();
  }

  async function awaitDecision() {
    if (!run.options) return { error: "No options are on screen. Use ui_propose_options first." };
    if (run.approvedOption) return { error: `A decision was already taken: ${run.approvedOption.label}. Continue with the drafts.` };
    return waitForDecision();
  }

  /** A decision counts only for the options on screen, and only once per option. */
  function validDecision(ev) {
    const p = ev?.payload || {};
    if (p.options_seq !== run.optionsSeq) return false;
    if (p.option_id === "baseline") return true;
    return run.options.some((o) => o.id === p.option_id) && !run.rejected.has(p.option_id);
  }

  async function waitForDecision() {
    ctx.onPhase("awaiting_approval");
    const ev = await ctx.waitUntil(() => ctx.takeOptionDecision(validDecision));
    const { option_id: id, decision } = ev.payload;
    const opt = run.options.find((o) => o.id === id) || null;
    const label = id === "baseline" ? "Do nothing (accept the loss)" : `Option ${opt.letter}: ${opt.title}`;
    if (decision === "approved") {
      run.approvedOption = { id, label, letter: opt ? opt.letter : null };
      for (const [type, payload] of decisionEffects(run.optionsPayload, id)) ctx.emit(type, payload);
      ctx.onPhase("executing");
      if (id === "baseline") {
        return { decision: "approved", option_id: "baseline", option: label,
          next: "The human accepted the loss. Do not contact the supplier. Draft one internal memo to Procurement Controlling recording the decision (ui_draft_action, type memo), then ui_await_approvals, then ui_final_report with outcome loss_accepted." };
      }
      const variant = run.optionsSource.variants.find((v) => v.variant_id === id);
      return { decision: "approved", option_id: id, option: label,
        figures: { response_cost: eurCompact(opt.response_cost_eur), still_lost: eurCompact(opt.residual_var_eur), expected_total: eurCompact(opt.total_cost_eur), net_recovery: eurCompact(opt.savings_eur), first_cash_day: opt.time_days },
        next: `Call it "option ${opt.letter}" (as on screen), never ${id}. Draft what this option contains, and nothing else: ${draftsForVariant(variant)}. Then call ui_await_approvals, then ui_final_report with outcome response_decided.` };
    }
    run.rejected.add(id);
    const remaining = run.options.filter((o) => !run.rejected.has(o.id)).map((o) => `Option ${o.letter} (${o.id})`);
    return {
      decision: "rejected", option_id: id, option: label, ...(opt ? { refer_to_it_as: `option ${opt.letter}` } : {}),
      remaining_options: remaining,
      next: remaining.length
        ? "Acknowledge the rejection in one sentence and do not draft anything for it. Then call ui_await_decision to wait for the next decision."
        : "All three options were rejected. Say that nothing is claimed unless the human accepts the loss, then call ui_await_decision once more."
    };
  }

  // -- drafts and approvals ----------------------------------------------------------------------------
  function draftAction(i) {
    const type = DRAFT_TYPES.includes(i.type) ? i.type : null;
    if (!type) return { error: `type must be ${DRAFT_TYPES.join(", ")}.` };
    const subject = String(i.subject || "").trim();
    const raw = String(i.body || "").trim();
    if (!subject || !raw) return { error: "subject and body are required." };
    const approved = run.approvedOption;
    const variant = approved && approved.id !== "baseline" ? run.optionsSource?.variants.find((v) => v.variant_id === approved.id) : null;
    const rule = draftError({ type, approved, variant, agreement: run.optionsPayload ? ctx.model.agreements.get(run.optionsPayload.agreement_id) : null });
    if (rule) return { error: rule };
    let body = finalizeDraft(type, raw);
    const audit = figureCheck(`${subject}\n${raw}`, "draft", "draft", "ui_draft_action", { labelled: type === "posting" });
    if (audit.reject) return audit.reject;
    if (audit.flag) body = finalizeDraft(type, `${raw}\n\nUnchecked amounts: ${audit.flag}. Verify them against the option card before approving.`);
    const action_id = `act-${ctx.drafts.size + 1}`;
    ctx.drafts.set(action_id, { status: "pending", subject, recipient: String(i.recipient || "").slice(0, 160), type });
    ctx.onPhase("executing");
    ctx.emit("action_draft", { action_id, type, recipient: String(i.recipient || "").slice(0, 160), subject: subject.slice(0, 200), body, status: "pending", ...(audit.flag ? { unchecked: audit.bad } : {}) });
    return { action_id, status: "pending_approval", note: "Queued in the Outbox as a draft. Nothing is sent or posted." };
  }

  async function awaitApprovals() {
    const pending = () => [...ctx.drafts.values()].filter((d) => d.status === "pending").length;
    if (!ctx.drafts.size) return { error: "There are no drafts. Use ui_draft_action first." };
    if (pending()) {
      ctx.onPhase("awaiting_approval");
      ctx.emit("notice", { level: "info", text: `Waiting for your approval of ${pending()} draft${pending() === 1 ? "" : "s"} in the Outbox.` });
      await ctx.waitUntil(() => pending() === 0);
    }
    ctx.onPhase("executing");
    const decisions = [...ctx.drafts.entries()].map(([id, d]) => ({ action_id: id, recipient: d.recipient, subject: d.subject, decision: d.status }));
    return {
      all_decided: true,
      approved: decisions.filter((d) => d.decision === "approved").length,
      rejected: decisions.filter((d) => d.decision === "rejected").length,
      decisions,
      next: "Write the management summary with ui_final_report. Approved drafts are cleared for sending by a human; nothing was sent or posted."
    };
  }

  function finalReport(i) {
    const pendingCount = [...ctx.drafts.values()].filter((d) => d.status === "pending").length;
    if (pendingCount) return { error: `${pendingCount} draft(s) are still pending. Call ui_await_approvals first.` };
    const outcome = reportOutcome({ requested: i.outcome, optionsShown: !!run.options, approved: run.approvedOption });
    if (outcome.error) return { error: outcome.error };
    let markdown = String(i.markdown || "").trim().slice(0, 19000);
    if (markdown.length < 40) return { error: "The report is empty. Write a short Markdown management summary." };
    const audit = figureCheck(markdown, "report", "report", "ui_final_report");
    if (audit.reject) return audit.reject;
    if (audit.flag) markdown = `${markdown}\n\n*Unchecked amounts (no tool returned them): ${audit.flag}.*`;
    // Every live report states what it is, whatever the model wrote.
    if (!/live agent run/i.test(markdown)) markdown = `${markdown}\n\n${LIVE_REPORT_FOOTER}`;
    run.reported = true;
    run.outcome = outcome.outcome;
    ctx.emit("report", { markdown, outcome: run.outcome });
    return { ok: true, published: true, outcome: run.outcome, next: "End your turn now with one short closing sentence." };
  }

  /**
   * Figure audit for free text, by scope (js/guards.js): rejects up to FIGURE_RETRIES times with the
   * amounts to fix, then lets the text through with the unchecked amounts named (drafts, report) or
   * marked (alert, option cards), and says so in the console.
   */
  function figureCheck(text, kind, scope, tool, { labelled = false } = {}) {
    const bad = run.ledger.unknown(text, scope, { labelled });
    if (!bad.length) return {};
    const list = bad.slice(0, 6).map((a) => a.raw).join(", ");
    if (run.figureRejections[kind] < FIGURE_RETRIES) {
      run.figureRejections[kind] += 1;
      const allowed = scope === "draft" || scope === "options"
        ? "the figures of the sim_rebate result the options rest on, or the ERP and open-data results (never a what-if or a partial count)"
        : "the figures of sim_rebate (not a what-if) or the ERP and open-data results";
      return { reject: { error: `These amounts match no figure this text may quote, in its currency: ${list}. Use ${allowed}, written as they are (or leave the amount out), then call ${tool} again.` } };
    }
    const where = { draft: "draft", report: "summary", options: "option cards", alert: "alert" }[kind];
    ctx.emit("notice", { level: "warn", text: `The ${where} quote${kind === "options" ? "" : "s"} amounts no tool returned (${list}); they are marked as unchecked.` });
    return { flag: list, bad: bad.map((a) => a.raw) };
  }

  return {
    execute,
    noteWebSearch,
    state: () => ({ ...run, rejected: [...run.rejected], ledger: undefined, evidence: run.evidence.kinds() })
  };
}

/** Marks unchecked amounts in a short text shown on a card: "€1.2M" → "€1.2M (unchecked)". */
function strike(text, bad = []) {
  let out = String(text || "");
  for (const raw of bad) out = out.split(raw).join(`${raw} (unchecked)`);
  return out;
}

function safeHttpUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
