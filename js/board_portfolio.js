// The portfolio: every rebate agreement of GlobalCorp SE on one card, the next claim deadline first,
// each with the race of the year that deadline is for (the look-back year while its claim is still
// open, else the closed year), what the year-end report counted or the agent's count once it has
// one, and the days left to claim. A row opens that agreement's group view. Rows are kept across
// redraws (keyed by agreement), so keyboard focus survives the run's events.

import { h } from "./dom.js";
import { eurCompact, shortDate } from "./format.js";
import { UI } from "./config.js";
import { YEAR_LABEL } from "./board_data.js";
import { miniTrack, rowOutcome } from "./board_race.js";

// The agent's figures that are not (yet) verified, as on the race's chip.
const BASIS_TAG = { estimate: ["First estimate", "ai"], what_if: ["What-if", "ai"], partial: ["Partial count", "risk"] };
const STATE_WORDS = { affected: "rebate missed", at_risk: "at risk", resolved: "approved or settled" };

export function createPortfolio({ onRow }) {
  const list = h("div", { class: "pf-rows" });
  const head = h("div", { class: "pf-head", "aria-hidden": "true" },
    h("span", {}, "Agreement"), h("span", {}, "The year due next, against the tiers"), h("span", {}, "Rebate"), h("span", {}, "Next claim deadline"));
  const el = h("div", { class: "portfolio", role: "group", "aria-label": "All rebate agreements, next claim deadline first" }, head, list);
  const items = new Map(); // agreement id → the row's parts
  let revealed = null; // { id, h }: the row last brought into view, at which height of the list
  el.addEventListener("scroll", () => updateMore(), { passive: true });

  function item(id) {
    let it = items.get(id);
    if (it) return it;
    const name = h("strong", {}, "");
    const sub = h("span", {}, "");
    const checked = h("span", { class: "pf-checked", hidden: true }, "✓ checked in this run");
    const track = h("span", {});
    const big = h("strong", {}, "");
    const tag = h("span", { class: "pf-basis", hidden: true }, "");
    const small = h("span", {}, "");
    const out = h("span", { class: "pf-out" }, h("span", { class: "pf-big" }, big, tag), small);
    const dlBig = h("strong", {}, "");
    const dlSmall = h("span", {}, "");
    const dlYear = h("span", { class: "pf-year" }, "");
    const deadline = h("span", { class: "pf-deadline" }, dlBig, dlSmall, dlYear);
    const btn = h("button", { class: "pf-row", type: "button", dataset: { id } },
      h("span", { class: "pf-name" }, name, sub, checked), track, out, deadline);
    btn.addEventListener("click", () => onRow?.(id, btn));
    it = { btn, name, sub, checked, track, out, big, tag, small, deadline, dlBig, dlSmall, dlYear };
    items.set(id, it);
    return it;
  }

  /**
   * rows: portfolioView(); opts: { stateOf(key), checking: Set(ids), checked: Set(ids), focus: id,
   * decisionOf(id, year), basisOf(id) → "estimate" | "what_if" | "partial" | "verified" | null }
   */
  function render(rows, { stateOf = () => "neutral", checking = new Set(), checked = new Set(), focus = null, decisionOf = () => null, basisOf = () => null } = {}) {
    const active = document.activeElement;
    const want = new Set();
    rows.forEach((p, i) => {
      const it = item(p.id);
      want.add(p.id);
      // A mark on the agreement itself (ui_mark_board agreement_ids) wins over its group's colour.
      const own = stateOf(`agreement:${p.id}`);
      const st = own && own !== "neutral" ? own : p.group_id ? stateOf(`group:${p.group_id}`) : "neutral";
      const year = p.row?.year || null;
      const decision = year ? decisionOf(p.id, year) : null;
      const outcome = p.row ? rowOutcome(p.row, { decision }) : { tone: "muted", big: "—", small: [] };
      const dl = p.next_deadline;
      const urgent = !!dl && dl.day <= UI.urgentDays;
      // The agent's count is not yet a verified figure: say so, in the AI's violet.
      const basis = p.mode === "result" ? BASIS_TAG[basisOf(p.id)] || null : null;
      const yearName = year ? YEAR_LABEL[year].toLowerCase() : "";
      if (st && st !== "neutral") it.btn.dataset.state = st; else delete it.btn.dataset.state;
      it.btn.dataset.checking = String(checking.has(p.id));
      it.btn.dataset.focus = String(p.id === focus);
      it.name.textContent = p.short;
      it.sub.textContent = `${p.id} · ${p.tiers_text}`;
      it.checked.hidden = !checked.has(p.id);
      const track = p.row ? miniTrack(p.row, p.scale_max, p.report_min_eur, decision) : h("span", {});
      it.track.replaceWith(track);
      it.track = track;
      it.out.dataset.tone = outcome.tone;
      it.big.textContent = outcome.big;
      it.tag.hidden = !basis;
      if (basis) { it.tag.textContent = basis[0]; it.tag.dataset.tone = basis[1]; }
      it.small.textContent = p.mode === "report" ? `report: ${eurCompact(p.row?.total_eur || 0)} counted` : (outcome.small[0] || "");
      it.deadline.dataset.urgent = String(urgent);
      it.dlBig.textContent = dl ? (dl.day === 0 ? "today" : `${dl.day} day${dl.day === 1 ? "" : "s"}`) : "none open";
      it.dlSmall.textContent = dl ? shortDate(dl.date) : "";
      it.dlYear.textContent = dl ? YEAR_LABEL[dl.year].toLowerCase() : "";
      it.btn.setAttribute("aria-label", [
        `${p.short}, ${p.id}, ${p.tiers_text}`,
        st && st !== "neutral" ? `state: ${STATE_WORDS[st]}` : null,
        basis ? `the agent's ${basis[0].toLowerCase()}` : null,
        p.mode === "report"
          ? `${yearName}: the year-end report counted ${eurCompact(p.row?.total_eur || 0)}; ${outcome.big}`
          : `${yearName}: eligible spend ${eurCompact(p.row?.total_eur || 0)}; ${outcome.big}${outcome.small[0] ? `, ${outcome.small[0]}` : ""}`,
        dl ? `next claim deadline ${shortDate(dl.date)}, ${dl.day === 0 ? "today" : `in ${dl.day} day${dl.day === 1 ? "" : "s"}`}, for the ${YEAR_LABEL[dl.year].toLowerCase()}${dl.year === "PY" ? " (look-back clause)" : ""}` : "no claim deadline open",
        checking.has(p.id) ? "being checked now" : null,
        checked.has(p.id) ? "checked in this run" : null
      ].filter(Boolean).join("; ") + ". Opens the group view.");
      if (list.children[i] !== it.btn) list.insertBefore(it.btn, list.children[i] || null);
    });
    for (const [id, it] of items) if (!want.has(id)) { it.btn.remove(); items.delete(id); }
    // Moving a row in the list can drop its focus: give it back.
    if (active && active !== document.activeElement && active.isConnected && el.contains(active)) active.focus({ preventScroll: true });
    updateMore();
  }

  /**
   * Scrolls the list so this agreement's row is whole in view (the row being checked, or the one a
   * finding flags), once per agreement and size: the presenter can scroll away and it stays, until
   * another row needs showing or the list changes size (the drawer opening, say).
   */
  function reveal(id) {
    if (!id || (revealed?.id === id && revealed.h === el.clientHeight)) return;
    const it = items.get(id);
    if (!it || !el.clientHeight) return;
    revealed = { id, h: el.clientHeight };
    const top = it.btn.offsetTop - head.offsetHeight;
    const bottom = it.btn.offsetTop + it.btn.offsetHeight;
    if (top < el.scrollTop) el.scrollTop = Math.max(0, top);
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    updateMore();
  }

  /** A fade at the bottom while more rows lie below the visible part. */
  function updateMore() {
    el.dataset.more = String(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }

  return { element: el, render, reveal, button: (id) => items.get(id)?.btn || null, forget: () => { revealed = null; } };
}
