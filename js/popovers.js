// Detail popovers for the rebate board, built from the same ERP queries the agent uses and from the
// engine's figures the board shows.

import { h } from "./dom.js";
import { eurCompact, eurFull, eurMillions, shortDate } from "./format.js";
import { erpGetVendor, erpCompanyCode, erpFamilyTree, relationText } from "./erp.js";
import { registerEntry } from "./world.js";
import { CHECK_LABEL, agreementSummary } from "./board_data.js";
import { periodText, viaText, TAG_TONE } from "./board_race.js";

const STATE_TEXT = { affected: "Rebate missed", at_risk: "At risk", resolved: "Approved or settled" };

function stateChip(state) {
  if (!state || state === "neutral") return null;
  // Red, amber, green as everywhere on the board (the Navigator's popups show a missed state in grey).
  const tone = state === "affected" ? "danger" : state === "at_risk" ? "risk" : "approved";
  return tag(tone, STATE_TEXT[state]);
}

/** A Vici tag in one of the board's tones (TAG_TONE). */
function tag(tone, text) {
  return h("span", { class: ["vc-tag", TAG_TONE[tone] || ""] }, text);
}

function dl(rows) {
  return h("dl", { class: "pop-grid" }, rows.filter(Boolean).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
}

function money(value, currency) {
  return currency && currency !== "EUR" ? `${currency} ${eurFull(value).replace("€", "")}` : eurFull(value);
}

/**
 * A vendor account: the vendor master, its register link and, on the board, how it relates to the
 * agreement in view and what this run has checked about it.
 * ctx: { agreementId, placeText, checks: [kind] }
 */
export function vendorPopover(model, id, state, ctx = {}) {
  const v = erpGetVendor(model, id);
  if (v.error) return h("div", {}, v.error);
  const rel = relationText(model, id);
  const r = registerEntry(model, id);
  return h("div", {},
    h("div", { class: "pop-title" }, v.name),
    h("div", { class: "pop-sub" }, `Vendor account ${v.id} in ${v.city}, ${v.country}`),
    h("div", { class: "pop-tags" },
      stateChip(state),
      v.group_key ? tag("info", `Group key ${v.group_key}`) : tag("risk", "No group key"),
      v.linked_agreements.length ? tag("info", `Linked to ${v.linked_agreements.join(", ")}`) : null
    ),
    dl([
      ctx.placeText ? ["On the board", ctx.placeText] : null,
      ["Category", v.category],
      ["Spend", h("div", {}, h("div", {}, `${money(v.spend.last_year, v.invoice_currency)} in the closed year`), h("div", {}, `${money(v.spend.year_before, v.invoice_currency)} in the year before`))],
      ["Billed to", `${v.company_code.id} ${v.company_code.name}`],
      ["Register", rel ? `${rel.text}${rel.lei ? `, LEI ${rel.lei}` : ""}` : "no entry: no corporate parent on record"],
      r ? ["Legal entity", r.legal] : null,
      r?.evidence ? ["Evidence", r.evidence] : null,
      ctx.checks ? ["Checked in this run", ctx.checks.length ? ctx.checks.map((k) => CHECK_LABEL[k] || k).join(", ") : "not yet"] : null,
      ["Open payables", eurFull(v.open_payables_eur)],
      ["Tax id, bank", `${v.tax_id}, ${v.bank_account}`]
    ]),
    h("div", { class: "pop-note" }, `${v.note} Group membership counts only as the subscription register says.`)
  );
}

export function companyCodePopover(model, id, state) {
  const c = erpCompanyCode(model, id);
  if (c.error) return h("div", {}, c.error);
  return h("div", {},
    h("div", { class: "pop-title" }, `${c.code} ${c.name}`),
    h("div", { class: "pop-sub" }, c.role),
    h("div", { class: "pop-tags" }, stateChip(state)),
    dl([
      ["City", `${c.city}, ${c.country}`],
      ["Currency", c.currency],
      ["Vendor accounts", String(c.vendor_accounts)],
      ["Billed last year", Object.entries(c.spend_last_year_by_currency).map(([cur, v]) => (cur === "EUR" ? eurCompact(v) : `${cur} ${eurCompact(v).replace("€", "")}`)).join(" + ")]
    ]),
    h("table", { class: "vc-table vc-table--compact pop-table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Largest accounts"), h("th", { class: "r" }, "Last year"))),
      h("tbody", {}, c.largest.map((x) => h("tr", {}, h("td", {}, `${x.vendor_id} ${x.name}`), h("td", { class: "r" }, x.currency === "EUR" ? eurCompact(x.spend) : `${x.currency} ${eurCompact(x.spend).replace("€", "")}`))))),
    h("div", { class: "pop-note" }, "Fictional company code of GlobalCorp SE. Every rebate agreement counts all company codes unless its clause says otherwise.")
  );
}

/** A supplier group (the hub): register entry, agreements and member accounts. */
export function groupPopover(model, id, state) {
  const t = erpFamilyTree(model, { group_id: id });
  if (t.error) return h("div", {}, t.error);
  const g = t.group;
  const agreements = (model.agreementsByGroup.get(id) || []).map((a) => `${a.id}: ${agreementSummary(model, a.id).tiers_text}`);
  return h("div", {},
    h("div", { class: "pop-title" }, g.name),
    h("div", { class: "pop-sub" }, `Ultimate parent, ${g.headquarters}`),
    h("div", { class: "pop-tags" }, stateChip(state), g.real_company ? tag("info", "Real company") : tag("risk", "Fictional")),
    dl([
      ["LEI", g.lei || "none on record"],
      ["Agreements", agreements.length ? h("div", {}, agreements.map((x) => h("div", {}, x))) : "none"],
      ["Member accounts", h("div", {}, t.members.map((m) => h("div", {}, `${m.vendor_id} ${m.account_name}${m.group_key ? "" : " (no group key)"}${m.relation === "acquired" && m.since ? `, acquired ${m.since}` : ""}`)))]
    ]),
    h("div", { class: "pop-note" }, "From the subscription register, the only merge authority.")
  );
}

/** An agreement without a supplier group in the register (a single counterparty). */
export function counterpartyPopover(model, agreementId) {
  const a = model.agreements.get(agreementId);
  if (!a) return h("div", {}, "Unknown agreement.");
  return h("div", {},
    h("div", { class: "pop-title" }, a.counterparty),
    h("div", { class: "pop-sub" }, `${a.id}: ${a.title}`),
    dl([
      ["Tiers", agreementSummary(model, a.id).tiers_text],
      ["Linked accounts", a.linked.join(", ")],
      ["Register", "no corporate group on record: the agreement counts this counterparty only"]
    ]),
    h("div", { class: "pop-note" }, "Fictional counterparty, used to check that the live sweep reports agreements with nothing open honestly.")
  );
}

/** "Sun, 15 Nov (in 31 days)", or "passed (Sun, 15 Nov)". */
function deadlineText(row) {
  if (row.deadline_day < 0) return `passed (${shortDate(row.deadline_date)})`;
  const when = row.deadline_day === 0 ? "today" : row.deadline_day === 1 ? "in 1 day" : `in ${row.deadline_day} days`;
  return `${shortDate(row.deadline_date)} (${when})`;
}

/**
 * What an approved option does to the year (board.js decisionYears and acceptLoss): approved is a
 * decision, not cash, so the text says what the option claims, by which way and when the cash comes in.
 */
function decisionText(decision) {
  if (!decision) return null;
  if (decision.kind === "accepted") return "Do nothing approved: the loss is accepted";
  const how = viaText(decision.via);
  if (decision.kind === "full") {
    return `${decision.label} approved: ${eurFull(decision.recovered_eur)} by ${how}${decision.cash_day !== null && decision.cash_day !== undefined ? `, cash in ${shortDate(decision.cash_day)}` : ""}`;
  }
  if (decision.kind === "partial") return `${decision.label} approved: ${eurFull(decision.recovered_eur)} by ${how}; ${eurFull(decision.lost_eur)} still lost`;
  return `${decision.label} approved: it claims nothing for this year, so the rebate is still lost`;
}

/**
 * One year of the threshold race: the engine's position (or what the report counted), the decision
 * on it if any, and the accounts.
 */
export function yearPopover(model, view, row, decision = null) {
  const a = view.agreement;
  const o = row.out;
  const decided = decisionText(decision);
  const rows = o.mode === "report"
    ? [
      ["Report counted", `${eurFull(row.total_eur)} on the linked accounts${a.report_currencies ? ` (${a.report_currencies.join(", ")} invoices only)` : ""}`],
      ["Listed", o.listed ? "yes" : String(o.listed_text).replace(/^no \(/, "no: ").replace(/\)$/, "")],
      ["Tier shown", o.tier_shown_pct ? `${o.tier_shown_pct} %` : "none"],
      ["Rebate shown", eurFull(o.rebate_shown_eur)],
      ["Claim filed", o.claim_filed],
      ["Claim deadline", deadlineText(row)]
    ]
    : [
      ["Eligible spend", eurFull(row.total_eur)],
      ["Report counted", eurFull(row.counted_eur)],
      ["Tier reached", row.tier_pct ? `${row.tier_pct} %` : "none"],
      ["Rebate owed", eurFull(o.owed_eur)],
      a.statement ? ["Credited by the supplier", eurFull(o.credited_eur)] : null,
      ["Claimed by the report", eurFull(o.claimed_eur)],
      ["Open", eurFull(o.open_eur)],
      ["Claim deadline", deadlineText(row)],
      decided ? ["Decision", decided] : null
    ];
  const kindText = (s) => (s.kind === "counted" ? "counted" : s.kind === "assumed" ? "what-if" : "missed");
  return h("div", {},
    h("div", { class: "pop-title" }, `${row.label}${row.projected ? " (projected)" : ""}: ${a.short}`),
    h("div", { class: "pop-sub" }, `${a.id}, ${periodText(row.period)}. ${a.tiers_text}${a.report_min_eur ? `; the report lists ${a.short} only from ${eurMillions(a.report_min_eur)}` : ""}.`),
    dl(rows),
    h("table", { class: "vc-table vc-table--compact pop-table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Account"), h("th", {}, "Report"), h("th", { class: "r" }, "Spend"))),
      h("tbody", {}, row.segments.map((s) => h("tr", {}, h("td", {}, `${s.vendor_id} ${s.name}`), h("td", {}, s.reason ? `${kindText(s)}: ${s.reason}` : kindText(s)), h("td", { class: "r" }, eurCompact(s.eur)))))),
    h("div", { class: "pop-note" }, o.mode === "report"
      ? "GlobalCorp's year-end rebate report as it ran. Figures from the ERP and the deterministic rebate engine."
      : `${view.basis === "what_if" ? "A what-if: it counts an account the register does not list. " : view.basis === "partial" ? "A partial count: it leaves out a linked account. " : ""}Figures from the deterministic rebate engine, at the contract's exchange rates.`)
  );
}
