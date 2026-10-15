// Placeholders for simulation scripts. Authored scripts never type a number the engine computes:
// they write {{var}}, {{AY.open_full}}, {{V1.total}} … and the player fills them from the engine
// result at playback. Shared by the player (js/simulation.js) and the script checker
// (js/sim_check.js), so a placeholder that would not resolve is caught before a demo.

import { eurCompact, eurFull, shortDate } from "./format.js";

/**
 * Variables produced by one sim_rebate result. `which` "hypothesis" prefixes keys with "hyp.";
 * every other result writes the unprefixed keys (a later result overwrites an earlier one).
 */
export function rebateVars(which, res) {
  const v = {};
  const pre = which === "hypothesis" ? "hyp." : "";
  const b = res.baseline;
  v[`${pre}var`] = eurCompact(b.value_at_risk_eur);
  v[`${pre}var_full`] = eurFull(b.value_at_risk_eur);
  v[`${pre}lost`] = eurCompact(b.lost_already_eur);
  v[`${pre}first_loss_day`] = b.first_loss_day === null ? "none" : String(b.first_loss_day);
  v[`${pre}first_loss_date`] = b.first_loss_day === null ? "—" : shortDate(b.first_loss_day);
  v[`${pre}first_loss_year`] = b.first_loss_year || "—";
  v[`${pre}horizon`] = String(res.horizon_days);
  for (const y of res.years || []) {
    const k = `${pre}${y.year}`;
    v[`${k}.spend`] = eurCompact(y.spend_eur);
    v[`${k}.spend_full`] = eurFull(y.spend_eur);
    v[`${k}.linked_spend`] = eurCompact(y.linked_spend_eur);
    v[`${k}.report_spend`] = eurCompact(y.report_visible_spend_eur);
    v[`${k}.tier`] = `${y.tier_pct} %`;
    v[`${k}.owed`] = eurCompact(y.owed_eur);
    v[`${k}.owed_full`] = eurFull(y.owed_eur);
    v[`${k}.credited`] = eurCompact(y.credited_by_supplier_eur);
    v[`${k}.credited_full`] = eurFull(y.credited_by_supplier_eur);
    v[`${k}.open`] = eurCompact(y.open_eur);
    v[`${k}.open_full`] = eurFull(y.open_eur);
    v[`${k}.deadline_day`] = String(y.claim_deadline_day);
    v[`${k}.deadline_date`] = shortDate(y.claim_deadline_day);
    v[`${k}.period`] = y.period;
  }
  for (const m of res.members || []) {
    v[`${pre}spend.${m.vendor_id}`] = eurCompact(m.spend_eur.AY);
  }
  for (const x of res.variants || []) {
    v[`${x.variant_id}.cost`] = eurCompact(x.response_cost_eur);
    v[`${x.variant_id}.res`] = eurCompact(x.residual_var_eur);
    v[`${x.variant_id}.total`] = eurCompact(x.total_cost_eur);
    v[`${x.variant_id}.save`] = eurCompact(x.savings_vs_baseline_eur);
    v[`${x.variant_id}.rec`] = eurCompact(x.recovered_eur);
    v[`${x.variant_id}.time`] = x.time_to_effect_days === null ? "none" : String(x.time_to_effect_days);
    v[`${x.variant_id}.cash_date`] = x.time_to_effect_days === null ? "—" : shortDate(x.time_to_effect_days);
    v[`${x.variant_id}.first_loss_day`] = x.first_loss_day === null ? "none" : String(x.first_loss_day);
    if (x.set_off_objection_day !== null && x.set_off_objection_day !== undefined) {
      v[`${x.variant_id}.objection_day`] = String(x.set_off_objection_day);
      v[`${x.variant_id}.objection_date`] = shortDate(x.set_off_objection_day);
    }
  }
  return v;
}

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;
const DATE_KEY = /^date:\+?(-?\d+)$/;

/** Replaces {{key}} with vars[key]; {{date:+N}} becomes the short date N days from today. */
export function fillTemplate(vars, text) {
  return String(text ?? "").replace(PLACEHOLDER, (m, key) => {
    const dm = DATE_KEY.exec(key);
    if (dm) return shortDate(Number(dm[1]));
    return key in vars ? vars[key] : m;
  });
}

/** Placeholder keys in a text that `vars` cannot resolve. */
export function unresolvedKeys(vars, text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(PLACEHOLDER)) {
    const key = m[1];
    if (!DATE_KEY.test(key) && !(key in vars)) out.push(key);
  }
  return out;
}
