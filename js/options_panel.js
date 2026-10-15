// Options tab: three costed options plus the do-nothing baseline, a cost comparison, and the
// approval gate. Card state follows option_decision events, so live and simulated runs behave alike.
// Lower expected total is better: what the response costs plus the rebate that is still lost.

import { bus } from "./events.js";
import { h, clear } from "./dom.js";
import { icon } from "./icons.js";
import { eurCompact, days } from "./format.js";
import { renderInline } from "./md.js";
import { aiLabel } from "./ai_label.js";

export function createOptionsPanel(panel, { onDecision, onCount } = {}) {
  let current = null;           // last options payload
  const status = new Map();     // option id -> "approved" | "rejected" | "not_selected"
  let locked = false;           // true once an option has been approved
  let ended = false;            // the run ended (abort, error) before any option was approved
  let refocus = false;          // a keyboard or pointer decision was made in the panel: keep focus in it

  function empty() {
    clear(panel);
    panel.appendChild(h("div", { class: "empty" },
      h("strong", {}, "No options yet"),
      h("span", {}, "Once the agent has calculated the rebate, its three costed options and the do-nothing baseline appear here for your decision.")));
  }

  function render() {
    clear(panel);
    if (!current) return empty();
    const { baseline, options = [], horizon_days: H = 400 } = current;
    const pending = !locked && !ended && options.some((o) => !status.has(o.id));
    const max = Math.max(1, baseline?.value_at_risk_eur || 0, ...options.map((o) => o.total_cost_eur || 0));

    // Summary column: what to decide and how the totals compare. Cards carry the detail.
    const rows = [
      ...options.map((o) => ({ key: o.letter, name: `Option ${o.letter}: ${o.title}`, mit: o.response_cost_eur || 0, res: o.residual_var_eur || 0, total: o.total_cost_eur || 0, recommended: !!o.recommended })),
      { key: "–", name: "Do nothing", base: baseline?.value_at_risk_eur || 0, total: baseline?.value_at_risk_eur || 0 }
    ];
    const summary = h("div", { class: "options-summary" },
      h("div", { class: "options-summary-head" },
        h("h3", {}, pending ? "Decide how to respond" : locked ? "Decision taken" : ended ? "Run ended before a decision" : "Options"),
        aiLabel("options")),
      h("p", {}, `Expected total over ${H} days: what the response costs plus the rebate that is still lost by its claim deadline. All figures come from the deterministic rebate engine.`),
      h("div", { class: "compare", role: "img", "aria-label": `Expected total cost per option compared with doing nothing: ${rows.map((r) => `${r.name} ${eurCompact(r.total)}`).join("; ")}` },
        rows.map((r) => h("div", { class: "compare-row", dataset: { recommended: String(!!r.recommended) }, title: r.name },
          h("span", { class: "compare-key", "aria-hidden": "true" }, r.key),
          h("span", { class: "compare-track" },
            r.base !== undefined
              ? h("span", { class: "compare-bar baseline", style: { width: `${(r.base / max) * 100}%` } })
              : [h("span", { class: "compare-bar mitigation", style: { width: `${(r.mit / max) * 100}%` } }),
                h("span", { class: "compare-bar residual", style: { left: `${(r.mit / max) * 100}%`, width: `${(r.res / max) * 100}%` } })]),
          h("span", { class: "compare-value num" }, eurCompact(r.total))))),
      h("div", { class: "compare-legend" },
        h("span", { class: "k-mit" }, "Response cost"),
        h("span", { class: "k-res" }, "Rebate still lost"),
        h("span", { class: "k-base" }, "Do nothing")));

    const grid = h("div", { class: "options-grid" });
    for (const o of options) grid.appendChild(optionCard(o));
    grid.appendChild(baselineCard(baseline, H));
    panel.appendChild(h("div", { class: "options-layout" }, summary, grid));
    if (refocus) {
      // The cards were rebuilt: put focus on the next decision, or on the decided card's status.
      refocus = false;
      const next = panel.querySelector(".option-actions .btn");
      const target = next || panel.querySelector(".option-status")?.closest(".option-card");
      if (target) {
        if (!next) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: false });
      }
    }
  }

  function optionCard(o) {
    const st = status.get(o.id) || (locked ? "not_selected" : ended ? "expired" : "");
    const card = h("article", { class: "option-card", dataset: { recommended: String(!!o.recommended), status: st, kind: "option" }, "aria-label": `Option ${o.letter}: ${o.title}` },
      h("div", { class: "option-top" },
        h("span", { class: "option-letter", "aria-hidden": "true" }, o.letter),
        h("h4", { class: "option-title" }, o.title),
        o.recommended ? h("span", { class: "chip", dataset: { tone: "recommended" } }, "Recommended") : null),
      o.description ? renderInline(o.description, h("p", { class: "option-desc" })) : null,
      h("dl", { class: "option-figures" },
        h("dt", {}, "Response cost"), h("dd", {}, eurCompact(o.response_cost_eur)),
        h("dt", {}, "Rebate still lost"), h("dd", {}, eurCompact(o.residual_var_eur)),
        h("dt", {}, "Cash in after"), h("dd", {}, days(o.time_days)),
        h("dt", {}, "Net recovery"), h("dd", {}, eurCompact(o.savings_eur))),
      h("div", { class: "option-total" }, h("span", { class: "label" }, "Expected total"), h("span", { class: "value num" }, eurCompact(o.total_cost_eur))),
      o.residual_risk ? h("p", { class: "option-risk" }, h("strong", {}, "Residual risk: "), o.residual_risk) : null,
      actionsFor(o, st));
    return card;
  }

  function baselineCard(b, H) {
    const st = status.get("baseline") || (locked ? "not_selected" : ended ? "expired" : "");
    const firstLoss = b?.first_loss_day === null || b?.first_loss_day === undefined
      ? `none within ${H} days`
      : `day ${b.first_loss_day}${b.first_loss_label || b.first_loss_short ? `, ${b.first_loss_label || b.first_loss_short}` : ""}`;
    return h("article", { class: "option-card", dataset: { kind: "baseline", status: st }, "aria-label": "Do nothing" },
      h("div", { class: "option-top" },
        h("span", { class: "option-letter", "aria-hidden": "true" }, "–"),
        h("h4", { class: "option-title" }, "Do nothing")),
      h("p", { class: "option-desc" }, b?.description || "Claim nothing and let the claim deadlines pass."),
      h("dl", { class: "option-figures" },
        h("dt", {}, "Rebate lost"), h("dd", {}, eurCompact(b?.value_at_risk_eur)),
        ...(b?.projected_eur > 0 ? [h("dt", {}, "Of which projected"), h("dd", { title: "The current year's rebate, projected from last year: it is lost too if nothing changes before the year ends" }, `${eurCompact(b.projected_eur)} (current year)`)] : []),
        h("dt", {}, "First deadline"), h("dd", {}, firstLoss),
        ...(b?.lost_already_eur > 0 ? [h("dt", {}, "Already lost"), h("dd", {}, eurCompact(b.lost_already_eur))] : [])),
      h("div", { class: "option-total" }, h("span", { class: "label" }, "Expected total"), h("span", { class: "value num" }, eurCompact(b?.value_at_risk_eur))),
      actionsFor({ id: "baseline", letter: "–", title: "Do nothing" }, st, true));
  }

  function actionsFor(o, st, isBaseline = false) {
    if (st === "approved") return h("div", { class: "option-status mark-pass" }, icon("check", 20), isBaseline ? "Loss accepted" : "Approved");
    if (st === "rejected") return h("div", { class: "option-status mark-fail" }, icon("x", 20), "Rejected");
    if (st === "not_selected") return h("div", { class: "option-status mark-skip" }, "Not selected");
    if (st === "expired") return h("div", { class: "option-status mark-skip" }, "No decision: the run ended");
    if (isBaseline) {
      return h("div", { class: "option-actions" },
        h("button", { class: "btn", type: "button", on: { click: () => decide(o, "approved") } }, "Accept the loss"));
    }
    return h("div", { class: "option-actions" },
      // The recommended option's Approve is the one solid brand button; the others stay available
      // as outlined brand buttons. Reject is a neutral decision, not an alarm.
      h("button", { class: `btn btn-approve${o.recommended ? "" : " btn-brand-outline"}`, type: "button", on: { click: () => decide(o, "approved") } }, icon("check", 18), "Approve"),
      h("button", { class: "btn btn-reject", type: "button", on: { click: () => decide(o, "rejected") } }, "Reject"));
  }

  function decide(o, decision) {
    if (locked || !current) return;
    refocus = panel.contains(document.activeElement);
    // The decision names the set of options it was taken on, so a click on a set the agent has just
    // replaced is ignored instead of counting for the new one.
    onDecision?.({ option_id: o.id, option_label: o.id === "baseline" ? "Do nothing (accept the loss)" : `Option ${o.letter}: ${o.title}`, options_seq: current.options_seq ?? null, decision });
  }

  bus.on("options", (ev) => {
    current = ev.payload;
    status.clear();
    locked = false;
    ended = false;
    render();
    onCount?.(current.options?.length || 0, true);
  });

  bus.on("option_decision", (ev) => {
    const { option_id: id, decision, options_seq: seq } = ev.payload;
    if (current && seq !== undefined && seq !== (current.options_seq ?? null)) return; // a decision on an older set
    status.set(id, decision);
    if (decision === "approved") {
      locked = true;
      for (const o of current?.options || []) if (o.id !== id) status.set(o.id, "not_selected");
      if (id !== "baseline") status.set("baseline", "not_selected");
    }
    render();
    onCount?.(current?.options?.length || 0, !locked);
  });

  // An aborted or failed run cannot take a decision any more: say so instead of offering buttons.
  bus.on("run_end", () => {
    if (!current || locked) return;
    ended = true;
    render();
    onCount?.(current.options?.length || 0, false);
  });

  function reset() {
    current = null;
    status.clear();
    locked = false;
    ended = false;
    empty();
    onCount?.(0, false);
  }

  empty();
  return { reset };
}
