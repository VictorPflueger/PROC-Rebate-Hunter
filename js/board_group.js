// The constellation: a supplier group as the hub, the ring of accounts linked to the agreement (the
// ones the year-end report counts), the register members outside the ring that it misses, and any
// look-alike the duplicate check found, held apart with a struck link. After a decision the accounts
// an option links glide onto the ring. Lines are SVG; the hub, the accounts and the company codes are
// buttons, so every entity can be reached by keyboard and opens its details.

import { h, prefersReducedMotion } from "./dom.js";
import { icon } from "./icons.js";
import { eurCompact } from "./format.js";
import { CHECK_LABEL } from "./board_data.js";

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const RAD = Math.PI / 180;
// The band at the bottom kept free for the folded legend (left) and the company codes (right).
export const BOTTOM_BAND = 62;

// The labels' widths the layout can choose (a wide label wraps less; a slim one leaves the ring room),
// and the smallest ring that still reads as a ring around its hub (a 44 px hub and the accounts' dots).
const LABEL_ROOMS = [236, 172];
export const RING_MIN = 48;

/**
 * Where everything sits, for a constellation area of width × height whose left side the expanded
 * legend may cover (insetLeft wide). Pure: no DOM.
 *   ring: accounts on the ring (left arc); outer: register members outside (right);
 *   moved: accounts a decision linked (right arc of the ring); satellites: [{ vendor_id, probe }].
 * Everything is placed around the hub first; then the largest ring, the widest outside ellipse and
 * the widest labels are chosen whose accounts and labels fit between the legend (or the left edge)
 * and the right edge. Wide labels win while they still allow a ring of 110 px (or the ring the height
 * allows); else the slim ones, if they give a larger ring.
 * A short area (small) gets a one-line caption under the ring (the board's caption names the group)
 * and no ring label. fits: false when no ring of RING_MIN fits (too short, or too narrow beside the
 * legend); squeezed: that, with the legend beside the group.
 * Returns { hub: {x, y}, r, labelRoom, small, fits, squeezed, pos: Map(id → {x, y, side, place}) }.
 */
export function constellationGeometry({ width, height, ring = [], outer = [], moved = [], satellites = [], insetLeft = 0, narrow = false, captionW = 260 }) {
  const availW = Math.max(200, width);
  const availH = Math.max(100, height);
  const small = availH < 230;
  const capH = small ? 10 : 58;   // the group's name and LEI under the ring (a short area relies on the board's caption)
  const topPad = small ? 12 : 26; // the ring label above the ring
  const rCap = clamp(Math.min(availH * 0.34, availW * 0.17, (availH - topPad - capH) / 2), 34, 190);
  const left = insetLeft + 12;
  const right = availW - 12;
  const extraWide = clamp(availW * 0.2, 84, 230);
  const ry = (r) => r + clamp(availH * 0.2, 36, 120);
  // n angles (degrees) centred on 0, `step` apart and at most ±cap.
  const spread = (n, step, cap) => (n <= 0 ? [] : n === 1 ? [0] : Array.from({ length: n }, (_, i) => -Math.min(cap, step * (n - 1)) + (2 * Math.min(cap, step * (n - 1)) * i) / (n - 1)));

  /** The hub's height for a ring of radius r: room above for the ring's label, below for the caption. */
  const hubY = (r) => clamp(availH * 0.48, r + topPad, availH - r - capH);

  /** Places everything relative to the hub, and measures how far left and right it reaches. */
  function arrange(r, extra, labelRoom) {
    const rel = new Map();
    const cy = hubY(r);
    // A point kept inside the area's height and at least `min` from the hub (moved outwards when the
    // edge pushed it in).
    const keep = (x, y, lo, min) => {
      const yy = clamp(cy + y, lo, availH - lo) - cy;
      const xx = Math.sign(x || 1) * Math.max(Math.abs(x), Math.sqrt(Math.max(0, min * min - yy * yy)));
      return { x: xx, y: yy };
    };
    // Ring, left arc (around 180°), labels to the left.
    spread(ring.length, 32, 62).forEach((d, i) => {
      const a = (180 + d) * RAD;
      rel.set(ring[i], { x: r * Math.cos(a), y: r * Math.sin(a), side: "left", place: "ring" });
    });
    // Linked by a decision: right arc of the ring, labels to the right.
    spread(moved.length, 30, 58).forEach((d, i) => {
      const a = d * RAD;
      rel.set(moved[i], { x: r * Math.cos(a), y: r * Math.sin(a), side: "right", place: "ring" });
    });
    // Outside: right of the ring, on a wider ellipse, never closer to the hub than r + 44.
    spread(outer.length, 30, 64).forEach((d, i) => {
      const a = d * RAD;
      rel.set(outer[i], { ...keep((r + extra) * Math.cos(a), ry(r) * Math.sin(a), 18, r + 44), side: "right", place: "outer" });
    });
    // Look-alikes: beyond the account they resemble, turned 40° clockwise, so the struck link stays
    // short; their label on the side away from the hub.
    for (const s of satellites) {
      const p = rel.get(s.probe);
      if (!p) continue;
      const a = Math.atan2(p.y, p.x) - 40 * RAD;
      const dist = Math.hypot(p.x, p.y) + (narrow ? 90 : 120);
      const q = keep(dist * Math.cos(a), dist * Math.sin(a), 24, r + 44);
      rel.set(s.vendor_id, { ...q, side: q.x < 0 ? "left" : "right", place: "satellite" });
    }
    // The reach: the ring, the caption under it, and every account with its label (a dot of up to
    // 46 px, 12 px to its label).
    const reach = 23 + 12 + labelRoom;
    let minX = -Math.max(r + 8, small ? 0 : captionW / 2);
    let maxX = -minX;
    for (const p of rel.values()) {
      minX = Math.min(minX, p.side === "left" ? p.x - reach : p.x - 24);
      maxX = Math.max(maxX, p.side === "right" ? p.x + reach : p.x + 24);
    }
    return { rel, minX, maxX };
  }

  /** The largest ring (down to RING_MIN) whose accounts and labels fit across, for one label width. */
  function fitFor(labelRoom) {
    for (let r = rCap; r >= Math.min(RING_MIN, rCap); r -= 2) {
      for (const extra of [extraWide, 84]) {
        const g = arrange(r, extra, labelRoom);
        if (g.maxX - g.minX <= right - left) return { r, labelRoom, ...g };
      }
    }
    return null;
  }
  const wide = fitFor(LABEL_ROOMS[0]);
  const slim = fitFor(LABEL_ROOMS[1]);
  const pick = wide && (wide.r >= Math.min(rCap, 110) || !slim || wide.r >= slim.r) ? wide : slim;
  const fits = !!pick && pick.r >= RING_MIN;
  const g = pick || { r: Math.max(34, Math.min(rCap, RING_MIN)), labelRoom: LABEL_ROOMS[1], ...arrange(Math.max(34, Math.min(rCap, RING_MIN)), 84, LABEL_ROOMS[1]) };
  // The hub: towards 40 % of the width, as far as the reach on either side allows.
  const lo = left - g.minX;
  const hi = right - g.maxX;
  const cx = lo <= hi ? clamp(availW * 0.4, lo, hi) : lo;
  const cy = hubY(g.r);
  const pos = new Map();
  for (const [id, p] of g.rel) pos.set(id, { x: cx + p.x, y: cy + p.y, side: p.side, place: p.place });
  return { hub: { x: cx, y: cy }, r: g.r, labelRoom: g.labelRoom, small, fits, squeezed: insetLeft > 0 && !fits, pos };
}

/**
 * Moves account labels up or down until no two overlap and none covers a fixed obstacle (the group's
 * caption, another account's dot), within [top, bottom]. Pure: no DOM.
 *   items: [{ id, x0, x1, y, h }]  a label's horizontal extent, its centre and height
 *   obstacles: [{ x0, x1, y0, y1, owner? }]  fixed boxes (owner: an item id the box does not block)
 * Returns Map(id → dy), the vertical shift of each label.
 */
export function separateLabels(items, obstacles = [], { top = 0, bottom = Infinity, gap = 4 } = {}) {
  const box = items.map((it) => ({ ...it, dy: 0 }));
  const span = (b) => [b.y - b.h / 2 + b.dy, b.y + b.h / 2 + b.dy];
  const across = (a, b) => a.x0 < b.x1 && b.x0 < a.x1;
  for (let round = 0; round < 40; round += 1) {
    let moved = false;
    box.sort((a, b) => (a.y + a.dy) - (b.y + b.dy));
    for (let i = 0; i < box.length; i += 1) {
      for (let j = i + 1; j < box.length; j += 1) {
        const [a0, a1] = span(box[i]);
        const [b0, b1] = span(box[j]);
        if (!across(box[i], box[j]) || a1 + gap <= b0 || b1 + gap <= a0) continue;
        const push = (a1 + gap - b0) / 2;
        box[i].dy -= push;
        box[j].dy += push;
        moved = true;
      }
    }
    for (const b of box) {
      for (const o of obstacles) {
        if (o.owner === b.id || !across(b, o)) continue;
        const [b0, b1] = span(b);
        if (b1 + gap <= o.y0 || o.y1 + gap <= b0) continue;
        // Away from the obstacle, on the side of the label's own centre.
        b.dy += b.y + b.dy < (o.y0 + o.y1) / 2 ? o.y0 - gap - b1 : o.y1 + gap - b0;
        moved = true;
      }
      const [b0, b1] = span(b);
      if (b1 > bottom) { b.dy -= b1 - bottom; moved = true; }
      if (b0 < top) { b.dy += top - b0; moved = true; }
    }
    if (!moved) break;
  }
  return new Map(box.map((b) => [b.id, Math.round(b.dy)]));
}

/**
 * Whether labels, once moved by `dy` (separateLabels), are clear: none overlaps another label or a
 * fixed obstacle, and all stay inside [0, width] × [0, bottom]. Pure: no DOM.
 */
export function labelsClear(items, dy, obstacles = [], { bottom = Infinity, width = Infinity } = {}) {
  const box = items.map((it) => {
    const d = dy.get(it.id) || 0;
    return { ...it, y0: it.y - it.h / 2 + d, y1: it.y + it.h / 2 + d };
  });
  const meet = (a, b) => a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1;
  for (let i = 0; i < box.length; i += 1) {
    const a = box[i];
    if (a.y0 < -1 || a.y1 > bottom + 1 || a.x0 < -1 || a.x1 > width + 1) return false;
    for (let j = i + 1; j < box.length; j += 1) if (meet(a, box[j])) return false;
    for (const o of obstacles) if (o.owner !== a.id && meet(a, o)) return false;
  }
  return true;
}

/**
 * Whether the ring's label ("Linked to RA-…", centred on the top of the ring at radius lr, textLen
 * long) stays clear of the accounts on the ring. dotOf(id) is an account's diameter.
 */
export function ringLabelClear({ hub, lr, textLen, pos, dotOf = () => 24 }) {
  const half = textLen / 2 / lr;
  for (const [id, p] of pos) {
    if (p.place !== "ring") continue;
    const a = Math.atan2(p.y - hub.y, p.x - hub.x) + Math.PI / 2; // 0 at the top of the ring
    const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (off < half + (dotOf(id) / 2 + 6) / lr) return false;
  }
  return true;
}

const STATE_WORDS = { affected: "rebate missed", at_risk: "at risk", resolved: "approved or settled" };

export function createConstellation({ onAccount, onHub, onCode }) {
  const lines = svg("g", { class: "links" });
  const ringZone = svg("circle", { class: "ring-zone" });
  const ringPath = svg("path", { id: "rh-ring-arc", fill: "none", stroke: "none" });
  const ringText = svg("text", { class: "ring-label" });
  const ringTextPath = svg("textPath", { href: "#rh-ring-arc", startOffset: "50%", "text-anchor": "middle" });
  ringText.appendChild(ringTextPath);
  const looks = svg("g", { class: "lookalikes" });
  const canvas = svg("svg", { "aria-hidden": "true", focusable: "false" });
  canvas.append(ringZone, lines, ringPath, ringText, looks);
  const hubBtn = h("button", { class: "hub-btn", type: "button" }, icon("hub", 28));
  const hubLabel = h("span", { class: "hub-label", "aria-hidden": "true" }, h("strong", {}, ""), h("span", {}, ""));
  const hub = h("div", { class: "hub" }, hubBtn, hubLabel);
  const nodes = h("div", { class: "nodes" });
  const codesLead = h("span", {}, "Billed to");
  const codes = h("div", { class: "codes" }, codesLead);
  const el = h("div", { class: "constellation" }, canvas, hub, nodes, codes);
  hubBtn.addEventListener("click", () => onHub?.(hubBtn));

  const reg = new Map(); // id → { wrap, hit, label parts, line, place, placedAs, gliding, x, y, base, d }
  const codeBtns = new Map(); // company code → button (kept across renders, so focus survives)
  let agreementId = null;
  let last = null;       // the last render input
  let geom = null;
  let tween = null;

  /** Updates the accounts, the hub and the codes; the caller places them with layout(). */
  function render(view, opts) {
    last = { view, opts };
    if (!view) { el.hidden = true; return; }
    el.hidden = false;
    if (view.agreement.id !== agreementId) rebuild(view);
    update(view, opts);
  }

  function rebuild(view) {
    agreementId = view.agreement.id;
    for (const r of reg.values()) { r.wrap.remove(); r.line?.remove(); }
    reg.clear();
    looks.replaceChildren();
    hubLabel.firstChild.textContent = view.hub.label;
    hubLabel.lastChild.textContent = view.group ? (view.hub.lei ? `LEI ${view.hub.lei}` : "no LEI on record") : "no supplier group in the register";
    ringTextPath.textContent = `Linked to ${view.agreement.id}`;
    geom = null;
  }

  function nodeFor(id, place) {
    let r = reg.get(id);
    if (r) return r;
    const hit = h("button", { class: "acct-hit", type: "button" }, h("span", { class: "acct-dot" }));
    const name = h("strong", {}, "");
    const meta = h("span", { class: "meta" }, "");
    const reason = h("span", { class: "reason" }, "");
    const tags = h("span", { class: "tags" });
    const label = h("span", { class: "acct-label", "aria-hidden": "true" }, name, meta, reason, tags);
    const wrap = h("div", { class: "acct", dataset: { id, place } }, hit, label);
    hit.addEventListener("click", () => onAccount?.(id, hit));
    nodes.appendChild(wrap);
    r = { wrap, hit, label, name, meta, reason, tags, line: null, place, placedAs: null, gliding: false, x: null, y: null, base: 20, d: 20 };
    reg.set(id, r);
    if (!prefersReducedMotion()) {
      wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
      hit.animate([{ transform: "scale(0.6)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    }
    return r;
  }

  function update(view, opts) {
    const { stateOf, seenOf, checksOf, checking, moved = new Set(), satellites = [], showLabels = true, showLinks = true, decisionLabel, reportNote = null } = opts;
    el.dataset.labels = showLabels ? "on" : "off";
    el.dataset.links = showLinks ? "on" : "off";
    // Size by the closed year's spend (the layout scales it down with a small ring).
    const max = Math.max(1, ...view.accounts.map((a) => a.spend_ay_eur || 0), ...satellites.map((s) => s.spend_ay_eur || 0));
    const size = (eur) => 14 + 26 * Math.sqrt(Math.max(0, eur || 0) / max);
    const want = new Set();
    for (const a of view.accounts) {
      const place = a.linked || moved.has(a.id) ? "ring" : "outer";
      const r = nodeFor(a.id, place);
      want.add(a.id);
      r.place = place;
      r.wrap.dataset.place = place;
      r.base = size(a.spend_ay_eur);
      dress(r, a, { view, stateOf, seenOf, checksOf, checking, moved, decisionLabel, reportNote });
      // Register links run from an account to its group; a counterparty without a group has none.
      if (view.group && !r.line) { r.line = svg("line", { class: "reg-link" }); lines.appendChild(r.line); }
      if (!view.group && r.line) { r.line.remove(); r.line = null; }
      if (r.line) {
        r.line.dataset.relation = a.relation || "subsidiary";
        const ls = stateOf(`link:${a.id}`);
        if (ls !== r.line.dataset.state) flash(r.line, ls);
        if (ls && ls !== "neutral") r.line.dataset.state = ls; else delete r.line.dataset.state;
      }
    }
    for (const s of satellites) {
      const r = nodeFor(s.vendor_id, "satellite");
      want.add(s.vendor_id);
      r.base = size(s.spend_ay_eur);
      r.probe = s.probe;
      r.similarity = s.similarity_pct;
      dress(r, s, { view, stateOf, seenOf, checksOf, checking, moved, decisionLabel, satellite: s });
    }
    for (const [id, r] of reg) if (!want.has(id)) { r.wrap.remove(); r.line?.remove(); reg.delete(id); }
    const hs = stateOf(view.group ? `group:${view.group.id}` : `agreement:${view.agreement.id}`);
    if (hs !== (hub.dataset.state || "neutral")) {
      if (hs === "affected") flash(ringZone, hs);
      if (hs && hs !== "neutral") hub.dataset.state = hs; else delete hub.dataset.state;
    }
    hubBtn.setAttribute("aria-label", view.group
      ? `${view.hub.label}: supplier group${view.hub.lei ? `, LEI ${view.hub.lei}` : ""}${hs && hs !== "neutral" ? `; state: ${STATE_WORDS[hs]}` : ""}. Opens the register entry.`
      : `${view.hub.label}: counterparty of ${view.agreement.id}, no supplier group in the register${hs && hs !== "neutral" ? `; state: ${STATE_WORDS[hs]}` : ""}. Opens its details.`);
    // GlobalCorp's company codes billed by the group (burgundy, its own sites), kept across renders.
    const wantCodes = new Set(view.company_codes);
    for (const [id, b] of codeBtns) if (!wantCodes.has(id)) { b.remove(); codeBtns.delete(id); }
    view.company_codes.forEach((id, i) => {
      let b = codeBtns.get(id);
      if (!b) {
        b = h("button", { class: "code-btn", type: "button", dataset: { code: id } }, icon("building", 18), h("span", {}, ""));
        b.addEventListener("click", () => onCode?.(id, b));
        codeBtns.set(id, b);
      }
      const cc = view.codes_info?.[id];
      b.lastChild.textContent = `${id.replace("CC-", "")}${cc?.city ? ` ${cc.city}` : ""}`;
      const st = stateOf(`code:${id}`);
      if (st && st !== "neutral") b.dataset.state = st; else delete b.dataset.state;
      b.setAttribute("aria-label", `Company code ${id}${cc?.name ? `, ${cc.name}` : ""}${cc?.city ? ` in ${cc.city}` : ""}${st && st !== "neutral" ? `; state: ${STATE_WORDS[st]}` : ""}. Opens its details.`);
      if (codes.children[i + 1] !== b) codes.insertBefore(b, codes.children[i + 1] || null);
    });
  }

  /**
   * Text, state and checks of one account node. decisionLabel ("option A") is set once an option is
   * approved: it names what links an account, or what claims its spend while it stays unlinked.
   * reportNote says why the report missed the rebate of linked accounts (its listing minimum).
   */
  function dress(r, a, { view, stateOf, seenOf, checksOf, checking, moved, decisionLabel, reportNote = null, satellite = null }) {
    const id = a.id || a.vendor_id;
    const st = stateOf(`vendor:${id}`) || "neutral";
    if (st !== (r.wrap.dataset.state || "neutral")) flash(r.wrap, st);
    if (st !== "neutral") r.wrap.dataset.state = st; else delete r.wrap.dataset.state;
    const linked = !satellite && (a.linked || moved.has(id));
    r.wrap.dataset.linked = String(linked);
    r.wrap.dataset.seen = String(!!(linked || satellite || seenOf(id)));
    r.wrap.dataset.checking = String(checking.has(id));
    r.name.textContent = a.label;
    const money = a.spend_ay_eur === null || a.spend_ay_eur === undefined ? "" : `${eurCompact(a.spend_ay_eur)} in the closed year${a.currency && a.currency !== "EUR" ? ` (${a.currency} invoices)` : ""}`;
    r.meta.textContent = [id, money].filter(Boolean).join(" · ");
    const cur = view.agreement.report_currencies;
    let reason;
    let tone;
    if (satellite) {
      reason = "Not in the group: other owner";
      tone = "neutral";
    } else if (moved.has(id) && !a.linked) {
      reason = decisionLabel ? `To be linked (${decisionLabel})` : "To be linked";
      tone = "resolved";
    } else if (a.linked && cur && !cur.includes(a.currency)) {
      reason = `Linked, but the report counts ${cur.join(", ")} only`;
      tone = st === "neutral" ? "neutral" : st;
    } else if (a.linked && reportNote) {
      reason = `Linked, but ${reportNote}`;
      tone = st === "neutral" ? "neutral" : st;
    } else if (a.linked) {
      reason = `Linked to ${view.agreement.id}`;
      tone = "neutral";
    } else if (decisionLabel && st === "resolved") {
      // The approved option claims what the report missed without linking the account.
      reason = `Not linked; counted in ${decisionLabel}'s claim`;
      tone = "resolved";
    } else if (decisionLabel && st === "at_risk") {
      reason = `Not linked; still missed with ${decisionLabel}`;
      tone = "at_risk";
    } else if (r.wrap.dataset.seen === "true" || st !== "neutral") {
      reason = view.agreement.statement ? "Not linked: missing from the statement and the report" : "Not linked: the report misses it";
      tone = st === "neutral" ? "neutral" : st;
    } else {
      // Not looked at in this run yet: the vendor master's fact only.
      reason = `Not linked to ${view.agreement.id}`;
      tone = "neutral";
    }
    r.reason.textContent = reason;
    r.reason.dataset.tone = tone === "affected" ? "" : tone;
    if (!r.reason.dataset.tone) delete r.reason.dataset.tone;
    const kinds = checksOf(id);
    r.tags.replaceChildren(...kinds.slice(0, 3).map((k) => h("span", { class: "check-tag" }, `${CHECK_LABEL[k] || k} ✓`)), ...(kinds.length > 3 ? [h("span", { class: "check-tag" }, `+${kinds.length - 3}`)] : []));
    r.hit.setAttribute("aria-label", [
      `${a.name || a.label}, vendor account ${id}`,
      money,
      satellite ? `look-alike of ${satellite.probe}, ${Math.round(satellite.similarity_pct)} % similar name; ${reason.toLowerCase()}` : reason,
      STATE_WORDS[st] ? `state: ${STATE_WORDS[st]}` : null,
      kinds.length ? `checked in this run: ${kinds.map((k) => CHECK_LABEL[k] || k).join(", ")}` : null,
      checking.has(id) ? "being checked now" : null
    ].filter(Boolean).join("; ") + ". Opens the account details.");
  }

  function flash(target, state) {
    if (state !== "affected" || prefersReducedMotion()) return;
    target.classList.remove("flash");
    void target.getBoundingClientRect?.();
    target.classList.add("flash");
  }

  /**
   * Places everything for the current size. With `animate`, an account that changes place (onto the
   * ring after a decision) glides there, and keeps gliding if the board is re-placed meanwhile; a new
   * size or the legend opening only re-places the rest. `obstacles` are boxes the labels keep clear
   * of (the folded legend, in this element's coordinates). Returns { fits }: false when the ring or
   * its labels cannot fit the area without overlapping (the board then shows the band instead).
   */
  function layout({ animate = false, insetLeft = layout.insetLeft || 0, narrow = layout.narrow || false, obstacles = layout.obstacles || [] } = {}) {
    layout.insetLeft = insetLeft;
    layout.narrow = narrow;
    layout.obstacles = obstacles;
    if (!last?.view || el.hidden) return { fits: true };
    // The bottom band stays free for the legend bar (left) and the company codes (right).
    const width = el.clientWidth;
    const height = el.clientHeight - BOTTOM_BAND;
    if (!width || height < 60) return { fits: false };
    const ring = [];
    const outer = [];
    const moved = [];
    for (const a of last.view.accounts) {
      const r = reg.get(a.id);
      if (!r) continue;
      if (a.linked) ring.push(a.id);
      else if (r.place === "ring") moved.push(a.id);
      else outer.push(a.id);
    }
    const sats = [...reg.entries()].filter(([, r]) => r.place === "satellite").map(([id, r]) => ({ vendor_id: id, probe: r.probe }));
    geom = constellationGeometry({ width, height, ring, outer, moved, satellites: sats, insetLeft, narrow, captionW: hubLabel.offsetWidth || 260 });
    // The labels take the width the geometry chose for them.
    el.dataset.labelw = geom.labelRoom === LABEL_ROOMS[0] ? "wide" : "slim";
    hub.dataset.size = geom.small ? "small" : geom.r < 60 ? "mid" : "full";
    hub.style.setProperty("--x", `${Math.round(geom.hub.x)}px`);
    hub.style.setProperty("--y", `${Math.round(geom.hub.y)}px`);
    hub.style.setProperty("--ring-r", `${Math.round(geom.r)}px`);
    // The hub grows and shrinks with its ring, so a small ring never closes around it (and it stays a
    // 44 px target); a small ring drops the halos.
    hub.style.setProperty("--hub-d", `${Math.round(clamp(geom.r * 0.5, 44, 72))}px`);
    el.dataset.halo = String(geom.r >= 60);
    ringZone.setAttribute("cx", geom.hub.x);
    ringZone.setAttribute("cy", geom.hub.y);
    ringZone.setAttribute("r", geom.r);
    // Accounts shrink with a small ring, so they never cover the hub (hit areas stay ≥ 44 px).
    const k = clamp(geom.r / 110, 0.6, 1.15);
    for (const r of reg.values()) {
      r.d = Math.round(r.base * k);
      r.wrap.style.setProperty("--d", `${r.d}px`);
      r.wrap.style.setProperty("--hit-d", `${Math.max(44, r.d + 10)}px`);
    }
    const lr = geom.r + 9;
    ringPath.setAttribute("d", `M ${geom.hub.x - lr} ${geom.hub.y} A ${lr} ${lr} 0 0 1 ${geom.hub.x + lr} ${geom.hub.y}`);
    const textLen = ringTextPath.textContent.length * 9.4 + 8;
    ringText.style.display = geom.r >= 56 && !geom.small && ringLabelClear({ hub: geom.hub, lr, textLen, pos: geom.pos, dotOf: (id) => reg.get(id)?.d || 24 }) ? "" : "none";
    const targets = new Map();
    for (const [id, r] of reg) {
      const p = geom.pos.get(id);
      if (!p) continue;
      r.wrap.dataset.side = p.side;
      targets.set(id, p);
    }
    const labelsFit = spaceLabels(targets, el.clientHeight - BOTTOM_BAND, obstacles);
    const fits = geom.fits && labelsFit;
    // An account that changed place glides (and one still gliding goes on from where it is); the
    // rest jump to their new position.
    const from = new Map([...reg]
      .filter(([id, r]) => r.x !== null && targets.has(id) && (r.gliding || (r.placedAs && r.placedAs !== r.place)))
      .map(([id, r]) => [id, { x: r.x, y: r.y }]));
    for (const r of reg.values()) r.placedAs = r.place;
    const moving = animate || from.size ? [...from].filter(([id, f]) => Math.hypot(f.x - targets.get(id).x, f.y - targets.get(id).y) > 2) : [];
    if (tween) { cancelAnimationFrame(tween); tween = null; }
    if (!moving.length || prefersReducedMotion() || !fits) {
      for (const r of reg.values()) r.gliding = false;
      place(targets, null, 1);
      return { fits };
    }
    const gliding = new Map(moving);
    for (const [id, r] of reg) r.gliding = gliding.has(id);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 950);
      place(targets, gliding, 1 - (1 - t) ** 3);
      if (t < 1) tween = requestAnimationFrame(step);
      else { tween = null; for (const r of reg.values()) r.gliding = false; }
    };
    tween = requestAnimationFrame(step);
    return { fits };
  }

  /**
   * Shifts labels vertically so none overlaps another, the group's caption, another account, the
   * company codes, the folded legend or a look-alike's struck link. When a side has no room for all
   * its labels, they drop their check badges, then their spend line, then their reason (the name
   * stays). Returns whether they all came clear.
   */
  function spaceLabels(targets, bottom, extra = []) {
    if (el.dataset.labels === "off" || !geom) { el.dataset.dense = "0"; return true; }
    for (const dense of ["0", "1", "2", "3"]) {
      el.dataset.dense = dense;
      const { items, obstacles } = measureLabels(targets);
      const need = Math.max(0, ...["left", "right"].map((side) => items.filter((it) => it.side === side).reduce((sum, it) => sum + it.h + 6, 0)));
      if (need > bottom - 2 && dense !== "3") continue;
      const all = [...obstacles, ...extra];
      const dy = separateLabels(items, all, { top: 2, bottom });
      const clear = labelsClear(items, dy, all, { bottom, width: el.clientWidth });
      if (!clear && dense !== "3") continue;
      for (const [id, r] of reg) r.wrap.style.setProperty("--label-dy", `${dy.get(id) || 0}px`);
      return clear;
    }
    return false;
  }

  /** The labels' boxes at their accounts' target places, and the fixed boxes they must keep clear of. */
  function measureLabels(targets) {
    const items = [];
    const obstacles = [];
    for (const [id, p] of targets) {
      const r = reg.get(id);
      obstacles.push({ x0: p.x - r.d / 2, x1: p.x + r.d / 2, y0: p.y - r.d / 2, y1: p.y + r.d / 2, owner: id });
      const w = r.label.offsetWidth;
      const hgt = r.label.offsetHeight;
      if (!w || !hgt) continue;
      const near = r.d / 2 + 12;
      items.push(p.side === "left"
        ? { id, side: "left", x0: p.x - near - w, x1: p.x - near, y: p.y, h: hgt }
        : { id, side: "right", x0: p.x + near, x1: p.x + near + w, y: p.y, h: hgt });
    }
    const hb = hubBtn.offsetWidth / 2 || 32;
    obstacles.push({ x0: geom.hub.x - hb, x1: geom.hub.x + hb, y0: geom.hub.y - hb, y1: geom.hub.y + hb });
    if (hubLabel.offsetWidth) {
      const top = geom.hub.y + geom.r + (hub.dataset.size === "mid" ? 6 : 12);
      obstacles.push({ x0: geom.hub.x - hubLabel.offsetWidth / 2, x1: geom.hub.x + hubLabel.offsetWidth / 2, y0: top, y1: top + hubLabel.offsetHeight });
    }
    if (codes.offsetWidth) {
      const cb = codes.getBoundingClientRect();
      const eb = el.getBoundingClientRect();
      obstacles.push({ x0: cb.left - eb.left, x1: cb.right - eb.left, y0: cb.top - eb.top, y1: cb.bottom - eb.top });
    }
    // The struck link's words ("67 % alike · no merge") at the middle of a look-alike's link.
    const em = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    for (const [id, p] of targets) {
      const r = reg.get(id);
      const q = r?.place === "satellite" ? targets.get(r.probe) : null;
      if (!q) continue;
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      const len = `${Math.round(r.similarity || 0)} % alike · no merge`.length * em * 0.86 * 0.56;
      obstacles.push({ x0: mx - 12, x1: mx + 15 + len, y0: my - 12, y1: my + 10 });
    }
    return { items, obstacles };
  }

  function place(targets, from, k) {
    for (const [id, p] of targets) {
      const r = reg.get(id);
      const f = from?.get(id);
      const x = f ? f.x + (p.x - f.x) * k : p.x;
      const y = f ? f.y + (p.y - f.y) * k : p.y;
      r.x = x; r.y = y;
      r.wrap.style.setProperty("--x", `${Math.round(x)}px`);
      r.wrap.style.setProperty("--y", `${Math.round(y)}px`);
      if (r.line && geom) {
        r.line.setAttribute("x1", geom.hub.x); r.line.setAttribute("y1", geom.hub.y);
        r.line.setAttribute("x2", x); r.line.setAttribute("y2", y);
      }
    }
    drawLookalikes();
  }

  /** The struck link between a look-alike and the account it resembles: names never merge. */
  function drawLookalikes() {
    looks.replaceChildren();
    for (const r of reg.values()) {
      if (r.place !== "satellite") continue;
      const p = reg.get(r.probe);
      if (!p || p.x === null || r.x === null) continue;
      const mx = (p.x + r.x) / 2;
      const my = (p.y + r.y) / 2;
      const text = svg("text", { class: "lookalike-label", x: mx + 15, y: my + 5 });
      text.textContent = `${Math.round(r.similarity || 0)} % alike · no merge`;
      looks.append(
        svg("line", { class: "lookalike-link", x1: p.x, y1: p.y, x2: r.x, y2: r.y }),
        svg("circle", { class: "lookalike-x", cx: mx, cy: my, r: 9 }),
        svg("path", { class: "lookalike-x-mark", d: `M ${mx - 4} ${my - 4} L ${mx + 4} ${my + 4} M ${mx + 4} ${my - 4} L ${mx - 4} ${my + 4}` }),
        text
      );
    }
  }

  return {
    element: el, render, layout, hub: hubBtn,
    nodeButton: (id) => reg.get(id)?.hit || null,
    codeButton: (id) => codeBtns.get(id) || null
  };
}
