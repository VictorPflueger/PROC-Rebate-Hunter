// ERP-style queries over the synthetic company (vendor master, purchase orders, agreements, the
// subscription register and the year-end rebate report). Pure functions returning compact,
// JSON-safe objects. Used by map popovers, the agent's erp_* tools, the simulation player and the
// script checker through one table, ERP_TOOLS, so the three can never disagree.
//
// The ERP holds ledger facts only. What a rebate is worth comes from the engine (js/rebate.js).

import { yearPeriod, claimDeadline, dayToISO, registerEntry, groupOf, groupMembers, ordersIn, nameOf } from "./world.js";
import { sequenceRatio, nameStem } from "./similarity.js";
import { appToday } from "./clock.js";

const r2 = (x) => Math.round((x || 0) * 100) / 100;
const MAX_LIST = 25;

/** Company overview: company codes, agreements with their deadlines, vendor master in figures. */
export function erpOverview(model, now = appToday()) {
  const w = model.world;
  const byCode = new Map(w.company_codes.map((c) => [c.id, { accounts: 0, spend: {} }]));
  for (const v of w.vendors) {
    const c = byCode.get(v.company_code);
    if (c) { c.accounts += 1; c.spend[v.currency] = (c.spend[v.currency] || 0) + v.spend.AY; }
  }
  const byCurrency = (m) => Object.fromEntries(Object.entries(m).sort().map(([k, x]) => [k, r2(x)]));
  return {
    company: w.meta.company,
    note: w.meta.company_note,
    scope: w.meta.scope_note,
    company_codes: w.company_codes.map((c) => ({
      id: c.id, name: c.name, city: c.city, country: c.country, currency: c.currency, role: c.role,
      vendor_accounts: byCode.get(c.id).accounts, invoiced_last_year_by_currency: byCurrency(byCode.get(c.id).spend)
    })),
    agreements: w.agreements.map((a) => {
      const ay = yearPeriod(a, "AY");
      return {
        id: a.id, title: a.title, counterparty: a.counterparty, group_id: a.group,
        tiers: tierText(a), linked_accounts: a.linked,
        agreement_year: `${dayToISO(ay.start_day, now)} to ${dayToISO(ay.end_day, now)}`,
        claim_deadline_day: claimDeadline(a, "AY"), claim_deadline_date: dayToISO(claimDeadline(a, "AY"), now),
        look_back_days: a.lookback_days || 0,
        // A look-back clause keeps the year before claimable: its deadline can come first.
        ...(a.lookback_days && claimDeadline(a, "PY") >= 0 ? { previous_year_claim_deadline_day: claimDeadline(a, "PY"), previous_year_claim_deadline_date: dayToISO(claimDeadline(a, "PY"), now) } : {}),
        set_off_allowed: a.set_off_allowed
      };
    }),
    vendor_master: {
      accounts: w.vendors.length,
      with_group_key: w.vendors.filter((v) => v.group_key).length,
      register_entries: w.register.length,
      currencies: [...new Set(w.vendors.map((v) => v.currency))].sort(),
      purchase_orders_last_year: w.purchase_orders.length
    },
    rebate_report: w.meta.report_note,
    assumptions: {
      day_rate_eur: w.assumptions.day_rate_eur,
      recovery_audit_fee_pct: w.assumptions.recovery_audit_fee_pct,
      note: w.assumptions.day_rate_note
    }
  };
}

/** One agreement in full: clause, tiers, linked accounts, periods and deadlines per year. */
export function erpGetAgreement(model, id, now = appToday()) {
  const a = model.agreements.get(id);
  if (!a) return { error: `Unknown agreement id "${id}". Use erp_get_overview for agreement ids (RA-…).` };
  const g = a.group ? model.groups.get(a.group) : null;
  return {
    id: a.id, title: a.title, counterparty: a.counterparty,
    group: g ? { id: g.id, name: g.name, lei: g.lei } : null,
    group_key: a.group_key,
    clause: a.clause,
    tiers: a.tiers, retroactive: a.retro !== false,
    linked_accounts: a.linked.map((vid) => {
      const v = model.vendors.get(vid);
      return { vendor_id: vid, name: v?.name, currency: v?.currency, company_code: v?.company_code };
    }),
    years: ["PY", "AY", "CY"].map((y) => {
      const p = yearPeriod(a, y);
      const dl = claimDeadline(a, y);
      return {
        year: y, period: `${dayToISO(p.start_day, now)} to ${dayToISO(p.end_day, now)}`,
        start_day: p.start_day, end_day: p.end_day,
        claim_deadline_day: dl, claim_deadline_date: dayToISO(dl, now),
        state: y === "CY" ? "running" : dl < 0 ? "closed, claims excluded" : "closed, claims open"
      };
    }),
    claim_window_days: a.claim_window_days,
    look_back_days: a.lookback_days || 0,
    supplier_credits: a.credited_basis === "linked" ? "the supplier's own statement credits the rebate on the accounts it has on record" : "nothing is paid without a written claim",
    year_end_report: {
      counts: "linked accounts only",
      currencies: a.report?.currencies || "all, at the contract rates",
      lists_from_eur: a.report?.min_threshold_eur || 0
    },
    set_off_allowed: a.set_off_allowed,
    credit_note_days: a.credit_note_days,
    claim_preparation_days: { AY: a.claim_prep_days, PY_look_back: a.audit_prep_days },
    contract_rates_to_eur: a.fx_to_eur || {},
    running_year_growth_pct: a.cy_growth_pct
  };
}

// English country names for the ISO codes in the world data, so "Ireland" finds "IE".
const COUNTRY_NAMES = {
  AT: "Austria", CH: "Switzerland", DE: "Germany", ES: "Spain", FR: "France", GB: "United Kingdom UK Britain England",
  IE: "Ireland", IT: "Italy", NL: "Netherlands", US: "United States USA America"
};

/**
 * Vendor accounts filtered by text (name, city, country or category; several terms separated by
 * commas), country code, company code, minimum spend or group key ("none" finds accounts without).
 */
export function erpListVendors(model, { query = null, country = null, company_code = null, min_spend_eur = null, group_key = null } = {}) {
  const terms = query ? String(query).toLowerCase().split(/[,;|]+/).map((t) => t.trim()).filter(Boolean) : [];
  const matches = (v, t) => `${v.id} ${v.name} ${v.city} ${v.country} ${COUNTRY_NAMES[v.country] || ""} ${v.category}`.toLowerCase().includes(t);
  const gk = group_key === null || group_key === undefined || group_key === "" ? null : String(group_key).toUpperCase();
  const list = model.world.vendors.filter((v) => {
    if (country && v.country !== String(country).toUpperCase()) return false;
    if (company_code && v.company_code !== company_code) return false;
    if (min_spend_eur && !(v.spend.AY >= Number(min_spend_eur))) return false;
    if (gk === "NONE" && v.group_key) return false;
    if (gk && gk !== "NONE" && v.group_key !== gk) return false;
    if (terms.length && !terms.some((t) => matches(v, t))) return false;
    return true;
  }).sort((p, q) => q.spend.AY - p.spend.AY);
  return {
    count: list.length,
    vendors: list.slice(0, MAX_LIST).map((v) => ({
      id: v.id, name: v.name, location: `${v.city}, ${v.country}`, company_code: v.company_code,
      category: v.category, currency: v.currency, spend_last_year: r2(v.spend.AY), group_key: v.group_key || null
    })),
    truncated: list.length > MAX_LIST
  };
}

/** Full vendor master record (SAP LFA1-like) with spend, payables and agreement links. */
export function erpGetVendor(model, id) {
  const v = model.vendors.get(id);
  if (!v) return { error: `Unknown vendor id "${id}". Use erp_list_vendors to find ids.` };
  const orders = model.ordersByVendor.get(id) || [];
  const cc = model.companyCodes.get(v.company_code);
  return {
    id: v.id, name: v.name, city: v.city, country: v.country, lat: v.lat, lon: v.lon,
    tax_id: v.tax_id, bank_account: `${v.bank.country} ···${v.bank.last4}`,
    invoice_currency: v.currency,
    company_code: { id: v.company_code, name: cc?.name },
    category: v.category,
    group_key: v.group_key || null,
    linked_agreements: model.agreementsOfVendor.get(id) || [],
    spend: { last_year: r2(v.spend.AY), year_before: r2(v.spend.PY), currency: v.currency },
    purchase_orders_last_year: { count: orders.length, first_day: orders[0]?.day ?? null, last_day: orders[orders.length - 1]?.day ?? null },
    open_payables_eur: r2(v.open_payables_eur),
    note: vendorNote(model, v)
  };
}

/** What is real about an account: its corporate group and acquisitions, or nothing (Apex, noise). */
function vendorNote(model, v) {
  if (v.origin?.startsWith("noise")) return "Fictional account from the Streamlit data set.";
  const g = model.groups.get(groupOf(model, v.id));
  return g?.real ? "Fictional account; the corporate group and its acquisitions are real." : "Fictional account and fictional corporate group (the look-alike pair of the demo).";
}

/**
 * Ledger spend of accounts per agreement year. Periods follow `agreement_id` when given, otherwise
 * each account's own agreement (or the default year). Amounts stay in the invoice currency: the
 * engine converts at the contract rates.
 */
export function erpGetSpend(model, { vendor_ids = [], agreement_id = null } = {}) {
  const ids = (Array.isArray(vendor_ids) ? vendor_ids : [vendor_ids]).map(String).filter(Boolean);
  if (!ids.length) return { error: "vendor_ids is required (one or more vendor ids)." };
  const forced = agreement_id ? model.agreements.get(agreement_id) : null;
  if (agreement_id && !forced) return { error: `Unknown agreement id "${agreement_id}".` };
  const totals = {};
  const accounts = [];
  for (const id of ids.slice(0, 12)) {
    const v = model.vendors.get(id);
    if (!v) { accounts.push({ vendor_id: id, error: "unknown vendor id" }); continue; }
    const a = forced || agreementForVendor(model, id);
    const ay = a ? yearPeriod(a, "AY") : { start_day: model.world.meta.default_ay_end_day - 364, end_day: model.world.meta.default_ay_end_day };
    const orders = ordersIn(model, id, ay.start_day, ay.end_day);
    const q = [0, 0, 0, 0];
    for (const o of orders) q[Math.min(3, Math.floor((o.day - ay.start_day) / 91.25))] += o.value;
    const last = r2(orders.reduce((s, o) => s + o.value, 0));
    totals[v.currency] = r2((totals[v.currency] || 0) + last);
    accounts.push({
      vendor_id: id, name: v.name, currency: v.currency, periods_of: a ? a.id : "default year",
      last_year: { total: last, orders: orders.length, by_quarter: q.map(r2) },
      year_before: { total: r2(v.spend.PY), note: "total from the archive; orders not kept" }
    });
  }
  return { accounts, totals_by_currency: totals, truncated: ids.length > 12 };
}

/**
 * Duplicate-vendor check: accounts whose names look alike (difflib ratio, as the Streamlit version
 * measured it), or that share a tax id or bank account. Candidates only, with the register's verdict.
 */
export function erpFindDuplicates(model, { vendor_id = null, name = null, min_similarity_pct = 60 } = {}) {
  const v = vendor_id ? model.vendors.get(vendor_id) : null;
  if (vendor_id && !v) return { error: `Unknown vendor id "${vendor_id}".` };
  const probe = v ? v.name : String(name || "").trim();
  if (!probe) return { error: "Give vendor_id or name." };
  const min = Math.max(30, Math.min(100, Number(min_similarity_pct) || 60));
  const ownGroup = v ? groupOf(model, v.id) : null;
  const candidates = [];
  for (const x of model.world.vendors) {
    if (v && x.id === v.id) continue;
    const sim = sequenceRatio(probe.toLowerCase(), x.name.toLowerCase());
    const shared = [];
    if (v && x.tax_id === v.tax_id) shared.push("tax id");
    if (v && x.bank.country === v.bank.country && x.bank.last4 === v.bank.last4) shared.push("bank account");
    if (sim * 100 + 1e-9 < min && !shared.length) continue;
    const g = groupOf(model, x.id);
    candidates.push({
      vendor_id: x.id, name: x.name, location: `${x.city}, ${x.country}`,
      name_similarity_pct: Math.round(sim * 1000) / 10,
      same_name_stem: nameStem(x.name) === nameStem(probe),
      shared: shared.length ? shared : undefined,
      register: !v ? (g ? `member of ${model.groups.get(g)?.name}` : "no register entry")
        : g && ownGroup && g === ownGroup ? "same group in the register"
          : g && ownGroup ? `different groups in the register (${model.groups.get(ownGroup)?.short} vs ${model.groups.get(g)?.short})`
            : "not confirmed by the register"
    });
  }
  candidates.sort((p, q) => q.name_similarity_pct - p.name_similarity_pct);
  const out = {
    probe: v ? { vendor_id: v.id, name: v.name } : { name: probe },
    rule: `name similarity ≥ ${min} % (difflib ratio) or a shared tax id or bank account`,
    candidates: candidates.slice(0, 10),
    truncated: candidates.length > 10,
    note: "Candidates for review only. The subscription register (erp_family_tree) is the only merge authority: similar names, cities or categories never merge accounts."
  };
  if (ownGroup) {
    // What a name rule misses: register members whose names do not look alike.
    out.register_members_below_rule = groupMembers(model, ownGroup)
      .filter((id) => id !== v.id)
      .map((id) => ({ vendor_id: id, name: model.vendors.get(id).name, name_similarity_pct: Math.round(sequenceRatio(probe.toLowerCase(), model.vendors.get(id).name.toLowerCase()) * 1000) / 10 }))
      .filter((m) => m.name_similarity_pct < min);
  }
  return out;
}

/**
 * Subscription register (a commercial corporate family-tree service, synthetic here): the ultimate
 * parent, its member accounts, how and since when they belong to it, and its agreements. The only
 * merge authority. Query by group id, vendor id or group name.
 */
export function erpFamilyTree(model, { group_id = null, vendor_id = null, name = null } = {}) {
  let gid = group_id && model.groups.has(group_id) ? group_id : null;
  if (!gid && vendor_id) {
    if (!model.vendors.has(vendor_id)) return { error: `Unknown vendor id "${vendor_id}".` };
    gid = groupOf(model, vendor_id);
    if (!gid) return { vendor_id, name: model.vendors.get(vendor_id).name, register: "no entry: the register knows no corporate parent for this account", members: [] };
  }
  if (!gid && name) {
    const t = String(name).toLowerCase();
    const g = model.world.groups.find((x) => x.name.toLowerCase().includes(t) || x.short.toLowerCase().includes(t));
    gid = g?.id || null;
    if (!gid) return { query: name, register: "no group of that name in the register", groups: model.world.groups.map((x) => x.short) };
  }
  if (!gid) return { error: group_id ? `Unknown group id "${group_id}".` : "Give group_id, vendor_id or name." };
  const g = model.groups.get(gid);
  return {
    source: "Subscription register (corporate family-tree service; synthetic in this demo; parents and acquisitions are real except the Apex groups)",
    group: { id: g.id, name: g.name, lei: g.lei, headquarters: `${g.city}, ${g.country}`, real_company: g.real },
    members: (model.registerByGroup.get(gid) || []).map((r) => {
      const v = model.vendors.get(r.vendor);
      return {
        vendor_id: r.vendor, account_name: v?.name, legal_entity: r.legal, relation: r.relation,
        lei: r.lei, since: r.since, evidence: r.evidence,
        group_key: v?.group_key || null, linked_agreements: model.agreementsOfVendor.get(r.vendor) || []
      };
    }),
    agreements: (model.agreementsByGroup.get(gid) || []).map((a) => a.id),
    ...(vendor_id ? { asked_for: vendor_id } : {})
  };
}

/**
 * GlobalCorp's year-end rebate report as it ran for the closed years: which accounts and currencies it
 * counted, whether it listed the agreement and what it claimed. The control that missed the money.
 */
export function erpRebateReport(model, agreementId, now = appToday()) {
  const a = model.agreements.get(agreementId);
  if (!a) return { error: `Unknown agreement id "${agreementId}".` };
  const cur = a.report?.currencies || null;
  const min = a.report?.min_threshold_eur || 0;
  const runs = ["PY", "AY"].map((y) => {
    const p = yearPeriod(a, y);
    const counted = [];
    const left = [];
    let visible = 0;
    for (const id of a.linked) {
      const v = model.vendors.get(id);
      const amount = y === "AY" ? ordersIn(model, id, p.start_day, p.end_day).reduce((s, o) => s + o.value, 0) : v.spend.PY;
      if (cur && !cur.includes(v.currency)) { left.push(`${id} (${v.currency} invoices)`); continue; }
      const rate = v.currency === "EUR" ? 1 : a.fx_to_eur?.[v.currency] || 0;
      visible += amount * rate;
      counted.push(id);
    }
    const listed = visible >= min;
    const tier = listed ? tierFor(a, visible) : 0;
    const claim = listed ? (visible * tier) / 100 : 0;
    return {
      year: y, ran_on: dayToISO(p.end_day + 5, now),
      accounts_counted: counted, left_out: left.length ? left : undefined,
      counted_spend_eur: r2(visible),
      listed: listed ? "yes" : `no (lists ${a.short} only from €${min.toLocaleString("en-GB")})`,
      tier_shown_pct: tier,
      rebate_shown_eur: r2(claim),
      claim_filed: claim > 0 && a.credited_basis !== "linked" ? `yes, €${Math.round(claim).toLocaleString("en-GB")}` : claim > 0 ? "no claim needed: matched the supplier statement" : "no claim"
    };
  });
  return {
    agreement_id: a.id,
    rule: `counts the accounts with group key ${a.group_key}, ${cur ? `${cur.join(", ")} invoices only` : "all currencies at the contract rates"}${min ? `, lists the agreement from €${min.toLocaleString("en-GB")}` : ""}`,
    runs,
    note: "What the report could not see (unlinked accounts, other currencies, smaller tiers) was never claimed."
  };
}

/** One table of ERP tools for the agent, the simulation player and the script checker. */
export const ERP_TOOLS = {
  erp_get_overview: (m) => erpOverview(m),
  erp_get_agreement: (m, i) => erpGetAgreement(m, i.agreement_id),
  erp_list_vendors: (m, i) => erpListVendors(m, i || {}),
  erp_get_vendor: (m, i) => erpGetVendor(m, i.vendor_id),
  erp_get_spend: (m, i) => erpGetSpend(m, i || {}),
  erp_find_duplicates: (m, i) => erpFindDuplicates(m, i || {}),
  erp_family_tree: (m, i) => erpFamilyTree(m, i || {}),
  erp_get_rebate_report: (m, i) => erpRebateReport(m, i.agreement_id)
};

/** The agreement an account belongs to: linked, or its register group's agreement. */
export function agreementForVendor(model, vendorId) {
  const linked = model.agreementsOfVendor.get(vendorId);
  if (linked?.length) return model.agreements.get(linked[0]);
  const g = groupOf(model, vendorId);
  return g ? (model.agreementsByGroup.get(g) || [])[0] || null : null;
}

/** Compact summary of company codes for popovers: accounts and spend billed to each. */
export function erpCompanyCode(model, id) {
  const c = model.companyCodes.get(id);
  if (!c) return { error: `Unknown company code "${id}".` };
  const vendors = model.world.vendors.filter((v) => v.company_code === id);
  const top = vendors.slice().sort((p, q) => q.spend.AY - p.spend.AY).slice(0, 5);
  const byCurrency = {};
  for (const v of vendors) byCurrency[v.currency] = (byCurrency[v.currency] || 0) + v.spend.AY;
  return {
    ...c,
    vendor_accounts: vendors.length,
    spend_last_year_by_currency: Object.fromEntries(Object.entries(byCurrency).sort().map(([k, x]) => [k, r2(x)])),
    largest: top.map((v) => ({ vendor_id: v.id, name: v.name, spend: r2(v.spend.AY), currency: v.currency }))
  };
}

/** "1 % from €10m, 2 % from €20m" */
export function tierText(a) {
  return (a.tiers || []).slice().sort((p, q) => p.from_eur - q.from_eur)
    .map((t) => `${t.rate_pct} % from €${(t.from_eur / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 })}m`).join(", ");
}

function tierFor(a, amount) {
  let r = 0;
  for (const t of (a.tiers || []).slice().sort((p, q) => p.from_eur - q.from_eur)) if (amount + 1e-6 >= t.from_eur) r = t.rate_pct;
  return r;
}

/** Register relation of an account, in words (for popovers). */
export function relationText(model, vendorId) {
  const r = registerEntry(model, vendorId);
  if (!r) return null;
  const g = model.groups.get(r.group);
  const rel = r.relation === "acquired" ? `acquired by ${g?.short || r.group}${r.since ? ` (${r.since})` : ""}`
    : r.relation === "parent entity" ? `${g?.short || r.group} parent company` : `${g?.short || r.group} subsidiary`;
  return { group_id: r.group, group: nameOf(model, r.group), text: rel, legal_entity: r.legal, lei: r.lei, since: r.since };
}
