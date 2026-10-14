// Detail popovers for map entities, built from the same ERP queries the agent uses.

import { h } from "./dom.js";
import { eurCompact, eurFull } from "./format.js";
import { erpGetVendor, erpCompanyCode, erpFamilyTree, relationText, tierText } from "./erp.js";
import { registerEntry, spendBand } from "./world.js";

const STATE_TEXT = { affected: "Affected", at_risk: "At risk", resolved: "Resolved" };
const BAND_TEXT = { 1: "Over €10M last year", 2: "€2M to €10M last year", 3: "Under €2M last year" };

function stateChip(state) {
  if (!state || state === "neutral") return null;
  const tone = state === "affected" ? "rejected" : state === "at_risk" ? "pending" : "approved";
  return h("span", { class: "chip", dataset: { tone } }, STATE_TEXT[state]);
}

function dl(rows) {
  return h("dl", { class: "pop-grid" }, rows.filter(Boolean).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
}

function money(value, currency) {
  return currency && currency !== "EUR" ? `${currency} ${eurFull(value).replace("€", "")}` : eurFull(value);
}

export function vendorPopover(model, id, state) {
  const v = erpGetVendor(model, id);
  if (v.error) return h("div", {}, v.error);
  const rel = relationText(model, id);
  const raw = model.vendors.get(id);
  return h("div", {},
    h("div", { class: "pop-title" }, v.name),
    h("div", { class: "pop-sub" }, `Vendor account ${v.id} in ${v.city}, ${v.country}`),
    h("div", { class: "pop-tags" },
      stateChip(state),
      v.group_key ? h("span", { class: "chip", dataset: { tone: "info" } }, `Group key ${v.group_key}`) : h("span", { class: "chip", dataset: { tone: "risk" } }, "No group key"),
      v.linked_agreements.length ? h("span", { class: "chip", dataset: { tone: "info" } }, `Linked to ${v.linked_agreements.join(", ")}`) : null
    ),
    dl([
      ["Category", v.category],
      ["Spend", h("div", {}, h("div", {}, `${money(v.spend.last_year, v.invoice_currency)} last agreement year`), h("div", {}, `${money(v.spend.year_before, v.invoice_currency)} the year before`))],
      ["Size", BAND_TEXT[spendBand(raw)]],
      ["Billed to", `${v.company_code.id} ${v.company_code.name}`],
      ["Register", rel ? `${rel.text}${rel.lei ? `, LEI ${rel.lei}` : ""}` : "no entry: no corporate parent on record"],
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
    h("table", { class: "pop-table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Largest accounts"), h("th", { class: "r" }, "Last year"))),
      h("tbody", {}, c.largest.map((x) => h("tr", {}, h("td", {}, `${x.vendor_id} ${x.name}`), h("td", { class: "r" }, x.currency === "EUR" ? eurCompact(x.spend) : `${x.currency} ${eurCompact(x.spend).replace("€", "")}`))))),
    h("div", { class: "pop-note" }, "Fictional company code of GlobalCorp SE. Every rebate agreement counts all company codes unless its clause says otherwise.")
  );
}

export function groupPopover(model, id, state) {
  const t = erpFamilyTree(model, { group_id: id });
  if (t.error) return h("div", {}, t.error);
  const g = t.group;
  const agreements = (model.agreementsByGroup.get(id) || []).map((a) => `${a.id}: ${tierText(a)}`);
  return h("div", {},
    h("div", { class: "pop-title" }, g.name),
    h("div", { class: "pop-sub" }, `Ultimate parent, ${g.headquarters}`),
    h("div", { class: "pop-tags" }, stateChip(state), g.real_company ? h("span", { class: "chip", dataset: { tone: "info" } }, "Real company") : h("span", { class: "chip", dataset: { tone: "risk" } }, "Fictional")),
    dl([
      ["LEI", g.lei || "none on record"],
      ["Agreements", agreements.length ? h("div", {}, agreements.map((x) => h("div", {}, x))) : "none"],
      ["Member accounts", h("div", {}, t.members.map((m) => h("div", {}, `${m.vendor_id} ${m.account_name}${m.group_key ? "" : " (no group key)"}`)))]
    ]),
    h("div", { class: "pop-note" }, "From the subscription register, the only merge authority.")
  );
}

export function linkPopover(model, vendorId, state) {
  const r = registerEntry(model, vendorId);
  if (!r) return h("div", {}, "No register entry.");
  const v = model.vendors.get(vendorId);
  const g = model.groups.get(r.group);
  return h("div", {},
    h("div", { class: "pop-title" }, `${v.name} → ${g.name}`),
    h("div", { class: "pop-sub" }, r.relation === "acquired" ? `Acquired${r.since ? `, in the group since ${r.since}` : ""}` : r.relation === "parent entity" ? "Invoiced by the parent company" : "Subsidiary"),
    h("div", { class: "pop-tags" }, stateChip(state), v.group_key ? null : h("span", { class: "chip", dataset: { tone: "risk" } }, "No group key in the vendor master")),
    dl([
      ["Legal entity", r.legal],
      ["LEI", r.lei || "none on record"],
      ["Evidence", r.evidence]
    ]),
    h("div", { class: "pop-note" }, g.real ? "Register link. Real acquisition dates; the account itself is fictional." : "Register link of a fictional group; the account is fictional too.")
  );
}
