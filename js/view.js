// Draws one step of js/story.js into the page: the stage on the left (the one picture to look at: the
// threshold race, or who belongs to the group) and the story on the right (what the step shows, its one
// card, the agent's own words and the decision log). Every figure comes in as text or as an engine
// result; the race is drawn from board_data.js's raceView. Lilac marks what the agent wrote or suggested.

import { eur, eurFull, eurSpend, plural } from "./plain.js";
import { dateWithYear } from "./format.js";

const $ = (id) => document.getElementById(id);
/** "25 Sep 2025 – 24 Sep 2026" from the engine's "2025-09-25 to 2026-09-24", each date kept on one line. */
const periodText = (period) => {
  const [a, b] = String(period || "").split(" to ");
  const keep = (s) => String(s).replace(/ /g, " ");
  return b ? `${keep(dateWithYear(a))} – ${keep(dateWithYear(b))}` : String(period || "");
};

/** A small element builder: h("p", { class: "x", onclick }, "text", child). */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    // Through the CSSOM: the page's security policy refuses style attributes, not style properties.
    else if (k === "style") for (const [prop, val] of String(v).split(";").map((d) => d.split(":"))) { if (prop?.trim()) el.style.setProperty(prop.trim(), val.trim()); }
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const icon = (name) => h("span", { class: `vc-icon vc-icon--${name}`, "aria-hidden": "true" });
const tag = (text, tone = "feature", ic = "sparkle") => h("span", { class: `vc-tag vc-tag--${tone}` }, ic ? icon(ic) : null, text);
const LABEL = /^(Signal received|Hypothesis|Check|Confirmed|Not confirmed|Revised|Finding|Impact|Recommendation|First estimate|Response levers|What-if, not verified|Option [ABC] (?:approved|rejected)|Loss accepted)([:.])/;

let drawn = "";

/** Draws a step; a step that reads as it did is left alone, so focus and open details stay put. */
export function renderStep(step, { mode, act, log }) {
  const key = JSON.stringify([step, mode, log]);
  if (key === drawn) return;
  drawn = key;
  // The stage: the picture.
  const stage = step.stage;
  $("stage-title").textContent = stage.title || "";
  $("stage-title").hidden = !stage.title;
  $("stage-body").replaceChildren(...(STAGES[stage.kind] || STAGES.empty)(stage, act));
  $("stage-body").dataset.kind = stage.kind;
  // The race's labels are fitted whenever a bar changes size: on drawing, when the fonts arrive, on resize.
  fitter?.disconnect();
  for (const t of $("stage-body").querySelectorAll(".race-track")) fitter?.observe(t);
  // The story: what the step shows, its card, the agent's words, the log.
  $("story-title").textContent = step.title;
  $("story-lead").textContent = step.lead;
  $("story-card").replaceChildren(...(step.card ? (CARDS[step.card.kind] || CARDS.empty)(step.card, act) : []));
  const working = $("story-working");
  working.hidden = !step.working;
  $("story-working-text").textContent = step.working ? `Claude is ${step.working}…` : "";
  const said = step.agent;
  $("agent").hidden = !said.length;
  $("agent-note").textContent = mode === "live" ? "Claude, live on your key" : "replayed, not live";
  $("agent-words").replaceChildren(...notes(said));
  const showLog = log.length && ["propose", "prepare"].includes(step.id);
  $("log").hidden = !showLog;
  if (showLog) {
    const time = (at) => (at ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
    $("log-summary").textContent = `Decision log: ${plural(log.length, "entry", "entries")}`;
    $("log-list").replaceChildren(...log.map((e) => h("li", {}, e.at ? h("time", { datetime: e.at }, time(e.at)) : null, ` ${e.who} ${e.what}`)));
  }
}

/** The agent's words, a paragraph each, with its own lead-in ("Revised:") in bold. */
function paragraphs(text) {
  return String(text).split(/\n\s*\n/).filter((p) => p.trim()).map((p) => {
    const m = LABEL.exec(p);
    return { label: m ? m[1] : "", el: m ? h("p", {}, h("strong", {}, `${m[1]}${m[2]}`), p.slice(m[0].length)) : h("p", {}, p) };
  });
}

// Which of the agent's notes in a step says most: a correction, then the impact, the recommendation,
// a decision, its hypothesis and findings; how it got there comes after.
const RANK = [/^Revised$/, /^Impact$/, /^Recommendation$/, /^(Option [ABC] approved|Loss accepted)$/, /^Hypothesis$/, /^Finding$/, /^(Confirmed|Not confirmed|What-if, not verified)$/, /^First estimate$/, /^Check$/, /^Signal received$/];
const rank = (label) => { const i = RANK.findIndex((r) => r.test(label)); return i < 0 ? RANK.length : i; };

/** The step's headline note in view, the agent's other notes one click away, notices always shown. */
function notes(said) {
  const notices = said.filter((s) => s.kind === "notice").map((s) => h("p", { class: "notice", dataset: { level: s.level || "info" } }, s.text));
  const all = said.filter((s) => s.kind !== "notice").flatMap((s) => paragraphs(s.text));
  if (all.length <= 1) return [...all.map((x) => x.el), ...notices];
  let top = all.length - 1;
  all.forEach((x, i) => { if (rank(x.label) <= rank(all[top].label)) top = i; });
  const rest = all.filter((_, i) => i !== top).map((x) => x.el);
  return [all[top].el, h("details", { class: "agent-more" }, h("summary", {}, `${plural(rest.length, "more note")} from the agent`), ...rest), ...notices];
}

// ---- the stage ----------------------------------------------------------------------------------------

const STAGES = {
  wait: () => [h("p", { class: "stage-empty" }, h("span", { class: "vc-spinner vc-spinner--sm", "aria-hidden": "true" }), " The agent is working on it.")],
  empty: (s) => [h("p", { class: "stage-empty" }, s.text || "")],
  race: (s) => [race(s)],
  members: (s) => [members(s)],
  options: (s, act) => [h("ul", { class: "options" }, s.cards.map((o) => option(o, act)))]
};

/**
 * The threshold race: a bar a year, made of the accounts, against the agreement's tiers. Slate is what
 * the year-end report counted, coral what it missed, lilac stripes an account the register does not
 * list (a what-if). On the right, what the year is worth: the report's view, or the engine's.
 */
function race(s) {
  const r = s.race;
  const max = r.scale_max;
  const pct = (x) => Math.max(0, Math.min(100, (x / max) * 100));
  const at = (x) => `${pct(x).toFixed(2)}%`;
  // Near the right end of the scale a label goes to the left of its mark, so it stays inside the track.
  const end = (x, from = 80) => pct(x) > from;
  const rows = r.rows.map((row) => {
    const segs = row.segments.map((g) => h("span", { class: `seg seg--${g.kind}`, style: `width:${at(g.eur)}`, title: `${g.name}: ${eurSpend(g.eur)}` },
      h("span", { class: "seg-name" }, g.name)));
    const tiersEl = row.tiers.map((t) => h("span", { class: `race-tier${t.reached ? " race-tier--reached" : ""}${end(t.from_eur) ? " race-tier--end" : ""}`, style: `left:${at(t.from_eur)}`, "aria-hidden": "true" },
      h("span", { class: "race-tier-label" }, `${eurSpend(t.from_eur)} · ${t.rate_pct} %`)));
    const first = s.first && s.first.year === row.year ? h("span", { class: "race-first", style: `left:${at(s.first.spend)}`, "aria-hidden": "true" }, h("span", { class: "race-first-label" }, `first estimate ${eurSpend(s.first.spend)}`)) : null;
    const total = row.total_eur > 0 ? h("span", { class: `race-total${end(row.total_eur, 88) ? " race-total--in" : ""}`, style: `left:${at(row.total_eur)}` }, eurSpend(row.total_eur)) : null;
    const out = outcome(row, s);
    const missed = row.segments.filter((g) => g.kind !== "counted");
    return h("li", { class: "race-row", dataset: { year: row.year } },
      h("div", { class: "race-year" }, h("span", { class: "race-label" }, row.label, row.projected ? h("span", { class: "race-proj" }, ", projected") : null), h("span", { class: "race-period" }, periodText(row.period))),
      h("div", { class: "race-bar" },
        h("div", { class: "race-track", role: "img", "aria-label": ariaRow(row, out) }, ...segs, ...tiersEl, first, total),
        missed.length ? h("p", { class: "race-missed" }, `Missed by the report: ${missed.map((g) => `${g.name} ${eurSpend(g.eur)}`).join(", ")}`)
          : s.basis === "report" && row.segments.length ? h("p", { class: "race-counted" }, `Counted: ${row.segments.map((g) => `${g.name} ${eurSpend(g.eur)}`).join(", ")}`) : null),
      h("div", { class: "race-out", dataset: { tone: out.tone } }, h("strong", {}, out.big), ...out.small.map((x) => h("span", {}, x))));
  });
  const has = (kind) => r.rows.some((row) => row.segments.some((g) => g.kind === kind));
  return h("figure", { class: "race" },
    h("ul", { class: "legend", "aria-label": "Key" },
      h("li", {}, h("span", { class: "key key--counted", "aria-hidden": "true" }), "counted by the year-end report"),
      has("missed") ? h("li", {}, h("span", { class: "key key--missed", "aria-hidden": "true" }), "missed by it") : null,
      has("assumed") ? h("li", {}, h("span", { class: "key key--assumed", "aria-hidden": "true" }), "a look-alike, not in the register: a what-if") : null,
      h("li", {}, h("span", { class: "key key--tier", "aria-hidden": "true" }), "rebate tier: threshold and rate"),
      s.first ? h("li", {}, h("span", { class: "key key--first", "aria-hidden": "true" }), "the agent's first estimate") : null),
    h("ol", { class: "race-rows" }, rows));
}

/** What a year of the race is worth, in words: the report's view, the engine's, or after your decision. */
function outcome(row, s) {
  const o = row.out;
  const by = row.deadline_day >= 0 ? `claim within ${plural(row.deadline_day, "day")}` : "the claim window has closed";
  if (o.mode === "report") {
    if (o.pending) return { tone: "muted", big: "Not run yet", small: ["the report runs when the year ends"] };
    if (!o.listed) return { tone: "muted", big: "No claim", small: [String(o.listed_text).replace(/^no \(/, "the report ").replace(/\)$/, "")] };
    if (o.rebate_shown_eur > 0) return { tone: "muted", big: eurFull(o.rebate_shown_eur), small: [`${o.tier_shown_pct} % shown by the report`] };
    return { tone: "muted", big: "No claim", small: [`below ${eurSpend(row.tiers[0]?.from_eur || 0)} as counted`] };
  }
  const d = s.decision;
  if (d && o.open_eur > 0.5) {
    if (d.kind === "accepted") return { tone: "affected", big: eurFull(o.open_eur), small: ["you accepted the loss"] };
    const c = d.years?.[row.year];
    if (c) return { tone: "resolved", big: eurFull(c.eur), small: [`${d.label} approved`, `${c.via}, cash after ${plural(c.day, "day")}`] };
    return { tone: "at_risk", big: eurFull(o.open_eur), small: [`still lost with ${d.label.replace(/^Option/, "option")}`] };
  }
  if (o.status === "open") return { tone: "affected", big: eurFull(o.open_eur), small: [o.credited_eur > 0.5 ? `owed beyond the ${eurFull(o.credited_eur)} credited` : `owed: ${row.tier_pct} % of ${eurSpend(row.total_eur)}`, by] };
  if (o.status === "projected") return { tone: "at_risk", big: eurFull(o.open_eur), small: [`projected: ${row.tier_pct} % of ${eurSpend(row.total_eur)}`, "slips the same way"] };
  if (o.status === "settled") return { tone: "resolved", big: "Settled", small: ["nothing open"] };
  if (o.status === "expired") return { tone: "muted", big: eurFull(o.open_eur), small: ["lapsed: the window closed"] };
  return { tone: "muted", big: "No rebate", small: [`below ${eurSpend(row.tiers[0]?.from_eur || 0)}`] };
}

function ariaRow(row, out) {
  const counted = row.segments.filter((g) => g.kind === "counted").reduce((n, g) => n + g.eur, 0);
  const missed = row.segments.filter((g) => g.kind !== "counted").reduce((n, g) => n + g.eur, 0);
  return `${row.label}: ${eurSpend(row.total_eur)}${missed ? `, of which the report counted ${eurSpend(counted)} and missed ${eurSpend(missed)}` : ""}; tiers ${row.tiers.map((t) => `${t.rate_pct} % from ${eurSpend(t.from_eur)}`).join(", ")}. ${out.big}, ${out.small.join(", ")}.`;
}

/**
 * Names inside the race's segments show only where they fit, and a kind of account (counted, missed) is
 * named in all its segments or in none, so no bar looks half labelled. The line under the bar names them.
 */
function fitLabels() {
  const names = [...document.querySelectorAll(".seg-name")];
  for (const el of names) el.hidden = false;
  const fits = (el) => el.scrollWidth > 0 && el.scrollWidth <= el.parentElement.clientWidth - 6;
  for (const kind of ["counted", "missed", "assumed"]) {
    const group = names.filter((el) => el.parentElement.classList.contains(`seg--${kind}`));
    const show = group.every(fits);
    for (const el of group) el.hidden = !show;
  }
}
const fitter = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fitLabels);

/** Who belongs to the group: every account the register gives it, and whether the report counts it. */
function members(s) {
  const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const since = (m) => (m.since ? `acquired ${fmt(m.since)}` : m.status === "linked" ? "part of the group" : m.status === "unverified" ? "not in the register" : "a member");
  const rows = s.members.map((m) => h("tr", { dataset: { status: m.status } },
    h("th", { scope: "row" }, h("span", { class: "who" }, h("span", { class: `hex hex--${m.status === "linked" ? "counted" : "missed"}`, "aria-hidden": "true" }), m.name),
      h("span", { class: "cell-note" }, `${m.place} · ${since(m)}`, m.tip ? tag("named in the tip", "info", null) : null, m.found ? tag("found by the agent") : null)),
    h("td", {}, m.status === "linked" ? "counted" : "missed: not linked"),
    h("td", { class: "vc-num" }, m.spend !== null ? eurSpend(m.spend) : "")));
  const looks = s.lookalikes.map((l) => h("tr", { dataset: { status: "lookalike" } },
    h("th", { scope: "row" }, h("span", { class: "who" }, h("span", { class: "hex hex--other", "aria-hidden": "true" }), l.name),
      h("span", { class: "cell-note" }, `${l.similarity} % alike by name; the register puts it in ${l.group || "another group"}`)),
    h("td", {}, "never counted"), h("td", {})));
  return h("div", { class: "vc-table-wrap members" }, h("table", { class: "vc-table vc-table--compact" },
    h("caption", { class: "vc-visually-hidden" }, s.title),
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Account, per the register"), h("th", { scope: "col" }, "Year-end report"), h("th", { scope: "col", class: "vc-num" }, "Closed year"))),
    h("tbody", {}, rows, looks)));
}

// ---- the story's card -------------------------------------------------------------------------------

const CARDS = {
  wait: () => [h("p", { class: "card card--wait" }, h("span", { class: "vc-spinner vc-spinner--sm", "aria-hidden": "true" }), " The agent is working on it.")],
  empty: (c) => [h("p", { class: "card card--empty" }, c.text || "")],
  tip: (c) => [h("div", { class: "card" }, h("p", { class: "card-title" }, icon("bell"), c.from ? `The tip, from ${c.from}` : "The tip"), h("blockquote", {}, c.text))],
  alert: (c) => [h("div", { class: `card card--alert${c.what_if ? " card--what-if" : ""}`, role: "status" },
    h("p", { class: "card-title" }, icon(c.what_if ? "warning" : "shield"), c.what_if ? "A what-if, not confirmed" : `Confirmed by ${plural(Math.max(2, c.sources.length), "source")}`),
    h("p", {}, c.summary),
    c.sources.length ? h("details", { class: "sources" }, h("summary", {}, `The ${plural(c.sources.length, "source")}`), h("ul", {}, c.sources.map((x) => h("li", {}, x)))) : null)],
  figures: (c) => [h("div", { class: "figs" }, c.figs.map((f) => h("div", { class: "fig", dataset: { tone: f.tone } },
    h("p", { class: "fig-label" }, f.label), h("p", { class: "fig-value" }, f.value), h("p", { class: "fig-note" }, f.note))))],
  drafts: (c, act) => [
    c.drafts.length ? h("div", { class: "drafts-bar" }, tag("Drafted by the agent")) : null,
    h("ul", { class: "drafts" }, c.drafts.map((d) => draft(d, act))),
    c.summary ? summary(c.summary) : null
  ].filter(Boolean)
};

function option(o, act) {
  const base = o.id === "baseline";
  const figs = base
    ? h("p", { class: "option-figs" }, "Loses ", h("strong", {}, eur(o.left)), o.firstLoss !== null && o.firstLoss !== undefined ? `; the first claim lapses in ${plural(o.firstLoss, "day")}` : "")
    : h("p", { class: "option-figs" }, "Costs ", h("strong", {}, eur(o.cost)), ", leaves ", h("strong", {}, eur(o.left)), " lost, cash after ", plural(o.days, "day"));
  let actions;
  if (o.state === "approved") actions = h("span", { class: "option-tag" }, icon("check"), base ? " Accepted" : " Approved");
  else if (o.state === "rejected") actions = h("span", { class: "option-tag" }, "Rejected");
  else if (o.state === "passed") actions = h("span", { class: "option-tag" }, "Not chosen");
  else actions = h("div", { class: "option-actions" },
    h("button", { type: "button", class: "vc-button vc-button--secondary", dataset: { action: "approve" }, onclick: () => act.decide(o.id, "approved") }, icon("check"), base ? "Accept the loss" : "Approve"),
    base ? null : h("button", { type: "button", class: "vc-button vc-button--ghost", dataset: { action: "reject" }, onclick: () => act.decide(o.id, "rejected") }, "Reject"));
  return h("li", { class: "option", dataset: { option: o.id, recommended: String(!!o.recommended), state: o.state } },
    h("span", { class: "option-letter", "aria-hidden": "true" }, o.letter),
    h("div", { class: "option-text" },
      h("p", { class: "option-title" }, base ? "Do nothing" : `Option ${o.letter}: ${o.title}`, o.recommended ? tag("Recommended") : null),
      figs,
      !base && o.description ? h("details", { class: "option-more" }, h("summary", {}, "What it means"), h("p", {}, o.description), o.risk ? h("p", { class: "option-risk" }, `Risk: ${o.risk}`) : null) : null),
    actions);
}

function draft(d, act) {
  const status = d.status === "approved" ? h("span", { class: "draft-status" }, icon("check"), " Approved, not sent")
    : d.status === "rejected" ? h("span", { class: "draft-status" }, "Rejected")
      : h("span", { class: "draft-actions" },
        h("button", { type: "button", class: "vc-button vc-button--secondary", dataset: { action: "approve" }, onclick: () => act.decideDraft(d.id, "approved") }, "Approve"),
        h("button", { type: "button", class: "vc-button vc-button--ghost", dataset: { action: "reject" }, onclick: () => act.decideDraft(d.id, "rejected") }, "Reject"));
  // One line a draft: who it goes to, and its subject, which opens the text.
  return h("li", { class: "draft", dataset: { status: d.status } },
    icon(d.type === "posting" ? "receipt" : d.type === "memo" ? "memo" : "mail"),
    h("div", { class: "draft-what" },
      h("p", { class: "draft-to" }, `${d.kind} to ${d.to}`),
      h("details", {}, h("summary", { class: "draft-subject", title: d.subject }, d.subject), h("pre", {}, d.body))),
    status);
}

/** The agent's management summary, from its Markdown: headings, paragraphs, bold, a table. */
function summary(md) {
  const box = h("details", { class: "summary" }, h("summary", {}, h("strong", {}, "Management summary"), tag("Written by the agent")));
  const inline = (text) => text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).map((t) => (t.startsWith("**") ? h("strong", {}, t.slice(2, -2)) : t.startsWith("*") ? h("em", {}, t.slice(1, -1)) : t));
  for (const b of md.split(/\n\s*\n/)) {
    if (/^#+\s/.test(b)) box.append(h("h3", {}, b.replace(/^#+\s*/, "")));
    else if (/^\|/.test(b)) {
      const rows = b.split("\n").filter((r) => !/^\|\s*-/.test(r)).map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      box.append(h("div", { class: "vc-table-wrap" }, h("table", { class: "vc-table vc-table--compact" },
        h("thead", {}, h("tr", {}, rows[0].map((c) => h("th", { scope: "col" }, c)))),
        h("tbody", {}, rows.slice(1).map((r) => h("tr", {}, r.map((c, i) => (i ? h("td", { class: "vc-num" }, c) : h("th", { scope: "row" }, c)))))))));
    } else box.append(h("p", {}, inline(b)));
  }
  return box;
}
