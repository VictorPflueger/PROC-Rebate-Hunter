// Integrity checks for the synthetic world, scenarios and reference cases.
// Runs in the browser (Diagnostics panel) and in Node (tools/check_world.mjs).

import { buildModel, yearPeriod } from "./world.js";
import { simulateRebate } from "./rebate.js";
import { checkSimRuns } from "./sim_check.js";
import { sequenceRatio } from "./similarity.js";
import { eurCompact } from "./format.js";
import { groupView, raceView } from "./board_data.js";

/**
 * @returns {{ok: boolean, checks: Array<{name: string, ok: boolean, detail: string}>, stats: object}}
 */
export function checkWorld(world, scenarios = [], referenceCases = {}, simRuns = null) {
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });
  const model = buildModel(world);

  add("Model builds without structural problems", model.problems.length === 0, model.problems.slice(0, 5).join(" | ") || "no problems");

  // ---- counts ---------------------------------------------------------------------------------
  const legacy = world.vendors.filter((v) => !String(v.origin).startsWith("scenario"));
  const legacyOrders = world.purchase_orders.filter((o) => Number(o.id) < 4500002001);
  add("150 accounts and 1,203 orders from the Streamlit version", legacy.length === 150 && legacyOrders.length === 1203, `${legacy.length} accounts, ${legacyOrders.length} orders (plus ${world.vendors.length - legacy.length} scenario accounts)`);
  add("3 company codes, 8 agreements, 6 injectable scenarios", world.company_codes.length === 3 && world.agreements.length === 8 && scenarios.length === 6,
    `${world.company_codes.length} company codes, ${world.agreements.length} agreements, ${scenarios.length} scenarios`);

  // ---- ledger -----------------------------------------------------------------------------------
  const ledger = [];
  for (const v of world.vendors) {
    const sum = (model.ordersByVendor.get(v.id) || []).reduce((s, o) => s + Math.round(o.value * 100), 0);
    if (sum !== Math.round(v.spend.AY * 100)) ledger.push(`${v.id}: orders ${sum / 100} ≠ ${v.spend.AY}`);
    if (!(v.spend.PY > 0)) ledger.push(`${v.id}: no previous-year spend`);
  }
  add("Every account's orders add up to its agreement-year spend", ledger.length === 0, ledger.slice(0, 5).join(" | ") || `${world.vendors.length} accounts reconcile`);

  const outside = [];
  for (const o of world.purchase_orders) {
    const a = world.agreements.find((x) => x.linked.includes(o.vendor)) || world.agreements.find((x) => x.group && model.registerByVendor.get(o.vendor)?.group === x.group);
    const end = a ? a.ay_end_day : world.meta.default_ay_end_day;
    if (o.day < end - 364 || o.day > end) outside.push(`${o.id} (${o.vendor}) on day ${o.day}`);
  }
  add("Every order lies inside its agreement year", outside.length === 0, outside.slice(0, 5).join(" | ") || `${world.purchase_orders.length} orders dated`);

  // ---- agreements and register ------------------------------------------------------------------
  const agr = [];
  for (const a of world.agreements) {
    const tiers = a.tiers || [];
    if (!tiers.length || tiers.some((t, i) => i && t.from_eur <= tiers[i - 1].from_eur)) agr.push(`${a.id}: tiers not ascending`);
    if (!(a.claim_window_days > 0)) agr.push(`${a.id}: no claim window`);
    if (a.group && !model.groups.has(a.group)) agr.push(`${a.id}: unknown group ${a.group}`);
    for (const id of a.linked) {
      const g = model.registerByVendor.get(id)?.group;
      if (a.group && g !== a.group) agr.push(`${a.id}: linked ${id} is not a register member of ${a.group}`);
      if (model.vendors.get(id)?.group_key !== a.group_key) agr.push(`${a.id}: linked ${id} lacks group key ${a.group_key}`);
    }
    for (const [cur, rate] of Object.entries(a.fx_to_eur || {})) if (!(rate > 0)) agr.push(`${a.id}: bad contract rate ${cur}`);
    if (yearPeriod(a, "AY").end_day >= 0) agr.push(`${a.id}: the agreement year has not ended`);
  }
  add("Agreements: ascending tiers, claim windows, linked accounts in the register", agr.length === 0, agr.slice(0, 5).join(" | ") || `${world.agreements.length} agreements valid`);

  const reg = [];
  for (const r of world.register) {
    if (r.relation === "acquired" && !r.since) reg.push(`${r.vendor}: acquisition without a date`);
    if (r.lei && !/^[A-Z0-9]{18}[0-9]{2}$/.test(r.lei)) reg.push(`${r.vendor}: malformed LEI ${r.lei}`);
    if (model.vendors.get(r.vendor)?.group_key && !world.agreements.some((a) => a.linked.includes(r.vendor))) reg.push(`${r.vendor}: group key without an agreement link`);
  }
  for (const g of world.groups) if (g.real && !/^[A-Z0-9]{18}[0-9]{2}$/.test(g.lei || "")) reg.push(`${g.id}: real group without an LEI`);
  add("Register: one entry per account, dated acquisitions, well-formed LEIs", reg.length === 0, reg.slice(0, 5).join(" | ") || `${world.register.length} entries in ${world.groups.length} groups`);

  // ---- names never merge: the look-alike pair is in different groups --------------------------------
  const apexA = model.vendors.get("40001"), apexB = model.vendors.get("40002");
  const sim = apexA && apexB ? sequenceRatio(apexA.name.toLowerCase(), apexB.name.toLowerCase()) : 0;
  const differ = model.registerByVendor.get("40001")?.group !== model.registerByVendor.get("40002")?.group;
  add("Look-alike pair (Apex) is similar by name but in different register groups", sim > 0.6 && differ, `name similarity ${(sim * 100).toFixed(1)} %, ${differ ? "different groups" : "same group"}`);

  // ---- the rebate board can draw every agreement ---------------------------------------------------------
  const boardIssues = [];
  for (const a of world.agreements) {
    const g = groupView(model, a.id);
    const race = raceView(model, a.id);
    if (!g || !g.accounts.length) { boardIssues.push(`${a.id}: no accounts`); continue; }
    for (const x of g.accounts) if (!(x.spend_ay_eur > 0)) boardIssues.push(`${a.id}: ${x.id} has no spend at a contract rate`);
    if (g.accounts.filter((x) => x.linked).length !== a.linked.length) boardIssues.push(`${a.id}: linked accounts missing from the ring`);
    if (!race?.rows.some((r) => r.year === "AY")) { boardIssues.push(`${a.id}: no agreement-year race`); continue; }
    for (const r of race.rows) {
      const sum = r.segments.reduce((s, x) => s + x.eur, 0);
      if (Math.abs(sum - r.total_eur) > r.segments.length) boardIssues.push(`${a.id} ${r.year}: segments ${sum} ≠ total ${r.total_eur}`);
      if (!(race.scale_max >= Math.max(r.total_eur, ...a.tiers.map((t) => t.from_eur)))) boardIssues.push(`${a.id} ${r.year}: scale below the bar or a tier`);
    }
  }
  add("The rebate board can draw every agreement (accounts, ring, race scale)", boardIssues.length === 0, boardIssues.slice(0, 5).join(" | ") || `${world.agreements.length} agreements drawn`);

  // ---- scenarios touch an agreement and at least two accounts ------------------------------------------
  for (const sc of scenarios) {
    const ex = sc.exposure_check || {};
    const ok = model.agreements.has(ex.agreement_id) && (ex.vendor_ids || []).length >= 2 && ex.vendor_ids.every((id) => model.vendors.has(id));
    add(`Scenario ${sc.number}: names an agreement and ≥ 2 accounts`, ok, `${ex.agreement_id || "no agreement"}: ${(ex.vendor_ids || []).join(", ")}`);
  }

  // ---- reference cases run and bite ------------------------------------------------------------------
  const stats = {};
  for (const sc of scenarios) {
    const rc = referenceCases[sc.id];
    if (!rc) { add(`Reference case for scenario ${sc.number}`, false, "missing"); continue; }
    const res = simulateRebate(model, rc.finding);
    if (!res.ok) { add(`Reference case ${sc.number} runs`, false, res.errors.join(" | ")); continue; }
    const b = res.baseline;
    stats[sc.id] = { var: b.value_at_risk_eur, first_loss_day: b.first_loss_day, variants: res.variants.map((v) => ({ id: v.variant_id, total: v.total_cost_eur })) };
    add(`Reference case ${sc.number}: rebate at risk > 0 with 3 options on verified members`, b.value_at_risk_eur > 0 && res.variants.length === 3 && res.basis === "verified",
      `at risk ${eurCompact(b.value_at_risk_eur)}, first claim deadline day ${b.first_loss_day ?? "—"}`);
    if (rc.hypothesis) {
      const h = simulateRebate(model, rc.hypothesis);
      add(`Reference case ${sc.number}: first estimate runs and differs from the finding`, h.ok && h.baseline.value_at_risk_eur !== b.value_at_risk_eur,
        h.ok ? `first estimate ${eurCompact(h.baseline.value_at_risk_eur)}${h.basis === "what_if" ? " (what-if)" : ""}` : h.errors.join(" | "));
    }
  }

  // ---- the live sweep has honest negatives -------------------------------------------------------
  const clean = world.agreements.filter((a) => !scenarios.some((s) => s.exposure_check?.agreement_id === a.id));
  const cleanRes = clean.map((a) => ({ a, r: simulateRebate(model, { agreement_id: a.id }) }));
  add("Agreements outside the scenarios have nothing open (sweep negatives)", cleanRes.every(({ r }) => r.ok && r.baseline.value_at_risk_eur === 0),
    cleanRes.map(({ a, r }) => `${a.id}: ${r.ok ? eurCompact(r.baseline.value_at_risk_eur) : "error"}`).join(", "));

  // ---- simulation scripts ------------------------------------------------------------------------
  if (simRuns) checks.push(...checkSimRuns(model, simRuns, scenarios, referenceCases));

  return { ok: checks.every((c) => c.ok), checks, stats };
}
