// The threshold race: one bar per agreement year (the look-back year, the closed year, the current
// year), built from the accounts as segments, against the agreement's rebate tiers. Slate is what
// GlobalCorp's year-end report counted; red is what it missed; violet stripes are a what-if account;
// after a decision green is what the approved option claims and amber what is still lost. The
// figures on the right are the engine's (owed, credited, open) or, before the agent has counted, what
// the report filed. The key sits in the card's head.

import { h, prefersReducedMotion } from "./dom.js";
import { eurCompact, eurFull, eurMillions, shortDate, dateWithYear } from "./format.js";
import { UI } from "./config.js";

// The tones of the board's tags, as Vici's tag modifiers (lilac for the agent's own figures).
export const TAG_TONE = { ai: "vc-tag--feature", info: "vc-tag--info", risk: "vc-tag--warning", danger: "vc-tag--danger", approved: "vc-tag--success" };

export const BASIS_CHIP = {
  report: ["Year-end report", null],
  estimate: ["First estimate", "ai"],
  verified: ["Verified count", "info"],
  what_if: ["What-if, not verified", "ai"],
  partial: ["Partial count", "risk"]
};

/** "€50M" for a tier threshold, in the board's one notation for millions (€52.40M on the same bar). */
export const tierMoney = eurMillions;

/**
 * "18 Aug 2025 – 17 Aug 2026" from the engine's "2025-08-18 to 2026-08-17". Each date keeps its
 * words together, so a narrow column breaks the period after the dash only.
 */
export function periodText(period) {
  const [a, b] = String(period || "").split(" to ");
  const keep = (s) => String(s).replace(/ /g, "\u00a0");
  return b ? `${keep(dateWithYear(a))} – ${keep(dateWithYear(b))}` : String(period || "");
}

/** Days until a deadline, in words. */
function inDays(day) {
  if (day === null || day === undefined) return "";
  if (day < 0) return `${-day} days ago`;
  if (day === 0) return "today";
  return day === 1 ? "in 1 day" : `in ${day} days`;
}

/** "credit note" or "set-off + credit note", from a decision's ways in. */
export function viaText(via) {
  return (Array.isArray(via) ? via : via ? [via] : []).filter(Boolean).join(" + ");
}

/**
 * The figures and words on the right of a row. `decision` is what the approved option does to the
 * year, from the engine's cash plan (board.js decisionYears): { kind: "full" | "partial" | "lost",
 * label, recovered_eur, lost_eur, via: [], cash_day } or, when the presenter chose to do nothing,
 * { kind: "accepted" }. An approval is a decision, not money in the bank: the words say "approved"
 * and when the cash comes in (the option cards' "cash in after").
 */
export function rowOutcome(row, { decision = null } = {}) {
  const o = row.out;
  const urgent = row.deadline_day >= 0 && row.deadline_day <= UI.urgentDays;
  const by = row.deadline_day >= 0 ? `claim by ${shortDate(row.deadline_date)}, ${inDays(row.deadline_day)}` : "claim window closed";
  const closes = row.deadline_day >= 0 ? `window closes ${inDays(row.deadline_day)}` : "window closed";
  // brief: the one line a short board keeps under the figure.
  if (o.mode === "report") {
    if (o.pending) return { tone: "muted", value: null, big: "Not run yet", small: [o.report_after ? `the report runs after ${shortDate(o.report_after)}` : "the report runs after the year ends"], brief: "report runs at year end", urgent: false };
    if (!o.listed) return { tone: "muted", value: null, big: "Not listed", small: [String(o.listed_text).replace(/^no \(/, "the report ").replace(/\)$/, ""), row.deadline_day >= 0 ? `window closes ${shortDate(row.deadline_date)}, ${inDays(row.deadline_day)}` : ""], brief: closes, urgent };
    if (o.rebate_shown_eur > 0) return { tone: "muted", value: o.rebate_shown_eur, big: eurFull(o.rebate_shown_eur), small: [`${o.tier_shown_pct} % shown by the report`, o.claim_filed], brief: `${o.tier_shown_pct} % shown by the report`, urgent: false };
    return { tone: "muted", value: null, big: "No claim", small: ["the report shows no rebate", row.deadline_day >= 0 ? `window closes ${shortDate(row.deadline_date)}, ${inDays(row.deadline_day)}` : "claim window closed"], brief: closes, urgent };
  }
  if (decision && o.open_eur > 0.5) {
    if (decision.kind === "accepted") return { tone: "affected", value: o.open_eur, big: eurFull(o.open_eur), small: ["loss accepted: do nothing", `lapses ${shortDate(row.deadline_date)}`], brief: "loss accepted", urgent: false };
    const how = viaText(decision.via);
    if (decision.kind === "full") {
      const when = decision.cash_day !== null && decision.cash_day !== undefined ? ` · cash in ${shortDate(decision.cash_day)}` : "";
      return { tone: "resolved", value: o.open_eur, big: eurFull(o.open_eur), small: [`${decision.label} approved`, `${how}${when}`], brief: `${decision.label} approved`, urgent: false };
    }
    if (decision.kind === "partial") {
      return { tone: "at_risk", value: decision.lost_eur, big: eurFull(decision.lost_eur), small: [`still lost with ${decision.label}`, `${eurCompact(decision.recovered_eur)} by ${how}`], brief: `still lost with ${decision.label}`, urgent };
    }
    return { tone: "at_risk", value: o.open_eur, big: eurFull(o.open_eur), small: [`still lost with ${decision.label}`, by], brief: `still lost with ${decision.label}`, urgent };
  }
  switch (o.status) {
    case "open": {
      const what = o.credited_eur > 0.5 ? `open: ${eurFull(o.owed_eur)} owed, ${eurFull(o.credited_eur)} credited`
        : o.claimed_eur > 0.5 ? `open: ${eurFull(o.owed_eur)} owed, ${eurFull(o.claimed_eur)} claimed`
          : `open: ${row.tier_pct} % of ${eurCompact(row.total_eur)}`;
      return { tone: "affected", value: o.open_eur, big: eurFull(o.open_eur), small: [what, by], brief: row.deadline_day >= 0 ? `claim ${inDays(row.deadline_day)}` : "claim window closed", urgent };
    }
    case "projected":
      return { tone: "at_risk", value: o.open_eur, big: eurFull(o.open_eur), small: [`projected: ${row.tier_pct} % of ${eurCompact(row.total_eur)}`, `claim due ${shortDate(row.deadline_date)}`], brief: "projected", urgent: false };
    case "settled":
      return { tone: "resolved", value: null, big: "Settled", small: [o.credited_eur > 0.5 ? `${eurFull(o.credited_eur)} credited by the supplier` : `${eurFull(o.claimed_eur)} claimed by the report`], brief: "settled", urgent: false };
    case "expired":
      return { tone: "muted", value: o.open_eur, big: eurFull(o.open_eur), small: ["lapsed: the claim window closed"], brief: "lapsed", urgent: false };
    default: {
      const first = row.tiers[0];
      return { tone: "muted", value: null, big: "No rebate", small: [first ? `below the ${first.rate_pct} % tier at ${tierMoney(first.from_eur)}` : "no tier"], brief: first ? `below ${tierMoney(first.from_eur)}` : "no tier", urgent: false };
    }
  }
}

/**
 * A year whose missed accounts change nothing (no rebate either way, or settled): its missed segments
 * are drawn pale, so the red that asks for action stays with the money that is open.
 */
export function quietRow(row) {
  return row.out.mode === "result" && (row.out.status === "not_owed" || row.out.status === "settled");
}

/** How a decision colours a missed segment: green where fully covered, amber where some or all is still lost; an accepted loss stays red. */
function missedState(decision) {
  if (!decision || decision.kind === "accepted") return null;
  return decision.kind === "full" ? "resolved" : "at_risk";
}

const BASIS_WORDS = { report: "the year-end report's own count", estimate: "the agent's first estimate", verified: "a verified count", what_if: "a what-if, not verified", partial: "a partial count" };

/** The accessible description of a row (what a screen reader hears on the row button). */
function rowLabel(row, outcome, view, basisKey) {
  const counted = row.segments.filter((s) => s.kind === "counted").length;
  const missed = row.segments.filter((s) => s.kind === "missed").reduce((sum, s) => sum + s.eur, 0);
  const reached = [...row.tiers].reverse().find((t) => t.reached);
  const parts = [
    `${row.label}${row.projected ? ", projected" : ""}, ${periodText(row.period).replace(/\u00a0/g, " ")}`,
    BASIS_WORDS[basisKey] || null,
    view.mode === "report"
      ? `the year-end report counted ${eurCompact(row.total_eur)} on ${counted} linked account${counted === 1 ? "" : "s"}`
      : `eligible spend ${eurCompact(row.total_eur)} on ${row.segments.length} account${row.segments.length === 1 ? "" : "s"}, of which the report counted ${eurCompact(row.counted_eur)}${missed > 0.5 ? ` and missed ${eurCompact(missed)}` : ""}`,
    reached ? `the ${reached.rate_pct} % tier from ${tierMoney(reached.from_eur)} is reached` : `below the first tier at ${row.tiers[0] ? tierMoney(row.tiers[0].from_eur) : "—"}`,
    `${outcome.big}${outcome.small.filter(Boolean).length ? `: ${outcome.small.filter(Boolean).join(", ")}` : ""}`
  ].filter(Boolean);
  return `${parts.join("; ")}. Opens the details.`;
}

/**
 * The order in which a short board keeps race rows: years with money open (or decided) first, the
 * nearest deadline first; then the closed year (AY), the current year (CY) and the look-back year (PY).
 */
export function rowPriority(rows, decisions = new Map()) {
  const open = (r) => (r.out.mode === "result" && r.out.open_eur > 0.5) || decisions.has(r.year);
  const rank = { AY: 0, CY: 1, PY: 2 };
  return [...rows].sort((p, q) => (Number(open(q)) - Number(open(p)))
    || (open(p) ? p.deadline_day - q.deadline_day : 0)
    || (rank[p.year] - rank[q.year]));
}

/**
 * Creates the race card. ctx.onRow(row, element) opens a row's details. render(view, opts) updates it
 * in place, so segments slide, tiers flash when the bar crosses them and figures count up.
 * opts: { basisKey, decisions: Map(year → decision), showCY, only: Set(years) | null }. After a
 * decision the missed money of a year turns green where the approved option covers it and amber where
 * some is still lost. `only` shows just those years (a short board keeps the rows with money open,
 * whole: never a row cut in half); the others stay built, hidden, so they come back without a replay.
 */
export function createRace({ onRow }) {
  const chip = h("span", { class: "vc-tag" });
  const key = h("div", { class: "race-key", "aria-hidden": "true" });
  const more = h("span", { class: "race-hidden", hidden: true, title: "The board is short: it keeps the years with money open. Hide the drawer, or make the window taller, to see every year." }, "");
  const rowsEl = h("div", { class: "race-rows" });
  const el = h("section", { class: "race", "aria-label": "Threshold race" },
    h("div", { class: "race-head" }, h("h3", {}, "Threshold race"), key, more, chip),
    rowsEl);
  const rows = new Map(); // year → { btn, track, fill, segs: Map, tiers: [], min, total, gap, out, value, totalEur }
  let agreementId = null;

  function render(view, { basisKey = "report", decisions = new Map(), showCY = true, only = null } = {}) {
    if (!view) { rowsEl.replaceChildren(); rows.clear(); agreementId = null; return; }
    // Another agreement: new rows, so nothing animates as if this agreement's bar had moved.
    if (view.agreement.id !== agreementId) { rowsEl.replaceChildren(); rows.clear(); agreementId = view.agreement.id; }
    const [label, tone] = BASIS_CHIP[basisKey] || BASIS_CHIP.report;
    chip.textContent = label;
    chip.className = ["vc-tag", TAG_TONE[tone] || ""].filter(Boolean).join(" ");
    const shown = view.rows.filter((r) => showCY || r.year !== "CY");
    renderKey(view, shown);
    for (const [year, r] of rows) if (!shown.some((x) => x.year === year)) { r.btn.remove(); rows.delete(year); }
    shown.forEach((row, i) => {
      let r = rows.get(row.year);
      if (!r) r = makeRow(row);
      if (rowsEl.children[i] !== r.btn) rowsEl.insertBefore(r.btn, rowsEl.children[i] || null);
      updateRow(r, row, view, decisions.get(row.year) || null, basisKey);
    });
    setOnly(only);
  }

  /** Shows only these years (null: all); a hidden row keeps its state, and the head counts it. */
  function setOnly(only) {
    let hidden = 0;
    for (const [year, r] of rows) {
      r.btn.hidden = !!only && !only.has(year);
      if (r.btn.hidden) hidden += 1;
    }
    more.hidden = !hidden;
    more.textContent = hidden ? `+${hidden} year${hidden === 1 ? "" : "s"} not shown` : "";
  }

  /** How many rows are built but not shown (a short board). */
  function hiddenCount() {
    return [...rows.values()].filter((r) => r.btn.hidden).length;
  }

  /** The height of each shown row, in px (for a short board's choice of rows). */
  function rowHeights() {
    return new Map([...rows].filter(([, r]) => !r.btn.hidden).map(([year, r]) => [year, r.btn.offsetHeight]));
  }

  /**
   * The key, in the card's head: what the bar's colours and marks mean, only those on the bars now
   * (the counted money, the missed money once the agent has counted, a what-if account, the tiers and
   * the report's listing minimum).
   */
  function renderKey(view, shown) {
    const kinds = new Set(shown.flatMap((r) => r.segments.map((s) => s.kind)));
    const items = [
      ["counted", view.mode === "report" ? "Counted by the year-end report" : "Counted by the report"],
      kinds.has("missed") ? ["missed", "Missed by the report"] : null,
      kinds.has("assumed") ? ["assumed", "What-if account, not verified"] : null,
      ["tier", "Rebate tier"],
      view.agreement.report_min_eur > 0 ? ["min", "The report lists it from here"] : null
    ].filter(Boolean);
    const sig = items.map((x) => x.join(":")).join("|");
    if (key.dataset.sig === sig) return;
    key.dataset.sig = sig;
    key.replaceChildren(...items.map(([k, text]) => h("span", { class: "rk", dataset: { k } }, h("i", {}), text)));
  }

  function makeRow(row) {
    const yearEl = h("span", { class: "race-year" }, h("strong", {}, row.label), h("span", {}, ""));
    const fill = h("span", { class: "race-fill" });
    const total = h("span", { class: "race-total", "aria-hidden": "true" });
    const gap = h("span", { class: "race-gap", "aria-hidden": "true", hidden: true }, h("span", {}, ""));
    const track = h("span", { class: "race-track", "aria-hidden": "true" }, fill, total, gap);
    const out = h("span", { class: "race-out" }, h("strong", {}, ""), h("span", {}, ""), h("span", {}, ""), h("span", { class: "brief" }, ""));
    const btn = h("button", { class: "race-row", type: "button", dataset: { year: row.year } }, yearEl, track, out);
    const r = { btn, yearEl, track, fill, total, gap, out, segs: new Map(), tiers: [], min: null, value: null, totalEur: null, row };
    btn.addEventListener("click", () => onRow?.(r.row, btn));
    rows.set(row.year, r);
    return r;
  }

  function updateRow(r, row, view, decision, basisKey) {
    r.row = row;
    const scale = Math.max(1, view.scale_max);
    const pct = (x) => Math.max(0, Math.min(100, (x / scale) * 100));
    r.btn.dataset.projected = String(row.projected);
    r.btn.dataset.quiet = String(quietRow(row));
    r.yearEl.lastChild.textContent = periodText(row.period);

    // Segments, keyed by account: new ones grow from the end of the bar.
    let at = 0;
    const seen = new Set();
    const state = missedState(decision);
    for (const s of row.segments) {
      seen.add(s.vendor_id);
      let seg = r.segs.get(s.vendor_id);
      const left = pct(at);
      const width = pct(at + s.eur) - left;
      if (!seg) {
        seg = h("span", { class: "race-seg" });
        seg.style.left = `${left}%`;
        seg.style.width = "0%";
        r.fill.appendChild(seg);
        r.segs.set(s.vendor_id, seg);
        void seg.offsetWidth; // start the growth from zero width
      }
      seg.dataset.kind = s.kind;
      // A decision recolours the missed money: green where the approved option claims it, amber where it is still lost.
      if (state && s.kind === "missed") seg.dataset.state = state;
      else delete seg.dataset.state;
      seg.title = `${s.name} (${s.vendor_id}): ${eurCompact(s.eur)}${s.currency !== "EUR" ? ` at the contract rate (${s.currency} invoices)` : ""}${s.reason ? `, ${s.reason}` : ", counted by the report"}${s.kind === "missed" && quietRow(row) ? "; no rebate depends on it this year" : ""}`;
      seg.style.left = `${left}%`;
      seg.style.width = `${width}%`;
      at += s.eur;
    }
    for (const [id, seg] of r.segs) if (!seen.has(id)) { seg.style.width = "0%"; r.segs.delete(id); setTimeout(() => seg.remove(), 900); }

    // Tiers and the report's minimum: a tier the bar has just crossed flashes once.
    const prevTotal = r.totalEur ?? 0;
    // A new row places its tiers and total where they belong; only later changes slide.
    const fresh = r.totalEur === null;
    while (r.tiers.length > row.tiers.length) r.tiers.pop().remove();
    row.tiers.forEach((t, i) => {
      let el = r.tiers[i];
      if (!el) { el = h("span", { class: "race-tier" }, h("span", {}, "")); r.track.appendChild(el); r.tiers[i] = el; }
      const p = pct(t.from_eur);
      if (fresh) el.style.transition = "none";
      el.style.left = `${p}%`;
      el.dataset.edge = p > 80 ? "end" : "start";
      el.dataset.reached = String(!!t.reached);
      el.firstChild.textContent = `${tierMoney(t.from_eur)} · ${t.rate_pct} %`;
      if (r.totalEur !== null && prevTotal + 1e-6 < t.from_eur && row.total_eur + 1e-6 >= t.from_eur && !prefersReducedMotion()) {
        el.classList.remove("cross");
        void el.offsetWidth;
        el.classList.add("cross");
      }
    });
    const min = view.agreement.report_min_eur;
    if (min > 0) {
      if (!r.min) { r.min = h("span", { class: "race-min" }, h("span", {}, "")); r.track.appendChild(r.min); }
      const p = pct(min);
      r.min.style.left = `${p}%`;
      r.min.dataset.edge = p > 70 ? "end" : "start";
      r.min.firstChild.textContent = `report lists from ${tierMoney(min)}`;
    } else if (r.min) { r.min.remove(); r.min = null; }

    // The bar's total sits inside the track, just past the end of the bar (or just inside it when the
    // track has no room left), so it never meets the tier labels above or the report's minimum below,
    // and it moves aside so it never covers a tier tick: the gap to a tier is the point of the race.
    const end = pct(row.total_eur);
    r.total.textContent = eurCompact(row.total_eur);
    if (fresh) r.total.style.transition = "none";
    r.total.style.left = `${end}%`;
    const dx = totalOffset(r, row, end, pct, min);
    r.total.style.setProperty("--dx", `${dx}px`);
    r.total.dataset.side = dx < 0 ? "in" : "out";
    r.totalEur = row.total_eur;
    if (fresh) {
      void r.total.offsetWidth; // apply the start position, then let later changes slide again
      r.total.style.transition = "";
      for (const t of r.tiers) t.style.transition = "";
    }

    // What the report missed, bracketed under the bar (in a year where it changes the money).
    const missed = row.segments.filter((s) => s.kind === "missed").reduce((sum, s) => sum + s.eur, 0);
    const countedEnd = row.segments.filter((s) => s.kind === "counted").reduce((sum, s) => sum + s.eur, 0);
    const bracket = view.mode === "result" && missed > 0.5 && !quietRow(row);
    r.gap.hidden = !bracket;
    r.btn.dataset.bracket = String(bracket);
    if (bracket) {
      r.gap.style.left = `${pct(countedEnd)}%`;
      r.gap.style.width = `${pct(countedEnd + missed) - pct(countedEnd)}%`;
      r.gap.dataset.state = state || "affected";
      r.gap.firstChild.textContent = `${eurCompact(missed)} missed by the report`;
      r.gap.dataset.edge = pct(countedEnd + missed / 2) > 70 ? "end" : "start";
    }

    // Figures on the right.
    const outcome = rowOutcome(row, { decision });
    r.out.dataset.tone = outcome.tone;
    const [big, s1, s2, brief] = r.out.children;
    s1.textContent = outcome.small[0] || "";
    s2.textContent = outcome.small[1] || "";
    s2.className = outcome.urgent ? "urgent" : "";
    brief.textContent = outcome.brief || "";
    brief.className = outcome.urgent ? "brief urgent" : "brief";
    countTo(big, r, outcome);
    r.btn.setAttribute("aria-label", rowLabel(row, outcome, view, basisKey));
  }

  /**
   * Where the total's label goes, in px from the bar's end: just past it, or just inside it when the
   * track is full; either way moved past a tier tick or the report's minimum it would cover.
   */
  function totalOffset(r, row, end, pct, min) {
    const trackW = r.track.clientWidth;
    const w = r.total.offsetWidth || 56;
    if (!trackW) return 5;
    const endPx = (trackW * end) / 100;
    const ticks = [...row.tiers.map((t) => (trackW * pct(t.from_eur)) / 100), ...(min > 0 ? [(trackW * pct(min)) / 100] : [])];
    const covers = (x0) => ticks.find((t) => t >= x0 - 4 && t <= x0 + w + 4);
    let x0 = endPx + 5;
    for (let i = 0; i < 4; i += 1) { const t = covers(x0); if (t === undefined) break; x0 = t + 7; }
    if (x0 + w <= trackW - 2 || end < 12) return Math.round(x0 - endPx);
    x0 = endPx - 5 - w;
    for (let i = 0; i < 4; i += 1) { const t = covers(x0); if (t === undefined) break; x0 = t - 7 - w; }
    return Math.round(Math.max(2, x0) - endPx);
  }

  /** Rolls the figure on the right up (or down) to its new value. */
  function countTo(big, r, outcome) {
    const from = r.value;
    const to = outcome.value;
    r.value = to;
    if (to === null || from === null || from === to || prefersReducedMotion()) { big.textContent = outcome.big; return; }
    const t0 = performance.now();
    const dur = 900;
    const token = {};
    r.count = token;
    const step = (now) => {
      if (r.count !== token) return;
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - k) ** 3;
      big.textContent = k < 1 ? eurFull(from + (to - from) * e) : outcome.big;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return { element: el, render, setOnly, rowHeights, hiddenCount, rowButton: (year) => rows.get(year)?.btn || null };
}

/**
 * A small, static race track for the portfolio: the agreement-year bar, its segments and tiers (by
 * rate; the thresholds are in the row's text), and the report's minimum. Returns the track element.
 */
export function miniTrack(row, scaleMax, minEur = 0, decision = null) {
  const scale = Math.max(1, scaleMax);
  const pct = (x) => Math.max(0, Math.min(100, (x / scale) * 100));
  const fill = h("span", { class: "race-fill", dataset: { quiet: String(quietRow(row)) } });
  const state = missedState(decision);
  let at = 0;
  for (const s of row.segments) {
    const seg = h("span", { class: "race-seg", dataset: { kind: s.kind } });
    if (state && s.kind === "missed") seg.dataset.state = state;
    seg.style.left = `${pct(at)}%`;
    seg.style.width = `${pct(at + s.eur) - pct(at)}%`;
    at += s.eur;
    fill.appendChild(seg);
  }
  const track = h("span", { class: "race-track", "aria-hidden": "true" }, fill);
  for (const t of row.tiers) {
    const p = pct(t.from_eur);
    track.appendChild(h("span", { class: "race-tier", title: `${t.rate_pct} % from ${tierMoney(t.from_eur)}`, dataset: { reached: String(!!t.reached), edge: p > 86 ? "end" : "start" }, style: { left: `${p}%` } }, h("span", {}, `${t.rate_pct} %`)));
  }
  if (minEur > 0) {
    const p = pct(minEur);
    track.appendChild(h("span", { class: "race-min", dataset: { edge: p > 60 ? "end" : "start" }, style: { left: `${p}%` } }, h("span", {}, `report from ${tierMoney(minEur)}`)));
  }
  return track;
}
