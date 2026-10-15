// World data access for the Rebate Hunter: indexes over the synthetic company (vendor accounts,
// company codes, corporate groups, the subscription register and the rebate agreements), agreement
// year periods and the day/date helpers. Pure module (no DOM), shared by the UI, the agent tools,
// the rebate engine and the integrity checks.
//
// Conventions (see data/world.js): day numbers are relative to the day the app is opened (day 0 =
// today, negative = past). AY is an agreement's last closed agreement year, PY the year before and
// CY the running year.

import { appToday } from "./clock.js";

export const YEARS = ["PY", "AY", "CY"];
/** Returns the raw synthetic world loaded by data/world.js. */
export function getWorldData() {
  const w = globalThis.WORLD;
  if (!w || !Array.isArray(w.vendors)) throw new Error("World data (data/world.js) is not loaded.");
  return w;
}

let cachedModel = null;
/** Returns the (cached) indexed model of the world. */
export function getModel() {
  if (!cachedModel) cachedModel = buildModel(getWorldData());
  return cachedModel;
}

/** Builds an indexed model from the raw world object. */
export function buildModel(world) {
  const problems = [];
  const vendors = mapById(world.vendors);
  const companyCodes = mapById(world.company_codes);
  const groups = mapById(world.groups);
  const agreements = mapById(world.agreements);

  const registerByVendor = new Map();
  const registerByGroup = new Map();
  for (const r of world.register || []) {
    if (registerByVendor.has(r.vendor)) problems.push(`Register: vendor ${r.vendor} is listed twice.`);
    registerByVendor.set(r.vendor, r);
    if (!registerByGroup.has(r.group)) registerByGroup.set(r.group, []);
    registerByGroup.get(r.group).push(r);
    if (!vendors.has(r.vendor)) problems.push(`Register: unknown vendor ${r.vendor}.`);
    if (!groups.has(r.group)) problems.push(`Register: unknown group ${r.group}.`);
  }

  const ordersByVendor = new Map();
  for (const o of world.purchase_orders || []) {
    if (!ordersByVendor.has(o.vendor)) ordersByVendor.set(o.vendor, []);
    ordersByVendor.get(o.vendor).push(o);
  }
  for (const list of ordersByVendor.values()) list.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));

  const agreementsByGroup = new Map();
  const agreementsOfVendor = new Map(); // vendor -> agreement ids it is linked to
  for (const a of world.agreements) {
    if (a.group) {
      if (!agreementsByGroup.has(a.group)) agreementsByGroup.set(a.group, []);
      agreementsByGroup.get(a.group).push(a);
    }
    for (const id of a.linked) {
      if (!vendors.has(id)) problems.push(`${a.id}: unknown linked vendor ${id}.`);
      if (!agreementsOfVendor.has(id)) agreementsOfVendor.set(id, []);
      agreementsOfVendor.get(id).push(a.id);
    }
  }

  return {
    world, vendors, companyCodes, groups, agreements, registerByVendor, registerByGroup,
    ordersByVendor, agreementsByGroup, agreementsOfVendor, problems
  };
}

// ---------------------------------------------------------------------------------------------
// Agreement years
// ---------------------------------------------------------------------------------------------

/** First and last day of an agreement year (inclusive). AY ends on ay_end_day. */
export function yearPeriod(agreement, year) {
  const offset = year === "PY" ? -365 : year === "CY" ? 365 : 0;
  const end = agreement.ay_end_day + offset;
  return { start_day: end - 364, end_day: end };
}

/** Last day a claim for that year reaches the supplier in time (regular window or look-back). */
export function claimDeadline(agreement, year) {
  const { end_day } = yearPeriod(agreement, year);
  return end_day + Math.max(agreement.claim_window_days || 0, agreement.lookback_days || 0);
}

/** Contract exchange rate into euro for an invoice currency (1 for EUR). */
export function contractRate(agreement, currency) {
  if (!currency || currency === "EUR") return 1;
  const r = agreement?.fx_to_eur?.[currency];
  return typeof r === "number" && r > 0 ? r : null;
}

// ---------------------------------------------------------------------------------------------
// Register (the only merge authority)
// ---------------------------------------------------------------------------------------------

/** The register entry of a vendor account, or null. */
export function registerEntry(model, vendorId) {
  return model.registerByVendor.get(vendorId) || null;
}

/** Corporate group id of a vendor per the register, or null. */
export function groupOf(model, vendorId) {
  return model.registerByVendor.get(vendorId)?.group || null;
}

/** Vendor ids the register lists as members of a group. */
export function groupMembers(model, groupId) {
  return (model.registerByGroup.get(groupId) || []).map((r) => r.vendor);
}

/** Days from today to an ISO date (negative = past), in the browser's local time zone. */
export function isoToDay(iso, base = appToday()) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const a = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}

/** Date helper: ISO date (YYYY-MM-DD) for today + n days, in the browser's local time zone. */
export function dayToISO(offset, base = appToday()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(offset));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------------------------
// Query helpers (popovers, tools, the rebate board)
// ---------------------------------------------------------------------------------------------

/** Display name of any id (vendor, company code, group, agreement). */
export function nameOf(model, id) {
  return model.vendors.get(id)?.name || model.companyCodes.get(id)?.name || model.groups.get(id)?.name ||
    model.agreements.get(id)?.title || id;
}

/** Is this id a known vendor, company code, group, agreement or register link ("L-<vendor>")? */
export function isKnownId(model, id) {
  const s = String(id);
  if (s.startsWith("L-")) return model.registerByVendor.has(s.slice(2));
  return model.vendors.has(s) || model.companyCodes.has(s) || model.groups.has(s) || model.agreements.has(s);
}

/** Purchase orders of a vendor within [fromDay, toDay] (inclusive). */
export function ordersIn(model, vendorId, fromDay, toDay) {
  return (model.ordersByVendor.get(vendorId) || []).filter((o) => o.day >= fromDay && o.day <= toDay);
}

// ---------------------------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------------------------

function mapById(list) {
  return new Map((list || []).map((x) => [x.id, x]));
}
