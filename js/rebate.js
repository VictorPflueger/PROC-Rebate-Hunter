// Deterministic rebate engine (powers the `sim_rebate` tool and the simulation scripts).
// No randomness and no LLM arithmetic: identical inputs always produce identical outputs.
//
// Model in one paragraph: an agreement pays a retroactive, tiered rebate on all purchases of an
// agreement year from a supplier group. For each year (PY, AY and the running year CY) the engine
// adds up the counted accounts' spend at the contract's fixed exchange rates, finds the tier reached
// and the rebate owed, then subtracts what the supplier credited by itself (its statement covers only
// the accounts linked to the agreement) and what GlobalCorp's own year-end report claimed (it sees
// only linked accounts, in its currencies, above its minimum threshold). What is left is open, and it
// is lost when the claim deadline passes. The running year is projected from the last year with the
// agreement's growth assumption. Response options recover open amounts if they reach the supplier
// before the deadline, at a cost: claims, set-off, a recovery-audit firm, linking accounts in the
// vendor master, or fixing the report rule. Accounts count only as the subscription register says:
// a similar name never merges an account into a group.

import { YEARS, yearPeriod, claimDeadline, contractRate, registerEntry, groupOf, isoToDay, dayToISO, ordersIn } from "./world.js";
import { appToday } from "./clock.js";

export const ENGINE_VERSION = "1.1.0";
export const ACTION_TYPES = ["claim", "set_off", "recovery_audit", "link_accounts", "fix_report"];
export const DEFAULT_HORIZON_DAYS = 400;
const CLAIMABLE = ["PY", "AY"];

/**
 * Calculate the rebate position of one agreement and optional response variants.
 * @param {object} model  result of buildModel()
 * @param {object} spec   { label?, agreement_id, horizon_days?, members?, years?, what_if?, variants? }
 * @param {object} opts   { now?: Date }
 */
export function simulateRebate(model, spec = {}, opts = {}) {
  const errors = [];
  const warnings = [];
  const now = opts.now || appToday();
  const a = model.agreements.get(spec.agreement_id);
  if (!a) {
    return { ok: false, errors: [`agreement_id: unknown agreement "${spec.agreement_id ?? ""}". Use erp_get_overview for agreement ids (RA-…).`], hint: HINT };
  }
  const H = intIn(spec.horizon_days, DEFAULT_HORIZON_DAYS, 30, 800, "horizon_days", errors);
  const whatIf = spec.what_if === true;
  const years = Array.isArray(spec.years) && spec.years.length ? [...new Set(spec.years.map(String))] : YEARS.slice();
  for (const y of years) if (!YEARS.includes(y)) errors.push(`years: "${y}" is not a year; use PY, AY or CY.`);

  const members = compileMembers(model, a, spec.members, whatIf, now, errors, warnings);
  // The supplier's statement and the year-end report cover every linked account: a count that
  // leaves one out is a partial view, never a verified position (options cannot rest on it).
  const missingLinked = errors.length ? [] : a.linked.filter((id) => !members.some((m) => m.id === id));
  if (missingLinked.length) {
    warnings.push(`members leave out ${missingLinked.length === 1 ? "the linked account" : "the linked accounts"} ${missingLinked.join(", ")}: the supplier's statement and the year-end report count ${missingLinked.length === 1 ? "it" : "them"}, so this is a partial count, not a verified position. Include every linked account for a result the options can rest on.`);
  }
  const vin = Array.isArray(spec.variants) ? spec.variants : [];
  if (vin.length > 6) errors.push("variants: at most 6 variants per call.");
  if (errors.length) return { ok: false, errors, hint: HINT };

  const base = position(model, a, members, { linkedExtra: new Set(), report: null }, now);
  const yearsShown = base.filter((y) => years.includes(y.year));
  const baseline = summarizeBaseline(model, a, members, yearsShown, H);
  const variants = [];
  vin.slice(0, 6).forEach((v, i) => {
    const cv = compileVariant(model, a, members, base, v, i, H, errors, warnings);
    if (cv) variants.push(costVariant(model, a, members, base, yearsShown, baseline, cv, H, now));
  });
  if (errors.length) return { ok: false, errors, hint: HINT };

  const group = a.group ? model.groups.get(a.group) : null;
  const asm = model.world.assumptions;
  return {
    ok: true,
    engine_version: ENGINE_VERSION,
    label: String(spec.label || `${a.short} rebate position`).slice(0, 160),
    agreement_id: a.id,
    agreement: a.title,
    group_id: a.group || null,
    group_name: group?.name || a.counterparty,
    basis: whatIf && members.some((m) => m.status === "unverified") ? "what_if" : missingLinked.length ? "partial" : "verified",
    start_date: dayToISO(0, now),
    horizon_days: H,
    members: members.map((m) => ({
      vendor_id: m.id, name: m.vendor.name, status: m.status, relation: m.relation, since: m.since,
      currency: m.vendor.currency, company_code: m.vendor.company_code,
      spend_eur: { PY: roundE(m.spend.PY), AY: roundE(m.spend.AY), CY: roundE(m.spend.CY) }
    })),
    years: yearsShown.map((y) => publicYear(y, now)),
    baseline,
    variants: variants.map(({ _internal, ...v }) => v),
    assumptions: [
      `Tiers are retroactive: the tier reached applies to all purchases of the year (${tierText(a)}).`,
      `Spend counts at the contract's fixed rates${Object.keys(a.fx_to_eur || {}).length ? ` (${Object.entries(a.fx_to_eur).map(([c, r]) => `1 ${c} = ${r} EUR`).join(", ")})` : ""}; the running year is projected at +${a.cy_growth_pct} % on the last year (assumption).`,
      `Claims reach the supplier in time if filed by the deadline: ${a.claim_window_days} days after the year end${a.lookback_days ? `, or ${a.lookback_days} days under the look-back clause` : ""}.`,
      `Internal effort at €${int(asm.day_rate_eur)} per person-day; a recovery-audit firm charges ${asm.recovery_audit_fee_pct} % of what it recovers and needs ${asm.recovery_audit_days} days (assumptions).`,
      `Set-off applies to undisputed amounts only: the supplier has ${asm.set_off_notice_days ?? 7} days to object to the notice, then the next payment run (${asm.payment_run_days} days) settles it.`,
      `Rebate at risk counts open amounts whose claim deadline falls within the next ${H} days, including the running year's projected rebate when its deadline falls inside that horizon.`
    ],
    warnings
  };
}

/**
 * The result as the model sees it: the do-nothing amount is "rebate at risk" and a variant's
 * remainder "rebate still lost" (the UI's event contract keeps the shared field names), and the
 * internal flags are left out.
 */
export function compactForModel(result) {
  if (!result || !result.ok) return result;
  const { value_at_risk_eur, ...baseline } = result.baseline || {};
  return {
    ...result,
    baseline: { rebate_at_risk_eur: value_at_risk_eur, ...baseline },
    variants: (result.variants || []).map(({ residual_var_eur, ...v }) => ({ ...v, rebate_still_lost_eur: residual_var_eur }))
  };
}

const HINT = "Fix the listed fields and call sim_rebate again. Ids must come from erp_* tool results; group membership comes only from erp_family_tree.";

// =============================================================================================
// Members (which accounts count)
// =============================================================================================

function compileMembers(model, a, list, whatIf, now, errors, warnings) {
  const ids = Array.isArray(list) && list.length ? [...new Set(list.map(String))] : a.linked.slice();
  if (!(Array.isArray(list) && list.length)) warnings.push(`members not given: counting only the ${a.linked.length} account${a.linked.length === 1 ? "" : "s"} linked to ${a.id} in the vendor master (${a.linked.join(", ")}).`);
  const group = a.group ? model.groups.get(a.group) : null;
  const out = [];
  for (const id of ids) {
    const v = model.vendors.get(id);
    if (!v) { errors.push(`members: unknown vendor id "${id}". Use erp_list_vendors for ids.`); continue; }
    const reg = registerEntry(model, id);
    let status;
    if (a.linked.includes(id)) status = "linked";
    else if (a.group && reg?.group === a.group) status = "register";
    else if (whatIf) {
      status = "unverified";
      warnings.push(`what_if: ${id} (${v.name}) is counted although the register ${reg ? `lists it under ${model.groups.get(reg.group)?.name || reg.group}` : "has no entry for it"}. The result is an unverified assumption, not a claim.`);
    } else {
      const other = reg ? model.groups.get(reg.group)?.name || reg.group : null;
      errors.push(`members: ${id} (${v.name}) is not a member of ${group?.name || a.counterparty} in the subscription register${other ? ` (the register lists it under ${other})` : " (it has no register entry)"}. Similar names, cities or categories never merge accounts. Remove it, or set what_if: true to size an unverified assumption.`);
      continue;
    }
    const rate = contractRate(a, v.currency);
    if (rate === null) { errors.push(`members: ${id} invoices in ${v.currency}, and ${a.id} has no contract rate for ${v.currency}.`); continue; }
    const sinceDay = reg?.since ? isoToDay(reg.since, now) : null;
    out.push({ id, vendor: v, status, relation: reg?.relation || null, since: reg?.since || null, sinceDay, rate, spend: spendOf(model, a, v, sinceDay, rate) });
  }
  if (!out.length && !errors.length) errors.push("members: no account to count.");
  return out;
}

/** Spend per year in euro at the contract rate, counted only while the register says the account belonged to the group. */
function spendOf(model, a, v, sinceDay, rate) {
  const ay = yearPeriod(a, "AY"), py = yearPeriod(a, "PY"), cy = yearPeriod(a, "CY");
  const from = (p) => (sinceDay === null ? p.start_day : Math.max(p.start_day, sinceDay));
  const share = (p) => Math.max(0, Math.min(1, (p.end_day - from(p) + 1) / 365));
  const ordersAY = ordersIn(model, v.id, from(ay), ay.end_day).reduce((s, o) => s + o.value, 0);
  const growth = 1 + (a.cy_growth_pct || 0) / 100;
  return {
    PY: (v.spend.PY || 0) * share(py) * rate,
    AY: ordersAY * rate,
    CY: (v.spend.AY || 0) * growth * share(cy) * rate
  };
}

// =============================================================================================
// Position per year
// =============================================================================================

/**
 * Owed, credited, claimed by the routine report and open, per year. `fix` changes the running year
 * only (linking accounts and fixing the report act on years that have not ended yet).
 */
function position(model, a, members, fix, now) {
  const asm = model.world.assumptions;
  return YEARS.map((year) => {
    const p = yearPeriod(a, year);
    const cy = year === "CY";
    const linkedIds = new Set(members.filter((m) => m.status === "linked" || (cy && fix.linkedExtra.has(m.id))).map((m) => m.id));
    const total = sum(members, (m) => m.spend[year]);
    const linked = sum(members.filter((m) => linkedIds.has(m.id)), (m) => m.spend[year]);
    const owed = rebateOn(a, total);
    const credited = a.credited_basis === "linked" ? rebateOn(a, linked) : 0;
    const rule = cy && fix.report ? fix.report : { currencies: a.report?.currencies || null, min: a.report?.min_threshold_eur || 0 };
    const visible = sum(members.filter((m) => linkedIds.has(m.id) && (!rule.currencies || rule.currencies.includes(m.vendor.currency))), (m) => m.spend[year]);
    const reported = visible >= (rule.min || 0) ? rebateOn(a, visible) : 0;
    const routine = Math.max(0, reported - credited);
    const open = Math.max(0, owed - credited - routine);
    const deadline = claimDeadline(a, year);
    let status;
    if (owed <= 0.005) status = "not_owed";
    else if (open <= 0.5) status = "settled";
    else if (deadline < 0) status = "expired";
    else status = cy ? "projected" : "open";
    return {
      year, ...p, projected: cy, spend: total, linked_spend: linked, visible_spend: visible,
      tier_pct: tierRate(a, total), owed, credited, routine, open, deadline, status,
      prep_days: year === "AY" ? a.claim_prep_days : a.audit_prep_days,
      _asm: asm
    };
  });
}

function publicYear(y, now) {
  return {
    year: y.year,
    period: `${dayToISO(y.start_day, now)} to ${dayToISO(y.end_day, now)}`,
    start_day: y.start_day, end_day: y.end_day,
    projected: y.projected,
    spend_eur: roundE(y.spend),
    linked_spend_eur: roundE(y.linked_spend),
    report_visible_spend_eur: roundE(y.visible_spend),
    tier_pct: y.tier_pct,
    owed_eur: roundE(y.owed),
    credited_by_supplier_eur: roundE(y.credited),
    claimed_by_report_eur: roundE(y.routine),
    open_eur: roundE(y.open),
    claim_deadline_day: y.deadline,
    claim_deadline_date: dayToISO(y.deadline, now),
    status: y.status
  };
}

// =============================================================================================
// Baseline (do nothing)
// =============================================================================================

function summarizeBaseline(model, a, members, years, H) {
  const atRisk = years.filter((y) => y.open > 0.5 && y.deadline >= 0 && y.deadline <= H);
  const first = atRisk.slice().sort((p, q) => p.deadline - q.deadline)[0] || null;
  const unlinked = members.filter((m) => m.status === "register" && (m.spend.AY > 0 || m.spend.CY > 0));
  return {
    value_at_risk_eur: roundE(sum(atRisk, (y) => y.open)),
    // The part of it that is the running year's projected rebate (not earned yet: the year runs).
    projected_eur: roundE(sum(atRisk.filter((y) => y.projected), (y) => y.open)),
    first_loss_day: first ? first.deadline : null,
    first_loss_year: first ? first.year : null,
    first_loss_label: first ? `${a.short} ${first.year === "AY" ? "agreement-year" : first.year === "PY" ? "previous-year" : "running-year"} claim` : null,
    // The tile names whose claim, as briefly as the Navigator names its plant ("Leipzig").
    first_loss_short: first ? String(a.short).split(" ")[0] : null,
    lost_already_eur: roundE(sum(years.filter((y) => y.status === "expired"), (y) => y.open)),
    beyond_horizon_eur: roundE(sum(years.filter((y) => y.open > 0.5 && y.deadline > H), (y) => y.open)),
    claims: years.filter((y) => y.owed > 0).map((y) => ({ year: y.year, open_eur: roundE(y.open), claim_deadline_day: y.deadline, status: y.status })),
    causes: causes(model, a, members, years),
    affected: {
      vendor_ids: unlinked.map((m) => m.id),
      link_ids: unlinked.map((m) => `L-${m.id}`)
    }
  };
}

/** Why the open amounts were never claimed, in plain words, with the accounts concerned. */
function causes(model, a, members, years) {
  const out = [];
  const ay = years.find((y) => y.year === "AY") || years[0];
  const unlinked = members.filter((m) => m.status === "register");
  if (unlinked.length) {
    out.push({
      code: "unlinked_members",
      text: `${unlinked.length} register member${unlinked.length === 1 ? " is" : "s are"} not linked to ${a.id} in the vendor master (no group key): ${unlinked.map((m) => `${m.id} ${m.vendor.name}`).join(", ")}. ${a.credited_basis === "linked" ? "Neither the supplier's statement nor GlobalCorp's year-end report counts" : "GlobalCorp's year-end report does not count"} ${unlinked.length === 1 ? "its" : "their"} spend (${eur(sum(unlinked, (m) => m.spend.AY))} in the last agreement year).`,
      vendor_ids: unlinked.map((m) => m.id)
    });
  }
  const cur = a.report?.currencies;
  if (cur) {
    const other = members.filter((m) => !cur.includes(m.vendor.currency));
    if (other.length) out.push({
      code: "report_currency",
      text: `The year-end report counts ${cur.join(", ")} invoices only: ${other.map((m) => `${m.id} (${m.vendor.currency})`).join(", ")} ${other.length === 1 ? "is" : "are"} left out (${eur(sum(other, (m) => m.spend.AY))} at the contract rate in the last agreement year).`,
      vendor_ids: other.map((m) => m.id)
    });
  }
  const min = a.report?.min_threshold_eur || 0;
  if (min && ay && ay.visible_spend < min && ay.owed > 0) {
    const visTier = tierRate(a, ay.visible_spend);
    const visFrom = sortedTiers(a).filter((t) => t.rate_pct === visTier).map((t) => t.from_eur)[0];
    const more = ay.spend > ay.visible_spend + 0.5 && ay.tier_pct !== visTier;
    out.push({
      code: "report_threshold",
      text: `The year-end report lists ${a.short} only above ${eur(min)}; the linked accounts reached ${eur(ay.visible_spend)} in the agreement year${visTier ? `, the ${visTier} % tier (from ${eur(visFrom)})` : ""}, so nothing was reported or claimed.${more ? ` Counting all ${members.length} accounts, the year reached ${eur(ay.spend)}, the ${ay.tier_pct} % tier.` : ""}`,
      vendor_ids: members.filter((m) => m.status === "linked").map((m) => m.id)
    });
  }
  if (a.credited_basis === "linked" && ay && ay.credited > 0 && ay.open > 0.5) {
    out.push({
      code: "statement_partial",
      text: `${a.short}'s own statement credited ${eur(ay.credited)} (${tierRate(a, ay.linked_spend)} % on the ${eur(ay.linked_spend)} on its record); the group reached the ${ay.tier_pct} % tier on ${eur(ay.spend)}.`,
      vendor_ids: members.filter((m) => m.status === "linked").map((m) => m.id)
    });
  }
  return out;
}

// =============================================================================================
// Variants (response options)
// =============================================================================================

function compileVariant(model, a, members, base, v, i, H, errors, warnings) {
  const where = `variants[${i}]`;
  const asm = model.world.assumptions;
  const id = String(v?.variant_id || `V${i + 1}`).slice(0, 40);
  const name = String(v?.name || id).slice(0, 120);
  const list = Array.isArray(v?.actions) ? v.actions : [];
  if (!list.length) { errors.push(`${where}: actions[] must contain at least one action.`); return null; }
  const memberIds = new Set(members.map((m) => m.id));
  const out = { id, name, claims: [], links: new Set(), report: null, fixedCosts: [], items: [], warnings: [], types: [] };
  const n0 = errors.length;

  list.forEach((act, j) => {
    const at = `${where}.actions[${j}]`;
    if (ACTION_TYPES.includes(act?.type) && !out.types.includes(act.type)) out.types.push(act.type);
    switch (act?.type) {
      case "claim":
      case "set_off":
      case "recovery_audit": {
        const ys = Array.isArray(act.years) && act.years.length ? [...new Set(act.years.map(String))] : ["AY"];
        for (const y of ys) {
          if (y === "CY") { errors.push(`${at}: the running year (CY) has not ended, so it cannot be claimed yet. Link the accounts or fix the report so the year-end routine catches it.`); return; }
          if (!CLAIMABLE.includes(y)) { errors.push(`${at}: years must be PY and/or AY (got "${y}").`); return; }
        }
        if (act.type === "set_off" && !a.set_off_allowed) { errors.push(`${at}: ${a.id} does not allow set-off. Use a written claim instead.`); return; }
        const prep = act.type === "recovery_audit" ? 0 : Math.max(...ys.map((y) => (y === "AY" ? a.claim_prep_days : a.audit_prep_days)));
        const start = intIn(act.start_in_days, prep, 0, 800, `${at}.start_in_days`, errors);
        if (start < prep) { errors.push(`${at}: preparing the claim evidence takes ${prep} days (${ys.includes("PY") ? "a look-back claim needs an audit pack" : "statement, invoices and the register extract"}); earliest start_in_days is ${prep}.`); return; }
        const fileDay = act.type === "recovery_audit" ? start + asm.recovery_audit_days : start;
        out.claims.push({ type: act.type, years: ys, start, fileDay, at });
        if (act.type !== "recovery_audit") {
          const days = ys.reduce((s, y) => s + (y === "AY" ? a.claim_prep_days : a.audit_prep_days), 0);
          out.fixedCosts.push({ label: act.type === "set_off" ? "Claim and set-off preparation" : "Claim preparation", cost: days * asm.day_rate_eur, detail: `${days} person-days at €${int(asm.day_rate_eur)}` });
          if (act.type === "set_off") out.fixedCosts.push({ label: "Set-off posting", cost: asm.set_off_admin_eur, detail: "accounts payable, one-off" });
        }
        out.items.push(act.type === "claim" ? `Written claim for ${ys.join(" and ")} (filed day ${start})`
          : act.type === "set_off" ? `Set-off notice for ${ys.join(" and ")} on day ${start}, settled with the payment run after the ${asm.set_off_notice_days ?? 7}-day objection period`
            : `Recovery-audit firm for ${ys.join(" and ")} (files day ${fileDay})`);
        break;
      }
      case "link_accounts": {
        const wanted = Array.isArray(act.vendor_ids) && act.vendor_ids.length
          ? [...new Set(act.vendor_ids.map(String))]
          : members.filter((m) => m.status === "register").map((m) => m.id);
        if (!wanted.length) { errors.push(`${at}: no account to link. Every counted account is already linked to ${a.id}.`); return; }
        for (const vid of wanted) {
          const v = model.vendors.get(vid);
          if (!v) { errors.push(`${at}: unknown vendor id "${vid}".`); return; }
          if (a.linked.includes(vid)) { out.warnings.push(`${at}: ${vid} is already linked to ${a.id}; ignored.`); continue; }
          if (!a.group || groupOf(model, vid) !== a.group) {
            const g = groupOf(model, vid);
            errors.push(`${at}: ${vid} (${v.name}) cannot be linked to ${a.id}: the subscription register ${g ? `lists it under ${model.groups.get(g)?.name || g}` : "has no entry for it"}. Only register members of ${model.groups.get(a.group)?.name || a.counterparty} can be linked; names never merge accounts.`);
            return;
          }
          if (!memberIds.has(vid)) { errors.push(`${at}: ${vid} is not in members, so its spend is not counted. Add it to members first.`); return; }
          out.links.add(vid);
        }
        const start = intIn(act.start_in_days, 0, 0, 800, `${at}.start_in_days`, errors);
        const effective = start + asm.group_fix_days;
        const nNew = wanted.filter((x) => !a.linked.includes(x)).length;
        if (!nNew) return;
        out.linkEffective = Math.max(out.linkEffective || 0, effective);
        out.fixedCosts.push({ label: "Vendor master: group key and agreement link", cost: asm.group_fix_base_eur + nNew * asm.group_fix_per_account_eur, detail: `${nNew} account${nNew === 1 ? "" : "s"}, effective day ${effective}` });
        out.items.push(`Link ${wanted.filter((x) => !a.linked.includes(x)).join(", ")} to ${a.id} (group key, effective day ${effective})${a.credited_basis === "linked" ? `, and notify ${a.short} so its statement counts them` : ""}`);
        break;
      }
      case "fix_report": {
        const cur = a.report?.currencies || null;
        const min = a.report?.min_threshold_eur || 0;
        if (!cur && !min) { errors.push(`${at}: the year-end report for ${a.id} already counts every currency and lists every tier; there is nothing to fix.`); return; }
        const allCur = act.all_currencies !== undefined ? !!act.all_currencies : !!cur;
        const allTiers = act.all_tiers !== undefined ? !!act.all_tiers : !!min;
        if (!allCur && !allTiers) { errors.push(`${at}: set all_currencies and/or all_tiers to true.`); return; }
        const start = intIn(act.start_in_days, 0, 0, 800, `${at}.start_in_days`, errors);
        const effective = start + asm.report_fix_days;
        out.report = { currencies: allCur ? null : cur, min: allTiers ? 0 : min, effective };
        out.fixedCosts.push({ label: "Year-end report rule change", cost: asm.report_fix_eur, detail: `effective day ${effective}` });
        out.items.push(`Fix the year-end report (${[allCur ? "all currencies at contract rates" : null, allTiers ? "every tier listed" : null].filter(Boolean).join(", ")}, effective day ${effective})`);
        break;
      }
      default:
        errors.push(`${at}: unknown type "${act?.type}". Allowed: ${ACTION_TYPES.join(", ")}.`);
    }
  });
  if (errors.length > n0) return null;
  warnings.push(...out.warnings.map((w) => `${id}: ${w}`));
  return out;
}

function costVariant(model, a, members, base, yearsShown, baseline, cv, H, now) {
  const asm = model.world.assumptions;
  const cyEnd = yearPeriod(a, "CY").end_day;
  const warn = (t) => cv.warnings.push(t);
  const shown = new Set(yearsShown.map((y) => y.year));
  const inHorizon = (y) => y.deadline >= 0 && y.deadline <= H;

  // Past years: recovered by claims, set-off or the audit firm (the earliest cash wins).
  const recovered = new Map(); // year -> [{amount, day, via}]
  const payablesPool = { left: sum(members, (m) => m.vendor.open_payables_eur || 0) };
  const ordered = cv.claims.slice().sort((p, q) => cashDay(a, asm, p) - cashDay(a, asm, q));
  let auditFee = 0;
  for (const c of ordered) {
    for (const yname of c.years) {
      const y = base.find((x) => x.year === yname);
      if (!shown.has(yname)) continue;
      if (y.open <= 0.5) { warn(`${c.at}: nothing is open for ${yname} (${y.status.replace("_", " ")}); this recovers nothing.`); continue; }
      if (recovered.has(yname)) { warn(`${c.at}: ${yname} is already recovered by an earlier action in this variant.`); continue; }
      if (c.fileDay > y.deadline) {
        warn(c.type === "recovery_audit"
          ? `${c.at}: the audit firm files on day ${c.fileDay}, after the ${yname} deadline on day ${y.deadline}; it recovers nothing for ${yname}, so no fee is due.`
          : `${c.at}: the claim reaches ${a.short} on day ${c.fileDay}, after the ${yname} deadline on day ${y.deadline}; it recovers nothing for ${yname}.`);
        continue;
      }
      if (c.type === "set_off") {
        const off = Math.min(y.open, payablesPool.left);
        payablesPool.left -= off;
        const parts = [];
        if (off > 0.5) parts.push({ amount: off, day: setOffDay(asm, c), via: "set-off" });
        if (y.open - off > 0.5) {
          parts.push({ amount: y.open - off, day: c.start + a.credit_note_days, via: "credit note" });
          warn(`${c.at}: open invoices cover only ${eur(off)} of ${yname}; the rest follows by credit note.`);
        }
        recovered.set(yname, parts);
      } else {
        recovered.set(yname, [{ amount: y.open, day: c.fileDay + a.credit_note_days, via: c.type === "recovery_audit" ? "credit note (audit firm)" : "credit note" }]);
        if (c.type === "recovery_audit") auditFee += y.open * (asm.recovery_audit_fee_pct / 100);
      }
    }
  }

  // Running year: linking accounts and fixing the report change what the year-end routine catches.
  const linkOk = cv.links.size && (cv.linkEffective ?? 0) <= cyEnd;
  const reportOk = cv.report && cv.report.effective <= cyEnd;
  if (cv.links.size && !linkOk) warn(`${cv.id}: the account links take effect on day ${cv.linkEffective}, after the running year ends on day ${cyEnd}.`);
  if (cv.report && !reportOk) warn(`${cv.id}: the report fix takes effect on day ${cv.report.effective}, after the running year ends on day ${cyEnd}.`);
  if (linkOk || reportOk) {
    const fixed = position(model, a, members, { linkedExtra: linkOk ? cv.links : new Set(), report: reportOk ? cv.report : null }, now)
      .find((x) => x.year === "CY");
    const cy = base.find((x) => x.year === "CY");
    const gain = cy.open - fixed.open;
    if (shown.has("CY") && gain > 0.5) {
      const via = fixed.credited > cy.credited + 0.5 ? "supplier statement" : "year-end claim";
      recovered.set("CY", [{ amount: gain, day: cyEnd + a.credit_note_days, via }]);
    }
    if (shown.has("CY") && fixed.open > 0.5 && cy.open > 0.5) {
      warn(`${cv.id}: ${eur(fixed.open)} of the running year stays open after the fix${reportOk && !linkOk && cy.open > 0 ? " (accounts still unlinked)" : linkOk && !reportOk && a.report?.currencies ? " (the report still leaves currencies out)" : ""}.`);
    }
  }

  // Figures within the horizon.
  let recoveredEur = 0;
  let residual = 0;
  const cash = [];
  let firstLoss = null;
  for (const y of yearsShown) {
    if (!inHorizon(y) || y.open <= 0.5) continue;
    const parts = recovered.get(y.year) || [];
    const got = sum(parts, (p) => p.amount);
    recoveredEur += got;
    const left = Math.max(0, y.open - got);
    residual += left;
    if (left > 0.5 && (firstLoss === null || y.deadline < firstLoss)) firstLoss = y.deadline;
    for (const p of parts) cash.push({ year: y.year, amount_eur: roundE(p.amount), day: p.day, via: p.via });
  }
  cash.sort((p, q) => p.day - q.day);

  const breakdown = [];
  const push = (label, cost, detail) => { if (cost > 0.5) breakdown.push({ item: label, cost_eur: roundE(cost), detail }); };
  for (const f of cv.fixedCosts) push(f.label, f.cost, f.detail);
  push("Recovery-audit fee", auditFee, `${asm.recovery_audit_fee_pct} % of the amount recovered`);
  const responseCost = sum(breakdown, (b) => b.cost_eur);
  const residualR = roundE(residual);
  const total = responseCost + residualR;
  const setOff = cv.claims.find((c) => c.type === "set_off");
  return {
    variant_id: cv.id,
    name: cv.name,
    actions: cv.items,
    action_types: cv.types,
    set_off_objection_day: setOff ? setOff.start + (asm.set_off_notice_days ?? 7) : null,
    response_cost_eur: responseCost,
    recovered_eur: roundE(recoveredEur),
    residual_var_eur: residualR,
    total_cost_eur: total,
    savings_vs_baseline_eur: baseline.value_at_risk_eur - total,
    time_to_effect_days: cash.length ? cash[0].day : null,
    first_loss_day: firstLoss,
    cash_in: cash,
    linked_vendor_ids: linkOk ? [...cv.links] : [],
    cost_breakdown: breakdown,
    warnings: cv.warnings,
    _internal: true
  };
}

function cashDay(a, asm, c) {
  if (c.type === "set_off") return setOffDay(asm, c);
  return c.fileDay + a.credit_note_days;
}

/** A set-off notice is sent on the start day; after the objection period the next payment run settles it. */
function setOffDay(asm, c) {
  return c.start + (asm.set_off_notice_days ?? 7) + asm.payment_run_days;
}

// =============================================================================================
// Tiers
// =============================================================================================

function sortedTiers(a) {
  return (a.tiers || []).slice().sort((p, q) => p.from_eur - q.from_eur);
}
function firstTier(a) {
  return sortedTiers(a)[0] || { from_eur: 0, rate_pct: 0 };
}

/** Rate in % of the tier reached by an amount (0 below the first tier). */
export function tierRate(a, amount) {
  let r = 0;
  for (const t of sortedTiers(a)) if (amount + 1e-6 >= t.from_eur) r = t.rate_pct;
  return r;
}

/** Rebate owed on an amount: retroactive (tier rate on everything) or stepped (each band at its rate). */
export function rebateOn(a, amount) {
  if (amount <= 0) return 0;
  if (a.retro !== false) return (amount * tierRate(a, amount)) / 100;
  const tiers = sortedTiers(a);
  let out = 0;
  tiers.forEach((t, i) => {
    const upper = tiers[i + 1]?.from_eur ?? Infinity;
    const band = Math.max(0, Math.min(amount, upper) - t.from_eur);
    out += (band * t.rate_pct) / 100;
  });
  return out;
}

function tierText(a) {
  return sortedTiers(a).map((t) => `${t.rate_pct} % from ${eur(t.from_eur)}`).join(", ");
}

// =============================================================================================
// small utils
// =============================================================================================

function sum(list, fn) {
  let s = 0;
  for (const x of list) s += fn(x) || 0;
  return s;
}

function intIn(v, dflt, min, max, field, errors) {
  if (v === undefined || v === null || v === "") return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) { errors.push(`${field}: must be a number.`); return dflt; }
  const r = Math.round(n);
  if (r < min || r > max) { errors.push(`${field}: must be between ${min} and ${max} (got ${n}).`); return Math.min(max, Math.max(min, r)); }
  return r;
}

function roundE(x) { return Math.round(x || 0); }
function int(x) { return Math.round(x).toLocaleString("en-GB"); }
/** "€52.4M", "€2.14M", "€437,500": millions trimmed to two decimals, exact euros below. */
function eur(x) {
  const v = Math.abs(x || 0);
  if (v >= 1e6) return `€${(Math.round((x / 1e6) * 100) / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}M`;
  return `€${int(x || 0)}`;
}
