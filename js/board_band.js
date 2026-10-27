// The ring band: the group view when the board is short (the drawer open on a decision, a small
// screen). The constellation's ring becomes a hex capsule beside the group: the accounts linked to
// the agreement sit inside it (the year-end report counts them), the register members that are not
// linked outside it, each with its hexagon (solid when linked, dashed when not, whatever its state
// colour), its name and its spend in the year the race above leads with (the closed year, or the
// look-back year where that is the year with money open). When an approved option links accounts,
// they slide into the band, as they glide onto the ring in the full view. When the band is too
// narrow for one line it shortens each name to the words that tell it apart ("Meraki", "Cisco
// Systems"), then drops the amounts, then keeps the dots alone (each still a button with its full
// name). Every account and the group open the same details as in the full view.

import { h, prefersReducedMotion } from "./dom.js";
import { icon } from "./icons.js";
import { eurCompact } from "./format.js";
import { hexCell } from "./board_group.js";

const STATE_WORDS = { affected: "rebate missed", at_risk: "at risk", resolved: "approved or settled" };
const YEAR_WORDS = { AY: "closed year", PY: "look-back year" };
const DENSE = ["0", "1", "2", "3"];

/** The fewest leading words that tell each label apart from the others: "Meraki", "Cisco Systems". */
export function prefixLabels(labels) {
  const words = labels.map((l) => String(l || "").split(/\s+/).filter(Boolean));
  const head = (w, n) => w.slice(0, n).join(" ").toLowerCase();
  return words.map((w, i) => {
    for (let n = 1; n < w.length; n += 1) {
      if (words.every((o, j) => j === i || head(o, n) !== head(w, n))) return w.slice(0, n).join(" ");
    }
    return w.join(" ");
  });
}

export function createBand({ onAccount, onHub }) {
  const hubName = h("span", { class: "band-hub-name" }, "");
  const hub = h("button", { class: "band-hub", type: "button" }, h("span", { class: "band-hub-dot" }, hexCell("band-hub-shape"), icon("hub", 18)), hubName);
  const ringFull = h("span", { class: "rl-full" }, "");
  const ringLabel = h("span", { class: "band-ring-label", "aria-hidden": "true" }, ringFull, h("span", { class: "rl-short" }, "Linked"));
  const inside = h("div", { class: "band-ring", role: "group" }, ringLabel);
  const outside = h("div", { class: "band-out", role: "group" });
  const yearNote = h("span", { class: "band-year", "aria-hidden": "true" }, "");
  const el = h("div", { class: "acct-band", hidden: true }, hub, inside, outside, yearNote);
  hub.addEventListener("click", () => onHub?.(hub));
  const items = new Map(); // id → { btn, dot, name, short, meta }

  function item(id) {
    let it = items.get(id);
    if (it) return it;
    const dot = hexCell("band-dot");
    const name = h("span", { class: "bn-full" }, "");
    const short = h("span", { class: "bn-short" }, "");
    const meta = h("span", { class: "band-meta" }, "");
    const btn = h("button", { class: "band-acct", type: "button", dataset: { id } }, dot, h("span", { class: "band-text", "aria-hidden": "true" }, h("strong", {}, name, short), meta));
    btn.addEventListener("click", () => onAccount?.(id, btn));
    it = { btn, dot, name, short, meta };
    items.set(id, it);
    return it;
  }

  /**
   * view: groupView(); opts: { stateOf(key), hubKey, moved: Set, decisionLabel, seenOf(id),
   * checking: Set(ids), reportNote, spendYear: "AY" | "PY" }. The band keeps its buttons across
   * renders, so focus survives.
   */
  function render(view, { stateOf = () => "neutral", hubKey, moved = new Set(), decisionLabel = null, seenOf = () => true, checking = new Set(), reportNote = null, spendYear = "AY" } = {}) {
    const animate = !el.hidden && !prefersReducedMotion();
    const before = animate ? positions() : null;
    const active = document.activeElement;
    el.hidden = false;
    hubName.textContent = view.group ? view.group.short || view.hub.label : view.hub.short || view.hub.label;
    const hs = stateOf(hubKey);
    if (hs && hs !== "neutral") hub.dataset.state = hs; else delete hub.dataset.state;
    hub.setAttribute("aria-label", `${view.hub.label}: ${view.group ? "supplier group" : `counterparty of ${view.agreement.id}, no supplier group in the register`}${hs && hs !== "neutral" ? `; state: ${STATE_WORDS[hs]}` : ""}. Opens its details.`);
    ringFull.textContent = `Linked to ${view.agreement.id}`;
    const prefixes = prefixLabels(view.accounts.map((x) => x.label));
    const spendOf = (a) => (spendYear === "PY" ? a.spend_py_eur : a.spend_ay_eur);
    const yearWords = YEAR_WORDS[spendYear] || YEAR_WORDS.AY;
    yearNote.textContent = `spend in the ${yearWords}`;
    const shorts = new Map(view.accounts.map((x, i) => [x.id, prefixes[i]]));
    inside.setAttribute("aria-label", `Accounts linked to ${view.agreement.id}: the year-end report counts them`);
    outside.setAttribute("aria-label", `Accounts of the group that are not linked to ${view.agreement.id}: the year-end report misses them`);
    const want = new Set();
    for (const a of view.accounts) {
      const it = item(a.id);
      want.add(a.id);
      const linked = a.linked || moved.has(a.id);
      const s = stateOf(`vendor:${a.id}`);
      if (s && s !== "neutral") it.btn.dataset.state = s; else delete it.btn.dataset.state;
      it.btn.dataset.linked = String(linked);
      it.btn.dataset.seen = String(linked || seenOf(a.id) || (s && s !== "neutral"));
      it.btn.dataset.checking = String(checking.has(a.id));
      it.name.textContent = a.label;
      it.short.textContent = shorts.get(a.id);
      const spend = spendOf(a);
      const has = spend !== null && spend !== undefined;
      it.meta.textContent = has ? eurCompact(spend) : "";
      it.btn.title = `${a.name}${has ? `, ${eurCompact(spend)} in the ${yearWords}` : ""}`;
      const cur = view.agreement.report_currencies;
      const where = moved.has(a.id) && !a.linked ? `to be linked to ${view.agreement.id} (${decisionLabel || "the approved option"})`
        : a.linked && cur && !cur.includes(a.currency) ? `linked to ${view.agreement.id}, but the report counts ${cur.join(", ")} invoices only`
          : a.linked && reportNote ? `linked to ${view.agreement.id}, but ${reportNote}`
            : a.linked ? `linked to ${view.agreement.id}, so the report counts it`
              : `not linked to ${view.agreement.id}, so the report misses it`;
      it.btn.setAttribute("aria-label", [
        `${a.name}, vendor account ${a.id}`,
        has ? `${eurCompact(spend)} in the ${yearWords}` : null,
        where,
        s && s !== "neutral" ? `state: ${STATE_WORDS[s]}` : null,
        checking.has(a.id) ? "being checked now" : null
      ].filter(Boolean).join("; ") + ". Opens the account details.");
    }
    for (const [id, it] of items) if (!want.has(id)) { it.btn.remove(); items.delete(id); }
    // Each side in the view's order (linked first, then by spend); a button moves only when it must.
    for (const [parent, ids] of [[inside, view.accounts.filter((a) => a.linked || moved.has(a.id))], [outside, view.accounts.filter((a) => !(a.linked || moved.has(a.id)))]]) {
      ids.forEach((a, i) => {
        const btn = items.get(a.id).btn;
        const at = parent.children[i + (parent === inside ? 1 : 0)] || null; // the ring's label comes first
        if (at !== btn) parent.insertBefore(btn, at);
      });
    }
    // Moving a button drops its focus: give it back.
    if (active && active !== document.activeElement && active.isConnected && el.contains(active)) active.focus({ preventScroll: true });
    fit();
    // An account that moved inside the band (into the ring after a decision, or along as the others
    // move) slides from where it was: first, last, invert, play.
    if (before) {
      const after = positions();
      for (const [id, r1] of after) {
        const r0 = before.get(id);
        if (!r0) continue;
        const dx = r0.x - r1.x;
        const dy = r0.y - r1.y;
        if (Math.abs(dx) + Math.abs(dy) < 2) continue;
        items.get(id).btn.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 900, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      }
    }
  }

  /** Each account's place within the band (so the band moving with the race does not animate). */
  function positions() {
    const b = el.getBoundingClientRect();
    return new Map([...items].filter(([, it]) => it.btn.isConnected).map(([id, it]) => {
      const r = it.btn.getBoundingClientRect();
      return [id, { x: r.left - b.left, y: r.top - b.top }];
    }));
  }

  /** The fullest form that fits on one line: names and amounts, short names and amounts, short names, dots. */
  function fit() {
    for (const d of DENSE) {
      el.dataset.dense = d;
      if (el.scrollWidth <= el.clientWidth + 1) return;
    }
  }

  function hide() { el.hidden = true; }

  return { element: el, render, hide, fit, hub, button: (id) => items.get(id)?.btn || null };
}
