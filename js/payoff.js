// Shared shaping of options and of what an approved decision changes on screen. The live tools and
// the simulation player both use these helpers, so an option card, the KPI tiles and the account
// markers look exactly the same whichever producer is running.

/** Figures of one engine variant as shown on an option card (all values come from the engine). */
export function optionFigures(v) {
  return {
    response_cost_eur: v.response_cost_eur,
    residual_var_eur: v.residual_var_eur,
    total_cost_eur: v.total_cost_eur,
    savings_eur: v.savings_vs_baseline_eur,
    recovered_eur: v.recovered_eur,
    time_days: v.time_to_effect_days,
    first_loss_day: v.first_loss_day ?? null,
    linked_vendor_ids: v.linked_vendor_ids || []
  };
}

/** The do-nothing baseline as shown on its card. */
export function baselineFigures(res, description = "") {
  const b = res.baseline;
  return {
    value_at_risk_eur: b.value_at_risk_eur,
    projected_eur: b.projected_eur || 0,
    first_loss_day: b.first_loss_day,
    first_loss_label: b.first_loss_label,
    first_loss_short: b.first_loss_short,
    lost_already_eur: b.lost_already_eur,
    affected_vendor_ids: b.affected?.vendor_ids || [],
    description: String(description || "").slice(0, 300)
  };
}

/** The KPI update after a rebate calculation (first estimate, verified figure or what-if). */
export function kpiFromResult(res, label) {
  const b = res.baseline;
  return {
    value_at_risk_eur: b.value_at_risk_eur,
    projected_eur: b.projected_eur || 0,
    horizon_days: res.horizon_days,
    first_loss_day: b.first_loss_day,
    first_loss_label: b.first_loss_label,
    first_loss_short: b.first_loss_short,
    basis: res.basis,
    stage: res.basis !== "verified" || /first estimate/.test(String(label)) ? "estimate" : "verified",
    label: res.basis === "what_if" ? "what-if, not verified" : res.basis === "partial" ? "partial count" : label
  };
}

/**
 * Events that follow an approval: the KPI tiles show what is still lost, and the map follows the
 * money. When the option leaves nothing to lose, every account the agreement counts (and the gap
 * accounts) turns resolved, with the supplier group. When some rebate is still lost, the accounts
 * the option links turn resolved and the others stay amber with the group. Returns a list of
 * [type, payload] pairs for the bus.
 */
export function decisionEffects(optionsPayload, optionId) {
  if (!optionsPayload) return [];
  const base = optionsPayload.baseline || {};
  if (optionId === "baseline") {
    return [["kpi_update", { decided: true, accepted: true, option_label: "Do nothing", before_eur: base.value_at_risk_eur }]];
  }
  const opt = (optionsPayload.options || []).find((o) => o.id === optionId);
  if (!opt) return [];
  const out = [["kpi_update", {
    decided: true,
    option_label: `option ${opt.letter}`,
    residual_eur: opt.residual_var_eur,
    total_eur: opt.total_cost_eur,
    before_eur: base.value_at_risk_eur,
    first_loss_day_after: opt.first_loss_day ?? null
  }]];
  const exposed = base.affected_vendor_ids || [];
  const counted = [...new Set([...(optionsPayload.member_vendor_ids || []), ...exposed])];
  const fixed = new Set(opt.linked_vendor_ids || []);
  const groupSafe = !(opt.residual_var_eur > 0);
  const resolved = counted.filter((id) => groupSafe || fixed.has(id));
  const atRisk = counted.filter((id) => !resolved.includes(id));
  const links = (ids) => ids.map((id) => `L-${id}`);
  const groupIds = optionsPayload.group_id ? [optionsPayload.group_id] : [];
  if (resolved.length || (groupSafe && groupIds.length)) {
    out.push(["map_update", { vendor_ids: resolved, link_ids: links(resolved), group_ids: groupSafe ? groupIds : [], state: "resolved", source: "decision" }]);
  }
  if (atRisk.length || (!groupSafe && groupIds.length)) {
    out.push(["map_update", { vendor_ids: atRisk, link_ids: links(atRisk), group_ids: groupSafe ? [] : groupIds, state: "at_risk", source: "decision" }]);
  }
  return out;
}
